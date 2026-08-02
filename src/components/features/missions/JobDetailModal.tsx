import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MapPin, DollarSign, Tag, FileText, Clock, Briefcase, Zap, XCircle, CheckCircle, MessageSquare } from 'lucide-react';

import { Job } from '../../../types';

// Helper component to format text with clickable links and phone numbers
const FormattedText = ({ text, className }: { text: string, className?: string }) => {
  if (!text) return null;
  const combinedRegex = /(https?:\/\/[^\s]+|\+?[\d\s-]{8,20}\d)/g;
  const parts = text.split(combinedRegex);
  
  return (
    <p className={className} dir="auto">
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.match(/https?:\/\/[^\s]+/)) {
          return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 hover:underline font-bold" onClick={e => e.stopPropagation()}>{part}</a>;
        }
        if (part.match(/\+?[\d\s-]{8,20}\d/) && part.replace(/[\D]/g, '').length >= 8) {
          return <a key={i} href={`tel:${part.replace(/[\s-]/g, '')}`} className="text-emerald-600 hover:text-emerald-800 hover:underline font-black inline-block" dir="ltr" onClick={e => e.stopPropagation()}>{part}</a>;
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
};


interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onApply: (job: Job, text?: string) => void;
  onQuickApply?: (job: Job) => void;
  appUser?: any;
  allUsers?: any[];
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, onClose, onApply, onQuickApply, appUser, allUsers = [] }) => {
  const [applicationText, setApplicationText] = useState('');
  const isActive = job?.is_active !== false;

  const timeAgo = (dateStr: any) => {
    try {
      const d = typeof dateStr?.toDate === 'function' ? dateStr.toDate() : new Date(dateStr);
      const diff = Date.now() - d.getTime();
      const hrs = Math.floor(diff / 3600000);
      if (hrs < 1) return 'منذ لحظات';
      if (hrs < 24) return `منذ ${hrs} ساعة`;
      const days = Math.floor(hrs / 24);
      return days < 7 ? `منذ ${days} يوم` : `منذ ${Math.floor(days / 7)} أسابيع`;
    } catch { return ''; }
  };

  // 📝 Matching Candidates Algorithm (Refined for Title and Residence)
  const matchedCandidates = React.useMemo(() => {
    if (!job || !allUsers.length) return [];
    
    return allUsers
      .filter(u => u.id !== appUser?.id) // Exclude current user
      .map(u => {
        let score = 0;
        const jobTitleLower = job.title.toLowerCase();
        const userRoleLower = (u.role || u.title || '').toLowerCase();
        const userBioLower = (u.bio || '').toLowerCase();
        const jobLocLower = (job.location || '').toLowerCase();
        const userLocLower = (u.location || '').toLowerCase();

        // 1. Title Match (High Priority)
        if (jobTitleLower === userRoleLower) score += 60;
        else if (jobTitleLower.includes(userRoleLower) || userRoleLower.includes(jobTitleLower)) score += 40;
        else if (userBioLower.includes(jobTitleLower)) score += 25;

        // 2. Residence/Location Match (Medium Priority)
        // Check for specific city matches if they are comma separated or simple strings
        const jobCity = jobLocLower.split('،')[0]?.trim() || jobLocLower;
        const userCity = userLocLower.split('،')[0]?.trim() || userLocLower;

        if (jobCity && userCity && (jobCity.includes(userCity) || userCity.includes(jobCity))) {
          score += 40;
        } else if (jobLocLower && userLocLower && (jobLocLower.includes(userLocLower) || userLocLower.includes(jobLocLower))) {
          score += 20;
        }

        // 3. Professional Status
        if (u.isPro) score += 10;

        return { ...u, matchScore: Math.min(score, 100) };
      })
      .filter(u => u.matchScore > 30) // Minimum threshold for relevance
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);
  }, [job, allUsers, appUser?.id]);

  return (
    <AnimatePresence>
      {job && (
        <div className="fixed inset-0 sm:inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 md:p-6 top-[75px] bottom-[85px] sm:top-0 sm:bottom-0" onClick={onClose} dir="rtl">
          {/* Background Dimmer */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" 
          />

          <motion.div
            initial={{ scale: 0.95, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="bg-white dark:bg-[#0f172a] rounded-none sm:rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] max-w-2xl w-full h-full sm:max-h-[90vh] flex flex-col overflow-hidden relative z-10 border-x sm:border border-white/20 dark:border-slate-800"
            onClick={e => e.stopPropagation()}
          >
            {/* Hero Section */}
            <div className="relative shrink-0 overflow-hidden h-52 md:h-64">
              {job.image_url ? (
                <img src={job.image_url} alt={job.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#0a66c2] via-[#0d5ca8] to-[#003d7a] relative overflow-hidden">
                   <div className="absolute inset-0 opacity-10 flex items-center justify-center -rotate-12 scale-150"><Briefcase size={120} className="text-white" /></div>
                   <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/20 to-transparent" />

              <button
                onClick={onClose}
                className="absolute top-6 left-6 p-3 bg-white/10 hover:bg-red-500 text-white rounded-2xl transition-all backdrop-blur-md border border-white/20 z-20 group"
              >
                <X size={20} className="group-hover:rotate-90 transition-transform" />
              </button>

              <div className="absolute bottom-8 right-8 left-8 z-10">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.15em] backdrop-blur-md border mb-4 ${
                  isActive ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-400' : 'bg-slate-700/20 border-slate-600/30 text-slate-300'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                  {isActive ? 'التوظيف متاح الآن' : 'التوظيف مغلق'}
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white drop-shadow-2xl leading-tight tracking-tight">{job.title}</h2>
                <div className="flex items-center gap-3 mt-2">
                   <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white text-[10px] font-black italic">P</div>
                   <p className="font-extrabold text-white/90 text-sm md:text-base">{job.company}</p>
                </div>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-slate-50/30 dark:bg-slate-900/40 no-scrollbar scroll-smooth">
              
              {/* Meta Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                 <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1 shadow-sm">
                    <MapPin size={14} className="text-blue-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">الموقع</span>
                    <span className="text-[11px] font-black text-slate-800 dark:text-white truncate">{job.location || 'عن بُعد'}</span>
                 </div>
                 <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1 shadow-sm">
                    <Tag size={14} className="text-indigo-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">النوع</span>
                    <span className="text-[11px] font-black text-slate-800 dark:text-white truncate">{job.jobType || 'دوام كامل'}</span>
                 </div>
                 <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1 shadow-sm">
                    <DollarSign size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">الراتب</span>
                    <span className="text-[11px] font-black text-slate-800 dark:text-white truncate">{job.salary || 'غير محدد'}</span>
                 </div>
                 <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1 shadow-sm">
                    <Clock size={14} className="text-amber-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">منذ</span>
                    <span className="text-[11px] font-black text-slate-800 dark:text-white truncate">{timeAgo(job.postedAt)}</span>
                 </div>
              </div>

              {/* Job Description */}
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl"><FileText size={16} className="text-blue-600 dark:text-blue-400" /></div>
                   <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">التفاصيل المهنية للمهمة</h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm leading-relaxed">
                  <FormattedText text={job.description || 'لا يوجد وصف مفصّل.'} className="text-[13px] text-slate-600 dark:text-slate-300 font-bold leading-loose whitespace-pre-wrap" />
                </div>
              </div>

              {/* Recruitment AI Matching */}
              {matchedCandidates.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl"><Zap size={16} className="text-emerald-600 dark:text-emerald-400 fill-emerald-500/20" /></div>
                       <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">مرشحون من شبكتك (مطابقة AI)</h3>
                    </div>
                    <div className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[9px] font-black border border-emerald-500/20">خوارزمية ProLink v2.1</div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {matchedCandidates.map((u, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={u.id} 
                        className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center gap-4 shadow-sm hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all group"
                      >
                         <div className="relative shrink-0">
                            <img src={u.avatar || u.avatar_url || 'https://ui-avatars.com/api/?name=' + u.name} className="w-12 h-12 rounded-2xl object-cover shadow-md border-2 border-white dark:border-slate-700" alt={u.name} />
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[9px] font-black border-2 border-white dark:border-slate-700 shadow-xl">8.2</div>
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-slate-800 dark:text-white truncate group-hover:text-emerald-600 transition-colors">{u.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold truncate">{u.title || u.role || 'خبير متخصص'}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                               <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${u.matchScore}%` }} className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" />
                               </div>
                               <span className="text-[9px] font-black text-emerald-500">{u.matchScore}%</span>
                            </div>
                         </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct Application Section */}
              {isActive && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl"><MessageSquare size={16} className="text-indigo-600 dark:text-indigo-400" /></div>
                     <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">رسالة التقديم المباشر</h3>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-indigo-500/5 blur-2xl rounded-3xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <textarea 
                      value={applicationText}
                      onChange={(e) => setApplicationText(e.target.value)}
                      placeholder="اكتب هنا لماذا أنت الأنسب لهذه الوظيفة... (اختياري)"
                      className="relative w-full h-32 bg-white dark:bg-slate-800 rounded-3xl p-6 text-[13px] font-bold text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800 focus:border-indigo-500/50 outline-none shadow-sm transition-all focus:shadow-xl resize-none leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="p-6 md:p-8 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0 rounded-b-[3rem]">
              <button
                onClick={() => onQuickApply?.(job)}
                disabled={!isActive}
                className={`flex items-center justify-center gap-3 py-4 rounded-[1.5rem] font-black text-xs transition-all group ${
                  isActive 
                    ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-900/20 active:scale-95' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-lg group-hover:scale-110 transition-transform ${isActive ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/40' : 'bg-slate-300 text-white'}`}>
                  <Zap size={14} fill="currentColor" />
                </div>
                {isActive ? 'إرسال سريع (بيانات الملف فقط)' : 'مغلق'}
              </button>

              <button
                onClick={() => onApply(job, applicationText)}
                disabled={!isActive}
                className={`flex items-center justify-center gap-3 py-4 rounded-[1.5rem] font-black text-xs transition-all shadow-[0_20px_40px_-10px_rgba(10,102,194,0.3)] hover:shadow-[0_25px_50px_-12px_rgba(10,102,194,0.5)] active:scale-95 ${
                  isActive 
                    ? 'bg-gradient-to-r from-[#0a66c2] to-[#004182] text-white' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 shadow-none cursor-not-allowed'
                }`}
              >
                <Send size={16} />
                {applicationText ? 'إطلاق الطلب مع الرسالة 🚀' : 'تقديم مهني مكتمل'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

