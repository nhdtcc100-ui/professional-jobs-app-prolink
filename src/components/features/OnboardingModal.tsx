import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase, Users, MessageSquare, Sparkles, ArrowLeft,
  ArrowRight, CheckCircle, Star, Zap, X
} from 'lucide-react';

interface OnboardingModalProps {
  appUser: any;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
}

const STEPS = [
  {
    id: 'welcome',
    icon: Sparkles,
    color: 'from-blue-600 to-indigo-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    iconColor: 'text-blue-600',
    title: 'مرحباً بك في Elevate عراق! 🎉',
    subtitle: 'منصة التواصل المهني الأكثر احترافية',
    description: 'اكتشف عالماً من الفرص الوظيفية والتواصل المهني في مكان واحد.',
    tip: '',
  },
  {
    id: 'profile',
    icon: Star,
    color: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    iconColor: 'text-amber-500',
    title: 'أكمل ملفك الشخصي',
    subtitle: 'الملفات الكاملة تحصل على 5x زيارات أكثر',
    description: 'أضف صورتك، مسماك الوظيفي، مهاراتك، وخبراتك السابقة لجذب أصحاب العمل.',
    tip: '💡 الملفات ذات الصور تحصل على 70% تفاعلاً أكثر',
  },
  {
    id: 'jobs',
    icon: Briefcase,
    color: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    iconColor: 'text-emerald-500',
    title: 'استكشف الوظائف',
    subtitle: 'آلاف الفرص تنتظرك',
    description: 'تصفح أحدث الوظائف، قدّم طلبك في 30 ثانية، وتتبع حالة طلباتك بسهولة.',
    tip: '💡 فعّل إشعارات الوظائف لتكون أول المتقدمين',
  },
  {
    id: 'network',
    icon: Users,
    color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    iconColor: 'text-violet-500',
    title: 'وسّع شبكتك المهنية',
    subtitle: 'التواصل هو مفتاح النجاح',
    description: 'تواصل مع المهنيين في مجالك، شارك المعرفة، وافتح أبواباً لفرص لم تكن تتخيلها.',
    tip: '💡 85% من الوظائف تُشغَل عبر التواصل الشخصي',
  },
  {
    id: 'messages',
    icon: MessageSquare,
    color: 'from-rose-500 to-pink-500',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    iconColor: 'text-rose-500',
    title: 'تواصل مباشرة',
    subtitle: 'محادثات مهنية بدون تعقيد',
    description: 'أرسل رسائل، شارك الوظائف، وانضم للمجموعات المهنية في مجالك.',
    tip: '💡 الردود السريعة ترفع تقييمك في المنصة',
  },
];

const STORAGE_KEY = 'prolink_onboarding_done';

export function OnboardingModal({ appUser, onClose, setActiveTab }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const handleFinish = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onClose();
  };

  const handleAction = () => {
    if (isLast) {
      handleFinish();
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        dir="rtl"
      >
        <motion.div
          initial={{ scale: 0.85, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.85, y: 30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden relative"
        >
          {/* Skip button */}
          <button
            onClick={handleFinish}
            className="absolute top-4 left-4 z-10 p-2 text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X size={18} />
          </button>

          {/* Gradient hero */}
          <div className={`h-48 bg-gradient-to-br ${current.color} flex items-center justify-center relative overflow-hidden`}>
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-20">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-20 h-20 rounded-full bg-white"
                  style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%` }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.3, 0.1] }}
                  transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.5 }}
                />
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 15 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-24 h-24 bg-white/20 rounded-[2rem] flex items-center justify-center backdrop-blur-sm border-2 border-white/30 shadow-2xl"
              >
                <Icon size={44} className="text-white" />
              </motion.div>
            </AnimatePresence>

            {/* Step dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`transition-all duration-300 rounded-full ${
                    i === step ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-xl font-black text-slate-800 dark:text-white mb-1">
                  {current.title}
                </h2>
                <p className="text-xs font-black text-blue-600 dark:text-blue-400 mb-3 uppercase tracking-widest">
                  {current.subtitle}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-4">
                  {current.description}
                </p>
                {current.tip && (
                  <div className={`${current.bg} rounded-2xl px-4 py-3 border border-current/10`}>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{current.tip}</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Profile completion bar (step 1) */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 space-y-1.5"
              >
                <div className="flex justify-between text-[10px] font-black text-slate-400">
                  <span>اكتمال الملف الشخصي</span>
                  <span className="text-amber-500">
                    {[appUser?.name, appUser?.title, appUser?.bio, appUser?.avatar, appUser?.skills?.length].filter(Boolean).length * 20}%
                  </span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-50 dark:border-slate-800">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${[appUser?.name, appUser?.title, appUser?.bio, appUser?.avatar, appUser?.skills?.length].filter(Boolean).length * 20}%` }}
                    transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
                    className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)] relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50" />
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6">
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-600 transition-all"
                >
                  <ArrowRight size={18} />
                </button>
              )}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleAction}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-sm bg-gradient-to-r ${current.color} shadow-lg transition-all`}
              >
                {isLast ? (
                  <><CheckCircle size={18} /> ابدأ الاستكشاف</>
                ) : (
                  <>التالي <ArrowLeft size={18} /></>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Helper hook to show onboarding once for new users
export function useOnboarding(appUser: any) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!appUser) return;
    const done = localStorage.getItem(STORAGE_KEY);
    // Show if not done yet AND profile is incomplete
    const isIncomplete = !appUser.title || !appUser.bio || !appUser.avatar;
    if (!done && isIncomplete) {
      const timer = setTimeout(() => setShowOnboarding(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [appUser?.id]);

  return { showOnboarding, setShowOnboarding };
}
