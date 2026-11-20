import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { 
  ArrowRight, Briefcase, MapPin, DollarSign, 
  Tag, Clock, Send, Calendar, ExternalLink, Sparkles,
  FileText, Home, Newspaper, ChevronDown, ChevronLeft, ChevronRight, Edit2, Trash2, AlertTriangle, Phone
} from 'lucide-react';
import { openContactMenu } from '../../lib/utils/contact';
import { Job, AppUser } from '../../types';
import { safeTimeAgo } from '../../lib/utils/formatDate';
import { BilingualSmartText } from '../../lib/utils/bilingualText';
import { useAppContext } from '../../contexts/AppContext';
import { getJobCategory, cleanJobDescription } from '../../lib/utils/jobCategoryUtils';
import { DEFAULT_NEWS_PLACEHOLDER, handleImageError, AMAL_NEWS_IMAGE } from '../../lib/utils/placeholders';
import { newsService } from '../../lib/services/newsService';

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
  onPublisherClick?: (user: any, item?: any, currentIndex?: number) => void;
  onEditPost?: (post: any) => void;
  onDeletePost?: (id: string) => Promise<boolean> | void;
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
  onEditPost,
  onDeletePost,
}) => {
  const { setSelectedProfile, allUsers: contextAllUsers, jobs: contextJobs = [], posts: contextPosts = [] } = useAppContext();
  const allUsersList = allUsers.length > 0 ? allUsers : contextAllUsers;

  // ⚡ Auto-expand single-item array to full collection so the total count always appears accurately!
  const resolvedItems = useMemo(() => {
    if (items && items.length > 1) return items;
    const first = items?.[0];
    if (type === 'job' || first?.feedType === 'job' || (first?.company && !first?.authorId)) {
      if (contextJobs.length > 0) return contextJobs;
    } else if (type === 'post' || first?.feedType === 'post' || (first?.content && first?.authorId)) {
      if (contextPosts.length > 0) return contextPosts;
    } else if (type === 'news' || first?.feedType === 'news') {
      try {
        const raw = localStorage.getItem('prolink_news_cache_v2') || sessionStorage.getItem('prolink_news_cache_v2');
        if (raw) {
          const parsed = JSON.parse(raw);
          const newsList = Array.isArray(parsed) ? parsed : (parsed.data || []);
          if (newsList.length > 0) return newsList;
        }
      } catch {}
    }
    return items || [];
  }, [items, type, contextJobs, contextPosts]);
  
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, (items?.length || 1) - 1))
  );
  const [direction, setDirection] = useState(0);

  // Keep currentIndex updated if initialIndex changes
  useEffect(() => {
    setCurrentIndex(Math.max(0, Math.min(initialIndex, (items?.length || 1) - 1)));
  }, [initialIndex]);

  const isTransitioning = useRef(false);
  const [showPostDeleteConfirm, setShowPostDeleteConfirm] = useState(false);

  // Keyboard navigation for desktop users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToNext();
      } else if (e.key === 'ArrowRight') {
        goToPrev();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, resolvedItems.length]);

  const goToNext = () => {
    if (isTransitioning.current) return;
    if (currentIndex < resolvedItems.length - 1) {
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

    const handleOpenPublisher = () => {
    const targetUser = pubUser || {
      id: currentItem.employer_id || currentItem.employerId || currentItem.author_id || currentItem.authorId,
      name: currentItem.company || currentItem.authorName || currentItem.author_name || 'الناشر',
      avatar: pubAvatar || currentItem.employerAvatar || currentItem.authorAvatar || '',
      title: currentItem.authorTitle || currentItem.specialty || '',
      role: isCurJob ? 'employer' : 'seeker'
    };
    if (onPublisherClick) {
      onClose();
      onPublisherClick(targetUser, currentItem, currentIndex);
    } else if (setSelectedProfile) {
      onClose();
      setSelectedProfile(targetUser);
      if (onNavigateTab) onNavigateTab('profile');
    }
  };

  if (!items || resolvedItems.length === 0) return null;

  const currentItem = resolvedItems[currentIndex] || items[0];
  const isCurJob = type !== 'post' && (currentItem?.feedType === 'job' || type === 'job' || (currentItem?.company !== undefined && !currentItem?.content && !currentItem?.authorId && !currentItem?.author_id));
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
    if (!currentItem) return AMAL_NEWS_IMAGE;
    let cover = currentItem.image_url || currentItem.imageUrl || currentItem.thumbnail || pubUser?.coverUrl || (pubUser as any)?.cover_url;
    if (!cover || (pubAvatar && cover === pubAvatar)) {
      cover = pubUser?.coverUrl || (pubUser as any)?.cover_url || AMAL_NEWS_IMAGE;
    }
    return newsService.proxyImage(cover);
  }, [currentItem?.id, currentItem?.image_url, currentItem?.imageUrl, currentItem?.thumbnail, pubUser, pubAvatar]);

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
      {/* ── Main Viewport: Ultra-Smooth GPU-Accelerated Viewport ── */}
      <div
        className="flex-1 min-h-0 w-full flex items-center justify-center relative overflow-hidden px-2 sm:px-4 py-2 bg-slate-100/70 dark:bg-slate-950"
      >
        {/* Floating Side Button: Next (Left in RTL) - With soft ambient glowing light */}
        {currentIndex < resolvedItems.length - 1 && (
          <button
            onClick={goToNext}
            className="absolute left-2 sm:left-4 md:left-6 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3.5 rounded-full bg-white/95 dark:bg-slate-900/95 text-blue-600 dark:text-blue-400 shadow-[0_0_24px_rgba(59,130,246,0.45)] dark:shadow-[0_0_28px_rgba(59,130,246,0.35)] ring-2 ring-blue-500/25 border border-blue-200/80 dark:border-blue-700/60 hover:shadow-[0_0_35px_rgba(59,130,246,0.65)] hover:scale-110 active:scale-95 transition-all backdrop-blur-xl cursor-pointer flex items-center justify-center group"
            title={isCurJob ? 'الوظيفة التالية' : isCurNews ? 'الخبر التالي' : 'المنشور التالي'}
            aria-label="التالي"
          >
            <ChevronLeft size={22} className="group-hover:-translate-x-0.5 transition-transform drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
          </button>
        )}

        {/* Floating Side Button: Previous (Right in RTL) - With soft ambient glowing light */}
        {currentIndex > 0 && (
          <button
            onClick={goToPrev}
            className="absolute right-2 sm:right-4 md:right-6 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3.5 rounded-full bg-white/95 dark:bg-slate-900/95 text-blue-600 dark:text-blue-400 shadow-[0_0_24px_rgba(59,130,246,0.45)] dark:shadow-[0_0_28px_rgba(59,130,246,0.35)] ring-2 ring-blue-500/25 border border-blue-200/80 dark:border-blue-700/60 hover:shadow-[0_0_35px_rgba(59,130,246,0.65)] hover:scale-110 active:scale-95 transition-all backdrop-blur-xl cursor-pointer flex items-center justify-center group"
            title={isCurJob ? 'الوظيفة السابقة' : isCurNews ? 'الخبر السابق' : 'المنشور السابق'}
            aria-label="السابق"
          >
            <ChevronRight size={22} className="group-hover:translate-x-0.5 transition-transform drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
          </button>
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
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.65}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = offset.x;
              if (swipe < -25 || velocity.x < -120) {
                // In RTL: swipe left goes to next item
                goToNext();
              } else if (swipe > 25 || velocity.x > 120) {
                // In RTL: swipe right goes to previous item
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
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border ${
                              isActive ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-400' : 'bg-slate-700/40 border-slate-600/30 text-slate-300'
                            }`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                              {isActive ? 'التوظيف متاح الآن' : 'التوظيف مغلق'}
                            </div>
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
                            {(pubUser?.phone || (pubUser as any)?.website) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openContactMenu({ phone: pubUser?.phone, name: pubUser?.name || currentItem.company, website: (pubUser as any)?.website, cvUrl: (pubUser as any)?.cv_url });
                                }}
                                className="mr-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 text-white text-[10px] font-black border border-emerald-300/30 shadow-md active:scale-95 transition-all"
                                title="تواصل مع صاحب الوظيفة: واتساب / اتصال / روابطه"
                              >
                                <Phone size={12} /> تواصل معه
                              </button>
                            )}
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

                  <button
                    onClick={onClose}
                    className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                  >
                    <ArrowRight size={14} className="text-slate-500" />
                    <span>الرجوع</span>
                  </button>
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
                {/* Professional Global Delete Confirmation in Detail View */}
                {typeof document !== 'undefined' && createPortal(
                  <AnimatePresence>
                    {showPostDeleteConfirm && (
                      <div
                        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
                        dir="rtl"
                        onClick={(e) => { e.stopPropagation(); setShowPostDeleteConfirm(false); }}
                      >
                        <motion.div
                          initial={{ opacity: 0, scale: 0.92, y: 15 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92, y: 15 }}
                          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full max-w-md bg-white dark:bg-slate-900 border border-red-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-center relative overflow-hidden"
                        >
                          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500" />
                          <div className="w-16 h-16 mx-auto rounded-3xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 flex items-center justify-center text-red-600 dark:text-red-400 shadow-xl shadow-red-500/10">
                            <Trash2 size={28} />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1.5">
                              تأكيد حذف المنشور نهائياً
                            </h3>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed px-2">
                              سيتم حذف هذا المنشور بالكامل من قاعدة البيانات فوراً ولن تتمكن من استرجاعه لاحقاً. هل تريد المتابعة؟
                            </p>
                          </div>
                          <div className="flex items-center gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowPostDeleteConfirm(false)}
                              className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
                            >
                              إلغاء الأمر
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  if (onDeletePost) {
                                    await onDeletePost(currentItem.id);
                                  }
                                  setShowPostDeleteConfirm(false);
                                  if (resolvedItems.length <= 1) {
                                    onClose();
                                  } else {
                                    goToNext();
                                  }
                                } catch (e) {
                                  console.error('Delete error:', e);
                                }
                              }}
                              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-black shadow-lg shadow-red-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Trash2 size={14} />
                              <span>نعم، حذف نهائي</span>
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>,
                  document.body
                )}

                {/* ── Fixed Post Hero Header: رأس كارد المنشور مع الصورة والخلفية ── */}
                <div className="shrink-0 relative overflow-hidden rounded-t-3xl border-b border-slate-200/80 dark:border-slate-800 z-10 bg-slate-950">
                  <div 
                    onClick={handleOpenPublisher}
                    className="relative overflow-hidden h-44 sm:h-52 shrink-0 cursor-pointer group/hero"
                    title="النقر هنا يفتح الملف المهني للناشر"
                  >
                    <img 
                      src={heroCover} 
                      alt={currentItem.authorName || 'صورة المنشور'} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover/hero:scale-105" 
                      onError={(e) => handleImageError(e, AMAL_NEWS_IMAGE)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
                    
                    <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/45 backdrop-blur-md text-white text-[10px] font-black border border-white/20 shadow-md">
                      <Briefcase size={12} className="text-blue-400" />
                      <span>{currentItem.feedType === 'post' ? 'منشور مهني' : 'مقال وتجربة'}</span>
                    </div>

                    <div className="absolute bottom-3 right-4 left-4 z-10 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={currentItem.authorAvatar || 'https://ui-avatars.com/api/?background=random'}
                          alt={currentItem.authorName}
                          className="w-10 h-10 rounded-xl object-cover border-2 border-white/40 shadow-md"
                        />
                        <div>
                          <h3 className="font-black text-white text-sm leading-tight drop-shadow-md">
                            {currentItem.authorName || 'مستخدم'}
                          </h3>
                          <p className="text-[10px] text-white/80 font-bold">
                            {currentItem.authorTitle || 'عضو في ProLink'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-white/80 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                          <Clock size={11} />
                          {timeAgo(currentItem.timestamp || currentItem.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Post Author Action Bar (if owner or admin) */}
                {(() => {
                  const isPostOwner = !!(appUser && (currentItem.authorId === appUser.id || currentItem.author_id === appUser.id));
                  const isPostAdmin = !!((appUser as any)?.isAdmin || (appUser as any)?.role === 'admin' || (appUser as any)?.role === 'superadmin' || (appUser as any)?.is_admin);
                  if (!isPostOwner && !isPostAdmin) return null;
                  return (
                    <div className="shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
                      <span className="text-[11px] font-bold text-slate-400">إدارة المنشور:</span>
                      <div className="flex items-center gap-2">
                        {onEditPost && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditPost(currentItem);
                            }}
                            className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-xs active:scale-95 border border-blue-200/60 dark:border-blue-800/50 cursor-pointer text-xs font-bold flex items-center gap-1"
                            title="تعديل المنشور"
                          >
                            <Edit2 size={13} />
                            <span>تعديل</span>
                          </button>
                        )}
                        {onDeletePost && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowPostDeleteConfirm(true);
                            }}
                            className="px-3 py-1 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-xs active:scale-95 border border-red-200/60 dark:border-red-800/50 cursor-pointer text-xs font-bold flex items-center gap-1"
                            title="حذف المنشور"
                          >
                            <Trash2 size={13} />
                            <span>حذف</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Scrollable Post Content */}
                <div 
                  ref={scrollContainerRef}
                  onScroll={onScroll}
                  className="flex-1 min-h-0 overflow-y-auto pro-scrollbar overscroll-y-contain px-5 py-4 space-y-4"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-y',
                  }}
                >
                  {currentItem.imageUrl && (
                    <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                      <img src={currentItem.imageUrl} alt="" className="w-full max-h-96 object-contain" />
                    </div>
                  )}

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed shadow-xs">
                    {currentItem.content ? (
                      <BilingualSmartText text={currentItem.content} className="space-y-3" paragraphClassName="!text-black dark:!text-slate-100 font-medium" />
                    ) : (
                      <p className="text-slate-400 italic">لا يوجد نص إضافي.</p>
                    )}
                  </div>
                </div>

                {/* ── Fixed Post Bottom Bar: ثابت أسفل كارد المنشور ── */}
                <div className="shrink-0 p-3 sm:px-5 sm:py-3.5 border-t border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-b-3xl z-20">
                  <button
                    onClick={onClose}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                  >
                    <ArrowRight size={14} className="text-slate-500" />
                    <span>الرجوع</span>
                  </button>
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
                  <div className={`relative overflow-hidden ${heroCover ? 'h-56 sm:h-64 md:h-72' : 'h-48 sm:h-56'} shrink-0`}>
                    <img
                      src={newsService.proxyImage(currentItem.thumbnail || currentItem.imageUrl || currentItem.image_url || currentItem.image || currentItem.urlToImage || heroCover)}
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
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border bg-blue-500/20 border-blue-400/30 text-blue-300">
                          <Calendar size={11} />
                          <span>{currentItem.pubDate ? new Date(currentItem.pubDate).toLocaleDateString('ar-EG') : 'اليوم'}</span>
                        </div>
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
                    <BilingualSmartText text={currentItem.content || currentItem.description || ''} className="space-y-3" paragraphClassName="!text-black dark:!text-slate-100 font-medium" />
                  </div>
                  <div className="h-2" />
                </div>

                {/* ── Fixed News Bottom Bar ── */}
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

                  <button
                    onClick={onClose}
                    className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                  >
                    <ArrowRight size={14} className="text-slate-500" />
                    <span>الرجوع</span>
                  </button>
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
