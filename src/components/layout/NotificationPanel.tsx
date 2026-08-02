import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, X, CheckCheck, Briefcase, Heart, MessageSquare, 
  UserPlus, Check, UserCheck, ChevronRight, Clock, Phone
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AppNotification } from '../../types';

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

// Notification type config
const NOTIF_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  follow_request:  { icon: UserPlus,      color: 'text-blue-600',   bg: 'bg-blue-100',    label: 'أرسل طلب تواصل' },
  sync_approval:   { icon: UserCheck,     color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'قبل طلب تواصلك ✅' },
  like:            { icon: Heart,         color: 'text-rose-500',   bg: 'bg-rose-100',    label: 'أعجب بمنشورك' },
  comment:         { icon: MessageSquare, color: 'text-violet-600', bg: 'bg-violet-100',  label: 'علّق على منشورك' },
  job_application: { icon: Briefcase,     color: 'text-amber-600',  bg: 'bg-amber-100',   label: 'تقدّم لوظيفتك' },
  message:         { icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-100',  label: 'أرسل لك رسالة' },
  missed_call:     { icon: Phone,         color: 'text-red-600',    bg: 'bg-red-100',     label: 'مكالمة فائتة 📞' },
  default:         { icon: Bell,          color: 'text-slate-500',  bg: 'bg-slate-100',   label: 'إشعار جديد' },
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return 'الآن';
  if (diff < 3600)  return `${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ساعة`;
  return `${Math.floor(diff / 86400)} يوم`;
}

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
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  const unreadCount = notifications.filter(n => !n.read && !readNotifIds.has(n.id)).length;

  const filteredNotifs = notifications.filter(n => {
    if (filter === 'unread') return !n.read && !readNotifIds.has(n.id);
    return true;
  });

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read).map(n => n.id);
    if (!unread.length) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setReadNotifIds(prev => { const next = new Set(prev); unread.forEach(id => next.add(id)); return next; });
    await supabase.from('notifications').update({ read: true }).in('id', unread);
    addToast('تم تمييز الكل كمقروء ✅');
  };

  const markRead = async (n: AppNotification) => {
    const isRead = n.read || readNotifIds.has(n.id);
    if (isRead) return;
    setReadNotifIds(prev => { const next = new Set(prev); next.add(n.id); return next; });
    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
    await supabase.from('notifications').update({ read: true }).eq('id', n.id);
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[55]" onClick={() => setShowNotifications(false)} />
      
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="absolute top-[68px] right-4 z-[60] w-96 max-w-[calc(100vw-2rem)]"
        dir="rtl"
      >
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          
          {/* Header */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
            <div>
              <h4 className="font-black text-slate-800 dark:text-white text-base">الإشعارات</h4>
              {unreadCount > 0 && (
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{unreadCount} غير مقروء</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black hover:bg-blue-100 transition-all"
                >
                  <CheckCheck size={12} /> تمييز الكل
                </button>
              )}
              <button onClick={() => setShowNotifications(false)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 px-4 py-3 border-b border-slate-50 dark:border-slate-800">
            {[
              { id: 'unread', label: `الجديدة (${unreadCount})` },
              { id: 'all', label: `الكل (${notifications.length})` },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                  filter === f.id 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none' 
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="max-h-[420px] overflow-y-auto custom-chat-scroll">
            {filteredNotifs.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Bell size={28} className="text-slate-200 dark:text-slate-600" />
                </div>
                <p className="text-slate-400 text-xs font-bold">
                  {filter === 'unread' ? 'لا توجد إشعارات جديدة' : 'لا توجد إشعارات'}
                </p>
              </div>
            ) : (
              <AnimatePresence>
                {filteredNotifs.map((n, idx) => {
                  const isRead = n.read || readNotifIds.has(n.id);
                  const cfg = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.default;
                  const Icon = cfg.icon;

                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={async () => {
                        await markRead(n);
                        if (n.type === 'follow_request') { setActiveTab('network'); setShowNotifications(false); }
                        if (n.type === 'message') { setActiveTab('messages'); setShowNotifications(false); }
                        if (n.type === 'job_application') { setActiveTab('jobs'); setShowNotifications(false); }
                      }}
                      className={`px-4 py-4 flex items-start gap-3 cursor-pointer transition-all border-b border-slate-50 dark:border-slate-800/50 last:border-0 ${
                        isRead 
                          ? 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50' 
                          : 'bg-blue-50/40 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      }`}
                    >
                      {/* Avatar with type badge */}
                      <div className="relative shrink-0">
                        <img
                          src={n.fromAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.fromName || 'U')}&background=0a66c2&color=fff`}
                          className="w-11 h-11 rounded-2xl object-cover border-2 border-white dark:border-slate-700 shadow-sm"
                          referrerPolicy="no-referrer"
                          alt=""
                        />
                        <div className={`absolute -bottom-1 -left-1 w-6 h-6 ${cfg.bg} rounded-full flex items-center justify-center shadow-sm border-2 border-white dark:border-slate-900`}>
                          <Icon size={11} className={cfg.color} />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 dark:text-slate-200 leading-snug">
                          <span className="font-black text-slate-900 dark:text-white">{n.fromName}</span>
                          {' '}<span className="font-medium">{cfg.label}</span>
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock size={9} className="text-slate-300" />
                          <span className="text-[9px] text-slate-400 font-bold">{timeAgo((n as any).created_at || new Date().toISOString())}</span>
                        </div>

                        {/* Accept/Reject actions for sync requests */}
                        {n.type === 'follow_request' && !isRead && (
                          <div className="flex gap-2 mt-2.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAcceptSync(n); markRead(n); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black hover:bg-blue-700 transition-all shadow-md shadow-blue-200 dark:shadow-none"
                            >
                              <Check size={11} /> قبول
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); markRead(n); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-black hover:bg-slate-200 transition-all"
                            >
                              <X size={11} /> رفض
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Unread indicator + arrow */}
                      <div className="flex flex-col items-center gap-2 shrink-0 pt-0.5">
                        {!isRead && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                        <ChevronRight size={14} className="text-slate-200 dark:text-slate-700" />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};
