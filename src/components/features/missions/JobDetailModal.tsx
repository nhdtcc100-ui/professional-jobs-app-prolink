import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Send, MapPin, DollarSign, Tag, FileText, Clock, Briefcase, MessageSquare, Home } from 'lucide-react';

import { Job } from '../../../types';
import { safeTimeAgo } from '../../../lib/utils/formatDate';
import { BilingualSmartText } from '../../../lib/utils/bilingualText';
import { JobCandidatesPanel } from './JobCandidatesPanel';
import { useAppContext } from '../../../contexts/AppContext';
import { getJobCategory, cleanJobDescription } from '../../../lib/utils/jobCategoryUtils';

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onApply: (job: Job, text?: string) => void;
  onQuickApply?: (job: Job) => void;
  onNavigateHome?: () => void;
  appUser?: any;
  allUsers?: any[];
  onUserClick?: (userId: string) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, onClose, onApply, onNavigateHome, appUser: propAppUser, allUsers = [], onUserClick: propOnUserClick }) => {
  const { appUser: contextAppUser, setSelectedProfile, allUsers: contextAllUsers } = useAppContext();
  const appUser = propAppUser || contextAppUser;
  const usersList = allUsers.length > 0 ? allUsers : contextAllUsers;
  const [applicationText, setApplicationText] = useState('');
  const isActive = job?.is_active !== false;

  // 🛡️ Mobile & Browser Back-Button Handling
  React.useEffect(() => {
    if (job) {
      window.history.pushState({ modal: 'job-detail' }, '');
      const handlePop = () => onClose();
      window.addEventListener('popstate', handlePop);
      return () => window.removeEventListener('popstate', handlePop);
    }
  }, [job, onClose]);

  // Only block the actual job publisher from applying — admins CAN apply
  const isPublisher = !!(appUser && !appUser.isAdmin && (appUser.id === job?.employer_id || appUser.id === (job as any)?.employerId || appUser.id === (job as any)?.authorId || appUser.id === (job as any)?.author_id));
  const isEmployer = !!(appUser && !appUser.isAdmin && appUser.role === 'employer');

  if (!job) return null;

  const publisher = allUsers.find((u: any) => u.id === (job.employer_id || (job as any).employerId || (job as any).author_id || (job as any).authorId)) ||
                    (appUser && (appUser.id === job.employer_id || appUser.id === (job as any).employerId) ? appUser : null);
  const heroCover = job.image_url || publisher?.coverUrl || (publisher as any)?.cover_url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] z-[220] bg-white dark:bg-slate-900 flex flex-col overflow-hidden"
      dir="rtl"
    >
      <div className="flex flex-col w-full h-full max-w-3xl mx-auto relative overflow-hidden">

        {/* ── Hero Header ── */}
        <div className="relative shrink-0 overflow-hidden" style={{ minHeight: '180px' }}>
          {heroCover ? (
            <img src={heroCover} alt={job.title} className="w-full h-full object-cover absolute inset-0" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0a66c2] via-[#0d5ca8] to-[#003d7a] absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 opacity-10 flex items-center justify-center -rotate-12 scale-150"><Briefcase size={120} className="text-white" /></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/30 to-transparent" />

          {/* Navigation Buttons — top right (RTL) */}
          <div
            className="absolute flex items-center gap-2 z-20"
            style={{ top: 'max(env(safe-area-inset-top, 0px), 16px)', right: '16px' }}
          >
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-2xl text-xs font-black transition-all backdrop-blur-md"
            >
              <ArrowRight size={16} />
              رجوع
            </button>
            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-2xl text-xs font-black transition-all backdrop-blur-md"
              >
                <Home size={15} />
                الرئيسية
              </button>
            )}
          </div>

          <div className="absolute bottom-6 right-6 left-6 z-10">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.15em] backdrop-blur-md border mb-3 ${
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

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/50 dark:bg-slate-900/60 custom-scrollbar">

          {/* Meta Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col gap-1 shadow-sm">
              <MapPin size={14} className="text-blue-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">الموقع</span>
              <span className="text-[11px] font-black text-slate-800 dark:text-white truncate">{job.location || 'عن بُعد'}</span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col gap-1 shadow-sm">
              <Tag size={14} className="text-purple-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">القسم</span>
              <span className="text-[11px] font-black text-purple-600 dark:text-purple-400 truncate">{getJobCategory(job)}</span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col gap-1 shadow-sm">
              <Briefcase size={14} className="text-indigo-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">النوع</span>
              <span className="text-[11px] font-black text-slate-800 dark:text-white truncate">{job.jobType || 'دوام كامل'}</span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col gap-1 shadow-sm">
              <DollarSign size={14} className="text-emerald-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">الراتب</span>
              <span className="text-[11px] font-black text-slate-800 dark:text-white truncate">{job.salary || 'غير محدد'}</span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col gap-1 shadow-sm">
              <Clock size={14} className="text-amber-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">منذ</span>
              <span className="text-[11px] font-black text-slate-800 dark:text-white truncate">{safeTimeAgo(job.postedAt || (job as any).created_at)}</span>
            </div>
          </div>

          {/* Job Description */}
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl"><FileText size={16} className="text-blue-600 dark:text-blue-400" /></div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">التفاصيل المهنية للوظيفة</h3>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm leading-relaxed">
              <BilingualSmartText text={cleanJobDescription(job.description) || 'لا يوجد وصف مفصّل.'} className="space-y-3" />
            </div>
          </div>
        </div>

        {/* ── Footer Apply Button ── */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-2.5" style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 80px), 96px)' }}>
          <button
            onClick={() => onApply(job, applicationText)}
            disabled={!isActive || isPublisher || isEmployer}
            className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-sm transition-all active:scale-[0.98] ${
              isPublisher
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-400/30 cursor-not-allowed shadow-none'
                : isActive
                ? 'bg-gradient-to-r from-[#0a66c2] via-[#0052a3] to-[#004182] text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/30 hover:brightness-110'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 shadow-none cursor-not-allowed'
            }`}
          >
            {isPublisher ? (
              <span>أنت ناشر هذه الوظيفة 🏢 (لا يمكنك التقديم)</span>
            ) : isEmployer ? (
              <span>أصحاب العمل لا يمكنهم التقديم (للباحثين عن عمل فقط) 💼</span>
            ) : (
              <>
                <Send size={18} />
                <span>التقديم المهني على الوظيفة 🚀</span>
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onNavigateHome ? onNavigateHome : onClose}
              className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
            >
              <Home size={14} className="text-blue-500" />
              <span>العودة للرئيسية</span>
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
            >
              <ArrowRight size={14} className="text-indigo-500" />
              <span>رجوع للمكان السابق</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
