import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Briefcase, MapPin, Phone, Lock, FileText, Pencil,
  ChevronsLeft, Upload, Download, Eye, CheckCircle2, Loader2,
  X, ExternalLink, ArrowRight, Camera, RefreshCw, ShieldCheck,
  EyeOff, AlertCircle, WifiOff
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

  // ─── 1. Avatar Upload (via mobileUploadService – FIX all 10 issues) ───────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target?.files?.[0];
    if (!rawFile || !effectiveUserId) return;

    // Diagnostic logging for mobile debugging
    console.log("File details (Avatar):", {
      name: rawFile.name,
      size: rawFile.size,
      type: rawFile.type,
      isMobile: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    });

    // Normalize file object with explicit MIME type (prevents Mobile blob corruption)
    const ext = (rawFile.name || '').split('.').pop()?.toLowerCase() || 'jpg';
    const cleanType = rawFile.type || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
    const safeFile = new File([rawFile], rawFile.name || `avatar_${Date.now()}.${ext}`, {
      type: cleanType,
    });

    try {
      setIsUploadingAvatar(true);
      // Instant preview
      const localUrl = URL.createObjectURL(safeFile);
      setAvatar(localUrl);

      // Background upload via mobileUploadService (RAM snapshot + multi-bucket + fallback)
      const { uploadPromise } = await mobileUploadService.uploadFile(safeFile, 'avatar', effectiveUserId);
      const finalUrl = await uploadPromise;

      setAvatar(finalUrl);
      await profileService.updateProfile(effectiveUserId, { avatar: finalUrl, avatar_url: finalUrl });
      if (setAppUser) setAppUser((prev: any) => ({ ...prev, avatar: finalUrl, avatar_url: finalUrl }));
      addToast('✅ تم تحديث الصورة الشخصية بنجاح!', 'success');
    } catch (err: any) {
      addToast('تعذر رفع الصورة: ' + (err?.message || ''), 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // ─── 2. Cover Photo Upload (via mobileUploadService) ─────────────────────────
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target?.files?.[0];
    if (!rawFile || !effectiveUserId) return;

    // Diagnostic logging for mobile debugging
    console.log("File details (Cover):", {
      name: rawFile.name,
      size: rawFile.size,
      type: rawFile.type,
      isMobile: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    });

    // Normalize file object with explicit MIME type (prevents Mobile blob corruption)
    const ext = (rawFile.name || '').split('.').pop()?.toLowerCase() || 'jpg';
    const cleanType = rawFile.type || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
    const safeFile = new File([rawFile], rawFile.name || `cover_${Date.now()}.${ext}`, {
      type: cleanType,
    });

    try {
      setIsUploadingCover(true);
      const localUrl = URL.createObjectURL(safeFile);
      setCoverUrl(localUrl);

      const { uploadPromise } = await mobileUploadService.uploadFile(safeFile, 'cover', effectiveUserId);
      const finalUrl = await uploadPromise;

      setCoverUrl(finalUrl);
      await profileService.updateProfile(effectiveUserId, { cover_url: finalUrl, coverUrl: finalUrl } as any);
      if (setAppUser) setAppUser((prev: any) => ({ ...prev, cover_url: finalUrl, coverUrl: finalUrl }));
      addToast('✅ تم تحديث صورة الغلاف بنجاح!', 'success');
    } catch (err: any) {
      addToast('تعذر رفع صورة الغلاف: ' + (err?.message || ''), 'error');
    } finally {
      setIsUploadingCover(false);
    }
  };

  // ─── Native Platform Handlers (Capacitor vs Web Input) ──────────────────────
  const handleAvatarButtonClick = async () => {
    if (typeof (window as any)?.Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform()) {
      try {
        setIsUploadingAvatar(true);
        const { preview, uploadPromise } = await mobileUploadService.pickAndUpload('avatar', {
          userId: effectiveUserId,
        });
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
        const { preview, uploadPromise } = await mobileUploadService.pickAndUpload('cover', {
          userId: effectiveUserId,
        });
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

  // ─── 5. CV Upload – Non-blocking with mobileUploadService (all 10 fixes) ─────
  const handleCVFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    // FIX-4: Size guard with friendly Arabic error
    if (file.size > 25 * 1024 * 1024) {
      addToast('حجم الملف كبير جداً (الحد الأقصى 25 ميغابايت)', 'error');
      return;
    }

    // FIX-3: RAM snapshot immediately so Android content:// URI doesn't expire
    // We store the file; actual upload happens in handleSaveCV
    try {
      const ab = await Promise.race<ArrayBuffer>([
        file.arrayBuffer(),
        new Promise<ArrayBuffer>((_, reject) =>
          setTimeout(() => reject(new Error('snapshot timeout')), 10000)
        ),
      ]);
      const mime = file.type || 'application/pdf';
      const snap = new File([new Blob([ab], { type: mime })], file.name, { type: mime });
      (snap as any).__isSnapshot = true;
      setPendingCVFile(snap);
    } catch {
      // fallback: use raw file
      setPendingCVFile(file);
    }

    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    setPendingCVName(`${file.name} (${sizeMB} MB)`);
    addToast(`📄 تم اختيار "${file.name}" — اضغط حفظ لرفعه.`, 'info');
  }, [addToast]);

  const handleSaveCV = async () => {
    if (!effectiveUserId) { addToast('يرجى تسجيل الدخول أولاً', 'error'); return; }
    if (!pendingCVFile && !cvUrl) { addToast('يرجى اختيار ملف السيرة الذاتية أولاً', 'error'); return; }
    try {
      setSavingCV(true);
      setCvUploadProgress(10);
      let finalUrl = cvUrl;
      if (pendingCVFile) {
        addToast('⏳ جاري رفع السيرة الذاتية في الخلفية...', 'info');

        // Use mobileUploadService with live progress (all 10 fixes applied)
        const { uploadPromise } = await mobileUploadService.uploadFile(
          pendingCVFile,
          'cv',
          effectiveUserId,
          {
            onProgress: (ev) => {
              // Map phases to 0-100 progress
              const phaseMap: Record<string, number> = {
                reading: 15, compressing: 25, uploading: 60, done: 95,
              };
              setCvUploadProgress(phaseMap[ev.phase] ?? (ev.percent > 0 ? ev.percent : 20));
            },
          }
        );

        setCvUploadProgress(60);
        finalUrl = await uploadPromise;
        setCvUploadProgress(90);

        setCvUrl(finalUrl);
        setPendingCVFile(null);
        setPendingCVName(null);
      }

      await profileService.updateProfile(effectiveUserId, { cvUrl: finalUrl, cv_url: finalUrl });
      if (setAppUser) setAppUser((prev: any) => ({ ...prev, cvUrl: finalUrl, cv_url: finalUrl }));
      setCvUploadProgress(100);
      addToast('✅ تم حفظ وتثبيت السيرة الذاتية بنجاح!', 'success');
      setTimeout(() => setCvUploadProgress(0), 1800);
    } catch (err: any) {
      setCvUploadProgress(0);
      // FIX-10: show real error message, never freeze UI
      const msg = err?.message || 'خطأ غير معروف';
      addToast('فشل حفظ السيرة الذاتية: ' + msg, 'error');
    } finally {
      setSavingCV(false);
    }
  };

  // ─── 6. Change Password (with current password verification) ─────────────────
  const handleSavePassword = async () => {
    if (!currentPassword) { addToast('يرجى إدخال كلمة المرور الحالية', 'error'); return; }
    if (!newPassword) { addToast('يرجى إدخال كلمة المرور الجديدة', 'error'); return; }
    if (newPassword.length < 8) { addToast('كلمة المرور يجب أن لا تقل عن 8 أحرف', 'error'); return; }
    if (newPassword !== confirmPassword) { addToast('كلمتا المرور غير متطابقتين', 'error'); return; }
    try {
      setSavingPassword(true);
      // Verify current password via re-auth
      const email = user?.email || profile?.email || '';
      const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (verifyErr) {
        addToast('كلمة المرور الحالية غير صحيحة ❌', 'error');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      addToast('✅ تم تحديث كلمة المرور بنجاح!', 'success');
    } catch (err: any) {
      addToast('تعذر تغيير كلمة المرور: ' + (err?.message || ''), 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  // ─── Shared Input className ───────────────────────────────────────────────────
  const inputCard = 'relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all';
  const floatLabel = 'absolute -top-2.5 right-4 bg-white dark:bg-slate-900 px-2 text-[11px] font-bold text-slate-400';
  const saveBtn = 'w-full py-4 rounded-full bg-gradient-to-l from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-base transition-all shadow-lg shadow-blue-500/20 dark:shadow-blue-900/40 active:scale-[0.98] flex items-center justify-between px-6 cursor-pointer disabled:opacity-60';

  return (
    <div className="w-full max-w-xl mx-auto space-y-5 pb-28 pt-2 md:pt-4 px-3 sm:px-4" dir="rtl">

      {/* ─── Top Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 py-2">
        <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
          {isMe ? 'إعدادات الحساب' : 'الملف الشخصي'}
        </h1>
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
        className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(10,102,194,0.07)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden"
      >
        {/* ── Cover Photo Banner ──────────────────────────────────────────────── */}
        <div className="relative h-32 sm:h-44 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 overflow-hidden group">
          {coverUrl ? (
            <img src={coverUrl} alt="cover" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-4 right-10 w-32 h-32 rounded-full bg-white/40 blur-2xl" />
              <div className="absolute bottom-2 left-16 w-20 h-20 rounded-full bg-white/30 blur-xl" />
            </div>
          )}
          {isUploadingCover && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 size={28} className="text-white animate-spin" />
            </div>
          )}
          {isMe && (
            <>
              <button
                type="button"
                onClick={handleCoverButtonClick}
                className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white text-xs font-bold backdrop-blur-sm transition-all border border-white/20 active:scale-95 cursor-pointer"
              >
                <Camera size={13} />
                <span>تغيير الغلاف</span>
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
            </>
          )}
        </div>

        {/* ── Avatar overlapping cover ────────────────────────────────────────── */}
        <div className="px-6 sm:px-8 pb-6 pt-0 space-y-5">
          <div className="flex items-end justify-between -mt-11 sm:-mt-14 mb-2">
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 ring-4 ring-white dark:ring-slate-900 shadow-xl shadow-blue-900/20">
                <img src={avatar} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                    <Loader2 size={20} className="text-white animate-spin" />
                  </div>
                )}
              </div>
              {isMe && (
                <>
                  <button
                    type="button"
                    onClick={handleAvatarButtonClick}
                    className="absolute -top-1.5 -right-1.5 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 transition-all active:scale-90 cursor-pointer"
                    title="تغيير الصورة الشخصية"
                  >
                    <Pencil size={13} />
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </>
              )}
            </div>
            {/* Card title badge */}
            <div className="flex items-center gap-2 pb-1">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
                <User size={16} />
              </div>
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

          {/* Save Personal Info Button */}
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
          CARD 2 — السيرة الذاتية (CV / Resume)
          ══════════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-[0_10px_30px_rgba(10,102,194,0.07)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
            <FileText size={18} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">السيرة الذاتية (CV)</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
              {isMe ? 'رفع، استبدال، ومعاينة ملف السيرة بشكل احترافي' : 'ملف السيرة الذاتية المعتمد'}
            </p>
          </div>
        </div>

        {/* CV Upload Progress Bar */}
        {cvUploadProgress > 0 && cvUploadProgress < 100 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin" />
                جاري رفع السيرة الذاتية...
              </span>
              <span className="text-[11px] font-bold text-slate-400">{cvUploadProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-l from-blue-500 to-indigo-500"
                initial={{ width: 0 }}
                animate={{ width: `${cvUploadProgress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* CV Display Zone */}
        {cvUrl ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50/60 to-indigo-50/60 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/60 dark:border-blue-800/40 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
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
                className="py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-300 rounded-xl text-xs font-black transition-all border border-blue-200 dark:border-blue-800 flex items-center justify-center gap-1.5 shadow-sm active:scale-95">
                <Eye size={14} /><span>معاينة السيرة</span>
              </button>
              <a href={cvUrl} target="_blank" rel="noopener noreferrer"
                className="py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 shadow-sm active:scale-95">
                <Download size={14} /><span>تحميل CV</span>
              </a>
              {isMe && (
                <button type="button" onClick={() => cvInputRef.current?.click()}
                  className="col-span-2 sm:col-span-1 py-2.5 px-3 bg-gradient-to-l from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer">
                  <RefreshCw size={13} /><span>استبدال الملف</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            onClick={() => isMe && cvInputRef.current?.click()}
            className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-800/60 bg-blue-50/30 dark:bg-blue-950/10 flex flex-col items-center justify-center text-center gap-3 transition-all ${isMe ? 'hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer' : ''}`}
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm">
              <Upload size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-white">
                {isMe ? 'انقر لرفع ملف السيرة الذاتية (CV)' : 'لم يتم رفع ملف سيرة ذاتية بعد'}
              </p>
              <p className="text-[11px] font-bold text-slate-400 mt-1">
                PDF أو Word — الحد الأقصى 25 ميغابايت
              </p>
            </div>
          </div>
        )}

        {isMe && (
          <input ref={cvInputRef} type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword"
            className="hidden" onChange={handleCVFileSelect} />
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

      {/* ══════════════════════════════════════════════════════════════════════════
          CARD 3 — رقم الهاتف
          ══════════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-[0_10px_30px_rgba(10,102,194,0.07)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
            <Phone size={18} />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
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
          CARD 4 — تغيير كلمة المرور (مع التحقق من الحالية)
          ══════════════════════════════════════════════════════════════════════════ */}
      {isMe && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-[0_10px_30px_rgba(10,102,194,0.07)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              <ShieldCheck size={18} />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">تغيير كلمة المرور</h2>
          </div>

          {/* كلمة المرور الحالية */}
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
              <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                {showCurrentPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-blue-500/80 dark:text-blue-400/80 bg-blue-50 dark:bg-blue-950/30 rounded-xl px-3 py-2.5 border border-blue-100 dark:border-blue-900/40">
            <AlertCircle size={14} className="shrink-0" />
            <p className="text-[11px] font-bold">إذا أردت تغيير كلمة المرور، أدخل الجديدة أدناه</p>
          </div>

          {/* كلمة المرور الجديدة */}
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
              <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                {showNewPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* تأكيد كلمة المرور */}
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
              <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                {showConfirmPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* Password match indicator */}
          {confirmPassword && (
            <div className={`flex items-center gap-2 text-xs font-bold ${newPassword === confirmPassword ? 'text-emerald-500' : 'text-rose-500'}`}>
              {newPassword === confirmPassword ? <CheckCircle2 size={13} /> : <X size={13} />}
              <span>{newPassword === confirmPassword ? 'كلمتا المرور متطابقتان ✓' : 'كلمتا المرور غير متطابقتين'}</span>
            </div>
          )}

          <button type="button" onClick={handleSavePassword} disabled={savingPassword} className={saveBtn}>
            <div className="flex items-center gap-1 text-blue-200"><ChevronsLeft size={22} /></div>
            <div className="flex items-center gap-2">
              {savingPassword && <Loader2 size={18} className="animate-spin text-blue-200" />}
              <span>{savingPassword ? 'جاري التحديث...' : 'حفظ كلمة المرور'}</span>
            </div>
          </button>
        </motion.div>
      )}

      {/* ─── Visitor: Message Button ─────────────────────────────────────────────── */}
      {!isMe && (
        <div className="pt-2">
          <button type="button" onClick={onMessageClick}
            className="w-full py-4 rounded-full bg-gradient-to-l from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-base transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2">
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
              className="w-full max-w-4xl h-[88vh] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl shadow-blue-900/30 flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
              dir="rtl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
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

              <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950 relative">
                <iframe src={`${cvUrl}#toolbar=1&navpanes=0`} title="CV Document" className="w-full h-full border-none" />
              </div>

              <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">ProLink CV Viewer</span>
                <a href={cvUrl} download
                  className="px-4 py-2 bg-gradient-to-l from-blue-600 to-indigo-600 text-white text-xs font-black rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-1.5 shadow-sm shadow-blue-500/20">
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
