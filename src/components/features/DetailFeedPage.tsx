import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, ChevronRight, ChevronLeft, Briefcase, MapPin, DollarSign, 
  Tag, Clock, Send, Calendar, ExternalLink, Sparkles,
  FileText, Home, Newspaper, Phone, MessageCircle
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
  const horizontalScrollRef = useRef<HTMLDivElement>(null);

  // Smooth scroll to target item in horizontal slider
  const scrollToItem = (idx: number, smooth: boolean = true) => {
    if (idx < 0 || idx >= items.length) return;
    setCurrentIndex(idx);
    const targetEl = document.getElementById(`detail-feed-item-${idx}`);
    if (targetEl) {
      targetEl.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        inline: 'center',
        block: 'nearest',
      });
    }
  };

  // Initial centering on initialIndex
  useEffect(() => {
    const target = Math.max(0, Math.min(initialIndex, (items?.length || 1) - 1));
    setCurrentIndex(target);
    const timer = setTimeout(() => {
      const el = document.getElementById(`detail-feed-item-${target}`);
      if (el) {
        el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [initialIndex]);

  // IntersectionObserver to auto-update currentIndex when user scrolls horizontally
  useEffect(() => {
    const container = horizontalScrollRef.current;
    if (!container || typeof window.IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idxStr = entry.target.getAttribute('data-item-index');
            if (idxStr !== null) {
              const idx = parseInt(idxStr, 10);
              if (!isNaN(idx)) {
                setCurrentIndex(idx);
              }
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.55,
      }
    );

    items.forEach((_, idx) => {
      const el = document.getElementById(`detail-feed-item-${idx}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items.length]);

  const goToNext = () => {
    if (currentIndex < items.length - 1) {
      scrollToItem(currentIndex + 1, true);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      scrollToItem(currentIndex - 1, true);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] z-[220] bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-white flex flex-col overflow-hidden"
      dir="rtl"
    >
      {/* ── Top Bar with Counter, Back & Direct Navigation Buttons ── */}
      <div
        className="relative z-30 flex items-center justify-between px-3 md:px-6 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 shrink-0 shadow-sm gap-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        {/* Navigation Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {type === 'news' ? (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm cursor-pointer"
              title="الرجوع للأخبار"
            >
              <ArrowRight size={15} />
              <span>الرجوع للأخبار</span>
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm cursor-pointer"
                title="رجوع للمكان السابق"
              >
                <ArrowRight size={15} />
                <span>رجوع</span>
              </button>

              <button
                onClick={handleGoHome}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer"
                title="العودة للرئيسية"
              >
                <Home size={14} className="text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">الرئيسية</span>
              </button>

              <button
                onClick={handleGoSection}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer"
                title={type === 'job' ? 'الرجوع لقسم الوظائف' : 'الرئيسية'}
              >
                {type === 'job' ? (
                  <>
                    <Briefcase size={14} className="text-indigo-600 dark:text-indigo-400" />
                    <span className="hidden sm:inline">الوظائف</span>
                  </>
                ) : (
                  <>
                    <Home size={14} className="text-blue-600 dark:text-blue-400" />
                    <span className="hidden sm:inline">المنشورات</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Counter Badge */}
        <div className="flex items-center justify-center min-w-0">
          {(() => {
            const cur = items[currentIndex];
            const isCurJob = cur?.feedType === 'job' || cur?.company !== undefined || (type === 'job' && !cur?.content);
            const isCurNews = type === 'news' || cur?.feedType === 'news';
            const itemLabel = isCurJob ? 'وظيفة' : isCurNews ? 'خبر' : 'منشور / مقال';
            return (
              <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/50 px-3 py-1 rounded-full truncate">
                {itemLabel} {currentIndex + 1} من {items.length}
              </span>
            );
          })()}
        </div>

        {/* Quick Nav arrows in RTL: Right is Prev, Left is Next */}
        {items.length > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={goToPrev}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-white transition-all active:scale-90 cursor-pointer"
              title="السابق"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={goToNext}
              disabled={currentIndex === items.length - 1}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-white transition-all active:scale-90 cursor-pointer"
              title="التالي"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        )}
      </div>

      {/* ── Floating Lateral Quick Nav Buttons (Visible on larger screens) ── */}
      {items.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={goToPrev}
              className="hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-40 w-11 h-11 items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all cursor-pointer backdrop-blur-md"
              title="الوظيفة السابقة"
            >
              <ChevronRight size={22} />
            </button>
          )}

          {currentIndex < items.length - 1 && (
            <button
              onClick={goToNext}
              className="hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 z-40 w-11 h-11 items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all cursor-pointer backdrop-blur-md"
              title="الوظيفة التالية"
            >
              <ChevronLeft size={22} />
            </button>
          )}
        </>
      )}

      {/* ── Horizontal Snap Feed Container: Native Smooth Horizontal Scrolling ── */}
      <div
        ref={horizontalScrollRef}
        className="flex-1 flex flex-row items-stretch gap-3 sm:gap-5 px-3 sm:px-6 py-2.5 overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar bg-slate-100/70 dark:bg-slate-950 overscroll-x-contain"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch' as any,
        }}
      >
        {items.map((item, index) => {
          const isItemJob = item.feedType === 'job' || item.company !== undefined || (type === 'job' && !item.content);
          const isItemNews = type === 'news' || item.feedType === 'news';
          const isActive = isItemJob ? item.is_active !== false : true;

          return (
            <div
              key={item.id || index}
              id={`detail-feed-item-${index}`}
              data-item-index={index}
              className="w-[92vw] sm:w-[94vw] md:w-[820px] max-w-[820px] h-full shrink-0 snap-center snap-always flex flex-col overflow-y-auto no-scrollbar overscroll-y-contain rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-xl diwani-neon-card relative transition-all"
              style={{
                scrollSnapAlign: 'center',
                scrollSnapStop: 'always',
              }}
            >
              {isItemJob ? (
                /* ── Job Item Full Page ── */
                <div className="max-w-3xl mx-auto w-full flex flex-col pb-6">
                  
                  {/* Job Hero Header with cover & publisher avatar */}
                  {(() => {
                    const pubUser = allUsersList.find(u => u.id === (item.employer_id || item.employerId || item.author_id || item.authorId)) ||
                      (appUser && (appUser.id === item.employerId || appUser.id === item.authorId) ? appUser : null);
                    const pubAvatar = pubUser?.avatar || item.employer_avatar || item.employerAvatar || item.authorAvatar;
                    let heroCover = item.image_url || item.imageUrl || pubUser?.coverUrl || (pubUser as any)?.cover_url || DEFAULT_NEWS_PLACEHOLDER;
                    if (heroCover && pubAvatar && heroCover === pubAvatar) {
                      heroCover = pubUser?.coverUrl || (pubUser as any)?.cover_url || DEFAULT_NEWS_PLACEHOLDER;
                    }

                    const handleOpenPublisher = () => {
                      const targetUser = pubUser || {
                        id: item.employer_id || item.employerId || item.author_id || item.authorId,
                        name: item.company || 'صاحب العمل',
                        avatar: pubAvatar,
                        isEmployer: true,
                        role: 'employer'
                      };
                      if (onPublisherClick) {
                        onClose();
                        onPublisherClick(targetUser, item);
                      } else if (setSelectedProfile) {
                        onClose();
                        setSelectedProfile(targetUser);
                        if (onNavigateTab) onNavigateTab('profile');
                      }
                    };

                    return (
                      <div 
                        onClick={handleOpenPublisher}
                        className={`relative overflow-hidden ${heroCover ? 'h-52 md:h-64' : 'h-44 md:h-52'} shrink-0 cursor-pointer group/hero`}
                        title="النقر هنا يفتح الملف المهني للناشر"
                      >
                        <img 
                          src={heroCover} 
                          alt={item.title} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover/hero:scale-105" 
                          onError={(e) => handleImageError(e, DEFAULT_NEWS_PLACEHOLDER)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                        
                        {/* Publisher profile shortcut pill */}
                        <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/45 hover:bg-black/65 backdrop-blur-md text-white text-[10px] font-black border border-white/20 transition-all shadow-md group-hover/hero:scale-105">
                          <ExternalLink size={12} />
                          <span>الملف المهني للناشر 🏢</span>
                        </div>

                        <div className="absolute bottom-5 right-5 left-5 z-10">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border mb-2.5 ${
                            isActive ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-400' : 'bg-slate-700/40 border-slate-600/30 text-slate-300'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                            {isActive ? 'التوظيف متاح الآن' : 'التوظيف مغلق'}
                          </div>
                          
                          <h1 className="text-xl md:text-2xl font-black text-white leading-tight tracking-tight drop-shadow-md">{item.title}</h1>
                          
                          <div 
                            className="flex items-center gap-2.5 mt-2 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPublisher();
                            }}
                          >
                            {pubAvatar ? (
                              <img src={pubAvatar} alt="" className="w-7 h-7 rounded-xl object-cover border border-white/30 shadow-md" />
                            ) : (
                              <div className="w-7 h-7 rounded-xl bg-blue-600/80 border border-white/20 flex items-center justify-center text-white text-xs font-black">
                                {item.company ? item.company.charAt(0) : 'P'}
                              </div>
                            )}
                            <p className="text-sm text-white/95 font-black">{item.company}</p>
                            <span className="text-[10px] font-bold text-white/60">• {timeAgo(item.postedAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Meta Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 px-4 md:px-6 pt-5">
                    {[
                      { icon: <MapPin size={13} className="text-blue-500 dark:text-blue-400" />, label: 'الموقع', value: item.location || 'عن بُعد' },
                      { icon: <Briefcase size={13} className="text-purple-500 dark:text-purple-400" />, label: 'القسم', value: getJobCategory(item) },
                      { icon: <Tag size={13} className="text-indigo-500 dark:text-indigo-400" />, label: 'نوع العمل', value: item.jobType || item.job_type || 'دوام كامل' },
                      { icon: <DollarSign size={13} className="text-emerald-500 dark:text-emerald-400" />, label: 'الراتب', value: item.salary || 'غير محدد' },
                      { icon: <Clock size={13} className="text-amber-500 dark:text-amber-400" />, label: 'ساعات العمل', value: item.working_hours || item.workingHours || 'دوام كامل' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1 shadow-xs">
                        {stat.icon}
                        <span className="text-[9px] font-bold text-slate-400">{stat.label}</span>
                        <span className="text-xs font-black text-slate-800 dark:text-white truncate">{stat.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  <div className="px-4 md:px-6 pt-5 space-y-3">
                    <h3 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                      <FileText size={15} />
                      تفاصيل الوظيفة ومتطلباتها
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed shadow-xs">
                      <BilingualSmartText text={cleanJobDescription(item.description) || 'لا يوجد وصف مفصل متاح.'} className="space-y-2.5" />
                    </div>
                  </div>

                  {item.requirements && (
                    <div className="px-4 md:px-6 pt-4 space-y-3">
                      <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles size={15} />
                        المتطلبات والمهارات المطلوبة
                      </h3>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed shadow-xs">
                        <BilingualSmartText text={item.requirements} className="space-y-2.5" />
                      </div>
                    </div>
                  )}

                  {/* Apply & Navigation Buttons */}
                  <div className="px-4 md:px-6 pt-5 space-y-2.5" style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 80px), 96px)' }}>
                    {(() => {
                      const isPublisher = !!(appUser && !appUser.isAdmin && (appUser.id === item.employerId || appUser.id === item.employer_id || appUser.id === item.authorId || appUser.id === item.author_id));
                      const isEmployer = !!(appUser && !appUser.isAdmin && appUser.role === 'employer');

                      return (
                        <button
                          onClick={() => onApplyJob?.(item)}
                          disabled={!isActive || isPublisher || isEmployer}
                          className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg cursor-pointer ${
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
                              <Send size={18} />
                              <span>التقديم المهني على الوظيفة 🚀</span>
                            </>
                          )}
                        </button>
                      );
                    })()}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleGoHome}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Home size={14} className="text-blue-500" />
                        <span>العودة للرئيسية</span>
                      </button>
                      <button
                        onClick={handleGoSection}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Briefcase size={14} className="text-indigo-500" />
                        <span>العودة للوظائف</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : !isItemNews ? (
                /* ── Post Item Full Page ── */
                <div className="max-w-3xl mx-auto w-full flex flex-col pb-6">
                  {/* Post Author Bar */}
                  <div className="flex items-center justify-between px-5 md:px-8 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.authorAvatar || 'https://ui-avatars.com/api/?background=random'}
                        alt={item.authorName}
                        className="w-12 h-12 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-md"
                      />
                      <div>
                        <h3 className="font-black text-slate-800 dark:text-white text-base leading-tight">
                          {item.authorName || 'مستخدم'}
                        </h3>
                        <p className="text-xs text-slate-400 font-bold mt-0.5">
                          {item.authorTitle || 'عضو في ProLink'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 px-3 py-1 rounded-full">
                      <Clock size={11} />
                      {timeAgo(item.timestamp || item.created_at)}
                    </span>
                  </div>

                  {/* Post Media */}
                  {item.imageUrl && (
                    <div className="relative max-h-96 shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                      <img
                        src={item.imageUrl}
                        alt="Post media"
                        className="w-full h-full max-h-96 object-contain"
                      />
                    </div>
                  )}

                  {/* Post Content */}
                  <div className="px-5 md:px-8 pt-5">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-5 md:p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
                      {item.content ? (
                        <BilingualSmartText text={item.content} className="space-y-3" />
                      ) : (
                        <p className="text-slate-400 italic">لا يوجد نص إضافي في هذا التوجيه.</p>
                      )}
                    </div>
                  </div>

                  {/* Quick Interaction Footer */}
                  <div className="px-5 md:px-8 pt-4 space-y-3" style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 72px), 88px)' }}>
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
                      <span className="text-xs font-black text-slate-400">توجيه مهني رسمي</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleGoHome}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Home size={14} className="text-blue-500" />
                        <span>العودة للرئيسية</span>
                      </button>
                      <button
                        onClick={handleGoSection}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Briefcase size={14} className="text-indigo-500" />
                        <span>الوظائف</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── News Item Full Page ── */
                <div className="max-w-3xl mx-auto w-full flex flex-col pb-6">

                  {/* News Image / Header */}
                  <div className="relative h-52 md:h-72 shrink-0 overflow-hidden">
                    <img
                      src={item.thumbnail || item.imageUrl || DEFAULT_NEWS_PLACEHOLDER}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={handleImageError}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/30 to-transparent" />
                  </div>

                  {/* News Meta */}
                  <div className="px-5 md:px-8 pt-5 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-full text-[10px] font-black bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
                        {item.category || item.source || 'أخبار مهنية'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Calendar size={12} />
                        {item.pubDate ? new Date(item.pubDate).toLocaleDateString('ar-EG') : 'اليوم'}
                      </span>
                    </div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white leading-tight">
                      {item.title}
                    </h1>
                    {item.source && (
                      <p className="text-xs font-bold text-slate-400">المصدر: {item.source}</p>
                    )}
                  </div>

                  {/* News Content */}
                  <div className="px-5 md:px-8 pt-4">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-5 md:p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
                      <BilingualSmartText text={item.content || item.description || ''} className="space-y-3.5" />
                    </div>
                  </div>

                  {/* Source Link & Quick Return */}
                  <div className="px-5 md:px-8 pt-4 space-y-2.5" style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 72px), 88px)' }}>
                    {item.link && item.link !== '#' && (
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
                        <span className="text-xs font-bold text-slate-400">المصدر الأصلي</span>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                        >
                          المقال الكامل
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleGoHome}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Home size={14} className="text-blue-500" />
                        <span>العودة للرئيسية</span>
                      </button>
                      <button
                        onClick={handleGoSection}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Newspaper size={14} className="text-emerald-500" />
                        <span>العودة للأخبار</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Fixed Floating Bottom Navigation Bar: Lateral Next & Prev with Touch Feedback ── */}
      {items.length > 1 && (
        <div 
          className="relative z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 shadow-xl shrink-0"
          style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 8px), 12px)' }}
        >
          {/* In RTL: Right button is Previous */}
          <button
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer shadow-xs"
          >
            <ChevronRight size={16} />
            <span>{type === 'job' ? 'الوظيفة السابقة' : type === 'news' ? 'الخبر السابق' : 'السابق'}</span>
          </button>
          
          <div className="flex flex-col items-center justify-center px-3">
            <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 font-mono">
              {currentIndex + 1} / {items.length}
            </span>
          </div>

          {/* In RTL: Left button is Next */}
          <button
            onClick={goToNext}
            disabled={currentIndex === items.length - 1}
            className="flex-1 py-2.5 px-4 bg-blue-600 disabled:opacity-30 hover:bg-blue-700 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <span>{type === 'job' ? 'الوظيفة التالية' : type === 'news' ? 'الخبر التالي' : 'التالي'}</span>
            <ChevronLeft size={16} />
          </button>
        </div>
      )}
    </motion.div>
  );
};
