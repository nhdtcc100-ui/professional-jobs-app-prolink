import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Building2, Clock, DollarSign, Briefcase } from 'lucide-react';
import { erpService } from '../../../lib/services/erpService';

interface EmployeeOnboardingModalProps {
  show: boolean;
  onClose: () => void;
  app: any; // The selected job application
  employerId: string;
  addToast: (msg: string, type?: any) => void;
}

export const EmployeeOnboardingModal: React.FC<EmployeeOnboardingModalProps> = ({ show, onClose, app, employerId, addToast }) => {
  const [salary, setSalary] = useState('');
  const [department, setDepartment] = useState('');
  const [hours, setHours] = useState('');
  const [loading, setLoading] = useState(false);

  const handleHire = async () => {
    if (!salary || !department || !hours) {
      addToast('يرجى تعبئة كافة الحقول المطلوبة', 'error');
      return;
    }

    setLoading(true);
    const { error } = await erpService.hireEmployee({
      employer_id: employerId,
      user_id: app.applicant_id,
      job_id: app.job_id,
      salary,
      department,
      working_hours: hours
    });
    setLoading(false);

    if (error) {
      addToast('فشل تعيين الموظف: ' + error.message, 'error');
    } else {
      addToast('✅ تم التعيين بنجاح! يمكن للموظف الآن استخدام نظام البصمة.');
      onClose();
    }
  };

  if (!show || !app) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
        dir="rtl"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 dark:border-slate-700"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex justify-between items-center text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl"><Briefcase size={20} /></div>
              <div>
                <h2 className="text-sm font-black">تعيين موظف جديد (ERP)</h2>
                <p className="text-[10px] text-blue-100 font-bold">نظام الموارد البشرية</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
              <img src={app.applicant_data?.avatar || 'https://ui-avatars.com/api/?background=random'} className="w-12 h-12 rounded-xl object-cover" />
              <div>
                <p className="text-xs font-black text-slate-800 dark:text-white">{app.applicant_data?.name}</p>
                <p className="text-[10px] text-slate-500 font-bold mt-1">المرشح لوظيفة: {app.job?.title}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <DollarSign size={12} className="text-emerald-500" /> الراتب المتفق عليه
                </label>
                <input
                  type="text"
                  placeholder="مثال: 1,500,000 دينار"
                  value={salary}
                  onChange={e => setSalary(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all dark:text-white"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <Building2 size={12} className="text-blue-500" /> القسم أو الإدارة
                </label>
                <input
                  type="text"
                  placeholder="مثال: قسم المبيعات"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all dark:text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <Clock size={12} className="text-amber-500" /> ساعات العمل
                </label>
                <input
                  type="text"
                  placeholder="مثال: من 9 صباحاً إلى 5 مساءً"
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all dark:text-white"
                />
              </div>
            </div>

            <button
              onClick={handleHire}
              disabled={loading}
              className="w-full mt-4 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-black hover:shadow-[0_8px_25px_rgba(37,99,235,0.3)] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? 'جاري التعيين...' : 'إضافة الموظف للنظام (ERP)'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
