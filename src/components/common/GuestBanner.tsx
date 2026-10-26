import React from 'react';
import { motion } from 'motion/react';
import { LogIn, X, EyeOff } from 'lucide-react';

interface GuestBannerProps {
  onLogin: () => void;
  onDismiss?: () => void;
}

export const GuestBanner: React.FC<GuestBannerProps> = ({ onLogin, onDismiss }) => {
  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.5 }}
      className="fixed top-0 left-0 right-0 z-[90] flex justify-center pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div
        className="pointer-events-auto mx-3 mt-1 flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-xl border border-amber-200/60 dark:border-amber-700/40"
        style={{
          background: 'linear-gradient(135deg, rgba(254,243,199,0.97) 0%, rgba(253,230,138,0.97) 100%)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(245,158,11,0.2), 0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        {/* Dark mode overlay */}
        <div className="absolute inset-0 rounded-2xl dark:bg-amber-900/90 pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3 w-full">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <EyeOff size={14} className="text-amber-700 dark:text-amber-400 shrink-0" />
            <p className="text-xs font-black text-amber-800 dark:text-amber-200 truncate">
              أنت تتصفح كزائر — سجّل الدخول للتفاعل
            </p>
          </div>

          <button
            onClick={onLogin}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] rounded-xl shadow-md transition-all active:scale-95"
          >
            <LogIn size={11} />
            دخول
          </button>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="shrink-0 p-1 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
