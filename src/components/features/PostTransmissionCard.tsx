import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, 
  Repeat2, 
  Share, 
  Send, 
  Edit2, 
  Trash2, 
  Flag, 
  MoreHorizontal 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Post, AppConnection, AppUser } from '../../types';
import { sanitizeInput } from '../../lib/security/inputValidator';
import { useAppContext } from '../../contexts/AppContext';
import { BilingualSmartText } from '../../lib/utils/bilingualText';
import { canUserPostAndInteract } from '../../lib/utils/roleUtils';
import { CalligraphyBg } from '../ui/CalligraphyBg';

// Helper component to format text with clickable links and phone numbers
const FormattedText = ({ text, className }: { text: string, className?: string }) => {
  if (!text) return null;
  // Matches URLs and Phone numbers (min 8 digits, optional +, spaces, dashes)
  const combinedRegex = /(https?:\/\/[^\s]+|\+?[\d\s-]{8,20}\d)/g;
  const parts = text.split(combinedRegex);
  
  return (
    <p className={className} dir="auto">
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.match(/https?:\/\/[^\s]+/)) {
          return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 hover:underline font-bold" onClick={e => e.stopPropagation()}>{part}</a>;
        }
        if (part.match(/\+?[\d\s-]{8,20}\d/) && part.replace(/[\D]/g, '').length >= 8) {
          return <a key={i} href={`tel:${part.replace(/[\s-]/g, '')}`} className="text-emerald-600 hover:text-emerald-800 hover:underline font-black inline-block" dir="ltr" onClick={e => e.stopPropagation()}>{part}</a>;
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
};


interface PostTransmissionCardProps {
  post: Post;
  delay: number;
  user: any;
  onUserClick?: () => void;
  handleRelocatePost: (p: Post) => void;
  setRelocatingPost: (p: Post) => void;
  addToast: (m: string, t?: any) => void;
  onLike: (id: string) => void;
  onDislike?: (id: string) => void;
  onAddComment: (id: string, c: string) => void;
  onDeletePost?: (id: string) => void;
  onShareToGroup?: (p: Post) => void;
  key?: React.Key;
}

export function PostTransmissionCard({ 
  post, 
  delay, 
  user, 
  onUserClick, 
  handleRelocatePost, 
  setRelocatingPost, 
  addToast, 
  onLike, 
  onDislike,
  onAddComment, 
  onDeletePost,
  onShareToGroup 
}: PostTransmissionCardProps) {
  const { likedPosts, dislikedPosts, appUser } = useAppContext();
  const isLiked = likedPosts?.has(post.id) || false;
  const isDisliked = dislikedPosts?.has(post.id) || false;
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    
    if (data) setComments(data);
  };

  useEffect(() => {
    fetchComments();

    const channel = supabase.channel(`comments-${post.id}-${Date.now()}`);
    
    channel
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` }, 
        () => {
          console.log(`DEBUG: New comment for post ${post.id}`);
          fetchComments();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`DEBUG: Subscribed to comments for post ${post.id}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id]);

  const handleReportPost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('هل تريد الإبلاغ عن هذا التوجيه كفعل مسيء؟')) {
      try {
        const { error } = await (supabase as any).from('reports').insert([{
          post_id: post.id,
          reporter_id: user?.id,
          author_id: post.authorId,
          content: post.content,
          status: 'pending'
        }]);
        if (error) throw error;
        addToast('تم ترحيل إبلاغك إلى الدعم الفني بنجاح.', 'success');
      } catch (err: any) {
        console.error(err);
        addToast('فشل إرسال البلاغ: ' + err.message, 'error');
      }
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike(post.id);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;
    // 🔒 Sanitize comment text before submitting
    const commentText = sanitizeInput(newComment.trim());
    if (!commentText) return;
    const tempId = Date.now().toString();
    
    // 1. Optimistic Update
    const optimisticComment = {
      id: tempId,
      post_id: post.id,
      author_id: user.id,
      author_name: user.user_metadata?.full_name || 'مستخدم',
      author_avatar: user.user_metadata?.avatar_url || 'https://ui-avatars.com/api/?background=random',
      content: commentText,
      created_at: new Date().toISOString()
    };
    setComments(prev => [...prev, optimisticComment]);
    setNewComment('');

    setIsCommenting(true);
    try {
      await onAddComment(post.id, commentText);
      await fetchComments();
    } catch (err) {
      console.error("Comment failed", err);
      setComments(prev => prev.filter(c => c.id !== tempId));
      setNewComment(commentText);
    }
    setIsCommenting(false);
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleUpdatePost = async () => {
    if (!editContent.trim() || editContent === post.content) { setIsEditing(false); return; }
    // 🔒 Ownership OR admin check
    const isOwnerEdit = user && post.authorId === user.id;
    const isAdminEdit = !!(appUser as any)?.isAdmin;
    if (!user || (!isOwnerEdit && !isAdminEdit)) {
      addToast('غير مسموح — يمكنك تعديل توجيهاتك فقط', 'error');
      setIsEditing(false);
      return;
    }
    // 🔒 Sanitize content before saving
    const sanitizedContent = sanitizeInput(editContent.trim());
    if (!sanitizedContent) { setIsEditing(false); return; }
    setIsSaving(true);
    try {
      // Admin can edit any post; owner uses author_id guard
      let query = (supabase as any).from('posts').update({ content: sanitizedContent }).eq('id', post.id);
      if (!isAdminEdit) {
        query = query.eq('author_id', user.id);
      }
      const { error } = await query;
      if (error) throw error;
      post.content = sanitizedContent; // Optimistic sync
      addToast('تم تحديث المنشور بنجاح ✅');
    } catch (e) {
      addToast('فشل تحديث المنشور', 'error');
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const handleDeletePost = async () => {
    const isOwner = user && post.authorId === user.id;
    const isAdmin = !!(appUser as any)?.isAdmin;

    // 🔒 Ownership / Admin check
    if (!user || (!isOwner && !isAdmin)) {
      addToast('غير مسموح — يمكنك حذف منشوراتك الخاصة فقط', 'error');
      setShowDeleteConfirm(false);
      return;
    }
    // Optimistic UI removal
    if (onDeletePost) onDeletePost(post.id);
    
    try {
      let query = supabase.from('posts').delete().eq('id', post.id);
      if (!isAdmin) {
        query = query.eq('author_id', user.id);
      }
      const { error } = await query;
      if (error) throw error;
      addToast('تم حذف المنشور بنجاح ✅');
    } catch (e) {
      addToast('فشل حذف المنشور', 'error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2.5rem] overflow-hidden group mb-6 transition-all duration-500 hover:shadow-[0_40px_80px_rgba(10,102,194,0.12)] hover:-translate-y-1.5"
    >
      {/* خلفية خط ديواني */}
      <CalligraphyBg word="نشر" size="6rem" opacity={0.05} position="bottom-right" />
      {/* 🔁 Echo / Repost banner */}
      {(post as any).isEcho && (
        <div className="flex items-center gap-2 px-6 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Repeat2 size={14} className="text-blue-500 shrink-0" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {post.authorName} أعاد نشر
          </span>
        </div>
      )}
      <div className="p-5 flex justify-between items-start">
        <div className="flex gap-4 cursor-pointer group/avatar" onClick={onUserClick}>
          <div className="relative">
            <div className="absolute inset-0 bg-blue-600 rounded-2xl blur-lg opacity-0 group-hover/avatar:opacity-20 transition-opacity" />
            <img
              src={post.authorAvatar}
              className="relative w-12 h-12 rounded-2xl border-2 border-white dark:border-slate-700 shadow-[0_8px_20px_rgba(0,0,0,0.1)] group-hover/avatar:shadow-[0_15px_30px_rgba(10,102,194,0.3)] group-hover/avatar:scale-110 group-hover/avatar:rotate-3 transition-all duration-500 object-cover"
              alt="Author"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-sm" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white group-hover/avatar:text-blue-600 transition-colors tracking-tight">{post.authorName}</h4>
            <p className="text-[10px] text-slate-400 font-bold leading-none mt-1">{post.authorTitle}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
               <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                 {(post as any).post_type === 'article' || post.content.startsWith('# ') ? 'مقال مهني 📰' : 'Signal Active'}
               </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(post.authorId === user?.id || !!(appUser as any)?.isAdmin) ? (
            <div className="flex gap-2 bg-slate-100/80 dark:bg-slate-900/80 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); setShowDeleteConfirm(false); }}
                className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 ${isEditing ? 'bg-blue-600 text-white shadow-[0_10px_20px_rgba(10,102,194,0.3)]' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 shadow-sm'}`}
                title="تعديل المنشور"
              >
                <Edit2 size={19} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(!showDeleteConfirm); setIsEditing(false); }}
                className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 ${showDeleteConfirm ? 'bg-red-600 text-white shadow-[0_10px_200px_rgba(239,68,68,0.3)]' : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 shadow-sm'}`}
                title="حذف المنشور"
              >
                <Trash2 size={19} />
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <button
                onClick={handleReportPost}
                className="p-2.5 text-slate-900 dark:text-slate-400 hover:text-amber-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all duration-300 active:scale-90"
                title="إبلاغ"
              >
                <Flag size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-5 pb-5 overflow-hidden">
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-5 rounded-3xl text-center shadow-inner">
              <p className="text-xs font-black text-red-600 dark:text-red-400 mb-4">هل أنت متأكد من رغبتك في سحب هذا التوجيه نهائياً؟</p>
              <div className="flex gap-3">
                <button onClick={handleDeletePost} className="flex-1 py-3 bg-red-600 text-white text-[10px] font-black rounded-2xl shadow-[0_10px_20px_rgba(220,38,38,0.3)] hover:bg-red-700 transition-all active:scale-95">نعم، سحب التوجيه</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-white dark:bg-slate-800 text-slate-500 text-[10px] font-black rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 transition-all">إلغاء</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-6 py-2">
        {isEditing ? (
          <div className="space-y-4">
            <textarea
              className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-blue-100 dark:border-slate-800 rounded-[1.5rem] p-5 text-sm text-slate-700 dark:text-white outline-none focus:border-blue-400 focus:ring-8 focus:ring-blue-50/50 dark:focus:ring-blue-900/20 transition-all resize-none leading-relaxed shadow-inner"
              rows={4}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsEditing(false)} className="px-6 py-2 text-xs font-black text-slate-400 hover:text-slate-600 transition-colors">إلغاء</button>
              <button
                onClick={handleUpdatePost}
                disabled={isSaving}
                className="px-10 py-3 bg-blue-600 text-white text-xs font-black rounded-2xl shadow-[0_10px_20px_rgba(10,102,194,0.3)] hover:bg-blue-700 hover:shadow-[0_15px_30px_rgba(10,102,194,0.4)] active:scale-95 transition-all disabled:opacity-50"
              >
                {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Echo: show original post as a quoted card */}
            {(post as any).isEcho && (post as any).originalContent && (
              <div className="mx-1 mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-[1.5rem]">
                <div className="flex items-center gap-2 mb-2">
                  <img
                    src={(post as any).originalAuthorAvatar || `https://ui-avatars.com/api/?name=${(post as any).originalAuthorName}&background=random`}
                    className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-600"
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">{(post as any).originalAuthorName}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-5 whitespace-pre-wrap">{(post as any).originalContent}</p>
              </div>
            )}
            {/* Regular post text — with Bilingual support */}
            {(!((post as any).isEcho) || post.content) && (
              <div className="px-1">
                <BilingualSmartText text={post.content || ''} className="space-y-2 text-sm md:text-base leading-relaxed" />
              </div>
            )}
          </>
        )}
        
        {post.imageUrl && (
          <div className="mt-5 rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shadow-[0_20px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] group/img relative">
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none z-10" />
            <img 
              src={post.imageUrl} 
              className="w-full h-auto max-h-[700px] object-contain group-hover/img:scale-[1.03] transition-transform duration-700" 
              alt="Post content" 
            />
          </div>
        )}
        
        {post.videoUrl && (
          <div className="mt-5 rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 bg-black shadow-[0_20px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.6)] group/vid aspect-video flex items-center justify-center relative">
            {post.videoUrl.includes('youtube.com') || post.videoUrl.includes('youtu.be') ? (
              <iframe
                src={`https://www.youtube.com/embed/${post.videoUrl.split('v=')[1] || post.videoUrl.split('/').pop()}`}
                className="w-full h-full relative z-10"
                allowFullScreen
              />
            ) : (
              <video 
                src={post.videoUrl} 
                controls 
                className="w-full h-full relative z-10" 
                preload="metadata"
              />
            )}
            <div className="absolute inset-0 bg-blue-600/10 blur-3xl opacity-0 group-hover/vid:opacity-30 transition-opacity" />
          </div>
        )}
      </div>

      <div className="px-6 py-4 flex items-center justify-between border-t border-slate-50 dark:border-slate-800/50 mt-4 bg-slate-50/30 dark:bg-slate-900/20">
        <div className="text-[11px] font-black text-slate-900 dark:text-slate-400 cursor-pointer hover:text-blue-600 hover:underline transition-all" onClick={() => setShowComments(!showComments)}>
          {comments.length || 0} ردود مهنية
        </div>
      </div>

      <div className="flex justify-around items-center px-4 py-3 bg-white dark:bg-[#0f172a] border-t border-slate-100 dark:border-slate-800">
        <TransmissionAction icon={<MessageCircle size={20} />} label="رد" onClick={() => setShowComments(!showComments)} />
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-50 bg-slate-50/50 p-4"
          >
            {canUserPostAndInteract(appUser) ? (
              <div className="flex gap-3 mb-4">
                <img src={user?.user_metadata?.avatar_url || 'https://ui-avatars.com/api/?name=User&background=random'} className="w-8 h-8 rounded-full border border-slate-100" referrerPolicy="no-referrer" />
                <div className="flex-1 flex gap-2">
                  <input
                    className="flex-1 bg-white border border-slate-200 rounded-full px-4 py-1.5 text-xs outline-none focus:border-blue-200"
                    placeholder="اكتب رداً..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  />
                  <button 
                    onClick={handleAddComment} 
                    disabled={isCommenting || !newComment.trim()} 
                    className={`p-2.5 rounded-xl transition-all ${newComment.trim() ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300'}`}
                  >
                    <Send size={18} className={newComment.trim() ? "" : "opacity-50"} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white/70 dark:bg-slate-900/70 rounded-2xl border border-slate-200/50 dark:border-slate-800 text-center mb-4">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  🔒 التعليق والتفاعل مخصص لأصحاب العمل والمؤسسات فقط.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {comments.map(c => {
                const isAuthor = !!user?.id && !!c.author_id && user.id === c.author_id;
                return (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    isAuthor={isAuthor}
                    addToast={addToast}
                    onDelete={(id) => setComments(prev => prev.filter(cmt => cmt.id !== id))}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CommentItem({ comment: c, isAuthor, addToast, onDelete }: { comment: any, isAuthor: boolean, addToast: (m: string, t?: any) => void, onDelete: (id: string) => void, key?: React.Key }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(c.content);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!editText.trim() || editText === c.content) { setIsEditing(false); return; }
    setIsSaving(true);
    const { error } = await (supabase as any).from('comments').update({ content: editText }).eq('id', c.id);
    if (error) {
      addToast('فشل تعديل الرد', 'error');
    } else {
      c.content = editText;
      addToast('تم تعديل الرد ✅');
    }
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    onDelete(c.id); // Optimistic UI
    const { error } = await supabase.from('comments').delete().eq('id', c.id);
    if (error) addToast('فشل حذف الرد', 'error');
  };

  return (
    <div className="flex gap-3 group">
      <img
        src={c.author_avatar || 'https://ui-avatars.com/api/?background=random'}
        className="w-8 h-8 rounded-full border border-slate-100 shrink-0"
        referrerPolicy="no-referrer"
      />
      <div className="flex-1">
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm group-hover:border-blue-100 transition-all">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-1.5">
              <h5 className="text-[11px] font-bold text-slate-800">{c.author_name || 'مستخدم'}</h5>
              {isAuthor && <span className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-black">أنا</span>}
            </div>
            {isAuthor && !isEditing && (
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => { setEditText(c.content); setIsEditing(true); }}
                  className="p-1.5 bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-500 rounded-lg transition-all"
                  title="تعديل"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-1.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                  title="حذف"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                className="w-full bg-slate-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 resize-none leading-relaxed"
                rows={2}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSave())}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'جاري...' : 'حفظ'}
                </button>
              </div>
            </div>
          ) : (
            <FormattedText text={c.content} className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap" />
          )}
        </div>
      </div>
    </div>
  );
}

function TransmissionAction({ icon, label, onClick, active, activeColor }: { icon: React.ReactNode, label: string, onClick?: (e: React.MouseEvent) => void, active?: boolean, activeColor?: string }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex-1 flex items-center justify-center gap-2 py-3 mx-1 rounded-2xl font-black transition-all duration-300 hover:-translate-y-1.5 active:scale-95 group ${
        active 
          ? `${activeColor} bg-blue-50 dark:bg-blue-900/20 shadow-[0_10px_20px_rgba(10,102,194,0.1)]` 
          : 'text-slate-900 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-blue-600 hover:shadow-[0_15px_30px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_15px_30px_rgba(0,0,0,0.3)]'
      }`}
    >
      <span className={`group-hover:scale-125 transition-all duration-500 ${active ? 'drop-shadow-[0_0_8px_rgba(10,102,194,0.5)]' : 'group-hover:drop-shadow-lg'}`}>{icon}</span>
      <span className="text-[11px] hidden lg:block tracking-tight">{label}</span>
    </button>
  );
}
