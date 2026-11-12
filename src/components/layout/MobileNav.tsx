import React, { useState, useEffect, useMemo, useRef, startTransition } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import {
  Home, Briefcase, Globe, MessageSquare, MoreHorizontal,
  Users, Info, LogOut, Shield, Phone, Building2, Moon, Sun, Wrench, LogIn, Settings
} from 'lucide-react';
import { AppUser } from '../../types';
import { useAppContext } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabase';
import { preloadTab, loadAdminDashboard } from '../../lib/lazyPreload';
import { isJobPoster } from '../../lib/utils/roleUtils';

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showMobileMenu: boolean;
  setShowMobileMenu: React.Dispatch<React.SetStateAction<boolean>> | ((show: boolean) => void);
  setShowPostFormGlobal: (show: boolean) => void;
  appUser: AppUser | null;
  setSelectedProfile: (user: AppUser | null) => void;
  notifications: any[];
  toggleProRank: () => void;
  logout: () => void;
  setShowAdmin: (show: boolean) => void;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}

const NAV_ITEMS = [
  { id: 'home',     icon: Home,          label: 'الرئيسية' },
  { id: 'jobs',     icon: Briefcase,     label: 'الوظائف'  },
  { id: 'news',     icon: Globe,         label: 'الأخبار'  },
  { id: 'messages', icon: MessageSquare, label: 'الرسائل'  },
  { id: 'more',     icon: MoreHorizontal,label: 'المزيد'   },
];

