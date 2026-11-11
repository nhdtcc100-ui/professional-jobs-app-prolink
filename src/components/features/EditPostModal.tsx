import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Edit3, Image as ImageIcon, Video, Check, Loader2, Sparkles, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { Post } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAppContext } from '../../contexts/AppContext';
import { validateField, sanitizeInput } from '../../lib/security/inputValidator';

interface EditPostModalProps {
  post: Post | null;
  onClose: () => void;
  onSuccess?: (updatedPost: Post) => void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({ post, onClose, onSuccess }) => {
  const { addToast, refreshData, appUser } = useAppContext();
  const [content, setContent] = useState(post?.content || '');
  const [imageUrl, setImageUrl] = useState(post?.imageUrl || '');
  const [videoUrl, setVideoUrl] = useState(post?.videoUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!post) return null;

  const handleContentChange = (val: string) => {
    setContent(val);
    if (!val.trim()) {
      setErrorMsg(null);
      return;
    }
    const check = validateField(val, 'محتوى المنشور', appUser ? { id: appUser.id, name: appUser.name, email: appUser.email } : undefined, '/feed/edit-post');
    setErrorMsg(check.valid ? null : (check.error ?? null));
  };

  const handleSave = async () => {
    const sanitizedContent = sanitizeInput(content.trim());
    if (!sanitizedContent) {
      addToast('يرجى كتابة محتوى للمنشور', 'error');
      return;
    }
    if (errorMsg) {
      addToast('يرجى تصحيح الأخطاء أولاً', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, any> = {
        content: sanitizedContent,
        image_url: imageUrl.trim() || null,
        video_url: videoUrl.trim() || null,
      };

      const isAdmin = appUser?.isAdmin || (appUser as any)?.role === 'admin';
      let query = (supabase as any).from('posts').update(payload).eq('id', post.id);
      if (!isAdmin && appUser?.id) {
        query = query.eq('author_id', appUser.id);
      }

      const { error } = await query;
      if (error) throw error;

      // Optimistic local update
      post.content = sanitizedContent;
      post.imageUrl = imageUrl.trim() || undefined;
      post.videoUrl = videoUrl.trim() || undefined;

      addToast('تم تحديث المنشور بنجاح ✅');
      if (onSuccess) onSuccess(post);
      if (refreshData) refreshData();
      onClose();
    } catch (err: any) {
      addToast('فشل تحديث المنشور: ' + (err.message || 'خطأ غير معروف'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-50 dark:bg-[#090d16] flex flex-col min-h-screen text-slate-900 dark:text-white"
        dir="rtl"
      >
        {/* Full-Page Top Navigation Header */}
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#090d16]/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-4 md:px-8 py-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <ArrowRight size={18} />
              <span className="text-xs font-black hidden sm:inline">الرجوع للتغذية</span>
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Edit3 size={18} />
              </div>
              <div>
                <h1 className="text-sm md:text-base font-black text-slate-800 dark:text-white leading-none">محرر المنشورات الكامل</h1>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1">تعديل وصياغة المقالات المهنية بسهولة</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-2xl text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer hidden md:block"
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !content.trim() || !!errorMsg}
              className="px-5 py-2.5 rounded-2xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>حفظ التعديلات</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Page Body Container */}
        <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8 space-y-6 pb-28">
          {/* Author Badge Banner */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <img
                src={post.authorAvatar || appUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'U')}&background=0a66c2&color=fff`}
                alt={post.authorName}
                className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
              />
              <div className="flex flex-col">
                <span className="text-sm font-black text-slate-900 dark:text-white">{post.authorName}</span>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{post.authorTitle || 'عضو نَشِط في الشبكة المهنية'}</span>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black border border-blue-100 dark:border-blue-800/40">
              <ShieldCheck size={12} />
              <span>وضع المحرر المباشر</span>
            </div>
          </div>

          {/* Article & Post Main Content Area */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 md:p-7 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={15} className="text-blue-500" />
                محتوى المقال والمنشور المهني *
              </label>
              <span className="text-[10px] font-bold text-slate-400">
                {content.length} حرف
              </span>
            </div>

            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              rows={11}
              className="w-full text-sm md:text-base font-medium bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-950/40 focus:border-blue-500 text-slate-900 dark:text-slate-100 outline-none transition-all resize-y shadow-inner leading-relaxed"
              placeholder="اكتب كامل تفاصيل المقال، الخبر، أو المنشور هنا بكامل الحرية وسهولة التنقل..."
              dir="auto"
              autoFocus
            />

            {errorMsg && (
              <div className="flex items-center gap-2 text-xs font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 p-3 rounded-2xl border border-red-200 dark:border-red-800/50">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Media Attachments Section */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 md:p-7 shadow-sm space-y-5">
            <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <ImageIcon size={15} className="text-emerald-500" />
              الوسائط المرفقة والمعاينة المباشرة
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">
                  رابط الصورة (URL)
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50/90 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white outline-none transition-all"
                  placeholder="https://example.com/image.jpg"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">
                  رابط الفيديو (اختياري)
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50/90 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white outline-none transition-all"
                  placeholder="https://youtube.com/watch?v=..."
                  dir="ltr"
                />
              </div>
            </div>

            {/* Image Preview Box */}
            {imageUrl && (
              <div className="relative rounded-3xl overflow-hidden max-h-72 border border-slate-200 dark:border-slate-800 bg-slate-900 group">
                <img
                  src={imageUrl}
                  alt="المعاينة"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setImageUrl('')}
                  className="absolute top-3 right-3 p-2 rounded-2xl bg-black/70 hover:bg-red-600 text-white transition-all backdrop-blur-md shadow-lg"
                  title="إزالة الصورة"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </main>
      </motion.div>
    </AnimatePresence>
  );
};
