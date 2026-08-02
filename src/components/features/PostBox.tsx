import { 
  Image as ImageIcon, 
  Video, 
  Briefcase, 
  FileText, 
  Plus, 
  Sparkles 
} from 'lucide-react';
import { 
  JobPostForm 
} from './missions/JobPostForm';
import { jobService } from '../../lib/services/jobService';
import { supabase } from '../../lib/supabase';
import { imageService } from '../../lib/services/imageService';
import { GlassButton } from '../ui';
import { useAppContext } from '../../contexts/AppContext';
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface PostBoxProps {
  avatar: string | undefined;
  appUser: any;
  addToast: (m: string, t?: any) => void;
}

const EMPTY_JOB_FORM = {
  title: '', company: '', description: '', requirements: '',
  location: '', salary: '', jobType: 'دوام كامل', working_hours: '', imageUrl: '', is_active: true
};

export const PostBox: React.FC<PostBoxProps> = ({ avatar, appUser, addToast }) => {
  const { setPosts, refreshData } = useAppContext();
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [uploadType, setUploadType] = useState<null | 'photo' | 'video' | 'job' | 'article'>(null);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Job Posting specialized state
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobFormData, setJobFormData] = useState({ ...EMPTY_JOB_FORM, company: appUser?.companyName || '' });

  const isAdmin = appUser?.isAdmin;
  const isEmployer = appUser?.role === 'employer' || isAdmin;

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handlePostJob = async () => {
    if (!appUser) return;
    if (!jobFormData.title.trim()) { addToast('يرجى إدخال المسمى الوظيفي', 'error'); return; }
    
    setIsPosting(true);
    try {
      const postData = {
        title: jobFormData.title,
        company: jobFormData.company || appUser.companyName || 'مؤسسة غير معرفة',
        description: jobFormData.description,
        requirements: jobFormData.requirements,
        location: jobFormData.location || appUser.location || 'عن بُعد',
        salary: jobFormData.salary,
        jobType: jobFormData.jobType,
        working_hours: jobFormData.working_hours,
        imageUrl: appUser.avatar || '',
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
    if (isPosting) return; 

    const tempId = `temp-${Date.now()}`;
    const postContent = content;
    const postType = uploadType;
    const postAttachment = attachment;
    const postVideoUrl = videoUrl;
    const postSelectedFile = selectedFile;

    // 1. Reset UI Immediately
    setContent('');
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
      imageUrl: postType === 'photo' ? postAttachment : null,
      videoUrl: postType === 'video' ? postAttachment : postVideoUrl || null,
      likesCount: 0,
      timestamp: { toDate: () => new Date() }
    };
    setPosts(prev => [optimisticPost as any, ...prev]);

    try {
      let finalImageUrl: string | null = null;
      let finalVideoUrl: string | null = null;

      // Handle Image Upload
      if (postType === 'photo' && postAttachment && postAttachment.startsWith('data:')) {
        const res = await fetch(postAttachment);
        const blob = await res.blob();
        const file = new File([blob], 'post-image.jpg', { type: 'image/jpeg' });
        finalImageUrl = await imageService.processAndUpload(file, appUser.id, 'images');
      }

      // Handle Video Upload
      if (postType === 'video' && postSelectedFile) {
        finalVideoUrl = await imageService.uploadVideo(postSelectedFile, appUser.id);
      }

      const { data: newPost, error } = await db.from('posts').insert([{
        author_id:     appUser.id,
        author_name:   appUser.name   || 'مستخدم Elevate عراق',
        author_avatar: appUser.avatar || null,
        author_title:  appUser.role === 'employer'
                         ? (appUser.companyName || 'صاحب عمل')
                         : 'باحث عن عمل',
        content:       postContent,
        image_url:     postType === 'photo'
                         ? (finalImageUrl || postAttachment)
                         : null,
        video_url:     postType === 'video'
                         ? (finalVideoUrl || null)
                         : (postVideoUrl || null),
        likes_count:   0,
      }]).select('id').single();

      if (error) throw error;

      if (newPost?.id) {
        setPosts(prev => prev.map(p => p.id === tempId ? { ...p, id: newPost.id } : p));
      }

      addToast('تم النشر بنجاح! 🚀');
    } catch (e: any) {
      console.error(e);
      addToast('فشل الإرسال: ' + e.message, 'error');
      setPosts(prev => prev.filter(p => p.id !== tempId));
    } finally {
      setIsPosting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result as string);
        setUploadType(file.type.startsWith('image/') ? 'photo' : 'video');
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800 shadow-[0_15px_40px_rgba(0,0,0,0.03)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2.5rem] p-6 mb-6 transition-all duration-500 hover:shadow-[0_30px_70px_rgba(10,102,194,0.1)]">
      <div className="flex gap-4">
        <div className="relative group/avatar">
          <div className="absolute inset-0 bg-blue-600 rounded-2xl blur-lg opacity-0 group-hover/avatar:opacity-20 transition-opacity" />
          <img 
            src={avatar || 'https://ui-avatars.com/api/?name=User&background=random'} 
            className="relative w-12 h-12 rounded-2xl border-2 border-white dark:border-slate-700 shadow-md group-hover/avatar:scale-110 group-hover/avatar:rotate-3 transition-all duration-500" 
            alt="Me" 
            referrerPolicy="no-referrer" 
          />
        </div>
        <button
          onClick={() => setUploadType('article')}
          className="flex-1 bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl text-right px-6 py-3 text-sm font-black text-slate-400 hover:text-blue-600 hover:shadow-lg transition-all duration-300 shadow-inner group"
        >
          <span className="group-hover:translate-x-[-4px] inline-block transition-transform uppercase tracking-widest text-[10px]">بدء إرسال إشارة توجيه جديدة...</span>
        </button>
      </div>
      
      <div className="flex justify-around items-center mt-5 gap-2">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
        <ActionBtn onClick={triggerUpload} icon={<div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl shadow-sm"><ImageIcon className="text-blue-600" size={18} /></div>} label="صورة" />
        {isAdmin && <ActionBtn onClick={triggerUpload} icon={<div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl shadow-sm"><Video className="text-emerald-600" size={18} /></div>} label="فيديو" />}
        <ActionBtn 
          onClick={() => {
            if (isEmployer) {
              setShowJobForm(true);
            } else {
              addToast('تحويل الحساب لصاحب عمل للنشر', 'error');
            }
          }} 
          icon={<div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl shadow-sm"><Briefcase className="text-amber-600" size={18} /></div>} 
          label="نشر وظيفة" 
        />
        <ActionBtn onClick={() => setUploadType('article')} icon={<div className="p-2 bg-rose-50 dark:bg-rose-900/30 rounded-xl shadow-sm"><FileText className="text-rose-600" size={18} /></div>} label="مقال" />
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
                <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center opacity-0 group-hover/attach:opacity-100 transition-opacity">
                  <Sparkles className="text-white w-12 h-12 animate-pulse" />
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

            <textarea
              id="post-content"
              name="content"
              className="w-full bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] p-5 text-sm text-slate-700 dark:text-white h-32 focus:outline-none focus:ring-8 focus:ring-blue-50/50 dark:focus:ring-blue-900/10 transition-all font-sans font-medium shadow-inner resize-none leading-relaxed"
              placeholder={uploadType === 'job' ? "أدخل تفاصيل الوظيفة..." : (uploadType === 'article' ? "اكتب مقالك الاحترافي هنا..." : "بماذا تفكر الآن؟")}
              value={content}
              onChange={e => setContent(e.target.value)}
            />
            
            <div className="flex justify-end gap-3 mt-5">
              <button 
                onClick={() => { setContent(''); setAttachment(null); setUploadType(null); }} 
                className="px-6 py-3 text-xs font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
              >
                تراجع
              </button>
              <GlassButton 
                onClick={handlePost} 
                disabled={(!content.trim() && !attachment && !videoUrl) || isPosting} 
                className="py-3 px-10 rounded-2xl shadow-[0_10px_20px_rgba(10,102,194,0.3)] hover:shadow-[0_15px_30px_rgba(10,102,194,0.5)] active:scale-95 transition-all"
              >
                {isPosting ? 'جاري الإرسال...' : 'إطلاق الإشارة 🚀'}
              </GlassButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Job Post Form Integration */}
      <JobPostForm
        show={showJobForm}
        formData={jobFormData}
        setFormData={setJobFormData}
        onSubmit={handlePostJob}
        isPosting={isPosting}
        onClose={() => setShowJobForm(false)}
        appUser={appUser}
      />
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
