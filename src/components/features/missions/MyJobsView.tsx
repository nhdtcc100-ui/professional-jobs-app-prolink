import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, Trash2, MapPin, Users, Edit3, Eye, Sparkles, ChevronLeft, Search as SearchIcon, Star, MessageCircle } from 'lucide-react';
import { AppUser, Job } from '../../../types';
import { GlassCard } from '../../ui';

interface MyJobsViewProps {
  myPostedJobs: Job[];
  onDeleteJob: (jobId: string) => void;
  onEditJob: (job: Job) => void;
  onViewJob: (job: Job) => void;
  allUsers: AppUser[];
  onUserClick: (userId: string) => void;
}

export const MyJobsView: React.FC<MyJobsViewProps> = ({ 
  myPostedJobs, onDeleteJob, onEditJob, onViewJob, allUsers, onUserClick 
}) => {
  const [selectedJobForMatching, setSelectedJobForMatching] = React.useState<Job | null>(null);

  const calculateUserMatch = (user: AppUser, job: Job) => {
    let score = 0;
    const userTitle = (user.title || '').toLowerCase();
    const jobTitle = (job.title || '').toLowerCase();
    const userLocation = (user.location || '').toLowerCase();
    const jobLocation = (job.location || '').toLowerCase();
    
    // Title similarity (Highest weight)
    if (userTitle === jobTitle) score += 60;
    else if (userTitle.includes(jobTitle) || jobTitle.includes(userTitle)) score += 40;
    
    // Location match
    if (userLocation === jobLocation && userLocation !== '') score += 30;
    
    // Pro status bonus
    if (user.isPro) score += 10;
    
    return Math.min(score, 100);
  };

  const getMatchedUsers = (job: Job) => {
    return (allUsers || [])
      .filter(u => u.role !== 'employer') // Only candidates
      .map(u => ({ user: u, score: calculateUserMatch(u, job) }))
      .filter(m => m.score > 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  };
  if (selectedJobForMatching) {
    const matches = getMatchedUsers(selectedJobForMatching);
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }} 
        animate={{ opacity: 1, x: 0 }} 
        className="space-y-6"
      >
        <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm">
          <button 
            onClick={() => setSelectedJobForMatching(null)}
            className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-slate-400 hover:text-blue-600 transition-all hover:bg-blue-50"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h3 className="font-black text-slate-800 dark:text-white text-lg flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              أفضل المرشحين لوظيفة: {selectedJobForMatching.title}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">تم العثور على {matches.length} مرشح مناسب</p>
          </div>
        </div>

        <div className="grid gap-3">
          {matches.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-700">
               <Users size={40} className="mx-auto text-slate-200 mb-3" />
               <p className="text-slate-400 font-bold text-sm">لا يوجد مرشحون متطابقون حالياً</p>
            </div>
          ) : (
            matches.map((m, idx) => (
              <motion.div
                key={m.user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white dark:bg-slate-800/60 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 flex items-center justify-between group hover:border-blue-500/30 transition-all cursor-pointer"
                onClick={() => onUserClick(m.user.id)}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative">
                    <img 
                      src={m.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user.name)}&background=random`} 
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-md"
                    />
                    <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg">
                      {m.score}%
                    </div>
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors">{m.user.name}</h5>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{m.user.title || 'باحث عن فرصة'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black text-slate-300 flex items-center gap-1">
                        <MapPin size={10} /> {m.user.location || 'غير محدد'}
                      </span>
                      {m.user.isPro && (
                        <span className="text-[8px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded-full font-black border border-amber-500/10 flex items-center gap-1">
                          <Star size={8} fill="currentColor" /> حُسام
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                    <MessageCircle size={16} />
                  </button>
                  <button className="p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-blue-600 transition-all rounded-xl">
                    <ChevronLeft size={16} className="rotate-180" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
         <div>
            <h3 className="font-black text-slate-800 dark:text-white text-lg">إدارة وظائفي المنشورة</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">لديك {myPostedJobs.length} وظيفة نشطة حالياً</p>
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
            myPostedJobs.map((job, idx) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: idx * 0.05 }}
              >
                <GlassCard className="p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm hover:shadow-xl transition-all group bg-white/90 dark:bg-slate-800/90">
                  <div className="flex items-center gap-5 min-w-0 flex-1">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl flex items-center justify-center text-[#0a66c2] dark:text-blue-400 shrink-0 border border-blue-100 dark:border-blue-800/50 shadow-sm">
                       {job.image_url ? (
                         <img src={job.image_url} className="w-full h-full object-cover rounded-2xl" alt={job.title} />
                       ) : (
                         <Briefcase size={24} />
                       )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-slate-800 dark:text-white text-base truncate group-hover:text-[#0a66c2] dark:group-hover:text-blue-400 transition-colors">{job.title}</h4>
                      <div className="flex flex-wrap items-center gap-4 mt-2">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          <MapPin size={12} className="text-slate-300 dark:text-slate-600" /> {job.location || 'عن بُعد'}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider">
                          <Users size={12} /> {idx * 3 + 2} طلب تقديم
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0">
                    <button 
                      onClick={() => setSelectedJobForMatching(job)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white rounded-xl border border-amber-100 dark:border-amber-800/40 transition-all active:scale-95 font-bold text-xs"
                      title="مطابقة المرشحين"
                    >
                      <Sparkles size={14} />
                      <span>مطابقة</span>
                    </button>
                    <button 
                      onClick={() => onViewJob(job)}
                      className="p-3 bg-white dark:bg-slate-700 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-2xl border border-slate-100 dark:border-slate-600 transition-all active:scale-90"
                      title="معاينة"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      onClick={() => onEditJob(job)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/30 text-[#0a66c2] dark:text-blue-400 hover:bg-[#0a66c2] dark:hover:bg-blue-600 hover:text-white rounded-xl border border-blue-100 dark:border-blue-800/50 transition-all active:scale-95 font-bold text-xs"
                      title="تعديل"
                    >
                      <Edit3 size={14} />
                      <span>تعديل</span>
                    </button>
                    
                    <button 
                      onClick={() => onDeleteJob(job.id)} 
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-600 dark:hover:bg-red-600 hover:text-white rounded-xl border border-red-100 dark:border-red-800/50 transition-all active:scale-95 font-bold text-xs"
                      title="حذف نهائي"
                    >
                      <Trash2 size={14} />
                      <span>حذف</span>
                    </button>
                  </div>
                </GlassCard>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
