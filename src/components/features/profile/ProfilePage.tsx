import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, ArrowRight, Lock, Send, Loader2, CheckCircle2, AlertCircle, ArrowLeftRight } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { profileService } from '../../../lib/services/profileService';
import { mobileUploadService } from '../../../lib/services/mobileUploadService';
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

  // Dedicated upload indicators for images (never blocks manual save button)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover]   = useState(false);

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


  // 📱 Avatar: Telegram/WhatsApp-style — 0ms Instant Preview + Silent Background Sync
  const handleDirectAvatarUpload = (rawFile: File) => {
    if (!rawFile) return;
    const targetUserId = user?.id || appUser?.id || (profile as any)?.id;
    if (!targetUserId) { addToast('يرجى تسجيل الدخول أولاً لتعديل الصورة', 'error'); return; }

    // ⚡ 1. INSTANT LOCAL PREVIEW (< 1ms) — Shows photo immediately like WhatsApp!
    try {
      const localUrl = URL.createObjectURL(rawFile);
      setFormData(prev => ({ ...prev, avatar: localUrl }));
      if (isMe && setAppUser) setAppUser((prev: any) => prev ? { ...prev, avatar: localUrl } : null);
    } catch (_) {}

    setIsUploadingAvatar(true);

    // 🔄 2. Non-blocking Background Upload — fire & forget (Realtime syncs parent)
    (async () => {
      try {
        const { uploadPromise } = await mobileUploadService.uploadFile(rawFile, 'avatar', targetUserId);
        const permanentUrl = await uploadPromise;
        setFormData(prev => ({ ...prev, avatar: permanentUrl, avatar_url: permanentUrl }));
        if (isMe && setAppUser) setAppUser((prev: any) => prev ? { ...prev, avatar: permanentUrl, avatar_url: permanentUrl } : null);
        await profileService.updateProfile(targetUserId, { avatar: permanentUrl, avatar_url: permanentUrl });
        addToast('✅ تم حفظ وتثبيت صورة الحساب بنجاح!', 'success');
        // NOTE: onSave NOT called here — Supabase Realtime will sync the parent automatically
        // Calling onSave here caused a double-save loop (profile → useEffect → formData reset)
      } catch (err: any) {
        if (err?.message !== 'cancelled') addToast('خطأ في حفظ الصورة: ' + (err.message || ''), 'error');
      } finally {
        setIsUploadingAvatar(false);
      }
    })();
  };

  // ⚠️ MUST be synchronous AND must read file to memory IMMEDIATELY.
  // Android Scoped Storage (10+) gives a ONE-TIME content:// URI permission.
  // After any Promise/await boundary the URI is revoked → files from Files app or Studio fail.
  // Fix: call rawFile.arrayBuffer() synchronously → creates stable in-memory copy.
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.currentTarget?.files?.item(0) ?? e.target?.files?.[0];
    console.log("[avatar change]", {
      filesLength: e.target?.files?.length,
      name: rawFile?.name,
      type: rawFile?.type,
      size: rawFile?.size,
    });
    if (!rawFile) return;
    // Capture metadata before clearing (some browsers null the File after e.target.value = '')
    const meta = { name: rawFile.name || `photo_${Date.now()}.jpg`, type: rawFile.type || 'image/jpeg', lastModified: rawFile.lastModified };
    try { e.target.value = ''; } catch {}
    // 📱 CRITICAL: arrayBuffer() is called synchronously here — the OS file read
    // is initiated while we still hold the one-time Android URI grant.
    rawFile.arrayBuffer()
      .then(buf => {
        const memFile = new File([buf], meta.name, { type: meta.type, lastModified: meta.lastModified });
        (memFile as any).__isSnapshot = true; // tells mobileUploadService to skip re-snapshot
        handleDirectAvatarUpload(memFile);
      })
      .catch(() => handleDirectAvatarUpload(rawFile)); // fallback if arrayBuffer unavailable
  };


  // 📱 Cover: Telegram/WhatsApp-style — 0ms Instant Preview + Silent Background Sync
  const handleDirectCoverUpload = (rawFile: File) => {
    if (!rawFile) return;
    const targetUserId = user?.id || appUser?.id || (profile as any)?.id;
    if (!targetUserId) { addToast('يرجى تسجيل الدخول أولاً لتعديل الغلاف', 'error'); return; }

    // ⚡ 1. INSTANT LOCAL PREVIEW (< 1ms)
    try {
      const localUrl = URL.createObjectURL(rawFile);
      setFormData(prev => ({ ...prev, coverUrl: localUrl, cover_url: localUrl }));
      if (isMe && setAppUser) setAppUser((prev: any) => prev ? { ...prev, coverUrl: localUrl, cover_url: localUrl } : null);
    } catch (_) {}

    setIsUploadingCover(true);

    // 🔄 2. Non-blocking Background Upload — fire & forget (Realtime syncs parent)
    (async () => {
      try {
        const { uploadPromise } = await mobileUploadService.uploadFile(rawFile, 'cover', targetUserId);
        const permanentUrl = await uploadPromise;
        setFormData(prev => ({ ...prev, coverUrl: permanentUrl, cover_url: permanentUrl }));
        if (isMe && setAppUser) setAppUser((prev: any) => prev ? { ...prev, coverUrl: permanentUrl, cover_url: permanentUrl } : null);
        await profileService.updateProfile(targetUserId, { coverUrl: permanentUrl, cover_url: permanentUrl });
        addToast('✅ تم حفظ وتثبيت صورة الغلاف بنجاح!', 'success');
        // NOTE: onSave NOT called here — Supabase Realtime will sync the parent automatically
      } catch (err: any) {
        if (err?.message !== 'cancelled') addToast('خطأ في حفظ صورة الغلاف: ' + (err.message || ''), 'error');
      } finally {
        setIsUploadingCover(false);
      }
    })();
  };

  // ⚠️ Same Android Scoped Storage fix as handleAvatarChange above.
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.currentTarget?.files?.item(0) ?? e.target?.files?.[0];
    console.log("[cover change]", {
      filesLength: e.target?.files?.length,
      name: rawFile?.name,
      type: rawFile?.type,
      size: rawFile?.size,
    });
    if (!rawFile) return;
    const meta = { name: rawFile.name || `cover_${Date.now()}.jpg`, type: rawFile.type || 'image/jpeg', lastModified: rawFile.lastModified };
    try { e.target.value = ''; } catch {}
    rawFile.arrayBuffer()
      .then(buf => {
        const memFile = new File([buf], meta.name, { type: meta.type, lastModified: meta.lastModified });
        (memFile as any).__isSnapshot = true;
        handleDirectCoverUpload(memFile);
      })
      .catch(() => handleDirectCoverUpload(rawFile));
  };

  

  const handleManualSave = useCallback(async () => {
    const targetUserId = user?.id || appUser?.id || profile?.id || formData?.id;
    if (!targetUserId) {
      addToast('يرجى تسجيل الدخول أولاً لحفظ التعديلات', 'error');
      return;
    }
    setSaveStatus('saving');
    try {
      let updatedFormData = { ...formData };

      // Upload pending CV (always replaces existing one)
      if (pendingCV) {
        if (updatedFormData.cvUrl) {
          await cvService.deleteCV(updatedFormData.cvUrl);
        }
        const { data: url, error: uploadErr } = await cvService.uploadCV(targetUserId, pendingCV, {
          name: user?.name || appUser?.name || profile?.name,
          email: user?.email || appUser?.email || profile?.email,
        });
        if (uploadErr || !url) throw uploadErr || new Error('فشل رفع ملف السيرة الذاتية');

        updatedFormData = { ...updatedFormData, cvUrl: url, cv_url: url };
        setPendingCV(null);
        setPendingCVName(null);
      }

      setFormData(updatedFormData);

      const { id: _ignoredId, ...cleanUpdates } = updatedFormData;
      const { error } = await profileService.updateProfile(targetUserId, {
        ...cleanUpdates,
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
  }, [user?.id, appUser?.id, profile?.id, isMe, setAppUser, onSave, addToast, profile, formData, pendingCV]);

  const handleFieldChange = useCallback(async (field: string, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);

    const targetUserId = user?.id || appUser?.id || profile?.id || formData?.id;
    // If changing 'open_to' (status), persist immediately to database and global context
    if (field === 'open_to' && targetUserId) {
      setSaveStatus('saving');
      try {
        await profileService.updateProfile(targetUserId, { open_to: value });
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
  }, [formData, user?.id, appUser?.id, profile?.id, isMe, setAppUser, onSave, addToast]);


  // 📱 CV: same Android Scoped Storage fix — read file to memory IMMEDIATELY
  const handleCVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.currentTarget?.files?.item(0) ?? e.target?.files?.[0];
    if (!rawFile) return;

    if (rawFile.size > 25 * 1024 * 1024) {
      addToast('حجم الملف يتجاوز الحد الأقصى (25 ميغابايت)', 'error');
      try { e.target.value = ''; } catch {}
      return;
    }

    const targetUserId = user?.id || appUser?.id || profile?.id || formData?.id;
    if (!targetUserId) { addToast('يجب تسجيل الدخول لرفع السيرة الذاتية', 'error'); return; }

    const meta = {
      name: rawFile.name || `cv_${Date.now()}.pdf`,
      type: rawFile.type || 'application/pdf',
      lastModified: rawFile.lastModified,
      size: rawFile.size,
    };
    try { e.target.value = ''; } catch {}

    const fileSizeMB = (meta.size / (1024 * 1024)).toFixed(1);
    setPendingCVName(meta.name + ' (' + fileSizeMB + ' MB)');
    addToast('📄 جاري رفع "' + meta.name + '" في الخلفية...');

    // CRITICAL: read to memory immediately while Android URI grant is valid
    rawFile.arrayBuffer()
      .then(buf => {
        const memFile = new File([buf], meta.name, { type: meta.type, lastModified: meta.lastModified });
        (memFile as any).__isSnapshot = true;
        // Non-blocking background upload (Telegram style)
        (async () => {
          try {
            const { uploadPromise } = await mobileUploadService.uploadFile(memFile, 'cv', targetUserId, {
              userContext: {
                name: user?.name || appUser?.name || profile?.name,
                email: user?.email || appUser?.email || profile?.email,
              },
            });
            const url = await uploadPromise;
            setFormData(prev => ({ ...prev, cvUrl: url, cv_url: url }));
            setPendingCV(null);
            setPendingCVName(null);
            const { error: dbError } = await profileService.updateProfile(targetUserId, { cvUrl: url, cv_url: url });
            if (dbError) {
              addToast('تم رفع الملف بنجاح مع تنبيه أثناء الحفظ.', 'warning');
            } else {
              addToast('✅ تم رفع وتثبيت السيرة الذاتية بنجاح! 🎉', 'success');
            }
            if (isMe && setAppUser) setAppUser((prev: any) => prev ? { ...prev, cvUrl: url, cv_url: url } : null);
          } catch (err: any) {
            setPendingCVName(null);
            if (err?.message !== 'cancelled') addToast('خطأ في رفع السيرة الذاتية: ' + (err.message || ''), 'error');
          }
        })();
      })
      .catch(() => {
        // Fallback: use raw file directly (no URI expiry risk for this case)
        setPendingCVName(null);
        addToast('تعذر قراءة الملف من هذا المصدر. حاول بطريقة أخرى.', 'error');
      });
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
        isUploadingAvatar={isUploadingAvatar}
        isUploadingCover={isUploadingCover}
        onDirectAvatarPick={handleDirectAvatarUpload}
        onDirectCoverPick={handleDirectCoverUpload}
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
