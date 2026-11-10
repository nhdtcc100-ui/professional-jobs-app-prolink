import React from 'react';
import { motion } from 'motion/react';
import { 
  Phone, FileText, User, BadgeCheck, Briefcase, Mail, MessageSquare 
} from 'lucide-react';

interface ProfileInfoCardProps {
  profile: any;
  isMe: boolean;
  onMessageClick?: () => void;
  onCallClick?: () => void;
  showCallButton?: boolean;
  onGoToSettings?: () => void;
}

export const ProfileInfoCard: React.FC<ProfileInfoCardProps> = ({
  profile,
  isMe,
  onMessageClick,
  onCallClick,
  showCallButton = false,
  onGoToSettings,
}) => {
  const currentRole = profile?.role || (profile as any)?.account_type || 'seeker';
  const isEmployer   = currentRole === 'employer' || (profile as any)?.account_type === 'employer' || !!(profile as any)?.company;
  const isFreelancer = currentRole === 'freelancer';
  const isPro        = profile?.is_pro || profile?.isPro;

  const displayName  = profile?.name || 'مستخدم';
  const displayTitle = profile?.display_title || profile?.title || profile?.industry || '';
  const bio          = profile?.bio || '';
  const phone        = profile?.phone || '';
  const cvUrl        = profile?.cvUrl || profile?.cv_url || '';
  const avatar       = profile?.avatar || profile?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;

  const roleBadge = isEmployer
    ? { label: '💼 صاحب عمل',    cls: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800' }
    : isFreelancer
    ? { label: '⚡ عمل حر / كشفي', cls: 'bg-amber-50   text-amber-600   border-amber-200   dark:bg-amber-950/50   dark:text-amber-400   dark:border-amber-800' }
    : { label: '🎯 باحث عن عمل',  cls: 'bg-blue-50   text-blue-600   border-blue-200   dark:bg-blue-950/50   dark:text-blue-400   dark:border-blue-800' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-xl mx-auto"
    >
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-lg overflow-hidden" dir="rtl">
        
        {/* ── Top accent strip ── */}
        <div className="h-2 bg-gradient-to-l from-blue-600 via-indigo-500 to-blue-400" />

        <div className="p-8 space-y-6">
          {/* ── Avatar + Name block ── */}
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden">
                <img
                  src={avatar}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              {isPro && (
                <div className="absolute -bottom-1 -right-1 p-1 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-md">
                  <BadgeCheck size={14} className="text-white" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {displayName}
              </h2>

              {/* Role badge */}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${roleBadge.cls}`}>
                {roleBadge.label}
              </span>

              {/* Job title */}
              {displayTitle && (
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  {displayTitle}
                  {profile?.companyName && (
                    <span className="text-blue-500 dark:text-blue-400"> · {profile.companyName}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* ── Info rows ── */}
          <div className="space-y-3">
            {phone ? (
              <div className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center shrink-0">
                  <Phone size={18} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم الهاتف</p>
                  <p className="text-sm font-black text-slate-800 dark:text-white" dir="ltr">{phone}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3.5 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                  <Phone size={18} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم الهاتف</p>
                  <p className="text-xs font-bold text-slate-400">لم يتم إضافة رقم هاتف بعد</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <User size={18} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">السيرة الذاتية / النبذة</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed whitespace-pre-wrap">
                  {bio || 'لا توجد نبذة تعريفية مسجلة بعد.'}
                </p>
              </div>
            </div>

            {/* CV Section — Hidden completely for employers */}
            {!isEmployer && (
              cvUrl ? (
                <a
                  href={cvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3.5 bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-2xl hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-all group"
                >
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
                    <FileText size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">ملف السيرة الذاتية (CV)</p>
                    <p className="text-sm font-black text-blue-700 dark:text-blue-300 group-hover:underline">
                      📄 عرض / تحميل ملف السيرة الذاتية ↗
                    </p>
                  </div>
                </a>
              ) : (
                <div className="flex items-center gap-3 p-3.5 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ملف السيرة الذاتية (CV)</p>
                    <p className="text-xs font-bold text-slate-400">لا يوجد ملف سيرة ذاتية مرفوع</p>
                  </div>
                </div>
              )
            )}
          </div>

          {/* ── Action buttons: visitor (message/call) or owner (go to settings) ── */}
          {isMe ? (
            onGoToSettings && (
              <div className="pt-2">
                <button
                  onClick={onGoToSettings}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-xs transition-all active:scale-98"
                >
                  <span>تعديل البيانات من قائمة الإعدادات ⚙️</span>
                </button>
              </div>
            )
          ) : (
            <div className="flex gap-3 pt-2">
              <button
                onClick={onMessageClick}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm transition-all shadow-md shadow-blue-500/20 active:scale-95"
              >
                <MessageSquare size={16} />
                مراسلة
              </button>
              {showCallButton && (
                <button
                  onClick={onCallClick}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm transition-all shadow-md shadow-emerald-500/20 active:scale-95"
                >
                  <Phone size={16} />
                  اتصال
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

