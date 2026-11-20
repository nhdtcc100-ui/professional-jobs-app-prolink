import { safeVibrate } from '../../../lib/utils/haptics';
import { openContactMenu } from '../../../lib/utils/contact';
import { openCv } from '../../../lib/utils/cv';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Briefcase, MapPin, Phone, Lock, FileText, Pencil,
  ChevronsLeft, Upload, Download, Eye, CheckCircle2, Loader2,
  X, ExternalLink, Camera, RefreshCw,
  EyeOff, AlertCircle, WifiOff, KeyRound, ChevronDown, ChevronUp,
  Shield, Wrench, ArrowRight, Sparkles, ArrowLeftRight, Clock
} from 'lucide-react';
import { DEFAULT_NEWS_PLACEHOLDER, handleImageError } from '../../../lib/utils/placeholders';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_STORAGE_KEY, LEGACY_AUTH_STORAGE_KEY } from '../../../lib/supabase';
import { profileService } from '../../../lib/services/profileService';
import { cvService } from '../../../lib/services/cvService';
import { mobileUploadService } from '../../../lib/services/mobileUploadService';
import { AppUser, Post, Job } from '../../../types';
import { isUserAdmin } from '../../../lib/utils/roleUtils';
import { useAppContext } from '../../../contexts/AppContext';
import { PostNewsCard } from '../PostNewsCard';
import { DetailFeedPage } from '../DetailFeedPage';
import { GeneratedCVModal } from './GeneratedCVModal';
import { CVBuilderPage } from './CVBuilderPage';

interface ModernProfileViewProps {
  profile: AppUser;
  isMe: boolean;
  user: any;
  onBack?: () => void;
  addToast: (msg: string, type?: any) => void;
  setAppUser?: (user: any) => void;
  onMessageClick?: () => void;
  onCallClick?: () => void;
  showCallButton?: boolean;
  returnToJob?: Job | null;
  onReturnToJob?: (job: Job) => void;
  returnToServiceUser?: any | null;
}

