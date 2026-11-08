import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { profileService } from '../../../lib/services/profileService';
import { mobileUploadService } from '../../../lib/services/mobileUploadService';
import { cvService } from '../../../lib/services/cvService';
import { ProfileEditView } from '../profile/ProfileEditView';
import { FileConfirmModal, ConfirmFileType } from '../profile/FileConfirmModal';
import { AppUser } from '../../../types';
import { useAppContext } from '../../../contexts/AppContext';

interface SettingsPageProps {
  user: any;
  appUser: AppUser | null;
  addToast: (m: string, t?: any) => void;
  setAppUser?: (user: any) => void;
  onBack?: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function SettingsPage({
  user,
  appUser,
  addToast,
  setAppUser,
  onBack,
}: SettingsPageProps) {
  const profile = appUser!;

  const [formData, setFormData] = useState({
    id:          profile?.id           || '',
    name:        profile?.name         || '',
    bio:         profile?.bio          || '',
    companyName: profile?.companyName  || '',
    location:    profile?.location     || '',
    website:     (profile as any)?.website      || '',
    industry:    profile?.title || (profile as any)?.industry || '',
    title:       profile?.title || (profile as any)?.industry || '',
    phone:       profile?.phone        || '',
    avatar:      profile?.avatar       || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'U')}&background=random`,
    coverUrl:    (profile as any)?.coverUrl  || '',
    cover_url:   (profile as any)?.coverUrl  || '',
    experience:  (profile as any)?.experience || '',
    education:   (profile as any)?.education  || '',
    cvUrl:       profile?.cvUrl || (profile as any)?.cv_url || '',
    cv_url:      profile?.cvUrl || (profile as any)?.cv_url || '',
    skills:      profile?.skills || [],
    open_to:     (profile as any)?.open_to || 'none',
    role:        profile?.role || 'seeker',
  });

  const [pendingCV, setPendingCV]         = useState<File | null>(null);
  const [pendingCVName, setPendingCVName] = useState<string | null>(null);
  const [pendingFileUpload, setPendingFileUpload] = useState<{ file: File; type: ConfirmFileType } | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover]   = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const lastSavedRef = useRef<string>(JSON.stringify(formData));

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const fileToDataUrl = (file: File, maxDim = 400, quality = 0.75): Promise<string> =>
    new Promise((resolve) => {
      const isDoc = /\.(pdf|doc|docx)$/i.test(file.name || '') || file.type?.includes('pdf') || file.type?.includes('word');
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawDataUrl = e.target?.result as string;
        if (!rawDataUrl) { resolve(''); return; }
        if (isDoc) { resolve(rawDataUrl); return; }
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w >= h) { h = Math.max(1, Math.round((h * maxDim) / w)); w = maxDim; }
            else { w = Math.max(1, Math.round((w * maxDim) / h)); h = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) { ctx.drawImage(img, 0, 0, w, h); resolve(canvas.toDataURL('image/jpeg', quality)); }
          else resolve(rawDataUrl);
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });

  const uploadRawFileToStorage = async (file: File, bucket: 'profiles' | 'documents', userId: string): Promise<string> => {
    const ext = (file.name || 'file').split('.').pop()?.toLowerCase() || (bucket === 'documents' ? 'pdf' : 'jpg');
    const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${userId}/${timestamp}_${randomSuffix}.${cleanExt}`;
    const contentType = file.type || (bucket === 'documents' ? 'application/pdf' : 'image/jpeg');
    const uploadPromise = supabase.storage.from(bucket).upload(fileName, file, { contentType, upsert: true, cacheControl: '3600' });
    const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error('انتهت مهلة الرفع')), 8000)
    );
    const { error } = await Promise.race([uploadPromise, timeoutPromise]);
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    if (!data?.publicUrl) throw new Error('فشل توليد رابط الملف العام');
    return `${data.publicUrl}?t=${timestamp}`;
  };

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleDirectAvatarUpload = (rawFile: File) => {
    if (!rawFile) return;
    const targetUserId = user?.id || appUser?.id;
    if (!targetUserId) { addToast('يرجى تسجيل الدخول أولاً', 'error'); return; }
    try {
      const localUrl = URL.createObjectURL(rawFile);
      setFormData(prev => ({ ...prev, avatar: localUrl }));
      if (setAppUser) setAppUser((prev: any) => prev ? { ...prev, avatar: localUrl } : null);
    } catch (_) {}
    setIsUploadingAvatar(true);
    (async () => {
      try {
        let finalUrl = '';
        try { finalUrl = await uploadRawFileToStorage(rawFile, 'profiles', targetUserId); } catch {}
        if (!finalUrl) finalUrl = await fileToDataUrl(rawFile, 400, 0.75);
        if (!finalUrl) throw new Error('تعذر قراءة الصورة');
        setFormData(prev => ({ ...prev, avatar: finalUrl, avatar_url: finalUrl }));
        if (setAppUser) setAppUser((prev: any) => prev ? { ...prev, avatar: finalUrl, avatar_url: finalUrl } : null);
        await profileService.updateProfile(targetUserId, { avatar: finalUrl, avatar_url: finalUrl });
        addToast('✅ تم حفظ صورة الحساب بنجاح!', 'success');
      } catch (err: any) {
        addToast('تعذر حفظ الصورة: ' + (err?.message || ''), 'error');
      } finally { setIsUploadingAvatar(false); }
    })();
  };

  // ── Cover upload ──────────────────────────────────────────────────────────
  const handleDirectCoverUpload = (rawFile: File) => {
    if (!rawFile) return;
    const targetUserId = user?.id || appUser?.id;
    if (!targetUserId) { addToast('يرجى تسجيل الدخول أولاً', 'error'); return; }
    try {
      const localUrl = URL.createObjectURL(rawFile);
      setFormData(prev => ({ ...prev, coverUrl: localUrl, cover_url: localUrl }));
      if (setAppUser) setAppUser((prev: any) => prev ? { ...prev, coverUrl: localUrl } : null);
    } catch (_) {}
    setIsUploadingCover(true);
    (async () => {
      try {
        let finalUrl = '';
        try { finalUrl = await uploadRawFileToStorage(rawFile, 'profiles', targetUserId); } catch {}
        if (!finalUrl) finalUrl = await fileToDataUrl(rawFile, 800, 0.75);
        if (!finalUrl) throw new Error('تعذر قراءة صورة الغلاف');
        setFormData(prev => ({ ...prev, coverUrl: finalUrl, cover_url: finalUrl }));
        if (setAppUser) setAppUser((prev: any) => prev ? { ...prev, coverUrl: finalUrl } : null);
        await profileService.updateProfile(targetUserId, { coverUrl: finalUrl, cover_url: finalUrl });
        addToast('✅ تم حفظ صورة الغلاف بنجاح!', 'success');
      } catch (err: any) {
        addToast('تعذر حفظ صورة الغلاف: ' + (err?.message || ''), 'error');
      } finally { setIsUploadingCover(false); }
    })();
  };

  // ── CV upload ─────────────────────────────────────────────────────────────
  const handleDirectCVUpload = (memFile: File) => {
    const targetUserId = user?.id || appUser?.id;
    if (!targetUserId) { addToast('يجب تسجيل الدخول لرفع السيرة الذاتية', 'error'); return; }
    const fileName = memFile.name || `cv_${Date.now()}.pdf`;
    const fileSizeMB = (memFile.size / (1024 * 1024)).toFixed(1);
    setPendingCVName(`${fileName} (${fileSizeMB} MB)`);
    addToast(`📄 جاري رفع "${fileName}"...`);
    (async () => {
      try {
        let url = '';
        try { url = await uploadRawFileToStorage(memFile, 'profiles', targetUserId); } catch {
          try { url = await uploadRawFileToStorage(memFile, 'documents', targetUserId); } catch {}
        }
        if (!url) url = await fileToDataUrl(memFile);
        if (!url) throw new Error('تعذر قراءة ملف السيرة الذاتية');
        setFormData(prev => ({ ...prev, cvUrl: url, cv_url: url }));
        setPendingCV(null); setPendingCVName(null);
        await profileService.updateProfile(targetUserId, { cvUrl: url, cv_url: url });
        addToast('✅ تم رفع السيرة الذاتية بنجاح! 🎉', 'success');
        if (setAppUser) setAppUser((prev: any) => prev ? { ...prev, cvUrl: url, cv_url: url } : null);
      } catch (err: any) {
        setPendingCVName(null);
        addToast('خطأ في حفظ السيرة الذاتية: ' + (err?.message || ''), 'error');
      }
    })();
  };

  const readAndConfirm = (file: File, type: ConfirmFileType) => setPendingFileUpload({ file, type });

  const handleConfirmFileUpload = (file: File) => {
    if (!pendingFileUpload) return;
    const { type } = pendingFileUpload;
    setPendingFileUpload(null);
    if (type === 'avatar') handleDirectAvatarUpload(file);
    else if (type === 'cover') handleDirectCoverUpload(file);
    else if (type === 'cv') handleDirectCVUpload(file);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.currentTarget?.files?.item(0) ?? e.target?.files?.[0];
    if (!rawFile) return;
    readAndConfirm(rawFile, 'avatar');
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.currentTarget?.files?.item(0) ?? e.target?.files?.[0];
    if (!rawFile) return;
    readAndConfirm(rawFile, 'cover');
  };

  const handleCVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.currentTarget?.files?.item(0) ?? e.target?.files?.[0];
    if (!rawFile) return;
    if (rawFile.size > 25 * 1024 * 1024) { addToast('حجم الملف يتجاوز الحد الأقصى (25 ميغابايت)', 'error'); return; }
    readAndConfirm(rawFile, 'cv');
  };

  // ── Field change ──────────────────────────────────────────────────────────
  const handleFieldChange = useCallback(async (field: string, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    const targetUserId = user?.id || appUser?.id;
    if (field === 'open_to' && targetUserId) {
      setSaveStatus('saving');
      try {
        await profileService.updateProfile(targetUserId, { open_to: value });
        if (setAppUser) setAppUser((prev: any) => prev ? { ...prev, open_to: value } : null);
        setSaveStatus('saved');
        addToast('تم تحديث حالة التوفر! ✨', 'success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err: any) {
        setSaveStatus('error');
        addToast('فشل حفظ حالة التوفر: ' + (err.message || ''), 'error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } else {
      setSaveStatus('idle');
    }
  }, [formData, user?.id, appUser?.id, setAppUser, addToast]);

  // ── Manual save ───────────────────────────────────────────────────────────
  const handleManualSave = useCallback(async () => {
    const targetUserId = user?.id || appUser?.id;
    if (!targetUserId) { addToast('يرجى تسجيل الدخول أولاً', 'error'); return; }
    setSaveStatus('saving');
    try {
      let updatedFormData = { ...formData };
      if (pendingCV) {
        if (updatedFormData.cvUrl) await cvService.deleteCV(updatedFormData.cvUrl);
        const { data: url, error: uploadErr } = await cvService.uploadCV(targetUserId, pendingCV, {
          name: user?.name || appUser?.name || profile?.name,
          email: user?.email || appUser?.email,
        });
        if (uploadErr || !url) throw uploadErr || new Error('فشل رفع ملف السيرة الذاتية');
        updatedFormData = { ...updatedFormData, cvUrl: url, cv_url: url };
        setPendingCV(null); setPendingCVName(null);
      }
      setFormData(updatedFormData);
      const { id: _ignoredId, ...cleanUpdates } = updatedFormData;
      const { error } = await profileService.updateProfile(targetUserId, {
        ...cleanUpdates,
        title: updatedFormData.industry || updatedFormData.title || '',
        industry: updatedFormData.industry || updatedFormData.title || '',
      });
      if (error) throw error;
      lastSavedRef.current = JSON.stringify(updatedFormData);
      setSaveStatus('saved');
      addToast('تم حفظ جميع التعديلات بنجاح! 💾', 'success');
      if (setAppUser) setAppUser({ ...profile, ...updatedFormData });
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      setSaveStatus('error');
      addToast('فشل الحفظ: ' + (err.message || ''), 'error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [user?.id, appUser?.id, profile, formData, pendingCV, setAppUser, addToast]);

  if (!appUser) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" dir="rtl">
        <p className="text-slate-400 font-black text-sm">يجب تسجيل الدخول للوصول للإعدادات</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto pb-28 pt-0 md:pt-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-3 mb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black hover:bg-slate-50 transition-all border border-slate-100 dark:border-slate-700 shadow-sm"
            >
              <ArrowRight size={14} />
              رجوع
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
              <SettingsIcon size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 dark:text-white leading-none">الإعدادات</h1>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">تعديل الملف الشخصي</p>
            </div>
          </div>
        </div>
      </div>

      {/* ProfileEditView reused as-is */}
      <ProfileEditView
        formData={formData}
        handleFieldChange={handleFieldChange}
        addToast={addToast}
        setActiveTab={() => {}}
        saveStatus={saveStatus}
        handleCVUpload={handleCVUpload as any}
        handleAvatarChange={handleAvatarChange as any}
        handleCoverChange={handleCoverChange as any}
        handleSave={handleManualSave}
        onScrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        pendingCVName={pendingCVName}
      />

      {/* File confirmation modal */}
      <FileConfirmModal
        file={pendingFileUpload?.file || null}
        type={pendingFileUpload?.type || 'avatar'}
        onConfirm={handleConfirmFileUpload}
        onCancel={() => setPendingFileUpload(null)}
      />
    </div>
  );
}

