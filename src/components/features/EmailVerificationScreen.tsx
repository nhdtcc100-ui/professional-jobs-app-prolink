import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, RefreshCw, ArrowRight, CheckCircle, Briefcase, Inbox } from 'lucide-react';
import { authService } from '../../lib/services/authService';
import { IcyBackground } from '../layout';

interface EmailVerificationScreenProps {
  email: string;
  onBack: () => void;
}

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({ email, onBack }) => {
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  const [resendCount, setResendCount] = useState(0);

  const handleResend = async () => {
    if (resendCount >= 3) {
      setResendError('لقد وصلت للحد الأقصى لإعادة الإرسال. يرجى الانتظار قليلاً.');
      return;
    }
    setResending(true);
    setResendError('');
    setResendSuccess(false);
    try {
      const { error } = await authService.resendVerification(email);
      if (error) throw error;
      setResendSuccess(true);
      setResendCount(prev => prev + 1);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (e: any) {
      setResendError(e.message || 'فشل إعادة الإرسال. حاول لاحقاً.');
    } finally {
      setResending(false);
    }
  };

  const maskedEmail = email.replace(/(.{2})(.+)(@.+)/, (_, start, middle, end) =>
    start + '*'.repeat(Math.min(middle.length, 5)) + end
  );

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#030712] relative flex flex-col items-center justify-center p-4" dir="rtl">
      <IcyBackground />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Card */}
        <div className="bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-2xl shadow-slate-200/80 dark:shadow-black/40 overflow-hidden">

          {/* Top gradient bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#0a66c2] via-blue-400 to-indigo-500" />

          <div className="p-8 flex flex-col items-center text-center">
            {/* Logo */}
            <div className="w-12 h-12 bg-gradient-to-tr from-[#0a66c2] to-[#002d5b] rounded-2xl flex items-center justify-center shadow-lg text-white mb-6">
              <Briefcase size={22} />
            </div>

            {/* Animated Email Icon */}
            <motion.div
              className="relative mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
            >
              {/* Glow ring */}
              <motion.div
                className="absolute inset-0 rounded-full bg-blue-400/20"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.1, 0.5] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="relative w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/60 dark:to-indigo-900/40 rounded-full flex items-center justify-center border border-blue-100 dark:border-blue-800/40 shadow-lg shadow-blue-100/50 dark:shadow-blue-900/20">
                <Mail size={40} className="text-[#0a66c2] dark:text-blue-400" />
                {/* Floating dots */}
                <motion.div
                  className="absolute top-2 right-2 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-2">
                تحقق من بريدك
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-1">
                أرسلنا رابط التأكيد إلى
              </p>
              <p className="text-sm font-black text-[#0a66c2] dark:text-blue-400 mb-5 tracking-wide" dir="ltr">
                {maskedEmail}
              </p>
            </motion.div>

            {/* Steps */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 text-right space-y-3"
            >
              {[
                { icon: Inbox, text: 'افتح تطبيق البريد الإلكتروني', step: '١' },
                { icon: Mail, text: 'ابحث عن رسالة من ProLink', step: '٢' },
                { icon: CheckCircle, text: 'انقر على رابط التأكيد', step: '٣' },
              ].map(({ icon: Icon, text, step }) => (
                <div key={step} className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-[#0a66c2]/10 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0">
                    <Icon size={13} className="text-[#0a66c2] dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex-1">{text}</span>
                  <span className="text-[10px] font-black text-slate-400 w-5 text-left">{step}</span>
                </div>
              ))}
            </motion.div>

            {/* Resend feedback */}
            <AnimatePresence mode="wait">
              {resendSuccess && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="w-full mb-4 flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-xl text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle size={13} className="shrink-0" />
                  <span>تم إرسال الرابط مجدداً! تفقد بريدك.</span>
                </motion.div>
              )}
              {resendError && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="w-full mb-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 rounded-xl text-[11px] font-bold text-red-600 dark:text-red-400"
                >
                  <span>⚠️ {resendError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Resend button */}
            <motion.button
              onClick={handleResend}
              disabled={resending || resendCount >= 3}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-xl border border-[#0a66c2]/30 dark:border-blue-700/40 bg-blue-50 dark:bg-blue-900/20 text-[#0a66c2] dark:text-blue-400 text-sm font-black flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed mb-3"
            >
              <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
              {resending ? 'جاري الإرسال...' : 'إرسال الرابط مجدداً'}
            </motion.button>

            {/* Back to login */}
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <span>العودة لتسجيل الدخول</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Hint note */}
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-4 font-bold px-2">
          لم تجد الرسالة؟ تفقد مجلد الرسائل غير المرغوب فيها (Spam).
        </p>
      </motion.div>
    </div>
  );
};
