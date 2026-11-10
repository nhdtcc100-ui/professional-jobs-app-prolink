import React, { useState, useEffect } from 'react';
import {
  User, Briefcase, CheckCircle2, ArrowLeft, Sparkles, LogOut,
  Search, Star, FileText, Globe, Shield, AlertCircle,
  ChevronRight, X, Loader2, Lock, Wrench, Zap, Phone, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';

interface RoleSelectionViewProps {
  selectRole: (role: 'seeker' | 'employer', extraData?: Record<string, any>) => void;
  appUser?: { name?: string; avatar?: string; email?: string } | null;
}

/* ─── بيانات الصلاحيات ──────────────────────────────────────────── */
const SEEKER_FEATURES = [
  { icon: Search,    label: 'تصفح الوظائف الشاغرة',       allowed: true },
  { icon: FileText,  label: 'التقديم بالسيرة الذاتية',    allowed: true },
  { icon: Globe,     label: 'بناء ملف مهني احترافي',      allowed: true },
  { icon: Star,      label: 'متابعة الشركات والأشخاص',    allowed: true },
  { icon: Briefcase, label: 'نشر وظائف والتوظيف',         allowed: false },
  { icon: Shield,    label: 'أدوات ERP وإدارة الموظفين',  allowed: false },
];

const EMPLOYER_FEATURES = [
  { icon: Briefcase, label: 'نشر وظائف بلا قيود',          allowed: true },
  { icon: User,      label: 'استقبال وفلترة المتقدمين',   allowed: true },
  { icon: Star,      label: 'التواصل مع أفضل الكفاءات',   allowed: true },
  { icon: Globe,     label: 'ملف شركة احترافي',             allowed: true },
  { icon: Search,    label: 'تصفح الوظائف كمتقدّم',        allowed: false },
  { icon: Shield,    label: 'أدوات ERP وإدارة الموظفين',   allowed: false },
];

/* ─── بطاقة الصلاحيات ──────────────────────────────────────────── */
const FeatureRow = ({ icon: Icon, label, allowed }: { icon: any; label: string; allowed: boolean }) => (
  <div className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all ${
    allowed ? 'bg-white/5' : 'opacity-40'
  }`}>
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
      allowed ? 'bg-white/15' : 'bg-white/5'
    }`}>
      <Icon size={14} className={allowed ? 'text-white' : 'text-white/40'} />
    </div>
    <span className={`text-sm font-bold flex-1 ${allowed ? 'text-white/90' : 'text-white/30 line-through'}`}>
      {label}
    </span>
    {allowed
      ? <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
      : <X size={13} className="text-red-400/60 flex-shrink-0" />
    }
  </div>
);

