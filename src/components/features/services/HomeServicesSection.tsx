import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wrench, Search, MapPin, RefreshCw, MessageSquare,
  Star, ChevronDown, Loader2, X
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { AppUser } from '../../../types';

interface HomeServicesSectionProps {
  appUser: AppUser | null;
  onUserClick: (user: AppUser) => void;
  onRequireAuth: (message?: string) => void;
}

const PAGE_SIZE = 10;

const SERVICE_CHIPS = [
  'عامل',
  'كهربائي',
  'سباك',
  'نجار',
  'حلاق',
  'بناء',
  'دهان',
  'ميكانيكي',
  'حداد',
  'تكييف',
  'تنظيف'
];

export const HomeServicesSection: React.FC<HomeServicesSectionProps> = ({
  appUser,
  onUserClick,
  onRequireAuth,
}) => {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [providers, setProviders] = useState<AppUser[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // دالة الاستعلام المباشر من قاعدة بيانات Supabase
  const executeSearch = useCallback(async (currentPage: number, reset: boolean) => {
    setLoading(true);
    try {
      let query = (supabase as any)
        .from('profiles')
        .select(
          'id, name, avatar_url, title, specialty, location, is_available, role, is_pro, display_title, bio, is_active, phone',
          { count: 'exact' }
        )
        .eq('role', 'freelancer')
        .not('is_active', 'eq', false)
        .order('is_available', { ascending: false })
        .order('is_pro', { ascending: false })
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      // تصفية المهنة / المسمى
      if (keyword.trim()) {
        const cleanKeyword = keyword.trim();
        query = query.or(
          `title.ilike.%${cleanKeyword}%,specialty.ilike.%${cleanKeyword}%,display_title.ilike.%${cleanKeyword}%,bio.ilike.%${cleanKeyword}%`
        );
      }

      // تصفية الموقع الجغرافي: إذا كان فارغاً يأتي بجميع المناطق، وإذا حُدد يُقيد بالمنطقة فقط
      if (location.trim()) {
        const cleanLocation = location.trim();
        query = query.ilike('location', `%${cleanLocation}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      const mapped: AppUser[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name || 'مجهول',
        email: '',
        avatar: p.avatar_url || '',
        role: 'freelancer',
        isPro: p.is_pro || false,
        is_pro: p.is_pro || false,
        title: p.title || '',
        displayTitle: p.display_title || p.title || p.specialty || '',
        specialty: p.specialty || '',
        location: p.location || '',
        isAvailable: p.is_available ?? true,
        bio: p.bio || '',
      }));

      if (reset) {
        setProviders(mapped);
      } else {
        setProviders(prev => [...prev, ...mapped]);
      }

      if (count !== null && count !== undefined) {
        setTotalCount(count);
      }
      setHasMore(mapped.length === PAGE_SIZE);
    } catch (err) {
      console.error('[HomeServicesSection] Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [keyword, location]);

  // جلب أولي تلقائي
  useEffect(() => {
    setPage(0);
    executeSearch(0, true);
  }, []);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPage(0);
    executeSearch(0, true);
  };

  const handleSelectChip = (chipText: string) => {
    const nextKeyword = keyword === chipText ? '' : chipText;
    setKeyword(nextKeyword);
    setPage(0);
    // Execute immediately
    setLoading(true);
    let query = (supabase as any)
      .from('profiles')
      .select('id, name, avatar_url, title, specialty, location, is_available, role, is_pro, display_title, bio, is_active', { count: 'exact' })
      .eq('role', 'freelancer')
      .not('is_active', 'eq', false)
      .order('is_available', { ascending: false })
      .order('is_pro', { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (nextKeyword) {
      query = query.or(`title.ilike.%${nextKeyword}%,specialty.ilike.%${nextKeyword}%,display_title.ilike.%${nextKeyword}%`);
    }
    if (location.trim()) {
      query = query.ilike('location', `%${location.trim()}%`);
    }

    query.then(({ data, count }: any) => {
      const mapped = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name || 'مجهول',
        email: '',
        avatar: p.avatar_url || '',
        role: 'freelancer',
        isPro: p.is_pro || false,
        is_pro: p.is_pro || false,
        title: p.title || '',
        displayTitle: p.display_title || p.title || p.specialty || '',
        specialty: p.specialty || '',
        location: p.location || '',
        isAvailable: p.is_available ?? true,
        bio: p.bio || '',
      }));
      setProviders(mapped);
      if (count !== null) setTotalCount(count);
      setHasMore(mapped.length === PAGE_SIZE);
      setLoading(false);
    });
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    executeSearch(nextPage, false);
  };

  const handleClearFilters = () => {
    setKeyword('');
    setLocation('');
    setPage(0);
    setTimeout(() => {
      executeSearch(0, true);
    }, 50);
  };

  return (
    <div
      className="relative rounded-[26px] overflow-hidden mb-4 mx-1 sm:mx-0 transition-all duration-300"
      style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(226, 232, 240, 0.85)',
        boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03)',
      }}
      dir="rtl"
    >
      {/* Dark mode overlay */}
      <div className="absolute inset-0 dark:bg-slate-900/90 pointer-events-none transition-colors" />

      {/* Ambient background glows */}
      <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 p-4 sm:p-5 space-y-3.5">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Wrench size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                سوق الخدمات والمهن الحرة
              </h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                {totalCount > 0
                  ? `${totalCount} مهني مسجل في قاعدة البيانات`
                  : 'ابحث عن أصحاب المهن الحرفية والخدمات'}
              </p>
            </div>
          </div>

          {(keyword || location) && (
            <button
              onClick={handleClearFilters}
              className="text-[11px] font-bold text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              مسح الفلتر
            </button>
          )}
        </div>

        {/* Dual Search Fields (Profession + Location) */}
        <form onSubmit={handleSearchSubmit} className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* 1. حقل المهنة */}
            <div className="relative">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="المهنة (مثلاً: عامل، كهربائي، حلاق...)"
                className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* 2. حقل الموقع والمنطقة */}
            <div className="relative">
              <MapPin size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="المنطقة (اختياري: بغداد، الكمالية...)"
                className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-98 disabled:opacity-70"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            بحث في قاعدة البيانات
          </button>
        </form>

        {/* Quick Profession Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
          {SERVICE_CHIPS.map(chip => {
            const isSelected = keyword === chip;
            return (
              <button
                key={chip}
                onClick={() => handleSelectChip(chip)}
                className={`shrink-0 px-2.5 py-1 rounded-xl text-[10px] font-black transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-700'
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>

        {/* Providers List */}
        <div className="space-y-2.5 pt-1">
          {loading && providers.length === 0 ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : providers.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <Wrench size={22} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-black text-slate-500 dark:text-slate-400">
                {keyword || location ? 'لا توجد نتائج مطابقة لبحثك' : 'لا يوجد مهنيون مسجلون حالياً'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                جرّب إزالة اسم المنطقة أو تغيير المهنة
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {providers.map((p, idx) => {
                const title = p.displayTitle || p.title || p.specialty || 'مهني حر';
                const loc = p.location || 'غير محدد';
                const isAvail = p.isAvailable ?? true;

                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700/60 shadow-xs hover:shadow-md transition-all flex items-start gap-2.5 group"
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 border border-slate-100 dark:border-slate-700">
                        {p.avatar ? (
                          <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-black text-blue-600 dark:text-blue-400 text-sm">
                            {p.name?.charAt(0) || '؟'}
                          </div>
                        )}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${
                          isAvail ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                        title={isAvail ? 'متاح للعمل' : 'غير متاح'}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 truncate">
                          <h4 className="text-xs font-black text-slate-800 dark:text-white truncate">
                            {p.name}
                          </h4>
                          {p.isPro && (
                            <span className="shrink-0 text-[8px] font-black text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-1 py-0.2 rounded-md">
                              PRO
                            </span>
                          )}
                        </div>
                        <span
                          className={`shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                            isAvail
                              ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                              : 'text-slate-400 bg-slate-100 dark:bg-slate-700'
                          }`}
                        >
                          {isAvail ? 'متاح' : 'مشغول'}
                        </span>
                      </div>

                      <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 truncate mt-0.5">
                        {title}
                      </p>

                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                        <MapPin size={9} className="shrink-0" />
                        <span className="truncate">{loc}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          onClick={() => onUserClick(p)}
                          className="flex-1 py-1 px-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white text-[10px] font-black transition-colors"
                        >
                          عرض الملف
                        </button>
                        <button
                          onClick={() => {
                            if (!appUser) {
                              onRequireAuth('سجّل الدخول للتواصل مع مزود الخدمة 💬');
                              return;
                            }
                            onUserClick(p);
                          }}
                          className="py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-800 hover:text-white text-[10px] font-black transition-colors"
                        >
                          <MessageSquare size={10} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Load More Button */}
        {!loading && providers.length > 0 && hasMore && (
          <div className="flex justify-center pt-1">
            <button
              onClick={handleLoadMore}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black transition-all active:scale-95"
            >
              <RefreshCw size={12} />
              عرض 10 التالية
              <ChevronDown size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
