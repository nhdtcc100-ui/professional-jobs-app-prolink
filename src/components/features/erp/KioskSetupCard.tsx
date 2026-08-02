import React from 'react';
import { Monitor, ShieldCheck, Smartphone, Laptop } from 'lucide-react';
import { AppUser } from '../../../types';
import { GlassButton } from '../../ui';

interface KioskSetupCardProps {
  appUser: AppUser;
  addToast: (msg: string, type?: any) => void;
  onEnterKiosk: () => void;
}

export const KioskSetupCard: React.FC<KioskSetupCardProps> = ({ appUser, onEnterKiosk }) => {
  return (
    <div className="grid md:grid-cols-2 gap-6 mt-8">
      <div className="p-8 bg-gradient-to-br from-indigo-500/10 to-blue-600/10 rounded-[2.5rem] border border-blue-500/20 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Monitor size={120} />
        </div>
        <div className="relative z-10">
          <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
            <Laptop size={28} />
          </div>
          <h4 className="text-xl font-black text-slate-800 dark:text-white mb-3">هذا الجهاز (المتصفح)</h4>
          <p className="text-xs text-slate-500 font-bold leading-relaxed mb-6">حوّل متصفحك الحالي إلى نقطة حضور دائمة. مثالي لأجهزة الكمبيوتر المكتبية عند مدخل الشركة.</p>
          <GlassButton onClick={onEnterKiosk} className="w-full py-4 rounded-2xl text-xs uppercase tracking-widest">
            تفعيل وضع الكيوسك هنا
          </GlassButton>
        </div>
      </div>

      <div className="p-8 bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Smartphone size={120} />
        </div>
        <div className="relative z-10">
          <div className="w-14 h-14 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg">
            <Smartphone size={28} />
          </div>
          <h4 className="text-xl font-black text-slate-800 dark:text-white mb-3">جهاز لوحي / موبايل</h4>
          <p className="text-xs text-slate-500 font-bold leading-relaxed mb-6">استخدم الرمز السريع لربط جهاز لوحي خارجي بنظام الحضور الخاص بك.</p>
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">كود الربط السريع</p>
              <p className="text-lg font-black text-slate-800 dark:text-white tracking-widest">PRL-{appUser.id.substring(0, 4).toUpperCase()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
