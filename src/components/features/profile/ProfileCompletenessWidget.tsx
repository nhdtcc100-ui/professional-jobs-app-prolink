import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ChevronRight } from 'lucide-react';

interface ProfileCompletenessWidgetProps {
  profile: any;
  onGoToEdit: () => void;
}

export const ProfileCompletenessWidget: React.FC<ProfileCompletenessWidgetProps> = ({ profile, onGoToEdit }) => {
  const steps = useMemo(() => [
    { label: 'صورة شخصية', done: !!profile.avatar && !profile.avatar.includes('ui-avatars') },
    { label: 'صورة الغلاف', done: !!profile.coverUrl },
    { label: 'نبذة شخصية', done: !!profile.bio && profile.bio.length > 20 },
    { label: 'الخبرة المهنية', done: !!profile.experience && profile.experience.length > 10 },
    { label: 'التعليم', done: !!profile.education && profile.education.length > 5 },
    { label: '3 مهارات أو أكثر', done: (profile.skills || []).length >= 3 },
    { label: 'الموقع الجغرافي', done: !!profile.location },
    { label: 'رقم الهاتف أو الموقع الإلكتروني', done: !!(profile.phone || profile.website) },
    { label: 'السيرة الذاتية (CV)', done: !!profile.cv_url },
  ], [profile]);

  const completed = steps.filter(s => s.done).length;
  const total = steps.length;
  const percent = Math.round((completed / total) * 100);

  const nextMissing = steps.find(s => !s.done);

  const getStrength = () => {
    if (percent >= 90) return { label: 'ملف احترافي ممتاز', color: 'text-emerald-600', bg: 'bg-emerald-500', ring: 'ring-emerald-100' };
    if (percent >= 60) return { label: 'ملف جيد', color: 'text-blue-600', bg: 'bg-blue-500', ring: 'ring-blue-100' };
    if (percent >= 30) return { label: 'ملف أساسي', color: 'text-amber-600', bg: 'bg-amber-500', ring: 'ring-amber-100' };
    return { label: 'ملف ضعيف', color: 'text-red-500', bg: 'bg-red-500', ring: 'ring-red-100' };
  };

  const strength = getStrength();
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 flex flex-col gap-4"
    >
      <div className="flex items-center gap-4">
        {/* Circular Progress */}
        <div className={`relative shrink-0 ring-4 ${strength.ring} rounded-full`}>
          <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
            <circle cx="36" cy="36" r="28" fill="none" stroke="#f1f5f9" strokeWidth="5" />
            <motion.circle
              cx="36" cy="36" r="28" fill="none"
              stroke={strength.bg.replace('bg-', 'var(--tw-')}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className={strength.bg.replace('bg-', 'stroke-')}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-lg font-black ${strength.color}`}>{percent}%</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-black text-slate-800">اكتمال ملفك الشخصي</h4>
          <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${strength.color}`}>
            {strength.label}
          </p>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {completed} من {total} خطوة مكتملة
          </p>
        </div>
      </div>

      {/* Next step suggestion */}
      {nextMissing && (
        <button
          onClick={onGoToEdit}
          className="flex items-center justify-between w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-2xl transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-dashed border-blue-300 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
            </div>
            <div className="text-right">
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">الخطوة التالية</p>
              <p className="text-xs font-black text-blue-700">{nextMissing.label}</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-blue-400 group-hover:translate-x-1 transition-transform" />
        </button>
      )}

      {/* Steps checklist */}
      <div className="grid grid-cols-2 gap-1.5">
        {steps.map((step) => (
          <div key={step.label} className={`flex items-center gap-2 px-2 py-1.5 rounded-xl text-[10px] font-bold ${step.done ? 'text-emerald-600' : 'text-slate-400'}`}>
            <CheckCircle2 size={12} className={step.done ? 'text-emerald-500' : 'text-slate-200'} />
            <span className="truncate">{step.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
