import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, ChevronUp, ChevronDown, ChevronRight, ChevronLeft, Briefcase, MapPin, DollarSign, 
  Tag, Clock, Send, Calendar, ExternalLink, Sparkles,
  FileText, Home, Newspaper, Phone, MessageCircle
} from 'lucide-react';
import { Job, AppUser } from '../../types';
import { formatNewsText, RECOGNIZED_LOCATIONS, WORKING_HOURS_KEYWORDS } from '../../lib/utils/formatNews';
import { safeTimeAgo } from '../../lib/utils/formatDate';
import { BilingualSmartText } from '../../lib/utils/bilingualText';
import { JobCandidatesPanel } from './missions/JobCandidatesPanel';
import { useAppContext } from '../../contexts/AppContext';
import { getJobCategory, cleanJobDescription } from '../../lib/utils/jobCategoryUtils';
import { DEFAULT_NEWS_PLACEHOLDER, handleImageError } from '../../lib/utils/placeholders';

// ── Smart text renderer: detects phone numbers, URLs, emails, salaries, locations, and working hours ──
const SmartText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  if (!text) return null;
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const phonePattern = /((?:\+?964|0)7[0-9]{9})/g;
  const emailPattern = /([\w.-]+@[\w.-]+\.[a-z]{2,})/gi;
  // Regex to detect salaries and amounts in Arabic and English (e.g. 500,000, 500 الف, 750$, مليون دينار, 1000$)
  const salaryPattern = /((?:راتب|الراتب|أجر|اجر|مكافأة)?\s*(?:[\d٠-٩,.]+|\d+)\s*(?:ألف|الف|مليون|دولار|دينار|\$|IQD|USD|k)?)/gi;

  const combined = /(https?:\/\/[^\s]+|(?:\+?964|0)7[0-9]{9}|[\w.-]+@[\w.-]+\.[a-z]{2,})/g;

  return (
    <p className={className}>
      {text.split(combined).map((part, i) => {
        if (!part) return null;
        if (urlPattern.test(part)) {
          urlPattern.lastIndex = 0;
          const url = part;
          let label = 'رابط';
          let colorClass = 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30';
          let Icon = ExternalLink;
          if (url.includes('wa.me') || url.includes('whatsapp')) { label = 'WhatsApp'; colorClass = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30'; Icon = MessageCircle; }
          else if (url.includes('t.me')) { label = 'Telegram'; colorClass = 'text-sky-600 bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800/30'; Icon = Send; }
          else if (url.includes('linkedin.com')) { label = 'LinkedIn'; colorClass = 'text-[#0a66c2] bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30'; }
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 font-black ${colorClass} px-2.5 py-1 rounded-xl border text-[11px] mx-0.5 shadow-sm hover:scale-105 transition-all my-0.5`}>
              <Icon size={11} /> {label}
            </a>
          );
        }
        if (phonePattern.test(part)) {
          phonePattern.lastIndex = 0;
          const clean = part.replace(/\s/g, '');
          return (
            <span key={i}
              onClick={() => window.open(`tel:${clean}`)}
              className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-xl border border-blue-200 dark:border-blue-800/30 font-black text-[11px] mx-0.5 shadow-sm hover:scale-105 transition-all cursor-pointer my-0.5">
              <Phone size={11} /> {part}
            </span>
          );
        }
        if (emailPattern.test(part)) {
          emailPattern.lastIndex = 0;
          return (
            <a key={i} href={`mailto:${part}`}
              className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 font-black text-[11px] mx-0.5 shadow-sm hover:scale-105 transition-all my-0.5">
              <Send size={11} /> {part}
            </a>
          );
        }

        // Sub-split words to highlight locations and working hours
        const words = part.split(' ');
        return (
          <span key={i}>
            {words.map((word, wIdx) => {
              const cleanWord = word.replace(/[،؛:.!?]/g, '').trim();
              const isLocation = RECOGNIZED_LOCATIONS.includes(cleanWord);
              const isWorkingHour = WORKING_HOURS_KEYWORDS.some(kw => word.includes(kw));

              if (isLocation) {
                return (
                  <span key={wIdx} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-black text-xs border border-blue-200/50 dark:border-blue-800/50">
                    <MapPin size={10} className="text-blue-500" />
                    {word}{' '}
                  </span>
                );
              }
              if (isWorkingHour) {
                return (
                  <span key={wIdx} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-black text-xs border border-amber-200/50 dark:border-amber-800/50">
                    <Clock size={10} className="text-amber-500" />
                    {word}{' '}
                  </span>
                );
              }
              return word + ' ';
            })}
          </span>
        );
      })}
    </p>
  );
};

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
  onLike,
  onDislike,
  onAddComment,
  allUsers = [],
  onPublisherClick,
}) => {
  const { setSelectedProfile, allUsers: contextAllUsers } = useAppContext();
  const allUsersList = allUsers.length > 0 ? allUsers : contextAllUsers;
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, items.length - 1))
  );
  const [isFeedReady, setIsFeedReady] = useState(initialIndex === 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // ── Single Vertical Scroll IntersectionObserver: Tracks active job/item accurately ──
  useEffect(() => {
    const rootEl = containerRef.current;
    if (!rootEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(idx)) {
              setCurrentIndex(idx);
            }
          }
        });
      },
      {
        root: rootEl,
        threshold: 0.55,
      }
    );

    sectionRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  // Initial positioning: Instant scroll before revealing feed to eliminate any jumping or visible scrolling
  useEffect(() => {
    if (initialIndex > 0) {
      const el = sectionRefs.current[initialIndex];
      const root = containerRef.current;
      if (root && el) {
        root.scrollTop = el.offsetTop;
      }
      const timer = setTimeout(() => {
        if (root && el) {
          root.scrollTop = el.offsetTop;
        }
        setIsFeedReady(true);
      }, 30);
      return () => clearTimeout(timer);
    } else {
      setIsFeedReady(true);
    }
  }, [initialIndex]);

  const scrollToItem = (index: number) => {
    if (index >= 0 && index < items.length) {
      sectionRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const goToNext = () => {
    if (currentIndex < items.length - 1) {
      scrollToItem(currentIndex + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      scrollToItem(currentIndex - 1);
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
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] z-[220] bg-white dark:bg-slate-950 text-slate-800 dark:text-white flex flex-col overflow-hidden"
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm"
              title="الرجوع للأخبار"
            >
              <ArrowRight size={15} />
              <span>الرجوع للأخبار</span>
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm"
                title="رجوع للمكان السابق"
              >
                <ArrowRight size={15} />
                <span>رجوع</span>
              </button>

              <button
                onClick={handleGoHome}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all active:scale-95"
                title="العودة للرئيسية"
              >
                <Home size={14} className="text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">الرئيسية</span>
              </button>

              <button
                onClick={handleGoSection}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all active:scale-95"
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

        {/* Quick Nav arrows */}
        {type !== 'job' && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => scrollToItem(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-white transition-all active:scale-90"
              title="السابق"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={() => scrollToItem(currentIndex + 1)}
              disabled={currentIndex === items.length - 1}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-white transition-all active:scale-90"
              title="التالي"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        )}
      </div>

      {/* ── Single Continuous Smooth Vertical Feed (No Snapping, Free Browsing) ── */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto no-scrollbar overscroll-contain bg-slate-50/50 dark:bg-slate-950 scroll-smooth transition-opacity duration-200 ${isFeedReady ? 'opacity-100' : 'opacity-0'}`}
        style={{
          overscrollBehaviorY: 'contain',
          WebkitOverflowScrolling: 'touch' as any,
        }}
      >
        {items.map((item, index) => {
          if (!item) return null;
          const isItemJob = item.feedType === 'job' || item.company !== undefined || (type === 'job' && !item.content);
          const isItemNews = type === 'news' || item.feedType === 'news';
          const isActive = isItemJob ? item.is_active !== false : true;
          const isLast = index === items.length - 1;

          return (
            <section
              key={item.id || index}
              id={`detail-item-${index}`}
              data-index={index}
              ref={(el) => { sectionRefs.current[index] = el; }}
              className="border-b-4 border-slate-200/60 dark:border-slate-800/80 last:border-b-0 w-full flex flex-col bg-white dark:bg-slate-950 py-2 sm:py-4 transition-colors"
            >
              {isItemJob ? (
                /* ── Job Item Full Page ── */
                <div className="max-w-3xl mx-auto w-full flex flex-col pb-6">
                  
                  {/* Job Hero Header with cover & publisher avatar */}
                  {(() => {
                    const pubUser = allUsersList.find(u => u.id === (item.employer_id || item.employerId || item.author_id || item.authorId)) ||
                      (appUser && (appUser.id === item.employerId || appUser.id === item.authorId) ? appUser : null);
                    const pubAvatar = pubUser?.avatar || item.employer_avatar || item.employerAvatar || item.authorAvatar;
                    // Ensure cover is distinct from personal avatar photo
                    let heroCover = item.image_url || item.imageUrl || pubUser?.coverUrl || (pubUser as any)?.cover_url;
                    if (heroCover && pubAvatar && heroCover === pubAvatar) {
                      heroCover = pubUser?.coverUrl || (pubUser as any)?.cover_url || null;
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
                        {heroCover ? (
                          <img src={heroCover} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover/hero:scale-105" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#0a66c2] via-[#0d5ca8] to-[#003d7a] relative overflow-hidden">
                            <div className="absolute inset-0 opacity-10 flex items-center justify-center scale-150"><Briefcase size={100} className="text-white" /></div>
                            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
                          </div>
                        )}
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
                      <div key={i} className="bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1 shadow-sm">
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
                    <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed shadow-sm">
                      <BilingualSmartText text={cleanJobDescription(item.description) || 'لا يوجد وصف مفصل متاح.'} className="space-y-2.5" />
                    </div>
                  </div>

                  {item.requirements && (
                    <div className="px-4 md:px-6 pt-4 space-y-3">
                      <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles size={15} />
                        المتطلبات والمهارات المطلوبة
                      </h3>
                      <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed shadow-sm">
                        <BilingualSmartText text={item.requirements} className="space-y-2.5" />
                      </div>
                    </div>
                  )}

                  {/* Apply & Navigation Buttons — padded above MobileNav */}
                  <div className="px-4 md:px-6 pt-5 space-y-2.5" style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 80px), 96px)' }}>
                    {(() => {
                      const isPublisher = !!(appUser && !appUser.isAdmin && (appUser.id === item.employerId || appUser.id === item.employer_id || appUser.id === item.authorId || appUser.id === item.author_id));
                      const isEmployer = !!(appUser && !appUser.isAdmin && appUser.role === 'employer');

                      return (
                        <button
                          onClick={() => onApplyJob?.(item)}
                          disabled={!isActive || isPublisher || isEmployer}
                          className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg ${
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
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Home size={14} className="text-blue-500" />
                        <span>العودة للرئيسية</span>
                      </button>
                      <button
                        onClick={handleGoSection}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Briefcase size={14} className="text-indigo-500" />
                        <span>العودة للوظائف</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : !isItemNews ? (
                /* ── Post Item Full Page with Snap-Scroll ── */
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

                  {/* Post Media (Image or Video) */}
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
                    <div className="bg-slate-50 dark:bg-slate-900 p-5 md:p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      {item.content ? (
                        <BilingualSmartText text={item.content} className="space-y-3" />
                      ) : (
                        <p className="text-slate-400 italic">لا يوجد نص إضافي في هذا التوجيه.</p>
                      )}
                    </div>
                  </div>

                  {/* Quick Interaction Footer */}
                  <div className="px-5 md:px-8 pt-4 space-y-3" style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 72px), 88px)' }}>
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <span className="text-xs font-black text-slate-400">توجيه مهني رسمي</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleGoHome}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Home size={14} className="text-blue-500" />
                        <span>العودة للرئيسية</span>
                      </button>
                      <button
                        onClick={handleGoSection}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
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

                  {/* News Content — with Bilingual smart alignment & link/phone detection */}
                  <div className="px-5 md:px-8 pt-4">
                    <div className="bg-slate-50 dark:bg-slate-900 p-5 md:p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <BilingualSmartText text={item.content || item.description || ''} className="space-y-3.5" />
                    </div>
                  </div>

                  {/* Source Link & Quick Return — padded above MobileNav */}
                  <div className="px-5 md:px-8 pt-4 space-y-2.5" style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 72px), 88px)' }}>
                    {item.link && item.link !== '#' && (
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                        <span className="text-xs font-bold text-slate-400">المصدر الأصلي</span>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all shadow-md"
                        >
                          المقال الكامل
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleGoHome}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Home size={14} className="text-blue-500" />
                        <span>العودة للرئيسية</span>
                      </button>
                      <button
                        onClick={handleGoSection}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Newspaper size={14} className="text-emerald-500" />
                        <span>العودة للأخبار</span>
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* ── Fixed Floating Bottom Navigation Bar (Hidden for jobs to match news details navigation) ── */}
      {type !== 'job' && (
        <div 
          className="relative z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 shadow-xl shrink-0"
          style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 8px), 12px)' }}
        >
          <button
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer shadow-xs"
          >
            <ChevronUp size={16} />
            <span>{type === 'news' ? 'الخبر السابق' : 'السابق'}</span>
          </button>
          
          <div className="flex flex-col items-center justify-center px-3">
            <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 font-mono">
              {currentIndex + 1} / {items.length}
            </span>
            <span className="text-[9px] text-slate-400 font-bold hidden sm:inline">سحب عمودي سلس</span>
          </div>

          <button
            onClick={goToNext}
            disabled={currentIndex === items.length - 1}
            className="flex-1 py-2.5 px-4 bg-blue-600 disabled:opacity-30 hover:bg-blue-700 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <span>{type === 'news' ? 'الخبر التالي' : 'التالي'}</span>
            <ChevronDown size={16} />
          </button>
        </div>
      )}
    </motion.div>
  );
};
