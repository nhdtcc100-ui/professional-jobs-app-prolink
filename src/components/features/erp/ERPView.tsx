import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AppUser } from '../../../types';
import { ERPDashboard } from './ERPDashboard';
import { EmployeeWorkspace } from './EmployeeWorkspace';
import { biometricService } from '../../../lib/services/biometricService';
import { Building2, Monitor, ChevronRight } from 'lucide-react';
import { isJobPoster, isUserAdmin } from '../../../lib/utils/roleUtils';

interface ERPViewProps {
  appUser: AppUser;
  addToast: (msg: string, type?: any) => void;
}

export const ERPView: React.FC<ERPViewProps> = ({ appUser, addToast }) => {
  const [isKiosk, setIsKiosk] = useState(false);
  const [kioskChecked, setKioskChecked] = useState(false);

  const hasAccess = appUser.isAdmin || isUserAdmin(appUser) || isJobPoster(appUser);

  useEffect(() => {
    // Check kiosk status for admin/employer
    if (hasAccess) {
      biometricService.isRegisteredKiosk(appUser.id).then(({ isKiosk: k }) => {
        setIsKiosk(k);
        setKioskChecked(true);
      });
    } else {
      setKioskChecked(true);
    }
  }, [appUser.id, hasAccess]);

  // ✅ Admin & Employers can access the full ERP system
  if (!hasAccess) {
    return (
      <div className="py-20 text-center space-y-3" dir="rtl">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
          <Building2 size={30} className="text-red-500" />
        </div>
        <p className="font-black text-slate-700 dark:text-slate-300">نظام الموارد البشرية</p>
        <p className="text-sm text-slate-400 font-bold max-w-xs mx-auto">
          هذا النظام مخصص لأصحاب العمل والإدارة فقط. حسابك الحالي ليس لديه صلاحية الوصول.
        </p>
      </div>
    );
  }

  if (!kioskChecked) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Employer view: show dashboard (which internally handles kiosk mode toggle)
  return (
    <div className="space-y-6" dir="rtl">
      {/* Hero Banner */}
      {isKiosk && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-l from-emerald-600 to-emerald-700 rounded-[2rem] p-5 border border-emerald-500/30 shadow-xl shadow-emerald-500/10 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center border border-white/20">
              <Monitor size={22} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-white">هذا الجهاز مُفعَّل كنقطة حضور رسمية</p>
              <p className="text-[11px] text-emerald-200 font-bold mt-0.5">يمكن للموظفين تسجيل حضورهم من هنا مباشرة</p>
            </div>
          </div>
          <button
            onClick={() => {
              // ERPDashboard handles this internally via kioskMode state
              // Switch to kiosk tab automatically
              document.getElementById('erp-kiosk-tab')?.click();
            }}
            className="shrink-0 bg-white text-emerald-700 px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 hover:shadow-lg transition-all"
          >
            <Monitor size={16} />
            فتح نظام الحضور
            <ChevronRight size={14} />
          </button>
        </motion.div>
      )}

      {/* ERP Dashboard (full) */}
      <ERPDashboard appUser={appUser} addToast={addToast} />
    </div>
  );
};
