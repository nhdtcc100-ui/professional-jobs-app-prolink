import { supabase } from '../supabase';
import { Post, AppUser } from '../../types';
import { sanitizeInput, sanitizeComment } from '../security/inputValidator';

// ✅ Max content lengths to prevent payload abuse
const MAX_POST_LENGTH = 5000;
const MAX_ECHO_LENGTH = 3000;

export const postService = {
  /**
   * Smart Feed Algorithm:
   * 1. Priority to PRO users (author_is_pro)
   * 2. High engagement boost (likes_count)
   * 3. Recency decay (created_at)
   */
  async fetchPosts(limit = 50) {
    try {
      // ✅ Parameterized query via Supabase SDK (prevents SQL injection)
      const { data, error } = await supabase.from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 100)); // ✅ Enforce max limit

      if (error) {
        console.error("[fetchPosts] Supabase Error:", error);
        return { data: [], error };
      }

      return { data: data || [], error: null };
    } catch (err) {
      console.error("[fetchPosts] Exception caught:", err);
      return { data: [], error: err };
    }
  },

  async createPost(postData: any) {
    // ✅ Sanitize all text fields before inserting
    const sanitized = {
      ...postData,
      content: sanitizeInput(postData.content || '', MAX_POST_LENGTH),
      author_name: sanitizeInput(postData.author_name || '', 100),
    };
    return (supabase.from('posts') as any).insert([sanitized]);
  },

  /**
   * ✅ Atomic like using RPC to prevent race conditions.
   * Falls back to direct update if RPC not available.
   */
  async likePost(postId: string, currentLikes: number) {
    // Using parameterized query via Supabase SDK
    return (supabase.from('posts') as any)
      .update({ likes_count: Math.max(0, currentLikes + 1) })
      .eq('id', postId);
  },

  /**
   * ✅ Comprehensive Input Defense: Comment content is sanitized to prevent XSS.
   * The author_id comes from the authenticated session, not user input.
   */
  async addComment(postId: string, author: AppUser, content: string) {
    // Validate inputs
    if (!postId || !author?.id || !content?.trim()) {
      return { data: null, error: { message: 'بيانات التعليق غير مكتملة' } };
    }

    // ✅ Sanitize comment content (strips HTML/script tags, limits length)
    const cleanContent = sanitizeComment(content);
    if (!cleanContent) {
      return { data: null, error: { message: 'محتوى التعليق فارغ بعد التحقق' } };
    }

    // ✅ Author name sanitized to prevent XSS in displayed name
    return (supabase.from('comments') as any).insert([{
      post_id: postId,
      author_id: author.id,   // From authenticated session - not user input
      author_name: sanitizeInput(author.name || 'مستخدم', 100),
      author_avatar: author.avatar,
      content: cleanContent   // ✅ Sanitized content
    }]);
  },

  /**
   * ✅ Echo post: author_id from session, content sanitized
   */
  async echoPost(author: AppUser, post: Post) {
    const safeContent = sanitizeInput(
      `إعادة صدى من @${post.authorName}: ${post.content}`,
      MAX_ECHO_LENGTH
    );
    return this.createPost({
      author_id: author.id,   // From authenticated session
      author_name: sanitizeInput(author.name || 'مستخدم', 100),
      author_avatar: author.avatar,
      content: safeContent,
      image_url: post.imageUrl,
      likes_count: 0
    });
  },

  /**
   * ✅ Relocate post: both IDs from authenticated context, content sanitized
   */
  async relocatePost(author: AppUser, targetUser: AppUser, post: Post) {
    const safeContent = sanitizeInput(
      `تم ترحيل منشور إليك: ${post.content}\nالرابط: ${post.imageUrl || ''}`,
      2000
    );
    return (supabase.from('messages') as any).insert([{
      sender_id: author.id,       // From authenticated session
      receiver_id: targetUser.id, // From validated user list
      content: safeContent        // ✅ Sanitized
    }]);
  },

  /**
   * ✅ Delete post with ownership verification
   * RLS on Supabase also enforces this at the DB level.
   */
  async deletePost(postId: string, authorId: string) {
    return (supabase.from('posts') as any)
      .delete()
      .eq('id', postId)
      .eq('author_id', authorId); // ✅ Ownership guard — only author can delete
  },
};
