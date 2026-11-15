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
  onPublisherClick?: (user: any, item?: any, currentIndex?: number) => void;
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

    const handleOpenPublisher = () => {
    const targetUser = pubUser || {
      id: currentItem.employer_id || currentItem.employerId || currentItem.author_id || currentItem.authorId,
      name: currentItem.company || currentItem.authorName || currentItem.author_name || 'Ø§Ù„Ù†Ø§Ø´Ø±',
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

  if (!items || items.length === 0) return null;

  const currentItem = items[currentIndex] || items[0];
  // type='post' always renders as post (never as job), even if company field exists in item
  const isCurJob = type !== 'post' && (currentItem?.feedType === 'job' || type === 'job' || (currentItem?.company !== undefined && !currentItem?.content && !currentItem?.authorId && !currentItem?.author_id));
  const isCurNews = type === 'news' || currentItem?.feedType === 'news';
  const itemLabel = isCurJob ? 'ÙˆØ¸ÙŠÙØ©' : isCurNews ? 'Ø®Ø¨Ø±' : 'Ù…Ù†Ø´ÙˆØ±';

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

  // â”€â”€ Scroll Progress & Visual Indicator State (Ù…Ø¤Ø´Ø± Ø§Ù„ØªÙ…Ø±ÙŠØ± ÙˆÙ†Ø³Ø¨Ø© Ø§Ù„ØªÙ‚Ø¯Ù…) â”€â”€
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
      {/* â”€â”€ Top Bar: Ø²Ø± Ø§Ù„Ø±Ø¬ÙˆØ¹ + Ø¹Ø¯Ø¯ Ø§Ù„ÙˆØ¸Ø§Ø¦Ù ÙÙ‚Ø· (Ù…Ø·Ø§Ø¨Ù‚ Ù„Ø·Ù„Ø¨ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…) â”€â”€ */}
      <div
        className="relative z-30 flex items-center justify-between px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-xs gap-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        {/* Ø²Ø± Ø§Ù„Ø±Ø¬ÙˆØ¹ */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-black transition-all active:scale-95 shadow-xs cursor-pointer"
          title="Ø±Ø¬ÙˆØ¹"
        >
          <ArrowRight size={16} />
          <span>Ø±Ø¬ÙˆØ¹</span>
        </button>

        {/* Ø¹Ø¯Ø¯ Ø§Ù„ÙˆØ¸Ø§Ø¦Ù (ÙƒÙ…Ø§ ÙÙŠ ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©) */}
        <div className="flex items-center justify-center">
          <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/50 px-3.5 py-1 rounded-full shadow-xs">
            {itemLabel} {currentIndex + 1} Ù…Ù† {items.length}
          </span>
        </div>

        {/* Ø²Ø± Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ© Ø§Ù„Ø«Ø§Ø¨Øª Ø¯Ø§Ø¦Ù…Ø§Ù‹ ÙÙŠ Ø§Ù„Ø´Ø±ÙŠØ· Ø§Ù„Ø¹Ù„ÙˆÙŠ */}
        <button
          onClick={handleGoHome}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-black transition-all active:scale-95 shadow-xs cursor-pointer"
          title="Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©"
        >
          <Home size={15} className="text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</span>
          <span className="sm:hidden">Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</span>
        </button>
      </div>

      {/* â”€â”€ Main Viewport: Ultra-Smooth GPU-Accelerated Viewport â”€â”€ */}
      <div
        className="flex-1 min-h-0 w-full flex items-center justify-center relative overflow-hidden px-2 sm:px-4 py-2 bg-slate-100/70 dark:bg-slate-950"
      >
        {/* Peek Card: Next Card on Left (In RTL, Left is Next) */}
        {currentIndex < items.length - 1 && (
          <div
            onClick={goToNext}
            className="hidden sm:flex absolute left-2 md:left-6 w-16 md:w-28 h-[88%] rounded-3xl opacity-35 hover:opacity-60 dark:opacity-20 dark:hover:opacity-40 scale-90 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer shadow-lg overflow-hidden transition-all z-0 items-center justify-center p-2 text-center"
            title={isCurJob ? 'Ø§Ù„ÙˆØ¸ÙŠÙØ© Ø§Ù„ØªØ§Ù„ÙŠØ©' : isCurNews ? 'Ø§Ù„Ø®Ø¨Ø± Ø§Ù„ØªØ§Ù„ÙŠ' : 'Ø§Ù„Ù…Ù†Ø´ÙˆØ± Ø§Ù„ØªØ§Ù„ÙŠ'}
          >
            <span className="text-[10px] font-black text-slate-500 line-clamp-3 leading-tight select-none pointer-events-none">
              {items[currentIndex + 1]?.title || (isCurJob ? 'Ø§Ù„ÙˆØ¸ÙŠÙØ© Ø§Ù„ØªØ§Ù„ÙŠØ©' : isCurNews ? 'Ø§Ù„Ø®Ø¨Ø± Ø§Ù„ØªØ§Ù„ÙŠ' : 'Ø§Ù„ØªØ§Ù„ÙŠ')}
            </span>
          </div>
        )}

        {/* Peek Card: Prev Card on Right (In RTL, Right is Previous) */}
        {currentIndex > 0 && (
          <div
            onClick={goToPrev}
            className="hidden sm:flex absolute right-2 md:right-6 w-16 md:w-28 h-[88%] rounded-3xl opacity-35 hover:opacity-60 dark:opacity-20 dark:hover:opacity-40 scale-90 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer shadow-lg overflow-hidden transition-all z-0 items-center justify-center p-2 text-center"
            title={isCurJob ? 'Ø§Ù„ÙˆØ¸ÙŠÙØ© Ø§Ù„Ø³Ø§Ø¨Ù‚Ø©' : isCurNews ? 'Ø§Ù„Ø®Ø¨Ø± Ø§Ù„Ø³Ø§Ø¨Ù‚' : 'Ø§Ù„Ù…Ù†Ø´ÙˆØ± Ø§Ù„Ø³Ø§Ø¨Ù‚'}
          >
            <span className="text-[10px] font-black text-slate-500 line-clamp-3 leading-tight select-none pointer-events-none">
              {items[currentIndex - 1]?.title || (isCurJob ? 'Ø§Ù„ÙˆØ¸ÙŠÙØ© Ø§Ù„Ø³Ø§Ø¨Ù‚Ø©' : isCurNews ? 'Ø§Ù„Ø®Ø¨Ø± Ø§Ù„Ø³Ø§Ø¨Ù‚' : 'Ø§Ù„Ø³Ø§Ø¨Ù‚')}
            </span>
          </div>
        )}

        {/* â”€â”€ Active Card with Ultra-Fast 60-120FPS GPU Transition â”€â”€ */}
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
              /* â”€â”€ Job View: Ø§Ù„ÙƒØ§Ø±Ø¯ Ø§Ù„Ø¹Ù„ÙˆÙŠ (Ø§Ù„ØºÙ„Ø§Ù ÙˆØ§Ù„Ø¹Ù†ÙˆØ§Ù† ÙˆØ§Ù„Ù†Ø§Ø´Ø±) Ø«Ø§Ø¨Øª 100%ØŒ ÙˆØ§Ù„ØªÙØ§ØµÙŠÙ„ Ø³ÙƒØ±ÙˆÙ„ Ø¯Ø§Ø®Ù„ÙŠ â”€â”€ */
              <div className="flex flex-col h-full w-full overflow-hidden">
                
                {/* â”€â”€ 1. FIXED TOP HERO CARD: Ø«Ø§Ø¨Øª Ø±ØºÙ… Ø§Ù„Ø³ÙƒØ±ÙˆÙ„ â”€â”€ */}
                {(() => {
                  const isActive = currentItem.is_active !== false;

                  const handleOpenPublisher = () => {
                    const targetUser = pubUser || {
                      id: currentItem.employer_id || currentItem.employerId || currentItem.author_id || currentItem.authorId,
                      name: currentItem.company || 'ØµØ§Ø­Ø¨ Ø§Ù„Ø¹Ù…Ù„',
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
                        title="Ø§Ù„Ù†Ù‚Ø± Ù‡Ù†Ø§ ÙŠÙØªØ­ Ø§Ù„Ù…Ù„Ù Ø§Ù„Ù…Ù‡Ù†ÙŠ Ù„Ù„Ù†Ø§Ø´Ø±"
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
                          <span>Ø§Ù„Ù…Ù„Ù Ø§Ù„Ù…Ù‡Ù†ÙŠ Ù„Ù„Ù†Ø§Ø´Ø± ðŸ¢</span>
                        </div>

                        <div className="absolute bottom-4 right-4 left-4 z-10">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border mb-1.5 ${
                            isActive ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-400' : 'bg-slate-700/40 border-slate-600/30 text-slate-300'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                            {isActive ? 'Ø§Ù„ØªÙˆØ¸ÙŠÙ Ù…ØªØ§Ø­ Ø§Ù„Ø¢Ù†' : 'Ø§Ù„ØªÙˆØ¸ÙŠÙ Ù…ØºÙ„Ù‚'}
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
                            <span className="text-[10px] font-bold text-white/60">â€¢ {timeAgo(currentItem.postedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* â”€â”€ Scroll progress line (Ù…Ø¤Ø´Ø± ØªÙ‚Ø¯Ù… Ø§Ù„ØªÙ…Ø±ÙŠØ±) â”€â”€ */}
                <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 transition-all duration-150" 
                    style={{ width: `${Math.max(6, scrollProgress)}%` }} 
                  />
                </div>

                {/* â”€â”€ 2. INTERNAL SCROLLABLE DETAILS: ÙŠÙ†Ø²Ù„ Ø¨Ø³ÙƒØ±ÙˆÙ„ ÙƒØ§Ù…Ù„ Ù…Ø³ØªÙ‚Ù„ â”€â”€ */}
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
                      { icon: <MapPin size={13} className="text-blue-500 dark:text-blue-400" />, label: 'Ø§Ù„Ù…ÙˆÙ‚Ø¹', value: currentItem.location || 'Ø¹Ù† Ø¨ÙØ¹Ø¯' },
                      { icon: <Briefcase size={13} className="text-purple-500 dark:text-purple-400" />, label: 'Ø§Ù„Ù‚Ø³Ù…', value: getJobCategory(currentItem) },
                      { icon: <Tag size={13} className="text-indigo-500 dark:text-indigo-400" />, label: 'Ù†ÙˆØ¹ Ø§Ù„Ø¹Ù…Ù„', value: currentItem.jobType || currentItem.job_type || 'Ø¯ÙˆØ§Ù… ÙƒØ§Ù…Ù„' },
                      { icon: <DollarSign size={13} className="text-emerald-500 dark:text-emerald-400" />, label: 'Ø§Ù„Ø±Ø§ØªØ¨', value: currentItem.salary || 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯' },
                      { icon: <Clock size={13} className="text-amber-500 dark:text-amber-400" />, label: 'Ø³Ø§Ø¹Ø§Øª Ø§Ù„Ø¹Ù…Ù„', value: currentItem.working_hours || currentItem.workingHours || 'Ø¯ÙˆØ§Ù… ÙƒØ§Ù…Ù„' },
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
                      ØªÙØ§ØµÙŠÙ„ Ø§Ù„ÙˆØ¸ÙŠÙØ© ÙˆÙ…ØªØ·Ù„Ø¨Ø§ØªÙ‡Ø§
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed shadow-xs">
                      <BilingualSmartText text={cleanJobDescription(currentItem.description) || 'Ù„Ø§ ÙŠÙˆØ¬Ø¯ ÙˆØµÙ Ù…ÙØµÙ„ Ù…ØªØ§Ø­.'} className="space-y-2.5" />
                    </div>
                  </div>

                  {currentItem.requirements && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles size={14} />
                        Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª ÙˆØ§Ù„Ù…Ù‡Ø§Ø±Ø§Øª Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø©
                      </h3>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed shadow-xs">
                        <BilingualSmartText text={currentItem.requirements} className="space-y-2.5" />
                      </div>
                    </div>
                  )}
                  <div className="h-2" />
                </div>

                {/* â”€â”€ 3. FIXED BOTTOM ACTION BAR: Ø«Ø§Ø¨Øª Ø£Ø³ÙÙ„ Ø§Ù„ÙƒØ§Ø±Ø¯ Ù„Ø§ ÙŠØªØ­Ø±Ùƒ Ù…Ø¹ Ø§Ù„Ø³ÙƒØ±ÙˆÙ„ â”€â”€ */}
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
                          <span>Ø£Ù†Øª Ù†Ø§Ø´Ø± Ù‡Ø°Ù‡ Ø§Ù„ÙˆØ¸ÙŠÙØ© ðŸ¢ (Ù„Ø§ ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„ØªÙ‚Ø¯ÙŠÙ…)</span>
                        ) : isEmployer ? (
                          <span>Ø£ØµØ­Ø§Ø¨ Ø§Ù„Ø¹Ù…Ù„ Ù„Ø§ ÙŠÙ…ÙƒÙ†Ù‡Ù… Ø§Ù„ØªÙ‚Ø¯ÙŠÙ… (Ù„Ù„Ø¨Ø§Ø­Ø«ÙŠÙ† Ø¹Ù† Ø¹Ù…Ù„ ÙÙ‚Ø·) ðŸ’¼</span>
                        ) : (
                          <>
                            <Send size={15} />
                            <span>Ø§Ù„ØªÙ‚Ø¯ÙŠÙ… Ø§Ù„Ù…Ù‡Ù†ÙŠ Ø¹Ù„Ù‰ Ø§Ù„ÙˆØ¸ÙŠÙØ© ðŸš€</span>
                          </>
                        )}
                      </button>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleGoHome}
                      className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©"
                    >
                      <Home size={14} className="text-blue-500" />
                      <span>Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</span>
                    </button>
                    <button
                      onClick={handleGoSection}
                      className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„ÙˆØ¸Ø§Ø¦Ù"
                    >
                      <Briefcase size={14} className="text-indigo-500" />
                      <span>Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„ÙˆØ¸Ø§Ø¦Ù</span>
                    </button>
                  </div>
                </div>

                {/* â”€â”€ Floating scroll hint indicator (Ù…Ø¤Ø´Ø± ÙˆØ¬ÙˆØ¯ Ø³ÙƒØ±ÙˆÙ„ Ù„Ù„Ø£Ø³ÙÙ„) â”€â”€ */}
                <AnimatePresence>
                  {canScrollDown && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      onClick={() => scrollContainerRef.current?.scrollBy({ top: 180, behavior: 'smooth' })}
                      className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-[11px] font-black shadow-xl backdrop-blur-md flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                    >
                      <span>Ù…Ø±Ø± Ù„Ù„Ø£Ø³ÙÙ„</span>
                      <ChevronDown size={13} className="animate-bounce" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            ) : !isCurNews ? (
              /* â”€â”€ Post View: Ø§Ù„Ø¬Ø²Ø¡ Ø§Ù„Ø¹Ù„ÙˆÙŠ Ø«Ø§Ø¨Øª ÙˆØ§Ù„ØªÙØ§ØµÙŠÙ„ Ø³ÙƒØ±ÙˆÙ„ â”€â”€ */
              <div className="flex flex-col h-full w-full overflow-hidden">
                {/* Fixed Post Author Bar */}
                <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
                  <div 
                    className="flex items-center gap-3 cursor-pointer group/author transition-all hover:opacity-90 active:scale-98"
                    onClick={handleOpenPublisher}
                    title="Ø¹Ø±Ø¶ Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø®ØµÙŠ Ù„Ù„Ù†Ø§Ø´Ø±"
                  >
                    <img
                      src={currentItem.authorAvatar || 'https://ui-avatars.com/api/?background=random'}
                      alt={currentItem.authorName}
                      className="w-11 h-11 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-sm group-hover/author:border-blue-500 transition-colors"
                    />
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-white text-sm leading-tight group-hover/author:text-blue-600 transition-colors">
                        {currentItem.authorName || 'Ù…Ø³ØªØ®Ø¯Ù…'}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                        {currentItem.authorTitle || 'Ø¹Ø¶Ùˆ ÙÙŠ ProLink'}
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
                      <p className="text-slate-400 italic">Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù†Øµ Ø¥Ø¶Ø§ÙÙŠ.</p>
                    )}
                  </div>
                </div>

                {/* â”€â”€ Fixed Post Bottom Bar: Ø«Ø§Ø¨Øª Ø£Ø³ÙÙ„ ÙƒØ§Ø±Ø¯ Ø§Ù„Ù…Ù†Ø´ÙˆØ± â”€â”€ */}
                <div className="shrink-0 p-3 sm:px-5 sm:py-3.5 border-t border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-b-3xl z-20">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleGoHome}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©"
                    >
                      <Home size={14} className="text-blue-500" />
                      <span>Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</span>
                    </button>
                    <button
                      onClick={handleGoSection}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="Ø§Ù„ÙˆØ¸Ø§Ø¦Ù"
                    >
                      <Briefcase size={14} className="text-indigo-500" />
                      <span>Ø§Ù„ÙˆØ¸Ø§Ø¦Ù</span>
                    </button>
                  </div>
                </div>

                {/* â”€â”€ Floating scroll hint indicator (Ù…Ø¤Ø´Ø± ÙˆØ¬ÙˆØ¯ Ø³ÙƒØ±ÙˆÙ„ Ù„Ù„Ø£Ø³ÙÙ„) â”€â”€ */}
                <AnimatePresence>
                  {canScrollDown && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      onClick={() => scrollContainerRef.current?.scrollBy({ top: 180, behavior: 'smooth' })}
                      className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-[11px] font-black shadow-xl backdrop-blur-md flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                    >
                      <span>Ù…Ø±Ø± Ù„Ù„Ø£Ø³ÙÙ„</span>
                      <ChevronDown size={13} className="animate-bounce" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* â”€â”€ News View: Ù…Ø·Ø§Ø¨Ù‚ Ù„ØªÙØ§ØµÙŠÙ„ Ø§Ù„ÙˆØ¸Ø§Ø¦Ù ØªÙ…Ø§Ù…Ø§Ù‹ (Ø±Ø£Ø³ Ø«Ø§Ø¨Øª + Ø³ÙƒØ±ÙˆÙ„ Ø¯Ø§Ø®Ù„ÙŠ + Ø´Ø±ÙŠØ· Ø³ÙÙ„ÙŠ Ø«Ø§Ø¨Øª) â”€â”€ */
              <div className="flex flex-col h-full w-full overflow-hidden">
                {/* Fixed News Hero: Ø±Ø£Ø³ Ø§Ù„ÙƒØ§Ø±Ø¯ Ø«Ø§Ø¨Øª 100% */}
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
                      <span>{currentItem.source || currentItem.category || 'Ø£Ø®Ø¨Ø§Ø± Ø§Ù„Ù…Ù‡Ù†ÙŠÙŠÙ†'}</span>
                    </div>

                    <div className="absolute bottom-4 right-4 left-4 z-10">
                      <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border mb-1.5 bg-blue-500/20 border-blue-400/30 text-blue-300">
                        <Calendar size={11} />
                        <span>{currentItem.pubDate ? new Date(currentItem.pubDate).toLocaleDateString('ar-EG') : 'Ø§Ù„ÙŠÙˆÙ…'}</span>
                      </div>
                      
                      <h1 className="text-lg sm:text-xl md:text-2xl font-black text-white leading-tight tracking-tight drop-shadow-md line-clamp-2">
                        {currentItem.title}
                      </h1>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-6 h-6 rounded-lg bg-emerald-600/80 border border-white/20 flex items-center justify-center text-white text-[10px] font-black shadow-md">
                          <Newspaper size={12} />
                        </div>
                        <p className="text-xs sm:text-sm text-white/95 font-black">{currentItem.source || currentItem.category || 'Ø£Ø®Ø¨Ø§Ø± ProLink'}</p>
                        <span className="text-[10px] font-bold text-white/60">â€¢ {timeAgo(currentItem.pubDate || currentItem.date)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* â”€â”€ Scroll progress line (Ù…Ø¤Ø´Ø± ØªÙ‚Ø¯Ù… Ø§Ù„ØªÙ…Ø±ÙŠØ±) â”€â”€ */}
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

                {/* â”€â”€ Fixed News Bottom Bar: Ù…Ø·Ø§Ø¨Ù‚ Ù„Ø´Ø±ÙŠØ· Ø§Ù„ÙˆØ¸Ø§Ø¦Ù ØªÙ…Ø§Ù…Ø§Ù‹ Ù…Ø¹ Ø²Ø± Ø§Ù„Ù…ØµØ¯Ø± Ø§Ù„Ø£ØµÙ„ÙŠ ÙˆØ§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ© â”€â”€ */}
                <div className="shrink-0 p-3 sm:px-5 sm:py-3.5 border-t border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md space-y-2 z-20 rounded-b-3xl">
                  {currentItem.link && currentItem.link !== '#' && (
                    <a
                      href={currentItem.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:brightness-110 text-white shadow-md cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <ExternalLink size={15} />
                      <span>Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ù…Ù‚Ø§Ù„ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„ Ù…Ù† Ø§Ù„Ù…ØµØ¯Ø± Ø§Ù„Ø£ØµÙ„ÙŠ ðŸŒ</span>
                    </a>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleGoHome}
                      className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©"
                    >
                      <Home size={14} className="text-blue-500" />
                      <span>Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</span>
                    </button>
                    <button
                      onClick={handleGoSection}
                      className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø£Ø®Ø¨Ø§Ø±"
                    >
                      <Newspaper size={14} className="text-emerald-500" />
                      <span>Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø£Ø®Ø¨Ø§Ø±</span>
                    </button>
                  </div>
                </div>

                {/* â”€â”€ Floating scroll hint indicator (Ù…Ø¤Ø´Ø± ÙˆØ¬ÙˆØ¯ Ø³ÙƒØ±ÙˆÙ„ Ù„Ù„Ø£Ø³ÙÙ„) â”€â”€ */}
                <AnimatePresence>
                  {canScrollDown && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      onClick={() => scrollContainerRef.current?.scrollBy({ top: 180, behavior: 'smooth' })}
                      className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-[11px] font-black shadow-xl backdrop-blur-md flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                    >
                      <span>Ù…Ø±Ø± Ù„Ù„Ø£Ø³ÙÙ„</span>
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
