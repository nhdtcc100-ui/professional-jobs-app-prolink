import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Rocket, Shield, Target, Award, Globe, Users, Zap } from 'lucide-react';
import { GlassCard } from '../ui';

interface AboutPlatformModalProps {
  show: boolean;
  onClose: () => void;
}

export const AboutPlatformModal: React.FC<AboutPlatformModalProps> = ({ show, onClose }) => {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 md:p-12 overflow-hidden">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" 
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-4xl max-h-[85vh] md:max-h-[90vh] bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 flex flex-col"
            dir="rtl"
          >
            {/* Header */}
            <div className="relative h-48 md:h-64 shrink-0 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80" 
                className="w-full h-full object-cover" 
                alt="ProLink Platform" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900 via-slate-900/40 to-transparent" />
              
              <button 
                onClick={onClose}
                className="absolute top-6 left-6 p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white hover:bg-white/40 transition-all z-20"
              >
                <X size={20} />
              </button>

              <div className="absolute bottom-8 right-8 text-right">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                    <Rocket size={24} />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tighter">عن منصة ProLink</h2>
                </div>
                <p className="text-blue-600 dark:text-blue-400 font-black text-sm uppercase tracking-widest mr-1">المستقبل المهني للعراق يبدأ من هنا</p>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12">
              
              {/* Who are we */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400">
                    <Users size={20} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white">من نحن؟</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  نحن ProLink، المنظومة المهنية الرقمية الأولى والمتكاملة في العراق. انطلقت رؤيتنا لسد الفجوة بين الكفاءات العراقية الصاعدة وبين كبرى الشركات والمؤسسات. نحن لسنا مجرد تطبيق للتوظيف، بل نحن "موطنك المهني" الذي يرافقك من أول خطوة في تعلم مهارة جديدة، وحتى قيادة فريقك الخاص.
                </p>
              </section>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Missions */}
                <section className="space-y-6 p-8 bg-blue-50/50 dark:bg-blue-900/10 rounded-[2.5rem] border border-blue-100/50 dark:border-blue-800/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                      <Target size={20} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">مهامنا</h3>
                  </div>
                  <ul className="space-y-4">
                    {[
                      "رقمنة سوق العمل العراقي بالكامل.",
                      "توفير أدوات ذكاء اصطناعي لربط المواهب بالوظائف.",
                      "بناء جسر تواصل آمن واحترافي بين الشركات والموظفين.",
                      "دعم ريادة الأعمال من خلال أدوات الإدارة المتطورة."
                    ].map((m, i) => (
                      <li key={i} className="flex gap-3 text-sm font-bold text-slate-600 dark:text-slate-400">
                        <span className="text-blue-500">•</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Services */}
                <section className="space-y-6 p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                      <Zap size={20} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">ماذا نقدم؟</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { icon: <Award size={14}/>, t: "التوظيف الذكي", d: "مطابقة فورية مع كبرى الشركات." },
                      { icon: <Shield size={14}/>, t: "نظام ERP متكامل", d: "إدارة الحضور والانصراف بالبصمة." },
                      { icon: <Globe size={14}/>, t: "دورات احترافية", d: "تطوير مهاراتك مع أفضل المدربين." }
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="text-emerald-500">{s.icon}</div>
                        <div>
                          <p className="text-[11px] font-black text-slate-800 dark:text-white">{s.t}</p>
                          <p className="text-[9px] font-bold text-slate-400">{s.d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Contact Professional */}
              <section className="bg-slate-900 dark:bg-blue-950 p-10 rounded-[3rem] text-center space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full" />
                <div className="relative z-10">
                  <h3 className="text-2xl font-black text-white mb-2">تواصل معنا باحترافية</h3>
                  <p className="text-blue-200/70 text-sm font-medium mb-8">فريق الدعم الفني متواجد على مدار الساعة لخدمتكم</p>
                  
                  <div className="flex flex-col md:flex-row justify-center gap-4">
                    <button className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20">
                      مراسلة الدعم الفني
                    </button>
                    <button className="px-8 py-4 bg-white/10 text-white rounded-2xl font-black text-xs hover:bg-white/20 transition-all border border-white/10 backdrop-blur-md">
                      تصفح الأسئلة الشائعة
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Elevate Iraq Ecosystem • Version 4.0.0 • 2026</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
