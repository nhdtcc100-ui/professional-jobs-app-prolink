import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { User, Sparkles, ChevronRight } from 'lucide-react';
import { AppUser, Job } from '../../../types';

interface MatchedCandidatesBarProps {
  job: Job;
  allUsers: AppUser[];
  onUserClick: (user: AppUser) => void;
}

export const MatchedCandidatesBar: React.FC<MatchedCandidatesBarProps> = ({ job, allUsers, onUserClick }) => {
  const matches = useMemo(() => {
    if (!job || !allUsers.length) return [];

    // Filter only seekers
    const seekers = allUsers.filter(u => u.role === 'seeker');

    const jobTitle = (job.title || '').toLowerCase();
    const jobReqs = (job.requirements || job.description || '').toLowerCase();

    return seekers.map(user => {
      let score = 0;
      const userTitle = (user.title || '').toLowerCase();
      const userBio = (user.bio || '').toLowerCase();
      const userSkills = (user.skills || []).map(s => s.toLowerCase());

      // 1. Title Similarity (High weight)
      if (userTitle && jobTitle.includes(userTitle) || userTitle.includes(jobTitle)) score += 40;
      
      // 2. Skills match
      const skillsMatch = userSkills.filter(skill => 
        jobTitle.includes(skill) || jobReqs.includes(skill)
      ).length;
      score += Math.min(skillsMatch * 10, 40);

      // 3. Bio keyword match
      if (userBio) {
        const keywords = jobTitle.split(' ');
        const matches = keywords.filter(k => k.length > 3 && userBio.includes(k)).length;
        score += Math.min(matches * 5, 20);
      }

      return { user, score };
    })
    .filter(m => m.score > 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  }, [job, allUsers]);

  if (matches.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Sparkles size={12} className="text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>
          <h5 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">
            مرشحون مقترحون لك
          </h5>
        </div>
        <span className="text-[9px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-full">
          {matches.length} نتائج
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
        {matches.map(({ user, score }) => (
          <motion.div
            key={user.id}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => { e.stopPropagation(); onUserClick(user); }}
            className="flex flex-col items-center gap-1.5 min-w-[70px] snap-start group"
          >
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl blur-[2px] opacity-0 group-hover:opacity-40 transition-opacity" />
              <img
                src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
                className="relative w-12 h-12 rounded-xl border-2 border-white dark:border-slate-800 object-cover shadow-sm group-hover:shadow-md transition-all"
                alt={user.name}
              />
              <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[7px] font-black px-1 rounded-md border border-white dark:border-slate-800 shadow-sm leading-none py-0.5">
                {score}%
              </div>
            </div>
            <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 truncate w-full text-center">
              {user.name.split(' ')[0]}
            </span>
          </motion.div>
        ))}
        
        <div className="flex items-center justify-center min-w-[40px] snap-start">
           <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors">
              <ChevronRight size={14} />
           </div>
        </div>
      </div>
    </div>
  );
};
