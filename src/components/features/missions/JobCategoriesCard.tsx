import React, { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, RotateCcw, Sparkles, Wrench } from 'lucide-react';
import { Job } from '../../../types';
import { JOB_CATEGORIES, getJobCategory, normalizeArabic } from '../../../lib/utils/jobCategoryUtils';

interface JobCategoriesCardProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  jobs: Job[];
}

const ALL_ITEM = {
  id: 'الكل',
  label: 'الكل',
  desc: 'جميع الفرص',
  Icon: Layers,
  gradient: 'from-blue-600 to-indigo-600',
  emoji: '✨',
};

const SERVICES_ITEM = {
  id: 'services',
  label: 'سوق الخدمات',
  desc: 'المهن والعمل الحر',
  Icon: Wrench,
  gradient: 'from-amber-500 to-orange-500',
  emoji: '🔧',
};

export const JobCategoriesCard: React.FC<JobCategoriesCardProps> = ({
  selectedCategory,
  onSelectCategory,
  jobs,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Count per category using normalized extraction
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { 'الكل': jobs.length, 'services': 0 };
    JOB_CATEGORIES.forEach(cat => { counts[cat.id] = 0; });
    jobs.forEach(job => {
      const cat = getJobCategory(job);
      if (counts[cat] !== undefined) {
        counts[cat] += 1;
      } else {
        counts['أخرى'] = (counts['أخرى'] || 0) + 1;
      }
    });
    return counts;
  }, [jobs]);

  const allItems = [ALL_ITEM, SERVICES_ITEM, ...JOB_CATEGORIES];

  const handleSelect = useCallback((id: string) => {
    try { navigator.vibrate?.([8]); } catch (_) {}
    const isCurrentlySelected = id === selectedCategory || (id !== 'الكل' && normalizeArabic(selectedCategory) === normalizeArabic(id));
    onSelectCategory(isCurrentlySelected && id !== 'الكل' ? 'الكل' : id);
  }, [selectedCategory, onSelectCategory]);

  return (
    <div
      className="relative rounded-[26px] overflow-hidden mb-4 mx-1 sm:mx-0 transition-all duration-300"
      style={{
        background: 'rgba(255, 255, 255, 0.78)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03)',
      }}
      dir="rtl"
    >
      {/* Dark mode glass backdrop overlay */}
      <div className="absolute inset-0 dark:bg-slate-900/85 pointer-events-none transition-colors" />

      {/* Decorative ambient gradient orbs */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      {/* Internal Content Container */}
      <div className="relative z-10 p-3.5 sm:p-5">
        
        {/* ── Card Header Row ── */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
                <Sparkles size={15} />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                أقسام وتصنيفات الوظائف
              </h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                {selectedCategory === 'الكل'
                  ? `${jobs.length} فرصة عمل متاحة`
                  : selectedCategory === 'services'
                    ? 'سوق الخدمات والمهن الحرة والباحثين عن عمل 🔧'
                    : `${categoryCounts[selectedCategory] || 0} فرصة متاحة في تخصص "${selectedCategory}"`}
              </p>
            </div>
          </div>

          {selectedCategory !== 'الكل' && (
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              onClick={() => onSelectCategory('الكل')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all active:scale-95 cursor-pointer shadow-xs no-global-btn"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <RotateCcw size={11} />
              عرض الكل
            </motion.button>
          )}
        </div>

        {/* ── Category Icons Row: Clean, Transparent, NO white cards behind icons ── */}
        <div
          ref={scrollRef}
          className="flex items-center gap-2 overflow-x-auto py-2.5 px-1.5 no-scrollbar scroll-smooth"
          style={{
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {allItems.map((cat, idx) => {
            const isSelected = selectedCategory === cat.id || (cat.id !== 'الكل' && normalizeArabic(selectedCategory) === normalizeArabic(cat.id));
            const count = categoryCounts[cat.id] ?? 0;
            const IconComp = cat.Icon;

            return (
              <motion.button
                key={cat.id}
                data-category-btn=""
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, type: 'spring', stiffness: 450, damping: 30 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => handleSelect(cat.id)}
                // تم إزالة الكارد الأبيض تماماً من خلف كل أيقونة (شفاف وأنيق وبدون أي كارد مستطيل أبيض)
                className="group relative shrink-0 flex flex-col items-center justify-center p-2 rounded-2xl cursor-pointer select-none transition-all duration-200 bg-transparent border-0 shadow-none no-global-btn"
                style={{
                  minWidth: 68,
                  scrollSnapAlign: 'start',
                }}
                aria-label={cat.label}
              >
                {/* Active subtle background glow — no boxy white card */}
                {isSelected && (
                  <motion.div
                    layoutId="category-active-pill"
                    className="absolute inset-0 rounded-2xl bg-gradient-to-b from-blue-600/10 to-indigo-600/15 dark:from-blue-500/20 dark:to-indigo-500/25 border border-blue-500/25 pointer-events-none"
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  />
                )}

                {/* Icon / Emoji Container — Clean, floating directly without white card box */}
                <div className="relative mb-1 flex items-center justify-center">
                  {cat.id === 'الكل' ? (
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                    }`}>
                      <IconComp size={22} strokeWidth={isSelected ? 2.4 : 2} />
                    </div>
                  ) : (
                    <span className="text-3xl leading-none select-none filter drop-shadow-xs transition-transform group-hover:scale-110">
                      {(cat as any).emoji}
                    </span>
                  )}

                  {/* Clean Count Pill floating at top corner */}
                  {count > 0 && (
                    <span
                      className={`absolute -top-1 -right-2 text-[9px] font-black px-1.5 py-0.2 rounded-full border shadow-xs ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700'
                      }`}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-[11px] font-black tracking-tight leading-tight transition-colors text-center ${
                    isSelected
                      ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                      : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'
                  }`}
                >
                  {cat.label}
                </span>

                {/* Active Indicator Underline Dot */}
                {isSelected && (
                  <motion.div
                    layoutId="category-active-dot"
                    className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1"
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* ── Active Filter Announcement Bar ── */}
        <AnimatePresence>
          {selectedCategory !== 'الكل' && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="flex items-center justify-between px-3.5 py-2 rounded-2xl shadow-xs"
                style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.18)',
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping shrink-0" />
                  <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                    {selectedCategory === 'services' ? 'تم فتح «سوق الخدمات والمهن الحرة» 🔧' : `تم تطبيق فلتر «${selectedCategory}»`}
                  </p>
                </div>
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-white/80 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60 shadow-xs">
                  {selectedCategory === 'services' ? 'سوق المهن' : `${categoryCounts[selectedCategory] || 0} فرصة معروضة`}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
