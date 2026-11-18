import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, X, CheckCheck, Briefcase, Heart, MessageSquare, 
  UserPlus, Check, UserCheck, Clock, Phone,
  Eye, EyeOff, Trash2, Flame, ArrowLeftRight, CheckCircle2,
  ExternalLink, Sparkles, User, ShieldAlert, Send
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AppNotification, AppUser } from '../../types';
import { useAppContext } from '../../contexts/AppContext';
import { profileService } from '../../lib/services/profileService';
import { safeTimeAgo } from '../../lib/utils/formatDate';

interface NotificationPanelProps {
  notifications: AppNotification[];
  readNotifIds: Set<string>;
  setReadNotifIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  setShowNotifications: (show: boolean) => void;
  setActiveTab: (tab: string) => void;
  handleAcceptSync: (notif: AppNotification) => Promise<void>;
  addToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

// ── Notification Type Visual Configuration ──────────────────────────────────
const NOTIF_CONFIG: Record<string, { icon: any; color: string; bg: string; badgeCls: string; label: string }> = {
  follow_request: { 
    icon: UserPlus, 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-50 dark:bg-blue-950/60', 
    badgeCls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    label: 'طلب تواصل مهني' 
  },
  sync_approval: { 
    icon: UserCheck, 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-50 dark:bg-emerald-950/60', 
    badgeCls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    label: 'تم قبول التواصل' 
  },
  role_change_approved: { 
    icon: CheckCircle2, 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-50 dark:bg-emerald-950/60', 
    badgeCls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    label: 'ترقية الحساب' 
  },
  role_change_rejected: { 
    icon: ArrowLeftRight, 
    color: 'text-rose-600 dark:text-rose-400', 
    bg: 'bg-rose-50 dark:bg-rose-950/60', 
    badgeCls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    label: 'إشعار إداري' 
  },
  like: { 
    icon: Heart, 
    color: 'text-rose-500 dark:text-rose-400', 
    bg: 'bg-rose-50 dark:bg-rose-950/60', 
    badgeCls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    label: 'إعجاب بمنشور' 
  },
  comment: { 
    icon: MessageSquare, 
    color: 'text-violet-600 dark:text-violet-400', 
    bg: 'bg-violet-50 dark:bg-violet-950/60', 
    badgeCls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    label: 'تعليق جديد' 
  },
  job_application: { 
    icon: Briefcase, 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-50 dark:bg-amber-950/60', 
    badgeCls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    label: 'تقديم وظيفي' 
  },
  message: { 
    icon: MessageSquare, 
    color: 'text-indigo-600 dark:text-indigo-400', 
    bg: 'bg-indigo-50 dark:bg-indigo-950/60', 
    badgeCls: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    label: 'رسالة خاصة' 
  },
  missed_call: { 
    icon: Phone, 
    color: 'text-rose-600 dark:text-rose-400', 
    bg: 'bg-rose-50 dark:bg-rose-950/60', 
    badgeCls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    label: 'مكالمة فائتة' 
  },
  role_change_request: { 
    icon: ArrowLeftRight, 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-50 dark:bg-amber-950/60', 
    badgeCls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    label: 'طلب إدارة' 
  },
  group_request: { 
    icon: UserPlus, 
    color: 'text-teal-600 dark:text-teal-400', 
    bg: 'bg-teal-50 dark:bg-teal-950/60', 
    badgeCls: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    label: 'طلب انضمام' 
  },
  group_join: { 
    icon: UserCheck, 
    color: 'text-teal-600 dark:text-teal-400', 
    bg: 'bg-teal-50 dark:bg-teal-950/60', 
    badgeCls: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    label: 'عضو جديد' 
  },
  default: { 
    icon: Bell, 
    color: 'text-blue-500 dark:text-blue-400', 
    bg: 'bg-blue-50 dark:bg-slate-800', 
    badgeCls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    label: 'تنبيه مهني' 
  },
};

interface ItemRowProps {
  notification: AppNotification;
  isRead: boolean;
  sender: AppUser | null;
  onAutoSeen: (n: AppNotification) => void;
  onManualClick: (n: AppNotification) => void;
  onToggleRead: (e: React.MouseEvent, n: AppNotification) => void;
  onAcceptSync: (n: AppNotification) => void;
  onDelete: (id: string) => void;
  onOpenProfile?: (user: AppUser) => void;
  onSendMessage?: (user: AppUser) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  idx: number;
}

// ── Smart Notification Formatter (يحلل الإشعار ويصنع نصوصاً واضحة واحترافية) ────
function getNotificationDisplay(n: AppNotification, sender: AppUser | null) {
  const isRole = n.type?.startsWith('role_');
  const senderName = sender?.name && sender.name !== 'مستخدم' && sender.name !== 'مستخدم محادثة'
    ? sender.name
    : (n.fromName && n.fromName !== 'مستخدم' && n.fromName !== 'ProLink' 
        ? n.fromName 
        : (isRole ? 'إدارة ProLink' : (sender?.name || 'مستخدم في ProLink')));

  const senderAvatar = sender?.avatar || n.fromAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0284c7&color=fff`;
  const senderTitle = sender?.title || sender?.displayTitle || (sender as any)?.job_title || '';

  let headline = '';
  let bodyText = '';

  switch (n.type) {
    case 'follow_request':
      headline = 'طلب تواصل مهني ومزامنة 🤝';
      bodyText = `يرغب ${senderName}${senderTitle ? ` (${senderTitle})` : ''} بالانضمام إلى شبكتك المهنية وتبادل الفرص.`;
      break;

    case 'sync_approval':
      headline = 'تم قبول طلب التواصل بنجاح ✅';
      bodyText = `وافق ${senderName} على طلب التواصل. أصبح بإمكانك الآن مراسلته ومتابعة نشاطه.`;
      break;

    case 'job_application':
      headline = 'تقديم جديد على وظيفة معلنة 💼';
      bodyText = n.message && n.message !== 'خبر' && n.message !== 'إشعار جديد'
        ? n.message
        : `قدّم ${senderName} سيرة ذاتية وطلباً جديداً على الوظيفة المعلنة.`;
      break;

    case 'like':
      headline = 'أبدى إعجابه بمنشورك المهني ❤️';
      bodyText = n.message && n.message !== 'خبر'
        ? n.message
        : `أبدى ${senderName} إعجابه بالمنشور الذي شاركته مؤخراً.`;
      break;

    case 'comment':
      headline = 'تعليق جديد على منشورك 💬';
      bodyText = n.message && n.message !== 'خبر'
        ? n.message
        : `علّق ${senderName} على منشورك المهني. تفقد التفاعل الآن.`;
      break;

    case 'message':
      headline = 'رسالة خاصة جديدة ✉️';
      bodyText = n.message && n.message !== 'خبر'
        ? n.message
        : `أرسل لك ${senderName} رسالة جديدة في صندوق المحادثات.`;
      break;

    case 'missed_call':
      headline = 'مكالمة صوتية/مرئية فائتة 📞';
      bodyText = `حاول ${senderName} الاتصال بك ولم تتمكن من الرد.`;
      break;

    case 'role_change_approved':
      headline = 'تهانينا! تمت ترقية نوع حسابك 🎉';
      bodyText = n.message || 'وافقت إدارة المنصة على طلبك، حسابك الآن مفعل بالكامل بصلاحياته الجديدة.';
      break;

    case 'role_change_rejected':
      headline = 'تحديث بخصوص طلب تعديل الحساب ℹ️';
      bodyText = n.message || 'نعتذر، لم تتم الموافقة على طلب تعديل الحساب في الوقت الحالي.';
      break;

    case 'role_change_request':
      headline = 'طلب ترقية نوع الحساب (للإدارة) 🛡️';
      bodyText = n.message || `طلب المستخدم ${senderName} مراجعة تغيير صفة حسابه.`;
      break;

    case 'group_request':
      headline = 'طلب انضمام للمجموعة المهنية 👥';
      bodyText = n.message || `طلب ${senderName} الانضمام إلى مجموعتك المهنية.`;
      break;

    case 'group_join':
      headline = 'انضمام عضو جديد للمجموعة 👥';
      bodyText = n.message || `انضم ${senderName} إلى مجموعتك المهنية بنجاح.`;
      break;

    default:
      headline = 'تنبيه مهني جديد 🔔';
      bodyText = (n.message && n.message !== 'خبر' && n.message !== 'إشعار جديد') 
        ? n.message 
        : 'لديك نشاط مهني جديد بانتظار مراجعتك في منصة ProLink.';
      break;
  }

  return { senderName, senderAvatar, senderTitle, headline, bodyText };
}

const NotificationItemRow: React.FC<ItemRowProps> = ({
  notification: n,
  isRead,
  sender,
  onAutoSeen,
  onManualClick,
  onToggleRead,
  onAcceptSync,
  onDelete,
  onOpenProfile,
  onSendMessage,
  addToast,
  idx
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const cfg = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.default;
  const Icon = cfg.icon;
  const [isSwipedOut, setIsSwipedOut] = useState(false);

  const { senderName, senderAvatar, senderTitle, headline, bodyText } = useMemo(
    () => getNotificationDisplay(n, sender),
    [n, sender]
  );

  // 👁️ Auto-Seen On View Detection: tracks notification when visible
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
          }, 350);
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
    <div className="relative overflow-hidden bg-rose-600 dark:bg-rose-700">
      {/* Swipe Action Background Reveal */}
      <div className="absolute inset-0 flex items-center justify-between px-5 text-white font-black text-xs select-none">
        <div className="flex items-center gap-1.5"><Trash2 size={15} /> <span>حذف</span></div>
        <div className="flex items-center gap-1.5"><span>حذف</span> <Trash2 size={15} /></div>
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
        transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.2) }}
        onClick={() => onManualClick(n)}
        className={`px-4 py-3.5 flex items-start gap-3 cursor-pointer transition-all group relative border-b border-slate-100/80 dark:border-slate-800/60 ${
          isRead
            ? 'bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-80'
            : 'bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-50/80 dark:hover:bg-blue-950/50 font-medium'
        }`}
      >
        {/* Unread Glow Dot */}
        {!isRead && (
          <span className="absolute top-4 right-2 w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 ring-4 ring-blue-100 dark:ring-blue-900/50 animate-pulse" />
        )}

        {/* Sender Avatar with Floating Action Badge */}
        <div className="relative shrink-0 mt-0.5" onClick={(e) => {
          if (sender && onOpenProfile) {
            e.stopPropagation();
            onOpenProfile(sender);
          }
        }}>
          <img 
            src={senderAvatar} 
            alt={senderName} 
            className="w-11 h-11 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0284c7&color=fff`;
            }}
          />
          <div className={`absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900 ${cfg.bg} ${cfg.color}`}>
            <Icon size={11} strokeWidth={2.5} />
          </div>
        </div>

        {/* Main Notification Content */}
        <div className="flex-1 min-w-0 pr-1 select-none space-y-1">
          {/* Header Row: Sender Name + Category Badge + Time */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                {senderName}
              </span>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${cfg.badgeCls}`}>
                {cfg.label}
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0 flex items-center gap-0.5">
              <Clock size={10} />
              {safeTimeAgo((n as any).created_at || (n as any).timestamp)}
            </span>
          </div>

          {/* Action Headline */}
          <h5 className="text-[11px] font-black text-slate-800 dark:text-slate-200 leading-tight">
            {headline}
          </h5>

          {/* Body Text / Preview */}
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed line-clamp-2">
            {bodyText}
          </p>

          {/* ⚡ Quick Actions (أزرار تفاعلية مباشرة داخل كارد الإشعار) */}
          {n.type === 'follow_request' && !isRead && (
            <div className="mt-2.5 flex items-center gap-2 pt-1">
              <button
                onClick={(e) => { e.stopPropagation(); onAcceptSync(n); }}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Check size={13} />
                <span>قبول التواصل</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
              >
                <span>تجاهل</span>
              </button>
            </div>
          )}

          {n.type === 'sync_approval' && sender && onSendMessage && (
            <div className="mt-2 flex items-center gap-2 pt-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); onSendMessage(sender); }}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <MessageSquare size={12} />
                <span>إرسال رسالة 💬</span>
              </button>
            </div>
          )}

          {n.type === 'role_change_request' && !isRead && (
            <div className="mt-2.5 flex items-center gap-2 pt-1">
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
                    if (n.message?.includes('باحث')) newRole = 'seeker';
                  }
                  onDelete(n.id);
                  addToast(`✅ تم قبول تحويل الحساب إلى "${newRole === 'employer' ? 'صاحب عمل' : 'باحث عن عمل'}" فوراً!`, 'success');
                  try {
                    await profileService.approveRoleChangeRequest(n.id, targetUserId, newRole);
                  } catch (err) { console.error(err); }
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Check size={12} />
                <span>قبول وتغيير الدور</span>
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  let targetUserId = n.fromId;
                  try {
                    const parsed = typeof n.targetId === 'string' ? JSON.parse(n.targetId) : n.targetId;
                    if (parsed?.userId) targetUserId = parsed.userId;
                  } catch {}
                  onDelete(n.id);
                  addToast('تم رفض الطلب', 'error');
                  try {
                    await profileService.rejectRoleChangeRequest(n.id, targetUserId);
                  } catch (err) { console.error(err); }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black hover:bg-rose-500 hover:text-white transition-all active:scale-95 cursor-pointer"
              >
                <X size={12} />
                <span>رفض</span>
              </button>
            </div>
          )}
        </div>

        {/* Read / Unread Toggle Button */}
        <button
          onClick={(e) => onToggleRead(e, n)}
          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all shrink-0 mt-0.5 cursor-pointer"
          title={isRead ? 'تعليم كغير مقروء' : 'تعليم كمقروء'}
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
  const [filter, setFilter] = useState<'all' | 'unread' | 'connections' | 'jobs_social'>('all');
  const { markNotificationAsRead, deleteReadNotifications, deleteAllNotifications, allUsers = [], setSelectedProfile, setSelectedChat } = useAppContext();

  // 👁️ Track unread notifications viewed in the current open session
  const seenThisSessionRef = useRef<Set<string>>(new Set());

  const handleAutoSeen = (n: AppNotification) => {
    if (!n.read && !readNotifIds.has(n.id)) {
      seenThisSessionRef.current.add(n.id);
    }
  };

  // 🚪 When panel closes, convert all seen unread notifications to READ state
  const handleClosePanel = async () => {
    const seenIds = Array.from(seenThisSessionRef.current);
    if (seenIds.length > 0) {
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

  // Filter logic across categories — ترتيب الإشعارات يبقى كما جاء من قاعدة البيانات (أحدث أولاً)
  const filteredNotifs = useMemo(() => {
    return notifications.filter(n => {
      const isRead = n.read || readNotifIds.has(n.id);
      if (filter === 'unread') return !isRead;
      if (filter === 'connections') return n.type === 'follow_request' || n.type === 'sync_approval';
      if (filter === 'jobs_social') return n.type === 'job_application' || n.type === 'like' || n.type === 'comment' || n.type === 'message';
      return true;
    });
  }, [notifications, readNotifIds, filter]);

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read || !readNotifIds.has(n.id)).map(n => n.id);
    if (!unread.length) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setReadNotifIds(prev => { const next = new Set(prev); unread.forEach(id => next.add(id)); return next; });
    try {
      await supabase.from('notifications').update({ read: true }).in('id', unread);
    } catch (e) {
      console.warn('Sync read status error:', e);
    }
    addToast('تم تمييز جميع الإشعارات كمقروءة ✅');
  };

  const handleDeleteRead = async () => {
    if (window.confirm('هل تريد حذف جميع الإشعارات المقروءة؟')) {
      await deleteReadNotifications();
      addToast('تم حذف الإشعارات المقروءة بنجاح 🗑️');
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm('هل أنت متأكد من حذف جميع الإشعارات؟')) {
      await deleteAllNotifications();
      addToast('تم حذف كافة الإشعارات 🗑️');
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
    const sender = allUsers.find(u => u.id === (n.fromId || (n as any).from_id));

    if (n.type === 'follow_request') { 
      setActiveTab('network'); 
      handleClosePanel(); 
    } else if (n.type === 'sync_approval' && sender) {
      setSelectedProfile(sender);
      setActiveTab('profile');
      handleClosePanel();
    } else if (n.type === 'message') { 
      if (sender && setSelectedChat) setSelectedChat(sender);
      setActiveTab('messages'); 
      handleClosePanel(); 
    } else if (n.type === 'job_application') { 
      setActiveTab('jobs'); 
      handleClosePanel(); 
    } else if (n.type === 'like' || n.type === 'comment') {
      setActiveTab('home');
      handleClosePanel();
    } else {
      handleClosePanel();
    }
  };

  const handleOpenSenderProfile = (user: AppUser) => {
    setSelectedProfile(user);
    setActiveTab('profile');
    handleClosePanel();
  };

  const handleSendMessageToSender = (user: AppUser) => {
    if (setSelectedChat) setSelectedChat(user);
    setActiveTab('messages');
    handleClosePanel();
  };

  const panelContent = (
    <div className="fixed inset-0 z-[9999] pointer-events-none" dir="rtl">
      {/* Background Overlay - ثابت دائماً في الشاشة أينما كان السكرول */}
      <div 
        className="fixed inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-xs pointer-events-auto transition-opacity" 
        onClick={handleClosePanel} 
      />
      
      {/* نافذة الإشعارات العائمة - مثبتة في أعلى مجال الرؤية الحالي بغض النظر عن صعود أو نزول السكرول */}
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        className="fixed top-16 sm:top-[70px] left-3 sm:left-auto right-3 sm:right-6 md:right-10 z-[10000] w-auto sm:w-[420px] max-w-[calc(100vw-1.5rem)] pointer-events-auto shadow-2xl"
      >
        <div className="bg-white/98 dark:bg-slate-900/98 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden ring-1 ring-black/10 max-h-[calc(100dvh-5.5rem)] flex flex-col">
          
          {/* Header */}
          <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
                  <Bell size={16} />
                </div>
                <h4 className="font-black text-slate-800 dark:text-white text-base">مركز التنبيهات</h4>
                {unreadCount > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-black shadow-sm shadow-rose-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5 mr-10">
                {unreadCount === 0 ? 'جميع التنبيهات تمت مشاهدتها ✓' : `لديك ${unreadCount} إشعار جديد بحاجة لمتابعتك`}
              </p>
            </div>
            
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-xl text-[10px] font-black hover:bg-blue-100 dark:hover:bg-blue-800/60 transition-all active:scale-95 border border-blue-200/40 dark:border-blue-700/30 cursor-pointer"
                  title="تمييز جميع الإشعارات كمقروءة"
                >
                  <CheckCheck size={13} />
                  <span>قراءة الكل</span>
                </button>
              )}

              {readCount > 0 && (
                <button
                  onClick={handleDeleteRead}
                  className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-black hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all active:scale-95 border border-rose-200/40 dark:border-rose-800/40 cursor-pointer"
                  title="حذف الإشعارات المقروءة"
                >
                  <Trash2 size={14} />
                </button>
              )}

              <button 
                onClick={handleClosePanel} 
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Quick Filter Tabs (مخطط تبويبات احترافي كما في التطبيقات الكبرى) */}
          <div className="flex items-center gap-1 px-3 py-2 bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'الكل', count: notifications.length },
              { id: 'unread', label: 'غير مقروءة', count: unreadCount, highlight: unreadCount > 0 },
              { id: 'connections', label: 'التواصل 🤝' },
              { id: 'jobs_social', label: 'الوظائف 💼' }
            ].map(f => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{f.label}</span>
                  {typeof f.count === 'number' && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-md ${
                      active 
                        ? 'bg-white/20 text-white' 
                        : f.highlight
                          ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400 font-black'
                          : 'bg-slate-200/60 dark:bg-slate-800 text-slate-400'
                    }`}>
                      {f.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notifications List with Seen-On-View Tracking */}
          <div className="max-h-[min(480px,calc(100dvh-13.5rem))] overflow-y-auto custom-chat-scroll divide-y divide-slate-100/80 dark:divide-slate-800/60 flex-1">
            {filteredNotifs.length === 0 ? (
              <div className="py-16 text-center px-4 space-y-3">
                <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto text-blue-500 dark:text-blue-400 shadow-sm">
                  <Bell size={28} />
                </div>
                <div>
                  <h5 className="text-sm font-black text-slate-800 dark:text-slate-200">
                    {filter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'صندوق التنبيهات فارغ حالياً'}
                  </h5>
                  <p className="text-slate-400 text-xs font-medium max-w-[260px] mx-auto mt-1 leading-relaxed">
                    {filter === 'unread' 
                      ? 'لقد اطّلعت على كامل الأنشطة والتنبيهات بنجاح!' 
                      : 'ستظهر هنا طلبات التواصل، وتفاعلات منشوراتك، وتحديثات الوظائف فور وصولها.'}
                  </p>
                </div>
                {filter === 'unread' && readCount > 0 && (
                  <button
                    onClick={() => setFilter('all')}
                    className="px-4 py-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-xl text-xs font-black hover:bg-blue-100 transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Eye size={13} />
                    <span>عرض التنبيهات السابقة ({readCount})</span>
                  </button>
                )}
              </div>
            ) : (
              <AnimatePresence>
                {filteredNotifs.map((n, idx) => {
                  const isRead = n.read || readNotifIds.has(n.id);
                  const sender = allUsers.find(u => u.id === (n.fromId || (n as any).from_id)) || null;

                  return (
                    <NotificationItemRow
                      key={n.id}
                      notification={n}
                      isRead={isRead}
                      sender={sender}
                      onAutoSeen={handleAutoSeen}
                      onManualClick={handleManualClick}
                      onToggleRead={toggleReadStatus}
                      onAcceptSync={handleAcceptSync}
                      onDelete={handleDeleteSingle}
                      onOpenProfile={handleOpenSenderProfile}
                      onSendMessage={handleSendMessageToSender}
                      addToast={addToast}
                      idx={idx}
                    />
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          {/* Footer stats bar */}
          <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400 shrink-0">
            <span>إجمالي التنبيهات: {notifications.length}</span>
            <span>المقروءة: {readCount} • الجديدة: {unreadCount}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(panelContent, document.body) : panelContent;
};
