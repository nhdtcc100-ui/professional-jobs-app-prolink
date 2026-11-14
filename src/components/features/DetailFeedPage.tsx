import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, Briefcase, MapPin, DollarSign, 
  Tag, Clock, Send, Calendar, ExternalLink, Sparkles,
  FileText, Home, Newspaper
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

  // Professional Card Stack Motion Variants
  const cardVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? -160 : dir < 0 ? 160 : 0,
      opacity: 0.25,
      scale: 0.92,
      rotateY: dir > 0 ? -5 : dir < 0 ? 5 : 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      rotateY: 0,
      transition: {
        type: 'spring',
        stiffness: 350,
        damping: 30,
        mass: 0.9,
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? 160 : -160,
      opacity: 0,
      scale: 0.92,
      rotateY: dir > 0 ? 5 : -5,
      transition: {
        type: 'spring',
        stiffness: 350,
        damping: 30,
      },
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] z-[220] bg-slate-100/95 dark:bg-slate-950 text-slate-800 dark:text-white flex flex-col overflow-hidden"
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

      {/* ── Main Viewport: Professional Card Deck Motion Switcher ── */}
      <div
        className="flex-1 min-h-0 w-full flex items-center justify-center relative overflow-hidden px-2 sm:px-4 py-2 bg-slate-100/70 dark:bg-slate-950"
        style={{ perspective: 1200 }}
      >
        {/* Peek Card: Next Card on Left (In RTL, Left is Next) */}
        {currentIndex < items.length - 1 && (
          <div
            onClick={goToNext}
            className="hidden sm:flex absolute left-2 md:left-6 w-16 md:w-28 h-[88%] rounded-3xl opacity-35 hover:opacity-60 dark:opacity-20 dark:hover:opacity-40 scale-90 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer shadow-lg overflow-hidden transition-all z-0 items-center justify-center p-2 text-center"
            title="الوظيفة التالية"
          >
            <span className="text-[10px] font-black text-slate-500 line-clamp-3 leading-tight select-none pointer-events-none">
              {items[currentIndex + 1]?.title || 'الوظيفة التالية'}
            </span>
          </div>
        )}

        {/* Peek Card: Prev Card on Right (In RTL, Right is Previous) */}
        {currentIndex > 0 && (
          <div
            onClick={goToPrev}
            className="hidden sm:flex absolute right-2 md:right-6 w-16 md:w-28 h-[88%] rounded-3xl opacity-35 hover:opacity-60 dark:opacity-20 dark:hover:opacity-40 scale-90 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer shadow-lg overflow-hidden transition-all z-0 items-center justify-center p-2 text-center"
            title="الوظيفة السابقة"
          >
            <span className="text-[10px] font-black text-slate-500 line-clamp-3 leading-tight select-none pointer-events-none">
              {items[currentIndex - 1]?.title || 'الوظيفة السابقة'}
            </span>
          </div>
        )}

        {/* ── Active Card with Cinematic Framer Motion Transition ── */}
        <AnimatePresence mode="popLayout" custom={direction}>
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
            dragElastic={0.25}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = offset.x;
              if (swipe < -45 || velocity.x < -300) {
                // In RTL: swipe left goes to next job
                goToNext();
              } else if (swipe > 45 || velocity.x > 300) {
                // In RTL: swipe right goes to previous job
                goToPrev();
              }
            }}
            className="w-full sm:w-[92vw] md:w-[780px] max-w-[780px] h-full flex flex-col rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-2xl relative overflow-hidden z-10 diwani-neon-card"
          >
            {isCurJob ? (
              /* ── Job View: الكارد العلوي (الغلاف والعنوان والناشر) ثابت 100%، والتفاصيل سكرول داخلي ── */
              <div className="flex flex-col h-full w-full overflow-hidden">
                
                {/* ── 1. FIXED TOP HERO CARD: ثابت رغم السكرول ── */}
                {(() => {
                  const pubUser = allUsersList.find(u => u.id === (currentItem.employer_id || currentItem.employerId || currentItem.author_id || currentItem.authorId)) ||
                    (appUser && (appUser.id === currentItem.employerId || appUser.id === currentItem.authorId) ? appUser : null);
                  const pubAvatar = pubUser?.avatar || currentItem.employer_avatar || currentItem.employerAvatar || currentItem.authorAvatar;
                  let heroCover = currentItem.image_url || currentItem.imageUrl || pubUser?.coverUrl || (pubUser as any)?.cover_url || DEFAULT_NEWS_PLACEHOLDER;
                  if (heroCover && pubAvatar && heroCover === pubAvatar) {
                    heroCover = pubUser?.coverUrl || (pubUser as any)?.cover_url || DEFAULT_NEWS_PLACEHOLDER;
                  }
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

                {/* ── 2. INTERNAL SCROLLABLE DETAILS: ينزل بسكرول كامل مستقل ── */}
                <div 
                  className="flex-1 min-h-0 overflow-y-auto no-scrollbar overscroll-y-contain px-4 md:px-6 py-4 space-y-4"
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
                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-4 space-y-4">
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
              </div>
            ) : (
              /* ── News View: الجزء العلوي ثابت والتفاصيل سكرول ── */
              <div className="flex flex-col h-full w-full overflow-hidden">
                {/* Fixed News Hero */}
                <div className="shrink-0 relative h-48 sm:h-56 overflow-hidden rounded-t-3xl bg-slate-950 border-b border-slate-200/80 dark:border-slate-800 z-10">
                  <img
                    src={currentItem.thumbnail || currentItem.imageUrl || DEFAULT_NEWS_PLACEHOLDER}
                    alt={currentItem.title}
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-4 right-4 left-4 z-10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-blue-500/20 border border-blue-400/30 text-blue-300">
                        {currentItem.category || currentItem.source || 'أخبار'}
                      </span>
                      <span className="text-[10px] font-bold text-white/70 flex items-center gap-1">
                        <Calendar size={11} />
                        {currentItem.pubDate ? new Date(currentItem.pubDate).toLocaleDateString('ar-EG') : 'اليوم'}
                      </span>
                    </div>
                    <h1 className="text-base sm:text-lg md:text-xl font-black text-white leading-tight line-clamp-2">
                      {currentItem.title}
                    </h1>
                  </div>
                </div>

                {/* Scrollable News Content */}
                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-4 space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed shadow-xs">
                    <BilingualSmartText text={currentItem.content || currentItem.description || ''} className="space-y-3" />
                  </div>

                  {currentItem.link && currentItem.link !== '#' && (
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
                      <span className="text-xs font-bold text-slate-400">المصدر الأصلي</span>
                      <a
                        href={currentItem.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                      >
                        المقال الكامل
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  )}
                </div>

                {/* ── Fixed News Bottom Bar: ثابت أسفل كارد الأخبار ── */}
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
                      title="العودة للأخبار"
                    >
                      <Newspaper size={14} className="text-emerald-500" />
                      <span>العودة للأخبار</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
