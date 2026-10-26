import React from 'react';
import { Home, Users, Briefcase, Globe, MessageSquare, Bell, ChevronDown, Crown, User as UserIcon, Shield, LogOut, Moon, Sun, Phone, Building2, Wrench, LogIn } from 'lucide-react';
import { NavbarItem, NavDropdownItem } from './';
import { AppUser, AppNotification } from '../../types';
import { useAppContext } from '../../contexts/AppContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
  notifications: AppNotification[];
  appUser: AppUser | null;
  setSelectedProfile: (user: AppUser | null) => void;
  setIsEditingProfile: (editing: boolean) => void;
  toggleProRank: () => void;
  setShowAdmin: (show: boolean) => void;
  setIsSelectingRole: (selecting: boolean) => void;
  logout: () => void;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  showNotifications,
  setShowNotifications,
  notifications,
  appUser,
  setSelectedProfile,
  setIsEditingProfile,
  toggleProRank,
  setShowAdmin,
  setIsSelectingRole,
  logout,
  theme,
  toggleTheme
}) => {
  const { unreadMessagesCount, pendingRequestsCount, unreadNotificationsCount } = useAppContext();

  return (
    <nav
      className="sticky top-0 z-[100] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 shadow-sm transition-all duration-300"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* ─── Desktop / Tablet: 3-column grid so nav icons are truly centred ─── */}
      <div className="hidden md:grid grid-cols-3 items-center max-w-6xl mx-auto px-4 h-16">

        {/* Col 1 — Logo (right in RTL) */}
        <div className="flex items-center">
          <div
            className="relative group cursor-pointer"
            onClick={() => { setActiveTab('about'); setSearchQuery(''); }}
          >
            <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-0 group-hover:opacity-30 transition-opacity animate-pulse" />
            <div className="relative flex items-center gap-2 md:gap-3">
              <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-2xl shadow-2xl shadow-blue-200/50 group-hover:scale-110 group-hover:rotate-[6deg] transition-all active:scale-90 overflow-hidden border border-white/20 bg-gradient-to-br from-[#0a2463] via-[#1e4fd9] to-[#002d5b]">
                <img
                  src="/logo.png"
                  className="w-full h-full object-cover"
                  alt="عمل"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    el.style.display = 'none';
                    const fb = el.parentElement?.querySelector('.logo-fallback') as HTMLElement;
                    if (fb) fb.style.display = 'flex';
                  }}
                />
                <div className="logo-fallback absolute inset-0 hidden items-center justify-center">
                  <span className="text-white font-black text-lg leading-none" style={{ fontFamily: 'Arial, sans-serif' }}>ع</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="hidden lg:flex flex-col">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-slate-900 dark:text-white leading-none tracking-tighter" style={{ fontFamily: 'Arial, sans-serif' }}>عمل</span>
                  <span className="text-sm font-black text-blue-600 dark:text-blue-400 leading-none tracking-tight">أولاً</span>
                </div>
                <p className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mt-0.5">منصة عمل أولاً</p>
              </div>
            </div>
          </div>
        </div>

        {/* Col 2 — Main Nav Icons (perfectly centred) */}
        <div className="flex items-center justify-center gap-0.5 h-full">
          <NavbarItem icon={<Home size={22} />} label="الرئيسية" active={activeTab === 'home'} onClick={() => { setActiveTab('home'); setSearchQuery(''); }} />
          
          {/* Network Tab with Red Unread Badge */}
          <div className="relative h-full flex items-center">
            <NavbarItem icon={<Users size={22} />} label="شبكتي" active={activeTab === 'network'} onClick={() => setActiveTab('network')} />
            {pendingRequestsCount > 0 && (
              <span className="absolute top-3.5 right-1 min-w-[16px] h-4 px-1 bg-red-600 text-white font-black text-[9px] rounded-full animate-bounce pointer-events-none flex items-center justify-center border border-white dark:border-slate-800 shadow-md">
                {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
              </span>
            )}
          </div>

          <NavbarItem icon={<Briefcase size={22} />} label="الوظائف" active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} />
          {appUser?.isAdmin && (
            <NavbarItem icon={<Building2 size={22} />} label="الموارد" active={activeTab === 'erp'} onClick={() => setActiveTab('erp')} />
          )}
          {appUser?.isAdmin && (
            <NavbarItem icon={<Phone size={22} />} label="المكالمات" active={activeTab === 'calls'} onClick={() => setActiveTab('calls')} />
          )}
          <NavbarItem icon={<Globe size={22} />} label="الأخبار" active={activeTab === 'news'} onClick={() => setActiveTab('news')} />
          
          {/* Messages Tab with Red Unread Badge */}
          <div className="relative h-full flex items-center overflow-visible z-20">
            <NavbarItem icon={<MessageSquare size={22} />} label="الرسائل" active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} />
            {unreadMessagesCount > 0 && (
              <span className="absolute top-2.5 right-0.5 z-30 min-w-[18px] h-[18px] px-1 bg-red-600 text-white font-black text-[9px] rounded-full animate-bounce pointer-events-none flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-lg">
                {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
              </span>
            )}
          </div>

          <div className="relative h-full flex items-center overflow-visible z-20">
            <NavbarItem
              icon={<Bell size={22} />}
              label="الإشعارات"
              active={showNotifications}
              onClick={() => setShowNotifications(!showNotifications)}
            />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-2.5 right-0.5 z-30 min-w-[18px] h-[18px] px-1 notif-badge-premium text-[9px] rounded-full animate-bounce pointer-events-none flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-lg">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </div>
        </div>

        {/* Col 3 — Profile Dropdown (left in RTL) */}
        {/* Col 3 — Profile Dropdown / Login Button */}
        <div className="flex items-center justify-end h-full">
          {appUser ? (
            <div className="relative group">
              <div
                className="flex items-center gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                onClick={() => { setSelectedProfile(appUser); setIsEditingProfile(false); setActiveTab('profile'); }}
              >
                <img
                  src={appUser?.avatar || `https://ui-avatars.com/api/?name=${appUser?.name || 'User'}&background=random`}
                  className="w-9 h-9 rounded-xl border-2 border-white dark:border-slate-700 shadow-sm object-cover"
                  alt="Profile"
                  referrerPolicy="no-referrer"
                />
                <div className="hidden lg:block text-right">
                  <p className="text-[10px] font-black text-slate-800 dark:text-white leading-none">{appUser?.name}</p>
                  <p className="text-[8px] text-blue-600 dark:text-blue-400 font-black uppercase mt-1">
                    {appUser?.role === 'employer' ? 'صاحب عمل' : 'باحث'}
                  </p>
                </div>
                <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" />
              </div>

              {/* Dropdown */}
              <div className="absolute top-full left-0 mt-2 hidden group-hover:block transition-all py-2 z-[60]">
                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl p-3 w-60 backdrop-blur-xl ring-1 ring-black/5">
                  <div
                    className="p-2 mb-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl cursor-pointer"
                    onClick={() => { setSelectedProfile(appUser); setActiveTab('profile'); }}
                  >
                    <p className="font-black text-xs text-slate-800 dark:text-white">{appUser?.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold truncate">{appUser?.email}</p>
                  </div>
                  <NavDropdownItem icon={<Crown size={14} className="text-amber-500" />} label={appUser?.isPro ? 'عضوية النخبة' : 'ترقية للحساب الذهبي'} onClick={toggleProRank} color="text-amber-600" />
                  <NavDropdownItem icon={<UserIcon size={14} />} label="تعديل الملف الشخصي" onClick={() => { setSelectedProfile(appUser); setIsEditingProfile(true); setActiveTab('profile'); }} />
                  {toggleTheme && (
                    <NavDropdownItem
                      icon={theme === 'dark' ? <Sun size={14} className="text-amber-500" /> : <Moon size={14} className="text-indigo-500" />}
                      label={theme === 'dark' ? 'الوضع الفاتح ☀️' : 'الوضع الليلي 🌙'}
                      onClick={toggleTheme}
                    />
                  )}
                  {appUser?.isAdmin && (
                    <NavDropdownItem icon={<Shield size={14} className="text-blue-600" />} label="لوحة التحكم العليا" onClick={() => setShowAdmin(true)} color="text-blue-700" />
                  )}
                  <div className="border-t border-slate-50 dark:border-slate-700 my-1.5" />
                  <NavDropdownItem icon={<LogOut size={14} />} label="تسجيل الخروج" onClick={logout} color="text-red-500" />
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('prolink:exitGuestMode'))}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-95"
            >
              <LogIn size={14} />
              <span>تسجيل الدخول</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Mobile ─── */}
      <div className="md:hidden flex items-center justify-between px-3 h-16">
        {/* Logo */}
        <div
          className="relative group cursor-pointer shrink-0"
          onClick={() => { setActiveTab('about'); setSearchQuery(''); }}
        >
          <div className="relative w-10 h-10 rounded-2xl shadow-lg overflow-hidden bg-gradient-to-br from-[#0a2463] via-[#1e4fd9] to-[#002d5b]">
            <img src="/logo.png" className="w-full h-full object-cover" alt="عمل"
              onError={(e) => {
                const el = e.target as HTMLImageElement; el.style.display = 'none';
                const fb = el.parentElement?.querySelector('.logo-fallback') as HTMLElement;
                if (fb) fb.style.display = 'flex';
              }}
            />
            <div className="logo-fallback absolute inset-0 hidden items-center justify-center">
              <span className="text-white font-black text-lg">ع</span>
            </div>
          </div>
        </div>

        {/* Mobile right: Bell + Avatar or Login */}
        <div className="flex items-center gap-2 shrink-0">
          {appUser ? (
            <>
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-400 hover:bg-slate-100 rounded-2xl transition-all border border-slate-100/50 dark:border-slate-700/50"
                >
                  <Bell size={18} />
                </button>
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 notif-badge-premium text-[8px] rounded-full shadow-md animate-pulse">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </div>
              <div
                className="relative group cursor-pointer"
                onClick={() => { setSelectedProfile(appUser); setActiveTab('profile'); }}
              >
                <div className="absolute -inset-1 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-active:opacity-40 transition-opacity" />
                <img
                  src={appUser?.avatar || `https://ui-avatars.com/api/?name=${appUser?.name || 'User'}&background=random`}
                  className="relative w-9 h-9 rounded-2xl border-2 border-white shadow-md object-cover hover:scale-105 transition-transform"
                  alt="Profile"
                  referrerPolicy="no-referrer"
                />
              </div>
            </>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('prolink:exitGuestMode'))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white font-black text-[11px] rounded-xl shadow-sm active:scale-95 transition-all"
            >
              <LogIn size={13} />
              <span>دخول</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
