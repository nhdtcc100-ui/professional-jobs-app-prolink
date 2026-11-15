import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, X, CheckCheck, Briefcase, Heart, MessageSquare, 
  UserPlus, Check, UserCheck, ChevronRight, Clock, Phone,
  Eye, EyeOff, Trash2, Flame, ArrowLeftRight, CheckCircle2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AppNotification } from '../../types';
import { useAppContext } from '../../contexts/AppContext';
import { profileService } from '../../lib/services/profileService';

interface NotificationPanelProps {
  notifications: AppNotification[];
  readNotifIds: Set<string>;
  setReadNotifIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  setShowNotifications: (show: boolean) => void;
  setActiveTab: (tab: string) => void;
  handleAcceptSync: (notif: AppNotification) => Promise<void>;
  addToast: (msg: string, type?: 'success' | 'error') => void;
}

import { safeTimeAgo } from '../../lib/utils/formatDate';

// Notification type config
const NOTIF_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  follow_request:       { icon: UserPlus,       color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-100 dark:bg-blue-950/60',    label: 'Ø£Ø±Ø³Ù„ Ø·Ù„Ø¨ ØªÙˆØ§ØµÙ„' },
  sync_approval:        { icon: UserCheck,      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-950/60', label: 'Ù‚Ø¨Ù„ Ø·Ù„Ø¨ ØªÙˆØ§ØµÙ„Ùƒ âœ…' },
  role_change_approved: { icon: CheckCircle2,   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-950/60', label: 'ØªÙ…Øª Ø§Ù„Ù…ÙˆØ§ÙÙ‚Ø© Ø¹Ù„Ù‰ ØªØ±Ù‚ÙŠØ© Ù†ÙˆØ¹ Ø­Ø³Ø§Ø¨Ùƒ ðŸŽ‰' },
  role_change_rejected: { icon: ArrowLeftRight, color: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-100 dark:bg-rose-950/60',       label: 'ØªÙ… Ø±ÙØ¶ Ø·Ù„Ø¨ ØªØºÙŠÙŠØ± Ù†ÙˆØ¹ Ø§Ù„Ø­Ø³Ø§Ø¨ âŒ' },
  like:                 { icon: Heart,          color: 'text-rose-500 dark:text-rose-400',    bg: 'bg-rose-100 dark:bg-rose-950/60',    label: 'Ø£Ø¹Ø¬Ø¨ Ø¨Ù…Ù†Ø´ÙˆØ±Ùƒ' },
  comment:              { icon: MessageSquare,  color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-950/60',  label: 'Ø¹Ù„Ù‘Ù‚ Ø¹Ù„Ù‰ Ù…Ù†Ø´ÙˆØ±Ùƒ' },
  job_application:      { icon: Briefcase,      color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-950/60',   label: 'ØªÙ‚Ø¯Ù‘Ù… Ù„ÙˆØ¸ÙŠÙØªÙƒ' },
  message:              { icon: MessageSquare,  color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-950/60',  label: 'Ø£Ø±Ø³Ù„ Ù„Ùƒ Ø±Ø³Ø§Ù„Ø©' },
  missed_call:          { icon: Phone,          color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-100 dark:bg-red-950/60',     label: 'Ù…ÙƒØ§Ù„Ù…Ø© ÙØ§Ø¦ØªØ© ðŸ“ž' },
  role_change_request:  { icon: ArrowLeftRight, color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-950/60',   label: 'Ø·Ù„Ø¨ ØªØºÙŠÙŠØ± Ù†ÙˆØ¹ Ø§Ù„Ø­Ø³Ø§Ø¨' },
  default:              { icon: Bell,           color: 'text-slate-500 dark:text-slate-400',   bg: 'bg-slate-100 dark:bg-slate-800',   label: 'Ø¥Ø´Ø¹Ø§Ø± Ø¬Ø¯ÙŠØ¯' },
};

function timeAgo(dateStr: any) {
  return safeTimeAgo(dateStr);
}

interface ItemRowProps {
  notification: AppNotification;
  isRead: boolean;
  onAutoSeen: (n: AppNotification) => void;
  onManualClick: (n: AppNotification) => void;
  onToggleRead: (e: React.MouseEvent, n: AppNotification) => void;
  onAcceptSync: (n: AppNotification) => void;
  onDelete: (id: string) => void;
  addToast: (msg: string, type?: 'success' | 'error') => void;
  idx: number;
}

const NotificationItemRow: React.FC<ItemRowProps> = ({
  notification: n,
  isRead,
  onAutoSeen,
  onManualClick,
  onToggleRead,
  onAcceptSync,
  onDelete,
  addToast,
  idx
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const cfg = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.default;
  const Icon = cfg.icon;
  const [isSwipedOut, setIsSwipedOut] = useState(false);

  // ðŸ‘ï¸ Auto-Seen On View Detection: tracks notification when visible
  useEffect(() => {
    if (isRead) return;
    const el = rowRef.current;
    if (!el) return;

    let timer: NodeJS.Timeout | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          timer = setTimeout(() => {
            onAutoSeen(n);
          }, 300);
        } else {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);

    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [isRead, n.id, onAutoSeen]);

  const handleDragEnd = (_: any, info: any) => {
    if (Math.abs(info.offset.x) > 75) {
      setIsSwipedOut(true);
      setTimeout(() => {
        onDelete(n.id);
      }, 250);
    }
  };

  if (isSwipedOut) {
    return (
      <motion.div
        initial={{ height: 'auto', opacity: 1 }}
        animate={{ height: 0, opacity: 0, marginBottom: 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="overflow-hidden"
      />
    );
  }

  return (
    <div className="relative overflow-hidden bg-red-600 dark:bg-red-700">
      {/* Swipe Action Background Reveal */}
      <div className="absolute inset-0 flex items-center justify-between px-5 text-white font-black text-xs select-none">
        <div className="flex items-center gap-1.5"><Trash2 size={15} /> <span>Ø­Ø°Ù</span></div>
        <div className="flex items-center gap-1.5"><span>Ø­Ø°Ù</span> <Trash2 size={15} /></div>
      </div>

      <motion.div
        ref={rowRef}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.65}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        transition={{ duration: 0.2, delay: idx * 0.03 }}
        onClick={() => onManualClick(n)}
        className={`px-4 py-3 flex items-start gap-3 cursor-grab active:cursor-grabbing transition-colors group relative bg-white dark:bg-slate-900 ${
          isRead
            ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-75'
            : 'bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-50 dark:hover:bg-blue-950/60 font-medium'
        }`}
      >
        {!isRead && (
          <span className="absolute top-4 right-2 w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 ring-4 ring-blue-100 dark:ring-blue-900/50 animate-pulse" />
        )}

        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${cfg.bg} ${cfg.color} mt-0.5 pointer-events-none`}>
          <Icon size={16} />
        </div>

        <div className="flex-1 min-w-0 pr-1 select-none">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-xs font-black text-slate-900 dark:text-white truncate">
              {n.fromName || 'ProLink'}
            </span>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0">
              {timeAgo((n as any).created_at || new Date().toISOString())}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-3 leading-relaxed">
            {n.message || cfg.label}
          </p>

          {n.type === 'follow_request' && !isRead && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onAcceptSync(n); }}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-xl text-[11px] font-black hover:bg-emerald-700 transition-all shadow-sm active:scale-95"
              >
                <Check size={13} />
                <span>Ù‚Ø¨ÙˆÙ„ Ø§Ù„Ø·Ù„Ø¨</span>
              </button>
            </div>
          )}

          {n.type === 'role_change_request' && !isRead && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  let targetUserId = n.fromId;
                  let newRole: 'seeker' | 'employer' = 'employer';
                  try {
                    const parsed = typeof n.targetId === 'string' ? JSON.parse(n.targetId) : n.targetId;
                    if (parsed?.requestedRole) newRole = parsed.requestedRole;
                    if (parsed?.userId) targetUserId = parsed.userId;
                  } catch {
                    if (n.message?.includes('Ø¨Ø§Ø­Ø«')) newRole = 'seeker';
                  }
                  // âš¡ Ø­Ø°Ù Ø§Ù„Ø¥Ø´Ø¹Ø§Ø± ÙÙˆØ±Ø§Ù‹ ÙˆØ¨Ø´ÙƒÙ„ Ù„Ø­Ø¸ÙŠ (Optimistic UI)
                  onDelete(n.id);
                  addToast(`âœ… ØªÙ… Ù‚Ø¨ÙˆÙ„ ØªØ­ÙˆÙŠÙ„ Ø§Ù„Ø­Ø³Ø§Ø¨ Ø¥Ù„Ù‰ "${newRole === 'employer' ? 'ØµØ§Ø­Ø¨ Ø¹Ù…Ù„' : 'Ø¨Ø§Ø­Ø« Ø¹Ù† Ø¹Ù…Ù„'}" ÙÙˆØ±Ø§Ù‹!`, 'success');
                  try {
                    await profileService.approveRoleChangeRequest(n.id, targetUserId, newRole);
                  } catch (err: any) {
                    console.error("Failed to approve role request in background:", err);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700 transition-all shadow-sm active:scale-95"
              >
                <Check size={12} />
                <span>Ù‚Ø¨ÙˆÙ„ ÙˆØªØºÙŠÙŠØ± Ø§Ù„Ø¯ÙˆØ±</span>
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  let targetUserId = n.fromId;
                  try {
                    const parsed = typeof n.targetId === 'string' ? JSON.parse(n.targetId) : n.targetId;
                    if (parsed?.userId) targetUserId = parsed.userId;
                  } catch {}
                  // âš¡ Ø­Ø°Ù Ø§Ù„Ø¥Ø´Ø¹Ø§Ø± ÙÙˆØ±Ø§Ù‹ (Optimistic UI)
                  onDelete(n.id);
                  addToast('ØªÙ… Ø±ÙØ¶ Ø§Ù„Ø·Ù„Ø¨', 'error');
                  try {
                    await profileService.rejectRoleChangeRequest(n.id, targetUserId);
                  } catch (err: any) {
                    console.error("Failed to reject role request in background:", err);
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black hover:bg-red-500 hover:text-white transition-all active:scale-95"
              >
                <X size={12} />
                <span>Ø±ÙØ¶</span>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={(e) => onToggleRead(e, n)}
          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all shrink-0 mt-1"
          title={isRead ? 'Ù‚Ø±Ø§Ø¡Ø©' : 'ØªØ¹Ù„ÙŠÙ… ÙƒÙ…Ù‚Ø±ÙˆØ¡'}
        >
          {isRead ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </motion.div>
    </div>
  );
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  readNotifIds,
  setReadNotifIds,
  setNotifications,
  setShowNotifications,
  setActiveTab,
  handleAcceptSync,
  addToast
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('unread');
  const { markNotificationAsRead, deleteReadNotifications, deleteAllNotifications, readNotifTimestamps } = useAppContext();

  // ðŸ‘ï¸ Track unread notifications viewed in the current open session
  const seenThisSessionRef = useRef<Set<string>>(new Set());

  const handleAutoSeen = (n: AppNotification) => {
    if (!n.read && !readNotifIds.has(n.id)) {
      seenThisSessionRef.current.add(n.id);
    }
  };

  // ðŸšª When panel closes, convert all seen unread notifications to READ state
  const handleClosePanel = async () => {
    const seenIds = Array.from(seenThisSessionRef.current);
    if (seenIds.length > 0) {
      const nowTime = Date.now();
      setNotifications(prev => prev.map(n => seenIds.includes(n.id) ? { ...n, read: true } : n));
      setReadNotifIds(prev => {
        const next = new Set(prev);
        seenIds.forEach(id => next.add(id));
        return next;
      });
      try {
        await supabase.from('notifications').update({ read: true }).in('id', seenIds);
      } catch (err) {
        console.warn('Deferred read sync error:', err);
      }
    }
    setShowNotifications(false);
  };

  const unreadCount = notifications.filter(n => !n.read && !readNotifIds.has(n.id)).length;
  const readCount = notifications.length - unreadCount;

  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  const filteredNotifs = notifications.filter(n => {
    const readAt = readNotifTimestamps?.[n.id];
    if (readAt && (now - readAt) > oneHour) return false;

    const isRead = n.read || readNotifIds.has(n.id);
    if (filter === 'unread') return !isRead;
    if (filter === 'read') return isRead;
    return true;
  });

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read || !readNotifIds.has(n.id)).map(n => n.id);
    if (!unread.length) return;
    const nowTime = Date.now();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setReadNotifIds(prev => { const next = new Set(prev); unread.forEach(id => next.add(id)); return next; });
    try {
      await supabase.from('notifications').update({ read: true }).in('id', unread);
    } catch (e) {
      console.warn('Sync read status error:', e);
    }
    addToast('ØªÙ… ØªÙ…ÙŠÙŠØ² Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª ÙƒÙ…Ù‚Ø±ÙˆØ¡Ø© âœ…');
  };

  const handleDeleteRead = async () => {
    if (window.confirm('Ù‡Ù„ ØªØ±ÙŠØ¯ Ø­Ø°Ù Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ù…Ù‚Ø±ÙˆØ¡Ø©ØŸ')) {
      await deleteReadNotifications();
      addToast('ØªÙ… Ø­Ø°Ù Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ù…Ù‚Ø±ÙˆØ¡Ø© Ø¨Ù†Ø¬Ø§Ø­ ðŸ—‘ï¸');
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm('Ù‡Ù„ Ø£Ù†Øª Ù…ØªØ£ÙƒØ¯ Ù…Ù† Ø­Ø°Ù Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§ØªØŸ')) {
      await deleteAllNotifications();
      addToast('ØªÙ… Ø­Ø°Ù ÙƒØ§ÙØ© Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª ðŸ’£');
    }
  };

  const handleDeleteSingle = async (notifId: string) => {
    setNotifications(prev => prev.filter(item => item.id !== notifId));
    setReadNotifIds(prev => {
      const next = new Set(prev);
      next.delete(notifId);
      return next;
    });
    try {
      await supabase.from('notifications').delete().eq('id', notifId);
    } catch (err) {
      console.warn('Delete notification failed:', err);
    }
  };

  const toggleReadStatus = async (e: React.MouseEvent, n: AppNotification) => {
    e.stopPropagation();
    const currentlyRead = n.read || readNotifIds.has(n.id);
    const targetState = !currentlyRead;

    setReadNotifIds(prev => {
      const next = new Set(prev);
      if (targetState) next.add(n.id);
      else next.delete(n.id);
      return next;
    });

    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: targetState } : item));

    try {
      await supabase.from('notifications').update({ read: targetState }).eq('id', n.id);
    } catch (err) {
      console.warn('Update read status failed:', err);
    }
  };

  const handleManualClick = async (n: AppNotification) => {
    await markNotificationAsRead(n.id);
    if (n.type === 'follow_request') { setActiveTab('network'); handleClosePanel(); }
    if (n.type === 'message') { setActiveTab('messages'); handleClosePanel(); }
    if (n.type === 'job_application') { setActiveTab('jobs'); handleClosePanel(); }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[55]" onClick={handleClosePanel} />
      
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="absolute top-[68px] right-4 z-[60] w-96 max-w-[calc(100vw-2rem)]"
        dir="rtl"
      >
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden ring-1 ring-black/5">
          
          {/* Header */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-slate-800 dark:text-white text-base">Ù…Ø±ÙƒØ² Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª</h4>
                {unreadCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-black shadow-sm shadow-rose-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                {unreadCount === 0 ? 'Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª ØªÙ…Øª Ù…Ø´Ø§Ù‡Ø¯ØªÙ‡Ø§ âœ“' : `Ù„Ø¯ÙŠÙƒ ${unreadCount} Ø¥Ø´Ø¹Ø§Ø± Ø¬Ø¯ÙŠØ¯`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-xl text-[10px] font-black hover:bg-blue-100 dark:hover:bg-blue-800/60 transition-all active:scale-95 border border-blue-200/40 dark:border-blue-700/30"
                  title="ØªÙ…ÙŠÙŠØ² Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª ÙƒÙ…Ù‚Ø±ÙˆØ¡Ø©"
                >
                  <CheckCheck size={13} />
                  <span>Ø§Ù„ÙƒÙ„ Ù…Ù‚Ø±ÙˆØ¡</span>
                </button>
              )}

              {readCount > 0 && (
                <button
                  onClick={handleDeleteRead}
                  className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-black hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all active:scale-95 border border-rose-200/40 dark:border-rose-800/40"
                  title="Ø­Ø°Ù Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ù…Ù‚Ø±ÙˆØ¡Ø©"
                >
                  <Trash2 size={14} />
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                  title="Ø­Ø°Ù Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª"
                >
                  <Flame size={14} />
                </button>
              )}

              <button onClick={handleClosePanel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800">
            {[
              { id: 'unread', label: 'ØºÙŠØ± Ù…Ù‚Ø±ÙˆØ¡Ø©', count: unreadCount, highlight: unreadCount > 0 },
              { id: 'read', label: 'Ø§Ù„Ù…Ù‚Ø±ÙˆØ¡Ø©', count: readCount },
              { id: 'all', label: 'Ø§Ù„ÙƒÙ„', count: notifications.length }
            ].map(f => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800/80'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-md ${
                    active 
                      ? 'bg-white/20 text-white' 
                      : f.highlight
                        ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400 font-black'
                        : 'bg-slate-200/60 dark:bg-slate-800 text-slate-400'
                  }`}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Notifications List with Seen-On-View Tracking */}
          <div className="max-h-[420px] overflow-y-auto custom-chat-scroll divide-y divide-slate-100/80 dark:divide-slate-800/60">
            {filteredNotifs.length === 0 ? (
              <div className="py-14 text-center px-4">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800/80 rounded-3xl flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500 shadow-inner">
                  <Bell size={24} />
                </div>
                <h5 className="text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  {filter === 'unread' ? 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø¬Ø¯ÙŠØ¯Ø© ØºÙŠØ± Ù…Ù‚Ø±ÙˆØ¡Ø©' : filter === 'read' ? 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ù…Ù‚Ø±ÙˆØ¡Ø©' : 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø£ÙŠ Ø¥Ø´Ø¹Ø§Ø±Ø§Øª'}
                </h5>
                <p className="text-slate-400 text-[11px] font-medium max-w-[240px] mx-auto">
                  {filter === 'unread' ? 'Ù„Ù‚Ø¯ Ø´Ø§Ù‡Ø¯Øª Ø¬Ù…ÙŠØ¹ Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø¨Ù†Ø¬Ø§Ø­!' : 'Ø³ØªØ¸Ù‡Ø± Ù‡Ù†Ø§ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª ÙˆØ§Ù„ØªÙØ§Ø¹Ù„Ø§Øª ÙÙˆØ± ÙˆØµÙˆÙ„Ù‡Ø§.'}
                </p>
                {filter === 'unread' && readCount > 0 && (
                  <button
                    onClick={() => setFilter('read')}
                    className="mt-3 px-3.5 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-xl text-[11px] font-black hover:bg-blue-100 transition-all inline-flex items-center gap-1.5"
                  >
                    <Eye size={12} />
                    <span>Ø¹Ø±Ø¶ Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø§Ù„Ø³Ø§Ø¨Ù‚Ø© ({readCount})</span>
                  </button>
                )}
              </div>
            ) : (
              <AnimatePresence>
                {filteredNotifs.map((n, idx) => {
                  const isRead = n.read || readNotifIds.has(n.id);
                  return (
                    <NotificationItemRow
                      key={n.id}
                      notification={n}
                      isRead={isRead}
                      onAutoSeen={handleAutoSeen}
                      onManualClick={handleManualClick}
                      onToggleRead={toggleReadStatus}
                      onAcceptSync={handleAcceptSync}
                      onDelete={handleDeleteSingle}
                      addToast={addToast}
                      idx={idx}
                    />
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          {/* Footer stats bar */}
          <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400">
            <span>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª: {notifications.length}</span>
            <span>Ø§Ù„Ù…Ù‚Ø±ÙˆØ¡Ø©: {readCount} â€¢ ØºÙŠØ± Ø§Ù„Ù…Ù‚Ø±ÙˆØ¡Ø©: {unreadCount}</span>
          </div>
        </div>
      </motion.div>
    </>
  );
};