/* ─── شاشة التأكيد ──────────────────────────────────────────────── */
const ConfirmStep = ({
  role,
  onConfirm,
  onBack,
  isSubmitting,
}: {
  role: 'seeker' | 'employer';
  onConfirm: (extraData?: Record<string, any>) => void;
  onBack: () => void;
  isSubmitting: boolean;
}) => {
  const isSeeker = role === 'seeker';
  const isEmployer = role === 'employer';

  const handleFinish = () => {
    onConfirm();
  };

  return (
    <motion.div
      key="confirm"
      initial={{ opacity: 0, scale: 0.94, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -24 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="flex flex-col items-center text-center w-full"
    >
      {/* أيقونة */}
      <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl ${
        isSeeker
          ? 'bg-gradient-to-br from-blue-500 to-violet-600 shadow-blue-500/30'
          : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
      }`}>
        {isSeeker && <User size={40} className="text-white" />}
        {isEmployer && <Briefcase size={40} className="text-white" />}
      </div>

      <h2 className="text-2xl font-black text-white mb-2">
        {isSeeker ? 'باحث عن عمل' : 'صاحب عمل / شركة'}
      </h2>
      <p className="text-slate-400 text-sm font-bold mb-6 max-w-sm leading-relaxed">
        {isSeeker
          ? 'ستُفعَّل صلاحيات البحث والتقديم على الوظائف وبناء ملفك المهني.'
          : 'ستُفعَّل صلاحيات نشر الوظائف، استقبال المتقدمين، وإدارة عمليات التوظيف.'}
      </p>

      {/* تحذير */}
      <div className="w-full flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-8 text-right">
        <Lock size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-300/90 text-xs font-bold leading-relaxed">
          هذا الاختيار <strong>نهائي</strong> ولا يمكن تغييره ذاتياً. للتحويل إلى صاحب عمل مستقبلاً يتطلب إرسال طلب للموافقة من الإدارة.
        </p>
      </div>

      {/* أزرار */}
      <div className="w-full space-y-3">
        <button
          onClick={handleFinish}
          disabled={isSubmitting}
          className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 ${
            isSeeker
              ? 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-blue-500/25'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25'
          }`}
        >
          {isSubmitting ? (
            <><Loader2 size={16} className="animate-spin" /> جاري التفعيل...</>
          ) : (
            <><span>تأكيد ودخول المنصة</span><ArrowLeft size={16} /></>
          )}
        </button>
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="w-full py-3 rounded-2xl font-bold text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
        >
          العودة للاختيار
        </button>
      </div>
    </motion.div>
  );
};

/* ─── المكوّن الرئيسي ───────────────────────────────────────────── */
export const RoleSelectionView: React.FC<RoleSelectionViewProps> = ({ selectRole, appUser }) => {
  const [selectedRole, setSelectedRole] = useState<'seeker' | 'employer' | null>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [particles, setParticles] = useState<{ x: number; y: number; size: number; delay: number }[]>([]);

  /* جزيئات متحركة في الخلفية */
  useEffect(() => {
    setParticles(
      Array.from({ length: 18 }, (_, i) => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1.5,
        delay: i * 0.25,
      }))
    );
  }, []);

  const handleConfirm = async (extraData?: Record<string, any>) => {
    if (!selectedRole || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await selectRole(selectedRole, extraData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    localStorage.clear();
    await supabase.auth.signOut();
    window.location.reload();
  };

  const isSeeker = selectedRole === 'seeker';
  const isEmployer = selectedRole === 'employer';

  return (
    <div
      className="min-h-screen flex items-stretch relative overflow-hidden"
      dir="rtl"
      style={{ background: 'linear-gradient(135deg, #0d0f1a 0%, #0f1729 50%, #0d1a14 100%)' }}
    >
      {/* ── جزيئات الخلفية ── */}
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white/10 pointer-events-none"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{ y: [0, -24, 0], opacity: [0.1, 0.4, 0.1] }}
          transition={{ duration: 5 + p.delay, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
        />
      ))}

      {/* ── بقع ضوء ── */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* ══════════════ LAYOUT ══════════════ */}
      <div className="relative z-10 w-full flex flex-col lg:flex-row">

        {/* ── جانب أيمن: بطاقة الاختيار / التأكيد ── */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-16">
          {/* شعار + مقدمة */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8 w-full max-w-xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-widest mb-4">
              <Sparkles size={13} />
              خطوة أخيرة
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-2">
              {appUser?.name ? `مرحباً ${appUser.name.split(' ')[0]} 👋` : 'مرحباً بك في ProLink 👋'}
            </h1>
            <p className="text-slate-400 text-sm font-bold leading-relaxed">
              حدّد كيف ستستخدم المنصة لتُخصَّص لك الواجهة والصلاحيات المناسبة
            </p>
          </motion.div>

          {/* ── محتوى الخطوات ── */}
          <div className="w-full max-w-xl">
            <AnimatePresence mode="wait">
              {step === 'select' ? (
                <motion.div
                  key="select"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                >
                  {/* بطاقات الدور */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {/* باحث عن عمل */}
                    <motion.button
                      whileHover={{ scale: 1.025, y: -4 }}
                      whileTap={{ scale: 0.975 }}
                      onClick={() => setSelectedRole('seeker')}
                      className={`relative p-5 rounded-[1.75rem] border-2 text-right transition-all cursor-pointer overflow-hidden flex flex-col gap-3 ${
                        selectedRole === 'seeker'
                          ? 'border-blue-500 bg-blue-600/15 shadow-2xl shadow-blue-500/20 ring-4 ring-blue-500/10'
                          : 'border-white/10 bg-white/5 hover:border-blue-400/40 hover:bg-blue-600/5'
                      }`}
                    >
                      {selectedRole === 'seeker' && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute top-3 left-3 bg-blue-500 text-white rounded-full p-1"
                        >
                          <CheckCircle2 size={13} />
                        </motion.div>
                      )}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all ${
                        selectedRole === 'seeker'
                          ? 'bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-blue-500/30 scale-105'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        <User size={22} />
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-white mb-0.5">باحث عن عمل</h3>
                        <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
                          استكشف الوظائف وقدّم بالـ CV
                        </p>
                      </div>
                    </motion.button>

                    {/* صاحب عمل */}
                    <motion.button
                      whileHover={{ scale: 1.025, y: -4 }}
                      whileTap={{ scale: 0.975 }}
                      onClick={() => setSelectedRole('employer')}
                      className={`relative p-5 rounded-[1.75rem] border-2 text-right transition-all cursor-pointer overflow-hidden flex flex-col gap-3 ${
                        selectedRole === 'employer'
                          ? 'border-emerald-500 bg-emerald-600/15 shadow-2xl shadow-emerald-500/20 ring-4 ring-emerald-500/10'
                          : 'border-white/10 bg-white/5 hover:border-emerald-400/40 hover:bg-emerald-600/5'
                      }`}
                    >
                      {selectedRole === 'employer' && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute top-3 left-3 bg-emerald-500 text-white rounded-full p-1"
                        >
                          <CheckCircle2 size={13} />
                        </motion.div>
                      )}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all ${
                        selectedRole === 'employer'
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/30 scale-105'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        <Briefcase size={22} />
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-white mb-0.5">صاحب عمل</h3>
                        <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
                          انشر الوظائف واستقطب الكوادر
                        </p>
                      </div>
                    </motion.button>
                  </div>

                  {/* زر التالي */}
                  <motion.button
                    onClick={() => selectedRole && setStep('confirm')}
                    disabled={!selectedRole}
                    whileTap={{ scale: 0.97 }}
                    className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
                      selectedRole
                        ? isSeeker
                          ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-blue-500/20 hover:from-blue-500 hover:to-violet-500'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500'
                        : 'bg-white/5 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {selectedRole ? (
                      <><span>متابعة</span><ChevronRight size={18} /></>
                    ) : (
                      'اختر نوع حسابك أولاً'
                    )}
                  </motion.button>

                  {/* تسجيل الخروج */}
                  <div className="mt-5 flex justify-center">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors font-bold"
                    >
                      <LogOut size={13} /> تسجيل الخروج
                    </button>
                  </div>
                </motion.div>
              ) : (
                <ConfirmStep
                  role={selectedRole!}
                  onConfirm={handleConfirm}
                  onBack={() => setStep('select')}
                  isSubmitting={isSubmitting}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── جانب أيسر: لوحة الصلاحيات (ديسكتوب فقط) ── */}
        <AnimatePresence mode="wait">
          {selectedRole && step === 'select' && (
            <motion.div
              key={selectedRole}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className={`hidden lg:flex flex-col justify-center w-80 xl:w-96 p-10 border-r border-white/5 ${
                isSeeker
                  ? 'bg-gradient-to-b from-blue-600/8 to-violet-600/5'
                  : 'bg-gradient-to-b from-emerald-600/8 to-teal-600/5'
              }`}
            >
              <div className="mb-6">
                <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
                  isSeeker ? 'text-blue-400' : 'text-emerald-400'
                }`}>
                  صلاحيات الحساب
                </p>
                <h3 className="text-xl font-black text-white">
                  {isSeeker ? 'باحث عن عمل' : 'صاحب عمل'}
                </h3>
              </div>

              <div className="space-y-1.5">
                {(isSeeker ? SEEKER_FEATURES : EMPLOYER_FEATURES).map((f, i) => (
                  <motion.div
                    key={f.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                  >
                    <FeatureRow icon={f.icon} label={f.label} allowed={f.allowed} />
                  </motion.div>
                ))}
              </div>

              <div className="mt-8 flex items-start gap-3 bg-amber-500/8 border border-amber-500/15 rounded-2xl p-4">
                <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-300/80 text-xs font-bold leading-relaxed">
                  الدور نهائي بعد التأكيد. لتغييره أرسل طلباً عبر <strong>الدعم الفني</strong> من داخل التطبيق.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
