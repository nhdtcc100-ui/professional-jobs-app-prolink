import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Briefcase, CheckCircle2, AlertCircle, Loader2, CloudUpload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { profileService } from '../../lib/services/profileService';
import { imageService } from '../../lib/services/imageService';
import { PostTransmissionCard } from '../features';
import { AppUser, Post } from '../../types';
import { ProfileHeader, ProfileTabs, ProfileEditView, ProfileActivityView } from './profile';
import { ProfileCompletenessWidget } from './profile/ProfileCompletenessWidget';

interface ProfileModalProps {
  profile: AppUser;
  isMe: boolean;
  isEditing: boolean;
  user: any;
  onClose: () => void;
  onSave: (updates: any) => Promise<void>;
  onSyncSignal?: () => void;
  isConnected?: boolean;
  handleRelocatePost: (p: Post) => void;
  setRelocatingPost: (p: Post) => void;
  addToast: (m: string, t?: any) => void;
  onLike: (id: string) => void;
  onAddComment: (id: string, c: string) => void;
  setAppUser?: (user: AppUser) => void;
  onMessageClick?: () => void;
  onCallClick?: (u: any) => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function ProfileModal({
  profile,
  isMe,
  isEditing,
  user,
  onClose,
  onSave,
  onSyncSignal,
  isConnected,
  handleRelocatePost,
  setRelocatingPost,
  addToast,
  onLike,
  onAddComment,
  setAppUser,
  onMessageClick,
  onCallClick
}: ProfileModalProps) {
  const [formData, setFormData] = useState({
    name:        profile.name         || '',
    bio:         profile.bio          || '',
    companyName: profile.companyName  || '',
    location:    profile.location     || '',
    website:     profile.website      || '',
    industry:    profile.industry     || '',
    phone:       profile.phone        || '',
    avatar:      profile.avatar       || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=random`,
    coverUrl:    (profile as any).coverUrl  || '',
    experience:  (profile as any).experience || '',
    education:   (profile as any).education  || '',
    cvUrl:       profile.cvUrl || (profile as any).cv_url || '',
    skills:      profile.skills || []
  });

  const [saveStatus, setSaveStatus]   = useState<SaveStatus>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'activity' | 'edit'>(isEditing ? 'edit' : 'activity');
  const [userPosts, setUserPosts]     = useState<any[]>([]);
  const saveTimerRef                  = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef                  = useRef<string>(JSON.stringify(formData));

  // ─── Fetch this user's posts + real-time subscription ───────────────────────
  useEffect(() => {
    const fetchUserPosts = async () => {
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('author_id', profile.id)
        .order('created_at', { ascending: false });

      if (data) setUserPosts(data.map(p => ({
        id: p.id,
        authorId: p.author_id,
        authorName:   profile.name,
        authorAvatar: profile.avatar,
        authorTitle:  profile.role === 'employer' ? 'صاحب عمل' : 'باحث عن عمل',
        content:   p.content,
        imageUrl:  p.image_url,
        videoUrl:  p.video_url,
        timestamp: { toDate: () => new Date(p.created_at) },
        likesCount: p.likes_count
      })));
    };

    fetchUserPosts();

    const channel = supabase
      .channel(`user-posts-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'posts',
        filter: `author_id=eq.${profile.id}`
      }, fetchUserPosts)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile.id, profile.name, profile.avatar, profile.role]);

  // ─── Core auto-save with debounce ───────────────────────────────────────────
  // We use refs to track values and avoid dependency-induced re-creation loops
  const persistToDatabase = useCallback(async (data: typeof formData) => {
    if (!user?.id) return;

    // Skip if nothing actually changed from the last successful save
    const serialised = JSON.stringify(data);
    if (serialised === lastSavedRef.current) {
      console.log("DEBUG: Skipping save, no changes detected.");
      return;
    }

    setSaveStatus('saving');
    try {
      // Perform the database update
      const { error } = await profileService.updateProfile(user.id, data);
      if (error) throw error;

      lastSavedRef.current = serialised;
      setSaveStatus('saved');

      // Sync global AppUser state ONLY if we are editing OUR OWN profile
      if (isMe && setAppUser) {
        // Use a functional update or ensure we don't trigger a recursive loop
        setAppUser({ ...profile, ...data });
      }

      // Notify parent if needed (e.g., to sync other parts of the UI)
      if (onSave) {
        await onSave(data);
      }

      // Return status to idle after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      console.error('Auto-save failed:', err);
      setSaveStatus('error');
      addToast('فشل الحفظ التلقائي: ' + (err.message || ''), 'error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [user?.id, isMe, setAppUser, onSave, addToast]); // Removed 'profile' from deps to stop the loop

  // Debounced field change — fires 800ms after user stops typing
  const handleFieldChange = useCallback((field: string, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    setSaveStatus('saving'); // show "saving" indicator immediately

    // Optimistic global update for instant UI feedback
    if (isMe && setAppUser) {
      setAppUser({ ...profile, ...newData });
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistToDatabase(newData), 800);
  }, [persistToDatabase, isMe, setAppUser, profile, formData]);

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    
    // Validate file type (PDF, DOCX)
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      addToast('يرجى رفع ملف بصيغة PDF أو Word فقط', 'error');
      return;
    }

    setSaveStatus('saving');
    addToast('جاري رفع السيرة الذاتية... ⏳');
    
    try {
      // We use the existing 'profiles' bucket since 'documents' was not found
      const url = await imageService.processAndUpload(file, user.id, 'profiles');
      const newData = { ...formData, cvUrl: url };
      setFormData(newData);
      await persistToDatabase(newData);
      addToast('تم رفع السيرة الذاتية بنجاح ✅');
    } catch (err: any) {
      console.error('CV upload failed:', err);
      addToast(`فشل رفع الملف: ${err.message}`, 'error');
      setSaveStatus('error');
    }
  };

  // Cleanup pending timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setSaveStatus('saving');
    addToast('جاري معالجة ورفع الصورة... ⏳');
    try {
      let url: string;
      try {
        // Use the professional centralized service
        url = await imageService.processAndUpload(file, user.id, 'profiles');
      } catch (err: any) {
        console.error("DEBUG: Upload failed, using fallback:", err);
        url = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        addToast('تم استخدام الرفع البديل بنجاح ✅', 'info');
      }
      const newData = { ...formData, avatar: url };
      setFormData(newData);
      await persistToDatabase(newData);
      addToast('تم تحديث الصورة الشخصية بنجاح ✨');
    } catch (err: any) {
      addToast(`خطأ: ${err.message}`, 'error');
      setSaveStatus('error');
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setSaveStatus('saving');
    addToast('جاري معالجة ورفع الغلاف... ⏳');
    try {
      let url: string;
      try {
        url = await imageService.processAndUpload(file, user.id, 'profiles');
      } catch (err) {
        console.warn("DEBUG: Cover upload fallback:", err);
        url = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }
      const newData = { ...formData, coverUrl: url };
      setFormData(newData);
      await persistToDatabase(newData);
      addToast('تم تحديث الغلاف بنجاح ✨');
    } catch (err: any) {
      addToast(`خطأ: ${err.message}`, 'error');
      setSaveStatus('error');
    }
  };

  // ─── CV download ─────────────────────────────────────────────────────────────
  const handleDownloadCV = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const skillTags = (formData.skills || []).map((s: string) =>
      `<span class="skill">${s}</span>`
    ).join('');
    const cvHtml = `
      <html dir="rtl"><head><title>CV – ${formData.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Cairo', sans-serif; color: #1e293b; line-height: 1.7; padding: 50px; max-width: 820px; margin: auto; background: #fff; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #0a66c2; padding-bottom: 24px; }
        .name { font-size: 34px; font-weight: 900; color: #0a66c2; }
        .meta { font-size: 12px; color: #64748b; margin-top: 6px; }
        .section { margin-bottom: 28px; }
        .section-title { font-size: 14px; font-weight: 900; color: #0a66c2; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.1em; }
        .content { font-size: 13px; white-space: pre-wrap; color: #374151; }
        .skills { display: flex; flex-wrap: wrap; gap: 8px; }
        .skill { background: #eff6ff; color: #1d4ed8; padding: 4px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .footer { margin-top: 60px; text-align: center; font-size: 10px; color: #94a3b8; padding-top: 20px; border-top: 1px solid #f1f5f9; }
      </style></head><body>
      <div class="header">
        <div class="name">${formData.name}</div>
        <div class="meta">${formData.industry || (profile.role === 'employer' ? formData.companyName : 'محترف Elevate عراق')}</div>
        <div class="meta">${[formData.location, formData.website, formData.phone].filter(Boolean).join(' • ')}</div>
      </div>
      ${formData.bio ? `<div class="section"><div class="section-title">النبذة الشخصية</div><div class="content">${formData.bio}</div></div>` : ''}
      ${formData.experience ? `<div class="section"><div class="section-title">الخبرة المهنية</div><div class="content">${formData.experience}</div></div>` : ''}
      ${formData.education ? `<div class="section"><div class="section-title">التعليم والمؤهلات</div><div class="content">${formData.education}</div></div>` : ''}
      ${formData.skills.length ? `<div class="section"><div class="section-title">المهارات</div><div class="skills">${skillTags}</div></div>` : ''}
      <div class="footer">تم إنشاؤه عبر Elevate عراق © ${new Date().getFullYear()}</div>
      <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
      </body></html>`;
    printWindow.document.write(cvHtml);
    printWindow.document.close();
  };

  // ─── Save status indicator ────────────────────────────────────────────────────
  const SaveIndicator = () => {
    const config = {
      idle:   { icon: <CloudUpload size={13} className="text-green-500" />,  text: 'متصل ومحفوظ',      color: 'text-green-600',  dot: 'bg-green-500' },
      saving: { icon: <Loader2 size={13} className="text-amber-500 animate-spin" />, text: 'جاري الحفظ...', color: 'text-amber-600', dot: 'bg-amber-500 animate-pulse' },
      saved:  { icon: <CheckCircle2 size={13} className="text-emerald-500" />, text: 'تم الحفظ ✓',     color: 'text-emerald-600', dot: 'bg-emerald-500' },
      error:  { icon: <AlertCircle size={13} className="text-red-500" />,    text: 'فشل الحفظ!',       color: 'text-red-600',   dot: 'bg-red-500' },
    }[saveStatus];

    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-md rounded-full border border-slate-100 shadow-sm">
        <div className={`w-2 h-2 rounded-full ${config.dot}`} />
        {config.icon}
        <span className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>{config.text}</span>
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-8 bg-slate-900/70 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 50, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 50, opacity: 0 }}
        className="w-full max-w-5xl bg-white rounded-[3.5rem] shadow-[0_48px_96px_-24px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[80vh] md:max-h-[92vh] border border-white relative my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Top-right controls */}
        <div className="absolute top-6 right-8 z-[60] flex items-center gap-3">
          <SaveIndicator />
          <button
            onClick={onClose}
            className="p-3 bg-white/80 backdrop-blur-md hover:bg-white text-slate-400 hover:text-slate-600 rounded-2xl shadow-sm border border-slate-100 transition-all"
          >
            <Plus size={20} className="rotate-45" />
          </button>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 flex flex-col min-w-0 bg-white overflow-y-auto no-scrollbar"
        >
          <div className="mx-auto w-full max-w-4xl mt-0 md:mt-4">
            <ProfileHeader
              formData={formData}
              profile={profile}
              isMe={isMe}
              handleCoverChange={handleCoverChange}
              handleAvatarChange={handleAvatarChange}
              handleFieldChange={handleFieldChange}
              handleDownloadCV={handleDownloadCV}
              setActiveTab={setActiveTab}
              userPostsCount={userPosts.length}
              onMessageClick={onMessageClick}
              onCallClick={() => onCallClick?.(profile)}
            />

            <ProfileTabs activeTab={activeTab} setActiveTab={setActiveTab} isMe={isMe} />
            
            <div className="p-4 md:px-8 md:pt-6">
              {isMe && (activeTab === 'activity' || activeTab === 'edit') && (
                <ProfileCompletenessWidget 
                  profile={{...profile, ...formData}} 
                  onGoToEdit={() => setActiveTab('edit')} 
                />
              )}
            </div>

            <div className="min-h-[600px] p-4 md:p-8 bg-white rounded-b-[3.5rem] overflow-hidden relative">
              <AnimatePresence mode="wait">

                {/* ── Edit tab ── */}
                {activeTab === 'edit' && (
                  <ProfileEditView
                    key="edit"
                    formData={formData}
                    handleFieldChange={handleFieldChange}
                    addToast={addToast}
                    setActiveTab={setActiveTab}
                    saveStatus={saveStatus}
                    handleCVUpload={handleCVUpload}
                    onScrollToTop={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                  />
                )}

                {/* ── Posts tab ── */}
                {activeTab === 'posts' && (
                  <motion.div key="posts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8 pb-24 w-full">
                    {userPosts.length > 0 ? userPosts.map((p, idx) => (
                      <PostTransmissionCard
                        key={p.id} post={p} delay={idx * 0.05} user={user}
                        onUserClick={() => {}}
                        handleRelocatePost={handleRelocatePost}
                        setRelocatingPost={setRelocatingPost}
                        addToast={addToast}
                        onLike={onLike}
                        onAddComment={onAddComment}
                        onDeletePost={(id) => setUserPosts(prev => prev.filter(p => p.id !== id))}
                      />
                    )) : (
                      <div className="py-24 text-center bg-slate-50/50 rounded-[3.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-5 border border-slate-50">
                          <Briefcase className="text-slate-200" size={30} />
                        </div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest max-w-[180px] leading-relaxed">
                          لا توجد منشورات مسجلة لهذا الحساب حالياً
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── Activity tab ── */}
                {activeTab === 'activity' && (
                  <ProfileActivityView key="activity" profile={{ ...profile, ...formData }} />
                )}

              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
