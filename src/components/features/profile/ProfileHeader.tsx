import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, BadgeCheck, Briefcase, Search, Minus, Phone, 
  MapPin, Globe, FileText, Linkedin, Twitter, Github, Mail, ExternalLink 
} from 'lucide-react';

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
}

const OPEN_TO_OPTIONS = [
  { value: 'work', label: 'متاح للعمل', icon: Briefcase, color: 'bg-emerald-500', ring: 'ring-emerald-400', badge: 'bg-emerald-500 text-white' },
  { value: 'hiring', label: 'أبحث عن موهبة', icon: Search, color: 'bg-blue-500', ring: 'ring-blue-400', badge: 'bg-blue-500 text-white' },
  { value: 'none', label: 'غير متاح حالياً', icon: Minus, color: 'bg-slate-300', ring: 'ring-slate-200', badge: 'hidden' },
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
  onCallClick
}) => {
  const openToStatus = formData.open_to || 'none';
  const activeOption = OPEN_TO_OPTIONS.find(o => o.value === openToStatus);
  const isAvailable = openToStatus !== 'none';
  const isPro = profile.is_pro || profile.isPro;

  return (
    <div className="bg-white rounded-t-2xl md:rounded-2xl overflow-hidden border border-slate-100 shadow-sm relative mb-4">
      {/* Cover Image */}
      <div className="h-24 md:h-36 bg-slate-200 relative group overflow-hidden">
        <img
          src={formData.coverUrl || 'https://images.unsplash.com/photo-1579546753319-4d9904917482?w=1200&h=400&fit=crop'}
          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
          alt="Cover"
        />
        {/* Gradient overlay at bottom for readability */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
        {isMe && (
          <label className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-md rounded-xl cursor-pointer hover:bg-white transition-all shadow-md flex items-center gap-1.5 group/btn">
            <Camera size={13} className="text-[#0a66c2]" />
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest hidden group-hover/btn:block">تغيير</span>
            <input type="file" className="hidden" accept="image/*" onChange={handleCoverChange} />
          </label>
        )}
      </div>

      {/* Profile Info */}
      <div className="px-4 md:px-6 pb-4 relative">
        <div className="flex items-end justify-between -mt-10 md:-mt-14 mb-4">
          {/* Avatar + availability ring */}
          <div className="relative">
            <div className={`rounded-full p-0.5 transition-all ${isAvailable ? `ring-[3px] ${activeOption?.ring}` : 'ring-2 ring-white'}`}>
              <div className="relative w-16 h-16 md:w-[88px] md:h-[88px] group">
                <img
                  src={formData.avatar}
                  className="w-full h-full rounded-full border-3 border-white shadow-lg object-cover bg-white"
                  alt="Avatar"
                />
                {isMe && (
                  <label className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-black/30 rounded-full">
                    <Camera size={20} className="text-white" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                  </label>
                )}
              </div>
            </div>
            {/* Availability Badge */}
            <AnimatePresence>
              {isAvailable && activeOption && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
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
                  className="text-xl font-black text-slate-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-100 rounded-lg px-1"
                />
              ) : (
                <h3 className="text-xl font-black text-slate-900">{formData.name}</h3>
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
            </div>

            {/* Job title / Industry */}
            <p className="text-sm text-slate-600 font-bold leading-none">
              {formData.industry
                ? formData.industry
                : profile.role === 'employer'
                  ? 'رائد أعمال ومالك أعمال'
                  : 'خبير تقني ومتخصص تطوير'}
              {formData.companyName && (
                <span className="text-[#0a66c2]"> · {formData.companyName}</span>
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
              <div className="flex gap-2">
                <button onClick={onMessageClick} className="px-6 py-2.5 bg-[#0a66c2] text-white rounded-xl font-black text-[10px] hover:bg-[#004182] transition-all shadow-md active:scale-95">
                  مراسلة
                </button>
                <button 
                  onClick={onCallClick} 
                  className="p-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-95"
                  title="اتصال مهني آمن"
                >
                  <Phone size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Open-to Toggle (only for me) */}
        {isMe && (
          <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">حالة التوفر</p>
            <div className="flex gap-2 flex-wrap">
              {OPEN_TO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleFieldChange('open_to', opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border-2 ${
                    openToStatus === opt.value
                      ? `${opt.color} text-white border-transparent shadow-md`
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
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
    </div>
  );
};
