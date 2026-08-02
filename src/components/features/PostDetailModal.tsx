import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ThumbsUp, 
  MessageCircle, 
  Repeat2, 
  Share, 
  Send, 
  Clock, 
  MoreHorizontal,
  ChevronLeft,
  Calendar,
  Sparkles,
  Phone,
  MessageSquare,
  Edit2,
  Trash2,
  Check,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Post, AppUser } from '../../types';
import { sanitizeComment } from '../../lib/security/inputValidator';

interface PostDetailModalProps {
  post: Post;
  appUser: AppUser | null;
  onClose: () => void;
  onLike: (id: string) => void;
  onAddComment: (id: string, content: string) => void;
  onEcho: (post: Post) => void;
  onShareToGroup: (post: Post) => void;
  onRelocate: (post: Post) => void;
  allUsers: AppUser[];
  addToast: (msg: string, type?: any) => void;
  setSelectedProfile: (user: AppUser) => void;
}

// Helper component to format text with clickable links and phone numbers
const FormattedText = ({ text, className }: { text: string, className?: string }) => {
  if (!text) return null;
  const combinedRegex = /(https?:\/\/[^\s]+|\+?[\d\s-]{8,20}\d)/g;
  const parts = text.split(combinedRegex);
  
  return (
    <p className={className} dir="auto" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.match(/https?:\/\/[^\s]+/)) {
          return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 hover:underline font-bold" onClick={e => e.stopPropagation()}>{part}</a>;
        }
        if (part.match(/\+?[\d\s-]{8,20}\d/) && part.replace(/[\D]/g, '').length >= 8) {
          return <a key={i} href={`tel:${part.replace(/[\s-]/g, '')}`} className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/30 font-black text-[11px] mx-1 shadow-sm hover:scale-105 transition-all cursor-pointer my-0.5" dir="ltr" onClick={e => e.stopPropagation()}><Phone size={12} /> {part}</a>;
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
};

// Delete confirmation dialog
const DeleteConfirmDialog = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.90, y: -8 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.90, y: -8 }}
    className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 rounded-2xl shadow-2xl p-4 w-56"
    onClick={e => e.stopPropagation()}
  >
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
        <AlertTriangle size={14} className="text-red-500" />
      </div>
      <p className="text-xs font-black text-slate-800 dark:text-white">حذف التعليق؟</p>
    </div>
    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 font-bold leading-relaxed">
      لا يمكن التراجع عن هذا الإجراء بعد تأكيده.
    </p>
    <div className="flex gap-2">
      <button
        onClick={onConfirm}
        className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black rounded-xl transition-colors"
      >
        حذف
      </button>
      <button
        onClick={onCancel}
        className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[10px] font-black rounded-xl transition-colors"
      >
        إلغاء
      </button>
    </div>
  </motion.div>
);

