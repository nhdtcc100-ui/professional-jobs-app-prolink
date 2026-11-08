import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Briefcase, MapPin, Phone, Lock, FileText, Pencil,
  ChevronsLeft, Upload, Download, Eye, CheckCircle2, Loader2,
  X, ExternalLink, ArrowRight, ShieldCheck, Camera, Sparkles, RefreshCw
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { profileService } from '../../../lib/services/profileService';
import { cvService } from '../../../lib/services/cvService';
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
  // Form fields
  const [name, setName] = useState(profile?.name || '');
  const [title, setTitle] = useState(profile?.display_title || profile?.title || (profile as any)?.industry || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatar, setAvatar] = useState(
    profile?.avatar || (profile as any)?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'User')}&background=random`
  );
  const [cvUrl, setCvUrl] = useState(profile?.cvUrl || (profile as any)?.cv_url || '');

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Loading states
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingCV, setSavingCV] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCV, setIsUploadingCV] = useState(false);

  // CV preview modal state
  const [previewingCV, setPreviewingCV] = useState(false);
  const [pendingCVFile, setPendingCVFile] = useState<File | null>(null);
  const [pendingCVName, setPendingCVName] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const effectiveUserId = user?.id || profile?.id;

  // ─── 1. Avatar Upload ────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file || !effectiveUserId) return;

    try {
      setIsUploadingAvatar(true);
      const localUrl = URL.createObjectURL(file);
      setAvatar(localUrl);

      // Upload to storage
      const ext = (file.name || 'avatar.jpg').split('.').pop() || 'jpg';
      const fileName = `${effectiveUserId}/avatar_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('profiles')
        .upload(fileName, file, { upsert: true, contentType: file.type || 'image/jpeg' });

      let finalUrl = '';
      if (!uploadErr) {
        const { data } = supabase.storage.from('profiles').getPublicUrl(fileName);
        finalUrl = data.publicUrl;
      } else {
        // Fallback to base64 data url
        const reader = new FileReader();
        finalUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      setAvatar(finalUrl);
      await profileService.updateProfile(effectiveUserId, {
        avatar: finalUrl,
        avatar_url: finalUrl,
      });

      if (setAppUser) {
        setAppUser((prev: any) => ({ ...prev, avatar: finalUrl, avatar_url: finalUrl }));
      }
      addToast('✅ تم تحديث الصورة الشخصية بنجاح!', 'success');
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      addToast('تعذر رفع الصورة: ' + (err?.message || ''), 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // ─── 2. Save Personal Info ───────────────────────────────────────────────────
  const handleSavePersonalInfo = async () => {
    if (!effectiveUserId) {
      addToast('يرجى تسجيل الدخول أولاً', 'error');
      return;
    }
    if (!name.trim()) {
      addToast('الاسم لا يمكن أن يكون فارغاً', 'error');
      return;
    }

    try {
      setSavingInfo(true);
      const updates = {
        name: name.trim(),
        title: title.trim(),
        display_title: title.trim(),
        location: location.trim(),
        bio: bio.trim(),
      };

      const { error } = await profileService.updateProfile(effectiveUserId, updates);
      if (error) throw error;

      if (setAppUser) {
        setAppUser((prev: any) => ({ ...prev, ...updates }));
      }
      addToast('✅ تم حفظ المعلومات الشخصية بنجاح!', 'success');
    } catch (err: any) {
      addToast('فشل حفظ المعلومات: ' + (err?.message || ''), 'error');
    } finally {
      setSavingInfo(false);
    }
  };

  // ─── 3. Save Phone ───────────────────────────────────────────────────────────
  const handleSavePhone = async () => {
    if (!effectiveUserId) {
      addToast('يرجى تسجيل الدخول أولاً', 'error');
      return;
    }

    try {
      setSavingPhone(true);
      const { error } = await profileService.updateProfile(effectiveUserId, {
        phone: phone.trim(),
      });
      if (error) throw error;

      if (setAppUser) {
        setAppUser((prev: any) => ({ ...prev, phone: phone.trim() }));
      }
      addToast('✅ تم حفظ رقم الهاتف بنجاح!', 'success');
    } catch (err: any) {
      addToast('فشل حفظ رقم الهاتف: ' + (err?.message || ''), 'error');
    } finally {
      setSavingPhone(false);
    }
  };

  // ─── 4. CV File Selection & Upload ───────────────────────────────────────────
  const handleCVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      addToast('حجم الملف كبير جداً (الحد الأقصى 25 ميغابايت)', 'error');
      return;
    }

    setPendingCVFile(file);
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    setPendingCVName(`${file.name} (${sizeMB} MB)`);
    addToast(`📄 تم اختيار "${file.name}"، اضغط على حفظ السيرة الذاتية لتثبيته.`, 'info');
  };

  const handleSaveCV = async () => {
    if (!effectiveUserId) {
      addToast('يرجى تسجيل الدخول أولاً', 'error');
      return;
    }
    if (!pendingCVFile && !cvUrl) {
      addToast('يرجى اختيار ملف السيرة الذاتية أولاً', 'error');
      return;
    }

    try {
      setSavingCV(true);
      setIsUploadingCV(true);

      let finalUrl = cvUrl;

      if (pendingCVFile) {
        addToast('جاري رفع ومعالجة ملف السيرة الذاتية...', 'info');
        const { data: uploadedUrl, error: uploadErr } = await cvService.uploadCV(
          effectiveUserId,
          pendingCVFile,
          { name: profile?.name, email: profile?.email }
        );

        if (uploadErr || !uploadedUrl) {
          throw uploadErr || new Error('فشل رفع ملف السيرة الذاتية');
        }

        finalUrl = uploadedUrl;
        setCvUrl(finalUrl);
        setPendingCVFile(null);
        setPendingCVName(null);
      }

      await profileService.updateProfile(effectiveUserId, {
        cvUrl: finalUrl,
        cv_url: finalUrl,
      });

      if (setAppUser) {
        setAppUser((prev: any) => ({ ...prev, cvUrl: finalUrl, cv_url: finalUrl }));
      }

      addToast('✅ تم حفظ وتثبيت السيرة الذاتية بنجاح!', 'success');
    } catch (err: any) {
      console.error('CV upload error:', err);
      addToast('فشل حفظ السيرة الذاتية: ' + (err?.message || ''), 'error');
    } finally {
      setSavingCV(false);
      setIsUploadingCV(false);
    }
  };

  // ─── 5. Change Password ──────────────────────────────────────────────────────
  const handleSavePassword = async () => {
    if (!newPassword) {
      addToast('يرجى إدخال كلمة المرور الجديدة', 'error');
      return;
    }
    if (newPassword.length < 8) {
      addToast('كلمة المرور يجب أن لا تقل عن 8 أحرف', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('كلمتا المرور غير متطابقتين', 'error');
      return;
    }

    try {
      setSavingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      addToast('✅ تم تحديث كلمة المرور بنجاح!', 'success');
    } catch (err: any) {
      addToast('تعذر تغيير كلمة المرور: ' + (err?.message || ''), 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6 pb-28 pt-2 md:pt-4 px-3 sm:px-4" dir="rtl">
      
      {/* ─── Top Header (Matching Screenshot) ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-2 py-2">
        <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
          {isMe ? 'إعدادات الحساب' : 'الملف الشخصي'}
        </h1>
        {onBack && (
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
            title="رجوع"
          >
            <ArrowRight size={18} />
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          CARD 1: المعلومات الشخصية (Personal Information)
          ════════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6"
      >
        {/* Card Title Row with Purple Circle Icon */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2D0C57] flex items-center justify-center text-white shadow-md shadow-purple-950/20">
              <User size={18} />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
              المعلومات الشخصية
            </h2>
          </div>
        </div>

        {/* Center Avatar with Purple Edit Badge */}
        <div className="flex flex-col items-center justify-center pt-2 pb-4">
          <div className="relative group">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-4 border-slate-50 dark:border-slate-800 shadow-md">
              <img
                src={avatar}
                alt={name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-3xl">
                  <Loader2 size={24} className="text-white animate-spin" />
                </div>
              )}
            </div>

            {/* Circular Pencil Button (Matching Screenshot) */}
            {isMe && (
              <>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -top-1 -right-1 w-9 h-9 rounded-full bg-[#2D0C57] hover:bg-[#3D0F73] text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 transition-all active:scale-90 cursor-pointer"
                  title="تغيير الصورة الشخصية"
                >
                  <Pencil size={15} />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </>
            )}
          </div>
        </div>

        {/* Input: الاسم */}
        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3.5 focus-within:border-[#2D0C57] focus-within:ring-2 focus-within:ring-[#2D0C57]/10 transition-all">
          <span className="absolute -top-2.5 right-4 bg-white dark:bg-slate-900 px-2 text-[11px] font-bold text-slate-400">
            الاسم
          </span>
          <div className="flex items-center gap-3">
            {isMe ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أدخل اسمك الكامل"
                className="w-full bg-transparent outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-white"
              />
            ) : (
              <p className="w-full text-sm sm:text-base font-bold text-slate-800 dark:text-white">{name}</p>
            )}
            <User size={18} className="text-slate-400 shrink-0" />
          </div>
        </div>

        {/* Input: المسمى الوظيفي / الاختصاص */}
        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3.5 focus-within:border-[#2D0C57] focus-within:ring-2 focus-within:ring-[#2D0C57]/10 transition-all">
          <span className="absolute -top-2.5 right-4 bg-white dark:bg-slate-900 px-2 text-[11px] font-bold text-slate-400">
            المسمى الوظيفي / الاختصاص
          </span>
          <div className="flex items-center gap-3">
            {isMe ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: مطور برمجيات، مهندس شبكات..."
                className="w-full bg-transparent outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-white"
              />
            ) : (
              <p className="w-full text-sm sm:text-base font-bold text-slate-800 dark:text-white">{title || '—'}</p>
            )}
            <Briefcase size={18} className="text-slate-400 shrink-0" />
          </div>
        </div>

        {/* Input: العنوان / المحافظة */}
        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3.5 focus-within:border-[#2D0C57] focus-within:ring-2 focus-within:ring-[#2D0C57]/10 transition-all">
          <span className="absolute -top-2.5 right-4 bg-white dark:bg-slate-900 px-2 text-[11px] font-bold text-slate-400">
            العنوان
          </span>
          <div className="flex items-center gap-3">
            {isMe ? (
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثال: بغداد، المشتل"
                className="w-full bg-transparent outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-white"
              />
            ) : (
              <p className="w-full text-sm sm:text-base font-bold text-slate-800 dark:text-white">{location || '—'}</p>
            )}
            <MapPin size={18} className="text-slate-400 shrink-0" />
          </div>
        </div>

        {/* Input: النبذة التعريفية */}
        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3 focus-within:border-[#2D0C57] focus-within:ring-2 focus-within:ring-[#2D0C57]/10 transition-all">
          <span className="absolute -top-2.5 right-4 bg-white dark:bg-slate-900 px-2 text-[11px] font-bold text-slate-400">
            النبذة التعريفية
          </span>
          {isMe ? (
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="اكتب نبذة مختصرة عن خبرتك واهتماماتك..."
              className="w-full bg-transparent outline-none text-sm font-medium text-slate-800 dark:text-white resize-none"
            />
          ) : (
            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium whitespace-pre-wrap leading-relaxed">
              {bio || 'لا توجد نبذة تعريفية مسجلة.'}
            </p>
          )}
        </div>

        {/* Save Button with `<< حفظ` (Matching Screenshot) */}
        {isMe && (
          <button
            type="button"
            onClick={handleSavePersonalInfo}
            disabled={savingInfo}
            className="w-full py-4 rounded-full bg-[#2D0C57] hover:bg-[#3D0F73] text-white font-black text-base transition-all shadow-lg shadow-purple-950/20 active:scale-[0.98] flex items-center justify-between px-6 cursor-pointer disabled:opacity-70"
          >
            <div className="flex items-center gap-1 text-purple-200">
              <ChevronsLeft size={22} />
            </div>
            <div className="flex items-center gap-2">
              {savingInfo && <Loader2 size={18} className="animate-spin text-purple-200" />}
              <span>{savingInfo ? 'جاري الحفظ...' : 'حفظ'}</span>
            </div>
          </button>
        )}
      </motion.div>

      {/* ════════════════════════════════════════════════════════════════════════
          CARD 2: السيرة الذاتية (CV / Resume) — احترافي مع رفع وتغيير ومعاينة وحفظ
          ════════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6"
      >
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2D0C57] flex items-center justify-center text-white shadow-md shadow-purple-950/20">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
                السيرة الذاتية (CV)
              </h2>
              <p className="text-[10px] font-bold text-slate-400">
                {isMe ? 'إمكانية رفع ملف السيرة، استبداله، وعرضه للمهنيين' : 'ملف السيرة الذاتية المعتمد'}
              </p>
            </div>
          </div>
        </div>

        {/* Professional CV Display & Upload Zone */}
        {cvUrl ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-50/60 to-indigo-50/60 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200/60 dark:border-purple-800/40 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#2D0C57] text-white flex items-center justify-center shadow-md">
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
                    {pendingCVName ? `تم اختيار جديد: ${pendingCVName}` : 'متاح للعرض والتحميل المباشر'}
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-purple-100 dark:border-purple-900/40">
              {/* Button 1: Preview Modal */}
              <button
                type="button"
                onClick={() => setPreviewingCV(true)}
                className="py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-[#2D0C57] dark:text-purple-300 rounded-xl text-xs font-black transition-all border border-purple-200 dark:border-purple-800 flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
              >
                <Eye size={14} />
                <span>معاينة السيرة</span>
              </button>

              {/* Button 2: Direct Download / Open */}
              <a
                href={cvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
              >
                <Download size={14} />
                <span>تحميل CV</span>
              </a>

              {/* Button 3: Change / Replace (Only for owner) */}
              {isMe && (
                <button
                  type="button"
                  onClick={() => cvInputRef.current?.click()}
                  className="col-span-2 sm:col-span-1 py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>استبدال الملف</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            onClick={() => isMe && cvInputRef.current?.click()}
            className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed border-purple-200 dark:border-purple-800/60 bg-purple-50/30 dark:bg-purple-950/10 flex flex-col items-center justify-center text-center gap-3 transition-all ${
              isMe ? 'hover:bg-purple-50 dark:hover:bg-purple-950/20 cursor-pointer' : ''
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-[#2D0C57] dark:text-purple-300 flex items-center justify-center shadow-sm">
              <Upload size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-white">
                {isMe ? 'انقر لرفع ملف السيرة الذاتية (CV)' : 'لم يتم رفع ملف سيرة ذاتية بعد'}
              </p>
              <p className="text-[11px] font-bold text-slate-400 mt-1">
                صيغ الملفات المقبولة: PDF أو Word (الحد الأقصى 25 ميغابايت)
              </p>
            </div>
          </div>
        )}

        {/* Hidden CV File Input */}
        {isMe && (
          <input
            ref={cvInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword"
            className="hidden"
            onChange={handleCVFileSelect}
          />
        )}

        {/* Save CV Button (Matching Screenshot) */}
        {isMe && (pendingCVFile || cvUrl) && (
          <button
            type="button"
            onClick={handleSaveCV}
            disabled={savingCV}
            className="w-full py-4 rounded-full bg-[#2D0C57] hover:bg-[#3D0F73] text-white font-black text-base transition-all shadow-lg shadow-purple-950/20 active:scale-[0.98] flex items-center justify-between px-6 cursor-pointer disabled:opacity-70"
          >
            <div className="flex items-center gap-1 text-purple-200">
              <ChevronsLeft size={22} />
            </div>
            <div className="flex items-center gap-2">
              {savingCV && <Loader2 size={18} className="animate-spin text-purple-200" />}
              <span>{savingCV ? 'جاري حفظ السيرة الذاتية...' : 'حفظ السيرة الذاتية'}</span>
            </div>
          </button>
        )}
      </motion.div>

      {/* ════════════════════════════════════════════════════════════════════════
          CARD 3: تغيير رقم الهاتف (Change Phone Number)
          ════════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2D0C57] flex items-center justify-center text-white shadow-md shadow-purple-950/20">
              <Phone size={18} />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
              {isMe ? 'تغيير رقم الهاتف' : 'رقم الهاتف'}
            </h2>
          </div>
        </div>

        {/* Input: رقم الهاتف */}
        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3.5 focus-within:border-[#2D0C57] focus-within:ring-2 focus-within:ring-[#2D0C57]/10 transition-all">
          <span className="absolute -top-2.5 right-4 bg-white dark:bg-slate-900 px-2 text-[11px] font-bold text-slate-400">
            رقم الهاتف
          </span>
          <div className="flex items-center gap-3">
            {isMe ? (
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXXX"
                dir="ltr"
                className="w-full bg-transparent outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-white text-right"
              />
            ) : (
              <p className="w-full text-sm sm:text-base font-bold text-slate-800 dark:text-white text-right" dir="ltr">
                {phone || '—'}
              </p>
            )}
            <Phone size={18} className="text-slate-400 shrink-0" />
          </div>
        </div>

        {/* Save Phone Button with `<< حفظ` (Matching Screenshot) */}
        {isMe ? (
          <button
            type="button"
            onClick={handleSavePhone}
            disabled={savingPhone}
            className="w-full py-4 rounded-full bg-[#2D0C57] hover:bg-[#3D0F73] text-white font-black text-base transition-all shadow-lg shadow-purple-950/20 active:scale-[0.98] flex items-center justify-between px-6 cursor-pointer disabled:opacity-70"
          >
            <div className="flex items-center gap-1 text-purple-200">
              <ChevronsLeft size={22} />
            </div>
            <div className="flex items-center gap-2">
              {savingPhone && <Loader2 size={18} className="animate-spin text-purple-200" />}
              <span>{savingPhone ? 'جاري الحفظ...' : 'حفظ'}</span>
            </div>
          </button>
        ) : (
          showCallButton && phone && (
            <button
              type="button"
              onClick={onCallClick}
              className="w-full py-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base transition-all shadow-lg shadow-emerald-950/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Phone size={18} />
              <span>اتصال برقم الهاتف</span>
            </button>
          )
        )}
      </motion.div>

      {/* ════════════════════════════════════════════════════════════════════════
          CARD 4: تغيير كلمة المرور (Change Password) — فقط لصاحب الحساب
          ════════════════════════════════════════════════════════════════════════ */}
      {isMe && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2D0C57] flex items-center justify-center text-white shadow-md shadow-purple-950/20">
                <Lock size={18} />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
                تغيير كلمة المرور
              </h2>
            </div>
          </div>

          {/* Input: كلمة المرور الجديدة */}
          <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3.5 focus-within:border-[#2D0C57] focus-within:ring-2 focus-within:ring-[#2D0C57]/10 transition-all">
            <span className="absolute -top-2.5 right-4 bg-white dark:bg-slate-900 px-2 text-[11px] font-bold text-slate-400">
              كلمة المرور الجديدة
            </span>
            <div className="flex items-center gap-3">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-white"
              />
              <Lock size={18} className="text-slate-400 shrink-0" />
            </div>
          </div>

          {/* Input: تأكيد كلمة المرور */}
          <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3.5 focus-within:border-[#2D0C57] focus-within:ring-2 focus-within:ring-[#2D0C57]/10 transition-all">
            <span className="absolute -top-2.5 right-4 bg-white dark:bg-slate-900 px-2 text-[11px] font-bold text-slate-400">
              تأكيد كلمة المرور الجديدة
            </span>
            <div className="flex items-center gap-3">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-white"
              />
              <Lock size={18} className="text-slate-400 shrink-0" />
            </div>
          </div>

          {/* Save Password Button with `<< حفظ` */}
          <button
            type="button"
            onClick={handleSavePassword}
            disabled={savingPassword}
            className="w-full py-4 rounded-full bg-[#2D0C57] hover:bg-[#3D0F73] text-white font-black text-base transition-all shadow-lg shadow-purple-950/20 active:scale-[0.98] flex items-center justify-between px-6 cursor-pointer disabled:opacity-70"
          >
            <div className="flex items-center gap-1 text-purple-200">
              <ChevronsLeft size={22} />
            </div>
            <div className="flex items-center gap-2">
              {savingPassword && <Loader2 size={18} className="animate-spin text-purple-200" />}
              <span>{savingPassword ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}</span>
            </div>
          </button>
        </motion.div>
      )}

      {/* ─── Visitor Action: Message Button (When viewing other users) ───────── */}
      {!isMe && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onMessageClick}
            className="w-full py-4 rounded-full bg-[#2D0C57] hover:bg-[#3D0F73] text-white font-black text-base transition-all shadow-lg shadow-purple-950/20 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>مراسلة وتواصل مباشر</span>
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL: Professional CV Viewer (معاينة السيرة الذاتية بشكل احترافي)
          ════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {previewingCV && cvUrl && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl h-[88vh] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#2D0C57] text-white flex items-center justify-center">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-white text-sm">
                      معاينة السيرة الذاتية (CV)
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold">{profile?.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-all border border-slate-200 dark:border-slate-600"
                    title="فتح في نافذة جديدة"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <button
                    onClick={() => setPreviewingCV(false)}
                    className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-all border border-slate-200 dark:border-slate-600 cursor-pointer"
                    title="إغلاق"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Modal Body / Embedded PDF Viewer */}
              <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950 relative">
                <iframe
                  src={`${cvUrl}#toolbar=1&navpanes=0`}
                  title="CV Document"
                  className="w-full h-full border-none"
                />
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">ProLink CV Viewer</span>
                <a
                  href={cvUrl}
                  download
                  className="px-4 py-2 bg-[#2D0C57] text-white text-xs font-black rounded-xl hover:bg-[#3D0F73] transition-all flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>تحميل الملف</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
