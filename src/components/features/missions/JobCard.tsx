import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  MapPin, DollarSign, Clock, ArrowLeft, Building2, 
  Send, CheckCircle, XCircle, Bookmark, Sparkles, 
  Briefcase, Shield 
} from 'lucide-react';
import { Job, AppUser } from '../../../types';
import { useAppContext } from '../../../contexts/AppContext';
import { MatchedCandidatesBar } from './MatchedCandidatesBar';

interface JobCardProps {
  job: Job;
  onClick: (job: Job) => void;
  delay?: number;
  compact?: boolean;
  matchScore?: number;
}

export const JobCard = React.memo(({ job, onClick, delay = 0, compact = false, matchScore = 0 }: JobCardProps) => {
  const { allUsers, appUser, setSelectedProfile } = useAppContext();
  
  const employer = React.useMemo(() => allUsers.find(u => u.id === job.employer_id), [allUsers, job.employer_id]);
  const avatarUrl = employer?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company)}&background=0a66c2&color=fff`;
  const coverUrl = job.image_url || employer?.coverUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80';
  const isActive = job.is_active !== false;

  // ── Bookmark state (localStorage) ──────────────────────────────
  const getSaved = () => {
    try { return JSON.parse(localStorage.getItem('prolink_saved_jobs') || '[]') as string[]; } catch { return []; }
  };
  const [isBookmarked, setIsBookmarked] = useState(() => getSaved().includes(job.id));

  const toggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    const saved = getSaved();
    const next = isBookmarked ? saved.filter((id: string) => id !== job.id) : [...saved, job.id];
    localStorage.setItem('prolink_saved_jobs', JSON.stringify(next));
    setIsBookmarked(!isBookmarked);
  };

  const timeAgo = (dateStr: any) => {
    try {
      const d = typeof dateStr?.toDate === 'function' ? dateStr.toDate() : new Date(dateStr);
      const diff = Date.now() - d.getTime();
      const hrs = Math.floor(diff / 3600000);
      if (hrs < 1) return 'منذ لحظات';
      if (hrs < 24) return `منذ ${hrs} ساعة`;
      const days = Math.floor(hrs / 24);
      if (days < 7) return `منذ ${days} يوم`;
      return `منذ ${Math.floor(days / 7)} أسابيع`;
    } catch { return ''; }
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(delay, 0.3), duration: 0.3 }}
        onClick={() => onClick(job)}
        className={`group bg-white dark:bg-slate-800/90 border rounded-[1.5rem] overflow-hidden cursor-pointer transition-all duration-300 active:scale-[0.99] flex items-center p-3 gap-4 border-slate-100 dark:border-slate-700 hover:shadow-md hover:border-blue-100 dark:hover:border-blue-900 ${!isActive && 'opacity-70'}`}
      >
        <div className="w-12 h-12 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900 shrink-0">
          <img src={avatarUrl} alt={job.company} className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-black text-slate-800 dark:text-white text-sm truncate group-hover:text-[#0a66c2] transition-colors">
            {job.title}
          </h4>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] font-bold text-slate-400 truncate">{job.company}</span>
            {job.location && (
              <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                <MapPin size={10} /> {job.location}
              </span>
            )}
            {job.salary && (
              <span className="text-[10px] font-black text-emerald-500">
                {job.salary}
              </span>
            )}
            {matchScore > 0 && (
               <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                 <Sparkles size={10} className="animate-pulse" /> {matchScore}% مطابقة
               </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleBookmark}
            className={`p-1.5 rounded-xl transition-all ${isBookmarked ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-600 border border-transparent dark:border-slate-700'}`}
            title={isBookmarked ? 'إلغاء الحفظ' : 'حفظ الوظيفة'}
          >
            <Bookmark size={13} className={isBookmarked ? 'fill-white' : ''} />
          </button>
          <div className="hidden md:flex flex-col items-end gap-0.5 mr-1">
            <span className="text-[9px] font-black text-slate-300 dark:text-slate-600">{timeAgo(job.postedAt)}</span>
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${isActive ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-100 text-slate-400'}`}>
              {isActive ? 'مفتوح' : 'مغلق'}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm border border-transparent dark:border-slate-700">
            <ArrowLeft size={14} />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(delay, 0.4), duration: 0.4 }}
      onClick={() => onClick(job)}
      className={`group rounded-[2.5rem] overflow-hidden cursor-pointer transition-all duration-700 active:scale-[0.98] flex flex-col h-full bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800
        ${isActive 
          ? 'shadow-[0_15px_40px_rgba(0,0,0,0.03)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-[0_40px_80px_rgba(10,102,194,0.15)] hover:-translate-y-2' 
          : 'opacity-75 hover:opacity-100 shadow-sm'
        }`}
    >
      {/* Top Section: Cover */}
      <div className="relative h-32 shrink-0 overflow-hidden">
        <img 
          src={coverUrl} 
          alt="Cover" 
          className={`w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 ${!isActive ? 'grayscale-[60%]' : ''}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-black/20 to-transparent opacity-80" />
        
        {/* Status Badge — prominently placed */}
        <div className={`absolute top-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border shadow-2xl transition-all duration-500 hover:scale-110 ${
          isActive 
            ? 'bg-emerald-500 text-white border-emerald-400/50 shadow-emerald-500/40' 
            : 'bg-slate-800/90 border-slate-700/50 text-slate-300 shadow-black/40'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
          {isActive ? 'مفتوح للتقديم' : 'مغلق حالياً'}
        </div>

        {/* Job Type Tag */}
        <div className="absolute top-4 left-4">
          <span className="px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-[10px] font-black text-white uppercase tracking-widest shadow-xl transition-all duration-500 hover:bg-white/20 hover:scale-110">
            {job.jobType || 'دوام كامل'}
          </span>
        </div>

        {/* AI Match Badge - Premium Floating */}
        {matchScore > 0 && (
          <div className="absolute bottom-4 left-4 z-20">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 text-white px-5 py-2.5 rounded-2xl shadow-2xl shadow-blue-500/30 flex items-center gap-2.5 border border-white/20 backdrop-blur-md"
            >
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles size={16} className="text-white animate-pulse" />
              </div>
              <div className="flex flex-col -gap-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none">AI Match</span>
                <span className="text-sm font-black leading-tight">طابق {matchScore}%</span>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-7 relative flex-1 pb-7">
        {/* Avatar */}
        <div className="relative -mt-12 mb-5 z-10">
          <div className="w-20 h-20 rounded-[2rem] border-4 border-white dark:border-[#0f172a] bg-white dark:bg-slate-800 shadow-[0_15px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_15px_30px_rgba(0,0,0,0.6)] overflow-hidden group-hover:rotate-[6deg] group-hover:scale-110 group-hover:shadow-[0_20px_40px_rgba(10,102,194,0.4)] transition-all duration-700">
            <img src={avatarUrl} alt={job.company} className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Info */}
        <div className="relative mb-6">
          <div className="absolute -inset-x-7 -inset-y-3 bg-blue-50/50 dark:bg-blue-900/10 border-y border-blue-100/50 dark:border-blue-900/20 -z-0" />
          <div className="relative z-10 space-y-1.5">
            <h4 className="font-black text-slate-800 dark:text-white text-xl leading-tight group-hover:text-[#0a66c2] dark:group-hover:text-blue-400 transition-colors tracking-tight line-clamp-1">
              {job.title}
            </h4>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-black text-xs uppercase tracking-wide">
              <Building2 size={14} className="text-[#0a66c2] dark:text-blue-500" />
              <span className="truncate">{job.company}</span>
            </div>
          </div>
        </div>

        {/* Meta Grid - Upgraded Professional Organised Layout */}
        <div className="grid grid-cols-2 gap-2.5 mt-6">
          <div className="flex items-center gap-2.5 px-3.5 py-3 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all duration-300">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <MapPin size={13} />
            </div>
            <div className="flex flex-col min-w-0">
               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">المكان</span>
               <span className="text-[10px] font-black text-slate-600 dark:text-slate-200 truncate">{job.location || 'عن بُعد'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 py-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/30 dark:border-emerald-900/20">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
              <DollarSign size={13} />
            </div>
            <div className="flex flex-col min-w-0">
               <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">الراتب</span>
               <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 truncate">{job.salary || 'يحدد لاحقاً'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 py-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/30 dark:border-indigo-900/20">
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Clock size={13} />
            </div>
            <div className="flex flex-col min-w-0">
               <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">الساعات</span>
               <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 truncate">{job.working_hours || 'مرن'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 py-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100/30 dark:border-amber-900/20">
            <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
              <Briefcase size={13} />
            </div>
            <div className="flex flex-col min-w-0">
               <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">النوع</span>
               <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 truncate">{job.jobType || 'دوام كامل'}</span>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed mt-5 line-clamp-2">
          {job.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <Clock size={12} className="text-blue-500" />
            <span>{timeAgo(job.postedAt)}</span>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={toggleBookmark}
              className={`p-2.5 rounded-2xl transition-all duration-300 ${
                isBookmarked 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/40' 
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 shadow-sm border border-slate-100 dark:border-slate-700'
              }`}
            >
              <Bookmark size={16} className={isBookmarked ? 'fill-white' : ''} />
            </motion.button>
            <div className={`flex items-center gap-2 text-[11px] font-black transition-all duration-500 group-hover:gap-4 ${isActive ? 'text-[#0a66c2] dark:text-blue-400' : 'text-slate-400'}`}>
              <span className="uppercase tracking-widest">{isActive ? 'تفاصيل العرض' : 'عرض البيانات'}</span>
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30 group-hover:rotate-[-90deg] transition-transform duration-500">
                <ArrowLeft size={16} />
              </div>
            </div>
          </div>
        </div>

        {/* --- Admin's Matching Bar (Exclusive) --- */}
        {appUser?.isAdmin && !compact && (
          <MatchedCandidatesBar 
            job={job} 
            allUsers={allUsers} 
            onUserClick={(user: AppUser) => setSelectedProfile(user)} 
          />
        )}
      </div>
    </motion.div>
  );
});