export function ModernProfileView({
  profile,
  isMe,
  user,
  onBack,
  addToast,
  setAppUser,
  onMessageClick,
  onCallClick,
  showCallButton = false,
  returnToJob,
  onReturnToJob,
  returnToServiceUser,
}: ModernProfileViewProps) {
  const effectiveUserId = user?.id || profile?.id;
  // ─── Form State ───────────────────────────────────────────────────────────────
  const [profilePostDetail, setProfilePostDetail] = useState<{ items: any[]; index: number } | null>(null);
  const [name, setName] = useState(profile?.name || '');
  const [title, setTitle] = useState(profile?.display_title || profile?.title || (profile as any)?.industry || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatar, setAvatar] = useState(
    profile?.avatar || (profile as any)?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'User')}&background=0a66c2&color=fff`
  );
  const [coverUrl, setCoverUrl] = useState((profile as any)?.cover_url || (profile as any)?.coverUrl || '');
  const [cvUrl, setCvUrl] = useState(profile?.cvUrl || (profile as any)?.cv_url || '');
  const [role, setRole] = useState<'seeker' | 'employer' | 'freelancer'>(
    (profile?.role as any) || ((profile as any)?.account_type as any) || 'seeker'
  );
  const [savingRole, setSavingRole] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [targetRoleToRequest, setTargetRoleToRequest] = useState<'seeker' | 'employer'>('employer');
  const [roleReason, setRoleReason] = useState('');
  const [isSendingRoleRequest, setIsSendingRoleRequest] = useState(false);
  const [pendingRoleRequest, setPendingRoleRequest] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('prolink_pending_role_req');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Check for pending role change request from DB on mount or when role updates
  useEffect(() => {
    if (!effectiveUserId) return;
    profileService.fetchPendingRoleChangeRequest(effectiveUserId).then(({ pending, request }) => {
      if (pending && request) {
        if (request.requested_role === role) {
          setPendingRoleRequest(null);
          try { localStorage.removeItem('prolink_pending_role_req'); } catch {}
        } else {
          setPendingRoleRequest(request);
        }
      } else {
        setPendingRoleRequest(null);
      }
    });
  }, [effectiveUserId, role]);
  const [isAvailable, setIsAvailable] = useState<boolean>(
    Boolean((profile as any)?.is_available || (profile as any)?.isAvailable || (profile as any)?.open_to === 'work')
  );
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [showGeneratedCV, setShowGeneratedCV] = useState(false);
  const [showCVBuilder, setShowCVBuilder] = useState(false);

  React.useEffect(() => {
    const avail = Boolean((profile as any)?.is_available || (profile as any)?.isAvailable || (profile as any)?.open_to === 'work');
    setIsAvailable(avail);
  }, [(profile as any)?.is_available, (profile as any)?.isAvailable, (profile as any)?.open_to]);

  const handleToggleAvailability = async () => {
    if (!isMe || isUpdatingAvailability) return;
    const nextVal = !isAvailable;
    setIsAvailable(nextVal);
    setIsUpdatingAvailability(true);
    try {
      await profileService.updateProfile(effectiveUserId, {
        is_available: nextVal,
        isAvailable: nextVal,
        open_to: nextVal ? 'work' : 'none'
      } as any);
      if (setAppUser) {
        setAppUser((prev: any) => ({
          ...prev,
          is_available: nextVal,
          isAvailable: nextVal,
          open_to: nextVal ? 'work' : 'none'
        }));
      }
      addToast(nextVal ? 'أنت الآن متاح للعمل ومستعد لتلقي العروض 🟢' : 'تم تعيين حالتك إلى: غير متاح حالياً ⚪');
    } catch (err: any) {
      setIsAvailable(!nextVal);
      addToast('فشل تحديث حالة التوفر: ' + (err.message || 'خطأ غير معروف'), 'error');
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  // Keep state in sync with profile prop changes (prevents Mobile State loss)
  React.useEffect(() => {
    const cUrl = (profile as any)?.cover_url || (profile as any)?.coverUrl;
    if (cUrl && cUrl !== coverUrl) setCoverUrl(cUrl);
    const aUrl = profile?.avatar || (profile as any)?.avatar_url;
    if (aUrl && aUrl !== avatar) setAvatar(aUrl);
    const r = (profile?.role as any) || ((profile as any)?.account_type as any);
    if (r && r !== role) setRole(r);
  }, [profile]);

  // ─── Password State ──────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordSuccessBanner, setPasswordSuccessBanner] = useState<string | null>(null);
  const [passwordSuccessModal, setPasswordSuccessModal] = useState(false);

  // ─── Loading States ──────────────────────────────────────────────────────────
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingCV, setSavingCV] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // ─── CV State ────────────────────────────────────────────────────────────────
  const [pendingCVFile, setPendingCVFile] = useState<File | null>(null);
  const [pendingCVName, setPendingCVName] = useState<string | null>(null);
  const [cvUploadProgress, setCvUploadProgress] = useState(0);
  const [cvDownloading, setCvDownloading] = useState(false);

  // ─── Refs ────────────────────────────────────────────────────────────────────
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  // ─── Profile Tabs & Posts State ──────────────────────────────────────────────
  const [activeProfileTab, setActiveProfileTab] = useState<'info' | 'posts'>('info');
  const { posts: allContextPosts, allUsers: contextUsers, setPosts: setContextPosts, setActiveTab, addToast: contextAddToast, appUser, handleDeletePost, canUseMessaging, canUseAccountSwitch } = useAppContext();
  const notify = useCallback((msg: string, type: any = 'success') => {
    if (typeof addToast === 'function') addToast(msg, type);
    else if (typeof contextAddToast === 'function') contextAddToast(msg, type);
  }, [addToast, contextAddToast]);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const isAdmin = Boolean(isUserAdmin(appUser) || appUser?.isAdmin || (appUser as any)?.is_admin);

  const targetUserId = profile?.id || effectiveUserId;

  const fetchProfilePosts = useCallback(async () => {
    if (!targetUserId) return;
    setLoadingPosts(true);
    try {
      const { data, error } = await (supabase as any)
        .from('posts')
        .select('*')
        .eq('author_id', targetUserId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: Post[] = data.map((p: any) => ({
          id: p.id,
          authorId: p.author_id,
          authorName: p.author_name || profile?.name || 'مستخدم',
          authorAvatar: p.author_avatar || avatar,
          authorTitle: p.author_title || title || 'عضو في ProLink',
          content: p.content || '',
          imageUrl: p.image_url,
          videoUrl: p.video_url,
          timestamp: p.created_at,
          created_at: p.created_at,
          likesCount: p.likes_count || 0,
          dislikesCount: p.dislikes_count || 0,
          post_type: p.post_type,
          article_title: p.article_title,
        }));
        setProfilePosts(mapped);
      } else {
        const matched = allContextPosts.filter(
          p => p.authorId === targetUserId || (p as any).author_id === targetUserId
        );
        setProfilePosts(matched);
      }
    } catch (_) {
      const matched = allContextPosts.filter(
        p => p.authorId === targetUserId || (p as any).author_id === targetUserId
      );
      setProfilePosts(matched);
    } finally {
      setLoadingPosts(false);
    }
  }, [targetUserId, profile?.name, avatar, title, allContextPosts]);

  React.useEffect(() => {
    fetchProfilePosts();
  }, [fetchProfilePosts]);

  const handleDeletePostInProfile = async (postId: string) => {
    setProfilePosts(prev => prev.filter(p => p.id !== postId));
    setContextPosts?.(prev => prev.filter(p => p.id !== postId));
    if (handleDeletePost) {
      return await handleDeletePost(postId);
    } else {
      const { error } = await (supabase as any).from('posts').delete().eq('id', postId);
      if (error) {
        addToast('فشل حذف المنشور من قاعدة البيانات', 'error');
        return false;
      }
      return true;
    }
  };

  // ─── فتح ومعاينة السيرة الذاتية (معاينة السيرة المنشأة عبر المنصة) ────────
  const openCVModal = async () => {
    setShowGeneratedCV(true);
  };

  // ─── تحميل السيرة الذاتية بأمان وتنزيلها كملف بدون فضح روابط قواعد البيانات ────
  const handleDownloadCV = async () => {
    if (!isAdmin) {
      notify('ملفات السير الذاتية المرفوعة مخصصة للإدارة فقط 🛡️', 'warning');
      return;
    }
    if (!cvUrl && !pendingCVFile) return;
    try {
      setCvDownloading(true);
      if (pendingCVFile) {
        const u = URL.createObjectURL(pendingCVFile);
        const a = document.createElement('a');
        a.href = u;
        a.download = pendingCVFile.name || 'CV.pdf';
        a.click();
        setTimeout(() => URL.revokeObjectURL(u), 4000);
        addToast('✅ بدأ تحميل الملف', 'success');
        return;
      }

      // محاولة استخراج الرابط الموقّع إن وجد
      let storagePath = '';
      let bucket = 'resumes';
      const markers = [
        { marker: '/storage/v1/object/public/resumes/', bkt: 'resumes' },
        { marker: '/storage/v1/object/public/applications/', bkt: 'applications' },
        { marker: '/resumes/', bkt: 'resumes' },
        { marker: '/applications/', bkt: 'applications' },
      ];
      for (const { marker, bkt } of markers) {
        if (cvUrl.includes(marker)) {
          storagePath = decodeURIComponent(cvUrl.split(marker)[1]?.split('?')[0] || '');
          bucket = bkt;
          break;
        }
      }

      let fetchUrl = cvUrl;
      if (storagePath) {
        try {
          const { data: sd } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 120);
          if (sd?.signedUrl) fetchUrl = sd.signedUrl;
        } catch (_) {}
      }

      // Safe fetch with 10s timeout
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      let res: Response;
      try {
        res = await fetch(fetchUrl, { signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const bUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = bUrl;
      const isDoc = cvUrl.toLowerCase().includes('.doc');
      a.download = `CV_${profile?.name || 'User'}.${isDoc ? 'docx' : 'pdf'}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(bUrl), 4000);
      addToast('✅ تم تنزيل السيرة الذاتية بنجاح', 'success');
    } catch (err: any) {
      console.error('[handleDownloadCV] error:', err);
      // Fallback
      window.open(cvUrl, '_blank');
    } finally {
      setCvDownloading(false);
    }
  };

  // ─── Timeout Wrapper لمنع أي تعليق في الموبايل ─────────────────────────────
  const withTimeout = <T,>(p: PromiseLike<T> | Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      Promise.resolve(p),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`TIMEOUT: ${label} تجاوز ${ms / 1000} ثانية وتوقف`)), ms)
      ),
    ]);

  // ─── Direct Client-to-Supabase Mobile Upload ─────────────────────────────────
  const handleMobileDirectUpload = async (
    file: File,
    fileCategory: 'avatar' | 'cover' | 'cv',
    userId: string
  ): Promise<string> => {
    const supabaseUrl = SUPABASE_URL;

    // فحص أن حجم الملف أكبر من صفر
    if (!file || file.size === 0) {
      throw new Error('عذراً، يبدو أن الملف فارغ أو تعذر على المتصفح قراءته من الموبايل. جرب اختيار ملف آخر.');
    }

    // 1. تجميد فوري لمحتوى الملف في الذاكرة RAM عبر ArrayBuffer مع مهلة أمان
    let buffer: ArrayBuffer;
    try {
      if ((file as any)._ab) {
        buffer = (file as any)._ab;
      } else {
        buffer = await withTimeout(file.arrayBuffer(), 8000, 'قراءة محتوى الملف إلى RAM');
      }
    } catch (err: any) {
      throw new Error(`تعذر قراءة بايتات الملف في ذاكرة الهاتف: ${err?.message || err}`);
    }

    if (!buffer || buffer.byteLength === 0) {
      throw new Error('تعذر قراءة بايتات الملف في ذاكرة الهاتف (0 بايت).');
    }

    // 2. Ensure an authenticated session (Storage RLS requires the owner's JWT)
    try { await withTimeout(supabase.auth.getSession(), 3000, 'فحص الجلسة'); } catch {}

    // 3. Safe extension + bucket + owner-scoped path (foldername[1] = auth.uid())
    const rawExt = (file.name || '').split('.').pop()?.toLowerCase() || (fileCategory === 'cv' ? 'pdf' : 'jpg');
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx'].includes(rawExt)
      ? rawExt
      : (fileCategory === 'cv' ? 'pdf' : 'jpg');

    const bucketName = fileCategory === 'cv' ? 'resumes' : 'profiles';
    const fileName = `${userId}/${fileCategory}_${Date.now()}.${safeExt}`;
    const contentType = file.type || (fileCategory === 'cv' ? 'application/pdf' : 'image/jpeg');

    // 4. Authenticated SDK upload (no anon-key fallback — it would violate RLS)
    const { error: upErr } = await withTimeout(
      supabase.storage.from(bucketName).upload(fileName, file, { contentType, upsert: true, cacheControl: '3600' }),
      20000,
      'رفع الملف إلى التخزين'
    );
    if (upErr) {
      throw new Error(`تعذر الرفع إلى Supabase: ${upErr.message}`);
    }

    // Stable storage reference; cv.ts re-signs it for private buckets on open.
    return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}?v=${Date.now()}`;
  };

  // ─── Direct REST Database Update (تجاوز أقفال supabase-js وحفظ التعديل في 100ms) ───
  const updateProfileDbFieldDirect = async (
    userId: string,
    field: 'avatar' | 'cover' | 'cv' | 'role',
    value: string
  ): Promise<{ status: number; duration: number }> => {
    const supabaseUrl = SUPABASE_URL;
    const supabaseAnonKey = SUPABASE_ANON_KEY;

    // 1. أخذ التوكن فورياً وبشكل متزامن من localStorage دون انتظار أي قفل
    let token = supabaseAnonKey;
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY) ||
                  localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        token = parsed?.access_token || parsed?.currentSession?.access_token || supabaseAnonKey;
      }
    } catch (_) {}

    const colName = field === 'cv' ? 'cv_url' : (field === 'avatar' || field === 'cover' ? `${field}_url` : field);
    const payload: Record<string, any> = {
      [colName]: value,
      updated_at: new Date().toISOString(),
    };

    const updateUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`;
    const t0 = performance.now();

    // 2. إرسال طلب REST خام فائق السرعة — return=representation لاكتشاف 0 صفوف
    let res = await withTimeout(
      fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(payload),
      }),
      6000,
      'طلب REST المباشر لتحديث profiles'
    );

    // إذا فشل التوكن (401 أو 403)، المحاولة فوراً بـ Anon Key
    if (!res.ok && token !== supabaseAnonKey) {
      res = await withTimeout(
        fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(payload),
        }),
        6000,
        'طلب REST المباشر (Anon Key)'
      );
    }

    const duration = Math.round(performance.now() - t0);
    const resStatus = res.status;

    // التحقق من أن صفاً واحداً على الأقل تم تحديثه
    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${resStatus}`);
      throw new Error(`فشل تحديث قاعدة البيانات (${resStatus}): ${errText}`);
    }
    let rows: any[] = [];
    try { rows = await res.json(); } catch (_) {}
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('لم يُحفظ التغيير في قاعدة البيانات (0 صفوف مُحدَّثة). تحقق من صلاحيات RLS.');
    }

    // 3. تحديث الكاش المحلي فورياً لضمان عدم ضياع التحديث
    try {
      const cached = localStorage.getItem('prolink_cached_user');
      if (cached) {
        const u = JSON.parse(cached);
        if (field === 'avatar') { u.avatar = value; u.avatar_url = value; }
        if (field === 'cover') { u.coverUrl = value; u.cover_url = value; }
        if (field === 'cv') { u.cvUrl = value; u.cv_url = value; }
        if (field === 'role') {
          u.role = value;
          u.account_type = value;
          try {
            supabase.auth.updateUser({ data: { role: value, account_type: value } }).catch(() => {});
          } catch (_) {}
        }
        localStorage.setItem('prolink_cached_user', JSON.stringify(u));
      }
    } catch (_) {}

    return { status: resStatus, duration };
  };

  // ─── تغيير نوع الحساب (التحويل بين صاحب عمل وباحث عن عمل يتطلب موافقة الأدمن) ─────────────
  const handleRoleChange = (newRole: 'seeker' | 'employer') => {
    if (!isMe || !effectiveUserId || savingRole || newRole === role) return;
    safeVibrate(10);

    // 🔒 إذا كان هناك طلب قيد المراجعة مسبقاً
    if (pendingRoleRequest && pendingRoleRequest.status === 'pending' && pendingRoleRequest.requested_role !== role) {
      addToast('لديك طلب تغيير نوع حساب قيد المراجعة حالياً من قبل الإدارة', 'info');
      return;
    }

    // فتح النافذة الاحترافية لطلب التحويل
    setTargetRoleToRequest(newRole);
    setRoleReason('');
    setShowRoleModal(true);
  };

  const handleSubmitRoleRequest = async () => {
    if (!effectiveUserId || isSendingRoleRequest) return;
    setIsSendingRoleRequest(true);
    try {
      const defaultReason = targetRoleToRequest === 'employer'
        ? 'طلب ترقية إلى حساب صاحب عمل لنشر وإدارة الوظائف ومتابعة المرشحين'
        : 'طلب تحويل الحساب إلى باحث عن عمل للتقديم على الوظائف واستكشاف الفرص المهنية';

      const { data, error } = await profileService.sendRoleChangeRequest(
        effectiveUserId,
        name || profile?.name || (user?.user_metadata?.full_name || 'مستخدم'),
        avatar || profile?.avatar || '',
        role,
        targetRoleToRequest,
        roleReason.trim() || defaultReason
      );
      if (error) throw error;

      const targetLabel = targetRoleToRequest === 'employer' ? 'صاحب عمل 💼' : 'باحث عن عمل 🔍';
      addToast(`📨 تم إرسال طلب التحويل إلى "${targetLabel}" للإدارة بنجاح! سيتم التفعيل فور المراجعة.`, 'success');

      const newPending = {
        requested_role: targetRoleToRequest,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      setPendingRoleRequest(newPending);
      try { localStorage.setItem('prolink_pending_role_req', JSON.stringify(newPending)); } catch {}
      setShowRoleModal(false);
    } catch (err: any) {
      addToast('فشل إرسال الطلب: ' + (err?.message || 'خطأ غير معروف'), 'error');
    } finally {
      setIsSendingRoleRequest(false);
    }
  };

  // ─── Apply Image Update to State, DB, and Context (Atomic Sync) ────────────
  const applyImageUpdate = async (kind: 'avatar' | 'cover', finalUrl: string) => {
    const isAvatar = kind === 'avatar';
    // 1. Update local component state
    if (isAvatar) setAvatar(finalUrl);
    else setCoverUrl(finalUrl);

    // 2. Direct REST Update to Database (100ms) with fallback to profileService
    try {
      await updateProfileDbFieldDirect(effectiveUserId, kind, finalUrl);
    } catch (dbErr) {
      console.warn(`[${kind}Upload] Direct REST DB update failed, falling back to profileService:`, dbErr);
      const updates = isAvatar
        ? { avatar: finalUrl, avatar_url: finalUrl }
        : { cover_url: finalUrl, coverUrl: finalUrl };
      await profileService.updateProfile(effectiveUserId, updates as any);
    }

    // 3. Update global AppUser context
    if (setAppUser) {
      setAppUser((prev: any) => ({
        ...prev,
        ...(isAvatar
          ? { avatar: finalUrl, avatar_url: finalUrl }
          : { cover_url: finalUrl, coverUrl: finalUrl }),
      }));
    }

    // 4. Update cached user in LocalStorage
    try {
      const cached = localStorage.getItem('prolink_cached_user');
      if (cached) {
        const u = JSON.parse(cached);
        if (isAvatar) { u.avatar = finalUrl; u.avatar_url = finalUrl; }
        else { u.coverUrl = finalUrl; u.cover_url = finalUrl; }
        localStorage.setItem('prolink_cached_user', JSON.stringify(u));
      }
    } catch (_) {}

    addToast(
      isAvatar ? '✅ تم تحديث الصورة الشخصية بنجاح!' : '✅ تم تحديث صورة الغلاف بنجاح!',
      'success'
    );
  };

  // ─── Unified Image Upload Handler (Avatar & Cover) ───────────────────────────
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'avatar' | 'cover'
  ) => {
    const targetInput = e.target;
    const rawFile = targetInput?.files?.[0];
    if (!rawFile || !effectiveUserId) return;

    if (rawFile.size === 0) {
      addToast('تعذر قراءة الملف: الملف فارغ. يرجى اختيار صورة أخرى.', 'error');
      if (targetInput) targetInput.value = '';
      return;
    }

    const isAvatar = kind === 'avatar';
    const prevAvatar = avatar;
    const prevCover = coverUrl;

    if (isAvatar) setIsUploadingAvatar(true);
    else setIsUploadingCover(true);

    try {
      // 1. Instant local preview (<16ms) & background upload pipeline (Telegram/WhatsApp style)
      const { preview, uploadPromise } = await mobileUploadService.uploadFile(
        rawFile,
        kind,
        effectiveUserId
      );

      // 2. Show optimistic preview immediately!
      if (preview) {
        if (isAvatar) setAvatar(preview);
        else setCoverUrl(preview);
      }

      // 3. Wait for background upload (HEIC conversion -> Smart Canvas compression -> Storage / Base64 fallback)
      const finalUrl = await uploadPromise;

      // 4. Apply atomic sync across state, DB, and context
      await applyImageUpdate(kind, finalUrl);
    } catch (err: any) {
      console.error(`[${kind}Upload] Upload error:`, err);
      // Revert optimistic preview on error
      if (isAvatar) setAvatar(prevAvatar);
      else setCoverUrl(prevCover);

      const errMsg = err?.message || JSON.stringify(err);
      if (!errMsg.includes('cancel') && !errMsg.includes('User cancel')) {
        addToast(`تعذر تحديث ${isAvatar ? 'الصورة الشخصية' : 'صورة الغلاف'}: ${errMsg}`, 'error');
      }
    } finally {
      if (isAvatar) setIsUploadingAvatar(false);
      else setIsUploadingCover(false);
      if (targetInput) targetInput.value = '';
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => handleImageUpload(e, 'avatar');
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => handleImageUpload(e, 'cover');

  // ─── Native Platform Handlers (Capacitor vs Web Input) ──────────────────────
  const handleAvatarButtonClick = async () => {
    if (typeof (window as any)?.Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform()) {
      const prevAvatar = avatar;
      try {
        setIsUploadingAvatar(true);
        const { preview, uploadPromise } = await mobileUploadService.pickAndUpload('avatar', { userId: effectiveUserId });
        if (preview) setAvatar(preview);
        const finalUrl = await uploadPromise;
        await applyImageUpdate('avatar', finalUrl);
      } catch (err: any) {
        setAvatar(prevAvatar);
        if (!err?.message?.includes('cancel') && !err?.message?.includes('User cancel')) {
          addToast('تعذر تغيير الصورة الشخصية: ' + (err?.message || ''), 'error');
        }
      } finally {
        setIsUploadingAvatar(false);
      }
    } else {
      avatarInputRef.current?.click();
    }
  };

  const handleCoverButtonClick = async () => {
    if (typeof (window as any)?.Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform()) {
      const prevCover = coverUrl;
      try {
        setIsUploadingCover(true);
        const { preview, uploadPromise } = await mobileUploadService.pickAndUpload('cover', { userId: effectiveUserId });
        if (preview) setCoverUrl(preview);
        const finalUrl = await uploadPromise;
        await applyImageUpdate('cover', finalUrl);
      } catch (err: any) {
        setCoverUrl(prevCover);
        if (!err?.message?.includes('cancel') && !err?.message?.includes('User cancel')) {
          addToast('تعذر تغيير صورة الغلاف: ' + (err?.message || ''), 'error');
        }
      } finally {
        setIsUploadingCover(false);
      }
    } else {
      coverInputRef.current?.click();
    }
  };

  // ─── 3. Save Personal Info ────────────────────────────────────────────────────
  const handleSavePersonalInfo = async () => {
    if (!effectiveUserId) { addToast('يرجى تسجيل الدخول أولاً', 'error'); return; }
    if (!name.trim()) { addToast('الاسم لا يمكن أن يكون فارغاً', 'error'); return; }
    try {
      setSavingInfo(true);
      const updates = {
        name: name.trim(), title: title.trim(), display_title: title.trim(),
        location: location.trim(), bio: bio.trim(),
      };
      const { error } = await profileService.updateProfile(effectiveUserId, updates);
      if (error) throw error;
      if (setAppUser) setAppUser((prev: any) => ({ ...prev, ...updates }));
      addToast('✅ تم حفظ المعلومات الشخصية بنجاح!', 'success');
    } catch (err: any) {
      addToast('فشل حفظ المعلومات: ' + (err?.message || ''), 'error');
    } finally {
      setSavingInfo(false);
    }
  };

  // ─── 4. Save Phone ────────────────────────────────────────────────────────────
  const handleSavePhone = async () => {
    if (!effectiveUserId) { addToast('يرجى تسجيل الدخول أولاً', 'error'); return; }
    try {
      setSavingPhone(true);
      const { error } = await profileService.updateProfile(effectiveUserId, { phone: phone.trim() });
      if (error) throw error;
      if (setAppUser) setAppUser((prev: any) => ({ ...prev, phone: phone.trim() }));
      addToast('✅ تم حفظ رقم الهاتف بنجاح!', 'success');
    } catch (err: any) {
      addToast('فشل حفظ رقم الهاتف: ' + (err?.message || ''), 'error');
    } finally {
      setSavingPhone(false);
    }
  };

  // ─── 5. CV Upload – Non-blocking, all mobile fixes applied ──────────────────
  const handleCVFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetInput = e.target;
    const file = targetInput?.files?.[0];
    if (!file) return;

    if (!effectiveUserId) {
      addToast('يرجى تسجيل الدخول أولاً لتتمكن من رفع السيرة الذاتية.', 'error');
      return;
    }

    if (file.size === 0) {
      addToast('تعذر قراءة الملف: الملف فارغ. يرجى اختيار ملف آخر.', 'error');
      if (targetInput) targetInput.value = '';
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      addToast('حجم الملف كبير جداً، الحد الأقصى 25 ميغابايت.', 'error');
      if (targetInput) targetInput.value = '';
      return;
    }

    try {
      setSavingCV(true);
      setCvUploadProgress(15);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const fileName = file.name || 'resume.pdf';
      setPendingCVName(`${fileName} (${sizeMB} MB)`);

      // RAM snapshot immediately with timeout
      let workingFile = file;
      try {
        const ab = await withTimeout(file.arrayBuffer(), 10000, 'قراءة ملف الـ CV إلى RAM');
        const mime = file.type || 'application/pdf';
        workingFile = new File([new Blob([ab], { type: mime })], fileName, { type: mime });
        (workingFile as any)._ab = ab;
        setCvUploadProgress(35);
      } catch (abErr: any) {
        console.warn('[CVUpload] arrayBuffer read failed, using raw file:', abErr);
        workingFile = file;
      }

      setCvUploadProgress(50);

      const publicUrl = await withTimeout(
        handleMobileDirectUpload(workingFile, 'cv', effectiveUserId),
        25000,
        'رفع الـ CV عبر الشبكة'
      );

      setCvUploadProgress(85);
      setCvUrl(publicUrl);
      setPendingCVFile(null);
      setPendingCVName(null);

      await withTimeout(
        updateProfileDbFieldDirect(effectiveUserId, 'cv', publicUrl),
        8000,
        'تحديث قاعدة البيانات REST'
      );
      setCvUploadProgress(100);

      if (setAppUser) setAppUser((prev: any) => ({ ...prev, cvUrl: publicUrl, cv_url: publicUrl }));
      addToast('✅ تم رفع وتثبيت السيرة الذاتية بنجاح!', 'success');
      setTimeout(() => setCvUploadProgress(0), 1800);
    } catch (err: any) {
      setCvUploadProgress(0);
      console.error('[CVUpload] Error uploading CV:', err);
      const errMsg = err?.message || JSON.stringify(err) || 'خطأ غير معروف';
      const isTimeout = errMsg?.includes('TIMEOUT');
      addToast(isTimeout ? 'انتهت مهلة رفع السيرة الذاتية، يرجى المحاولة مجدداً.' : ('فشل حفظ السيرة الذاتية: ' + errMsg), 'error');
    } finally {
      setSavingCV(false);
      if (targetInput) targetInput.value = '';
    }
  };

  const handleSaveCV = async () => {
    if (!effectiveUserId) { addToast('يرجى تسجيل الدخول أولاً', 'error'); return; }
    if (!pendingCVFile && !cvUrl) { addToast('يرجى اختيار ملف السيرة الذاتية أولاً', 'error'); return; }
    try {
      setSavingCV(true);
      setCvUploadProgress(20);
      let finalUrl = cvUrl;
      if (pendingCVFile) {
        addToast('⏳ جاري رفع السيرة الذاتية مباشرة إلى Supabase...', 'info');
        setCvUploadProgress(40);
        finalUrl = await handleMobileDirectUpload(pendingCVFile, 'cv', effectiveUserId);
        setCvUploadProgress(90);
        setCvUrl(finalUrl);
        setPendingCVFile(null);
        setPendingCVName(null);
        if (cvInputRef.current) cvInputRef.current.value = '';
      }

      await profileService.updateProfile(effectiveUserId, { cvUrl: finalUrl, cv_url: finalUrl });
      if (setAppUser) setAppUser((prev: any) => ({ ...prev, cvUrl: finalUrl, cv_url: finalUrl }));
      setCvUploadProgress(100);
      addToast('✅ تم حفظ وتثبيت السيرة الذاتية بنجاح!', 'success');
      setTimeout(() => setCvUploadProgress(0), 1800);
    } catch (err: any) {
      setCvUploadProgress(0);
      const msg = err?.message || JSON.stringify(err) || 'خطأ غير معروف';
      console.error('CV upload error:', err);
      addToast('فشل حفظ السيرة الذاتية: ' + msg, 'error');
    } finally {
      setSavingCV(false);
    }
  };

  // ─── 6. Change Password (فوري وخارق السرعة عبر REST المباشر دون أقفال أو تعليق) ─────────────
  const handleSavePassword = async () => {
    if (!currentPassword) { notify('يرجى إدخال كلمة المرور الحالية', 'error'); return; }
    if (showChangePassword) {
      if (!newPassword) { notify('يرجى إدخال كلمة المرور الجديدة', 'error'); return; }
      if (newPassword.length < 8) { notify('كلمة المرور يجب أن لا تقل عن 8 أحرف', 'error'); return; }
      if (newPassword !== confirmPassword) { notify('كلمتا المرور غير متطابقتين', 'error'); return; }
    }
    try {
      setSavingPassword(true);
      const supabaseUrl = SUPABASE_URL;
      const supabaseAnonKey = SUPABASE_ANON_KEY;

      // 1. استخراج الجلسة والتوكن الحاليين (بمهلة حتى لا يعلّق الحفظ إذا كان قفل المصادقة عالقاً)
      let sessionData: any = null;
      try {
        const r = await withTimeout(supabase.auth.getSession(), 3000, 'فحص الجلسة');
        sessionData = (r as any)?.data ?? null;
      } catch { /* fallback to localStorage below */ }
      let accessToken = sessionData?.session?.access_token || '';
      let targetEmail = sessionData?.session?.user?.email || user?.email || profile?.email || '';

      // استخراج احتياطي للتوكن من التخزين المحلي في حال تأخر SDK
      if (!accessToken) {
        try {
          const raw = localStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem('supabase.auth.token');
          if (raw) {
            const parsed = JSON.parse(raw);
            accessToken = parsed?.access_token || parsed?.currentSession?.access_token || '';
          }
        } catch (_) {}
      }

      // دعم احتياطي لأرقام هواتف المستخدمين
      if (!targetEmail || !targetEmail.includes('@')) {
        const phoneDigits = (profile?.phone || user?.phone || (user?.user_metadata as any)?.phone || '').replace(/\D/g, '');
        if (phoneDigits) {
          targetEmail = `${phoneDigits}@prolink.internal`;
        }
      }

      // 2. تحديث كلمة المرور الفوري (~200ms) عبر REST المباشر مع جلسة المستخدم
      if (showChangePassword && newPassword) {
        let updateSuccess = false;

        // المسار الأول فائق السرعة: PUT /auth/v1/user عبر REST
        if (accessToken) {
          try {
            const updateRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
              method: 'PUT',
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ password: newPassword }),
            });

            if (updateRes.ok) {
              updateSuccess = true;
            } else {
              const errBody = await updateRes.json().catch(() => ({}));
              console.warn('REST update response not OK, trying SDK fallback:', errBody);
            }
          } catch (rErr) {
            console.warn('REST update fetch failed, trying SDK fallback:', rErr);
          }
        }

        // المسار الثاني الاحتياطي: SDK مع مهلة أمان كافية (20 ثانية لتشفير bcrypt)
        if (!updateSuccess) {
          const { error: sdkError } = await withTimeout(
            supabase.auth.updateUser({ password: newPassword }),
            20000,
            'updateUser.password'
          );
          if (sdkError) throw sdkError;
          updateSuccess = true;
        }

        setNewPassword('');
        setConfirmPassword('');
        setCurrentPassword('');
        setShowChangePassword(false);
        setPasswordSuccessBanner('تم تغيير كلمة المرور وتفعيل الرمز السري الجديد بنجاح! يمكنك الآن استخدامه لتسجيل الدخول.');
        setPasswordSuccessModal(true);
        notify('✅ تم حفظ وتحديث كلمة المرور بنجاح!', 'success');
        safeVibrate([60, 40, 60]);
      } else {
        // التحقق من صحة الرمز الحالي
        if (targetEmail && targetEmail.includes('@')) {
          try {
            const { error: verifyErr } = await supabase.auth.signInWithPassword({
              email: targetEmail,
              password: currentPassword,
            });
            if (verifyErr) {
              // إذا فشل البريد، جرب الهاتف إن وُجد
              const phone = profile?.phone || user?.phone;
              if (phone) {
                const { error: phoneErr } = await supabase.auth.signInWithPassword({
                  phone,
                  password: currentPassword,
                });
                if (phoneErr) {
                  notify('كلمة المرور الحالية غير صحيحة ❌', 'error');
                  return;
                }
              } else {
                notify('كلمة المرور الحالية غير صحيحة ❌', 'error');
                return;
              }
            }
          } catch (_) {}
        }
        notify('✅ تم التحقق من كلمة المرور الحالية بنجاح! يرجى إدخال كلمة المرور الجديدة', 'success');
        setShowChangePassword(true);
      }
    } catch (err: any) {
      console.error('Password change error:', err);
      notify('تعذر تغيير كلمة المرور: ' + (err?.message || 'خطأ في الاتصال'), 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  // ─── Shared Styles — using app brand blue #0a66c2 ────────────────────────────
  const cardClass = 'bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[36px] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-[0_8px_36px_rgba(10,102,194,0.1)] dark:shadow-[0_12px_50px_rgba(0,0,0,0.65)]';
  const inputCard = 'relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 px-6 py-4.5 sm:py-5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/20 transition-all duration-200';
  const floatLabel = 'absolute -top-2.5 right-4 bg-white dark:bg-slate-900 px-2.5 text-xs sm:text-[13px] font-bold text-slate-400';
  const saveBtn = 'w-full py-5 sm:py-5.5 rounded-2xl sm:rounded-full bg-gradient-to-l from-[#0a66c2] to-[#004182] hover:from-[#004182] hover:to-[#0a66c2] text-white font-black text-base sm:text-lg transition-all shadow-xl shadow-[#0a66c2]/30 dark:shadow-[#0a66c2]/20 active:scale-[0.98] flex items-center justify-between px-7 sm:px-9 cursor-pointer disabled:opacity-60';
  const iconBadge = 'w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0a66c2] to-[#004182] flex items-center justify-center text-white shadow-lg shadow-[#0a66c2]/30 shrink-0';

  if (showCVBuilder) {
    return (
      <CVBuilderPage
        appUser={isMe ? (appUser || profile) : profile}
        onBack={() => setShowCVBuilder(false)}
        addToast={addToast}
        setAppUser={setAppUser}
      />
    );
  }

  return (
    <div className="w-full max-w-4xl lg:max-w-5xl mx-auto space-y-7 pb-28 pt-2 md:pt-6 px-3 sm:px-6" dir="rtl">

      {/* Return to Job Details Banner (shown when arriving from a job detail view) */}
      {returnToJob && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl shadow-lg flex items-center justify-between text-white gap-3 border border-blue-400/30 mb-2"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Briefcase size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black truncate">أنت تتصفح ملف ناشر وظيفة: {returnToJob.title}</p>
              <p className="text-[10px] text-blue-100 font-bold truncate">انقر هنا للعودة الفورية لتفاصيل الوظيفة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onReturnToJob ? onReturnToJob(returnToJob) : onBack?.()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <span>العودة للوظيفة</span>
            <ArrowRight size={14} />
          </button>
        </motion.div>
      )}

      {/* Return to Services & Trades Market Banner */}
      {returnToServiceUser && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl shadow-lg flex items-center justify-between text-white gap-3 border border-blue-400/30 mb-2"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Wrench size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black truncate">أنت تتصفح ملف مزود الخدمة: {returnToServiceUser.name || profile?.name || 'المهني'}</p>
              <p className="text-[10px] text-blue-100 font-bold truncate">انقر هنا للعودة لمكانه في سوق الخدمات والمهن</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onBack?.()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <span>العودة لسوق الخدمات</span>
            <ArrowRight size={14} />
          </button>
        </motion.div>
      )}

      {/* General Back Button when viewing someone else's profile */}
      {!isMe && !returnToJob && !returnToServiceUser && onBack && (
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-xs font-black shadow-sm border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
          >
            <ArrowRight size={15} />
            <span>رجوع</span>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          CARD 1 — المعلومات الشخصية (Cover + Avatar + Info)
          ══════════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className={cardClass}
      >
        {/* ── Cover Photo Banner ──────────────────────────────────────────────── */}
        <div
          className="relative h-56 sm:h-64 w-full overflow-hidden group"
          style={{ background: 'linear-gradient(135deg, #0a66c2 0%, #004182 60%, #001e3c 100%)' }}
        >
          <img
            src={coverUrl || DEFAULT_NEWS_PLACEHOLDER}
            alt="cover"
            className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
            onError={(e) => handleImageError(e, DEFAULT_NEWS_PLACEHOLDER)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent pointer-events-none" />
          {/* Upload overlay on hover */}
          {isMe && !isUploadingCover && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-all duration-300 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center gap-2 text-white">
                <Camera size={26} />
                <span className="text-xs sm:text-sm font-bold">تغيير صورة الغلاف</span>
              </div>
            </div>
          )}
          {isUploadingCover && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <Loader2 size={32} className="text-white animate-spin" />
            </div>
          )}
          {isMe && (
            <>
              <input
                id="cover-file-input"
                ref={coverInputRef}
                type="file"
                accept="image/*,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                className="hidden"
                onChange={handleCoverChange}
              />
              <button
                type="button"
                onClick={handleCoverButtonClick}
                className="absolute bottom-3.5 left-3.5 flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/50 hover:bg-black/75 text-white text-xs sm:text-sm font-bold backdrop-blur-sm transition-all border border-white/20 active:scale-95 cursor-pointer shadow-lg z-10"
              >
                <Camera size={15} />
                <span>تغيير الغلاف</span>
              </button>
            </>
          )}
        </div>

        {/* ── Avatar + Card Content ──────────────────────────────────────────── */}
        <div className="px-6 sm:px-9 pb-8 pt-0 space-y-6">
          {/* صف الأفاتار فقط — يرتفع فوق الغلاف بـ -mt-14 sm:-mt-18 */}
          <div className="flex items-end justify-between -mt-14 sm:-mt-18">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-[28px] sm:rounded-[32px] overflow-hidden bg-slate-100 dark:bg-slate-800 ring-4 sm:ring-6 ring-white dark:ring-slate-900 shadow-2xl shadow-[#0a66c2]/25">
                <motion.img
                  src={avatar}
                  alt={name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  animate={isUploadingAvatar ? { opacity: [0.5, 1, 0.5], scale: [0.97, 1.03, 0.97] } : {}}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
              </div>
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-[28px] sm:rounded-[32px] backdrop-blur-xs">
                  <Loader2 size={28} className="text-white animate-spin" />
                </div>
              )}
              {isMe && (
                <>
                  <input
                    id="avatar-file-input"
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <button
                    type="button"
                    onClick={handleAvatarButtonClick}
                    className="absolute -bottom-1.5 -right-1.5 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#0a66c2] to-[#004182] text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 transition-all active:scale-90 cursor-pointer hover:scale-110 z-10"
                    title="تغيير الصورة الشخصية"
                  >
                    <Camera size={18} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── نوع الحساب (Account Type Segmented Control) ── */}
          {/* يظهر فقط للأدمن أو عند تفعيل خاصية تبديل الحساب من الإدارة */}
          {canUseAccountSwitch && (
          <div className="pt-1 pb-5 mb-6 border-b border-slate-100 dark:border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={iconBadge}><Shield size={17} /></div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white">نوع الحساب</h3>
                  <p className="text-[10px] font-bold text-slate-400">
                    {isMe ? 'اختر دورك في المنصة للوصول إلى الميزات المناسبة' : 'نوع هذا الحساب في المنصة'}
                  </p>
                </div>
              </div>
              {savingRole && (
                <span className="text-[11px] font-bold text-[#0a66c2] flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" />
                  جاري الحفظ...
                </span>
              )}
            </div>

            {/* Pending Request Banner */}
            {pendingRoleRequest && pendingRoleRequest.status === 'pending' && pendingRoleRequest.requested_role !== role && (
              <div className="mb-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-400 font-bold">
                <Clock size={16} className="shrink-0 text-amber-500 animate-pulse" />
                <span>طلبك لتغيير نوع الحساب إلى "{pendingRoleRequest.requested_role === 'employer' ? 'صاحب عمل 💼' : 'باحث عن عمل 🔍'}" قيد المراجعة لدى الإدارة حالياً.</span>
              </div>
            )}

            {/* Segmented Control Buttons (باحث عن عمل وصاحب عمل) */}
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
              {[
                { id: 'seeker', label: 'باحث عن عمل', emoji: '🔍', desc: 'تقديم وتصفح الفرص' },
                { id: 'employer', label: 'صاحب عمل', emoji: '💼', desc: 'نشر وإدارة الوظائف' },
              ].map(opt => {
                const isSelected = role === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!isMe || savingRole}
                    onClick={() => handleRoleChange(opt.id as any)}
                    className={`relative flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white dark:bg-slate-900 shadow-md text-slate-900 dark:text-white font-black'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold'
                    } ${!isMe ? 'cursor-default' : 'active:scale-95'}`}
                  >
                    <span className="text-xl mb-1 filter drop-shadow-xs">{opt.emoji}</span>
                    <span className="text-[11px] sm:text-xs leading-tight font-black">{opt.label}</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">{opt.desc}</span>
                    {isSelected && (
                      <motion.div
                        layoutId="active-role-pill"
                        className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* ── Seeker Availability Toggle Card ── */}
          {role === 'seeker' && (
            <div className={`p-5 rounded-3xl border mb-6 shadow-sm transition-colors ${
              isAvailable
                ? 'bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent border-emerald-500/40'
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                    isAvailable
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}>
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">حالة التوفر للعمل</h4>
                    <span className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                      isAvailable
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      {isAvailable ? 'متاح للعمل الآن' : 'غير متاح حالياً'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                {isMe
                  ? (isAvailable
                      ? 'ملفك يظهر لأصحاب العمل كباحث نشط ومستعد لتلقي عروض الوظائف.'
                      : 'ملفك لا يظهر في قائمة المتاحين للعمل حتى تعيد تفعيلها.')
                  : (isAvailable ? 'هذا الباحث متاح حالياً للتوظيف وتلقي عروض العمل.' : 'هذا الباحث غير متاح حالياً للعمل.')}
              </p>

              {isMe && (
                <button
                  type="button"
                  disabled={isUpdatingAvailability}
                  onClick={handleToggleAvailability}
                  className={`mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-[0.98] disabled:opacity-60 shadow-md ${
                    isAvailable
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                      : 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white shadow-slate-800/20'
                  }`}
                >
                  {isUpdatingAvailability ? (
                    <><Loader2 size={18} className="animate-spin" /> جاري التحديث...</>
                  ) : isAvailable ? (
                    <>إيقاف التوفر عن العمل</>
                  ) : (
                    <>تفعيل التوفر للعمل 🟢</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* 📄 بطاقة منشئ السيرة الذاتية الاحترافية المعتمدة ATS */}
          {isMe && (
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="p-5 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-[#0a66c2] text-white shadow-xl shadow-blue-500/25 flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/20"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
                  <Sparkles size={24} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-black text-white">منشئ السيرة الذاتية الاحترافية (ATS)</h4>
                    <span className="px-2 py-0.5 rounded-full bg-white/25 text-white text-[10px] font-black">جديد ✨</span>
                  </div>
                  <p className="text-xs text-blue-100 font-medium mt-0.5">
                    أنشئ سيرتك الذاتية بتنسيق ATS عالمي، أضف مهاراتك وأعمالك السابقة ولغاتك، وصدّرها لجميع الوظائف بضغطة واحدة.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCVBuilder(true)}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white text-blue-700 hover:bg-blue-50 text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer shrink-0 flex items-center justify-center gap-2"
              >
                <FileText size={16} />
                <span>إنشاء سيرة ذاتية 📄</span>
              </button>
            </motion.div>
          )}

          {/* عنوان "المعلومات الشخصية" — منفصل بمسافة واضحة وبطاقة أنيقة */}
          <div className="flex items-center gap-2.5 pt-2 pb-2 mb-6 border-b border-slate-100 dark:border-slate-800/80">
            <div className={iconBadge}><User size={17} /></div>
            <span className="text-base sm:text-lg font-black text-slate-800 dark:text-white">المعلومات الشخصية</span>
          </div>

          {/* الاسم */}
          <div className={inputCard}>
            <span className={floatLabel}>الاسم</span>
            <div className="flex items-center gap-3">
              {isMe ? (
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="أدخل اسمك الكامل"
                  className="w-full bg-transparent outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-white" />
              ) : (
                <p className="w-full text-sm sm:text-base font-bold text-slate-800 dark:text-white">{name}</p>
              )}
              <User size={17} className="text-slate-400 shrink-0" />
            </div>
          </div>

          {/* المسمى الوظيفي */}
          <div className={inputCard}>
            <span className={floatLabel}>المسمى الوظيفي / الاختصاص</span>
            <div className="flex items-center gap-3">
              {isMe ? (
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: مطور برمجيات، مهندس شبكات..."
                  className="w-full bg-transparent outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-white" />
              ) : (
                <p className="w-full text-sm sm:text-base font-bold text-slate-800 dark:text-white">{title || '—'}</p>
              )}
              <Briefcase size={17} className="text-slate-400 shrink-0" />
            </div>
          </div>

          {/* العنوان */}
          <div className={inputCard}>
            <span className={floatLabel}>العنوان</span>
            <div className="flex items-center gap-3">
              {isMe ? (
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="مثال: بغداد، المشتل"
                  className="w-full bg-transparent outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-white" />
              ) : (
                <p className="w-full text-sm sm:text-base font-bold text-slate-800 dark:text-white">{location || '—'}</p>
              )}
              <MapPin size={17} className="text-slate-400 shrink-0" />
            </div>
          </div>

          {/* النبذة التعريفية */}
          <div className={inputCard}>
            <span className={floatLabel}>النبذة التعريفية</span>
            {isMe ? (
              <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)}
                placeholder="اكتب نبذة مختصرة عن خبرتك واهتماماتك..."
                className="w-full bg-transparent outline-none text-sm font-medium text-slate-800 dark:text-white resize-none" />
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-200 font-medium whitespace-pre-wrap leading-relaxed">
                {bio || 'لا توجد نبذة تعريفية مسجلة.'}
              </p>
            )}
          </div>

          {isMe && (
            <button type="button" onClick={handleSavePersonalInfo} disabled={savingInfo} className={saveBtn}>
              <div className="flex items-center gap-1 text-blue-200"><ChevronsLeft size={22} /></div>
              <div className="flex items-center gap-2">
                {savingInfo && <Loader2 size={18} className="animate-spin text-blue-200" />}
                <span>{savingInfo ? 'جاري الحفظ...' : 'حفظ'}</span>
              </div>
            </button>
          )}
        </div>
      </motion.div>

      {/* ─── Profile Sub-Navigation Tabs with Animated Sliding Pill ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-1.5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-1.5 relative select-none">
        <button
          type="button"
          onClick={() => setActiveProfileTab('info')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all relative z-10 flex items-center justify-center gap-2 cursor-pointer ${
            activeProfileTab === 'info'
              ? 'text-white'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {activeProfileTab === 'info' && (
            <motion.div
              layoutId="profile-tab-indicator"
              className="absolute inset-0 bg-gradient-to-r from-[#0a66c2] to-[#004182] rounded-xl shadow-md z-[-1]"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
          <User size={15} />
          <span>الملف الشخصي</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveProfileTab('posts')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all relative z-10 flex items-center justify-center gap-2 cursor-pointer ${
            activeProfileTab === 'posts'
              ? 'text-white'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {activeProfileTab === 'posts' && (
            <motion.div
              layoutId="profile-tab-indicator"
              className="absolute inset-0 bg-gradient-to-r from-[#0a66c2] to-[#004182] rounded-xl shadow-md z-[-1]"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
          <FileText size={15} />
          <span>المنشورات والمقالات</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
            activeProfileTab === 'posts'
              ? 'bg-white/20 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}>
            {profilePosts.length}
          </span>
        </button>
      </div>

      {activeProfileTab === 'info' ? (
        <>
          {/* ══════════════════════════════════════════════════════════════════════════
              CARD 2 — رقم الهاتف
              ══════════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.07 }}
        className={`${cardClass} p-6 sm:p-8 space-y-5 sm:space-y-6`}
      >
        <div className="flex items-center gap-3.5">
          <div className={iconBadge}><Phone size={22} /></div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
              {isMe ? 'تغيير رقم الهاتف' : 'رقم الهاتف'}
            </h2>
            <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
              {isMe ? 'رقم هاتفك المعتمد للتواصل والإشعارات' : 'رقم الاتصال المباشر'}
            </p>
          </div>
        </div>

        <div className={inputCard}>
          <span className={floatLabel}>رقم الهاتف</span>
          <div className="flex items-center gap-3">
            {isMe ? (
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXXX" dir="ltr"
                className="w-full bg-transparent outline-none text-base sm:text-lg font-bold text-slate-800 dark:text-white text-right" />
            ) : (
              <button
                type="button"
                onClick={() => openContactMenu({ phone, name: profile?.name, website: (profile as any)?.website, cvUrl: (profile as any)?.cv_url || profile?.cvUrl })}
                className="w-full text-base sm:text-lg font-bold text-slate-800 dark:text-white text-right cursor-pointer hover:text-[#0a66c2] transition-colors"
                dir="ltr"
                title="اضغط لخيارات التواصل: واتساب / اتصال"
              >
                {phone || '—'}
              </button>
            )}
            <Phone size={19} className="text-slate-400 shrink-0" />
          </div>
        </div>

        {isMe ? (
          <button type="button" onClick={handleSavePhone} disabled={savingPhone} className={saveBtn}>
            <div className="flex items-center gap-1 text-blue-200"><ChevronsLeft size={24} /></div>
            <div className="flex items-center gap-2">
              {savingPhone && <Loader2 size={20} className="animate-spin text-blue-200" />}
              <span>{savingPhone ? 'جاري الحفظ...' : 'حفظ رقم الهاتف'}</span>
            </div>
          </button>
        ) : (
          phone && (
            <button type="button" onClick={() => openContactMenu({ phone, name: profile?.name, website: (profile as any)?.website, cvUrl: (profile as any)?.cv_url || profile?.cvUrl })}
              className="w-full py-4.5 sm:py-5 rounded-2xl sm:rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base sm:text-lg transition-all shadow-xl shadow-emerald-500/25 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer">
              <Phone size={20} /><span>تواصل: واتساب / اتصال</span>
            </button>
          )
        )}
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════════════
          CARD 3 — تغيير كلمة المرور
          ══════════════════════════════════════════════════════════════════════════ */}
      {isMe && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className={`${cardClass} p-6 sm:p-8 space-y-5 sm:space-y-6`}
        >
          <div className="flex items-center gap-3.5">
            <div className={iconBadge}><Lock size={22} /></div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">تغيير كلمة المرور</h2>
              <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">تحديث الرمز السري لحماية وتأمين حسابك</p>
            </div>
          </div>

          {/* رسالة تأكيد نجاح تغيير كلمة المرور */}
          <AnimatePresence>
            {passwordSuccessBanner && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                className="p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/60 flex items-start justify-between gap-3 text-emerald-800 dark:text-emerald-200 shadow-xl shadow-emerald-500/10"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm sm:text-base text-emerald-900 dark:text-emerald-100">تم تغيير كلمة المرور بنجاح! 🎉</h4>
                    <p className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 leading-relaxed">
                      {passwordSuccessBanner}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordSuccessBanner(null)}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-white p-1"
                >
                  <X size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* كلمة المرور الحالية — دائماً ظاهرة */}
          <div className={inputCard}>
            <span className={floatLabel}>كلمة المرور الحالية</span>
            <div className="flex items-center gap-3">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الحالية"
                className="w-full bg-transparent outline-none text-base sm:text-lg font-bold text-slate-800 dark:text-white"
              />
              <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="text-slate-400 hover:text-[#0a66c2] transition-colors shrink-0">
                {showCurrentPw ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          {/* زر تبديل — تغيير كلمة المرور */}
          <button
            type="button"
            onClick={() => setShowChangePassword(!showChangePassword)}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-sm sm:text-base font-black transition-all hover:border-[#0a66c2]/40 hover:bg-blue-50/40 dark:hover:bg-slate-700 active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <KeyRound size={17} className="text-[#0a66c2]" />
              <span>إذا أردت تغيير كلمة المرور</span>
            </div>
            {showChangePassword
              ? <ChevronUp size={18} className="text-[#0a66c2]" />
              : <ChevronDown size={18} className="text-slate-400" />}
          </button>

          {/* حقول كلمة المرور الجديدة — قابلة للطي */}
          <AnimatePresence>
            {showChangePassword && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden space-y-4 pt-1"
              >
                <div className="flex items-center gap-2 text-[#0a66c2] dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 rounded-xl px-4 py-3 border border-blue-100 dark:border-blue-900/50">
                  <AlertCircle size={16} className="shrink-0" />
                  <p className="text-xs sm:text-sm font-bold">أدخل كلمة المرور الجديدة وتأكيدها أدناه</p>
                </div>

                <div className={inputCard}>
                  <span className={floatLabel}>كلمة المرور الجديدة</span>
                  <div className="flex items-center gap-3">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent outline-none text-base sm:text-lg font-bold text-slate-800 dark:text-white"
                    />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="text-slate-400 hover:text-[#0a66c2] transition-colors shrink-0">
                      {showNewPw ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                </div>

                <div className={inputCard}>
                  <span className={floatLabel}>تأكيد كلمة المرور الجديدة</span>
                  <div className="flex items-center gap-3">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent outline-none text-base sm:text-lg font-bold text-slate-800 dark:text-white"
                    />
                    <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="text-slate-400 hover:text-[#0a66c2] transition-colors shrink-0">
                      {showConfirmPw ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                </div>

                {confirmPassword && (
                  <div className={`flex items-center gap-2 text-xs sm:text-sm font-black px-1 ${newPassword === confirmPassword ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {newPassword === confirmPassword ? <CheckCircle2 size={15} /> : <X size={15} />}
                    <span>{newPassword === confirmPassword ? 'كلمتا المرور متطابقتان ✓' : 'كلمتا المرور غير متطابقتين'}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <button type="button" onClick={handleSavePassword} disabled={savingPassword} className={saveBtn}>
            <div className="flex items-center gap-1 text-blue-200"><ChevronsLeft size={24} /></div>
            <div className="flex items-center gap-2">
              {savingPassword && <Loader2 size={20} className="animate-spin text-blue-200" />}
              <span>{savingPassword ? (showChangePassword ? 'جاري حفظ كلمة المرور...' : 'جاري التحقق...') : (showChangePassword ? 'حفظ كلمة المرور الجديدة' : 'تحقق من كلمة المرور')}</span>
            </div>
          </button>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          CARD 4 — السيرة الذاتية (CV / Resume) — متاحة لجميع فئات الحسابات
          ══════════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.17 }}
        className={`${cardClass} p-6 sm:p-8 space-y-5 sm:space-y-6`}
      >
        <div className="flex items-center gap-3.5">
          <div className={iconBadge}><FileText size={22} /></div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">السيرة الذاتية (CV)</h2>
            <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
              {isMe ? 'رفع، استبدال، ومعاينة ملف السيرة بشكل احترافي' : 'ملف السيرة الذاتية المعتمد'}
            </p>
          </div>
        </div>

        {/* CV Upload Progress Bar */}
        {cvUploadProgress > 0 && cvUploadProgress < 100 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#0a66c2] dark:text-blue-400 flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin" />
                جاري رفع السيرة الذاتية...
              </span>
              <span className="text-[11px] font-bold text-slate-400">{cvUploadProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-l from-[#0a66c2] to-[#004182]"
                initial={{ width: 0 }}
                animate={{ width: `${cvUploadProgress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* CV Display Zone */}
        {cvUrl ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-50/80 to-slate-50 dark:from-[#0a66c2]/10 dark:to-slate-800/40 border border-blue-200/60 dark:border-blue-800/40 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0a66c2] to-[#004182] text-white flex items-center justify-center shadow-md shadow-[#0a66c2]/30">
                <FileText size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-slate-800 dark:text-white">ملف السيرة الذاتية (CV)</p>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 size={10} /> معتمد
                  </span>
                </div>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                  {pendingCVName ? `جديد: ${pendingCVName}` : 'متاح للعرض والتحميل المباشر'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-blue-100 dark:border-blue-900/40">
              <motion.button
                type="button"
                onClick={() => openCVModal()}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-[#0a66c2] dark:text-blue-300 rounded-xl text-xs font-black transition-all border border-blue-200 dark:border-blue-800 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer">
                <ExternalLink size={14} /><span>معاينة السيرة (ATS) ↗</span>
              </motion.button>
              {isAdmin && (
                <motion.button
                  type="button"
                  onClick={handleDownloadCV}
                  disabled={cvDownloading}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className="py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer">
                  {cvDownloading ? <Loader2 size={14} className="animate-spin text-[#0a66c2]" /> : <Download size={14} />}
                  <span>{cvDownloading ? 'جاري التحميل...' : 'تحميل الملف المرفق (للأدمن)'}</span>
                </motion.button>
              )}
              {isMe && isAdmin && (
                <label
                  htmlFor="cv-file-input"
                  className="col-span-2 sm:col-span-1 py-2.5 px-3 bg-gradient-to-l from-[#0a66c2] to-[#004182] hover:from-[#004182] hover:to-[#0a66c2] text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                >
                  <RefreshCw size={13} /><span>استبدال الملف</span>
                </label>
              )}
            </div>

            {isMe && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCVBuilder(true)}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-[#0a66c2] hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Sparkles size={15} />
                  <span>تعديل السيرة الذاتية الاحترافية (ATS) 📄</span>
                </button>
              </div>
            )}
          </div>
        ) : isAdmin ? (
          <label
            htmlFor={isMe ? "cv-file-input" : undefined}
            className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-800/60 bg-blue-50/30 dark:bg-blue-950/10 flex flex-col items-center justify-center text-center gap-3 transition-all ${isMe ? 'hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer active:scale-[0.99]' : ''}`}
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-[#0a66c2] dark:text-blue-300 flex items-center justify-center shadow-sm">
              <Upload size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-white">
                {isMe ? 'انقر لرفع ملف السيرة الذاتية (CV) [خاص بالإدارة]' : 'لم يتم رفع ملف سيرة ذاتية بعد'}
              </p>
              <p className="text-[11px] font-bold text-slate-400 mt-1">PDF أو Word — الحد الأقصى 25 ميغابايت</p>
              <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
                {isMe && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCVBuilder(true); }}
                    className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black transition-all active:scale-95 cursor-pointer shadow-md shadow-blue-500/20"
                  >
                    <Sparkles size={13} />
                    <span>إنشاء سيرة ذاتية احترافية (ATS) 📄</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowGeneratedCV(true); }}
                  className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-600 dark:text-blue-300 text-xs font-black transition-all active:scale-95 border border-blue-200 dark:border-blue-800 cursor-pointer shadow-xs"
                >
                  <FileText size={13} />
                  <span>معاينة السيرة الذاتية المنشأة بالمنصة ↗</span>
                </button>
              </div>
            </div>
          </label>
        ) : (
          <div className="p-6 sm:p-8 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-800/60 bg-blue-50/30 dark:bg-blue-950/10 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-[#0a66c2] dark:text-blue-300 flex items-center justify-center shadow-sm">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-white">
                السيرة الذاتية الرقمية المعتمدة (ATS)
              </p>
              <p className="text-[11px] font-bold text-slate-400 mt-1">منشأة وموثقة تلقائياً ومطابقة لمعايير أنظمة التوظيف الدولية</p>
              <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
                {isMe && (
                  <button
                    type="button"
                    onClick={() => setShowCVBuilder(true)}
                    className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black transition-all active:scale-95 cursor-pointer shadow-md shadow-blue-500/20"
                  >
                    <Sparkles size={13} />
                    <span>إنشاء / تعديل السيرة الذاتية (ATS) 📄</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowGeneratedCV(true)}
                  className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-600 dark:text-blue-300 text-xs font-black transition-all active:scale-95 border border-blue-200 dark:border-blue-800 cursor-pointer shadow-xs"
                >
                  <FileText size={13} />
                  <span>معاينة السيرة الذاتية المنشأة بالمنصة ↗</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {isMe && isAdmin && (
          <input
            id="cv-file-input"
            ref={cvInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleCVFileSelect}
          />
        )}

        {isMe && isAdmin && (pendingCVFile || cvUrl) && (
          <button type="button" onClick={handleSaveCV} disabled={savingCV} className={saveBtn}>
            <div className="flex items-center gap-1 text-blue-200"><ChevronsLeft size={22} /></div>
            <div className="flex items-center gap-2">
              {savingCV && <Loader2 size={18} className="animate-spin text-blue-200" />}
              <span>{savingCV ? 'جاري رفع السيرة الذاتية...' : 'حفظ السيرة الذاتية'}</span>
            </div>
          </button>
        )}
      </motion.div>
        </>
      ) : (
        /* ─── Posts & Articles Tab Content ─── */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {/* Header Action Bar */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-white">منشورات ومقالات {profile?.name}</h3>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                {profilePosts.length === 0 ? 'لا توجد مشاركات حتى الآن' : `${profilePosts.length} مشاركة منشورة`}
              </p>
            </div>
            {isMe && (
              <button
                type="button"
                onClick={() => { setActiveTab?.('home'); addToast('يمكنك كتابة مقال أو مشاركة صورة من صندوق النشر 🚀'); }}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-black rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileText size={14} />
                <span>+ مقال / منشور جديد</span>
              </button>
            )}
          </div>

          {/* Posts List / Empty State / Loader */}
          {loadingPosts ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="animate-spin text-[#0a66c2]" />
              <p className="text-xs font-bold text-slate-400">جاري تحميل المنشورات والمقالات...</p>
            </div>
          ) : profilePosts.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-sm">
                <FileText size={26} />
              </div>
              <h4 className="font-black text-sm text-slate-800 dark:text-white">لا توجد منشورات أو مقالات بعد</h4>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                {isMe ? 'شارك أفكارك المهنية، صورك، أو مقالاتك مع المجتمع المهني لزيادة فرصك.' : 'لم يقم هذا المستخدم بنشر أي مقالات أو صور حتى الآن.'}
              </p>
              {isMe && (
                <button
                  type="button"
                  onClick={() => { setActiveTab?.('home'); addToast('يمكنك كتابة مقال أو مشاركة صورة من صندوق النشر ✍️'); }}
                  className="mt-2 px-6 py-2.5 rounded-full bg-gradient-to-l from-[#0a66c2] to-[#004182] text-white text-xs font-black shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  كتابة أول مقال أو منشور ✍️
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {profilePosts.map((post, idx) => (
                <div
                  key={post.id || idx}
                  className="relative group cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                  onClick={() => {
                    const postIdx = profilePosts.findIndex((p: any) => p.id === post.id);
                    setProfilePostDetail({ items: profilePosts, index: Math.max(0, postIdx) });
                  }}
                >
                  <PostNewsCard
                    post={post}
                    allUsers={contextUsers || []}
                    onClick={(p: any) => {
                      const postIdx = profilePosts.findIndex((pp: any) => pp.id === p.id);
                      setProfilePostDetail({ items: profilePosts, index: Math.max(0, postIdx) });
                    }}
                    onDeletePost={isMe ? handleDeletePostInProfile : undefined}
                  />
                  {/* Open indicator */}
                  <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div className="bg-[#0a66c2] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                      <Eye size={10} />
                      <span>فتح</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ─── Visitor: Message Button (only when messaging is open) ─────────────── */}
      {!isMe && canUseMessaging && (
        <div className="pt-2">
          <button type="button" onClick={onMessageClick}
            className="w-full py-4 rounded-full bg-gradient-to-l from-[#0a66c2] to-[#004182] hover:from-[#004182] hover:to-[#0a66c2] text-white font-black text-base transition-all shadow-lg shadow-[#0a66c2]/30 active:scale-[0.98] flex items-center justify-center gap-2">
            <span>مراسلة وتواصل مباشر</span>
          </button>
        </div>
      )}

      {/* ── Modal تأكيد تغيير كلمة المرور (Portal حتى يظهر فوراً أمام المستخدم بغض النظر عن السكرول) ── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {passwordSuccessModal && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center space-y-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 size={36} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white">تم تغيير كلمة المرور بنجاح!</h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    تم تحديث وحفظ الرمز السري الجديد لحسابك بنجاح. يمكنك استخدامه لتسجيل الدخول في المرات القادمة.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordSuccessModal(false)}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer"
                >
                  حسناً، فهمت
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Professional Role Change Request Modal (Rendered via Portal to avoid scrolling) ── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showRoleModal && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <ArrowLeftRight size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      طلب تغيير نوع الحساب
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400">
                      يُرسل الطلب للإدارة لتوثيق وتحديث صلاحيات حسابك
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSendingRoleRequest}
                  onClick={() => setShowRoleModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Roles Flow Preview Badges */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                <div className="flex-1 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">الحساب الحالي</span>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {role === 'employer' ? 'صاحب عمل 💼' : 'باحث عن عمل 🔍'}
                  </span>
                </div>
                <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                  <ArrowLeftRight size={14} />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block mb-0.5">الحساب المطلوب</span>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                    {targetRoleToRequest === 'employer' ? 'صاحب عمل 💼' : 'باحث عن عمل 🔍'}
                  </span>
                </div>
              </div>

              {/* Notice note */}
              <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
                💡 {targetRoleToRequest === 'employer' 
                  ? 'حساب صاحب العمل يتيح لك نشر الوظائف، استلام طلبات التقديم، والتواصل مع المرشحين.'
                  : 'حساب الباحث عن عمل يتيح لك بناء سيرتك الذاتية، التقديم على الوظائف، واستكشاف الفرص المهنية.'}
              </div>

              {/* Reason Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 block">
                  {targetRoleToRequest === 'employer' 
                    ? 'اسم الشركة / المؤسسة أو سبب طلب الترقية:'
                    : 'سبب الرغبة في التحويل إلى باحث عن عمل:'}
                </label>
                <textarea
                  value={roleReason}
                  onChange={(e) => setRoleReason(e.target.value)}
                  placeholder={targetRoleToRequest === 'employer' 
                    ? 'مثال: شركة تقنية في بغداد نرغب بنشر وظائف للمطورين...'
                    : 'مثال: أرغب بالبحث والتقديم على فرص العمل المتاحة...'}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500 transition-all resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSendingRoleRequest}
                  onClick={() => setShowRoleModal(false)}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isSendingRoleRequest}
                  onClick={handleSubmitRoleRequest}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white text-xs font-black shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSendingRoleRequest ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>جاري الإرسال...</span>
                    </>
                  ) : (
                    <>
                      <span>إرسال الطلب للإدارة 🚀</span>
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

      {/* ── Post Detail Feed (opens from profile posts tab) ── */}
      {profilePostDetail && createPortal(
        <DetailFeedPage
          type="post"
          items={profilePostDetail.items}
          initialIndex={profilePostDetail.index}
          onClose={() => setProfilePostDetail(null)}
          onDeletePost={isMe ? handleDeletePostInProfile : undefined}
          appUser={appUser}
          allUsers={contextUsers || []}
        />,
        document.body
      )}

      {/* ── Platform Generated CV Modal ── */}
      <GeneratedCVModal
        isOpen={showGeneratedCV}
        onClose={() => setShowGeneratedCV(false)}
        user={profile}
      />

    </div>
  );
}
