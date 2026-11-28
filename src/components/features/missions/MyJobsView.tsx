import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, Trash2, MapPin, Users, Edit3, Eye, ChevronDown, ChevronUp, Lock, Unlock, Loader2 } from 'lucide-react';
import { AppUser, Job } from '../../../types';
import { GlassCard } from '../../ui';
import { JobCandidatesPanel } from './JobCandidatesPanel';
import { useAppContext } from '../../../contexts/AppContext';
import { isJobActive } from '../../../lib/utils/jobCategoryUtils';

interface MyJobsViewProps {
  myPostedJobs: Job[];
  onDeleteJob: (jobId: string) => void;
  onEditJob: (job: Job) => void;
  onViewJob: (job: Job) => void;
  onToggleJobActive?: (job: Job, nextActive: boolean) => Promise<void> | void;
  allUsers: AppUser[];
  onUserClick: (userId: string) => void;
}

export const MyJobsView: React.FC<MyJobsViewProps> = ({ 
  myPostedJobs, onDeleteJob, onEditJob, onViewJob, onToggleJobActive, allUsers, onUserClick 
}) => {
  const { appUser } = useAppContext();
  const [openCandidates, setOpenCandidates] = React.useState<Set<string>>(new Set());
  const [togglingJobId, setTogglingJobId] = React.useState<string | null>(null);

  const openJobsCount = React.useMemo(
    () => myPostedJobs.filter(j => isJobActive(j)).length,
    [myPostedJobs]
  );

  const handleToggleActive = async (job: Job) => {
    if (!onToggleJobActive || togglingJobId) return;
    const nextActive = !isJobActive(job);
    setTogglingJobId(job.id);
    try {
      await onToggleJobActive(job, nextActive);
    } finally {
      setTogglingJobId(null);
    }
  };

  const toggleCandidates = (jobId: string) => {
    setOpenCandidates(prev => {
      const next = new Set(prev);
      next.has(jobId) ? next.delete(jobId) : next.add(jobId);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
         <div>
            <h3 className="font-black text-slate-800 dark:text-white text-lg">إدارة وظائفي المنشورة</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
              لديك {myPostedJobs.length} وظيفة ({openJobsCount} مفتوحة للتقديم • {myPostedJobs.length - openJobsCount} مغلقة)
            </p>
         </div>
         <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-[#0a66c2] dark:text-blue-400 shadow-inner border border-blue-100 dark:border-blue-800/50">
            <Briefcase size={24} />
         </div>
      </div>

      <div className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {myPostedJobs.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-24 text-center bg-white dark:bg-slate-800 rounded-[3.5rem] border-2 border-dashed border-slate-100 dark:border-slate-700 flex flex-col items-center"
            >
               <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/30 rounded-[2rem] flex items-center justify-center mb-5 border border-slate-100 dark:border-slate-700 shadow-inner">
                  <Briefcase size={32} className="text-slate-200 dark:text-slate-600" />
               </div>
               <p className="text-slate-400 dark:text-slate-500 font-black text-xs uppercase tracking-widest">لم تقم بنشر أي وظائف حتى الآن</p>
            </motion.div>
          ) : (
            myPostedJobs.map((job, idx) => {
              const isOpen = openCandidates.has(job.id);
              const isActive = isJobActive(job);
              const isToggling = togglingJobId === job.id;
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <GlassCard className={`rounded-[2.5rem] border shadow-sm hover:shadow-xl transition-all bg-white/90 dark:bg-slate-800/90 overflow-hidden w-full max-w-full box-border ${
                    isActive ? 'border-slate-100 dark:border-slate-700' : 'border-amber-200/80 dark:border-amber-800/40'
                  }`}>
                    {/* ── بيانات الوظيفة ── */}
                    <div className="p-4 md:p-6 flex flex-col gap-4">
                      <div className="flex items-center gap-2 min-w-0 flex-1 w-full">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl flex items-center justify-center text-[#0a66c2] dark:text-blue-400 shrink-0 border border-blue-100 dark:border-blue-800/50 shadow-sm overflow-hidden">
                           {job.image_url ? (
                             <img src={job.image_url} className="w-full h-full object-cover" alt={job.title} />
                           ) : (
                             <Briefcase size={20} />
                           )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-slate-800 dark:text-white text-sm truncate">{job.title}</h4>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black border shrink-0 ${
                              isActive
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                              {isActive ? 'مفتوح للتقديم' : 'التقديم مغلق (الطلبات السابقة محفوظة)'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                              <MapPin size={10} className="text-slate-300 dark:text-slate-600" /> {job.location || 'عن بُعد'}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-500 dark:text-blue-400">
                              <Users size={10} /> {(job as any).applicationsCount ?? (job as any).applicant_ids?.length ?? 0} طلب
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons - wrap on mobile */}
                      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
                        {onToggleJobActive && (
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleActive(job)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border font-bold text-xs transition-all active:scale-95 flex-1 md:flex-none justify-center cursor-pointer disabled:opacity-50 ${
                              isActive
                                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 hover:bg-amber-500 hover:text-white'
                                : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-600 hover:text-white'
                            }`}
                            title={isActive ? 'إغلاق استقبال الطلبات الجديدة (مع بقاء الطلبات السابقة)' : 'إعادة فتح الوظيفة لاستقبال الطلبات'}
                          >
                            {isToggling ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : isActive ? (
                              <Lock size={12} />
                            ) : (
                              <Unlock size={12} />
                            )}
                            <span>{isActive ? 'إغلاق التقديم' : 'إعادة فتح التقديم'}</span>
                          </button>
                        )}

                        {/* زر المرشحين */}
                        <button
                          onClick={() => toggleCandidates(job.id)}
                          className={`flex items-center gap-1 px-3 py-2 rounded-xl border font-bold text-xs transition-all active:scale-95 flex-1 md:flex-none justify-center ${
                            isOpen
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25'
                              : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/40 hover:bg-indigo-600 hover:text-white'
                          }`}
                          title="المرشحون"
                        >
                          <Users size={12} />
                          <span>المرشحون</span>
                          {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>

                        <button 
                          onClick={() => onViewJob(job)}
                          className="p-2 bg-white dark:bg-slate-700 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl border border-slate-100 dark:border-slate-600 transition-all active:scale-90"
                          title="معاينة"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => onEditJob(job)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-[#0a66c2] dark:text-blue-400 hover:bg-[#0a66c2] dark:hover:bg-blue-600 hover:text-white rounded-xl border border-blue-100 dark:border-blue-800/50 transition-all active:scale-95 font-bold text-xs flex-1 md:flex-none justify-center"
                          title="تعديل"
                        >
                          <Edit3 size={12} />
                          <span>تعديل</span>
                        </button>
                        
                        <button 
                          onClick={() => onDeleteJob(job.id)} 
                          className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-600 dark:hover:bg-red-600 hover:text-white rounded-xl border border-red-100 dark:border-red-800/50 transition-all active:scale-95 font-bold text-xs flex-1 md:flex-none justify-center"
                          title="حذف نهائي"
                        >
                          <Trash2 size={12} />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>

                    {/* ── لوحة المرشحين (تظهر عند الضغط) ── */}
                    <AnimatePresence>
                      {isOpen && appUser?.id && (
                        <motion.div
                          key="candidates"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-6 bg-slate-50/70 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700/50">
                            <JobCandidatesPanel
                              job={job}
                              employerId={appUser.id}
                              onUserClick={onUserClick}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </GlassCard>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
