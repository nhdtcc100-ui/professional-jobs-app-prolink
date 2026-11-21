import { sanitizeInput, validateField } from '../../lib/security/inputValidator';
import { isJobPoster, isUserAdmin, canUserPostAndInteract, isJobSeeker } from '../../lib/utils/roleUtils';
import { 
  Image as ImageIcon,
  Search,
  X, 
  Video, 
  Briefcase, 
  FileText, 
  Plus, 
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  JobPostForm 
} from './missions/JobPostForm';
import { jobService } from '../../lib/services/jobService';
import { postService } from '../../lib/services/postService';
import { supabase } from '../../lib/supabase';
import { imageService } from '../../lib/services/imageService';
import { mobileUploadService } from '../../lib/services/mobileUploadService';
import { GlassButton } from '../ui';
import { useAppContext } from '../../contexts/AppContext';
import { withTimeout } from '../../lib/utils/withTimeout';
import { withSessionRecovery } from '../../lib/services/sessionRecovery';
import { Capacitor } from '@capacitor/core';
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface PostBoxProps {
  avatar: string | undefined;
  appUser: any;
  addToast: (m: string, t?: any) => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  [key: string]: any;
}

const EMPTY_JOB_FORM = {
  title: '', company: '', description: '', requirements: '',
  location: '', salary: '', jobType: 'دوام كامل', working_hours: '', imageUrl: '', is_active: true
};