// ── Glassy Sidebar V5 Variants ─────────────────────────────────────────────
const panelVariants = {
  hidden: { x: '100%', opacity: 0.6 },
  show: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 380,
      damping: 34,
      when: 'beforeChildren' as const,
      staggerChildren: 0.035,
    },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.18 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: 16 },
  show: { opacity: 1, x: 0 },
};

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab, setActiveTab, showMobileMenu, setShowMobileMenu,
  appUser, setSelectedProfile,
  logout, setShowAdmin,
  theme, toggleTheme
}) => {
  const { posts, connections, unreadMessagesCount, pendingRequestsCount, userTotalPostsCount, isGuestMode } = useAppContext();

  // Hide messages tab on mobile dock for guests
  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      if (item.id === 'messages' && (!appUser || isGuestMode)) {
        return false;
      }
      return true;
    });
  }, [appUser, isGuestMode]);

  const userPosts = posts.filter(p => p.authorId === appUser?.id || (p as any).author_id === appUser?.id);
  const myPostsCount = Math.max(userTotalPostsCount || 0, userPosts.length);
  const userConnectionsCount = connections.filter(c =>
    c.status === 'accepted' && (c.requesterId === appUser?.id || c.recipientId === appUser?.id)
  ).length;

  const [applicantsCount, setApplicantsCount] = useState(0);
  useEffect(() => {
    if (!appUser?.id || !isJobPoster(appUser)) {
      setApplicantsCount(0);
      return;
    }
    const fetchUnseen = async () => {
      try {
        let seenSet = new Set<string>();
        try {
          const raw = localStorage.getItem(`prolink_seen_apps_${appUser.id}`);
          if (raw) seenSet = new Set(JSON.parse(raw));
        } catch (_) {}

        const { data } = await (supabase.from('job_applications') as any)
          .select('id')
          .eq('employer_id', appUser.id)
          .eq('status', 'pending');
        if (data) {
          const unviewed = (data as any[]).filter(a => !seenSet.has(a.id)).length;
          setApplicantsCount(unviewed);
        } else {
          setApplicantsCount(0);
        }
      } catch (_) {}
    };
    fetchUnseen();

    const handleSeenUpdate = () => { fetchUnseen(); };
    window.addEventListener('prolink_seen_apps_updated', handleSeenUpdate);

    const channel = supabase
      .channel(`mobile-dock-job-apps-${appUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications', filter: `employer_id=eq.${appUser.id}` }, () => {
        fetchUnseen();
      })
      .subscribe();

    return () => {
      window.removeEventListener('prolink_seen_apps_updated', handleSeenUpdate);
      supabase.removeChannel(channel);
    };
  }, [appUser?.id, appUser?.role]);

  const activeNavId = showMobileMenu ? 'more' : activeTab;

  // ── Hover & Active State for Glassy Sidebar V5
  const [hoverTab, setHoverTab] = useState<string | null>(null);
  const currentDrawerTab = hoverTab ?? activeTab;

  // ── حماية الـ backdrop: لا يستجيب حتى يمر 200ms من فتح الدرج
  // هذا يمنع إغلاق الدرج فور الفتح بسبب bubble من onPointerDown
  const backdropActiveRef = useRef(false);
  useEffect(() => {
    if (showMobileMenu) {
      backdropActiveRef.current = false;
      const t = setTimeout(() => { backdropActiveRef.current = true; }, 200);
      return () => clearTimeout(t);
    } else {
      backdropActiveRef.current = false;
    }
  }, [showMobileMenu]);

  // ── عناصر القائمة الجانبية الموحدة
  const drawerItems = useMemo(() => {
    const list: Array<{
      id: string;
      label: string;
      icon: any;
      color: string;
      badge?: number | string;
      onClick: () => void;
      preload?: () => void;
    }> = [];

    if (appUser?.isAdmin) {
      list.push({
        id: 'calls',
        label: 'المكالمات والاتصال',
        icon: Phone,
        color: 'text-emerald-500',
        onClick: () => setActiveTab('calls'),
        preload: () => preloadTab('calls'),
      });
    }

    list.push({
      id: 'network',
      label: 'شبكتي المهنية',
      icon: Users,
      color: 'text-violet-500',
      badge: pendingRequestsCount > 0 ? (pendingRequestsCount > 9 ? '9+' : pendingRequestsCount) : undefined,
      onClick: () => setActiveTab('network'),
      preload: () => preloadTab('network'),
    });

    if (appUser?.isAdmin) {
      list.push({
        id: 'erp',
        label: 'نظام الموارد البشرية (ERP)',
        icon: Building2,
        color: 'text-blue-500',
        onClick: () => setActiveTab('erp'),
        preload: () => preloadTab('erp'),
      });
    }

    list.push({
      id: 'groups',
      label: 'المجموعات المهنية 👥',
      icon: MessageSquare,
      color: 'text-indigo-500',
      onClick: () => setActiveTab('groups'),
      preload: () => preloadTab('groups'),
    });

    list.push({
      id: 'services',
      label: 'سوق الخدمات والمهن 🔧',
      icon: Wrench,
      color: 'text-blue-500',
      onClick: () => setActiveTab('services'),
      preload: () => preloadTab('services'),
    });

    if (appUser?.isAdmin) {
      list.push({
        id: 'admin',
        label: 'لوحة التحكم العليا',
        icon: Shield,
        color: 'text-red-500',
        onClick: () => setShowAdmin(true),
        preload: () => loadAdminDashboard(),
      });
    }

    list.push({
      id: 'about',
      label: 'عن منصة عمل أولاً',
      icon: Info,
      color: 'text-amber-500',
      onClick: () => setActiveTab('about'),
      preload: () => preloadTab('about'),
    });

    if (appUser) {
      list.push({
        id: 'settings',
        label: 'الإعدادات ⚙️',
        icon: Settings,
        color: 'text-blue-500',
        onClick: () => setActiveTab('settings'),
        preload: () => preloadTab('settings'),
      });
    }

    if (toggleTheme) {
      list.push({
        id: 'theme',
        label: theme === 'dark' ? 'الوضع الفاتح ☀️' : 'الوضع الليلي 🌙',
        icon: theme === 'dark' ? Sun : Moon,
        color: theme === 'dark' ? 'text-amber-500' : 'text-indigo-500',
        onClick: () => toggleTheme(),
      });
    }

    if (appUser) {
      list.push({
        id: 'logout',
        label: 'تسجيل الخروج',
        icon: LogOut,
        color: 'text-red-500',
        onClick: () => logout(),
      });
    } else {
      list.push({
        id: 'login',
        label: 'تسجيل الدخول',
        icon: LogIn,
        color: 'text-blue-500',
        onClick: () => window.dispatchEvent(new CustomEvent('prolink:exitGuestMode')),
      });
    }

    return list;
  }, [appUser, pendingRequestsCount, theme, toggleTheme, logout, setShowAdmin, setActiveTab]);

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════════
          Minimal Luxury Dock (10) — Compact Neumorphic Capsule & Floating Bubble
          ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-[80] flex justify-center items-center pointer-events-none"
        style={{
          paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 0.75rem) + 0.35rem)',
          paddingLeft: '0.85rem',
          paddingRight: '0.85rem',
          background: 'transparent',
        }}
      >
        {/* Compact Centered Soft Neumorphic Dock Container (عرض فاخر كبسولة أنيقة ومتناسقة بدون أي احتكاك) */}
        <nav
          className="relative flex items-center justify-between rounded-[38px] px-2.5 py-1.5 transition-all duration-300 pointer-events-auto"
          style={{
            width: '100%',
            maxWidth: '350px', // عرض متناسق ومريح للبار يمنع أي احتكاك مع الحواف
            height: '4.35rem',
            background: 'linear-gradient(145deg, #ffffff 0%, #f6f8fb 100%)',
            boxShadow:
              '0 14px 35px rgba(160, 175, 200, 0.35), -5px -5px 15px rgba(255, 255, 255, 0.95), inset 1px 1px 2px rgba(255, 255, 255, 1)',
            border: '1.5px solid rgba(255, 255, 255, 0.9)',
          }}
          aria-label="شريط التنقل الرئيسي"
        >
          {/* Dark Mode Neumorphic Container Overlay */}
          <div
            className="absolute inset-0 rounded-[38px] dark:opacity-100 opacity-0 pointer-events-none transition-opacity duration-300"
            style={{
              background: 'linear-gradient(145deg, #131d31 0%, #0a0f1d 100%)',
              boxShadow:
                '0 18px 42px rgba(0, 0, 0, 0.65), -4px -4px 16px rgba(30, 41, 59, 0.3), inset 1px 1px 1px rgba(255, 255, 255, 0.08)',
              border: '1.5px solid rgba(255, 255, 255, 0.08)',
            }}
          />

          {/* Top subtle highlight reflection line */}
          <div
            className="absolute top-0 left-8 right-8 h-px rounded-full pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
          />

          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNavId === item.id || (item.id === 'more' && showMobileMenu);
            const isMessages = item.id === 'messages';
            const isJobs = item.id === 'jobs';
            const badge = isMessages 
              ? unreadMessagesCount 
              : isJobs && isJobPoster(appUser) && applicantsCount > 0 
                ? applicantsCount 
                : 0;

            return (
              <motion.button
                key={item.id}
                data-dock-btn=""
                type="button"
                whileTap={{ scale: 0.92 }}
                onPointerDown={() => {
                  if (item.id === 'more') {
                    preloadTab('network');
                    preloadTab('services');
                    preloadTab('about');
                  } else {
                    preloadTab(item.id);
                  }
                  try { navigator.vibrate?.([8]); } catch (_) {}
                }}
                onMouseEnter={() => {
                  if (item.id === 'more') {
                    preloadTab('network');
                    preloadTab('services');
                    preloadTab('about');
                  } else {
                    preloadTab(item.id);
                  }
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try { navigator.vibrate?.([8]); } catch (_) {}
                  if (item.id === 'more') {
                    setShowMobileMenu(!showMobileMenu);
                  } else {
                    // ⚡ Urgent update — no startTransition so the tab switches
                    // immediately even if a lazy chunk or Keep-Alive render is pending
                    setActiveTab(item.id);
                    setShowMobileMenu(false);
                  }
                }}
                className="relative flex flex-col items-center justify-center flex-1 h-13 select-none cursor-pointer focus:outline-none bg-transparent border-0 p-0"
                style={{ zIndex: 2 }}
                aria-label={item.label}
              >
                {/* ── Active State: Compact Elevated Floating Glossy Gradient Bubble ── */}
                {isActive ? (
                  <motion.div
                    layoutId="minimal-luxury-active-bubble"
                    className="relative flex flex-col items-center justify-center"
                    // انتقال الأيقونات بسبرينغ فائق السلاسة والاستجابة
                    transition={{
                      type: 'spring',
                      stiffness: 450,
                      damping: 32,
                      mass: 1.0,
                    }}
                  >
                    {/* Glowing warm halo underneath */}
                    <div
                      className="absolute -top-2 w-9 h-9 rounded-full pointer-events-none blur-md opacity-50"
                      style={{
                        background: 'radial-gradient(circle, #f43f5e 0%, #ff5722 60%, transparent 80%)',
                      }}
                    />

                    {/* The Glossy Gradient Elevated Bubble Button (بحجم مصغر ومتناسق بدون أي احتكاك) */}
                    <div
                      className="relative w-9.5 h-9.5 rounded-[16px] flex items-center justify-center -translate-y-1 transition-transform duration-300 shadow-lg"
                      style={{
                        background: 'linear-gradient(135deg, #ff5722 0%, #f43f5e 55%, #e11d48 100%)',
                        boxShadow:
                          '0 8px 18px -2px rgba(244, 63, 94, 0.5), 0 3px 8px rgba(255, 87, 34, 0.3), inset 0 1.5px 1.5px rgba(255, 255, 255, 0.8), inset 0 -1.5px 2px rgba(0, 0, 0, 0.25)',
                        border: '1px solid rgba(255, 255, 255, 0.55)',
                      }}
                    >
                      {/* Top curved gloss sheen reflection */}
                      <div
                        className="absolute top-0.5 left-2 right-2 h-2 rounded-full pointer-events-none"
                        style={{
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 100%)',
                        }}
                      />

                      <Icon
                        size={17}
                        strokeWidth={2.4}
                        className="text-white relative z-10 filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                      />

                      {/* Notification Badge on Floating Bubble */}
                      {badge > 0 && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[15px] h-3.5 px-0.5 flex items-center justify-center rounded-full text-[7.5px] font-black text-white bg-slate-900 border border-white shadow-md z-20"
                        >
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </div>

                    {/* Active Label — Bold warm rose/orange */}
                    <span className="text-[9.5px] font-black text-[#f43f5e] dark:text-[#fb7185] -mt-0.5 tracking-tight leading-none">
                      {item.label}
                    </span>
                  </motion.div>
                ) : (
                  /* ── Inactive State: Clean, NO white card behind icon, sleek minimalist icon ── */
                  <div className="flex flex-col items-center justify-center py-0.5 transition-all duration-300 group-hover:scale-105 active:scale-95 bg-transparent">
                    <div className="relative p-0.5">
                      <Icon
                        size={17}
                        strokeWidth={1.8}
                        className="text-slate-400 dark:text-slate-500 transition-colors group-hover:text-slate-600 dark:group-hover:text-slate-300"
                      />
                      {badge > 0 && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[14px] h-3 px-0.5 flex items-center justify-center rounded-full text-[7.5px] font-black text-white bg-red-500 border border-white dark:border-slate-800 shadow-sm"
                        >
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[8.5px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 tracking-tight">
                      {item.label}
                    </span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </nav>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Glassy Sidebar V5 — Floating Luxury Blur & Staggered Cascading Motion
          ══════════════════════════════════════════════════════════════════════ */}
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {showMobileMenu && (
            <>
              {/* Backdrop with soft blur and click protection */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => { if (backdropActiveRef.current) setShowMobileMenu(false); }}
                className="fixed inset-0 z-[109] bg-black/40 backdrop-blur-xs"
              />

              {/* Floating Glassy Panel (RTL: right-2 top-2 bottom-2) */}
              <motion.aside
                dir="rtl"
                variants={panelVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="!fixed fixed right-2 top-2 bottom-2 z-[110] w-[84%] max-w-[325px]
                           rounded-[28px] border border-white/40 dark:border-white/10 shadow-2xl
                           bg-white/80 dark:bg-slate-900/85 backdrop-blur-2xl
                           flex flex-col overflow-hidden metal-watermark"
                style={{
                  paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)',
                  paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
                  boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.2)',
                }}
              >
                {/* Top Subtle Sheen Reflection */}
                <div
                  className="absolute top-0 left-6 right-6 h-px rounded-full pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)' }}
                />

                {/* ── 1. Header: User Profile Card & Quick Stats ── */}
                <div className="relative z-10 p-4 border-b border-slate-200/50 dark:border-slate-800/60 shrink-0">
                  {appUser ? (
                    <>
                      <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onMouseEnter={() => preloadTab('profile')}
                        onPointerDown={() => preloadTab('profile')}
                        onClick={() => {
                          // ⚡ Urgent — navigate to profile immediately
                          setSelectedProfile(appUser);
                          setActiveTab('profile');
                          setShowMobileMenu(false);
                        }}
                      >
                        {appUser.avatar ? (
                          <div className="relative shrink-0">
                            <img
                              src={appUser.avatar}
                              className="w-11 h-11 rounded-2xl border-2 border-blue-200 dark:border-blue-800 shadow-md object-cover group-hover:scale-105 transition-transform"
                              alt={appUser?.name}
                            />
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-base font-black shadow-md shrink-0">
                            {appUser?.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-slate-900 dark:text-white text-sm truncate">{appUser?.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{
                                background: appUser?.role === 'employer' ? 'rgba(59,130,246,0.1)' : appUser?.role === 'freelancer' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                                color: appUser?.role === 'employer' ? '#3b82f6' : appUser?.role === 'freelancer' ? '#f59e0b' : '#10b981',
                              }}
                            >
                              {appUser?.role === 'employer' ? 'صاحب عمل 💼' : appUser?.role === 'freelancer' ? 'عمل حر ⚡' : 'باحث عن عمل 🔍'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div
                        className="mt-3 grid grid-cols-3 gap-1.5 p-2 rounded-2xl"
                        style={{
                          background: 'rgba(59,130,246,0.06)',
                          border: '1px solid rgba(59,130,246,0.12)',
                        }}
                      >
                        {[
                          { label: 'المنشورات', value: myPostsCount, color: '#3b82f6' },
                          { label: appUser?.role === 'employer' ? 'المتقدمون' : 'طلباتي', value: appUser?.role === 'employer' ? applicantsCount : '—', color: '#6366f1' },
                          { label: 'الاتصالات', value: userConnectionsCount, color: '#8b5cf6' },
                        ].map(stat => (
                          <div key={stat.label} className="text-center">
                            <p className="text-xs font-black" style={{ color: stat.color }}>{stat.value}</p>
                            <p className="text-[8.5px] font-bold text-slate-400 dark:text-slate-500">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="p-1 text-center">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 mb-2">
                        <LogIn size={22} />
                      </div>
                      <h3 className="font-black text-slate-900 dark:text-white text-sm">أهلاً بك في منصة عمل</h3>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                        سجّل الدخول للتواصل مع المهنيين والتقديم على الوظائف.
                      </p>
                      <button
                        onClick={() => {
                          setShowMobileMenu(false);
                          window.dispatchEvent(new CustomEvent('prolink:exitGuestMode'));
                        }}
                        className="mt-2.5 w-full py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs rounded-xl shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <LogIn size={13} />
                        تسجيل الدخول / إنشاء حساب
                      </button>
                    </div>
                  )}
                </div>

                {/* ── 2. Navigation Items: Staggered Entrance + Side-Pill Indicator ── */}
                <nav className="relative z-10 flex-1 overflow-y-auto p-3 space-y-1 no-scrollbar">
                  {drawerItems.map((it) => {
                    const Icon = it.icon;
                    const isCurrent = currentDrawerTab === it.id;
                    return (
                      <motion.button
                        key={it.id}
                        variants={itemVariants}
                        type="button"
                        onPointerDown={() => {
                          it.preload?.();
                          try { navigator.vibrate?.([6]); } catch (_) {}
                        }}
                        onPointerEnter={() => setHoverTab(it.id)}
                        onPointerLeave={() => setHoverTab(null)}
                        onClick={() => {
                          // ⚡ Urgent — no startTransition so drawer items navigate immediately
                          it.onClick();
                          setShowMobileMenu(false);
                        }}
                        whileTap={{ scale: 0.96 }}
                        className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-right cursor-pointer select-none transition-colors border-0 bg-transparent focus:outline-none"
                      >
                        {/* Sliding Active Pill (Glassy V5 spring) */}
                        {isCurrent && (
                          <motion.span
                            layoutId="side-pill"
                            className="absolute inset-0 rounded-2xl bg-white/70 dark:bg-white/10 shadow-xs border border-white/50 dark:border-white/10"
                            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                          />
                        )}
                        <div className={`relative p-2 rounded-xl bg-slate-100/60 dark:bg-slate-800/60 ${it.color} shrink-0`}>
                          <Icon size={18} />
                        </div>
                        <span className="relative font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex-1 truncate">
                          {it.label}
                        </span>
                        {it.badge && (
                          <span className="relative mr-auto text-[9.5px] font-black px-2 py-0.5 rounded-full bg-red-500 text-white shadow-xs shrink-0">
                            {it.badge}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </nav>

                {/* ── 3. Footer ── */}
                <div className="relative z-10 px-4 py-3 border-t border-slate-200/50 dark:border-slate-800/60 shrink-0">
                  <p className="text-[8.5px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest text-center">
                    منصة عمل أولاً — ProLink v2.6.0
                  </p>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </MotionConfig>
    </>
  );
};
