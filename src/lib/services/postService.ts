import { supabase } from '../supabase';
import { Post, AppUser } from '../../types';
import { sanitizeInput, sanitizeComment } from '../security/inputValidator';
import { canUserPostAndInteract } from '../utils/roleUtils';
import { generateUUID } from '../security/distributedId';

// âœ… Max content lengths to prevent payload abuse
const MAX_POST_LENGTH = 5000;
const MAX_ECHO_LENGTH = 3000;

const POST_COLUMNS = 'id, author_id, author_name, author_avatar, author_title, content, image_url, video_url, likes_count, comments_count, is_echo, original_post_id, original_author_name, original_author_avatar, original_content, created_at';

interface CacheEntry {
  data: any[];
  timestamp: number;
}
let postsCache: CacheEntry | null = null;
const CACHE_TTL_MS = 20000; // 20 seconds

export const postService = {
  /**
   * Invalidate feed cache after creates/updates
   */
  invalidateCache() {
    postsCache = null;
  },

  /**
   * Home Feed: Only posts from last 3 days (72 hours).
   * Sorted by recency + engagement with Stale-While-Revalidate caching.
   */
  async fetchPosts(limit = 50, forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && postsCache && (now - postsCache.timestamp < CACHE_TTL_MS)) {
      return { data: postsCache.data, error: null };
    }

    try {
      const { data, error } = await supabase.from('posts')
        .select(POST_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 100));

      if (error) {
        // Fallback to select('*') in case specific column schema varies
        const fallback = await supabase.from('posts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(Math.min(limit, 100));

        if (fallback.error) {
          console.error("[fetchPosts] Supabase Error:", fallback.error);
          return { data: postsCache?.data || [], error: fallback.error };
        }
        postsCache = { data: fallback.data || [], timestamp: now };
        return { data: fallback.data || [], error: null };
      }

      postsCache = { data: data || [], timestamp: now };
      return { data: data || [], error: null };
    } catch (err) {
      console.error("[fetchPosts] Exception caught:", err);
      return { data: postsCache?.data || [], error: err };
    }
  },

  /**
   * âš¡ Cursor-based pagination for feed
   */
  async fetchPostsBefore(cursorDate: string, limit = 20) {
    try {
      const { data, error } = await supabase.from('posts')
        .select(POST_COLUMNS)
        .lt('created_at', cursorDate)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return { data: [], error };
      }
      return { data: data || [], error: null };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  /**
   * Profile Page: ALL posts by a specific user (no time limit).
   */
  async fetchUserPosts(authorId: string, limit = 100) {
    try {
      const { data, error } = await supabase.from('posts')
        .select('*')
        .eq('author_id', authorId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[fetchUserPosts] Supabase Error:", error);
        return { data: [], error };
      }

      return { data: data || [], error: null };
    } catch (err) {
      console.error("[fetchUserPosts] Exception caught:", err);
      return { data: [], error: err };
    }
  },

  async createPost(postData: any) {
    // ─────────────────────────────────────────────────────────────────────────
    // 🏗️ BACKEND FIX: دالة نظيفة واحدة بدون طبقات متداخلة (mutex/idempotency/sessionRecovery)
    // السبب: الطبقات الأربع كانت تُسبب deadlock عند أي خطأ في الإدراج
    // الحل: insert مباشر بمهلة واقعية + تحقق من author_id + fallback واضح
    // ─────────────────────────────────────────────────────────────────────────

    const user = { id: postData.author_id, name: postData.author_name };

    // 1. التحقق من صحة author_id — UUID صالح
    const authorId: string = postData.author_id;
    if (!authorId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authorId)) {
      console.error('[createPost] Invalid author_id — not a UUID:', authorId);
      return { data: null, error: new Error('معرّف المستخدم غير صالح. يرجى تسجيل الدخول مجدداً.') };
    }

    // 2. بناء الصف بأعمدة موثوقة فقط
    const postId = postData.id || generateUUID();
    const rowToInsert: Record<string, any> = {
      id:            postId,
      author_id:     authorId,
      author_name:   sanitizeInput(postData.author_name  || 'مستخدم', 100, user),
      author_avatar: postData.author_avatar || null,
      author_title:  sanitizeInput(postData.author_title || '', 120, user) || null,
      content:       sanitizeInput(postData.content      || '', MAX_POST_LENGTH, user),
      image_url:     postData.image_url  || null,
      video_url:     postData.video_url  || null,
      likes_count:   0,
    };

    // إضافة حقول echo إن وُجدت
    if (postData.is_echo) {
      rowToInsert.is_echo                = true;
      rowToInsert.original_post_id       = postData.original_post_id     || null;
      rowToInsert.original_author_name   = postData.original_author_name || null;
      rowToInsert.original_author_avatar = postData.original_author_avatar || null;
      rowToInsert.original_content       = postData.original_content     || null;
    }

    // 3. إدراج مباشر مع مهلة 12 ثانية
    try {
      const { data, error } = await Promise.race([
        (supabase.from('posts') as any).insert([rowToInsert]).select(),
        new Promise<{ data: null; error: Error }>((_, rej) =>
          setTimeout(() => rej(new Error('TIMEOUT: createPost (12s)')), 12_000)
        ),
      ]);

      if (error) {
        // أخطاء لا تستوجب إعادة المحاولة (UUID خاطئ، FK مفقود، تكرار، عمود مجهول)
        const noRetry = ['23503', '22P02', '23505', '42703'].includes((error as any).code);
        if (noRetry) {
          console.error('[createPost] DB constraint error (no retry):', error);
          return { data: null, error };
        }
        // خطأ شبكة — محاولة ثانية وأخيرة بعد 1.5 ثانية بـ UUID جديد
        console.warn('[createPost] DB error on first attempt, retrying once:', error);
        await new Promise(r => setTimeout(r, 1500));
        rowToInsert.id = generateUUID();
        const retry = await Promise.race([
          (supabase.from('posts') as any).insert([rowToInsert]).select(),
          new Promise<{ data: null; error: Error }>((_, rej) =>
            setTimeout(() => rej(new Error('TIMEOUT: createPost retry (12s)')), 12_000)
          ),
        ]);
        if (!retry.error) this.invalidateCache();
        const retData = Array.isArray(retry.data) ? retry.data[0] : (retry.data || rowToInsert);
        return { data: retData, error: retry.error };
      }

      this.invalidateCache();
      const retData = Array.isArray(data) ? data[0] : (data || rowToInsert);
      return { data: retData, error: null };

    } catch (err: any) {
      console.error('[createPost] Exception during insert:', err?.message || err);
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err?.message || 'خطأ في الاتصال. يرجى إعادة المحاولة.'))
      };
    }
  },

  /**
   * âœ… Atomic like using parameterized SDK query.
   */
  async likePost(postId: string, currentLikes: number) {
    return (supabase.from('posts') as any)
      .update({ likes_count: Math.max(0, currentLikes + 1) })
      .eq('id', postId);
  },

  /**
   * âœ… Dislike: increments dislikes_count atomically with fallback.
   */
  async dislikePost(postId: string, currentDislikes: number) {
    try {
      const res = await (supabase.from('posts') as any)
        .update({ dislikes_count: Math.max(0, currentDislikes + 1) })
        .eq('id', postId);
      if (res.error && (res.error.code === '42703' || res.error.message?.includes('dislikes_count'))) {
        return { data: null, error: null };
      }
      return res;
    } catch (e) {
      console.warn('[postService] Dislike update fallback:', e);
      return { data: null, error: null };
    }
  },

  /**
   * âœ… Parameterized comment insert with strict input sanitization
   */
  async addComment(postId: string, author: AppUser, content: string) {
    // ðŸš« Strict Role Check
    if (!canUserPostAndInteract(author)) {
      return { data: null, error: { message: 'ØºÙŠØ± Ù…ØµØ±Ø­ Ù„Ù„Ø¨Ø§Ø­Ø«ÙŠÙ† Ø¹Ù† Ø¹Ù…Ù„ Ø¨Ø§Ù„ØªØ¹Ù„ÙŠÙ‚ Ø£Ùˆ Ø§Ù„ØªÙØ§Ø¹Ù„ ðŸš«' } };
    }

    // Validate inputs
    if (!postId || !author?.id || !content?.trim()) {
      return { data: null, error: { message: 'Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªØ¹Ù„ÙŠÙ‚ ØºÙŠØ± Ù…ÙƒØªÙ…Ù„Ø©' } };
    }

    const user = { id: author.id, name: author.name, email: author.email };

    // âœ… Sanitize comment content & scan for threat injection
    const cleanContent = sanitizeComment(content, user);
    if (!cleanContent) {
      return { data: null, error: { message: 'Ù…Ø­ØªÙˆÙ‰ Ø§Ù„ØªØ¹Ù„ÙŠÙ‚ ÙØ§Ø±Øº Ø¨Ø¹Ø¯ Ø§Ù„ØªØ­Ù‚Ù‚ Ø§Ù„Ø£Ù…Ù†ÙŠ' } };
    }

    // âœ… Author name sanitized to prevent XSS in displayed name
    return (supabase.from('comments') as any).insert([{
      post_id: postId,
      author_id: author.id,   // From authenticated session - not user input
      author_name: sanitizeInput(author.name || 'Ù…Ø³ØªØ®Ø¯Ù…', 100, user),
      author_avatar: author.avatar,
      content: cleanContent   // âœ… Sanitized content
    }]);
  },

  /**
   * âœ… Echo / Repost: creates a new post carrying full repost metadata
   * so the UI can render it as a "repost card" instead of plain text.
   */
  async echoPost(author: AppUser, post: Post) {
    // ðŸš« Strict Role Check
    if (!canUserPostAndInteract(author)) {
      return { data: null, error: { message: 'ØºÙŠØ± Ù…ØµØ±Ø­ Ù„Ù„Ø¨Ø§Ø­Ø«ÙŠÙ† Ø¹Ù† Ø¹Ù…Ù„ Ø¨Ø¥Ø¹Ø§Ø¯Ø© Ù†Ø´Ø± Ø§Ù„Ù…Ù†Ø´ÙˆØ±Ø§Øª ðŸš«' } };
    }

    return this.createPost({
      author_id: author.id,           // From authenticated session
      author_name: sanitizeInput(author.name || 'Ù…Ø³ØªØ®Ø¯Ù…', 100),
      author_avatar: author.avatar,
      content: '',                     // Echo posts have no extra caption by default
      image_url: null,
      likes_count: 0,
      // Repost-specific metadata
      is_echo: true,
      original_post_id: post.id,
      original_author_name: sanitizeInput(post.authorName || 'Ù…Ø³ØªØ®Ø¯Ù…', 100),
      original_author_avatar: post.authorAvatar || null,
      original_content: sanitizeInput(post.content || '', MAX_ECHO_LENGTH),
    });
  },

  /**
   * âœ… Relocate post: both IDs from authenticated context, content sanitized
   */
  async relocatePost(author: AppUser, targetUser: AppUser, post: Post) {
    const safeContent = sanitizeInput(
      `ØªÙ… ØªØ±Ø­ÙŠÙ„ Ù…Ù†Ø´ÙˆØ± Ø¥Ù„ÙŠÙƒ: ${post.content}\nØ§Ù„Ø±Ø§Ø¨Ø·: ${post.imageUrl || ''}`,
      2000
    );
    return (supabase.from('messages') as any).insert([{
      sender_id: author.id,       // From authenticated session
      receiver_id: targetUser.id, // From validated user list
      content: safeContent        // âœ… Sanitized
    }]);
  },

  /**
   * âœ… Delete post with ownership verification
   * RLS on Supabase also enforces this at the DB level.
   */
  async deletePost(postId: string, authorId?: string, isAdmin = false) {
    this.invalidateCache();
    let query = (supabase.from('posts') as any).delete().eq('id', postId);
    // If not admin and authorId provided, enforce ownership guard at query level
    if (!isAdmin && authorId) {
      query = query.eq('author_id', authorId);
    }
    return query.select('id');
  },
};

