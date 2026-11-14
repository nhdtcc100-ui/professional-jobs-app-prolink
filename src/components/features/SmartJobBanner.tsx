/**
 * SmartJobBanner.tsx
 * ─────────────────────────────────────────────────────────────────
 * بانر الوظائف الذكي — يُعرض في الرئيسية (Home feed) للباحث عن عمل.
 * يختار أفضل 3 وظائف مطابقة لمسمى المستخدم وموقعه.
 *
 * Props:
 *  • jobs       — كل الوظائف (من AppContext)
 *  • appUser    — المستخدم الحالي
 *  • onJobClick — callback لفتح تفاصيل الوظيفة
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Briefcase, MapPin, Building2, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { filterAndRankJobs, type RankedJob } from '../../lib/services/matchingService';
import type { AppUser, Job } from '../../types';

interface SmartJobBannerProps {
  jobs: Job[];
  appUser: AppUser | null;
  onJobClick: (job: Job) => void;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#3b82f6' : '#f59e0b';

  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg width="48" height="48" className="-rotate-90">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-100 dark:text-slate-700" />
        <circle
          cx="24" cy="24" r={radius}
          fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-slate-700 dark:text-white">
        {score}%
      </span>
    </div>
  );
}

const JobSlide: React.FC<{
  ranked: RankedJob;
  onJobClick: (job: Job) => void;
}> = ({ ranked, onJobClick }) => {
  if (!ranked || !ranked.job) return null;
  const { job, score = 0, reasons = [] } = ranked;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-4 p-4 rounded-2xl bg-white/70 dark:bg-slate-800/50 border border-white dark:border-slate-700/50 backdrop-blur-sm hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onJobClick(job)}
    >
      {/* Company logo / icon */}
      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-100 dark:border-slate-700 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center group-hover:shadow-blue-200/50 transition-shadow">
        {job.image_url ? (
          <img src={job.image_url} alt={job.company} className="w-full h-full object-cover" />
        ) : (
          <Briefcase size={20} className="text-blue-500 dark:text-blue-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-slate-800 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {job.title}
        </p>
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
          <Building2 size={9} className="shrink-0" />
          {job.company}
        </p>
        {job.location && (
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin size={9} className="shrink-0" />
            {job.location}
          </p>
        )}
        {/* Reasons */}
        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {reasons.slice(0, 2).map((r, i) => (
              <span key={i} className="text-[9px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800/30">
                ✓ {r}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Score ring */}
      <ScoreRing score={score} />
    </motion.div>
  );
};

export const SmartJobBanner: React.FC<SmartJobBannerProps> = ({
  jobs,
  appUser,
  onJobClick,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const topJobs = useMemo(() => {
    if (!appUser?.title && !appUser?.location) return [];
    const ranked = filterAndRankJobs(jobs.filter(j => j.is_active !== false), appUser);
    return ranked.filter(r => r.score >= 20).slice(0, 5);
  }, [jobs, appUser]);

  if (dismissed || !topJobs.length || appUser?.role !== 'seeker') return null;

  const prev = () => setActiveIdx(i => (i - 1 + topJobs.length) % topJobs.length);
  const next = () => setActiveIdx(i => (i + 1) % topJobs.length);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ duration: 0.4 }}
      className="rounded-[2rem] overflow-hidden shadow-xl shadow-blue-500/8 border border-blue-100/80 dark:border-blue-900/30 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 relative"
    >
      {/* Decorative glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />

      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-7 h-7 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black text-[13px] tracking-tight leading-none">
              وظائف مقترحة لك
            </p>
            <p className="text-blue-200 text-[10px] font-bold mt-0.5">
              {topJobs.length} وظيفة تناسب ملفك الشخصي
            </p>
          </div>
        </div>

        {/* Navigation dots */}
        <div className="flex items-center gap-1.5">
          {topJobs.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`transition-all duration-300 rounded-full ${
                i === activeIdx
                  ? 'w-5 h-2 bg-white'
                  : 'w-2 h-2 bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X size={13} className="text-white" />
        </button>
      </div>

      {/* Slide */}
      <div className="px-4 pb-4 relative">
        <AnimatePresence mode="wait">
          {(topJobs[activeIdx] || topJobs[0]) && (
            <JobSlide
              key={activeIdx}
              ranked={topJobs[activeIdx] || topJobs[0]}
              onJobClick={onJobClick}
            />
          )}
        </AnimatePresence>

        {/* Prev / Next arrows */}
        {topJobs.length > 1 && (
          <div className="absolute top-1/2 -translate-y-1/2 w-full left-0 flex justify-between px-1 pointer-events-none">
            <button
              onClick={prev}
              className="pointer-events-auto w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-md flex items-center justify-center hover:scale-105 transition-transform active:scale-95 border border-white/50"
            >
              <ChevronRight size={16} className="text-slate-600 dark:text-slate-300" />
            </button>
            <button
              onClick={next}
              className="pointer-events-auto w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-md flex items-center justify-center hover:scale-105 transition-transform active:scale-95 border border-white/50"
            >
              <ChevronLeft size={16} className="text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
