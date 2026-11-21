import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  Repeat2, 
  Image as ImageIcon,
  PlayCircle,
  Trash2,
  Edit2,
  AlertTriangle,
  Loader2,
  FileText
} from 'lucide-react';
import { Post } from '../../types';
import { safeTimeAgo } from '../../lib/utils/formatDate';
import { useAppContext } from '../../contexts/AppContext';
import { DEFAULT_NEWS_PLACEHOLDER, handleImageError } from '../../lib/utils/placeholders';
import { supabase } from '../../lib/supabase';

interface PostNewsCardProps {
  post: Post;
  delay?: number;
  onClick: (post: any) => void;
  onAuthorClick?: (e: React.MouseEvent) => void;
  allUsers: any[];
  onDeletePost?: (id: string) => Promise<boolean> | void;
  onEditPost?: (post: Post) => void;
}

export function PostNewsCard({ post, delay = 0, onClick, onAuthorClick, allUsers, onDeletePost, onEditPost }: PostNewsCardProps) {
  const { appUser, addToast, setPosts } = useAppContext();
  const author = allUsers.find(u => u.id === post.authorId);
  const displayImage = post.imageUrl || author?.coverUrl || author?.avatar || DEFAULT_NEWS_PLACEHOLDER;
  const hasVideo = !!post.videoUrl;
  // 📸 المنشور الذي يحتوي على صورة هو منشور صورة (وليس مقال)، والمقال فقط إذا كان محدداً صراحة كمقال أو يبدأ بـ # وليس له صورة منشورة
  const isExplicitArticle = (post as any).post_type === 'article' || (post as any).type === 'article';
  const isArticle = isExplicitArticle || (!post.imageUrl && post.content.startsWith('# '));
  // 📸 منشور صورة اجتماعي عادي (كامل الصورة والنص أسفلها وليس كشريط وظيفة أو مقال)
  const isImagePost = !isArticle && !!post.imageUrl;
  
  let articleTitle = (post as any).article_title || '';
  let articleExcerpt = '';
  if (isArticle) {
    const lines = post.content.split('\n').filter(l => l.trim().length > 0);
    const firstLine = lines[0] || '';
    if (firstLine.startsWith('# ')) {
      articleTitle = firstLine.replace(/^#+\s*/, '').trim();
      articleExcerpt = lines.slice(1).join(' ').trim();
    } else if (!articleTitle) {
      articleTitle = firstLine.length < 90 ? firstLine : firstLine.slice(0, 90) + '...';
      articleExcerpt = lines.length > 1 ? lines.slice(1).join(' ').trim() : post.content;
    } else {
      articleExcerpt = post.content;
    }
  }

  const isOwner = !!(
    appUser?.id && (
      (post.authorId && appUser.id === post.authorId) ||
      ((post as any).author_id && appUser.id === (post as any).author_id) ||
      (post.authorId && appUser.id.toLowerCase() === post.authorId.toLowerCase()) ||
      ((post as any).author_id && appUser.id.toLowerCase() === (post as any).author_id.toLowerCase())
    )
  );
  const isAdmin = !!((appUser as any)?.isAdmin || (appUser as any)?.role === 'admin' || (appUser as any)?.role === 'superadmin' || (appUser as any)?.is_admin || (appUser as any)?.hasSupportAccess);
  const canManage = isOwner || isAdmin;

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editContent.trim()) {
      addToast('يرجى كتابة محتوى للمنشور', 'error');
      return;
    }
    setIsSaving(true);
    try {
      let query = (supabase as any).from('posts').update({ content: editContent.trim() }).eq('id', post.id);
      if (!isAdmin && appUser?.id) query = query.eq('author_id', appUser.id);
      await query;
    } catch (err) {
      console.warn('Backend edit note:', err);
    } finally {
      post.content = editContent.trim();
      setIsSaving(false);
      setIsEditing(false);
      addToast('✨ تم تعديل وحفظ المنشور بنجاح', 'success');
      if (onEditPost) {
        onEditPost({ ...post, content: editContent.trim() });
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      if (onDeletePost) {
        const ok = await onDeletePost(post.id);
        if (ok !== false) {
          setDeleted(true);
          setShowDeleteConfirm(false);
        }
      } else {
        let query = supabase.from('posts').delete().eq('id', post.id);
        if (!isAdmin && appUser?.id) query = (query as any).eq('author_id', appUser.id);
        const { data: deletedRows, error } = await (query as any).select('id');
        if (error) {
          console.error('[handleDelete] Supabase error:', error);
          throw new Error(error.message || 'فشل حذف المنشور من قاعدة البيانات');
        }
        if (!deletedRows || deletedRows.length === 0) {
          throw new Error('لا تملك صلاحية حذف هذا المنشور أو لم يعد موجوداً');
        }
        try {
          const del: string[] = JSON.parse(localStorage.getItem('prolink_deleted_posts') || '[]');
          if (!del.includes(post.id)) { del.push(post.id); localStorage.setItem('prolink_deleted_posts', JSON.stringify(del.slice(-300))); }
          const cached = JSON.parse(localStorage.getItem('prolink_cached_posts') || '[]');
          localStorage.setItem('prolink_cached_posts', JSON.stringify(cached.filter((p: any) => p.id !== post.id)));
        } catch {}
        setPosts(prev => prev.filter(p => p.id !== post.id));
        setDeleted(true);
        setShowDeleteConfirm(false);
        addToast('🗑️ تم حذف المنشور نهائياً من قاعدة البيانات بنجاح', 'success');
      }
    } catch (err: any) {
      console.error('[handleDelete] Failed:', err);
      addToast('فشل حذف المنشور: ' + (err?.message || 'خطأ في قاعدة البيانات'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Animate out if deleted
  if (deleted) {
    return (
      <motion.div
        initial={{ opacity: 1, scale: 1, height: 'auto' }}
        animate={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
        className="overflow-hidden"
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="group relative overflow-hidden rounded-[2rem]"
    >
      {/* ── Global Centered Delete Confirmation Modal (Rendered via Portal) ── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showDeleteConfirm && (
            <div
              className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
              dir="rtl"
              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 15 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white dark:bg-slate-900 border border-red-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-center relative overflow-hidden"
              >
                {/* Glowing red accent line */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500" />

                {/* Warning Icon Badge */}
                <div className="w-16 h-16 mx-auto rounded-3xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 flex items-center justify-center text-red-600 dark:text-red-400 shadow-xl shadow-red-500/10">
                  <Trash2 size={28} />
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1.5">
                    تأكيد حذف المنشور نهائياً
                  </h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed px-2">
                    سيتم حذف هذا المنشور بالكامل من قاعدة البيانات فوراً ولن تتمكن من استرجاعه لاحقاً. هل أنت متأكد من الحذف؟
                  </p>
                </div>

                {/* Post Snippet Preview */}
                {(post.content || articleTitle) && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/60 text-right max-h-24 overflow-y-auto">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-2 leading-relaxed">
                      "{articleTitle || post.content}"
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    إلغاء الأمر
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDelete}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-black shadow-lg shadow-red-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>جاري الحذف...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} />
                        <span>نعم، حذف نهائي</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Main Foreground Card ── */}
      <motion.div
        onClick={isEditing || showDeleteConfirm ? undefined : () => onClick(post)}
        whileHover={isEditing || showDeleteConfirm ? {} : { y: -4, scale: 1.003 }}
        animate={showDeleteConfirm ? { scale: 0.985 } : { scale: 1 }}
        className={`relative z-10 flex ${
          isImagePost ? 'flex-col' : 'flex-col md:flex-row'
        } items-stretch gap-4 p-4 md:p-5 bg-white dark:bg-[#0f172a] rounded-[2rem] border ${
          isArticle 
            ? 'border-purple-200/80 dark:border-purple-900/40 hover:border-purple-500/70 shadow-[0_4px_20px_rgba(147,51,234,0.06)]' 
            : 'border-slate-100 dark:border-slate-800 hover:border-blue-500/50'
        } shadow-sm hover:shadow-xl transition-all overflow-hidden cursor-pointer diwani-neon-card`}
      >
        {/* Visual Indicator (Gradient Bar) */}
        <div className={`absolute top-0 right-0 bottom-0 w-1.5 ${
          isArticle 
            ? 'bg-gradient-to-b from-purple-600 via-indigo-600 to-blue-600' 
            : 'bg-gradient-to-b from-blue-600 to-indigo-600'
        } opacity-0 group-hover:opacity-100 transition-opacity rounded-r-[2rem]`} />

        {/* 📸 إذا كان منشور صورة عادي: رأس الكاتب أولاً، ثم كامل الصورة، ثم النص أسفلها */}
        {isImagePost ? (
          <>
            {/* 1. رأس الكاتب */}
            <div className="flex items-center gap-2 flex-wrap">
              <div 
                className="flex items-center gap-2 pr-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); onAuthorClick?.(e); }}
              >
                <img 
                  src={post.authorAvatar} 
                  className="w-7 h-7 rounded-full border border-white dark:border-slate-700 shadow-sm object-cover" 
                  alt={post.authorName} 
                />
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-slate-100 block leading-tight">{post.authorName}</span>
                  {post.authorTitle && <span className="text-[9px] text-slate-400 font-bold block">{post.authorTitle}</span>}
                </div>
              </div>
              <span className="text-slate-300 dark:text-slate-700 text-[10px]">•</span>
              <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-slate-500">
                <Clock size={10} /> {safeTimeAgo(post.timestamp || (post as any).created_at)}
              </span>
              <span className="text-[8px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/30">
                منشور مهني 📸
              </span>

              {/* أزرار التعديل والحذف للمالك */}
              {canManage && !isEditing && (
                <div className="flex items-center gap-1.5 mr-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onEditPost) onEditPost(post);
                      else setIsEditing(true);
                    }}
                    className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-xs active:scale-95 border border-blue-200/60 dark:border-blue-800/50 cursor-pointer"
                    title="تعديل المنشور"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(true);
                    }}
                    className="p-1.5 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-xs active:scale-95 border border-red-200/60 dark:border-red-800/50 cursor-pointer"
                    title="حذف المنشور"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* 2. كامل الصورة دون قص (Full image presentation) */}
            <div className="relative w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm pointer-events-none">
              <img 
                src={displayImage} 
                onError={handleImageError}
                className="w-full h-auto max-h-[500px] object-contain group-hover:scale-[1.01] transition-transform duration-500" 
                alt="Post content" 
              />
            </div>

            {/* 3. النص الكامل أسفل الصورة مباشرة */}
            {isEditing ? (
              <div className="flex flex-col gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white"
                  rows={3}
                  autoFocus
                  dir="auto"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsEditing(false); setEditContent(post.content); }}
                    className="px-3 py-1.5 text-[10px] font-black rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editContent.trim()}
                    className="px-3 py-1.5 text-[10px] font-black rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isSaving ? '...' : 'حفظ'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {post.content && (
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-line break-words px-1">
                    {post.content}
                  </p>
                )}
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <span className="text-[9px] font-black text-blue-500/60 uppercase tracking-tighter group-hover:text-blue-600 transition-colors">
                    عرض التفاصيل والتفاعل
                  </span>
                  <div className="w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-600 transition-all group-hover:text-white">
                     <Repeat2 size={12} className="group-hover:rotate-180 transition-transform duration-500" />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Media Preview (Wide Strip for Articles / Standard Thumbnail for Posts) */}
            <div className={`relative shrink-0 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-inner pointer-events-none ${
              isArticle ? 'w-full md:w-56 h-44 md:h-36' : 'w-full md:w-36 h-48 md:h-28'
            }`}>
              <img 
                src={displayImage} 
                onError={handleImageError}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100" 
                alt=""
              />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
              
              {hasVideo && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white border border-white/30 shadow-lg">
                    <PlayCircle size={20} fill="currentColor" className="text-white/80" />
                  </div>
                </div>
              )}

              {isArticle && (
                <>
                  <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-purple-600/95 backdrop-blur-md text-white text-[9px] font-black shadow-md flex items-center gap-1">
                    <FileText size={10} />
                    <span>مقال مهني 📰</span>
                  </div>
                  <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-[9px] font-bold flex items-center gap-1">
                    <Clock size={10} />
                    <span>قراءة {Math.max(1, Math.round(post.content.length / 300))} د</span>
                  </div>
                </>
              )}

              {!hasVideo && !isArticle && (
                 <div className="absolute bottom-2 left-2 p-1.5 bg-black/40 backdrop-blur-sm rounded-lg text-white">
                    <ImageIcon size={12} />
                 </div>
              )}
            </div>

            {/* Content Section */}
            <div className="flex-1 min-w-0 flex flex-col py-1">
              {/* Header Row: Author info only */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div 
                  className="flex items-center gap-2 pr-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); onAuthorClick?.(e); }}
                >
                  <img 
                    src={post.authorAvatar} 
                    className="w-5 h-5 rounded-full border border-white dark:border-slate-700 shadow-sm" 
                    alt={post.authorName} 
                  />
                  <span className="text-[10px] font-black text-slate-900 dark:text-slate-100">{post.authorName}</span>
                </div>
                <span className="text-slate-300 dark:text-slate-700 text-[10px]">•</span>
                <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-slate-500">
                  <Clock size={10} /> {safeTimeAgo(post.timestamp || (post as any).created_at)}
                </span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest ${
                  isArticle 
                    ? 'bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-800/40' 
                    : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/30'
                }`}>
                  {isArticle ? 'مقال مهني ✍️' : 'منشور مهني'}
                </span>

                {/* ── Edit / Delete Controls (Same pattern as JobCard, no swipe) ── */}
                {canManage && !isEditing && (
                  <div className="flex items-center gap-1.5 mr-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEditPost) {
                          onEditPost(post);
                        } else {
                          setIsEditing(true);
                        }
                      }}
                      className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-xs active:scale-95 border border-blue-200/60 dark:border-blue-800/50 cursor-pointer"
                      title="تعديل المقال / المنشور"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(true);
                      }}
                      className="p-1.5 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-xs active:scale-95 border border-red-200/60 dark:border-red-800/50 cursor-pointer"
                      title="حذف المقال / المنشور"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Edit mode */}
              {isEditing ? (
                <div className="flex flex-col gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white"
                    rows={3}
                    autoFocus
                    dir="auto"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsEditing(false); setEditContent(post.content); }}
                      className="px-3 py-1.5 text-[10px] font-black rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={isSaving || !editContent.trim()}
                      className="px-3 py-1.5 text-[10px] font-black rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {isSaving ? '...' : 'حفظ'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {isArticle ? (
                    <>
                      <h3 className="font-black text-base md:text-lg text-slate-900 dark:text-white leading-snug line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors break-words">
                        {articleTitle}
                      </h3>
                      
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2 leading-relaxed font-normal">
                        {articleExcerpt}
                      </p>

                      <div className="flex items-center justify-between gap-1.5 mt-auto pt-3">
                        <span className="text-[10px] text-slate-400 font-bold truncate">
                          بواسطة: {post.authorTitle || post.authorName}
                        </span>
                        <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-tight group-hover:translate-x-[-4px] transition-transform flex items-center gap-1">
                          قراءة المقال بالكامل ←
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h4 className="font-black text-sm text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors break-words">
                        {post.content.split('\n')[0] || 'منشور جديد من ' + post.authorName}
                      </h4>
                      
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-1 italic font-medium">
                        {post.content.split('\n').slice(1).join(' ').trim() || post.authorTitle}
                      </p>

                      {/* Clean Sleek Footer: Only View Details Indicator */}
                      <div className="flex items-center justify-end gap-1.5 mt-auto pt-3">
                        <span className="text-[9px] font-black text-blue-500/60 uppercase tracking-tighter group-hover:text-blue-600 transition-colors">
                          عرض التفاصيل
                        </span>
                        <div className="w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-600 transition-all group-hover:text-white">
                           <Repeat2 size={12} className="group-hover:rotate-180 transition-transform duration-500" />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
