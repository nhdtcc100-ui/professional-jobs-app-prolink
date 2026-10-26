import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wrench, Search, MapPin, RefreshCw, Phone, MessageSquare,
  Star, CheckCircle, User, ChevronDown, Loader2, X, SlidersHorizontal
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { AppUser } from '../../../types';

interface ServicesViewProps {
  appUser: AppUser | null;
  onUserClick: (user: AppUser) => void;
  onRequireAuth: (message?: string) => void;
}

const PAGE_SIZE = 10;

// بطاقة مزود الخدمة
const ServiceCard: React.FC<{
  provider: AppUser;
  index: number;
  onUserClick: (u: AppUser) => void;
  onRequireAuth: (msg?: string) => void;
  appUser: AppUser | null;
}> = ({ provider, index, onUserClick, onRequireAuth, appUser }) => {
  const displayTitle = provider.displayTitle || provider.display_title || provider.title || provider.specialty || 'مزود خدمة';
  const location = provider.location || 'غير محدد';
  const isAvailable = provider.isAvailable ?? provider.is_available ?? true;
  const isPro = provider.isPro || provider.is_pro;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="group relative bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-sm hover:shadow-xl hover:shadow-blue-500/8 transition-all duration-300 overflow-hidden"
    >
      {/* خط علوي تدريجي */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="p-4 flex items-start gap-3">
        {/* الصورة الشخصية */}
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-700 shadow-md bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20">
            {provider.avatar ? (
              <img
                src={provider.avatar}
                alt={provider.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-xl">
                {provider.name?.charAt(0) || '؟'}
              </div>
            )}
          </div>
          {/* مؤشر الإتاحة */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 shadow-sm ${
              isAvailable ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
            }`}
            title={isAvailable ? 'متاح للعمل' : 'غير متاح حالياً'}
          />
        </div>

        {/* بيانات المزود */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-black text-slate-800 dark:text-white text-sm leading-tight truncate">
                  {provider.name}
                </h3>
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black border shrink-0 ${
                  provider.role === 'freelancer'
                    ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40'
                    : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/40'
                }`}>
                  {provider.role === 'freelancer' ? 'عمل حر 🔧' : 'باحث عن عمل 💼'}
                </span>
                {isPro && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full text-[8px] font-black border border-amber-100 dark:border-amber-800/50 shrink-0">
                    <Star size={7} className="fill-current" />
                    PRO
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5 truncate">{displayTitle}</p>
              <div className="flex items-center gap-1 mt-1">
                <MapPin size={10} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate">{location}</span>
              </div>
            </div>
            {/* شارة الإتاحة */}
            <span
              className={`shrink-0 text-[8px] font-black px-2 py-1 rounded-full border ${
                isAvailable
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50'
                  : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-600'
              }`}
            >
              {isAvailable ? '🟢 متاح' : '⚫ غير متاح'}
            </span>
          </div>

          {/* الوصف المختصر */}
          {provider.bio && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 line-clamp-2 leading-relaxed">
              {provider.bio}
            </p>
          )}

          {/* أزرار التفاعل */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => onUserClick(provider)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl border border-blue-100 dark:border-blue-800/50 text-xs font-black transition-all active:scale-95"
            >
              <User size={11} />
              عرض الملف
            </button>
            <button
              onClick={() => {
                if (!appUser) {
                  onRequireAuth('سجّل الدخول للتواصل مع مزودي الخدمات 💬');
                  return;
                }
                onUserClick(provider);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl border border-slate-100 dark:border-slate-600 text-xs font-black transition-all active:scale-95"
            >
              <MessageSquare size={11} />
              تواصل
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── المكون الرئيسي ─────────────────────────────────────────────────────────
export const ServicesView: React.FC<ServicesViewProps> = ({ appUser, onUserClick, onRequireAuth }) => {
  const [searchTitle, setSearchTitle] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [providers, setProviders] = useState<AppUser[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // اقتراحات مسميات وظيفية شائعة
  const popularTitles = ['كهربائي', 'سباك', 'نجار', 'حلاق', 'مطبخ', 'دهان', 'ميكانيكي', 'تكييف', 'حداد', 'بناء'];

  const fetchProviders = useCallback(async (currentPage: number, reset = false) => {
    setLoading(true);
    try {
      let query = (supabase as any)
        .from('profiles')
        .select('id, name, avatar_url, title, specialty, location, is_available, role, is_pro, display_title, bio, is_active', { count: 'exact' })
        .in('role', ['freelancer', 'seeker', 'job_seeker'])
        .not('is_active', 'eq', false)
        .order('is_available', { ascending: false })
        .order('is_pro', { ascending: false })
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (searchTitle.trim()) {
        const titleTerm = searchTitle.trim();
        query = query.or(
          `title.ilike.%${titleTerm}%,specialty.ilike.%${titleTerm}%,display_title.ilike.%${titleTerm}%,name.ilike.%${titleTerm}%`
        );
      }
      if (searchLocation.trim()) {
        const locTerm = searchLocation.trim();
        query = query.ilike('location', `%${locTerm}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const mapped: AppUser[] = (data || []).map((p: any) => {
        const isFreelancer = p.role === 'freelancer';
        const displayTitle = p.display_title || p.title || p.specialty || (isFreelancer ? 'مقدم خدمة' : 'باحث عن وظيفة');

        return {
          id: p.id,
          name: p.name || 'مجهول',
          email: '',
          avatar: p.avatar_url || '',
          role: (isFreelancer ? 'freelancer' : 'seeker') as any,
          isPro: p.is_pro || false,
          is_pro: p.is_pro || false,
          title: p.title || '',
          displayTitle,
          specialty: p.specialty || '',
          location: p.location || '',
          isAvailable: p.is_available ?? true,
          bio: p.bio || '',
        };
      });

      if (reset) {
        setProviders(mapped);
      } else {
        setProviders(prev => [...prev, ...mapped]);
      }

      if (count !== null) setTotalCount(count);
      setHasMore(mapped.length === PAGE_SIZE);
    } catch (err) {
      console.error('[ServicesView] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTitle, searchLocation]);

  // جلب أولي عند التحميل
  useEffect(() => {
    setPage(0);
    fetchProviders(0, true);
  }, [searchTitle, searchLocation]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProviders(nextPage, false);
  };

  const handleSearch = () => {
    setPage(0);
    fetchProviders(0, true);
  };

  const handleClearSearch = () => {
    setSearchTitle('');
    setSearchLocation('');
    setPage(0);
  };

  const hasActiveSearch = searchTitle.trim() || searchLocation.trim();

  return (
    <div className="space-y-4 pb-safe-bottom" dir="rtl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600 rounded-3xl p-5 shadow-xl shadow-blue-500/20 relative overflow-hidden"
      >
        {/* خلفية زخرفية */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-2 right-4 w-24 h-24 rounded-full bg-white blur-2xl" />
          <div className="absolute bottom-2 left-8 w-16 h-16 rounded-full bg-white blur-xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
              <Wrench size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-black text-white text-lg leading-tight">سوق الخدمات والمهن الحرة</h2>
              <p className="text-blue-100 text-[10px] font-bold">
                {totalCount > 0 ? `${totalCount} كفاءة متاحة (عمل حر وباحثين عن عمل)` : 'ابحث عن أصحاب المهن والباحثين عن عمل حسب التخصص والمكان'}
              </p>
            </div>
          </div>

          {/* شريط البحث */}
          <div className="space-y-2">
            <div className="relative">
              <Wrench size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
              <input
                type="text"
                value={searchTitle}
                onChange={e => setSearchTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="المسمى الوظيفي (كهربائي، حلاق، سباك...)"
                className="w-full pr-9 pl-4 py-2.5 bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl text-white placeholder-white/50 text-sm font-bold focus:outline-none focus:bg-white/25 focus:border-white/50 transition-all"
              />
            </div>
            <div className="relative">
              <MapPin size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
              <input
                type="text"
                value={searchLocation}
                onChange={e => setSearchLocation(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="المنطقة (بغداد الكمالية، الحرية...)"
                className="w-full pr-9 pl-4 py-2.5 bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl text-white placeholder-white/50 text-sm font-bold focus:outline-none focus:bg-white/25 focus:border-white/50 transition-all"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-blue-600 font-black text-xs rounded-2xl shadow-lg hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-70"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                بحث
              </button>
              {hasActiveSearch && (
                <button
                  onClick={handleClearSearch}
                  className="px-3 py-2.5 bg-white/20 text-white font-bold text-xs rounded-2xl border border-white/30 hover:bg-white/30 transition-all active:scale-95"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* مسميات شائعة */}
      <div className="flex flex-wrap gap-2 px-1">
        {popularTitles.map((t) => (
          <button
            key={t}
            onClick={() => setSearchTitle(t)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all active:scale-95 ${
              searchTitle === t
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* نتائج البحث */}
      {hasActiveSearch && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-black text-slate-500 dark:text-slate-400">
            {loading ? 'جاري البحث...' : `${providers.length} نتيجة${totalCount > providers.length ? ` من ${totalCount}` : ''}`}
            {searchTitle && <span className="text-blue-600 dark:text-blue-400"> · {searchTitle}</span>}
            {searchLocation && <span className="text-indigo-600 dark:text-indigo-400"> · {searchLocation}</span>}
          </p>
          <button onClick={handleClearSearch} className="text-[10px] font-black text-red-500 hover:text-red-600 transition-colors">
            مسح الفلتر
          </button>
        </div>
      )}

      {/* قائمة المزودين */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {!loading && providers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-16 text-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-700"
            >
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-700">
                <Wrench size={28} className="text-slate-200 dark:text-slate-600" />
              </div>
              <p className="font-black text-slate-400 dark:text-slate-500 text-sm">
                {hasActiveSearch ? 'لا توجد نتائج مطابقة' : 'لا يوجد مزودو خدمات مسجلون بعد'}
              </p>
              <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1 font-bold">
                {hasActiveSearch ? 'جرّب تغيير كلمات البحث أو المنطقة' : 'كن أول من يسجّل خدمته في المنصة!'}
              </p>
            </motion.div>
          ) : (
            providers.map((provider, idx) => (
              <ServiceCard
                key={provider.id}
                provider={provider}
                index={idx % PAGE_SIZE}
                onUserClick={onUserClick}
                onRequireAuth={onRequireAuth}
                appUser={appUser}
              />
            ))
          )}
        </AnimatePresence>

        {/* Loading skeleton */}
        {loading && providers.length === 0 && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-4 flex gap-3 animate-pulse"
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full w-1/2" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full w-1/3" />
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full w-2/3" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-6 w-20 bg-slate-100 dark:bg-slate-700 rounded-xl" />
                    <div className="h-6 w-16 bg-slate-100 dark:bg-slate-700 rounded-xl" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* زر تحديث / تحميل المزيد */}
      {!loading && providers.length > 0 && hasMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center pt-2 pb-4"
        >
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-95 disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            عرض 10 التالية
            <ChevronDown size={13} />
          </button>
        </motion.div>
      )}

      {/* رسالة نهاية النتائج */}
      {!loading && providers.length > 0 && !hasMore && (
        <div className="text-center py-4">
          <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">
            · تم عرض جميع النتائج ({providers.length} مزود خدمة) ·
          </p>
        </div>
      )}
    </div>
  );
};
