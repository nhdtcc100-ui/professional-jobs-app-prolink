import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, X, Lock, Globe, Check, Copy, ArrowRight, MessageSquare, ShieldCheck, Share2 } from 'lucide-react';
import { GlassButton } from '../../ui';

interface TelegramGroupJoinModalProps {
  group: any;
  isOpen: boolean;
  onClose: () => void;
  onJoin: (group: any) => Promise<void>;
  onOpenChat: (group: any) => void;
  isMember: boolean;
  isPending?: boolean;
}

export const TelegramGroupJoinModal: React.FC<TelegramGroupJoinModalProps> = ({
  group,
  isOpen,
  onClose,
  onJoin,
  onOpenChat,
  isMember,
  isPending = false,
}) => {
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !group) return null;

  const handleJoinClick = async () => {
    if (isMember) {
      onOpenChat(group);
      onClose();
      return;
    }

    setJoining(true);
    try {
      await onJoin(group);
    } finally {
      setJoining(false);
    }
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/group/${group.id}`;
    navigator.clipboard?.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-all"
          >
            <X size={16} />
          </button>

          {/* Group Cover Banner */}
          <div className="h-32 sm:h-36 relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600">
            {group.cover_url ? (
              <img
                src={group.cover_url}
                alt={group.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center opacity-20">
                <Users size={64} className="text-white" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            
            {/* Category Pill */}
            <div className="absolute top-4 right-4">
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white font-black text-[10px] rounded-full border border-white/20 shadow-sm flex items-center gap-1">
                {group.is_private ? <Lock size={10} /> : <Globe size={10} />}
                {group.category || 'عام'}
              </span>
            </div>
          </div>

          {/* Group Avatar & Info (Telegram Card Style) */}
          <div className="p-6 pt-0 relative">
            <div className="flex items-end justify-between -mt-10 mb-4">
              <div className="w-20 h-20 rounded-3xl bg-white dark:bg-slate-800 p-1 shadow-2xl border-4 border-white dark:border-slate-900 overflow-hidden">
                {group.avatar_url ? (
                  <img src={group.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-inner">
                    {group.name?.charAt(0) || 'م'}
                  </div>
                )}
              </div>

              {/* Copy Invite Link */}
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-[11px] transition-all"
                title="نسخ رابط الدعوة للمجموعة"
              >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                <span>{copied ? 'تم النسخ!' : 'رابط الدعوة'}</span>
              </button>
            </div>

            {/* Title & Stats */}
            <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              {group.name}
            </h3>

            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 font-bold">
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <Users size={13} />
                {group.member_count || 1} عضو مهني
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={13} />
                {group.is_private ? 'مجموعة خاصة' : 'مجموعة عامة ومفتوحة'}
              </span>
            </div>

            {/* Description */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {group.description || 'مساحة احترافية مخصصة لتبادل الخبرات وتطوير المهارات والتواصل المهني.'}
              </p>
            </div>

            {/* Main Action Button (Telegram Join Button) */}
            <div className="mt-5 space-y-2">
              <button
                onClick={handleJoinClick}
                disabled={joining || isPending}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-500/25 transition-all active:scale-98 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {joining ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري الانضمام...</span>
                  </>
                ) : isMember ? (
                  <>
                    <MessageSquare size={16} />
                    <span>فتح المحادثة والرسائل</span>
                  </>
                ) : isPending ? (
                  <>
                    <span>طلب الانضمام قيد المراجعة ⌛</span>
                  </>
                ) : group.is_private ? (
                  <>
                    <Lock size={15} />
                    <span>طلب انضمام للمجموعة</span>
                  </>
                ) : (
                  <>
                    <span>انضمام للمجموعة 🚀</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-slate-400 font-bold">
                {isMember
                  ? 'أنت عضو في هذا المجتمع، يمكنك إرسال الرسائل والمشاركة'
                  : group.is_private
                  ? 'سيتلقى مسؤول المجموعة طلبك للموافقة عليه'
                  : 'بالانضمام ستتمكن من قراءة الرسائل والتفاعل فوراً'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