// Individual Comment Component with edit/delete
const CommentItem = ({
  comment,
  index,
  appUser,
  timeAgo,
  onDelete,
  onEdit,
}: {
  comment: any;
  index: number;
  appUser: AppUser | null;
  timeAgo: (ds: string) => string;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwner = !!appUser?.id && !!comment.author_id && appUser.id === comment.author_id;

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowDeleteConfirm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText === comment.content) {
      setIsEditing(false);
      setEditText(comment.content);
      return;
    }
    setIsSaving(true);
    await onEdit(comment.id, editText.trim());
    setIsSaving(false);
    setIsEditing(false);
  };

  return (
    <motion.div
      key={comment.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex gap-2 sm:gap-4 group/comment w-full"
    >
      {/* Avatar */}
      <img
        src={comment.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author_name)}&background=random`}
        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm shrink-0 mt-0.5"
        alt=""
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5 relative overflow-visible">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-1">
            <div className="flex flex-col min-w-0">
              <h5 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tighter truncate leading-tight">
                {comment.author_name}
              </h5>
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                <Clock size={9} />
                {timeAgo(comment.created_at)}
                {comment.edited && <span className="text-slate-300 dark:text-slate-600">(مُعدَّل)</span>}
              </span>
            </div>

            {/* Actions menu — always visible for comment owner (needed for touch/mobile) */}
            {isOwner && (
              <div className="relative shrink-0" ref={menuRef}>
                <button
                  onClick={() => { setMenuOpen(!menuOpen); setShowDeleteConfirm(false); }}
                  className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                  title="خيارات التعليق"
                >
                  <MoreHorizontal size={14} className="text-slate-500 dark:text-slate-400" />
                </button>

                <AnimatePresence>
                  {menuOpen && !showDeleteConfirm && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.90, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.90, y: -6 }}
                      className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden w-36"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { setMenuOpen(false); setIsEditing(true); setEditText(comment.content); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
                      >
                        <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                          <Edit2 size={11} className="text-blue-500" />
                        </div>
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">تعديل</span>
                      </button>
                      <div className="h-px bg-slate-50 dark:bg-white/5 mx-2" />
                      <button
                        onClick={() => { setShowDeleteConfirm(true); setMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <div className="w-6 h-6 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                          <Trash2 size={11} className="text-red-500" />
                        </div>
                        <span className="text-[11px] font-black text-red-500">حذف</span>
                      </button>
                    </motion.div>
                  )}

                  {showDeleteConfirm && (
                    <DeleteConfirmDialog
                      onConfirm={() => { setShowDeleteConfirm(false); setMenuOpen(false); onDelete(comment.id); }}
                      onCancel={() => { setShowDeleteConfirm(false); setMenuOpen(false); }}
                    />
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Text or Edit Mode */}
          <div className="px-3 pb-3">
            {isEditing ? (
              <div className="space-y-2 mt-1">
                <textarea
                  autoFocus
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                    if (e.key === 'Escape') { setIsEditing(false); setEditText(comment.content); }
                  }}
                  className="w-full text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-blue-200 dark:border-blue-600/40 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none leading-relaxed font-bold min-h-[60px]"
                  dir="auto"
                  style={{ wordBreak: 'break-word' }}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setIsEditing(false); setEditText(comment.content); }}
                    className="px-3 py-1.5 text-[10px] font-black text-slate-500 hover:text-slate-700 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editText.trim()}
                    className="px-3 py-1.5 text-[10px] font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSaving ? (
                      <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Check size={11} />
                    )}
                    حفظ
                  </button>
                </div>
              </div>
            ) : (
              <p
                className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-bold whitespace-pre-wrap mt-1"
                dir="auto"
                style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
              >
                {comment.content}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function PostDetailModal({ 
  post, 
  appUser, 
  onClose, 
  onLike, 
  onAddComment, 
  onEcho, 
  onShareToGroup, 
  onRelocate, 
  allUsers,
  addToast,
  setSelectedProfile
}: PostDetailModalProps) {
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

    const channel = supabase.channel(`modal-comments-${post.id}`);
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` }, fetchComments)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [post.id]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !appUser) return;
    const commentText = newComment;
    setIsCommenting(true);
    try {
      await onAddComment(post.id, commentText);
      setNewComment('');
      // Refetch comments manually to update UI instantly without relying solely on realtime triggers
      await fetchComments();
    } catch (err) {
      addToast('فشل إضافة الرد', 'error');
    } finally {
      setIsCommenting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    // 🔒 Double ownership check — Frontend guard before hitting DB
    const comment = comments.find(c => c.id === commentId);
    if (!appUser?.id || !comment) return;
    if (comment.author_id !== appUser.id) {
      addToast('غير مسموح — يمكنك حذف تعاليقك فقط', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('author_id', appUser.id); // Extra server-side guard
      if (error) throw error;
      setComments(prev => prev.filter(c => c.id !== commentId));
      addToast('تم حذف التعليق', 'success');
    } catch {
      addToast('فشل حذف التعليق', 'error');
    }
  };

  const handleEditComment = async (commentId: string, content: string) => {
    // 🔒 Double ownership check — Frontend guard before hitting DB
    const comment = comments.find(c => c.id === commentId);
    if (!appUser?.id || !comment) return;
    if (comment.author_id !== appUser.id) {
      addToast('غير مسموح — يمكنك تعديل تعاليقك فقط', 'error');
      return;
    }

    // Sanitize content before saving
    const sanitized = sanitizeComment(content);
    if (!sanitized) return;

    try {
      const { error } = await (supabase as any)
        .from('comments')
        .update({ content: sanitized, edited: true })
        .eq('id', commentId)
        .eq('author_id', appUser.id); // Extra server-side guard
      if (error) throw error;
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: sanitized, edited: true } : c));
      addToast('تم تعديل التعليق', 'success');
    } catch {
      addToast('فشل تعديل التعليق', 'error');
    }
  };

  const timeAgo = (ds: string) => {
    try {
      const h = Math.floor((Date.now() - new Date(ds).getTime()) / 3.6e6);
      if (h < 1) return 'منذ قليل';
      if (h < 24) return `منذ ${h} ساعة`;
      const d = Math.floor(h / 24);
      if (d < 7) return `منذ ${d} أيام`;
      return `منذ ${Math.floor(d / 7)} أسابيع`;
    } catch { return ''; }
  };

  const author = allUsers.find(u => u.id === post.authorId);
  const displayImage = post.imageUrl || author?.coverUrl;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 sm:inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xl p-0 sm:p-8 top-[75px] bottom-[85px] sm:top-0 sm:bottom-0">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          className="bg-[#f8fafc] dark:bg-[#020617] w-full md:max-w-5xl h-full sm:h-[90vh] rounded-none sm:rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col relative z-50 border-x sm:border border-white/10"
        >
          {/* Header (Glassmorphic) */}
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4 cursor-pointer group" onClick={() => {
              const found = allUsers.find(au => au.id === post.authorId);
              if (found) { setSelectedProfile(found); onClose(); }
            }}>
              <div className="relative">
                <img 
                  src={post.authorAvatar} 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl object-cover border-2 border-white dark:border-slate-700 shadow-md group-hover:scale-110 transition-transform duration-500" 
                  alt=""
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
              </div>
              <div className="flex flex-col">
                <h2 className="font-black text-slate-900 dark:text-white text-sm sm:text-base group-hover:text-blue-600 transition-colors">{post.authorName}</h2>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-none mt-1">{post.authorTitle}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
               <button 
                onClick={onClose}
                className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-500 flex items-center justify-center transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            <div className="max-w-4xl mx-auto p-3 sm:p-8 space-y-6 sm:space-y-8">
              {/* Main Content Card */}
              <div className="bg-white dark:bg-slate-900/50 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm p-4 sm:p-10 space-y-6">
                
                {/* Meta Tags */}
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border border-blue-100 dark:border-blue-800/30">
                    توجيه مهني
                  </span>
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    <Clock size={12} />
                    {timeAgo(post.timestamp || new Date().toISOString())}
                  </div>
                </div>

                {/* Text Content */}
                <FormattedText 
                   text={post.content} 
                   className="text-base sm:text-lg text-slate-800 dark:text-slate-100 leading-relaxed font-bold whitespace-pre-wrap" 
                />

                {/* Media */}
                {displayImage && (
                  <div className="rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-white/10 shadow-2xl bg-slate-50 dark:bg-slate-900">
                    <img src={displayImage} className="w-full h-auto max-h-[600px] object-contain" alt="" />
                  </div>
                )}

                {post.videoUrl && (
                  <div className="aspect-video rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-white/10 shadow-2xl bg-black flex items-center justify-center">
                     {post.videoUrl.includes('youtube.com') || post.videoUrl.includes('youtu.be') ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${post.videoUrl.split('v=')[1] || post.videoUrl.split('/').pop()}`}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    ) : (
                      <video src={post.videoUrl} controls className="w-full h-full" />
                    )}
                  </div>
                )}

                {/* Engagement Bar */}
                <div className="flex items-center justify-between pt-6 border-t border-slate-50 dark:border-white/5 mt-8">
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-1">
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-md">
                        <ThumbsUp size={12} className="text-white fill-white" />
                      </div>
                      <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-md translate-x-1">
                        <span className="text-[10px]">❤️</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-black text-slate-900 dark:text-slate-400">{post.likesCount || 0} تفاعل مهني</span>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={() => onLike(post.id)}
                      className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs transition-all ${post.likesCount > 0 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100/50' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-blue-600 border border-transparent hover:border-blue-100'}`}
                    >
                      <ThumbsUp size={18} className={post.likesCount > 0 ? 'fill-current' : ''} />
                      توجيه الإشارة
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <ActionButton 
                  icon={<Repeat2 size={20} />} 
                  label="صدى التوجيه" 
                  onClick={() => onEcho(post)}
                  color="blue"
                />
                <ActionButton 
                  icon={<Share size={20} />} 
                  label="نشر للمجموعات" 
                  onClick={() => onShareToGroup(post)}
                  color="indigo"
                />
                <ActionButton 
                  icon={<Send size={20} />} 
                  label="ترحيل خاص" 
                  onClick={() => onRelocate(post)}
                  color="emerald"
                />
                <ActionButton 
                  icon={<MessageSquare size={20} />} 
                  label="بدء حوار" 
                  onClick={() => {
                    const found = allUsers.find(au => au.id === post.authorId);
                    if (found) { setSelectedProfile(found); onClose(); }
                  }}
                  color="slate"
                />
              </div>

              {/* Comments Section */}
              <div className="space-y-4 pb-32">
                <div className="flex items-center justify-between px-1">
                   <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                      <MessageCircle size={20} className="text-blue-600" />
                      الحوارات المهنية ({comments.length})
                   </h3>
                </div>

                <div className="bg-white dark:bg-slate-900/30 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-white/5 p-3 sm:p-6 space-y-5">
                  {/* Comment Input */}
                  <div className="flex gap-2 sm:gap-3 items-end">
                    <img
                      src={appUser?.avatar || 'https://ui-avatars.com/api/?background=random'}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl border-2 border-white dark:border-slate-800 shadow-md shrink-0 mb-0.5"
                      alt=""
                    />
                    <div className="flex-1 flex gap-2 items-end">
                      <textarea 
                        className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-[1.25rem] sm:rounded-[1.5rem] px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 min-h-[46px] sm:min-h-[52px] resize-none transition-all font-bold"
                        placeholder="أضف ردك المهني..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAddComment())}
                        dir="auto"
                        style={{ wordBreak: 'break-word' }}
                        rows={1}
                      />
                      <button 
                        onClick={handleAddComment}
                        disabled={isCommenting || !newComment.trim()}
                        className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-600 text-white rounded-xl sm:rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 disabled:grayscale flex items-center justify-center shrink-0"
                      >
                        {isCommenting ? (
                          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Send size={15} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-3 sm:space-y-5">
                    <AnimatePresence>
                      {comments.map((c, i) => (
                        <CommentItem
                          key={c.id}
                          comment={c}
                          index={i}
                          appUser={appUser}
                          timeAgo={timeAgo}
                          onDelete={handleDeleteComment}
                          onEdit={handleEditComment}
                        />
                      ))}
                    </AnimatePresence>

                    {comments.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                          <MessageCircle size={20} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-xs font-black text-slate-400 dark:text-slate-600">كن أول من يضيف رداً مهنياً</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Quick Action Dock (Mobile) */}
          <div className="absolute bottom-6 left-4 right-4 md:hidden">
             <div className="bg-blue-600 text-white rounded-3xl p-4 sm:p-5 shadow-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <Sparkles size={18} className="animate-pulse shrink-0" />
                   <span className="text-xs font-black">تعاون مهني نشط</span>
                </div>
                <button onClick={onClose} className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black whitespace-nowrap">إغلاق العرض</button>
             </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function ActionButton({ icon, label, onClick, color }: { icon: React.ReactNode, label: string, onClick: () => void, color: string }) {
  const colors: any = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100/50 hover:bg-blue-100',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100/50 hover:bg-indigo-100',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100/50 hover:bg-emerald-100',
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/5 hover:bg-slate-200'
  };

  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border transition-all active:scale-95 shadow-sm group ${colors[color]}`}
    >
      <div className="mb-1.5 sm:mb-2 group-hover:scale-125 transition-transform duration-500 scale-90 sm:scale-100">{icon}</div>
      <span className="text-[9px] sm:text-[10px] font-black text-center leading-tight tracking-tighter">{label}</span>
    </button>
  );
}
