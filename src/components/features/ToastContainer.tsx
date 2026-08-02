import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, AlertTriangle, Info, Zap } from 'lucide-react';

interface ToastContainerProps {
  toasts: { id: number; message: string; type?: string }[];
}

const TOAST_STYLES = {
  success: {
    bg: 'bg-emerald-500',
    border: 'border-emerald-400',
    icon: CheckCircle,
    glow: 'shadow-emerald-500/30',
  },
  error: {
    bg: 'bg-red-500',
    border: 'border-red-400',
    icon: XCircle,
    glow: 'shadow-red-500/30',
  },
  warning: {
    bg: 'bg-amber-500',
    border: 'border-amber-400',
    icon: AlertTriangle,
    glow: 'shadow-amber-500/30',
  },
  info: {
    bg: 'bg-blue-500',
    border: 'border-blue-400',
    icon: Info,
    glow: 'shadow-blue-500/30',
  },
  default: {
    bg: 'bg-slate-800',
    border: 'border-slate-700',
    icon: Zap,
    glow: 'shadow-slate-800/30',
  },
};

export function ToastContainer({ toasts }: ToastContainerProps) {
  return (
    <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 z-[999] flex flex-col gap-3 items-center md:items-end pointer-events-none w-[calc(100%-2rem)] md:w-auto max-w-sm">
      <AnimatePresence mode="popLayout">
        {toasts.map(t => {
          const style = TOAST_STYLES[(t.type as keyof typeof TOAST_STYLES) || 'default'] || TOAST_STYLES.default;
          const Icon = style.icon;

          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className={`
                flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border backdrop-blur-xl
                text-white pointer-events-auto w-full
                ${style.bg} ${style.border} ${style.glow}
              `}
              dir="rtl"
            >
              <div className="p-1.5 bg-white/20 rounded-xl shrink-0">
                <Icon size={16} className="text-white" />
              </div>
              <span className="text-sm font-bold leading-snug flex-1">{t.message}</span>
              {/* Progress bar */}
              <motion.div
                className="absolute bottom-0 left-0 h-[3px] bg-white/30 rounded-full"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 3.5, ease: 'linear' }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
