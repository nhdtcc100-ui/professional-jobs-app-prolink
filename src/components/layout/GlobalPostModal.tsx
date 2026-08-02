import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Briefcase, Sparkles } from 'lucide-react';
import { GlassButton } from '../ui';
import { AppUser } from '../../types';

interface GlobalPostModalProps {
  showPostFormGlobal: boolean;
  setShowPostFormGlobal: (show: boolean) => void;
  appUser: AppUser | null;
  setActiveTab: (tab: string) => void;
  addToast: (msg: string) => void;
}

export const GlobalPostModal: React.FC<GlobalPostModalProps> = ({
  showPostFormGlobal,
  setShowPostFormGlobal,
  appUser,
  setActiveTab,
  addToast
}) => {
  return (
    <AnimatePresence>
      {showPostFormGlobal && (
        <div className="fixed top-[75px] bottom-[85px] left-2 right-2 z-[200] flex items-center justify-center" onClick={() => setShowPostFormGlobal(false)} dir="rtl">
          {/* Background Dimmer */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-[2.5rem]" 
          />
          
          <motion.div 
            initial={{ scale: 0.9, y: 30 }} 
            animate={{ scale: 1, y: 0 }} 
            exit={{ scale: 0.9, y: 30 }} 
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-xl w-full overflow-hidden relative z-10 border border-white/20 dark:border-slate-800" 
            onClick={e => e.stopPropagation()} 
          >
            <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex justify-between items-center">
              <h3 className="font-black text-lg">إنشاء منشور أو تحديث جديد</h3>
              <button onClick={() => setShowPostFormGlobal(false)} className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-8">
              {appUser?.role === 'employer' ? (
                <div className="space-y-6">
                  <div className="flex gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                     <div className="p-3 bg-blue-600 text-white rounded-xl"><Briefcase size={24} /></div>
                     <div>
                        <p className="font-black text-blue-800 text-sm">أنت في وضع القائد (صاحب عمل)</p>
                        <p className="text-[10px] text-blue-600 font-bold">يمكنك نشر فرصة عمل جديدة لتصل لآلاف المحترفين.</p>
                     </div>
                  </div>
                  <GlassButton className="w-full py-4" onClick={() => { setActiveTab('jobs'); setShowPostFormGlobal(false); addToast('قم بتعبئة بيانات الوظيفة من هنا 💼'); }}>انتقل لنشر وظيفة</GlassButton>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                     <div className="p-3 bg-indigo-600 text-white rounded-xl"><Sparkles size={24} /></div>
                     <div>
                        <p className="font-black text-indigo-800 text-sm">أنت في وضع العميل (باحث عن عمل)</p>
                        <p className="text-[10px] text-indigo-600 font-bold">شارك أفكارك، إنجازاتك، أو ابحث عن نصيحة مهنية.</p>
                     </div>
                  </div>
                  <GlassButton className="w-full py-4" onClick={() => { setActiveTab('home'); setShowPostFormGlobal(false); addToast('اكتب منشورك من هنا ✍️'); }}>انتقل لنشر منشور</GlassButton>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">تحديث ملفك ونشر أفكارك يساعد في نمو شبكتك المهنية بمعدل 3 أضعاف</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
