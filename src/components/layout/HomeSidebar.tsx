import React from 'react';
import { Sparkles, Shield, X, Calendar } from 'lucide-react';
import { GlassCard } from '../ui';
import { SidebarLink } from './Navigation';
import { AppUser } from '../../types';

interface NewsDetailModalProps {
  item: any;
  onClose: () => void;
}

export const NewsDetailModal: React.FC<NewsDetailModalProps> = ({ item, onClose }) => {
  const formattedDate = item.date ? new Date(item.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative p-8">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
          <X size={20} />
        </button>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800/30">
              {item.category || 'أخبار المهنيين'}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <Calendar size={12} />
              {formattedDate}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white leading-tight">
            {item.title}
          </h1>
        </div>
      </div>
    </div>
  );
};

interface HomeSidebarProps {
  appUser: AppUser | null;
  setSelectedProfile: (user: AppUser) => void;
}

export const HomeSidebar: React.FC<HomeSidebarProps> = ({ appUser, setSelectedProfile }) => {
  return (
    <div className="lg:col-span-3 space-y-6 hidden md:block">
      {/* ── About Platform Fixed Section ── */}
      <GlassCard className="rounded-[2.5rem] border-none shadow-[0_15px_40px_rgba(10,102,194,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800/50">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">منصة ProLink العراق</h3>
              <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">المستقبل الرقمي للمهنيين</p>
            </div>
          </div>
          
          <div className="space-y-3 py-2">
            <div className="bg-slate-50/50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
              <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 leading-relaxed mb-2">منظومة رقمية متكاملة لربط الكفاءات العراقية بكبرى الشركات.</p>
              <div className="h-0.5 w-full bg-gradient-to-l from-blue-600/50 to-transparent rounded-full mb-2" />
              <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 leading-relaxed">نهدف لرقمنة سوق العمل العراقي ودعم التحول الرقمي الشامل.</p>
            </div>
          </div>
        </div>
      </GlassCard>
      <GlassCard className="rounded-[2.5rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden group hover:shadow-[0_40px_80px_rgba(10,102,194,0.1)] transition-all duration-700">
        <div className="h-20 bg-gradient-to-br from-[#0a66c2] via-[#004182] to-[#002d5b] flex items-center justify-center relative overflow-hidden">
           <div className="absolute inset-0 bg-blue-400/20 blur-2xl animate-pulse" />
           <div className="w-20 h-20 rounded-full border-4 border-white dark:border-slate-900 bg-white dark:bg-slate-800 shadow-2xl -mb-16 z-10 overflow-hidden group-hover:scale-110 transition-transform duration-700">
            {appUser?.avatar ? (
              <img src={appUser.avatar} className="w-full h-full object-cover" alt="Me" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xl">
                {appUser?.name?.[0]}
              </div>
            )}
          </div>
        </div>
        <div className="pt-14 pb-6 px-6 text-center border-b border-slate-50 dark:border-slate-800">
          <h2 
            onClick={() => appUser && setSelectedProfile(appUser)}
            className="text-lg font-black text-slate-800 dark:text-white hover:text-blue-600 transition-colors cursor-pointer"
          >
            {appUser?.name}
          </h2>
          <div className="text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1.5 flex items-center justify-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {appUser?.role === 'employer' ? 'مدير مهام @ المقر' : 'عميل ميداني نخبة'}
          </div>
        </div>
        
        <div className="py-4 px-6 border-b border-slate-50 dark:border-slate-800 space-y-3">
          <div className="flex justify-between items-center group/stat cursor-pointer">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight">مشاهدات الإشارة</span>
            <span className="text-sm font-black text-blue-600 group-hover/stat:scale-125 transition-transform">142</span>
          </div>
          <div className="flex justify-between items-center group/stat cursor-pointer">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight">التفاعلات</span>
            <span className="text-sm font-black text-blue-600 group-hover/stat:scale-125 transition-transform">2.4k</span>
          </div>
        </div>
        
        <div
          onClick={() => appUser && setSelectedProfile(appUser)}
          className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs font-black text-slate-600 dark:text-slate-300 flex items-center justify-center gap-3 transition-all active:scale-95"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shadow-sm">
            <Sparkles size={16} className="text-amber-500 animate-spin-slow" />
          </div>
          <span className="uppercase tracking-widest">تعزيز حالة النخبة</span>
        </div>

        {/* --- Super Admin Quick Access --- */}
        {appUser?.isAdmin && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-blue-50/30 dark:bg-blue-900/10">
             <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-500/20 cursor-pointer hover:scale-105 transition-transform"
               onClick={() => {
                 // Open ERP or Admin dashboard
                 // We can trigger a tab change if needed, but for now just show it's there
                 window.dispatchEvent(new CustomEvent('setTab', { detail: 'erp' }));
               }}
             >
                <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Shield size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white uppercase tracking-tighter">لوحة التحكم العليا</p>
                  <p className="text-[9px] text-blue-100 font-bold">كامل الصلاحيات مفعلة</p>
                </div>
             </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="rounded-[2.5rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] sticky top-24 overflow-hidden">
        <div className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 dark:border-slate-800">المجموعات الأخيرة</div>
        <div className="px-4 py-4 space-y-3">
          <SidebarLink label="مجرة ريأكت" />
          <SidebarLink label="حدود التصميم" />
          <SidebarLink label="إعلانات المقر" />
        </div>
        <div className="border-t border-slate-50 dark:border-slate-800 p-4 text-[10px] font-black text-blue-600 text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-all uppercase tracking-widest">
          اكتشاف المزيد من المجرات
        </div>
      </GlassCard>
    </div>
  );
};
