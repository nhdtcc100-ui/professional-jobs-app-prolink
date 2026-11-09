import React from 'react';
import { Info, ArrowLeft, Globe, Sparkles, Building2, ShieldCheck, X, Calendar } from 'lucide-react';
import { GlassCard } from '../ui';
import { AppUser } from '../../types';
import { preloadTab } from '../../lib/lazyPreload';

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
  setActiveTab?: (tab: string) => void;
}

export const HomeSidebar: React.FC<HomeSidebarProps> = ({ appUser, setSelectedProfile, setActiveTab }) => {
  const handleOpenAboutPage = () => {
    if (setActiveTab) {
      setActiveTab('about');
    } else {
      window.dispatchEvent(new CustomEvent('setTab', { detail: 'about' }));
    }
  };

  return (
    <div className="lg:col-span-3 space-y-6 hidden md:block">
      {/* ── About Platform Card (Opens as Full Page View) ── */}
      <GlassCard className="rounded-[2.5rem] border-none shadow-[0_15px_40px_rgba(10,102,194,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 group">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
              <Info size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">نبذة عن المنصة</h3>
              <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-0.5">منظومة التوظيف الرقمية</p>
            </div>
          </div>
          
          <div className="space-y-3 py-1">
            <div className="bg-slate-50/70 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
              <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
                منصة عمل هي الشبكة المهنية الأولى للربط المباشر بين الكفاءات وأصحاب العمل عبر خوارزميات المطابقة الذكية.
              </p>
              <div className="h-0.5 w-full bg-gradient-to-l from-blue-600/50 to-transparent rounded-full mb-2" />
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-relaxed">
                تعرّف على الرؤية، سياسة الخصوصية، وأدوات الدعم المتاحة.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAboutPage}
            onMouseEnter={() => preloadTab('about')}
            onPointerDown={handleOpenAboutPage}
            className="w-full flex items-center justify-between p-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-xs font-black"
          >
            <span className="uppercase tracking-wider">عرض التفاصيل الكاملة</span>
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          </button>
        </div>
      </GlassCard>
    </div>
  );
};
