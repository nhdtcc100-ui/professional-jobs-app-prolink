import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { 
  ArrowRight, Briefcase, MapPin, DollarSign, 
  Tag, Clock, Send, Calendar, ExternalLink, Sparkles,
  FileText, Home, Newspaper, ChevronDown
} from 'lucide-react';
import { Job, AppUser } from '../../types';
import { safeTimeAgo } from '../../lib/utils/formatDate';
import { BilingualSmartText } from '../../lib/utils/bilingualText';
import { useAppContext } from '../../contexts/AppContext';
import { getJobCategory, cleanJobDescription } from '../../lib/utils/jobCategoryUtils';
import { DEFAULT_NEWS_PLACEHOLDER, handleImageError } from '../../lib/utils/placeholders';

interface DetailFeedPageProps {
  type: 'job' | 'news' | 'post';
  items: any[];
  initialIndex?: number;
  onClose: () => void;
  onApplyJob?: (job: Job) => void;
  onNavigateHome?: () => void;
  onNavigateTab?: (tab: string) => void;
  appUser?: AppUser | null;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onAddComment?: (id: string, c: string) => void;
  allUsers?: any[];
  onPublisherClick?: (user: any, job?: any) => void;
}

export const DetailFeedPage: React.FC<DetailFeedPageProps> = ({
  type,
  items,
  initialIndex = 0,
  onClose,
  onApplyJob,
  onNavigateHome,
  onNavigateTab,
  appUser,
  allUsers = [],
  onPublisherClick,
}) => {
  const { setSelectedProfile, allUsers: contextAllUsers } = useAppContext();
  const allUsersList = allUsers.length > 0 ? allUsers : contextAllUsers;
  
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, (items?.length || 1) - 1))
  );
  const [direction, setDirection] = useState(0);

  // Keep currentIndex updated if initialIndex changes
  useEffect(() => {
    setCurrentIndex(Math.max(0, Math.min(initialIndex, (items?.length || 1) - 1)));
  }, [initialIndex]);

  const isTransitioning = useRef(false);

  const goToNext = () => {
    if (isTransitioning.current) return;
    if (currentIndex < items.length - 1) {
      isTransitioning.current = true;
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
      setTimeout(() => {
        isTransitioning.current = false;
      }, 350);
    }
  };

  const goToPrev = () => {
    if (isTransitioning.current) return;
    if (currentIndex > 0) {
      isTransitioning.current = true;
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
      setTimeout(() => {
        isTransitioning.current = false;
      }, 350);
    }
  };

  const timeAgo = (dateStr: any) => safeTimeAgo(dateStr);

  const handleGoHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      onClose();
    }
  };

  const handleGoSection = () => {
    if (onNavigateTab) {
      onNavigateTab(type === 'job' ? 'jobs' : type === 'news' ? 'news' : 'home');
    } else {
      onClose();
    }
  };

  if (!items || items.length === 0) return null;

  const currentItem = items[currentIndex] || items[0];
  const isCurJob = currentItem?.feedType === 'job' || currentItem?.company !== undefined || (type === 'job' && !currentItem?.content);
  const isCurNews = type === 'news' || currentItem?.feedType === 'news';
  const itemLabel = isCurJob ? 'وظيفة' : isCurNews ? 'خبر' : 'منشور';

  // Memoized user data & cover lookup to eliminate CPU bottlenecks during animation
  const pubUser = useMemo(() => {
    if (!currentItem) return null;
    const targetId = currentItem.employer_id || currentItem.employerId || currentItem.author_id || currentItem.authorId;
    return allUsersList.find(u => u.id === targetId) ||
      (appUser && (appUser.id === currentItem.employerId || appUser.id === currentItem.authorId) ? appUser : null);
  }, [currentItem?.id, allUsersList, appUser]);

  const pubAvatar = useMemo(() => {
    return pubUser?.avatar || currentItem?.employer_avatar || currentItem?.employerAvatar || currentItem?.authorAvatar;
  }, [pubUser, currentItem]);

  const heroCover = useMemo(() => {
    if (!currentItem) return DEFAULT_NEWS_PLACEHOLDER;
    let cover = currentItem.image_url || currentItem.imageUrl || pubUser?.coverUrl || (pubUser as any)?.cover_url || DEFAULT_NEWS_PLACEHOLDER;
    if (cover && pubAvatar && cover === pubAvatar) {
      cover = pubUser?.coverUrl || (pubUser as any)?.cover_url || DEFAULT_NEWS_PLACEHOLDER;
    }
    return cover;
  }, [currentItem?.id, pubUser, pubAvatar]);

  // ── Scroll Progress & Visual Indicator State (مؤشر التمرير ونسبة التقدم) ──
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const checkScroll = (target: HTMLDivElement | null) => {
    if (!target) return;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 15) {
      setScrollProgress(100);
      setCanScrollDown(false);
    } else {
      const pct = Math.min(100, Math.max(0, Math.round((scrollTop / maxScroll) * 100)));
      setScrollProgress(pct);
      setCanScrollDown(scrollTop < maxScroll - 30);
    }
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    checkScroll(e.currentTarget);
  };

  useEffect(() => {
    setScrollProgress(0);
    const timer = setTimeout(() => {
      checkScroll(scrollContainerRef.current);
    }, 150);
    return () => clearTimeout(timer);
  }, [currentIndex, isCurJob, isCurNews]);

  // Ultra-Fast 60-120FPS GPU-Accelerated 2D Slide Variants (Zero 3D rotateY to prevent lag/freezing)
  const cardVariants: Variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? -140 : dir < 0 ? 140 : 0,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.7 },
        opacity: { duration: 0.15 },
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? 140 : -140,
      opacity: 0,
      transition: {
        duration: 0.15,
        ease: 'easeOut',
      },
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -36, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 36, scale: 0.98 }}
      transition={{
        x: { type: 'spring', stiffness: 440, damping: 38, mass: 0.7 },
        opacity: { duration: 0.16 },
        scale: { duration: 0.16 },
      }}
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] z-[220] bg-slate-100/95 dark:bg-slate-950 text-slate-800 dark:text-white flex flex-col overflow-hidden will-change-transform transform-gpu"
      dir="rtl"
    >
      {/* ── Top Bar: زر الرجوع + عدد الوظائف فقط (مطابق لطلب المستخدم) ── */}
      <div
        className="relative z-30 flex items-center justify-between px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-xs gap-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        {/* زر الرجوع */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-black transition-all active:scale-95 shadow-xs cursor-pointer"
          title="رجوع"
        >
          <ArrowRight size={16} />
          <span>رجوع</span>
        </button>

        {/* عدد الوظائف (كما في تفاصيل الرئيسية) */}
        <div className="flex items-center justify-center">
          <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/50 px-3.5 py-1 rounded-full shadow-xs">
            {itemLabel} {currentIndex + 1} من {items.length}
          </span>
        </div>

        {/* زر العودة للرئيسية الثابت دائماً في الشريط العلوي */}
        <button
          onClick={handleGoHome}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-black transition-all active:scale-95 shadow-xs cursor-pointer"
          title="العودة للرئيسية"
        >
          <Home size={15} className="text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">العودة للرئيسية</span>
          <span className="sm:hidden">الرئيسية</span>
        </button>
      </div>

      {/* ── Main Viewport: Ultra-Smooth GPU-Accelerated Viewport ── */}
      <div
        className="flex-1 min-h-0 w-full flex items-center justify-center relative overflow-hidden px-2 sm:px-4 py-2 bg-slate-100/70 dark:bg-slate-950"
      >
        {/* Peek Card: Next Card on Left (In RTL, Left is Next) */}
        {currentIndex < items.length - 1 && (
          <div
            onClick={goToNext}
            className="hidden sm:flex absolute left-2 md:left-6 w-16 md:w-28 h-[88%] rounded-3xl opacity-35 hover:opacity-60 dark:opacity-20 dark:hover:opacity-40 scale-90 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer shadow-lg overflow-hidden transition-all z-0 items-center justify-center p-2 text-center"
            title={isCurJob ? 'الوظيفة التالية' : isCurNews ? 'الخبر التالي' : 'المنشور التالي'}
          >
            <span className="text-[10px] font-black text-slate-500 line-clamp-3 leading-tight select-none pointer-events-none">
              {items[currentIndex + 1]?.title || (isCurJob ? 'الوظيفة التالية' : isCurNews ? 'الخبر التالي' : 'التالي')}
            </span>
          </div>
        )}

        {/* Peek Card: Prev Card on Right (In RTL, Right is Previous) */}
        {currentIndex > 0 && (
          <div
            onClick={goToPrev}
            className="hidden sm:flex absolute right-2 md:right-6 w-16 md:w-28 h-[88%] rounded-3xl opacity-35 hover:opacity-60 dark:opacity-20 dark:hover:opacity-40 scale-90 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer shadow-lg overflow-hidden transition-all z-0 items-center justify-center p-2 text-center"
            title={isCurJob ? 'الوظيفة السابقة' : isCurNews ? 'الخبر السابق' : 'المنشور السابق'}
          >
            <span className="text-[10px] font-black text-slate-500 line-clamp-3 leading-tight select-none pointer-events-none">
              {items[currentIndex - 1]?.title || (isCurJob ? 'الوظيفة السابقة' : isCurNews ? 'الخبر السابق' : 'السابق')}
            </span>
          </div>
        )}

        {/* ── Active Card with Ultra-Fast 60-120FPS GPU Transition ── */}
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={currentItem.id || currentIndex}
            custom={direction}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = offset.x;
              if (swipe < -40 || velocity.x < -250) {
                // In RTL: swipe left goes to next job
                goToNext();
              } else if (swipe > 40 || velocity.x > 250) {
                // In RTL: swipe right goes to previous job
                goToPrev();
              }
            }}
            className="w-full sm:w-[92vw] md:w-[780px] max-w-[780px] h-full flex flex-col rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-xl relative overflow-hidden z-10 diwani-neon-card will-change-transform transform-gpu"
          >
            {isCurJob ? (
              /* ── Job View: الكارد العلوي (الغلاف والعنوان والناشر) ثابت 100%، والتفاصيل سكرول داخلي ── */
              <div className="flex flex-col h-full w-full overflow-hidden">
                
                {/* ── 1. FIXED TOP HERO CARD: ثابت رغم السكرول ── */}
                {(() => {
                  const isActive = currentItem.is_active !== false;

                  const handleOpenPublisher = () => {
                    const targetUser = pubUser || {
                      id: currentItem.employer_id || currentItem.employerId || currentItem.author_id || currentItem.authorId,
                      name: currentItem.company || 'صاحب العمل',
                      avatar: pubAvatar,
                      isEmployer: true,
                      role: 'employer'
                    };
                    if (onPublisherClick) {
                      onClose();
                      onPublisherClick(targetUser, currentItem);
                    } else if (setSelectedProfile) {
                      onClose();
                      setSelectedProfile(targetUser);
                      if (onNavigateTab) onNavigateTab('profile');
                    }
                  };

                  return (
                    <div className="shrink-0 relative overflow-hidden rounded-t-3xl border-b border-slate-200/80 dark:border-slate-800 z-10 bg-slate-950">
                      <div 
                        onClick={handleOpenPublisher}
                        className={`relative overflow-hidden ${heroCover ? 'h-48 sm:h-56' : 'h-40 sm:h-48'} shrink-0 cursor-pointer group/hero`}
                        title="النقر هنا يفتح الملف المهني للناشر"
                      >
                        <img 
                          src={heroCover} 
                          alt={currentItem.title} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover/hero:scale-105" 
                          onError={(e) => handleImageError(e, DEFAULT_NEWS_PLACEHOLDER)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
                        
                        {/* Publisher profile shortcut pill */}
                        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/45 hover:bg-black/65 backdrop-blur-md text-white text-[10px] font-black border border-white/20 transition-all shadow-md group-hover/hero:scale-105">
                          <ExternalLink size={12} />
                          <span>الملف المهني للناشر 🏢</span>
                        </div>

                        <div className="absolute bottom-4 right-4 left-4 z-10">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border mb-1.5 ${
                            isActive ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-400' : 'bg-slate-700/40 border-slate-600/30 text-slate-300'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                            {isActive ? 'التوظيف متاح الآن' : 'التوظيف مغلق'}
                          </div>
                          
                          <h1 className="text-lg sm:text-xl md:text-2xl font-black text-white leading-tight tracking-tight drop-shadow-md line-clamp-2">
                            {currentItem.title}
                          </h1>
                          
                          <div 
                            className="flex items-center gap-2 mt-2 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPublisher();
                            }}
                          >
                            {pubAvatar ? (
                              <img src={pubAvatar} alt="" className="w-6 h-6 rounded-lg object-cover border border-white/30 shadow-md" />
                            ) : (
                              <div className="w-6 h-6 rounded-lg bg-blue-600/80 border border-white/20 flex items-center justify-center text-white text-xs font-black">
                                {currentItem.company ? currentItem.company.charAt(0) : 'P'}
                              </div>
                            )}
                            <p className="text-xs sm:text-sm text-white/95 font-black">{currentItem.company}</p>
                            <span className="text-[10px] font-bold text-white/60">• {timeAgo(currentItem.postedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Scroll progress line (مؤشر تقدم التمرير) ── */}
                <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 transition-all duration-150" 
                    style={{ width: `${Math.max(6, scrollProgress)}%` }} 
                  />
                </div>

                {/* ── 2. INTERNAL SCROLLABLE DETAILS: ينزل بسكرول كامل مستقل ── */}
                <div 
                  ref={scrollContainerRef}
                  onScroll={onScroll}
                  className="flex-1 min-h-0 overflow-y-auto pro-scrollbar overscroll-y-contain px-4 md:px-6 py-4 space-y-4"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-y',
                  }}
                >
                  {/* Meta Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { icon: <MapPin size={13} className="text-blue-500 dark:text-blue-400" />, label: 'الموقع', value: currentItem.location || 'عن بُعد' },
                      { icon: <Briefcase size={13} className="text-purple-500 dark:text-purple-400" />, label: 'القسم', value: getJobCategory(currentItem) },
                      { icon: <Tag size={13} className="text-indigo-500 dark:text-indigo-400" />, label: 'نوع العمل', value: currentItem.jobType || currentItem.job_type || 'دوام كامل' },
                      { icon: <DollarSign size={13} className="text-emerald-500 dark:text-emerald-400" />, label: 'الراتب', value: currentItem.salary || 'غير محدد' },
                      { icon: <Clock size={13} className="text-amber-500 dark:text-amber-400" />, label: 'ساعات العمل', value: currentItem.working_hours || currentItem.workingHours || 'دوام كامل' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-0.5 shadow-xs">
                        {stat.icon}
                        <span className="text-[9px] font-bold text-slate-400">{stat.label}</span>
                        <span className="text-xs font-black text-slate-800 dark:text-white truncate">{stat.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                      <FileText size={14} />
                      تفاصيل الوظيفة ومتطلباتها
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed shadow-xs">
                      <BilingualSmartText text={cleanJobDescription(currentItem.description) || 'لا يوجد وصف مفصل متاح.'} className="space-y-2.5" />
                    </div>
                  </div>

                  {currentItem.requirements && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles size={14} />
                        المتطلبات والمهارات المطلوبة
                      </h3>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed shadow-xs">
                        <BilingualSmartText text={currentItem.requirements} className="space-y-2.5" />
                      </div>
                    </div>
                  )}
                  <div className="h-2" />
                </div>

                {/* ── 3. FIXED BOTTOM ACTION BAR: ثابت أسفل الكارد لا يتحرك مع السكرول ── */}
                <div className="shrink-0 p-3 sm:px-5 sm:py-3.5 border-t border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md space-y-2 z-20 rounded-b-3xl">
                  {(() => {
                    const isPublisher = !!(appUser && !appUser.isAdmin && (appUser.id === currentItem.employerId || appUser.id === currentItem.employer_id || appUser.id === currentItem.authorId || appUser.id === currentItem.author_id));
                    const isEmployer = !!(appUser && !appUser.isAdmin && appUser.role === 'employer');
                    const isActive = currentItem.is_active !== false;

                    return (
                      <button
                        onClick={() => onApplyJob?.(currentItem)}
                        disabled={!isActive || isPublisher || isEmployer}
                        className={`w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md cursor-pointer ${
                          isPublisher
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-400/30 cursor-not-allowed shadow-none'
                            : isActive
                            ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:brightness-110 text-white shadow-blue-200 dark:shadow-blue-900/40'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                        }`}
                      >
                        {isPublisher ? (
                          <span>أنت ناشر هذه الوظيفة 🏢 (لا يمكنك التقديم)</span>
                        ) : isEmployer ? (
                          <span>أصحاب العمل لا يمكنهم التقديم (للباحثين عن عمل فقط) 💼</span>
                        ) : (
                          <>
                            <Send size={15} />
                            <span>التقديم المهني على الوظيفة 🚀</span>
                          </>
                        )}
                      </button>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleGoHome}
                      className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="العودة للرئيسية"
                    >
                      <Home size={14} className="text-blue-500" />
                      <span>العودة للرئيسية</span>
                    </button>
                    <button
                      onClick={handleGoSection}
                      className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="العودة للوظائف"
                    >
                      <Briefcase size={14} className="text-indigo-500" />
                      <span>العودة للوظائف</span>
                    </button>
                  </div>
                </div>

                {/* ── Floating scroll hint indicator (مؤشر وجود سكرول للأسفل) ── */}
                <AnimatePresence>
                  {canScrollDown && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      onClick={() => scrollContainerRef.current?.scrollBy({ top: 180, behavior: 'smooth' })}
                      className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-[11px] font-black shadow-xl backdrop-blur-md flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                    >
                      <span>مرر للأسفل</span>
                      <ChevronDown size={13} className="animate-bounce" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            ) : !isCurNews ? (
              /* ── Post View: الجزء العلوي ثابت والتفاصيل سكرول ── */
              <div className="flex flex-col h-full w-full overflow-hidden">
                {/* Fixed Post Author Bar */}
                <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
                  <div className="flex items-center gap-3">
                    <img
                      src={currentItem.authorAvatar || 'https://ui-avatars.com/api/?background=random'}
                      alt={currentItem.authorName}
                      className="w-11 h-11 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                    />
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-white text-sm leading-tight">
                        {currentItem.authorName || 'مستخدم'}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                        {currentItem.authorTitle || 'عضو في ProLink'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded-full">
                    <Clock size={11} />
                    {timeAgo(currentItem.timestamp || currentItem.created_at)}
                  </span>
                </div>

                {/* Scrollable Post Content */}
                <div 
                  ref={scrollContainerRef}
                  onScroll={onScroll}
                  className="flex-1 min-h-0 overflow-y-auto pro-scrollbar px-5 py-4 space-y-4"
                >
                  {currentItem.imageUrl && (
                    <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                      <img src={currentItem.imageUrl} alt="" className="w-full max-h-96 object-contain" />
                    </div>
                  )}

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed shadow-xs">
                    {currentItem.content ? (
                      <BilingualSmartText text={currentItem.content} className="space-y-3" />
                    ) : (
                      <p className="text-slate-400 italic">لا يوجد نص إضافي.</p>
                    )}
                  </div>
                </div>

                {/* ── Fixed Post Bottom Bar: ثابت أسفل كارد المنشور ── */}
                <div className="shrink-0 p-3 sm:px-5 sm:py-3.5 border-t border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-b-3xl z-20">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleGoHome}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="العودة للرئيسية"
                    >
                      <Home size={14} className="text-blue-500" />
                      <span>العودة للرئيسية</span>
                    </button>
                    <button
                      onClick={handleGoSection}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="الوظائف"
                    >
                      <Briefcase size={14} className="text-indigo-500" />
                      <span>الوظائف</span>
                    </button>
                  </div>
                </div>

                {/* ── Floating scroll hint indicator (مؤشر وجود سكرول للأسفل) ── */}
                <AnimatePresence>
                  {canScrollDown && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      onClick={() => scrollContainerRef.current?.scrollBy({ top: 180, behavior: 'smooth' })}
                      className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-[11px] font-black shadow-xl backdrop-blur-md flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                    >
                      <span>مرر للأسفل</span>
                      <ChevronDown size={13} className="animate-bounce" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* ── News View: مطابق لتفاصيل الوظائف تماماً (رأس ثابت + سكرول داخلي + شريط سفلي ثابت) ── */
              <div className="flex flex-col h-full w-full overflow-hidden">
                {/* Fixed News Hero: رأس الكارد ثابت 100% */}
                <div className="shrink-0 relative overflow-hidden rounded-t-3xl border-b border-slate-200/80 dark:border-slate-800 z-10 bg-slate-950">
                  <div className={`relative overflow-hidden ${heroCover ? 'h-48 sm:h-56' : 'h-40 sm:h-48'} shrink-0`}>
                    <img
                      src={currentItem.thumbnail || currentItem.imageUrl || heroCover}
                      alt={currentItem.title}
                      className="w-full h-full object-cover"
                      onError={(e) => handleImageError(e, DEFAULT_NEWS_PLACEHOLDER)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
                    
                    {/* Source shortcut pill */}
                    <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/45 backdrop-blur-md text-white text-[10px] font-black border border-white/20 shadow-md">
                      <Newspaper size={12} className="text-emerald-400" />
                      <span>{currentItem.source || currentItem.category || 'أخبار المهنيين'}</span>
                    </div>

                    <div className="absolute bottom-4 right-4 left-4 z-10">
                      <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border mb-1.5 bg-blue-500/20 border-blue-400/30 text-blue-300">
                        <Calendar size={11} />
                        <span>{currentItem.pubDate ? new Date(currentItem.pubDate).toLocaleDateString('ar-EG') : 'اليوم'}</span>
                      </div>
                      
                      <h1 className="text-lg sm:text-xl md:text-2xl font-black text-white leading-tight tracking-tight drop-shadow-md line-clamp-2">
                        {currentItem.title}
                      </h1>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-6 h-6 rounded-lg bg-emerald-600/80 border border-white/20 flex items-center justify-center text-white text-[10px] font-black shadow-md">
                          <Newspaper size={12} />
                        </div>
                        <p className="text-xs sm:text-sm text-white/95 font-black">{currentItem.source || currentItem.category || 'أخبار ProLink'}</p>
                        <span className="text-[10px] font-bold text-white/60">• {timeAgo(currentItem.pubDate || currentItem.date)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Scroll progress line (مؤشر تقدم التمرير) ── */}
                <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-400 transition-all duration-150" 
                    style={{ width: `${Math.max(6, scrollProgress)}%` }} 
                  />
                </div>

                {/* Scrollable News Content */}
                <div 
                  ref={scrollContainerRef}
                  onScroll={onScroll}
                  className="flex-1 min-h-0 overflow-y-auto pro-scrollbar overscroll-y-contain px-4 md:px-6 py-4 space-y-4"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-y',
                  }}
                >
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed shadow-xs">
                    <BilingualSmartText text={currentItem.content || currentItem.description || ''} className="space-y-3" />
                  </div>
                  <div className="h-2" />
                </div>

                {/* ── Fixed News Bottom Bar: مطابق لشريط الوظائف تماماً مع زر المصدر الأصلي والعودة للرئيسية ── */}
                <div className="shrink-0 p-3 sm:px-5 sm:py-3.5 border-t border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md space-y-2 z-20 rounded-b-3xl">
                  {currentItem.link && currentItem.link !== '#' && (
                    <a
                      href={currentItem.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:brightness-110 text-white shadow-md cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <ExternalLink size={15} />
                      <span>قراءة المقال بالكامل من المصدر الأصلي 🌐</span>
                    </a>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleGoHome}
                      className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="العودة للرئيسية"
                    >
                      <Home size={14} className="text-blue-500" />
                      <span>العودة للرئيسية</span>
                    </button>
                    <button
                      onClick={handleGoSection}
                      className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="العودة للأخبار"
                    >
                      <Newspaper size={14} className="text-emerald-500" />
                      <span>العودة للأخبار</span>
                    </button>
                  </div>
                </div>

                {/* ── Floating scroll hint indicator (مؤشر وجود سكرول للأسفل) ── */}
                <AnimatePresence>
                  {canScrollDown && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      onClick={() => scrollContainerRef.current?.scrollBy({ top: 180, behavior: 'smooth' })}
                      className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-[11px] font-black shadow-xl backdrop-blur-md flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                    >
                      <span>مرر للأسفل</span>
                      <ChevronDown size={13} className="animate-bounce" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
