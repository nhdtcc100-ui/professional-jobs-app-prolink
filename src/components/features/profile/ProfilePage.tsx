import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, ArrowRight, Lock, Send, Loader2, CheckCircle2, AlertCircle, ArrowLeftRight } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { profileService } from '../../../lib/services/profileService';
import { imageService, snapshotFile } from '../../../lib/services/imageService';
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

// Helper to convert any image or document file to compact Base64 (<100KB for DB)
async function fileToCompactBase64(file: File, maxDim = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      if (!res) {
        resolve('');
        return;
      }
      if (!res.startsWith('data:image/')) {
        resolve(res);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width || maxDim;
          let h = img.naturalHeight || img.height || maxDim;
          if (w > h && w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
            return;
          }
        } catch {
          // fall through
        }
        resolve(res);
      };
      img.onerror = () => resolve(res);
      img.src = res;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

// Helper to open or download CV cleanly across mobile and desktop
export function downloadOrOpenCV(cvUrl: string, fileName = 'السيرة_الذاتية.pdf') {
  if (!cvUrl) return;
  if (cvUrl.startsWith('data:')) {
    try {
      const arr = cvUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 2000);
      return;
    } catch (e) {
      console.warn('Failed to download blob:', e);
    }
  }
  window.open(cvUrl, '_blank', 'noopener,noreferrer');
}

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

  // ── Avatar: Instant Direct Upload & Guaranteed Database Persistence ──
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawFile = e.target.files?.[0];
    const targetInput = e.target;
    if (!rawFile) {
      await new Promise(r => setTimeout(r, 120));
      rawFile = targetInput?.files?.[0];
    }
    if (!rawFile) return;

    const targetUserId = user?.id || appUser?.id || (profile as any)?.id;
    if (!targetUserId) {
      addToast('تعذر تحديد حساب المستخدم لتحديث الصورة', 'error');
      return;
    }

    setIsUploadingAvatar(true);

    let file: File;
    try {
      file = await snapshotFile(rawFile);
    } catch (readErr: any) {
      console.error("❌ [AvatarUpload] فشل قراءة الملف من الجهاز:", readErr);
      addToast('تعذر قراءة الصورة من ذاكرة الجهاز، يرجى إعادة المحاولة', 'error');
      setIsUploadingAvatar(false);
      if (targetInput) targetInput.value = '';
      return;
    }

    // Instant local preview
    try {
      const localUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, avatar: localUrl }));
    } catch (previewErr) {
      console.warn("⚠️ [AvatarUpload] تعذر إنشاء معاينة محلية:", previewErr);
    }

    let permanentUrl = '';
    try {
      // 1. Try uploading to Storage with 6s timeout; if fails or takes long, immediately fallback to compact Base64
      try {
        const uploadTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Storage timeout (6s)')), 6000)
        );
        permanentUrl = await Promise.race([
          imageService.processAndUpload(file, targetUserId, 'profiles'),
          uploadTimeout
        ]);
      } catch (storageErr) {
        console.warn("⚠️ [AvatarUpload] التخزين السحابي تعثر/تأخر، جاري الحفظ المباشر في قاعدة البيانات (Base64):", storageErr);
        permanentUrl = await fileToCompactBase64(file, 400, 0.70);
      }

      if (!permanentUrl) {
        permanentUrl = await fileToCompactBase64(file, 400, 0.70);
      }

      // 2. FORCIBLY SAVE TO SUPABASE DATABASE
      await supabase.from('profiles').update({ avatar_url: permanentUrl }).eq('id', targetUserId);
      await profileService.updateProfile(targetUserId, {
        avatar: permanentUrl,
        avatar_url: permanentUrl
      });

      // 3. Update React State & AppContext
      setFormData(prev => ({ ...prev, avatar: permanentUrl, avatar_url: permanentUrl }));
      if (isMe && setAppUser) {
        setAppUser((prev: any) => prev ? { ...prev, avatar: permanentUrl, avatar_url: permanentUrl } : null);
      }
      if (onSave) {
        await onSave({ avatar: permanentUrl, avatar_url: permanentUrl });
      }

      try {
        localStorage.setItem(`prolink_avatar_${targetUserId}`, permanentUrl);
      } catch (_) {}

      addToast('تم حفظ وتثبيت الصورة الشخصية في قاعدة البيانات بنجاح! 📸', 'success');
    } catch (err: any) {
      console.error("❌ [AvatarUpload] خطأ، جاري الحفظ الإجباري:", err);
      try {
        const b64 = await fileToCompactBase64(file, 400, 0.70);
        await supabase.from('profiles').update({ avatar_url: b64 }).eq('id', targetUserId);
        setFormData(prev => ({ ...prev, avatar: b64, avatar_url: b64 }));
        if (isMe && setAppUser) {
          setAppUser((prev: any) => prev ? { ...prev, avatar: b64, avatar_url: b64 } : null);
        }
        addToast('تم حفظ وتثبيت الصورة الشخصية بنجاح! 📸', 'success');
      } catch (fallbackErr: any) {
        addToast('تعذر حفظ الصورة: ' + (fallbackErr.message || ''), 'error');
      }
    } finally {
      setIsUploadingAvatar(false);
      if (targetInput) targetInput.value = '';
    }
  };

  // ── Cover: Instant Direct Upload & Guaranteed Database Persistence ──
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawFile = e.target.files?.[0];
    const targetInput = e.target;
    if (!rawFile) {
      await new Promise(r => setTimeout(r, 120));
      rawFile = targetInput?.files?.[0];
    }
    if (!rawFile) return;

    const targetUserId = user?.id || appUser?.id || (profile as any)?.id;
    if (!targetUserId) {
      addToast('تعذر تحديد حساب المستخدم لتحديث الغلاف', 'error');
      return;
    }

    setIsUploadingCover(true);

    let file: File;
    try {
      file = await snapshotFile(rawFile);
    } catch (readErr: any) {
      console.error("❌ [CoverUpload] فشل قراءة الملف من الجهاز:", readErr);
      addToast('تعذر قراءة صورة الغلاف من ذاكرة الجهاز، يرجى إعادة المحاولة', 'error');
      setIsUploadingCover(false);
      if (targetInput) targetInput.value = '';
      return;
    }

    // Instant local preview
    try {
      const localUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, coverUrl: localUrl, cover_url: localUrl }));
    } catch (previewErr) {
      console.warn("⚠️ [CoverUpload] تعذر إنشاء معاينة محلية للغلاف:", previewErr);
    }

    let permanentUrl = '';
    try {
      // 1. Try uploading to Storage with 6s timeout; if fails or takes long, immediately fallback to compact Base64
      try {
        const uploadTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Storage timeout (6s)')), 6000)
        );
        permanentUrl = await Promise.race([
          imageService.processAndUpload(file, targetUserId, 'profiles'),
          uploadTimeout
        ]);
      } catch (storageErr) {
        console.warn("⚠️ [CoverUpload] التخزين السحابي تعثر/تأخر، جاري الحفظ المباشر في قاعدة البيانات (Base64):", storageErr);
        permanentUrl = await fileToCompactBase64(file, 800, 0.70);
      }

      if (!permanentUrl) {
        permanentUrl = await fileToCompactBase64(file, 800, 0.70);
      }

      // 2. FORCIBLY SAVE TO SUPABASE DATABASE
      await supabase.from('profiles').update({ cover_url: permanentUrl }).eq('id', targetUserId);
      await profileService.updateProfile(targetUserId, {
        coverUrl: permanentUrl,
        cover_url: permanentUrl
      });

      // 3. Update React State & AppContext
      setFormData(prev => ({ ...prev, coverUrl: permanentUrl, cover_url: permanentUrl }));
      if (isMe && setAppUser) {
        setAppUser((prev: any) => prev ? { ...prev, coverUrl: permanentUrl, cover_url: permanentUrl } : null);
      }
      if (onSave) {
        await onSave({ coverUrl: permanentUrl, cover_url: permanentUrl });
      }

      try {
        localStorage.setItem(`prolink_cover_${targetUserId}`, permanentUrl);
      } catch (_) {}

      addToast('تم حفظ وتثبيت صورة الغلاف في قاعدة البيانات بنجاح! 🖼️', 'success');
    } catch (err: any) {
      console.error("❌ [CoverUpload] خطأ، جاري الحفظ الإجباري:", err);
      try {
        const b64 = await fileToCompactBase64(file, 800, 0.70);
        await supabase.from('profiles').update({ cover_url: b64 }).eq('id', targetUserId);
        setFormData(prev => ({ ...prev, coverUrl: b64, cover_url: b64 }));
        if (isMe && setAppUser) {
          setAppUser((prev: any) => prev ? { ...prev, coverUrl: b64, cover_url: b64 } : null);
        }
        addToast('تم حفظ وتثبيت صورة الغلاف بنجاح! 🖼️', 'success');
      } catch (fallbackErr: any) {
        addToast('تعذر حفظ صورة الغلاف: ' + (fallbackErr.message || ''), 'error');
      }
    } finally {
      setIsUploadingCover(false);
      if (targetInput) targetInput.value = '';
    }
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

      const { error } = await profileService.updateProfile(targetUserId, {
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

  // ── CV: Instant Direct Upload & Guaranteed Database Persistence ──
  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawFile = e.target.files?.[0];
    const targetInput = e.target;
    if (!rawFile) {
      await new Promise(r => setTimeout(r, 120));
      rawFile = targetInput?.files?.[0];
    }
    if (!rawFile) return;

    const targetUserId = user?.id || appUser?.id || (profile as any)?.id;
    if (!targetUserId) {
      addToast('تعذر تحديد حساب المستخدم لتحديث السيرة الذاتية', 'error');
      if (targetInput) targetInput.value = '';
      return;
    }

    if (rawFile.size > 25 * 1024 * 1024) {
      addToast('حجم ملف السيرة الذاتية كبير جداً (أقصى حد 25 ميجابايت)', 'error');
      if (targetInput) targetInput.value = '';
      return;
    }

    let file: File;
    try {
      file = await snapshotFile(rawFile);
    } catch (readErr: any) {
      console.error("❌ [CVUpload] فشل قراءة الملف من الجهاز:", readErr);
      addToast('تعذر قراءة ملف السيرة الذاتية من جهازك', 'error');
      if (targetInput) targetInput.value = '';
      return;
    }

    setPendingCVName(file.name);
    addToast(`جاري حفظ "${file.name}" وتثبيتها في قاعدة البيانات... 📄`, 'info');

    try {
      let finalUrl = '';
      try {
        const { data: uploadedUrl } = await cvService.uploadCV(targetUserId, file, {
          name: user?.name || appUser?.name || profile?.name,
          email: user?.email || appUser?.email || profile?.email,
        });
        if (uploadedUrl) finalUrl = uploadedUrl;
      } catch (uploadErr) {
        console.warn("⚠️ [CVUpload] الرفع السحابي تعثر، جاري التخزين المباشر في قاعدة البيانات:", uploadErr);
      }

      if (!finalUrl) {
        finalUrl = await cvService.fileToBase64(file);
      }

      // 1. FORCIBLY SAVE TO SUPABASE DATABASE
      await supabase.from('profiles').update({ cv_url: finalUrl }).eq('id', targetUserId);
      await profileService.updateProfile(targetUserId, { cv_url: finalUrl, cvUrl: finalUrl });

      // 2. Update local state and AppContext
      setFormData(prev => ({ ...prev, cvUrl: finalUrl, cv_url: finalUrl }));
      setPendingCV(null);
      if (isMe && setAppUser) {
        setAppUser((prev: any) => prev ? { ...prev, cvUrl: finalUrl, cv_url: finalUrl } : null);
      }
      if (onSave) {
        await onSave({ cvUrl: finalUrl, cv_url: finalUrl });
      }

      try {
        localStorage.setItem(`prolink_cv_${targetUserId}`, finalUrl);
      } catch (_) {}

      addToast('تم حفظ وتثبيت السيرة الذاتية في قاعدة البيانات بنجاح! 📄', 'success');
    } catch (saveErr: any) {
      console.error("❌ [CVUpload] خطأ في الحفظ:", saveErr);
      try {
        const b64 = await cvService.fileToBase64(file);
        await supabase.from('profiles').update({ cv_url: b64 }).eq('id', targetUserId);
        setFormData(prev => ({ ...prev, cvUrl: b64, cv_url: b64 }));
        if (isMe && setAppUser) {
          setAppUser((prev: any) => prev ? { ...prev, cvUrl: b64, cv_url: b64 } : null);
        }
        addToast('تم حفظ السيرة الذاتية في قاعدة البيانات بنجاح! 📄', 'success');
      } catch (finalErr: any) {
        addToast('فشل حفظ السيرة الذاتية: ' + (finalErr.message || ''), 'error');
      }
    } finally {
      if (targetInput) targetInput.value = '';
    }
  };

  const handleDownloadCV = () => {
    const cvUrl = formData.cv_url || formData.cvUrl || profile.cv_url || profile.cvUrl;
    if (cvUrl) {
      downloadOrOpenCV(cvUrl, `${formData.name || profile.name || 'User'}_CV.pdf`);
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
