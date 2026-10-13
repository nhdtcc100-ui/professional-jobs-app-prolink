import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, ArrowRight, Lock, Send, Loader2, CheckCircle2, AlertCircle, ArrowLeftRight } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { profileService } from '../../../lib/services/profileService';
import { imageService } from '../../../lib/services/imageService';
import { cvService } from '../../../lib/services/cvService';
import { PostTransmissionCard } from '../index';
import { AppUser, Post } from '../../../types';
import { ProfileHeader, ProfileTabs, ProfileEditView, ProfileActivityView } from './index';
import { ProfileCompletenessWidget } from './ProfileCompletenessWidget';
import { useAppContext } from '../../../contexts/AppContext';

interface ProfilePageProps {
  profile: AppUser;
  isMe: boolean;
  isEditing?: boolean;
  user: any;
  onBack?: () => void;
  onSave?: (updates: any) => Promise<void>;
  onSyncSignal?: () => void;
  isConnected?: boolean;
  handleRelocatePost: (p: Post) => void;
  setRelocatingPost: (p: Post) => void;
  addToast: (m: string, t?: any) => void;
  onLike: (id: string) => void;
  onDislike?: (id: string) => void;
  onAddComment: (id: string, c: string) => void;
  setAppUser?: (user: any) => void;
  onMessageClick?: () => void;
  onCallClick?: (u: any) => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function ProfilePage({
  profile,
  isMe,
  isEditing,
  user,
  onBack,
  onSave,
  handleRelocatePost,
  setRelocatingPost,
  addToast,
  onLike,
  onDislike,
  onAddComment,
  setAppUser,
  onMessageClick,
  onCallClick
}: ProfilePageProps) {
  const { appUser, posts } = useAppContext();
  const [formData, setFormData] = useState({
    id:          profile.id           || '',
    name:        profile.name         || '',
    bio:         profile.bio          || '',
    companyName: profile.companyName  || '',
    location:    profile.location     || '',
    website:     profile.website      || '',
    industry:    profile.title || (profile as any).industry || '',
    title:       profile.title || (profile as any).industry || '',
    phone:       profile.phone        || '',
    avatar:      profile.avatar       || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=random`,
    coverUrl:    (profile as any).coverUrl  || '',
    experience:  (profile as any).experience || '',
    education:   (profile as any).education  || '',
    cvUrl:       profile.cvUrl || (profile as any).cv_url || '',
    cv_url:      profile.cvUrl || (profile as any).cv_url || '',
    skills:      profile.skills || [],
    open_to:     (profile as any).open_to || 'none',
    role:        profile.role || 'seeker',
  });

  // Pending CV: selected locally but NOT uploaded yet — committed on Save
  const [pendingCV, setPendingCV]             = useState<File | null>(null);
  const [pendingCVName, setPendingCVName]     = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [activeTab, setActiveTab] = useState<'posts' | 'activity' | 'edit'>(isEditing ? 'edit' : 'activity');
  const [userPosts, setUserPosts]   = useState<any[]>(() => {
    try {
      const targetId = profile.id || '';
      if (!targetId) return [];
      const cached = localStorage.getItem(`prolink_cached_posts_${targetId}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [postsLoading, setPostsLoading] = useState(false);
  const saveTimerRef                = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef                = useRef<string>(JSON.stringify(formData));


  const fetchUserPosts = useCallback(async () => {
    const targetId = profile.id || appUser?.id || user?.id;
    if (!targetId) {
      console.warn('[ProfilePage] fetchUserPosts: profile.id is missing, skipping fetch');
      return;
    }
    setPostsLoading(true);
    try {
      console.log('[ProfilePage] Fetching posts for targetId =', targetId);
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('author_id', targetId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ProfilePage] Error fetching posts from DB:', error);
      }

      let dbPosts: any[] = [];
      if (data && data.length > 0) {
        dbPosts = (data as any[]).map((p: any) => ({
          id: p.id,
          authorId: p.author_id || targetId,
          author_id: p.author_id || targetId,
          authorName:   p.author_name || profile.name || appUser?.name || 'مستخدم',
          authorAvatar: p.author_avatar || profile.avatar || (profile as any).avatar_url || appUser?.avatar,
          authorTitle:  p.author_title || (profile.role === 'employer' ? 'صاحب عمل' : 'باحث عن عمل'),
          content:   p.content,
          imageUrl:  p.image_url,
          videoUrl:  p.video_url,
          created_at: p.created_at,
          timestamp: p.created_at ? { toDate: () => new Date(p.created_at) } : { toDate: () => new Date() },
          likesCount:    p.likes_count    || 0,
          commentsCount: p.comments_count || 0,
          dislikesCount: p.dislikes_count || 0,
        }));
      }

      // دمج منشورات الـ AppContext (مثل المنشورات المنشورة تواً)
      const matchingContext = (posts || []).filter((p: any) =>
        p.authorId === targetId || p.author_id === targetId
      );

      const postMap = new Map<string, any>();
      dbPosts.forEach(p => postMap.set(p.id, p));
      matchingContext.forEach((p: any) => {
        if (!postMap.has(p.id)) {
          postMap.set(p.id, {
            ...p,
            authorId: p.authorId || targetId,
            authorName: p.authorName || profile.name || appUser?.name,
            authorAvatar: p.authorAvatar || profile.avatar,
            authorTitle: p.authorTitle || (profile.role === 'employer' ? 'صاحب عمل' : 'باحث عن عمل')
          });
        }
      });

      const finalPosts = Array.from(postMap.values());
      setUserPosts(finalPosts);

      try {
        localStorage.setItem(`prolink_cached_posts_${targetId}`, JSON.stringify(finalPosts.slice(0, 50)));
      } catch {}
    } catch (err) {
      console.error('[ProfilePage] Exception in fetchUserPosts:', err);
      const fallback = (posts || []).filter((p: any) => p.authorId === targetId || p.author_id === targetId);
      if (fallback.length > 0) {
        setUserPosts(fallback);
      }
    } finally {
      setPostsLoading(false);
    }
  }, [profile.id, profile.name, profile.avatar, profile.role, appUser?.id, user?.id, posts]);

  useEffect(() => {
    fetchUserPosts();

    const channel = supabase
      .channel(`user-posts-page-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'posts',
        filter: `author_id=eq.${profile.id}`
      }, fetchUserPosts)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchUserPosts]);

  // Refresh posts when user switches to the posts tab
  useEffect(() => {
    if (activeTab === 'posts') {
      fetchUserPosts();
    }
  }, [activeTab, fetchUserPosts]);

  // Keep formData synchronized whenever the profile prop changes
  useEffect(() => {
    setFormData({
      id:          profile.id           || '',
      name:        profile.name         || '',
      bio:         profile.bio          || '',
      companyName: profile.companyName  || '',
      location:    profile.location     || '',
      website:     profile.website      || '',
      industry:    profile.title || (profile as any).industry || '',
      title:       profile.title || (profile as any).industry || '',
      phone:       profile.phone        || '',
      avatar:      profile.avatar || (profile as any).avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'U')}&background=random`,
      coverUrl:    (profile as any).coverUrl || (profile as any).cover_url || '',
      experience:  (profile as any).experience || '',
      education:   (profile as any).education  || '',
      cvUrl:       profile.cvUrl || (profile as any).cv_url || '',
      cv_url:      profile.cvUrl || (profile as any).cv_url || '',
      skills:      profile.skills || [],
      open_to:     (profile as any).open_to || 'none',
      role:        profile.role || 'seeker',
    });
  }, [profile]);

  // ── Avatar: Instant Direct Upload & Database Persistence ──
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetInput = e.target;
    if (!file) {
      console.warn("⚠️ [AvatarUpload] لم يتم اختيار أي ملف من المتصفح.");
      return;
    }
    const targetUserId = user?.id || appUser?.id;
    if (!targetUserId) {
      console.error("❌ [AvatarUpload] فشل التبديل: تعذر العثور على معرّف المستخدم (User ID is missing).");
      addToast('تعذر تحديد حساب المستخدم لتحديث الصورة', 'error');
      return;
    }

    console.log("📸 [AvatarUpload] تم استلام ملف الصورة:", {
      name: file.name,
      size: file.size,
      type: file.type,
      userId: targetUserId
    });

    try {
      const { inspectUploadedFile } = await import('../../../lib/security/fileInspector');
      const check = await inspectUploadedFile(file, user || appUser, '/profile/avatar-upload');
      if (!check.safe) {
        console.error("❌ [AvatarUpload] فشل الفحص الأمني للصورة:", check);
        addToast(check.error || 'تم حظر الصورة لدواعي أمنية', 'error');
        return;
      }
    } catch (secErr) {
      console.warn("⚠️ [AvatarUpload] تنبيه أثناء فحص الأمان:", secErr);
    }

    // Instant local preview for immediate visual feedback
    const localUrl = URL.createObjectURL(file);
    setFormData(prev => ({ ...prev, avatar: localUrl }));
    setSaveStatus('saving');
    addToast('جاري رفع وتثبيت الصورة الشخصية... ⏳');

    try {
      console.log("⏳ [AvatarUpload] جاري الرفع إلى Storage ومعالجة الصورة...");
      const permanentUrl = await imageService.processAndUpload(file, targetUserId, 'profiles');
      console.log("✅ [AvatarUpload] تم رفع الصورة بنجاح إلى Storage، الرابط:", permanentUrl);

      setFormData(prev => ({ ...prev, avatar: permanentUrl, avatar_url: permanentUrl }));

      const { error } = await profileService.updateProfile(targetUserId, {
        avatar: permanentUrl,
        avatar_url: permanentUrl
      });
      if (error) {
        console.error("❌ [AvatarUpload] فشل تحديث قاعدة البيانات:", error);
        throw error;
      }

      console.log("✅ [AvatarUpload] تم استبدال وتثبيت الصورة الشخصية بنجاح تام في قاعدة البيانات والملف الشخصي! 🎉");

      if (isMe && setAppUser) {
        setAppUser((prev: any) => prev ? { ...prev, avatar: permanentUrl, avatar_url: permanentUrl } : null);
      }
      if (onSave) {
        await onSave({ avatar: permanentUrl, avatar_url: permanentUrl });
      }

      setSaveStatus('saved');
      addToast('تم حفظ وتثبيت الصورة الشخصية بنجاح! 📸', 'success');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      console.error("❌ [AvatarUpload] لم يتم التبديل - حدث خطأ:", err);
      setSaveStatus('error');
      addToast('فشل رفع الصورة: ' + (err.message || ''), 'error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      if (targetInput) targetInput.value = '';
    }
  };

  // ── Cover: Instant Direct Upload & Database Persistence ──
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetInput = e.target;
    if (!file) {
      console.warn("⚠️ [CoverUpload] لم يتم اختيار أي ملف غلاف من المتصفح.");
      return;
    }
    const targetUserId = user?.id || appUser?.id;
    if (!targetUserId) {
      console.error("❌ [CoverUpload] فشل التبديل: تعذر العثور على معرّف المستخدم (User ID is missing).");
      addToast('تعذر تحديد حساب المستخدم لتحديث الغلاف', 'error');
      return;
    }

    console.log("🖼️ [CoverUpload] تم استلام ملف صورة الغلاف:", {
      name: file.name,
      size: file.size,
      type: file.type,
      userId: targetUserId
    });

    try {
      const { inspectUploadedFile } = await import('../../../lib/security/fileInspector');
      const check = await inspectUploadedFile(file, user || appUser, '/profile/cover-upload');
      if (!check.safe) {
        console.error("❌ [CoverUpload] فشل الفحص الأمني لصورة الغلاف:", check);
        addToast(check.error || 'تم حظر صورة الغلاف لدواعي أمنية', 'error');
        return;
      }
    } catch (secErr) {
      console.warn("⚠️ [CoverUpload] تنبيه أثناء فحص الأمان:", secErr);
    }

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    setFormData(prev => ({ ...prev, coverUrl: localUrl }));
    setSaveStatus('saving');
    addToast('جاري رفع وتثبيت صورة الغلاف... ⏳');

    try {
      console.log("⏳ [CoverUpload] جاري الرفع إلى Storage ومعالجة صورة الغلاف...");
      const permanentUrl = await imageService.processAndUpload(file, targetUserId, 'profiles');
      console.log("✅ [CoverUpload] تم رفع صورة الغلاف بنجاح إلى Storage، الرابط:", permanentUrl);

      setFormData(prev => ({ ...prev, coverUrl: permanentUrl, cover_url: permanentUrl }));

      const { error } = await profileService.updateProfile(targetUserId, {
        coverUrl: permanentUrl,
        cover_url: permanentUrl
      });
      if (error) {
        console.error("❌ [CoverUpload] فشل تحديث الغلاف في قاعدة البيانات:", error);
        throw error;
      }

      console.log("✅ [CoverUpload] تم استبدال وتثبيت صورة الغلاف بنجاح تام في قاعدة البيانات! 🎉");

      if (isMe && setAppUser) {
        setAppUser((prev: any) => prev ? { ...prev, coverUrl: permanentUrl, cover_url: permanentUrl } : null);
      }
      if (onSave) {
        await onSave({ coverUrl: permanentUrl, cover_url: permanentUrl });
      }

      setSaveStatus('saved');
      addToast('تم حفظ وتثبيت صورة الغلاف بنجاح! 🖼️', 'success');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      console.error("❌ [CoverUpload] لم يتم التبديل - حدث خطأ:", err);
      setSaveStatus('error');
      addToast('فشل رفع الغلاف: ' + (err.message || ''), 'error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      if (targetInput) targetInput.value = '';
    }
  };

  const handleManualSave = useCallback(async () => {
    if (!user?.id) return;
    setSaveStatus('saving');
    try {
      let updatedFormData = { ...formData };

      // Upload pending CV (always replaces existing one)
      if (pendingCV) {
        if (updatedFormData.cvUrl) {
          try {
            const oldPath = updatedFormData.cvUrl.split('/profiles/').pop();
            if (oldPath) await (supabase.storage.from('profiles') as any).remove([oldPath]);
          } catch { /* ignore delete error */ }
        }
        const url = await imageService.processAndUpload(pendingCV, user.id, 'profiles');
        updatedFormData = { ...updatedFormData, cvUrl: url };
        setPendingCV(null);
        setPendingCVName(null);
      }

      setFormData(updatedFormData);

      const { error } = await profileService.updateProfile(user.id, {
        ...updatedFormData,
        // Sync both field names so DB always has both updated
        title: updatedFormData.industry || updatedFormData.title || '',
        industry: updatedFormData.industry || updatedFormData.title || '',
      });
      if (error) throw error;

      lastSavedRef.current = JSON.stringify(updatedFormData);
      setSaveStatus('saved');
      addToast('تم حفظ جميع التعديلات بنجاح! 💾', 'success');

      if (isMe && setAppUser) {
        setAppUser({ ...profile, ...updatedFormData });
      }

      if (onSave) {
        await onSave(updatedFormData);
      }

      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      setSaveStatus('error');
      addToast('فشل الحفظ: ' + (err.message || ''), 'error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [user?.id, isMe, setAppUser, onSave, addToast, profile, formData, pendingCV]);

  const handleFieldChange = useCallback(async (field: string, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);

    // If changing 'open_to' (status), persist immediately to database and global context
    if (field === 'open_to' && user?.id) {
      setSaveStatus('saving');
      try {
        await profileService.updateProfile(user.id, { open_to: value });
        if (isMe && setAppUser) {
          setAppUser((prev: any) => prev ? { ...prev, open_to: value } : null);
        }
        if (onSave) await onSave({ open_to: value });
        setSaveStatus('saved');
        addToast('تم تحديث حالة التوفر وحفظها مباشرة! ✨', 'success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err: any) {
        setSaveStatus('error');
        addToast('فشل حفظ حالة التوفر: ' + (err.message || ''), 'error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } else {
      setSaveStatus('idle');
    }
  }, [formData, user?.id, isMe, setAppUser, onSave, addToast]);

  // ── CV: Instant Direct Upload & Database Persistence ──
  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setSaveStatus('saving');
    addToast('جاري رفع وتثبيت السيرة الذاتية... ⏳');

    try {
      // Remove old CV if exists
      if (formData.cvUrl) {
        await cvService.deleteCV(formData.cvUrl);
      }

      const { data: url, error: uploadErr } = await cvService.uploadCV(user.id, file, {
        name: user.name,
        email: user.email,
      });

      if (uploadErr || !url) {
        throw uploadErr || new Error('فشل رفع ملف السيرة الذاتية');
      }

      const updatedData = { ...formData, cvUrl: url, cv_url: url };
      setFormData(updatedData);

      const { error } = await profileService.updateProfile(user.id, {
        cvUrl: url,
        cv_url: url
      });
      if (error) throw error;

      if (isMe && setAppUser) {
        setAppUser((prev: any) => prev ? { ...prev, cvUrl: url, cv_url: url } : null);
      }
      if (onSave) {
        await onSave({ cvUrl: url, cv_url: url });
      }

      setPendingCV(null);
      setPendingCVName(null);
      setSaveStatus('saved');
      addToast('تم رفع وتثبيت السيرة الذاتية بنجاح! 📄', 'success');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      setSaveStatus('error');
      addToast('فشل رفع السيرة الذاتية: ' + (err.message || ''), 'error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleDownloadCV = () => {
    if (formData.cvUrl) {
      window.open(formData.cvUrl, '_blank');
    } else {
      addToast('لم يتم رفع سيرة ذاتية بعد', 'error');
    }
  };


  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-28 pt-0 md:pt-4" dir="rtl">
      
      {/* Back button header if requested */}
      {onBack && (
        <div className="flex items-center justify-between px-2 py-1">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black hover:bg-slate-50 transition-all border border-slate-100 dark:border-slate-700 shadow-sm"
          >
            <ArrowRight size={14} />
            العودة للرئيسية
          </button>
          <p className="text-xs font-black text-slate-400">الملف الشخصي</p>
        </div>
      )}

      {/* Main Profile Header */}
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
        showCallButton={!!appUser?.isAdmin}
      />

      {/* Profile Tabs */}
      <ProfileTabs activeTab={activeTab} setActiveTab={setActiveTab} isMe={isMe} />

      {/* Profile Completeness Widget */}
      {isMe && (activeTab === 'activity' || activeTab === 'edit') && (
        <ProfileCompletenessWidget
          profile={{ ...profile, ...formData }}
          onGoToEdit={() => setActiveTab('edit')}
        />
      )}

      {/* Tab Content Container */}
      <div className="min-h-[500px] p-4 md:p-8 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
        <AnimatePresence mode="wait">
          
          {/* Edit View */}
          {activeTab === 'edit' && (
            <ProfileEditView
              key="edit"
              formData={formData}
              handleFieldChange={handleFieldChange}
              addToast={addToast}
              setActiveTab={setActiveTab}
              saveStatus={saveStatus}
              handleCVUpload={handleCVUpload}
              handleAvatarChange={handleAvatarChange}
              handleCoverChange={handleCoverChange}
              handleSave={handleManualSave}
              onScrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              pendingCVName={pendingCVName}
            />
          )}

          {/* Posts View */}
          {activeTab === 'posts' && (
            <motion.div key="posts" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 pb-12 w-full">
              {postsLoading ? (
                <div className="py-20 text-center flex flex-col items-center gap-3">
                  <Loader2 size={28} className="text-blue-400 animate-spin" />
                  <p className="text-xs text-slate-400 font-black">جاري تحميل المنشورات...</p>
                </div>
              ) : userPosts.length > 0 ? (
                userPosts.map((p, idx) => (
                  <PostTransmissionCard
                    key={p.id}
                    post={p}
                    delay={idx * 0.05}
                    user={user}
                    onUserClick={() => {}}
                    handleRelocatePost={handleRelocatePost}
                    setRelocatingPost={setRelocatingPost}
                    addToast={addToast}
                    onLike={onLike}
                    onDislike={onDislike}
                    onAddComment={onAddComment}
                    onDeletePost={(id) => setUserPosts(prev => prev.filter(item => item.id !== id))}
                  />
                ))
              ) : (
                <div className="py-20 text-center bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-700 flex flex-col items-center gap-3">
                  <Briefcase className="text-slate-300" size={32} />
                  <p className="text-xs text-slate-400 font-black">لا توجد منشورات مسجلة لهذا الحساب حالياً</p>
                  <button
                    onClick={fetchUserPosts}
                    className="px-4 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl text-[11px] font-black hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all cursor-pointer"
                  >
                    تحديث المنشورات
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Activity View */}
          {activeTab === 'activity' && (
            <ProfileActivityView key="activity" profile={{ ...profile, ...formData }} />
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
