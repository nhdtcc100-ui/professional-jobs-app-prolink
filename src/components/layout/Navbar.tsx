import React from 'react';
import { Home, Users, Briefcase, Globe, MessageSquare, Bell, ChevronDown, Sparkles, User as UserIcon, Shield, LogOut, Search, Moon, Sun, Phone, Building2 } from 'lucide-react';
import { NavbarItem, NavDropdownItem } from './';
import { AppUser, AppNotification } from '../../types';

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
  return (
    <nav className="sticky top-0 z-[100] bg-white/90 backdrop-blur-xl border-b border-white/60 shadow-sm transition-all duration-300">
      <div className="max-w-6xl mx-auto px-2 md:px-4 h-16 flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <div className="relative group cursor-pointer shrink-0" onClick={() => { setActiveTab('home'); setSearchQuery(''); }}>
            <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-0 group-hover:opacity-30 transition-opacity animate-pulse" />
            <div className="relative flex items-center gap-2 md:gap-3">
              {/* Logo Icon */}
              <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-2xl shadow-2xl shadow-blue-200/50 group-hover:scale-110 group-hover:rotate-[6deg] transition-all active:scale-90 overflow-hidden border border-white/20 bg-gradient-to-br from-[#0a2463] via-[#1e4fd9] to-[#002d5b]">
                <img 
                  src="/logo.png" 
                  className="w-full h-full object-cover"
                  alt="عمل"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    el.style.display = 'none';
                    const fallback = el.parentElement?.querySelector('.logo-fallback') as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                {/* Fallback */}
                <div className="logo-fallback absolute inset-0 hidden items-center justify-center">
                  <span className="text-white font-black text-lg leading-none" style={{ fontFamily: 'Arial, sans-serif' }}>ع</span>
                </div>
                {/* Shimmer overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Brand Text */}
              <div className="hidden md:flex flex-col">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-slate-900 dark:text-white leading-none tracking-tighter" style={{ fontFamily: 'Arial, sans-serif' }}>عمل</span>
                  <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 leading-none tracking-tight">Pro</span>
                </div>
                <p className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mt-0.5">المنصة المهنية الأولى</p>
              </div>
            </div>
          </div>
          <div className="flex bg-slate-100/40 backdrop-blur-md rounded-2xl px-3 py-2 items-center gap-2 flex-1 min-w-0 md:max-w-[400px] group transition-all focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50/50 border border-slate-200/50 shadow-inner overflow-hidden">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="ابحث..."
              className="bg-transparent border-none outline-none text-[11px] w-full font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Premium Dark Mode Toggle */}
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className={`group relative flex items-center justify-center w-10 h-10 rounded-2xl border backdrop-blur-md shadow-sm transition-all duration-500 overflow-hidden shrink-0 ${
                theme === 'dark' 
                  ? 'bg-slate-800/80 border-slate-700 text-indigo-400 hover:bg-slate-800 hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]' 
                  : 'bg-white border-slate-200/60 text-amber-500 hover:bg-amber-50 hover:border-amber-200 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              }`}
              title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الليلي'}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/5 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className={`transform transition-all duration-500 ${theme === 'dark' ? 'rotate-[360deg] scale-110' : 'rotate-0 scale-100'}`}>
                {theme === 'dark' ? <Moon size={20} className="fill-indigo-500/20 drop-shadow-md" /> : <Sun size={20} className="fill-amber-500/20 drop-shadow-md" />}
              </div>
            </button>
          )}
        </div>

        {/* Desktop Navigation Items */}
        <div className="hidden md:flex items-center gap-1 sm:gap-2 h-full">
          <NavbarItem icon={<Home size={22} />} label="الرئيسية" active={activeTab === 'home'} onClick={() => { setActiveTab('home'); setSearchQuery(''); }} />
          <NavbarItem icon={<Users size={22} />} label="شبكتي" active={activeTab === 'network'} onClick={() => setActiveTab('network')} />
          <NavbarItem icon={<Briefcase size={22} />} label="الوظائف" active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} />
          {appUser?.hasErpAccess && (
            <NavbarItem icon={<Building2 size={22} />} label="نظام الموارد" active={activeTab === 'erp'} onClick={() => setActiveTab('erp')} />
          )}
          {appUser?.hasCallsAccess && (
            <NavbarItem icon={<Phone size={22} />} label="المكالمات" active={activeTab === 'calls'} onClick={() => setActiveTab('calls')} />
          )}

          <NavbarItem icon={<Globe size={22} />} label="الأخبار" active={activeTab === 'news'} onClick={() => setActiveTab('news')} />
          <NavbarItem icon={<MessageSquare size={22} />} label="الرسائل" active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} />
          
          <div className="relative h-full flex items-center mr-2">
            <NavbarItem
              icon={<Bell size={22} />}
              label="الإشعارات"
              active={showNotifications}
              onClick={() => setShowNotifications(!showNotifications)}
            />
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute top-3.5 right-4.5 min-w-[16px] h-4 px-1 notif-badge-premium text-[9px] rounded-full animate-bounce pointer-events-none">
                {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length}
              </span>
            )}
          </div>

          <div className="h-8 w-[1px] bg-slate-100 mx-2" />

          <div className="relative group ml-2">
            <div className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-xl transition-all cursor-pointer" onClick={() => { setSelectedProfile(appUser); setIsEditingProfile(true); }}>
              <img
                src={appUser?.avatar || `https://ui-avatars.com/api/?name=${appUser?.name || 'User'}&background=random`}
                className="w-9 h-9 rounded-xl border-2 border-white shadow-sm object-cover"
                alt="Profile"
                referrerPolicy="no-referrer"
              />
              <div className="hidden lg:block text-right">
                 <p className="text-[10px] font-black text-slate-800 leading-none">{appUser?.name}</p>
                 <p className="text-[8px] text-blue-600 font-black uppercase mt-1">{appUser?.role === 'employer' ? 'صاحب عمل' : 'باحث'}</p>
              </div>
              <ChevronDown size={14} className="text-slate-400" />
            </div>
            
            <div className="absolute top-full right-0 mt-2 hidden group-hover:block transition-all py-2 z-[60]">
              <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl p-3 w-56 backdrop-blur-xl ring-1 ring-black/5">
                <div className="p-2 mb-2 bg-slate-50 rounded-xl">
                  <p className="font-black text-xs text-slate-800">{appUser?.name}</p>
                  <p className="text-[9px] text-slate-400 font-bold truncate">{appUser?.email}</p>
                </div>
                <NavDropdownItem icon={<Sparkles size={14} className="text-amber-500" />} label={appUser?.isPro ? 'عضوية النخبة' : 'ترقية للحساب الذهبي'} onClick={toggleProRank} color="text-amber-600" />
                <NavDropdownItem icon={<UserIcon size={14} />} label="تعديل الملف الشخصي" onClick={() => setIsEditingProfile(true)} />
                <NavDropdownItem icon={<Briefcase size={14} />} label="تغيير نوع الحساب" onClick={() => setIsSelectingRole(true)} />
                {appUser?.isAdmin && (
                  <NavDropdownItem icon={<Shield size={14} className="text-blue-600" />} label="لوحة التحكم العليا" onClick={() => setShowAdmin(true)} color="text-blue-700" />
                )}
                <div className="border-t border-slate-50 my-1.5" />
                <NavDropdownItem icon={<LogOut size={14} />} label="تسجيل الخروج" onClick={logout} color="text-red-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden flex items-center gap-2 shrink-0">
           <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-400 hover:bg-slate-100 rounded-2xl transition-all border border-slate-100/50 dark:border-slate-700/50">
                <Bell size={18} />
              </button>
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 notif-badge-premium text-[8px] rounded-full shadow-md animate-pulse">
                  {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length}
                </span>
              )}
           </div>
           <div 
             className="relative group cursor-pointer"
             onClick={() => setSelectedProfile(appUser)}
           >
             <div className="absolute -inset-1 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-active:opacity-40 transition-opacity" />
             <img
                src={appUser?.avatar || `https://ui-avatars.com/api/?name=${appUser?.name || 'User'}&background=random`}
                className="relative w-9 h-9 rounded-2xl border-2 border-white shadow-md object-cover cursor-pointer shrink-0 hover:scale-105 transition-transform"
                alt="Profile"
                referrerPolicy="no-referrer"
              />
           </div>
        </div>
      </div>
    </nav>
  );
};
