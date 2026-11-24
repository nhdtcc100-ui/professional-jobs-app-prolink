import React, { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wrench, Search, MapPin, RefreshCw, Phone, MessageSquare,
  Star, CheckCircle, User, ChevronDown, Loader2, X, SlidersHorizontal
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { AppUser } from '../../../types';
import { mockDataService } from '../../../lib/services/mockDataService';
import { openContactMenu } from '../../../lib/utils/contact';

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
      id={`service-provider-${provider.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="group relative bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-sm hover:shadow-xl hover:shadow-blue-500/8 transition-all duration-300 overflow-hidden diwani-neon-card scroll-mt-24"
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
                if (provider.phone || (provider as any)?.website) {
                  openContactMenu({
                    phone: provider.phone,
                    name: provider.name,
                    website: (provider as any)?.website,
                    cvUrl: (provider as any)?.cv_url || provider.cvUrl
                  });
                } else {
                  onUserClick(provider);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl border border-emerald-100 dark:border-emerald-800/50 text-xs font-black transition-all active:scale-95"
            >
              <Phone size={11} />
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
  const [searchTitle, setSearchTitle] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  // القيم المُقدَّمة للاستعلام بعد debounce (300ms)
  const [debouncedTitle, setDebouncedTitle] = useState('');
  const [debouncedLocation, setDebouncedLocation] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // كاش فوري في الذاكرة لمنح سرعة استجابة خارقة 0ms (Stale-While-Revalidate)
  const searchCacheRef = useRef<Map<string, { data: AppUser[]; count: number }>>(new Map());
  const [providers, setProviders] = useState<AppUser[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);

  // مزامنة حالة توفر المستخدم الحالي فور تعديلها من الملف الشخصي
  useEffect(() => {
    if (!appUser?.id) return;
    const isAvail = Boolean(appUser.isAvailable ?? (appUser as any).is_available ?? appUser.open_to === 'work');
    setProviders(prev => prev.map(p => {
      if (p.id === appUser.id) {
        return { ...p, isAvailable: isAvail, is_available: isAvail };
      }
      return p;
    }));
  }, [appUser?.id, appUser?.isAvailable, (appUser as any)?.is_available, appUser?.open_to]);

  // الاستماع لتغييرات البيانات الوهمية من لوحة التحكم
  useEffect(() => {
    const handleMockChange = () => {
      searchCacheRef.current.clear();
      fetchProviders(0, true);
    };
    window.addEventListener('prolink_mock_data_change', handleMockChange);
    return () => window.removeEventListener('prolink_mock_data_change', handleMockChange);
  }, []);

  // ── Debounce: تأخير 250ms قبل تشغيل البحث اليدوي لتجنب استعلامات متتالية ────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        setDebouncedTitle(searchTitle);
        setDebouncedLocation(searchLocation);
      });
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTitle, searchLocation]);

  const fetchProviders = useCallback(async (currentPage: number, reset = false) => {
    // إذا كانت البيانات الوهمية مفعلة، نقرأ محلياً 100% دون أي طلب لسوبابيس لحماية الباقة المجانية
    if (mockDataService.isEnabled()) {
      setLoading(true);
      const bundle = mockDataService.getBundle();
      let candidates = bundle.users.filter(u => u.role === 'freelancer' || u.role === 'seeker');
      // استبعاد الملف الشخصي للمستخدم الحالي لأن المستخدم هو الذي يبحث
      if (appUser?.id) {
        candidates = candidates.filter(u => u.id !== appUser.id);
      }
      if (debouncedTitle.trim()) {
        const t = debouncedTitle.trim().toLowerCase();
        candidates = candidates.filter(u =>
          u.name.toLowerCase().includes(t) ||
          (u.title && u.title.toLowerCase().includes(t)) ||
          (u.displayTitle && u.displayTitle.toLowerCase().includes(t)) ||
          (u.specialty && u.specialty.toLowerCase().includes(t))
        );
      }
      if (debouncedLocation.trim()) {
        const l = debouncedLocation.trim().toLowerCase();
        candidates = candidates.filter(u => u.location && u.location.toLowerCase().includes(l));
      }
      candidates.sort((a, b) => {
        const aAvail = Boolean(a.isAvailable ?? (a as any).is_available);
        const bAvail = Boolean(b.isAvailable ?? (b as any).is_available);
        if (aAvail !== bAvail) return aAvail ? -1 : 1;
        return (b.isPro ? 1 : 0) - (a.isPro ? 1 : 0);
      });

      const paged = candidates.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
      if (reset) {
        setProviders(paged);
      } else {
        setProviders(prev => [...prev, ...paged]);
      }
      setTotalCount(candidates.length);
      setHasMore((currentPage + 1) * PAGE_SIZE < candidates.length);
      setLoading(false);
      return;
    }
    const cacheKey = `${debouncedTitle.trim()}_${debouncedLocation.trim()}_${currentPage}_${appUser?.id || 'anon'}`;

    // إذا كانت الصفحة الأولى وموجودة في الكاش، اعرضها فوراً 0ms دون أي انتظار
    if (reset && searchCacheRef.current.has(cacheKey)) {
      const cached = searchCacheRef.current.get(cacheKey)!;
      setProviders(cached.data);
      setTotalCount(cached.count);
      setHasMore(cached.data.length === PAGE_SIZE);
      // متابعة في الخلفية لتحديث البيانات بصمت (Stale-While-Revalidate)
    }

    // إلغاء أي طلب شبكة سابق
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    if (!searchCacheRef.current.has(cacheKey)) {
      setLoading(true);
    }

    try {
      let query = (supabase as any)
        .from('profiles')
        .select('id, name, avatar_url, title, specialty, location, is_available, role, is_pro, display_title, bio, is_active, phone, website, cv_url', { count: 'exact' })
        .in('role', ['freelancer', 'seeker', 'job_seeker'])
        .not('is_active', 'eq', false)
        .order('is_available', { ascending: false })
        .order('is_pro', { ascending: false })
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      // استبعاد حساب المستخدم الحالي من البحث في سوق المهن
      if (appUser?.id) {
        query = query.neq('id', appUser.id);
      }

      if (debouncedTitle.trim()) {
        const titleTerm = debouncedTitle.trim();
        query = query.or(
          `title.ilike.%${titleTerm}%,specialty.ilike.%${titleTerm}%,display_title.ilike.%${titleTerm}%,name.ilike.%${titleTerm}%`
        );
      }
      if (debouncedLocation.trim()) {
        const locTerm = debouncedLocation.trim();
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
          email: p.email || '',
          avatar: p.avatar_url || '',
          phone: p.phone || '',
          website: p.website || '',
          cvUrl: p.cv_url || '',
          role: (isFreelancer ? 'freelancer' : 'seeker') as any,
          isPro: p.is_pro || false,
          is_pro: p.is_pro || false,
          title: p.title || '',
          displayTitle,
          specialty: p.specialty || '',
          location: p.location || '',
          isAvailable: Boolean(p.is_available || p.open_to === 'work'),
          bio: p.bio || '',
        };
      }).filter((u: AppUser) => !appUser?.id || u.id !== appUser.id);

      // حفظ في الكاش
      searchCacheRef.current.set(cacheKey, { data: mapped, count: count || 0 });

      if (reset) {
        setProviders(mapped);
      } else {
        setProviders(prev => [...prev, ...mapped]);
      }

      if (count !== null) setTotalCount(count);
      setHasMore(mapped.length === PAGE_SIZE);
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // طلب ملغى — طبيعي
      console.error('[ServicesView] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedTitle, debouncedLocation]);

  // جلب عند تغيّر نص البحث المؤجّل
  useEffect(() => {
    setPage(0);
    fetchProviders(0, true);
  }, [debouncedTitle, debouncedLocation]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProviders(nextPage, false);
  };

  // بحث فوري: يمسح debounce ويشغّل الاستعلام مباشرة
  const handleSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDebouncedTitle(searchTitle);
    setDebouncedLocation(searchLocation);
    setPage(0);
  };

  const handleClearSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchTitle('');
    setSearchLocation('');
    setDebouncedTitle('');
    setDebouncedLocation('');
    setPage(0);
  };

  const hasActiveSearch = Boolean(searchTitle.trim() || searchLocation.trim() || availableOnly);

  const displayedProviders = React.useMemo(() => {
    if (!availableOnly) return providers;
    return providers.filter(p => Boolean(p.isAvailable ?? (p as any).is_available));
  }, [providers, availableOnly]);

  return (
    <div className="space-y-4 pb-safe-bottom" dir="rtl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-850 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden diwani-neon-card"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
              <Wrench size={20} />
            </div>
            <div>
              <h2 className="font-black text-slate-900 dark:text-white text-lg leading-tight">سوق الخدمات والمهن الحرة</h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mt-0.5">
                {totalCount > 0 ? `${totalCount} كفاءة متاحة (عمل حر وباحثين عن عمل)` : 'ابحث عن أصحاب المهن والباحثين عن عمل حسب التخصص والمكان'}
              </p>
            </div>
          </div>

          {/* شريط البحث */}
          <div className="space-y-2.5">
            <div className="relative">
              <Wrench size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTitle}
                onChange={e => setSearchTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="المسمى الوظيفي (كهربائي، حلاق، سباك...)"
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm font-bold focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-all"
              />
            </div>
            <div className="relative">
              <MapPin size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchLocation}
                onChange={e => setSearchLocation(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="المنطقة (بغداد الكمالية، المنصور...)"
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm font-bold focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-all"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs rounded-2xl shadow-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-70"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                بحث
              </button>
              <button
                type="button"
                onClick={() => setAvailableOnly(prev => !prev)}
                className={`px-3.5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border ${
                  availableOnly
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
                title="تصفية حسب المتوفرين للعمل فقط"
              >
                <span className={`w-2 h-2 rounded-full ${availableOnly ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span>المتاحون فقط 🟢</span>
              </button>
              {hasActiveSearch && (
                <button
                  onClick={handleClearSearch}
                  className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                  title="مسح البحث"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── بار وتصنيفات الخدمات (ثيم متوافق مع الكاردات بالكامل) ── */}
      <div className="bg-white dark:bg-slate-850 rounded-3xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm diwani-neon-card">
        <div className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2.5 px-1 flex items-center justify-between">
          <span>التصنيفات والمهن الحرة</span>
          {searchTitle && (
            <button
              onClick={() => {
                setSearchTitle('');
                setDebouncedTitle('');
              }}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              عرض الكل
            </button>
          )}
        </div>
        <div className="overflow-x-auto pb-1 scrollbar-none" dir="rtl">
          <div className="flex gap-2 w-max py-0.5">
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
                    startTransition(() => {
                      setDebouncedTitle(nextVal);
                      setPage(0);
                    });
                  }}
                  className={`relative flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-2xl border transition-all duration-200 active:scale-95 ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md'
                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-sm leading-none">{cat.icon}</span>
                  <span className="font-black text-xs whitespace-nowrap">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
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
          {!loading && displayedProviders.length === 0 ? (
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
