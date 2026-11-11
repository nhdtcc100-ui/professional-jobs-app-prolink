import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Briefcase, MapPin, Phone, Lock, FileText, Pencil,
  ChevronsLeft, Upload, Download, Eye, CheckCircle2, Loader2,
  X, ExternalLink, Camera, RefreshCw,
  EyeOff, AlertCircle, WifiOff, KeyRound, ChevronDown, ChevronUp,
  Shield, Wrench
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { profileService } from '../../../lib/services/profileService';
import { cvService } from '../../../lib/services/cvService';
import { mobileUploadService } from '../../../lib/services/mobileUploadService';
import { AppUser, Post } from '../../../types';
import { useAppContext } from '../../../contexts/AppContext';
import { PostNewsCard } from '../PostNewsCard';

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
}

// ─── Fast Client-Side Image Resizer (Canvas-based, RAM efficient) ───────────
const resizeImageToCanvas = async (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.85
): Promise<{ file: File; buffer: ArrayBuffer }> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      file.arrayBuffer().then((buf) => resolve({ file, buffer: buf })).catch(reject);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        file.arrayBuffer().then((buf) => resolve({ file, buffer: buf })).catch(reject);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            const buf = await file.arrayBuffer();
            resolve({ file, buffer: buf });
            return;
          }
          const buffer = await blob.arrayBuffer();
          const cleanName = `${file.name.replace(/\.[^/.]+$/, '')}.jpg`;
          const resizedFile = new File([blob], cleanName, { type: 'image/jpeg' });
          (resizedFile as any)._ab = buffer;
          resolve({ file: resizedFile, buffer });
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = async () => {
      URL.revokeObjectURL(url);
      try {
        const buf = await file.arrayBuffer();
        resolve({ file, buffer: buf });
      } catch (e) {
        reject(e);
      }
    };

    img.src = url;
  });
};

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
}: ModernProfileViewProps) {
  // ─── Form State ───────────────────────────────────────────────────────────────
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

  const effectiveUserId = user?.id || profile?.id;

  // ─── Profile Tabs & Posts State ──────────────────────────────────────────────
  const [activeProfileTab, setActiveProfileTab] = useState<'info' | 'posts'>('info');
  const { posts: allContextPosts, allUsers: contextUsers, setPosts: setContextPosts, setActiveTab } = useAppContext();
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

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

  const handleDeletePostInProfile = (postId: string) => {
    setProfilePosts(prev => prev.filter(p => p.id !== postId));
    setContextPosts?.(prev => prev.filter(p => p.id !== postId));
  };

  // ─── فتح نافذة CV (معاينة حقيقية عبر Canvas بدون iframe أو جوجل دوكس) ────────
  // ─── فتح ومعاينة السيرة الذاتية (معاينة متزامنة ومستقرة تتجاوز حواجب النوافذ المنبثقة) ────────
  const openCVModal = async () => {
    const targetCvUrl = cvUrl || profile?.cvUrl || (profile as any)?.cv_url || '';
    if (!targetCvUrl && !pendingCVFile) {
      addToast('لا توجد سيرة ذاتية مرفوعة للمعاينة', 'error');
      return;
    }

    // 1. إذا كان الملف في ذاكرة الهاتف RAM
    if (pendingCVFile) {
      const u = URL.createObjectURL(pendingCVFile);
      window.open(u, '_blank');
      setTimeout(() => URL.revokeObjectURL(u), 60000);
      return;
    }

    // 2. إذا كان الرابط عاماً ومباشراً (يُفتح فوراً بشكل متزامن 100% دون فقدان تفويض اللمس)
    if (targetCvUrl.includes('/storage/v1/object/public/')) {
      const w = window.open(targetCvUrl, '_blank');
      if (!w) {
        const a = document.createElement('a');
        a.href = targetCvUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      return;
    }

    // 3. للروابط الخاصة التي تتطلب signedUrl:
    // فتح نافذة متزامنة فوراً أثناء حدث اللمس المباشر لضمان عدم حظرها
    const newWindow = window.open('about:blank', '_blank');

    let finalUrl = targetCvUrl;
    try {
      const markers = [
        { marker: '/storage/v1/object/sign/resumes/', bkt: 'resumes' },
        { marker: '/storage/v1/object/sign/applications/', bkt: 'applications' },
        { marker: '/resumes/', bkt: 'resumes' },
        { marker: '/applications/', bkt: 'applications' },
      ];
      for (const { marker, bkt } of markers) {
        if (targetCvUrl.includes(marker)) {
          const path = decodeURIComponent(targetCvUrl.split(marker)[1]?.split('?')[0] || '');
          if (path) {
            try {
              const { data } = await supabase.storage.from(bkt).createSignedUrl(path, 300);
              if (data?.signedUrl) finalUrl = data.signedUrl;
            } catch (_) {}
          }
          break;
        }
      }
    } catch (_) {}

    if (newWindow && !newWindow.closed) {
      try {
        newWindow.location.replace(finalUrl);
      } catch (_) {
        newWindow.location.href = finalUrl;
      }
    } else {
      const a = document.createElement('a');
      a.href = finalUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // ─── تحميل السيرة الذاتية بأمان وتنزيلها كملف بدون فضح روابط قواعد البيانات ────
  const handleDownloadCV = async () => {
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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ubeqmsyyyojojmswmidq.supabase.co';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZXFtc3l5eW9qb2ptc3dtaWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5NDMzNTcsImV4cCI6MjEwMzUxOTM1N30.sc4MWy_zn0bY3XaCZfwtt5kBTMSd84hiAfhevOwOj_0';

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

    // 2. التحقق من توكن الجلسة مع مهلة 3 ثوانٍ فقط لمنع أي تعليق
    let token = supabaseAnonKey;
    try {
      const sessRes = await withTimeout(supabase.auth.getSession(), 3000, 'فحص الجلسة');
      if (sessRes?.data?.session?.access_token) {
        token = sessRes.data.session.access_token;
      }
    } catch (authErr) {
      console.warn('[DirectUpload] Session check timed out, falling back to anon key:', authErr);
      token = supabaseAnonKey;
    }

    // 3. تحديد الامتداد الآمن واسم الحاوية
    const rawExt = (file.name || '').split('.').pop()?.toLowerCase() || (fileCategory === 'cv' ? 'pdf' : 'jpg');
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx'].includes(rawExt)
      ? rawExt
      : (fileCategory === 'cv' ? 'pdf' : 'jpg');

    const bucketName = fileCategory === 'cv' ? 'resumes' : 'profiles';
    const fileName = `${userId}_${fileCategory}_${Date.now()}.${safeExt}`;
    const contentType = file.type || (fileCategory === 'cv' ? 'application/pdf' : 'image/jpeg');

    // 4. الرفع المباشر عبر fetch مع تكرار المحاولة على المسار المجلد والمسار المسطح
    const candidatePaths = [
      `${userId}/${fileName}`,
      fileName,
    ];

    let uploadSuccess = false;
    let finalPath = candidatePaths[0];
    let lastErrorMsg = '';

    for (const testPath of candidatePaths) {
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${testPath}`;
      try {
        const res = await withTimeout(
          fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': contentType,
              'x-upsert': 'true',
            },
            body: buffer,
          }),
          15000,
          `طلب الرفع عبر الشبكة (${testPath})`
        );

        if (res.ok) {
          uploadSuccess = true;
          finalPath = testPath;
          break;
        }

        // إذا فشل التوكن المخصص، تجربة الرفع بـ Anon Key مباشرة مثل صفحة التشخيص الناجحة
        if (token !== supabaseAnonKey) {
          const resAnon = await withTimeout(
            fetch(uploadUrl, {
              method: 'POST',
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'Content-Type': contentType,
                'x-upsert': 'true',
              },
              body: buffer,
            }),
            15000,
            `طلب الرفع عبر Anon Key (${testPath})`
          );

          if (resAnon.ok) {
            uploadSuccess = true;
            finalPath = testPath;
            break;
          }
          lastErrorMsg = await resAnon.text();
        } else {
          lastErrorMsg = await res.text();
        }
      } catch (netErr: any) {
        lastErrorMsg = netErr?.message || String(netErr);
      }
    }

    if (!uploadSuccess) {
      throw new Error(`تعذر الرفع إلى Supabase: ${lastErrorMsg}`);
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${finalPath}?v=${Date.now()}`;
    return publicUrl;
  };

  // ─── Direct REST Database Update (تجاوز أقفال supabase-js وحفظ التعديل في 100ms) ───
  const updateProfileDbFieldDirect = async (
    userId: string,
    field: 'avatar' | 'cover' | 'cv' | 'role',
    value: string
  ): Promise<{ status: number; duration: number }> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ubeqmsyyyojojmswmidq.supabase.co';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZXFtc3l5eW9qb2ptc3dtaWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5NDMzNTcsImV4cCI6MjEwMzUxOTM1N30.sc4MWy_zn0bY3XaCZfwtt5kBTMSd84hiAfhevOwOj_0';

    // 1. أخذ التوكن فورياً وبشكل متزامن من localStorage دون انتظار أي قفل
    let token = supabaseAnonKey;
    try {
      const raw = localStorage.getItem('prolink_v2_auth_session') ||
                  localStorage.getItem('sb-ubeqmsyyyojojmswmidq-auth-token');
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
        if (field === 'role') { u.role = value; }
        localStorage.setItem('prolink_cached_user', JSON.stringify(u));
      }
    } catch (_) {}

    return { status: resStatus, duration };
  };

  // ─── تغيير نوع الحساب (التحويل إلى صاحب عمل يتطلب موافقة الأدمن) ─────────────
  const handleRoleChange = async (newRole: 'seeker' | 'employer') => {
    if (!isMe || !effectiveUserId || savingRole || newRole === role) return;
    try { navigator.vibrate?.([10]); } catch (_) {}

    // 🔒 إذا كان الحساب باحثاً عن عمل ويريد الترقية إلى صاحب عمل -> إرسال طلب للإدارة
    if (newRole === 'employer' && role === 'seeker') {
      const companyPrompt = window.prompt('يرجى كتابة اسم المؤسسة أو سبب طلب الترقية إلى حساب "صاحب عمل":');
      if (companyPrompt === null) return;

      setSavingRole(true);
      try {
        const { error } = await profileService.sendRoleChangeRequest(
          effectiveUserId,
          name || profile?.name || 'مستخدم',
          avatar || profile?.avatar || '',
          role,
          'employer',
          companyPrompt.trim() || 'طلب ترقية إلى صاحب عمل لنشر وإدارة الوظائف'
        );
        if (error) throw error;
        addToast('📨 تم إرسال طلب الترقية إلى صاحب عمل للإدارة بنجاح! سيتم التفعيل فور المراجعة.', 'success');
      } catch (err: any) {
        addToast('فشل إرسال الطلب: ' + (err?.message || 'خطأ غير معروف'), 'error');
      } finally {
        setSavingRole(false);
      }
      return;
    }

    const oldRole = role;
    setRole(newRole);
    setSavingRole(true);
    try {
      await withTimeout(
        updateProfileDbFieldDirect(effectiveUserId, 'role', newRole),
        8000,
        'تحديث نوع الحساب'
      );
      if (setAppUser) {
        setAppUser((prev: any) => ({ ...prev, role: newRole }));
      }
      addToast('✅ تم تحويل الحساب إلى باحث عن عمل 🔍 بنجاح!', 'success');
    } catch (err: any) {
      console.error('[RoleChange] error:', err);
      setRole(oldRole);
      addToast('فشل تحديث نوع الحساب: ' + (err?.message || 'خطأ في الشبكة'), 'error');
    } finally {
      setSavingRole(false);
    }
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
    if (isAvatar) setIsUploadingAvatar(true);
    else setIsUploadingCover(true);

    try {
      // 1. Fast Canvas Resize & RAM snapshot (400x400 for avatar, 1200x600 for cover)
      const maxWidth = isAvatar ? 400 : 1200;
      const maxHeight = isAvatar ? 400 : 600;

      let workingFile = rawFile;
      try {
        const { file: resized, buffer } = await withTimeout(
          resizeImageToCanvas(rawFile, maxWidth, maxHeight, 0.85),
          7000,
          `معالجة وتصغير ${isAvatar ? 'الصورة الشخصية' : 'صورة الغلاف'}`
        );
        workingFile = resized;
        (workingFile as any)._ab = buffer;
      } catch (resizeErr) {
        console.warn(`[${kind}Upload] Client resize warning, using raw file:`, resizeErr);
        workingFile = rawFile;
      }

      // 2. Direct upload to Supabase with unique timestamped path
      const publicUrl = await withTimeout(
        handleMobileDirectUpload(workingFile, kind, effectiveUserId),
        25000,
        `رفع ${isAvatar ? 'الصورة الشخصية' : 'صورة الغلاف'} عبر الشبكة`
      );

      // 3. Immediate local state update for instantaneous UI feedback
      if (isAvatar) {
        setAvatar(publicUrl);
      } else {
        setCoverUrl(publicUrl);
      }

      // 4. Update Database via direct REST with return=representation verification
      await withTimeout(
        updateProfileDbFieldDirect(effectiveUserId, kind, publicUrl),
        8000,
        'تحديث قاعدة البيانات REST'
      );

      // 5. Update global app user
      if (setAppUser) {
        setAppUser((prev: any) => ({
          ...prev,
          ...(isAvatar
            ? { avatar: publicUrl, avatar_url: publicUrl }
            : { cover_url: publicUrl, coverUrl: publicUrl }),
        }));
      }

      addToast(
        isAvatar ? '✅ تم تحديث الصورة الشخصية بنجاح!' : '✅ تم تحديث صورة الغلاف بنجاح!',
        'success'
      );
    } catch (err: any) {
      console.error(`[${kind}Upload] Upload error:`, err);
      const errMsg = err?.message || JSON.stringify(err);
      const isTimeout = errMsg?.includes('TIMEOUT');
      addToast(
        isTimeout
          ? 'انتهت المهلة، يرجى المحاولة مجدداً أو التحقق من الاتصال.'
          : `تعذر تحديث ${isAvatar ? 'الصورة الشخصية' : 'صورة الغلاف'}: ${errMsg}`,
        'error'
      );
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
      try {
        setIsUploadingAvatar(true);
        const { preview, uploadPromise } = await mobileUploadService.pickAndUpload('avatar', { userId: effectiveUserId });
        if (preview) setAvatar(preview);
        const finalUrl = await uploadPromise;
        setAvatar(finalUrl);
        await profileService.updateProfile(effectiveUserId, { avatar: finalUrl, avatar_url: finalUrl });
        if (setAppUser) setAppUser((prev: any) => ({ ...prev, avatar: finalUrl, avatar_url: finalUrl }));
        addToast('✅ تم تحديث الصورة الشخصية بنجاح!', 'success');
      } catch (err: any) {
        if (!err?.message?.includes('cancel') && !err?.message?.includes('User cancel')) {
          addToast('تعذر تغيير الصورة: ' + (err?.message || ''), 'error');
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
      try {
        setIsUploadingCover(true);
        const { preview, uploadPromise } = await mobileUploadService.pickAndUpload('cover', { userId: effectiveUserId });
        if (preview) setCoverUrl(preview);
        const finalUrl = await uploadPromise;
        setCoverUrl(finalUrl);
        await profileService.updateProfile(effectiveUserId, { cover_url: finalUrl, coverUrl: finalUrl } as any);
        if (setAppUser) setAppUser((prev: any) => ({ ...prev, cover_url: finalUrl, coverUrl: finalUrl }));
        addToast('✅ تم تحديث صورة الغلاف بنجاح!', 'success');
      } catch (err: any) {
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

  // ─── 6. Change Password ───────────────────────────────────────────────────────
  const handleSavePassword = async () => {
    if (!currentPassword) { addToast('يرجى إدخال كلمة المرور الحالية', 'error'); return; }
    if (showChangePassword) {
      if (!newPassword) { addToast('يرجى إدخال كلمة المرور الجديدة', 'error'); return; }
      if (newPassword.length < 8) { addToast('كلمة المرور يجب أن لا تقل عن 8 أحرف', 'error'); return; }
      if (newPassword !== confirmPassword) { addToast('كلمتا المرور غير متطابقتين', 'error'); return; }
    }
    try {
      setSavingPassword(true);
      const email = user?.email || profile?.email || '';
      const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (verifyErr) {
        addToast('كلمة المرور الحالية غير صحيحة ❌', 'error');
        return;
      }
      if (showChangePassword && newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        setNewPassword('');
        setConfirmPassword('');
        setShowChangePassword(false);
        addToast('✅ تم تحديث كلمة المرور بنجاح!', 'success');
      } else {
        addToast('✅ تم التحقق من كلمة المرور بنجاح!', 'success');
      }
      setCurrentPassword('');
    } catch (err: any) {
      addToast('تعذر تغيير كلمة المرور: ' + (err?.message || ''), 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  // ─── Shared Styles — using app brand blue #0a66c2 ────────────────────────────
  const cardClass = 'bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-[0_4px_24px_rgba(10,102,194,0.08)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)]';
  const inputCard = 'relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 px-4 py-3.5 focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/15 transition-all duration-200';
  const floatLabel = 'absolute -top-2.5 right-4 bg-white dark:bg-slate-900 px-2 text-[11px] font-bold text-slate-400';
  const saveBtn = 'w-full py-4 rounded-full bg-gradient-to-l from-[#0a66c2] to-[#004182] hover:from-[#004182] hover:to-[#0a66c2] text-white font-black text-base transition-all shadow-lg shadow-[#0a66c2]/30 dark:shadow-[#0a66c2]/20 active:scale-[0.98] flex items-center justify-between px-6 cursor-pointer disabled:opacity-60';
  const iconBadge = 'w-10 h-10 rounded-full bg-gradient-to-br from-[#0a66c2] to-[#004182] flex items-center justify-center text-white shadow-md shadow-[#0a66c2]/30 shrink-0';

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 pb-28 pt-2 md:pt-4 px-3 sm:px-4" dir="rtl">

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
          className="relative h-48 sm:h-56 w-full overflow-hidden group"
          style={{ background: 'linear-gradient(135deg, #0a66c2 0%, #004182 60%, #001e3c 100%)' }}
        >
          {coverUrl ? (
            <img src={coverUrl} alt="cover" className="w-full h-full object-cover object-center" />
          ) : (
            <div className="absolute inset-0 overflow-hidden">
              {/* Professional decorative pattern */}
              <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-white/5" />
              <div className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full bg-white/5" />
              <div className="absolute top-1/2 left-1/2 w-32 h-32 rounded-full bg-white/5 -translate-x-1/2 -translate-y-1/2" />
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '28px 28px' }}
              />
            </div>
          )}
          {/* Upload overlay on hover */}
          {isMe && !isUploadingCover && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-all duration-300 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center gap-2 text-white">
                <Camera size={24} />
                <span className="text-xs font-bold">تغيير صورة الغلاف</span>
              </div>
            </div>
          )}
          {isUploadingCover && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <Loader2 size={30} className="text-white animate-spin" />
            </div>
          )}
          {isMe && (
            <label
              htmlFor="cover-file-input"
              className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white text-xs font-bold backdrop-blur-sm transition-all border border-white/20 active:scale-95 cursor-pointer shadow-lg"
            >
              <Camera size={13} />
              <span>تغيير الغلاف</span>
              <input id="cover-file-input" ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
            </label>
          )}
        </div>

        {/* ── Avatar + Card Content ──────────────────────────────────────────── */}
        <div className="px-5 sm:px-7 pb-6 pt-0 space-y-5">
          {/* صف الأفاتار فقط — يرتفع فوق الغلاف بـ -mt-12 */}
          <div className="flex items-end justify-between -mt-12 sm:-mt-14">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 ring-4 ring-white dark:ring-slate-900 shadow-xl shadow-[#0a66c2]/20">
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
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-3xl backdrop-blur-xs">
                  <Loader2 size={24} className="text-white animate-spin" />
                </div>
              )}
              {isMe && (
                <label
                  htmlFor="avatar-file-input"
                  className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-gradient-to-br from-[#0a66c2] to-[#004182] text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 transition-all active:scale-90 cursor-pointer hover:scale-110"
                  title="تغيير الصورة الشخصية"
                >
                  <Camera size={15} />
                  <input id="avatar-file-input" ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              )}
            </div>
          </div>

          {/* ── نوع الحساب (Account Type Segmented Control) ── */}
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
        className={`${cardClass} p-5 sm:p-7 space-y-4`}
      >
        <div className="flex items-center gap-3">
          <div className={iconBadge}><Phone size={18} /></div>
          <h2 className="text-base font-black text-slate-800 dark:text-white">
            {isMe ? 'تغيير رقم الهاتف' : 'رقم الهاتف'}
          </h2>
        </div>

        <div className={inputCard}>
          <span className={floatLabel}>رقم الهاتف</span>
          <div className="flex items-center gap-3">
            {isMe ? (
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXXX" dir="ltr"
                className="w-full bg-transparent outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-white text-right" />
            ) : (
              <p className="w-full text-sm sm:text-base font-bold text-slate-800 dark:text-white text-right" dir="ltr">{phone || '—'}</p>
            )}
            <Phone size={17} className="text-slate-400 shrink-0" />
          </div>
        </div>

        {isMe ? (
          <button type="button" onClick={handleSavePhone} disabled={savingPhone} className={saveBtn}>
            <div className="flex items-center gap-1 text-blue-200"><ChevronsLeft size={22} /></div>
            <div className="flex items-center gap-2">
              {savingPhone && <Loader2 size={18} className="animate-spin text-blue-200" />}
              <span>{savingPhone ? 'جاري الحفظ...' : 'حفظ'}</span>
            </div>
          </button>
        ) : (
          showCallButton && phone && (
            <button type="button" onClick={onCallClick}
              className="w-full py-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer">
              <Phone size={18} /><span>اتصال برقم الهاتف</span>
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
          className={`${cardClass} p-5 sm:p-7 space-y-4`}
        >
          <div className="flex items-center gap-3">
            <div className={iconBadge}><Lock size={18} /></div>
            <h2 className="text-base font-black text-slate-800 dark:text-white">تغيير كلمة المرور</h2>
          </div>

          {/* كلمة المرور الحالية — دائماً ظاهرة */}
          <div className={inputCard}>
            <span className={floatLabel}>كلمة المرور الحالية</span>
            <div className="flex items-center gap-3">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الحالية"
                className="w-full bg-transparent outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-white"
              />
              <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="text-slate-400 hover:text-[#0a66c2] transition-colors shrink-0">
                {showCurrentPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* زر تبديل — تغيير كلمة المرور */}
          <button
            type="button"
            onClick={() => setShowChangePassword(!showChangePassword)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 text-sm font-bold transition-all hover:border-[#0a66c2]/40 hover:bg-blue-50/40 dark:hover:bg-slate-700 active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <KeyRound size={15} className="text-[#0a66c2]" />
              <span>إذا أردت تغيير كلمة المرور</span>
            </div>
            {showChangePassword
              ? <ChevronUp size={16} className="text-[#0a66c2]" />
              : <ChevronDown size={16} className="text-slate-400" />}
          </button>

          {/* حقول كلمة المرور الجديدة — قابلة للطي */}
          <AnimatePresence>
            {showChangePassword && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden space-y-4"
              >
                <div className="flex items-center gap-2 text-[#0a66c2]/80 dark:text-blue-400/80 bg-blue-50 dark:bg-blue-950/30 rounded-xl px-3 py-2.5 border border-blue-100 dark:border-blue-900/40">
                  <AlertCircle size={14} className="shrink-0" />
                  <p className="text-[11px] font-bold">أدخل كلمة المرور الجديدة أدناه لتغييرها</p>
                </div>

                <div className={inputCard}>
                  <span className={floatLabel}>كلمة المرور الجديدة</span>
                  <div className="flex items-center gap-3">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-white"
                    />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="text-slate-400 hover:text-[#0a66c2] transition-colors shrink-0">
                      {showNewPw ? <EyeOff size={17} /> : <Eye size={17} />}
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
                      className="w-full bg-transparent outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-white"
                    />
                    <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="text-slate-400 hover:text-[#0a66c2] transition-colors shrink-0">
                      {showConfirmPw ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {confirmPassword && (
                  <div className={`flex items-center gap-2 text-xs font-bold px-1 ${newPassword === confirmPassword ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {newPassword === confirmPassword ? <CheckCircle2 size={13} /> : <X size={13} />}
                    <span>{newPassword === confirmPassword ? 'كلمتا المرور متطابقتان ✓' : 'كلمتا المرور غير متطابقتين'}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <button type="button" onClick={handleSavePassword} disabled={savingPassword} className={saveBtn}>
            <div className="flex items-center gap-1 text-blue-200"><ChevronsLeft size={22} /></div>
            <div className="flex items-center gap-2">
              {savingPassword && <Loader2 size={18} className="animate-spin text-blue-200" />}
              <span>{savingPassword ? 'جاري التحقق...' : (showChangePassword ? 'حفظ كلمة المرور' : 'تحقق من كلمة المرور')}</span>
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
        className={`${cardClass} p-5 sm:p-7 space-y-4`}
      >
        <div className="flex items-center gap-3">
          <div className={iconBadge}><FileText size={18} /></div>
          <div>
            <h2 className="text-base font-black text-slate-800 dark:text-white">السيرة الذاتية (CV)</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-blue-100 dark:border-blue-900/40">
              <motion.button
                type="button"
                onClick={() => openCVModal()}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-[#0a66c2] dark:text-blue-300 rounded-xl text-xs font-black transition-all border border-blue-200 dark:border-blue-800 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer">
                <ExternalLink size={14} /><span>معاينة السيرة ↗</span>
              </motion.button>
              <motion.button
                type="button"
                onClick={handleDownloadCV}
                disabled={cvDownloading}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer">
                {cvDownloading ? <Loader2 size={14} className="animate-spin text-[#0a66c2]" /> : <Download size={14} />}
                <span>{cvDownloading ? 'جاري التحميل...' : 'تحميل CV'}</span>
              </motion.button>
              {isMe && (
                <label
                  htmlFor="cv-file-input"
                  className="col-span-2 sm:col-span-1 py-2.5 px-3 bg-gradient-to-l from-[#0a66c2] to-[#004182] hover:from-[#004182] hover:to-[#0a66c2] text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                >
                  <RefreshCw size={13} /><span>استبدال الملف</span>
                </label>
              )}
            </div>
          </div>
        ) : (
          <label
            htmlFor={isMe ? "cv-file-input" : undefined}
            className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-800/60 bg-blue-50/30 dark:bg-blue-950/10 flex flex-col items-center justify-center text-center gap-3 transition-all ${isMe ? 'hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer active:scale-[0.99]' : ''}`}
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-[#0a66c2] dark:text-blue-300 flex items-center justify-center shadow-sm">
              <Upload size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-white">
                {isMe ? 'انقر لرفع ملف السيرة الذاتية (CV)' : 'لم يتم رفع ملف سيرة ذاتية بعد'}
              </p>
              <p className="text-[11px] font-bold text-slate-400 mt-1">PDF أو Word — الحد الأقصى 25 ميغابايت</p>
            </div>
          </label>
        )}

        {isMe && (
          <input
            id="cv-file-input"
            ref={cvInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleCVFileSelect}
          />
        )}

        {isMe && (pendingCVFile || cvUrl) && (
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
                <PostNewsCard
                  key={post.id || idx}
                  post={post}
                  allUsers={contextUsers || []}
                  onClick={() => {}}
                  onDeletePost={isMe ? handleDeletePostInProfile : undefined}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ─── Visitor: Message Button ─────────────────────────────────────────────── */}
      {!isMe && (
        <div className="pt-2">
          <button type="button" onClick={onMessageClick}
            className="w-full py-4 rounded-full bg-gradient-to-l from-[#0a66c2] to-[#004182] hover:from-[#004182] hover:to-[#0a66c2] text-white font-black text-base transition-all shadow-lg shadow-[#0a66c2]/30 active:scale-[0.98] flex items-center justify-center gap-2">
            <span>مراسلة وتواصل مباشر</span>
          </button>
        </div>
      )}

    </div>
  );
}
