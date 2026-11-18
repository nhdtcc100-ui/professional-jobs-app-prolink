import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wrench, Search, MapPin, RefreshCw, MessageSquare,
  Star, User, ChevronDown, Loader2, X
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { AppUser } from '../../../types';
import { mockDataService } from '../../../lib/services/mockDataService';
import { withTimeout } from '../../../lib/utils/withTimeout';

interface ServicesViewProps {
  appUser: AppUser | null;
  onUserClick: (user: AppUser) => void;
  onRequireAuth: (message?: string) => void;
}

const PAGE_SIZE = 10;
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 20;
type ProviderPage = { data: AppUser[]; count: number; cachedAt: number };
// Memory only: never reuse one viewer's results for another viewer.
const providerCache = new Map<string, ProviderPage>();
const providerCacheKey = (viewerId: string | null, title: string, location: string, page: number) =>
  JSON.stringify([viewerId, [title, location, page]]);
const isFresh = (entry: ProviderPage) => Date.now() - entry.cachedAt < CACHE_TTL_MS;

function cacheProviderPage(key: string, entry: ProviderPage) {
  providerCache.delete(key);
  providerCache.set(key, entry);
  while (providerCache.size > CACHE_MAX_ENTRIES) {
    providerCache.delete(providerCache.keys().next().value!);
  }
}

// Escape LIKE wildcards, then quote the entire value for PostgREST's .or grammar.
// PostgREST also treats '*' as '%'; discard that operator, preserving Arabic names.
const searchPattern = (term: string) => `%${term.replace(/\*/g, '').replace(/[\\%_]/g, '\\$&')}%`;
const quoteFilterValue = (value: string) => `"${value.replace(/[\\"]/g, '\\$&')}"`;

