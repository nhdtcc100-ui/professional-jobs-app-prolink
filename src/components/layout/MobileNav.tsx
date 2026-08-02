import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Briefcase, Plus, Globe, MessageSquare, Users, MoreHorizontal, Info, LogOut, Shield, Sparkles, Phone, Building2 } from 'lucide-react';
import { MobileNavItem, DrawerItem } from './';
import { AppUser } from '../../types';

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
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  setActiveTab,
  showMobileMenu,
  setShowMobileMenu,
  setShowPostFormGlobal,
  appUser,
  setSelectedProfile,
  notifications,
  toggleProRank,
  logout,
  setShowAdmin
}) => {
  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-white/95 dark:bg-[#020817]/95 backdrop-blur-2xl border-t border-slate-100 dark:border-slate-800 flex items-center px-4 py-2 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] justify-between pb-safe">
        <MobileNavItem icon={<Home size={24} />} label="الرئيسية" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
        <MobileNavItem icon={<Briefcase size={24} />} label="الوظائف" active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} />
        
        <div className="relative flex flex-col items-center justify-center w-14 h-12">
          <motion.div 
            animate={activeTab === 'news' ? { y: -28 } : { y: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 20 }}
            className="flex flex-col items-center relative"
          >
            <button 
              onClick={() => setActiveTab('news')} 
              className={`relative flex items-center justify-center transition-all duration-500 shadow-xl z-10
                ${activeTab === 'news' ? 'bg-blue-600 text-white w-14 h-14 border-[4px] border-white dark:border-[#020817] rounded-full scale-110 shadow-blue-500/40' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:text-blue-600 w-12 h-12 rounded-xl shadow-slate-200/50 dark:shadow-none'}`}
            >
              <Globe size={activeTab === 'news' ? 26 : 24} />
            </button>
            <AnimatePresence>
              {activeTab === 'news' && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="text-[8px] font-black mt-3 text-slate-400 uppercase tracking-widest whitespace-nowrap"
                >
                  الأخبار
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        <MobileNavItem icon={<MessageSquare size={24} />} label="الرسائل" active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} />
        <MobileNavItem icon={<MoreHorizontal size={24} />} label="المزيد" active={showMobileMenu} onClick={() => setShowMobileMenu(true)} />
      </div>

      {/* --- Mobile Side Drawer --- */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMobileMenu(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 right-0 bottom-0 w-4/5 max-w-sm bg-white z-[110] shadow-2xl flex flex-col" dir="rtl">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3" onClick={() => { setSelectedProfile(appUser); setShowMobileMenu(false); }}>
                   {appUser?.avatar && <img src={appUser.avatar} className="w-12 h-12 rounded-2xl border-2 border-white shadow-md cursor-pointer" />}
                   <div className="cursor-pointer">
                      <p className="font-black text-slate-800 text-sm">{appUser?.name}</p>
                      <p className="text-[10px] text-blue-600 font-bold uppercase">{appUser?.role === 'employer' ? 'صاحب عمل' : 'باحث عن عمل'}</p>
                   </div>
                </div>
                <button onClick={() => setShowMobileMenu(false)} className="p-2 bg-slate-50 text-slate-400 rounded-xl"><Plus size={20} className="rotate-45" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {appUser?.hasCallsAccess && (
                  <DrawerItem icon={<Phone size={20} className="text-emerald-600" />} label="المكالمات والاتصال" onClick={() => { setActiveTab('calls'); setShowMobileMenu(false); }} />
                )}
                <DrawerItem icon={<Users size={20} />} label="شبكتي المهنية" onClick={() => { setActiveTab('network'); setShowMobileMenu(false); }} />
                {appUser?.hasErpAccess && (
                  <DrawerItem icon={<Building2 size={20} className="text-blue-600" />} label="نظام الموارد البشرية (ERP)" onClick={() => { setActiveTab('erp'); setShowMobileMenu(false); }} />
                )}
                <DrawerItem icon={<Globe size={20} />} label="آخر الأخبار" onClick={() => { setActiveTab('news'); setShowMobileMenu(false); }} />

                {appUser?.isAdmin && (
                  <DrawerItem icon={<Shield size={20} className="text-blue-600" />} label="لوحة التحكم العليا" onClick={() => { setShowAdmin(true); setShowMobileMenu(false); }} />
                )}
                <DrawerItem icon={<Shield size={20} className="text-slate-600" />} label="مركز الأمان والخصوصية" onClick={() => setShowMobileMenu(false)} />
                <div className="border-t border-slate-50 my-4" />
                <DrawerItem icon={<Info size={20} />} label="عن منصة Elevate عراق" onClick={() => setShowMobileMenu(false)} />
                <DrawerItem icon={<LogOut size={20} className="text-red-500" />} label="تسجيل الخروج" onClick={logout} />
              </div>

              <div className="p-6 bg-slate-50 text-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إصدار التجربة الميدانية 2.6.0</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