export const PostBox: React.FC<PostBoxProps> = ({ avatar, appUser, addToast, searchQuery, setSearchQuery }) => {
  const { setPosts, refreshData, setActiveTab, appUser: contextUser, setIsPublishingArticle, searchQuery: ctxSearchQuery, setSearchQuery: ctxSetSearchQuery } = useAppContext();
  const effectiveSearchQuery = searchQuery !== undefined ? searchQuery : (ctxSearchQuery || '');
  const handleSearchChange = (val: string) => {
    if (setSearchQuery) setSearchQuery(val);
    else if (ctxSetSearchQuery) ctxSetSearchQuery(val);
  };
  const currentUser = appUser || contextUser;

  // 🚫 الباحث عن عمل لا يظهر له صندوق إنشاء المنشورات على الإطلاق في الرئيسية
  if (!canUserPostAndInteract(currentUser)) {
    return null;
  }

  const [content, setContent] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [postError, setPostError] = useState<string | null>(null);

  const handleContentChange = (val: string) => {
    setContent(val);
    if (!val.trim()) { setPostError(null); return; }
    const check = validateField(val, 'محتوى المنشور', currentUser ? { id: currentUser.id, name: currentUser.name, email: currentUser.email } : undefined, '/feed/post');
    setPostError(check.valid ? null : (check.error ?? null));
  };
  const [isPosting, setIsPosting] = useState(false);
  const [uploadType, setUploadType] = useState<null | 'photo' | 'video' | 'job' | 'article'>(null);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Job Posting specialized state
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobFormData, setJobFormData] = useState({ ...EMPTY_JOB_FORM, company: currentUser?.companyName || '' });

  // 📱 إخفاء البار السفلي عند بدء كتابة/نشر مقال لتجنب حجب الكيبورد لزر الإرسال
  React.useEffect(() => {
    if (uploadType === 'article' || (uploadType !== null && content.length > 0)) {
      setIsPublishingArticle(true);
    } else {
      setIsPublishingArticle(false);
    }
    return () => {
      setIsPublishingArticle(false);
    };
  }, [uploadType, content, setIsPublishingArticle]);

  const isAdmin = isUserAdmin(currentUser);
  // ✅ Centralized role check — seekers are ALWAYS excluded regardless of hasCompanyProfile, Admin always allowed
  const isEmployer = isJobPoster(currentUser);
  const isSeeker = isJobSeeker(currentUser);

  // 📸 تجهيز الصورة فور اختيارها (عرض المعاينة الفورية وحفظ الملف بالذاكرة دون رفع شبكي قبل النقر على مشاركة)
  const prepareImageFile = (file: File) => {
    if (file.size === 0) {
      addToast("الملف فارغ، يرجى اختيار صورة صالحة", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAttachment(dataUrl);
      setSelectedFile(file);
      setUploadType(uploadType === 'article' ? 'article' : 'photo');
    };
    reader.readAsDataURL(file);
  };

  const triggerUpload = async () => {
    try {
      if (typeof (window as any)?.Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform()) {
        const file = await mobileUploadService.pickFile('post-image');
        if (file) {
          prepareImageFile(file);
        }
      } else {
        fileInputRef.current?.click();
      }
    } catch (err: any) {
      if (!err?.message?.includes('cancel') && !err?.message?.includes('User cancel')) {
        fileInputRef.current?.click();
      }
    }
  };

  const handlePostJob = async () => {
    if (!appUser) return;
    if (!isJobPoster(currentUser)) {
      addToast('نشر الوظائف مخصص لأصحاب العمل والمؤسسات فقط 🚫', 'error');
      return;
    }
    // 🚫 Block banned users
    if (appUser.isActive === false) {
      addToast('حسابك محظور ولا يمكنك نشر وظائف 🚫', 'error');
      return;
    }
    setIsPosting(true);
    try {
      const title = jobFormData.title.trim() || 'فرصة عمل جديدة';
      const company = jobFormData.company || appUser.companyName || appUser.name || 'مؤسسة معتمدة';
      const postData = {
        title,
        company,
        description: jobFormData.description,
        requirements: jobFormData.requirements,
        location: jobFormData.location || appUser.location || 'عن بُعد',
        salary: jobFormData.salary,
        jobType: jobFormData.jobType,
        working_hours: jobFormData.working_hours,
        imageUrl: appUser.coverUrl || (appUser as any)?.cover_url || null,
        employer_id: appUser.id,
        is_active: true,
      };

      const { error } = await jobService.postJob(postData);
      if (error) throw error;

      addToast('🚀 تم نشر الوظيفة بنجاح!');
      setShowJobForm(false);
      setJobFormData({ ...EMPTY_JOB_FORM, company: appUser?.companyName || '' });
      refreshData?.();
    } catch (e: any) {
      addToast('فشل النشر: ' + e.message, 'error');
    } finally {
      setIsPosting(false);
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !attachment && !videoUrl) return;
    if (!appUser?.id) { addToast('يجب تسجيل الدخول أولاً', 'error'); return; }
    if (!canUserPostAndInteract(currentUser)) {
      addToast('نشر المنشورات مخصص لأصحاب العمل والشركات فقط 🚫', 'error');
      return;
    }
    // 🚫 Block banned users from posting
    if (appUser.isActive === false) {
      addToast('حسابك محظور ولا يمكنك النشر 🚫', 'error');
      return;
    }
    if (isPosting) return; 

    const tempId = `temp-${Date.now()}`;
    const rawContent = (uploadType === 'article' && articleTitle.trim())
      ? `# ${articleTitle.trim()}\n\n${content}`
      : content;
    const postContent = sanitizeInput(rawContent, 20000, {
      id: appUser?.id,
      name: appUser?.name,
      email: appUser?.email
    });
    const postType = uploadType;
    const postAttachment = attachment;
    const postVideoUrl = videoUrl;
    const postSelectedFile = selectedFile;

    // 1. Reset UI Immediately
    setContent('');
    setArticleTitle('');
    setAttachment(null);
    setSelectedFile(null);
    setVideoUrl('');
    setUploadType(null);
    setIsPosting(true);

    // 2. Optimistic Update
    const optimisticPost = {
      id: tempId,
      authorId: appUser.id,
      authorName: appUser.name || 'مستخدم Elevate عراق',
      authorAvatar: appUser.avatar || 'https://ui-avatars.com/api/?background=random',
      authorTitle: appUser.role === 'employer' ? (appUser.companyName || 'صاحب عمل') : 'باحث عن عمل',
      content: postContent,
      imageUrl: (postType === 'photo' || postType === 'article') ? postAttachment : null,
      videoUrl: postType === 'video' ? postAttachment : postVideoUrl || null,
      likesCount: 0,
      timestamp: { toDate: () => new Date() }
    };
    setPosts(prev => [optimisticPost as any, ...prev]);

    try {
      let finalImageUrl: string | null = null;
      let finalVideoUrl: string | null = null;

      // 🚀 Handle Image Upload on Share (مخطط الصورة الشخصية والغلاف المزدوج Dual-Transport: 3s Storage -> Compact Base64)
      if ((postType === 'photo' || postType === 'article') && (postSelectedFile || postAttachment)) {
        try {
          if (postSelectedFile) {
            const uploadRes = await mobileUploadService.uploadFile(postSelectedFile, 'post-image', appUser.id);
            const timeoutPromise = new Promise<string | null>((r) => setTimeout(() => r(null), 3000));
            const res = await Promise.race([uploadRes.uploadPromise, timeoutPromise]);
            finalImageUrl = res || uploadRes.preview || postAttachment;
          } else if (postAttachment) {
            finalImageUrl = postAttachment;
          }
        } catch (uploadErr) {
          console.warn('[PostBox] Image upload fallback to attachment:', uploadErr);
          finalImageUrl = postAttachment;
        }
      }

      // Handle Video Upload
      if (postType === 'video' && postSelectedFile) {
        finalVideoUrl = await imageService.uploadVideo(postSelectedFile, appUser.id);
      }

      const postPayload = {
        author_id:     appUser.id,
        author_name:   appUser.name   || 'مستخدم Elevate عراق',
        author_avatar: appUser.avatar || null,
        author_title:  appUser.role === 'employer'
                         ? (appUser.companyName || 'صاحب عمل')
                         : 'باحث عن عمل',
        content:       postContent,
        image_url:     (postType === 'photo' || postType === 'article')
                         ? (finalImageUrl || postAttachment)
                         : null,
        video_url:     postType === 'video'
                         ? (finalVideoUrl || null)
                         : (postVideoUrl || null),
        likes_count:   0,
      };

      const { data: newPost, error } = await postService.createPost(postPayload);
      if (error) throw error;

      postService.invalidateCache();

      if (newPost?.id) {
        setPosts(prev => prev.map(p => p.id === tempId ? { ...p, id: newPost.id, imageUrl: finalImageUrl || postAttachment || p.imageUrl } : p));
      }

      addToast('تم النشر بنجاح! 🚀');
    } catch (e: any) {
      console.error(e);
      addToast('فشل الإرسال: ' + e.message, 'error');
      setPosts(prev => prev.filter(p => p.id !== tempId));
    } finally {
      setIsPosting(false);
      setIsPublishingArticle(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = ''; // Reset input so same file can be picked again

    if (isSeeker && !file.type.startsWith('image/')) {
      addToast("كباحث عن عمل، يمكنك مشاركة الصور والمقالات فقط", "warning");
      return;
    }

    if (file.type.startsWith('image/')) {
      prepareImageFile(file);
    } else {
      setUploadType('video');
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setAttachment(url);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800 shadow-[0_15px_40px_rgba(0,0,0,0.03)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2.5rem] p-6 mb-6 transition-all duration-500 hover:shadow-[0_30px_70px_rgba(10,102,194,0.1)]">
      <div className="flex items-center gap-4">
        <div className="relative group/avatar shrink-0">
          <div className="absolute inset-0 bg-blue-600 rounded-2xl blur-lg opacity-0 group-hover/avatar:opacity-20 transition-opacity" />
          <img 
            src={avatar || 'https://ui-avatars.com/api/?name=User&background=random'} 
            className="relative w-12 h-12 rounded-2xl border-2 border-white dark:border-slate-700 shadow-md group-hover/avatar:scale-110 group-hover/avatar:rotate-3 transition-all duration-500 object-cover" 
            alt="Me" 
            referrerPolicy="no-referrer" 
          />
        </div>
        
        <div className="flex-1 flex justify-around items-center gap-2">
          <input type="file" ref={fileInputRef} className="hidden" accept={isSeeker ? "image/*" : "image/*,video/*"} onChange={handleFileChange} />
          <ActionBtn onClick={triggerUpload} icon={<div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl shadow-sm"><ImageIcon className="text-blue-600" size={18} /></div>} label="صورة" />
          <ActionBtn onClick={() => setUploadType('article')} icon={<div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl shadow-sm"><FileText className="text-purple-600" size={18} /></div>} label="مقال" />
          {isAdmin && <ActionBtn onClick={triggerUpload} icon={<div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl shadow-sm"><Video className="text-emerald-600" size={18} /></div>} label="فيديو" />}
          {/* نشر وظيفة: يظهر فقط لصاحب العمل والأدمن — مخفي تماماً عن الباحث عن عمل */}
          {isEmployer && (
            <ActionBtn 
              onClick={() => setActiveTab('post-job')} 
              icon={<div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl shadow-sm"><Briefcase className="text-amber-600" size={18} /></div>} 
              label="نشر وظيفة" 
            />
          )}
        </div>
      </div>

      <AnimatePresence>
        {(content !== '' || uploadType !== null) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-800 overflow-hidden"
          >
            {attachment && (
              <div className="relative mb-5 rounded-3xl overflow-hidden group/attach shadow-2xl">
                {attachment.includes('video') ? (
                  <video src={attachment} className="w-full h-72 object-cover" controls />
                ) : (
                  <img src={attachment} className="w-full h-56 object-cover" alt="Attachment" />
                )}
                <button 
                  onClick={() => setAttachment(null)} 
                  className="absolute top-4 left-4 p-2 bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg backdrop-blur-md"
                >
                  <Plus className="rotate-45" size={20} />
                </button>
                {isPosting && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center gap-2 text-white font-black text-xs z-10">
                    <Loader2 size={18} className="animate-spin text-blue-400" />
                    <span>جاري الرفع والنشر...</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center opacity-0 group-hover/attach:opacity-100 transition-opacity">
                  <CheckCircle className="text-white w-12 h-12" />
                </div>
              </div>
            )}
            
            {uploadType === 'video' && !attachment && (
              <div className="mb-5 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  رابط الفيديو (YouTube / Direct)
                </label>
                <input
                  id="post-video-url"
                  name="videoUrl"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3 text-xs outline-none focus:ring-8 focus:ring-blue-50/50 dark:focus:ring-blue-900/10 transition-all shadow-inner font-bold"
                  placeholder="قم بلصق الرابط هنا للمشاركة فوراً..."
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}

            {uploadType === 'article' && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                    <FileText size={13} />
                    عنوان المقال المهني
                  </label>
                  {!attachment && (
                    <button
                      type="button"
                      onClick={triggerUpload}
                      className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ImageIcon size={12} />
                      + غلاف المقال (اختياري)
                    </button>
                  )}
                </div>
                <input
                  id="post-article-title"
                  name="articleTitle"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-2xl px-5 py-3 text-sm font-black text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-purple-500/20 transition-all shadow-inner"
                  placeholder="اكتب عنوان المقال هنا..."
                  value={articleTitle}
                  onChange={e => setArticleTitle(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}

            <textarea
              id="post-content"
              name="content"
              className={`w-full bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] p-5 text-sm text-slate-700 dark:text-white h-32 focus:outline-none focus:ring-8 transition-all font-sans font-medium shadow-inner resize-none leading-relaxed border ${postError ? 'border-red-400 focus:ring-red-100' : 'border-transparent focus:ring-blue-50/50 dark:focus:ring-blue-900/10'}`}
              placeholder={uploadType === 'article' ? "اكتب محتوى وتفاصيل المقال هنا..." : uploadType === 'job' ? "أدخل تفاصيل الوظيفة..." : "بماذا تفكر الآن؟ شارك أفكارك أو خبراتك المهنية..."}
              value={content}
              onChange={e => handleContentChange(e.target.value)}
            />
            {postError && (
              <div className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[11px] font-semibold">
                <AlertCircle size={13} className="shrink-0 text-red-500" />
                <span>{postError}</span>
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-5">
              <button 
                onClick={() => {
                  setContent('');
                  setArticleTitle('');
                  setAttachment(null);
                  setSelectedFile(null);
                  setUploadType(null);
                  setIsPublishingArticle(false);
                }} 
                className="px-6 py-3 text-xs font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
              >
                تراجع
              </button>
              <GlassButton 
                onClick={handlePost} 
                disabled={(!content.trim() && !attachment && !videoUrl) || isPosting || !!postError} 
                className="py-3 px-10 rounded-2xl shadow-[0_10px_20px_rgba(10,102,194,0.3)] hover:shadow-[0_15px_30px_rgba(10,102,194,0.5)] active:scale-95 transition-all"
              >
                {isPosting ? 'جاري النشر...' : 'نشر الآن 🚀'}
              </GlassButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick} 
      className="flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-all duration-300 group hover:shadow-lg hover:shadow-black/5"
    >
      <div className="group-hover:scale-110 transition-transform duration-500 drop-shadow-md">
        {icon}
      </div>
      <span className="text-[10px] font-black text-slate-900 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-white uppercase tracking-widest transition-colors">{label}</span>
    </motion.div>
  );
}
