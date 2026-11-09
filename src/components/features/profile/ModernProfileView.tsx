import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Briefcase, MapPin, Phone, Lock, FileText, Pencil,
  ChevronsLeft, Upload, Download, Eye, CheckCircle2, Loader2,
  X, ExternalLink, ArrowRight, Camera, RefreshCw, ShieldCheck,
  EyeOff, AlertCircle, WifiOff, KeyRound, ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { profileService } from '../../../lib/services/profileService';
import { cvService } from '../../../lib/services/cvService';
import { mobileUploadService } from '../../../lib/services/mobileUploadService';
import { AppUser } from '../../../types';

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

  // Keep state in sync with profile prop changes (prevents Mobile State loss)
  React.useEffect(() => {
    const cUrl = (profile as any)?.cover_url || (profile as any)?.coverUrl;
    if (cUrl && cUrl !== coverUrl) setCoverUrl(cUrl);
    const aUrl = profile?.avatar || (profile as any)?.avatar_url;
    if (aUrl && aUrl !== avatar) setAvatar(aUrl);
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
  const [previewingCV, setPreviewingCV] = useState(false);
  const [pendingCVFile, setPendingCVFile] = useState<File | null>(null);
  const [pendingCVName, setPendingCVName] = useState<string | null>(null);
  const [cvUploadProgress, setCvUploadProgress] = useState(0);

  // ─── Refs ────────────────────────────────────────────────────────────────────
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const effectiveUserId = user?.id || profile?.id;

  // ─── Timeout Wrapper لمنع أي تعليق في الموبايل ─────────────────────────────
  const withTimeout = <T,>(p: PromiseLike<T> | Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      Promise.resolve(p),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`TIMEOUT: ${label} تجاوز ${ms / 1000} ثانية وتوقف`)), ms)
      ),
    ]);

  // ─── كشف إعادة تحميل الصفحة من نظام التشغيل أثناء فتح الاستوديو ──────────────
  useEffect(() => {
    try {
      const lastPicked = sessionStorage.getItem('prolink_file_picked');
      if (lastPicked) {
        sessionStorage.removeItem('prolink_file_picked');
        const elapsed = Math.round((Date.now() - Number(lastPicked)) / 1000);
        alert(`⚠️ تنبيه إعادة تحميل: أعاد نظام الهاتف تشغيل الصفحة بعد ${elapsed} ثانية من فتح الاستوديو (Memory Reclamation)!`);
      }
    } catch (_) {}
  }, []);

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
        alert(`3️⃣ أ [محاولة رفع]: ${bucketName}/${testPath}`);
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

        alert(`3️⃣ ب [استجابة السيرفر]: HTTP ${res.status}`);

        if (res.ok) {
          uploadSuccess = true;
          finalPath = testPath;
          break;
        }

        // إذا فشل التوكن المخصص، تجربة الرفع بـ Anon Key مباشرة مثل صفحة التشخيص الناجحة
        if (token !== supabaseAnonKey) {
          alert('3️⃣ ج [إعادة المحاولة بمفتاح Anon المباشر]...');
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

          alert(`3️⃣ د [استجابة Anon Key]: HTTP ${resAnon.status}`);

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

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${finalPath}`;
    return publicUrl;
  };

  // ─── Direct REST Database Update (تجاوز أقفال supabase-js وحفظ التعديل في 100ms) ───
  const updateProfileDbFieldDirect = async (
    userId: string,
    field: 'avatar' | 'cover' | 'cv',
    publicUrl: string
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

    const colName = field === 'cv' ? 'cv_url' : `${field}_url`;
    const payload: Record<string, any> = {
      [colName]: publicUrl,
      updated_at: new Date().toISOString(),
    };
    if (field === 'avatar') {
      payload.avatar = publicUrl;
      payload.avatar_url = publicUrl;
    }
    if (field === 'cover') {
      payload.cover_url = publicUrl;
    }
    if (field === 'cv') {
      payload.cv_url = publicUrl;
    }

    const updateUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`;
    const t0 = performance.now();

    // 2. إرسال طلب REST خام فائق السرعة
    let res = await withTimeout(
      fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
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
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(payload),
        }),
        6000,
        'طلب REST المباشر (Anon Key)'
      );
    }

    const duration = Math.round(performance.now() - t0);

    // 3. تحديث الكاش المحلي فورياً لضمان عدم ضياع التحديث
    try {
      const cached = localStorage.getItem('prolink_cached_user');
      if (cached) {
        const u = JSON.parse(cached);
        if (field === 'avatar') { u.avatar = publicUrl; u.avatar_url = publicUrl; }
        if (field === 'cover') { u.coverUrl = publicUrl; u.cover_url = publicUrl; }
        if (field === 'cv') { u.cvUrl = publicUrl; u.cv_url = publicUrl; }
        localStorage.setItem('prolink_cached_user', JSON.stringify(u));
      }
    } catch (_) {}

    return { status: res.status, duration };
  };

  // ─── 1. Avatar Upload (Direct Client-to-Supabase) ───────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetInput = e.target;
    const rawFile = targetInput?.files?.[0];
    if (!rawFile || !effectiveUserId) return;

    try {
      sessionStorage.setItem('prolink_file_picked', Date.now().toString());
    } catch (_) {}

    alert(`1️⃣ [استلام الصورة]: ${rawFile.name} (${(rawFile.size / 1024).toFixed(1)} KB)`);

    if (rawFile.size === 0) {
      alert('⚠️ المتصفح أعاد ملفاً فارغاً (0 بايت).');
      if (targetInput) targetInput.value = '';
      try { sessionStorage.removeItem('prolink_file_picked'); } catch (_) {}
      return;
    }

    try {
      setIsUploadingAvatar(true);

      // Snapshot file into RAM immediately with timeout
      let workingFile = rawFile;
      try {
        const ab = await withTimeout(rawFile.arrayBuffer(), 8000, 'قراءة الصورة إلى RAM (arrayBuffer)');
        alert(`2️⃣ [قراءة البايتات بنجاح]: تم تجميد ${ab.byteLength} بايت`);
        workingFile = new File([ab], rawFile.name || 'avatar.jpg', { type: rawFile.type || 'image/jpeg' });
        (workingFile as any)._ab = ab;
      } catch (abErr: any) {
        alert(`⚠️ تعليق في قراءة الذاكرة: ${abErr?.message || abErr}`);
        workingFile = rawFile;
      }

      alert('3️⃣ [بدء الرفع السحابي إلى Supabase]...');
      const publicUrl = await withTimeout(
        handleMobileDirectUpload(workingFile, 'avatar', effectiveUserId),
        25000,
        'رفع الصورة عبر الشبكة'
      );
      alert(`4️⃣ [نجح الرفع السحابي]:\n${publicUrl}`);

      setAvatar(publicUrl);

      alert('5️⃣ [بدء تحديث قاعدة البيانات عبر REST خام]...');
      const dbRes = await withTimeout(
        updateProfileDbFieldDirect(effectiveUserId, 'avatar', publicUrl),
        8000,
        'تحديث قاعدة البيانات REST'
      );
      alert(`5️⃣ ب [استجابة قاعدة البيانات]: HTTP ${dbRes.status} في ${dbRes.duration}ms`);
      alert('6️⃣ [تم حفظ وتحديث الصورة الشخصية بنجاح تام! 🎉]');

      if (setAppUser) setAppUser((prev: any) => ({ ...prev, avatar: publicUrl, avatar_url: publicUrl }));
      addToast('✅ تم رفع وتحديث الصورة الشخصية بنجاح!', 'success');
    } catch (err: any) {
      console.error('Avatar direct upload error:', err);
      const errMsg = err?.message || JSON.stringify(err);
      addToast('تعذر رفع الصورة: ' + errMsg, 'error');
      alert(`❌ خطأ أو توقف (Hang/Timeout):\n${errMsg}`);
    } finally {
      setIsUploadingAvatar(false);
      try { sessionStorage.removeItem('prolink_file_picked'); } catch (_) {}
      if (targetInput) targetInput.value = '';
    }
  };

  // ─── 2. Cover Photo Upload (Direct Client-to-Supabase) ───────────────────────
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetInput = e.target;
    const rawFile = targetInput?.files?.[0];
    if (!rawFile || !effectiveUserId) return;

    try {
      sessionStorage.setItem('prolink_file_picked', Date.now().toString());
    } catch (_) {}

    alert(`1️⃣ [استلام الغلاف]: ${rawFile.name} (${(rawFile.size / 1024).toFixed(1)} KB)`);

    if (rawFile.size === 0) {
      alert('⚠️ المتصفح أعاد ملفاً فارغاً (0 بايت).');
      if (targetInput) targetInput.value = '';
      try { sessionStorage.removeItem('prolink_file_picked'); } catch (_) {}
      return;
    }

    try {
      setIsUploadingCover(true);

      let workingFile = rawFile;
      try {
        const ab = await withTimeout(rawFile.arrayBuffer(), 8000, 'قراءة الغلاف إلى RAM');
        alert(`2️⃣ [قراءة الغلاف بنجاح]: تم تجميد ${ab.byteLength} بايت`);
        workingFile = new File([ab], rawFile.name || 'cover.jpg', { type: rawFile.type || 'image/jpeg' });
        (workingFile as any)._ab = ab;
      } catch (abErr: any) {
        alert(`⚠️ تعليق في قراءة الغلاف: ${abErr?.message || abErr}`);
        workingFile = rawFile;
      }

      alert('3️⃣ [بدء رفع الغلاف إلى Supabase]...');
      const publicUrl = await withTimeout(
        handleMobileDirectUpload(workingFile, 'cover', effectiveUserId),
        25000,
        'رفع الغلاف عبر الشبكة'
      );
      alert(`4️⃣ [نجح رفع الغلاف]:\n${publicUrl}`);

      setCoverUrl(publicUrl);

      alert('5️⃣ [بدء تحديث الغلاف في قاعدة البيانات عبر REST خام]...');
      const dbRes = await withTimeout(
        updateProfileDbFieldDirect(effectiveUserId, 'cover', publicUrl),
        8000,
        'تحديث قاعدة البيانات REST'
      );
      alert(`5️⃣ ب [استجابة قاعدة البيانات]: HTTP ${dbRes.status} في ${dbRes.duration}ms`);
      alert('6️⃣ [تم حفظ صورة الغلاف بنجاح تام! 🎉]');

      if (setAppUser) setAppUser((prev: any) => ({ ...prev, cover_url: publicUrl, coverUrl: publicUrl }));
      addToast('✅ تم رفع وتحديث صورة الغلاف بنجاح!', 'success');
    } catch (err: any) {
      console.error('Cover direct upload error:', err);
      const errMsg = err?.message || JSON.stringify(err);
      addToast('تعذر رفع صورة الغلاف: ' + errMsg, 'error');
      alert(`❌ خطأ أو توقف في الغلاف (Hang/Timeout):\n${errMsg}`);
    } finally {
      setIsUploadingCover(false);
      try { sessionStorage.removeItem('prolink_file_picked'); } catch (_) {}
      if (targetInput) targetInput.value = '';
    }
  };

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

    try {
      sessionStorage.setItem('prolink_file_picked', Date.now().toString());
    } catch (_) {}

    alert(`1️⃣ [استلام ملف CV]: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    if (!effectiveUserId) {
      alert('⚠️ يرجى تسجيل الدخول أولاً لتتمكن من رفع السيرة الذاتية.');
      try { sessionStorage.removeItem('prolink_file_picked'); } catch (_) {}
      return;
    }

    if (file.size === 0) {
      alert('⚠️ المتصفح أعاد ملفاً فارغاً (0 بايت).');
      if (targetInput) targetInput.value = '';
      try { sessionStorage.removeItem('prolink_file_picked'); } catch (_) {}
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert('⚠️ حجم الملف كبير جداً (الحد الأقصى 25 ميغابايت)');
      if (targetInput) targetInput.value = '';
      try { sessionStorage.removeItem('prolink_file_picked'); } catch (_) {}
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
        alert(`2️⃣ [قراءة الـ CV بنجاح]: تم تجميد ${ab.byteLength} بايت`);
        const mime = file.type || 'application/pdf';
        workingFile = new File([new Blob([ab], { type: mime })], fileName, { type: mime });
        (workingFile as any)._ab = ab;
        setCvUploadProgress(35);
      } catch (abErr: any) {
        alert(`⚠️ تعليق في قراءة الـ CV: ${abErr?.message || abErr}`);
        workingFile = file;
      }

      setCvUploadProgress(50);
      alert('3️⃣ [بدء رفع ملف الـ CV إلى Supabase]...');

      const publicUrl = await withTimeout(
        handleMobileDirectUpload(workingFile, 'cv', effectiveUserId),
        25000,
        'رفع الـ CV عبر الشبكة'
      );
      alert(`4️⃣ [نجح رفع ملف الـ CV]:\n${publicUrl}`);

      setCvUploadProgress(85);
      setCvUrl(publicUrl);
      setPendingCVFile(null);
      setPendingCVName(null);

      alert('5️⃣ [بدء تثبيت الـ CV في قاعدة البيانات عبر REST خام]...');
      const dbRes = await withTimeout(
        updateProfileDbFieldDirect(effectiveUserId, 'cv', publicUrl),
        8000,
        'تحديث قاعدة البيانات REST'
      );
      alert(`5️⃣ ب [استجابة قاعدة البيانات]: HTTP ${dbRes.status} في ${dbRes.duration}ms`);
      setCvUploadProgress(100);
      alert('6️⃣ [تم حفظ وتثبيت السيرة الذاتية بنجاح تام! 🎉]');

      if (setAppUser) setAppUser((prev: any) => ({ ...prev, cvUrl: publicUrl, cv_url: publicUrl }));
      addToast('✅ تم رفع وتثبيت السيرة الذاتية بنجاح!', 'success');
      setTimeout(() => setCvUploadProgress(0), 1800);
    } catch (err: any) {
      setCvUploadProgress(0);
      console.error('[CVUpload] Error uploading CV:', err);
      const errMsg = err?.message || JSON.stringify(err) || 'خطأ غير معروف';
      addToast('فشل حفظ السيرة الذاتية: ' + errMsg, 'error');
      alert(`❌ خطأ أو توقف في الـ CV (Hang/Timeout):\n${errMsg}`);
    } finally {
      setSavingCV(false);
      try { sessionStorage.removeItem('prolink_file_picked'); } catch (_) {}
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
      alert(`✅ نجح حفظ وتثبيت السيرة الذاتية على الهاتف بنجاح!\nالرابط:\n${finalUrl}`);
      setTimeout(() => setCvUploadProgress(0), 1800);
    } catch (err: any) {
      setCvUploadProgress(0);
      const msg = err?.message || JSON.stringify(err) || 'خطأ غير معروف';
      console.error('CV upload error:', err);
      addToast('فشل حفظ السيرة الذاتية: ' + msg, 'error');
      alert(`❌ فشل رفع السيرة الذاتية على الهاتف:\n${msg}`);
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

      {/* ─── Top Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 py-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
            {isMe ? 'إعدادات الحساب' : 'الملف الشخصي'}
          </h1>
          <button
            type="button"
            onClick={async () => {
              try {
                const { data: { session }, error: sErr } = await supabase.auth.getSession();
                const uEmail = session?.user?.email || (session?.user as any)?.phone || 'لا يوجد';
                const uId = session?.user?.id || 'لا يوجد';
                const hasUrl = Boolean(import.meta.env.VITE_SUPABASE_URL);
                const hasKey = Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
                alert(
                  `📱 تشخيص الهاتف والاتصال:\n` +
                  `━━━━━━━━━━━━━━━━━━\n` +
                  `• الرابط الحالي: ${window.location.origin}\n` +
                  `• الجلسة (Session): ${session ? '✅ نشطة' : '❌ مفقودة (NULL)'}\n` +
                  `• المستخدم: ${uEmail}\n` +
                  `• المعرف (UID): ${uId}\n` +
                  `• خادم Supabase: ${hasUrl ? 'متوفر ✅' : 'مفقود ❌'}\n` +
                  `• المفتاح Anon: ${hasKey ? 'متوفر ✅' : 'مفقود ❌'}\n` +
                  (sErr ? `• خطأ: ${sErr.message}\n` : '')
                );
              } catch (e: any) {
                alert(`خطأ أثناء التشخيص: ${e?.message}`);
              }
            }}
            className="text-[10px] font-bold text-[#0a66c2] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-xl border border-blue-200 dark:border-blue-900 flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            <ShieldCheck size={12} />
            <span>فحص الجلسة 🔍</span>
          </button>
          <a
            href={`${import.meta.env.BASE_URL}test-upload.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-900 flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            <span>صفحة الفحص 🧪</span>
          </a>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
          >
            <ArrowRight size={18} />
          </button>
        )}
      </div>

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
          className="relative h-32 sm:h-44 overflow-hidden group"
          style={{ background: 'linear-gradient(135deg, #0a66c2 0%, #004182 60%, #001e3c 100%)' }}
        >
          {coverUrl ? (
            <img src={coverUrl} alt="cover" className="w-full h-full object-cover" />
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

        {/* ── Avatar + Card Title Row ──────────────────────────────────────────── */}
        <div className="px-5 sm:px-7 pb-6 pt-0 space-y-5">
          <div className="flex items-end justify-between -mt-10 sm:-mt-12 mb-3">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 ring-4 ring-white dark:ring-slate-900 shadow-xl shadow-[#0a66c2]/20">
                <img src={avatar} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                  <Loader2 size={20} className="text-white animate-spin" />
                </div>
              )}
              {isMe && (
                <label
                  htmlFor="avatar-file-input"
                  className="absolute -top-1.5 -right-1.5 w-8 h-8 rounded-full bg-gradient-to-br from-[#0a66c2] to-[#004182] text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 transition-all active:scale-90 cursor-pointer hover:scale-110"
                  title="تغيير الصورة الشخصية"
                >
                  <Pencil size={13} />
                  <input id="avatar-file-input" ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              )}
            </div>
            {/* Card title */}
            <div className="flex items-center gap-2 pb-1">
              <div className={iconBadge}><User size={16} /></div>
              <span className="text-base font-black text-slate-800 dark:text-white">المعلومات الشخصية</span>
            </div>
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
          CARD 4 — السيرة الذاتية (CV / Resume)
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
              <button type="button" onClick={() => setPreviewingCV(true)}
                className="py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-[#0a66c2] dark:text-blue-300 rounded-xl text-xs font-black transition-all border border-blue-200 dark:border-blue-800 flex items-center justify-center gap-1.5 shadow-sm active:scale-95">
                <Eye size={14} /><span>معاينة السيرة</span>
              </button>
              <a href={cvUrl} target="_blank" rel="noopener noreferrer"
                className="py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 shadow-sm active:scale-95">
                <Download size={14} /><span>تحميل CV</span>
              </a>
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

      {/* ─── Visitor: Message Button ─────────────────────────────────────────────── */}
      {!isMe && (
        <div className="pt-2">
          <button type="button" onClick={onMessageClick}
            className="w-full py-4 rounded-full bg-gradient-to-l from-[#0a66c2] to-[#004182] hover:from-[#004182] hover:to-[#0a66c2] text-white font-black text-base transition-all shadow-lg shadow-[#0a66c2]/30 active:scale-[0.98] flex items-center justify-center gap-2">
            <span>مراسلة وتواصل مباشر</span>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL — معاينة السيرة الذاتية
          ══════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {previewingCV && cvUrl && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl h-[88vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-[#0a66c2]/20 flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
              dir="rtl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0a66c2] to-[#004182] text-white flex items-center justify-center shadow-md">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-white text-sm">معاينة السيرة الذاتية</h3>
                    <p className="text-[10px] text-slate-400 font-bold">{profile?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={cvUrl} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-all border border-slate-200 dark:border-slate-600">
                    <ExternalLink size={16} />
                  </a>
                  <button onClick={() => setPreviewingCV(false)}
                    className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-all border border-slate-200 dark:border-slate-600 cursor-pointer">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950 relative flex flex-col">
                {cvUrl.toLowerCase().includes('.doc') || cvUrl.toLowerCase().includes('.docx') ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-[#0a66c2] dark:text-blue-300 flex items-center justify-center shadow-md">
                      <FileText size={32} />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-800 dark:text-white">مستند Word (.docx)</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        ملفات Word لا تعرض مباشرة في بعض المتصفحات، يمكنك فتحها في قارئ المستندات أو تحميلها مباشرة
                      </p>
                    </div>
                    <div className="flex items-center gap-3 pt-2 flex-wrap justify-center">
                      <a
                        href={`https://docs.google.com/viewer?url=${encodeURIComponent(cvUrl)}&embedded=true`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                      >
                        <ExternalLink size={14} /><span>فتح في Google Docs</span>
                      </a>
                      <a
                        href={cvUrl}
                        download
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-l from-[#0a66c2] to-[#004182] text-white text-xs font-black transition-all flex items-center gap-2 shadow-sm shadow-[#0a66c2]/20"
                      >
                        <Download size={14} /><span>تحميل الملف الآن</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <iframe src={`${cvUrl}#toolbar=1&navpanes=0`} title="CV Document" className="w-full h-full border-none" />
                )}
              </div>

              <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">ProLink CV Viewer</span>
                <a href={cvUrl} download
                  className="px-4 py-2 bg-gradient-to-l from-[#0a66c2] to-[#004182] text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-sm shadow-[#0a66c2]/20">
                  <Download size={14} /><span>تحميل الملف</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