async function fetchProviderPage(viewerId: string | null, title: string, location: string, page: number, signal: AbortSignal): Promise<ProviderPage> {
  let query = supabase.from('profiles')
    .select('id, name, avatar_url, title, specialty, location, is_available, role, is_pro, display_title, bio, is_active', { count: 'exact' })
    .in('role', ['freelancer', 'seeker', 'job_seeker'])
    .not('is_active', 'eq', false)
    .order('is_available', { ascending: false })
    .order('is_pro', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (title) {
    const term = quoteFilterValue(searchPattern(title));
    query = query.or(['title', 'specialty', 'display_title', 'name'].map(column => `${column}.ilike.${term}`).join(','));
  }
  if (location) query = query.ilike('location', searchPattern(location));
  const { data, error, count } = await withTimeout(query.abortSignal(signal), 10_000, 'ServicesView.providers');
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (error) throw error;
  const entry: ProviderPage = {
    data: (data || []).map(p => ({
      id: p.id, name: p.name || 'مجهول', email: '', avatar: p.avatar_url || '',
      role: p.role === 'freelancer' ? 'freelancer' : 'seeker',
      isPro: p.is_pro || false, is_pro: p.is_pro || false, title: p.title || '',
      displayTitle: p.display_title || p.title || p.specialty || (p.role === 'freelancer' ? 'مقدم خدمة' : 'باحث عن وظيفة'),
      specialty: p.specialty || '', location: p.location || '', isAvailable: Boolean(p.is_available), bio: p.bio || '',
    })),
    count: count ?? 0, cachedAt: Date.now(),
  };
  cacheProviderPage(providerCacheKey(viewerId, title, location, page), entry);
  return entry;
}

export async function prefetchServices(viewerId: string | null, signal: AbortSignal): Promise<void> {
  if (signal.aborted || mockDataService.isEnabled()) return;
  const cached = providerCache.get(providerCacheKey(viewerId, '', '', 0));
  if (!cached || !isFresh(cached)) await fetchProviderPage(viewerId, '', '', 0, signal);
}

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
      className="group relative bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-sm hover:shadow-xl hover:shadow-blue-500/8 transition-all duration-300 overflow-hidden diwani-neon-card"
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

// ── بيانات تصنيفات الخدمات ─────────────────────────────────────────────────
const SERVICE_CATEGORIES = [
  { id: 'electric',  label: 'كهربائي',   search: 'كهربائي',  icon: '⚡', grad: ['#F59E0B','#D97706'], deco: ['💡','🔌'] },
  { id: 'plumber',   label: 'سباك',      search: 'سباك',     icon: '🔧', grad: ['#3B82F6','#0891B2'], deco: ['💧','🚿'] },
  { id: 'carpenter', label: 'نجار',      search: 'نجار',     icon: '🪵', grad: ['#92400E','#B45309'], deco: ['🪚','🔨'] },
  { id: 'painter',   label: 'دهان',      search: 'دهان',     icon: '🖌️', grad: ['#EC4899','#F43F5E'], deco: ['🎨','✏️'] },
  { id: 'builder',   label: 'بنّاء',    search: 'بناء',     icon: '🧱', grad: ['#EA580C','#DC2626'], deco: ['⚒️','🏗️'] },
  { id: 'mechanic',  label: 'ميكانيكي', search: 'ميكانيكي', icon: '🔩', grad: ['#475569','#374151'], deco: ['⚙️','🛠️'] },
  { id: 'ac',        label: 'تكييف',    search: 'تكييف',    icon: '❄️', grad: ['#0EA5E9','#2563EB'], deco: ['🌬️','🌡️'] },
  { id: 'barber',    label: 'حلاق',     search: 'حلاق',     icon: '✂️', grad: ['#8B5CF6','#7C3AED'], deco: ['💈','🪒'] },
  { id: 'welder',    label: 'حدّاد',   search: 'حداد',     icon: '⛓️', grad: ['#B91C1C','#92400E'], deco: ['🔥','⚒️'] },
  { id: 'kitchen',   label: 'مطبخ',    search: 'مطبخ',     icon: '🍳', grad: ['#059669','#0D9488'], deco: ['🥘','🫕'] },
];

// ── المكون الرئيسي ─────────────────────────────────────────────────────────
export const ServicesView: React.FC<ServicesViewProps> = ({ appUser, onUserClick, onRequireAuth }) => {
  const viewerId = appUser?.id ?? null;
  const [searchTitle, setSearchTitle] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [debouncedTitle, setDebouncedTitle] = useState('');
  const [debouncedLocation, setDebouncedLocation] = useState('');
  const searchKey = providerCacheKey(viewerId, debouncedTitle, debouncedLocation, 0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<{ key: string; controller: AbortController } | null>(null);
  const appUserRef = useRef(appUser);
  useEffect(() => { appUserRef.current = appUser; }, [appUser]);

  const [result, setResult] = useState(() => {
    const cached = !mockDataService.isEnabled() ? providerCache.get(searchKey) : undefined;
    return {
      viewerId, searchKey, data: cached?.data ?? [], count: cached?.count ?? 0, page: 0,
      hasMore: Boolean(cached?.data.length && PAGE_SIZE < cached.count),
    };
  });
  const [loading, setLoading] = useState(() => {
    const cached = !mockDataService.isEnabled() ? providerCache.get(searchKey) : undefined;
    return !cached || !isFresh(cached);
  });
  const [fetchError, setFetchError] = useState<{
    searchKey: string; page: number; reset: boolean; message: string;
  } | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const error = fetchError?.searchKey === searchKey ? fetchError : null;
  const pendingSearch = searchTitle.trim() !== debouncedTitle || searchLocation.trim() !== debouncedLocation;
  const resultsMatchSearch = result.searchKey === searchKey;
  // Hide previous-account rows immediately, even before the fetch effect runs.
  const providers = React.useMemo(() => {
    if (result.viewerId !== viewerId) return [];
    return result.data.map(p => {
      if (!appUser || p.id !== appUser.id) return p;
      const isAvailable = Boolean(appUser.isAvailable ?? appUser.is_available ?? appUser.open_to === 'work');
      return { ...p, isAvailable, is_available: isAvailable };
    });
  }, [result, viewerId, appUser]);
  const totalCount = result.viewerId === viewerId ? result.count : 0;
  const hasMore = resultsMatchSearch && result.hasMore;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedTitle(searchTitle.trim());
      setDebouncedLocation(searchLocation.trim());
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTitle, searchLocation]);

  const fetchProviders = useCallback(async (currentPage: number, reset = false, force = false) => {
    const cacheKey = providerCacheKey(viewerId, debouncedTitle, debouncedLocation, currentPage);
    // The ref closes the double-click gap before React renders disabled buttons.
    if (requestRef.current && (!reset || (!force && requestRef.current.key === cacheKey))) return;
    requestRef.current?.controller.abort();
    const controller = new AbortController();
    const request = { key: cacheKey, controller };
    requestRef.current = request;
    const isCurrent = () => requestRef.current === request && !controller.signal.aborted;
    setLoading(true);
    setFetchError(null);

    const applyPage = (data: AppUser[], count: number) => {
      if (!isCurrent()) return;
      setResult(prev => ({
        viewerId, searchKey, count, page: currentPage,
        data: Array.from(new Map(
          [...(!reset && prev.searchKey === searchKey ? prev.data : []), ...data].map(p => [p.id, p])
        ).values()),
        hasMore: data.length > 0 && (currentPage + 1) * PAGE_SIZE < count,
      }));
    };

    try {
      // Development mocks stay local and never enter the shared live-data cache.
      if (mockDataService.isEnabled()) {
        const bundle = mockDataService.getBundle();
        const currentUser = appUserRef.current;
        let candidates = bundle.users.filter(u => u.role === 'freelancer' || u.role === 'seeker');
        if (currentUser && (currentUser.role === 'freelancer' || currentUser.role === 'seeker')) {
          candidates = [currentUser, ...candidates.filter(u => u.id !== currentUser.id)];
        }
        if (debouncedTitle) {
          const term = debouncedTitle.toLowerCase();
          candidates = candidates.filter(u =>
            [u.name, u.title, u.displayTitle, u.display_title, u.specialty]
              .some(value => value?.toLowerCase().includes(term))
          );
        }
        if (debouncedLocation) {
          const term = debouncedLocation.toLowerCase();
          candidates = candidates.filter(u => u.location?.toLowerCase().includes(term));
        }
        candidates.sort((a, b) => {
          const aAvail = Boolean(a.isAvailable ?? a.is_available);
          const bAvail = Boolean(b.isAvailable ?? b.is_available);
          if (aAvail !== bAvail) return aAvail ? -1 : 1;
          return Number(b.isPro ?? b.is_pro ?? false) - Number(a.isPro ?? a.is_pro ?? false);
        });
        applyPage(candidates.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE), candidates.length);
        return;
      }

      const cached = providerCache.get(cacheKey);
      if (!force && cached) {
        // A stale first page remains visible while revalidating; don't append stale pages.
        if (reset || isFresh(cached)) applyPage(cached.data, cached.count);
        if (isFresh(cached)) return;
      }

      const entry = await fetchProviderPage(viewerId, debouncedTitle, debouncedLocation, currentPage, controller.signal);
      applyPage(entry.data, entry.count);
    } catch (err) {
      if (!isCurrent()) return;
      console.error('[ServicesView] fetch error:', err);
      setFetchError({
        searchKey, page: currentPage, reset,
        message: err instanceof Error && err.message.startsWith('TIMEOUT:')
          ? 'استغرق تحميل الخدمات وقتاً طويلاً. يرجى إعادة المحاولة.'
          : 'تعذّر تحميل الخدمات. يرجى إعادة المحاولة.',
      });
    } finally {
      // Also abort after a timeout while the SDK is still waiting to dispatch.
      controller.abort();
      if (requestRef.current === request) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [viewerId, debouncedTitle, debouncedLocation, searchKey]);

  useEffect(() => {
    void fetchProviders(0, true);
    return () => {
      const request = requestRef.current;
      requestRef.current = null;
      request?.controller.abort();
    };
  }, [fetchProviders]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handleMockChange = () => {
      providerCache.clear();
      void fetchProviders(0, true, true);
    };
    window.addEventListener('prolink_mock_data_change', handleMockChange);
    return () => window.removeEventListener('prolink_mock_data_change', handleMockChange);
  }, [fetchProviders]);

  const handleLoadMore = () => {
    if (loading || requestRef.current || pendingSearch || error || !hasMore) return;
    void fetchProviders(result.page + 1);
  };

  const handleSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!pendingSearch) {
      void fetchProviders(0, true, Boolean(error));
    } else {
      setDebouncedTitle(searchTitle.trim());
      setDebouncedLocation(searchLocation.trim());
    }
  };

  const handleClearSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchTitle('');
    setSearchLocation('');
    setDebouncedTitle('');
    setDebouncedLocation('');
    setAvailableOnly(false);
    if (!debouncedTitle && !debouncedLocation) void fetchProviders(0, true, Boolean(error));
  };

  const hasActiveSearch = Boolean(searchTitle.trim() || searchLocation.trim() || availableOnly);
  const displayedProviders = React.useMemo(() => {
    if (!availableOnly) return providers;
    return providers.filter(p => Boolean(p.isAvailable ?? p.is_available));
  }, [providers, availableOnly]);

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
                disabled={loading && !pendingSearch}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-blue-600 font-black text-xs rounded-2xl shadow-lg hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-70"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                بحث
              </button>
              <button
                type="button"
                onClick={() => setAvailableOnly(prev => !prev)}
                aria-pressed={availableOnly}
                className={`px-3 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border ${
                  availableOnly
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-900/30'
                    : 'bg-white/15 text-white/90 hover:bg-white/25 border-white/20'
                }`}
                title="تصفية حسب المتوفرين للعمل فقط"
              >
                <span className={`w-2 h-2 rounded-full ${availableOnly ? 'bg-white animate-pulse' : 'bg-emerald-400'}`} />
                <span>المتاحون فقط 🟢</span>
              </button>
              {hasActiveSearch && (
                <button
                  onClick={handleClearSearch}
                  aria-label="مسح جميع الفلاتر"
                  className="px-3 py-2.5 bg-white/20 text-white font-bold text-xs rounded-2xl border border-white/30 hover:bg-white/30 transition-all active:scale-95"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── بطاقات تصنيفات الخدمات ── */}
      <div className="overflow-x-auto pb-1 -mx-0.5 px-0.5 scrollbar-none" dir="rtl">
        <div className="flex gap-2.5 w-max py-0.5">
          {SERVICE_CATEGORIES.map((cat) => {
            const isSelected = searchTitle === cat.search;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  const nextVal = isSelected ? '' : cat.search;
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  setSearchTitle(nextVal);
                  setDebouncedTitle(nextVal);
                  setDebouncedLocation(searchLocation.trim());
                }}
                className={`relative flex-shrink-0 w-[86px] h-[82px] rounded-2xl overflow-hidden transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? 'ring-2 ring-white/80 shadow-xl scale-105'
                    : 'opacity-80 hover:opacity-100 hover:scale-[1.03]'
                }`}
                style={{
                  background: `linear-gradient(135deg, ${cat.grad[0]}, ${cat.grad[1]})`,
                }}
              >
                {/* أيقونات زخرفية صغيرة بالزوايا */}
                <span className="absolute top-1 right-1.5 text-[9px] opacity-40 select-none pointer-events-none" aria-hidden="true">{cat.deco[0]}</span>
                <span className="absolute top-1 left-1.5 text-[9px] opacity-40 select-none pointer-events-none" aria-hidden="true">{cat.deco[1]}</span>

                {/* المحتوى الرئيسي */}
                <div className="relative z-10 flex flex-col items-center justify-end h-full pb-2.5 gap-0.5">
                  <span className="text-[1.6rem] leading-none drop-shadow-sm">{cat.icon}</span>
                  <span className="text-white font-black text-[9px] mt-0.5 drop-shadow text-center leading-tight px-1">
                    {cat.label}
                  </span>
                </div>

                {/* طبقة توهج عند التحديد */}
                {isSelected && (
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-[0.5px]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* نتائج البحث */}
      {hasActiveSearch && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-black text-slate-500 dark:text-slate-400">
            {loading || pendingSearch ? 'جاري البحث...' : availableOnly
              ? `${displayedProviders.length} متاحون ضمن ${providers.length} نتيجة محمّلة`
              : `${providers.length} نتيجة${totalCount > providers.length ? ` من ${totalCount}` : ''}`}
            {searchTitle && <span className="text-blue-600 dark:text-blue-400"> · {searchTitle}</span>}
            {searchLocation && <span className="text-indigo-600 dark:text-indigo-400"> · {searchLocation}</span>}
          </p>
          <button onClick={handleClearSearch} className="text-[10px] font-black text-red-500 hover:text-red-600 transition-colors">
            مسح الفلتر
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <p>{error.message}</p>
          <button
            type="button"
            disabled={loading || pendingSearch}
            onClick={() => {
              if (!requestRef.current && !pendingSearch) void fetchProviders(error.page, error.reset, true);
            }}
            className="rounded-xl border border-current px-3 py-2 hover:bg-red-100 disabled:opacity-50 dark:hover:bg-red-900/40"
          >
            إعادة المحاولة
          </button>
        </div>
      )}
      {loading && providers.length > 0 && (
        <p role="status" className="text-center text-xs font-bold text-blue-600 dark:text-blue-400">جاري تحديث النتائج...</p>
      )}
      {providers.length > 0 && (!resultsMatchSearch || pendingSearch) && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">تظهر النتائج السابقة حتى يكتمل البحث الجديد.</p>
      )}

      {/* قائمة المزودين */}
      <div className="space-y-3" aria-busy={loading}>
        <AnimatePresence key={viewerId ?? 'guest'} mode="popLayout">
          {!loading && !pendingSearch && !error && resultsMatchSearch && displayedProviders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-16 text-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-700"
            >
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-700">
                <Wrench size={28} className="text-slate-200 dark:text-slate-600" />
              </div>
              <p className="font-black text-slate-400 dark:text-slate-500 text-sm">
                {availableOnly && hasMore ? 'لا يوجد متاحون ضمن النتائج المحمّلة' : hasActiveSearch ? 'لا توجد نتائج مطابقة' : 'لا يوجد مزودو خدمات مسجلون بعد'}
              </p>
              <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1 font-bold">
                {availableOnly && hasMore ? 'حمّل المزيد من النتائج أو ألغِ فلتر المتاحين فقط' : hasActiveSearch ? 'جرّب تغيير كلمات البحث أو المنطقة أو مسح الفلاتر' : 'كن أول من يسجّل خدمته في المنصة!'}
              </p>
            </motion.div>
          ) : (
            displayedProviders.map((provider, idx) => (
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
          <div role="status" aria-label="جاري تحميل الخدمات" className="space-y-3">
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
      {providers.length > 0 && hasMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center pt-2 pb-4"
        >
          <button
            onClick={handleLoadMore}
            disabled={loading || pendingSearch || Boolean(error)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-95 disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'جاري التحميل...' : 'عرض 10 التالية'}
            <ChevronDown size={13} />
          </button>
        </motion.div>
      )}

      {/* رسالة نهاية النتائج */}
      {!loading && !pendingSearch && !error && resultsMatchSearch && providers.length > 0 && !hasMore && (
        <div className="text-center py-4">
          <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">
            · تم عرض جميع النتائج ({providers.length} مزود خدمة) ·
          </p>
        </div>
      )}
    </div>
  );
};
