import React from 'react';
import { motion } from 'motion/react';

export const GlassCard = ({ children, className = '', onClick, style }: { children: React.ReactNode, className?: string, onClick?: () => void, key?: React.Key, style?: React.CSSProperties }) => (
  <div onClick={onClick} style={style} className={`card-3d rounded-2xl overflow-hidden ${className}`}>
    {children}
  </div>
);

export const GlassButton = ({ onClick, children, variant = 'primary', icon: Icon, disabled = false, className = '' }: any) => {
  const variants = {
    primary: "bg-[#0a66c2] text-white shadow-lg hover:bg-[#004182]",
    outline: "bg-white/40 text-[#0a66c2] border border-[#0a66c2]/20 hover:bg-white/60 backdrop-blur-md",
    glass: "bg-white/20 text-slate-700 border border-white/40 hover:bg-white/40 backdrop-blur-md shadow-sm",
    danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
  };

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled}
      className={`relative px-5 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${variants[variant as keyof typeof variants]} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </motion.button>
  );
};

export const CloseButton = ({ onClick, className = '' }: { onClick: () => void, className?: string }) => (
  <button 
    onClick={onClick}
    className={`p-2 bg-slate-100/50 hover:bg-red-500 hover:text-white text-slate-400 rounded-xl transition-all active:scale-90 ${className}`}
    title="إغلاق"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  </button>
);

export {
  Skeleton,
  SkeletonPostCard,
  SkeletonJobCard,
  SkeletonJobCardCompact,
  SkeletonConversationItem,
  SkeletonUserCard,
  SkeletonProfileHeader,
  SkeletonApplicationCard,
  SkeletonNotificationItem,
  SkeletonStatCard,
} from './Skeleton';
