import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, BadgeCheck, Briefcase, Search, Minus, Phone, 
  MapPin, Globe, FileText, Linkedin, Twitter, Github, Mail, ExternalLink 
} from 'lucide-react';
import { useFilePermission } from '../../../hooks/useFilePermission';
import { PermissionDeniedModal } from '../../ui/PermissionDeniedModal';

interface ProfileHeaderProps {
  formData: any;
  profile: any;
  isMe: boolean;
  handleCoverChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFieldChange: (field: string, value: any) => void;
  handleDownloadCV: () => void;
  setActiveTab: (tab: any) => void;
  userPostsCount: number;
  onMessageClick?: () => void;
  onCallClick?: () => void;
  showCallButton?: boolean;
}

const OPEN_TO_OPTIONS = [
  { value: 'work', label: 'متاح للعمل 🟢', icon: Briefcase, color: 'bg-emerald-500', ring: 'ring-emerald-400', badge: 'bg-emerald-500 text-white' },
  { value: 'none', label: 'غير متاح للعمل ⚪', icon: Minus, color: 'bg-slate-400', ring: 'ring-slate-300', badge: 'hidden' },
];

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  formData,
  profile,
  isMe,
  handleCoverChange,
  handleAvatarChange,
  handleFieldChange,
  handleDownloadCV,
  setActiveTab,
  userPostsCount,
  onMessageClick,
  onCallClick,
  showCallButton = false,
}) => {
  const currentRole = formData?.role || profile?.role || 'seeker';
  const isEmployer = currentRole === 'employer';
  const isFreelancer = currentRole === 'freelancer';
  const isSeeker = currentRole === 'seeker';

  const openToStatus = formData.open_to === 'work' || formData.is_available ? 'work' : 'none';
  const activeOption = OPEN_TO_OPTIONS.find(o => o.value === openToStatus);
  const isAvailable = openToStatus === 'work';
  const isPro = profile.is_pro || profile.isPro;

  // ── File Permission (Android + iOS) ──────────────────────────
  // IMPORTANT: We check permission status eagerly on mount (autoCheck=true).
  // We NEVER await anything before opening the file picker — iOS Safari
  // invalidates the user-gesture token on any async boundary.
  // Strategy: <label> → <input> (direct, synchronous). If the status is
  // already 'denied' we intercept the click and show the modal instead.
  const { status: permStatus, requestPermission } = useFilePermission(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  /**
   * Called synchronously when the user taps a camera label.
   * If permission is known-denied: block the file picker and show modal.
   * Otherwise: let the event bubble — the <label for="..."> opens the picker.
   */
  const guardClick = (e: React.MouseEvent) => {
    if (permStatus === 'denied') {
      e.preventDefault();
      setPermissionDenied(true);
    }
    // 'granted' | 'limited' | 'prompt' | 'unknown' → allow label to open picker normally
  };

  /** Shown when user taps "فتح الإعدادات" in the modal — requests again first */
  const handleRetryPermission = async () => {
    setPermissionDenied(false);
    await requestPermission('photos');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden relative">
      {/* Cover Image */}
      <div className="h-24 md:h-36 bg-slate-200 dark:bg-slate-800 relative group overflow-hidden">
        <img
          key={formData.coverUrl}
          src={formData.coverUrl || 'https://images.unsplash.com/photo-1579546753319-4d9904917482?w=1200&h=400&fit=crop'}
          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
          alt="Cover"
        />
        {/* Gradient overlay at bottom for readability */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
        {isMe && (
          <>
            {/* Cover change — label/input fires synchronously (iOS-safe) */}
            <label
              htmlFor="cover-file-input-header"
              onClick={guardClick}
              className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all shadow-md flex items-center gap-1.5 group/btn border border-white/20 dark:border-slate-700 active:scale-95 z-10"
              title="تغيير صورة الغلاف"
            >
              <Camera size={13} className="text-[#0a66c2] dark:text-blue-400" />
              <span className="text-[9px] font-black text-slate-600 dark:text-slate-200 uppercase tracking-widest hidden group-hover/btn:block">تغيير</span>
            </label>
            <input
              id="cover-file-input-header"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCoverChange}
            />
          </>
        )}
      </div>

      {/* Profile Info */}
      <div className="px-4 md:px-6 pb-4 relative">
        <div className="flex items-end justify-between -mt-10 md:-mt-14 mb-4">
          <div className="relative group/avatar">
            <div className="w-20 h-20 md:w-28 md:h-28 rounded-3xl border-4 border-white dark:border-slate-900 overflow-hidden shadow-lg bg-white dark:bg-slate-800">
              <img
                key={formData.avatar}
                src={formData.avatar}
                className="w-full h-full object-cover"
                alt="Avatar"
              />
            </div>
            {isMe && (
              <>
                {/* Avatar change — label/input fires synchronously (iOS-safe) */}
                <label
                  htmlFor="avatar-file-input-header"
                  onClick={guardClick}
                  className="absolute bottom-1 left-1 p-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-xl cursor-pointer hover:bg-white dark:hover:bg-slate-700 shadow-md transition-all border border-slate-100 dark:border-slate-700 active:scale-95 z-10"
                  title="تغيير الصورة الشخصية"
                >
                  <Camera size={11} className="text-[#0a66c2] dark:text-blue-400" />
                </label>
                <input
                  id="avatar-file-input-header"
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </>
            )}

            {/* Open-to Badge on Avatar (Small floating tag) */}
            <AnimatePresence>
              {activeOption && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className={`absolute -bottom-1 -left-1 px-2 py-0.5 rounded-full text-[8px] font-black flex items-center gap-1 shadow-md ${activeOption.badge}`}
                >
                  <activeOption.icon size={8} />
                  {activeOption.label}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Name + Badges + Title Row (with buttons) */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isMe ? (
                <input
                  value={formData.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  className="text-xl font-black text-slate-900 dark:text-white bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 rounded-lg px-1"
                />
              ) : (
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{formData.name}</h3>
              )}
              {/* Pro Verified Badge */}
              {isPro && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full shadow-md shadow-amber-200"
                >
                  <BadgeCheck size={11} className="text-white" />
                  <span className="text-[9px] font-black text-white uppercase tracking-widest">Pro</span>
                </motion.div>
              )}

              {/* Account Role Badge */}
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${
                isEmployer
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800'
                  : isFreelancer
                    ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800'
                    : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800'
              }`}>
                {isEmployer ? '💼 صاحب عمل' : isFreelancer ? '⚡ عمل حر / كشفي' : '🎯 باحث عن عمل'}
              </span>
            </div>

            {/* Job title / Industry / Specialty */}
            <p className="text-sm text-slate-600 dark:text-slate-300 font-bold leading-none">
              {(formData.display_title || profile.display_title)
                ? (formData.display_title || profile.display_title)
                : (formData.specialty || profile.specialty)
                  ? (formData.specialty || profile.specialty)
                  : (formData.industry || formData.title)
                    ? (formData.industry || formData.title)
                    : isEmployer
                      ? 'رائد أعمال ومالك مؤسسة'
                      : isFreelancer
                        ? 'فني ميداني وكشف حر'
                        : 'خبير تقني ومتخصص تطوير'}
              {formData.companyName && (
                <span className="text-[#0a66c2] dark:text-blue-400"> · {formData.companyName}</span>
              )}
            </p>

            {/* Meta strip */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[9px] text-slate-400 font-bold">
              {formData.location && (
                <span className="flex items-center gap-1">📍 {formData.location}</span>
              )}
              <span className="text-[#0a66c2] cursor-pointer hover:underline">
                {userPostsCount * 15}+ متابع
              </span>
              {formData.website && (
                <a href={formData.website} target="_blank" rel="noreferrer" className="text-[#0a66c2] hover:underline truncate max-w-[140px]">
                  🔗 {formData.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>

          {/* Action Buttons - Moved Down */}
          <div className="flex gap-2 items-center self-end md:self-start pt-1">
            {isMe ? (
              <>
                <button
                  onClick={() => setActiveTab('edit')}
                  className="px-5 py-2.5 bg-[#0a66c2] text-white rounded-xl font-black text-[10px] hover:bg-[#004182] transition-all shadow-md hover:shadow-lg active:scale-95 uppercase tracking-widest"
                >
                  تعزيز الملف
                </button>
                <button
                  onClick={() => {
                    if (formData.cv_url) {
                      window.open(formData.cv_url, '_blank');
                    } else {
                      handleDownloadCV();
                    }
                  }}
                  className="px-5 py-2.5 border-2 border-[#0a66c2] text-[#0a66c2] rounded-xl font-black text-[10px] hover:bg-blue-50 transition-all active:scale-95 flex items-center gap-2"
                >
                  {formData.cv_url ? '📄 عرض السيرة الذاتية' : 'تحميل CV'}
                </button>
              </>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <button onClick={onMessageClick} className="px-6 py-2.5 bg-[#0a66c2] text-white rounded-xl font-black text-[10px] hover:bg-[#004182] transition-all shadow-md active:scale-95">
                  مراسلة
                </button>
                {showCallButton && (
                <button 
                  onClick={onCallClick} 
                  className="p-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-95"
                  title="اتصال مهني آمن"
                >
                  <Phone size={16} />
                </button>
                )}
                {/* ✅ زر عرض CV للزوار */}
                {(profile.cvUrl || (profile as any).cv_url) && (
                  <a
                    href={profile.cvUrl || (profile as any).cv_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2.5 border-2 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl font-black text-[10px] hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95"
                    title="عرض السيرة الذاتية"
                  >
                    <FileText size={13} />
                    <span>CV</span>
                  </a>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Open-to Toggle (only for seekers / field freelancers, NOT employers) */}
        {isMe && !isEmployer && (
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-2">حالة التوفر للعمل</p>
            <div className="flex gap-2 flex-wrap">
              {OPEN_TO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    handleFieldChange('open_to', opt.value);
                    handleFieldChange('is_available', opt.value === 'work');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border-2 ${
                    openToStatus === opt.value
                      ? `${opt.color} text-white border-transparent shadow-md`
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <opt.icon size={11} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Permission Denied Modal (iOS + Android) */}
      <PermissionDeniedModal
        isOpen={permissionDenied}
        onClose={() => setPermissionDenied(false)}
        onRetry={handleRetryPermission}
        permissionType="photos"
      />
    </div>
  );
};
