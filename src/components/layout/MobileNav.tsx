import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, Briefcase, Globe, MessageSquare, MoreHorizontal,
  Users, Info, LogOut, Shield, Phone, Building2, Moon, Sun, Wrench, LogIn
} from 'lucide-react';
import { DrawerItem } from './Navigation';
import { AppUser } from '../../types';
import { useAppContext } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabase';

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showMobileMenu: boolean;
  setShowMobileMenu: (show: boolean) => void;
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

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab, setActiveTab, showMobileMenu, setShowMobileMenu,
  appUser, setSelectedProfile,
  logout, setShowAdmin,
  theme, toggleTheme
}) => {
  const { posts, connections, unreadMessagesCount, pendingRequestsCount, userTotalPostsCount } = useAppContext();

  const userPosts = posts.filter(p => p.authorId === appUser?.id || (p as any).author_id === appUser?.id);
  const myPostsCount = Math.max(userTotalPostsCount || 0, userPosts.length);
  const userConnectionsCount = connections.filter(c =>
    c.status === 'accepted' && (c.requesterId === appUser?.id || c.recipientId === appUser?.id)
  ).length;

  const [applicantsCount, setApplicantsCount] = useState(0);
  useEffect(() => {
    if (!appUser?.id) return;
    (supabase.from('job_applications') as any)
      .select('id', { count: 'exact', head: true })
      .eq('employer_id', appUser.id)
      .then(({ count }: any) => setApplicantsCount(count || 0));
  }, [appUser?.id]);

  const activeNavId = showMobileMenu ? 'more' : activeTab;

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════════
          Minimal Luxury Dock (10) — Compact Neumorphic Capsule & Floating Bubble
          ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-[60] flex justify-center items-center pointer-events-none"
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

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNavId === item.id || (item.id === 'more' && showMobileMenu);
            const isMessages = item.id === 'messages';
            const isJobs = item.id === 'jobs';
            const badge = isMessages 
              ? unreadMessagesCount 
              : isJobs && applicantsCount > 0 
                ? applicantsCount 
                : 0;

            return (
              <button
                key={item.id}
                data-dock-btn=""
                onClick={() => {
                  try { navigator.vibrate?.([8]); } catch (_) {}
                  // التنقل بين الصفحات يبقى سريعاً فورياً وبدون أي تأخير
                  if (item.id === 'more') {
                    setShowMobileMenu(true);
                  } else {
                    setShowMobileMenu(false);
                    setActiveTab(item.id);
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
                    // انتقال الأيقونات بشكل بطيء جداً وانسيابي للغاية بينما الصفحات سريعة
                    transition={{
                      type: 'spring',
                      stiffness: 75,
                      damping: 20,
                      mass: 1.4,
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
              </button>
            );
          })}
        </nav>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Mobile Side Drawer — Soft Neumorphic Glass Luxury
          ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowMobileMenu(false)}
              className="fixed inset-0 z-[100]"
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="fixed top-0 right-0 bottom-0 z-[110] flex flex-col"
              style={{
                width: '82vw',
                maxWidth: 340,
                background: 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(32px)',
                WebkitBackdropFilter: 'blur(32px)',
                borderLeft: '1px solid rgba(148, 163, 184, 0.18)',
                boxShadow: '-16px 0 48px rgba(15, 23, 42, 0.14)',
              }}
              dir="rtl"
            >
              {/* Dark overlay for drawer */}
              <div className="absolute inset-0 dark:bg-slate-900/95 pointer-events-none" />

              {/* Top glass shine */}
              <div
                className="absolute top-0 left-4 right-4 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)' }}
              />

              {/* Drawer Header */}
              <div className="relative z-10 p-5 border-b border-slate-100/60 dark:border-slate-800/60">
                {appUser ? (
                  <>
                    <div
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => { setSelectedProfile(appUser); setActiveTab('profile'); setShowMobileMenu(false); }}
                    >
                      {appUser.avatar ? (
                        <div className="relative">
                          <img
                            src={appUser.avatar}
                            className="w-12 h-12 rounded-2xl border-2 border-blue-200 dark:border-blue-800 shadow-md object-cover group-hover:scale-105 transition-transform"
                            alt={appUser?.name}
                          />
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-black shadow-md">
                          {appUser?.name?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 dark:text-white text-sm truncate">{appUser?.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{
                              background: appUser?.role === 'employer' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                              color: appUser?.role === 'employer' ? '#3b82f6' : '#10b981',
                            }}
                          >
                            {appUser?.role === 'employer' ? 'صاحب عمل 💼' : 'باحث عن عمل 🔍'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div
                      className="mt-4 grid grid-cols-3 gap-2 p-3 rounded-2xl"
                      style={{
                        background: 'rgba(59,130,246,0.05)',
                        border: '1px solid rgba(59,130,246,0.1)',
                      }}
                    >
                      {[
                        { label: 'المنشورات', value: myPostsCount, color: '#3b82f6' },
                        { label: appUser?.role === 'employer' ? 'المتقدمون' : 'طلباتي', value: appUser?.role === 'employer' ? applicantsCount : '—', color: '#6366f1' },
                        { label: 'الاتصالات', value: userConnectionsCount, color: '#8b5cf6' },
                      ].map(stat => (
                        <div key={stat.label} className="text-center">
                          <p className="text-sm font-black" style={{ color: stat.color }}>{stat.value}</p>
                          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-1 text-center">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 mb-3">
                      <LogIn size={26} />
                    </div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base">أهلاً بك في منصة عمل</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                      أنت تتصفح كزائر، سجّل الدخول للتواصل مع المهنيين والتقديم على الوظائف.
                    </p>
                    <button
                      onClick={() => {
                        setShowMobileMenu(false);
                        window.dispatchEvent(new CustomEvent('prolink:exitGuestMode'));
                      }}
                      className="mt-3 w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs rounded-xl shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <LogIn size={14} />
                      تسجيل الدخول / إنشاء حساب
                    </button>
                  </div>
                )}
              </div>

                {/* Drawer Items */}
              <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-1.5">
                {appUser?.isAdmin && (
                  <DrawerItem icon={<Phone size={20} className="text-emerald-500" />} label="المكالمات والاتصال" onClick={() => { setActiveTab('calls'); setShowMobileMenu(false); }} color="text-emerald-700 dark:text-emerald-300" />
                )}
                <div className="relative">
                  <DrawerItem icon={<Users size={20} className="text-violet-500" />} label="شبكتي المهنية" onClick={() => { setActiveTab('network'); setShowMobileMenu(false); }} color="text-violet-700 dark:text-violet-300" />
                  {pendingRequestsCount > 0 && (
                    <span className="absolute top-3 left-4 px-2 py-0.5 bg-red-500 text-white font-black text-[9px] rounded-full shadow">
                      {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount} جديد
                    </span>
                  )}
                </div>
                {appUser?.isAdmin && (
                  <DrawerItem icon={<Building2 size={20} className="text-blue-500" />} label="نظام الموارد البشرية (ERP)" onClick={() => { setActiveTab('erp'); setShowMobileMenu(false); }} color="text-blue-700 dark:text-blue-300" />
                )}
                <DrawerItem icon={<MessageSquare size={20} className="text-indigo-500" />} label="المجموعات المهنية 👥" onClick={() => { setActiveTab('groups'); setShowMobileMenu(false); }} color="text-indigo-700 dark:text-indigo-300" />
                <DrawerItem icon={<Wrench size={20} className="text-blue-500" />} label="سوق الخدمات والمهن 🔧" onClick={() => { setActiveTab('home'); setShowMobileMenu(false); }} color="text-blue-700 dark:text-blue-300" />
                {appUser?.isAdmin && (
                  <DrawerItem icon={<Shield size={20} className="text-red-500" />} label="لوحة التحكم العليا" onClick={() => { setShowAdmin(true); setShowMobileMenu(false); }} color="text-red-700 dark:text-red-300" />
                )}
                <DrawerItem icon={<Info size={20} className="text-amber-500" />} label="عن منصة عمل أولاً" onClick={() => { setActiveTab('about'); setShowMobileMenu(false); }} color="text-amber-700 dark:text-amber-300" />
                {toggleTheme && (
                  <DrawerItem
                    icon={theme === 'dark' ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} className="text-indigo-500" />}
                    label={theme === 'dark' ? 'الوضع الفاتح ☀️' : 'الوضع الليلي 🌙'}
                    onClick={() => { toggleTheme(); setShowMobileMenu(false); }}
                    color={theme === 'dark' ? 'text-amber-700 dark:text-amber-300' : 'text-indigo-700 dark:text-indigo-300'}
                  />
                )}
                {appUser ? (
                  <DrawerItem icon={<LogOut size={20} className="text-red-500" />} label="تسجيل الخروج" onClick={() => { setShowMobileMenu(false); logout(); }} color="text-red-700 dark:text-red-300" />
                ) : (
                  <DrawerItem icon={<LogIn size={20} className="text-blue-500" />} label="تسجيل الدخول" onClick={() => { setShowMobileMenu(false); window.dispatchEvent(new CustomEvent('prolink:exitGuestMode')); }} color="text-blue-700 dark:text-blue-300" />
                )}
              </div>


              {/* Footer */}
              <div className="relative z-10 p-5 border-t border-slate-100/50 dark:border-slate-800/50">
                <p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest text-center">
                  منصة عمل أولاً — ProLink v2.6.0
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
