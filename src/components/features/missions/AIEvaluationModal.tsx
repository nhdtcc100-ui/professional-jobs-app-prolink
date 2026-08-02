import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, BrainCircuit, CheckCircle, X, Target, ShieldCheck } from 'lucide-react';
import { aiService } from '../../../lib/services/aiService';

interface AIEvaluationModalProps {
  application: any;
  onClose: () => void;
}

export function AIEvaluationModal({ application, onClose }: AIEvaluationModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [aiData, setAiData] = useState<any>(null);

  useEffect(() => {
    // 1. Progress Bar Animation
    const interval = setInterval(() => {
      setProgress(prev => Math.min(prev + 2, 95)); // Stop at 95% until AI finishes
    }, 50);

    // 2. Fetch Real AI Data
    const fetchAI = async () => {
      const data = await aiService.evaluateApplicantCV(
        application.jobTitle, 
        application.requirements || '', 
        application.cv_url, 
        application.skills || []
      );
      setAiData(data);
      setProgress(100);
      setTimeout(() => setIsAnalyzing(false), 500); // Small delay after hitting 100%
      clearInterval(interval);
    };

    fetchAI();
    return () => clearInterval(interval);
  }, [application]);

  const score = aiData?.score || 0;
  const isGoodMatch = score > 70;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm" onClick={onClose} dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative border border-white dark:border-slate-700"
      >
        <button onClick={onClose} className="absolute top-4 left-4 p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full z-10 transition-colors shadow-sm">
          <X size={18} className="text-slate-500 dark:text-slate-300" />
        </button>

        {isAnalyzing ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-slate-100 dark:border-slate-700 flex items-center justify-center relative z-10 bg-white dark:bg-slate-800 shadow-xl shadow-purple-100 dark:shadow-purple-900/20">
                <BrainCircuit size={40} className="text-purple-600 dark:text-purple-400 animate-pulse" />
              </div>
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-4px] rounded-full border-t-4 border-purple-500 border-r-4 border-transparent"
              />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2">
                <Sparkles size={20} className="text-purple-500" /> الذكاء الاصطناعي يقوم بتحليل السيرة الذاتية
              </h3>
              <p className="text-sm text-slate-400 dark:text-slate-500 font-bold">نقوم الآن بمطابقة خبرات {application.applicantName} مع متطلبات الوظيفة...</p>
            </div>

            <div className="w-64 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
              <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full transition-all duration-75" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full max-h-[85vh] overflow-y-auto no-scrollbar">
            {/* Header Result */}
            <div className="p-8 text-center relative overflow-hidden bg-gradient-to-b from-purple-50 to-white dark:from-purple-900/10 dark:to-slate-800">
              <div className="w-32 h-32 mx-auto relative mb-4">
                 <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90 drop-shadow-xl">
                    <path
                      className="text-slate-100 dark:text-slate-700"
                      strokeWidth="3"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <motion.path
                      initial={{ strokeDasharray: "0, 100" }}
                      animate={{ strokeDasharray: `${score}, 100` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className={isGoodMatch ? "text-emerald-500" : "text-amber-500"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-slate-800 dark:text-white">{score}%</span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">التطابق</span>
                 </div>
              </div>
              
              <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
                {isGoodMatch ? 'متقدم ممتاز!' : 'تطابق متوسط'}
              </h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                {isGoodMatch 
                  ? `بناءً على تحليل السيرة الذاتية، يمتلك ${application.applicantName} المهارات والخبرات الأساسية للنجاح في هذا الدور.`
                  : `يمتلك المتقدم بعض المهارات المطلوبة، لكن هناك فجوات في المتطلبات الأساسية للوظيفة.`}
              </p>
            </div>

            {/* Analysis Details */}
            <div className="p-6 space-y-6 flex-1 bg-white dark:bg-slate-800">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-800/30 shadow-sm">
                  <h4 className="flex items-center gap-2 text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-4">
                    <CheckCircle size={16} className="text-emerald-500" /> نقاط القوة
                  </h4>
                  <ul className="space-y-3">
                    {aiData?.strengths?.length > 0 ? (
                      aiData.strengths.map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          {s}
                        </li>
                      ))
                    ) : (
                      <li className="text-[11px] font-bold text-slate-500 dark:text-slate-500">جاري تحليل نقاط القوة...</li>
                    )}
                  </ul>
                </div>

                {/* Weaknesses / Gaps */}
                <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl p-5 border border-amber-100 dark:border-amber-800/30 shadow-sm">
                  <h4 className="flex items-center gap-2 text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest mb-4">
                    <Target size={16} className="text-amber-500" /> فجوات المهارة أو التناقضات
                  </h4>
                  <ul className="space-y-3">
                    {aiData?.weaknesses?.length > 0 ? (
                      aiData.weaknesses.map((w: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          {w}
                        </li>
                      ))
                    ) : (
                      <li className="text-[11px] font-bold text-slate-500 dark:text-slate-500">لم يجد الذكاء الاصطناعي فجوات واضحة.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Summary Bottom */}
              <div className="bg-slate-50 dark:bg-slate-700/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 flex gap-4 items-start shadow-sm">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl shrink-0 border border-purple-200 dark:border-purple-800/50">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-white mb-1">تقرير الذكاء الاصطناعي النهائي</h4>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                    {aiData?.summary || "جاري توليد التقرير النهائي..."}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-slate-50 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-center flex items-center justify-center gap-2">
               <Sparkles size={12} className="text-purple-400" />
               <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                 هذا التقييم تم إنشاؤه تلقائياً كتحليل مبدئي ولا يُغني عن المراجعة البشرية.
               </span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
