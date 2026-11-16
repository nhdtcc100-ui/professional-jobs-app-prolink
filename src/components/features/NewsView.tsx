import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe, Globe2, RefreshCw, ExternalLink, Clock,
  ChevronLeft, ChevronRight, ArrowLeft, ArrowUpRight, Search, Eye, Filter, Bookmark, Send, Building2, CheckCircle2, ShieldAlert, Award,
  Flag, Wifi, WifiOff, Info, Home, Trophy, Briefcase, Cpu, TrendingUp, Scale, BookOpen, Sparkles
} from 'lucide-react';
import { newsService } from '../../lib/services/newsService';
import { DetailFeedPage } from './DetailFeedPage';
import { NewsSourcesAdmin, NewsSourceItem } from './NewsSourcesAdmin';
import { RecedeCard } from '../common/RecedeCard';
import { safeTimeAgo } from '../../lib/utils/formatDate';
import { useAppContext } from '../../contexts/AppContext';

// Use global NewsItem from newsService
import type { NewsItem } from '../../lib/services/newsService';

import { formatNewsText } from '../../lib/utils/formatNews';
import { DEFAULT_NEWS_PLACEHOLDER, handleImageError } from '../../lib/utils/placeholders';
export { formatNewsText };

// App placeholder image for news items with no thumbnail
const APP_PLACEHOLDER = DEFAULT_NEWS_PLACEHOLDER;

// ── Fallback curated news ────────────────────────────────────────────────────
const FALLBACK: NewsItem[] = [
  { id: 'f1', author: 'Elevate عراق', content: 'سوق العمل العراقي يشهد نمواً ملحوظاً في القطاعات التقنية والرقمية.', title: 'سوق العمل العراقي يشهد نمواً في قطاع التقنية', link: '#', pubDate: new Date().toISOString(), description: 'سوق العمل العراقي يشهد نمواً ملحوظاً في القطاعات التقنية والرقمية.', thumbnail: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=300&fit=crop', region: 'iraq', topic: 'وظائف', source: 'Elevate عراق' },
  { id: 'f2', author: 'Elevate عراق', content: 'الذكاء الاصطناعي يتصدر قائمة المهارات الأكثر طلباً في الأسواق العربية.', title: 'أهم 10 مهارات يبحث عنها أصحاب العمل العرب في 2026', link: '#', pubDate: new Date(Date.now() - 3.6e6 * 3).toISOString(), description: 'الذكاء الاصطناعي يتصدر قائمة المهارات الأكثر طلباً في الأسواق العربية.', thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=300&fit=crop', region: 'arab', topic: 'وظائف', source: 'Elevate عراق' },
  { id: 'f-pol-1', author: 'الجزيرة - سياسة', content: 'تحركات دبلوماسية مكثفة واجتماعات لتعزيز الاستقرار وتنسيق المواقف الاقتصادية والتنموية في المنطقة.', title: 'قمة دولية تبحث آفاق التعاون الاقتصادي والاستقرار الدبلوماسي', link: 'https://www.aljazeera.net', pubDate: new Date(Date.now() - 3.6e6 * 2).toISOString(), description: 'تحركات دبلوماسية مكثفة واجتماعات لتعزيز الاستقرار في المنطقة.', thumbnail: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=600&h=300&fit=crop', region: 'arab', topic: 'سياسة', source: 'الجزيرة - سياسة' },
  { id: 'f-pol-2', author: 'BBC عربي', content: 'الحكومة العراقية تطلق حزمة قرارات تنموية جديدة لتنظيم الاستثمارات ومشاريع البنية التحتية والمنافذ التجارية.', title: 'الحكومة تعلن عن مشاريع استراتيجية كبرى لربط المدن والمناطق الصناعية', link: 'https://www.bbc.com/arabic', pubDate: new Date(Date.now() - 3.6e6 * 4).toISOString(), description: 'حزمة قرارات تنموية جديدة لتنظيم الاستثمارات ومشاريع البنية التحتية.', thumbnail: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=600&h=300&fit=crop', region: 'iraq', topic: 'سياسة', source: 'BBC عربي' },
  { id: 'f-spo-1', author: 'كووورة - رياضة', content: 'المنتخب العراقي يواصل تدريباته المكثفة استعداداً للتصفيات الحاسمة المؤهلة لكأس العالم وسط دعم جماهيري واسع.', title: 'أسود الرافدين يواصلون التحضيرات لتصفيات المونديال بروح معنوية عالية', link: 'https://www.kooora.com', pubDate: new Date(Date.now() - 3.6e6 * 1).toISOString(), description: 'تدريبات مكثفة لمنتخب العراق استعداداً للتصفيات الحاسمة.', thumbnail: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&h=300&fit=crop', region: 'iraq', topic: 'رياضة', source: 'كووورة - رياضة' },
  { id: 'f-spo-2', author: 'FilGoal - رياضة', content: 'مواجهات نارية في الدوريات الأوروبية الكبرى ومنافسة مشتعلة على صدارة دوري أبطال أوروبا والبطولات القارية.', title: 'نتائج وترتيب الجولة الحاسمة في دوري أبطال أوروبا والدوريات الكبرى', link: 'https://www.filgoal.com', pubDate: new Date(Date.now() - 3.6e6 * 5).toISOString(), description: 'منافسة مشتعلة على صدارة دوري أبطال أوروبا والبطولات القارية.', thumbnail: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&h=300&fit=crop', region: 'global', topic: 'رياضة', source: 'FilGoal - رياضة' },
  { id: 'f3', author: 'Elevate عراق', content: 'تحولات كبرى في سوق العمل العالمي بسبب تقنيات الذكاء الاصطناعي التوليدي.', title: 'الذكاء الاصطناعي يعيد رسم خارطة التوظيف العالمي', link: '#', pubDate: new Date(Date.now() - 3.6e6 * 24).toISOString(), description: 'تحولات كبرى في سوق العمل العالمي بسبب تقنيات الذكاء الاصطناعي التوليدي.', thumbnail: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&h=300&fit=crop', region: 'global', topic: 'تقنية', source: 'Elevate عراق' },
  { id: 'f4', author: 'Elevate عراق', content: 'الإمارات تطلق حزمة مبادرات لدعم المواهب الرقمية والمبرمجين.', title: 'الإمارات تطلق مبادرات لاستقطاب المواهب الرقمية', link: '#', pubDate: new Date(Date.now() - 3.6e6 * 5).toISOString(), description: 'الإمارات تطلق حزمة مبادرات لدعم المواهب الرقمية والمبرمجين.', thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=300&fit=crop', region: 'arab', topic: 'اقتصاد', source: 'Elevate عراق' },
  { id: 'f5', author: 'Elevate عراق', content: 'زيادة ملحوظة في اعتماد الشركات العراقية على نظام العمل عن بعد.', title: 'فرص العمل عن بُعد في ازدياد مستمر بالعراق', link: '#', pubDate: new Date(Date.now() - 3.6e6 * 10).toISOString(), description: 'زيادة ملحوظة في اعتماد الشركات العراقية على نظام العمل عن بعد.', thumbnail: 'https://images.unsplash.com/photo-1587560699334-cc4ff634909a?w=600&h=300&fit=crop', region: 'iraq', topic: 'مقالات', source: 'Elevate عراق' },
];



// Parse RSS XML text → item array
const parseRSS = (xml: string, source: string, baseRegion: NewsItem['region']): NewsItem[] => {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.querySelector('parsererror')) return [];

    return Array.from(doc.querySelectorAll('item')).slice(0, 80).map(el => {
      const get = (tag: string) => el.querySelector(tag)?.textContent?.trim() || '';
      const title = newsService.cleanText(get('title'));
      const link  = get('link') || el.querySelector('guid')?.textContent?.trim() || '#';
      const desc  = newsService.cleanText(get('content:encoded') || get('description') || get('content') || '');
      const date  = get('pubDate') || get('dc:date') || get('published') || new Date().toISOString();
      const thumb = newsService.proxyImage(
        el.querySelector('media\\:content')?.getAttribute('url') ||
        el.querySelector('enclosure[type^="image"]')?.getAttribute('url') ||
        el.querySelector('enclosure')?.getAttribute('url') ||
        el.querySelector('media\\:thumbnail')?.getAttribute('url') ||
        newsService.extractFirstImage(desc) || ''
      );
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        title,
        link,
        pubDate: date,
        content: desc,
        description: desc,
        author: source,
        thumbnail: thumb || APP_PLACEHOLDER,
        region: assignRegion(title + ' ' + desc, baseRegion),
        topic: assignTopic(title + ' ' + desc),
        source,
      } as NewsItem;
    }).filter(n => n.title.length > 5);
  } catch { return []; }
};

// Fetch one feed with fast fallback (Per-feed Cache, Native Direct, RSS2JSON, or Safe Proxies)
const FEED_CACHE_PREFIX = 'prolink_feed_cache_';
const FEED_CACHE_TTL = 15 * 60 * 1000; // 15 mins

const fetchFeed = async (feed: { url: string; region: NewsItem['region']; label: string }): Promise<NewsItem[]> => {
  // 0. Check in-memory / sessionStorage per-feed cache first
  try {
    const cached = sessionStorage.getItem(FEED_CACHE_PREFIX + feed.url);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < FEED_CACHE_TTL && Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (_) {}

  let items: NewsItem[] = [];

  // 1. Direct fetch ONLY on native mobile apps (Capacitor / Cordova) where CORS does not apply
  const isNative = typeof window !== 'undefined' && Boolean((window as any)?.Capacitor?.isNativePlatform?.());
  if (isNative) {
    try {
      const res = await fetch(feed.url, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const text = await res.text();
        items = parseRSS(text, feed.label, feed.region);
      }
    } catch (_) {}
  }

  // 2. Try rss2json API (only for verified safe domains that never return 422)
  const RSS2JSON_SAFE_DOMAINS = ['aljazeera.net', 'bbci.co.uk', 'bbc.com', 'cnn.com', 'skynewsarabia.com'];
  const isSafeForRss2Json = RSS2JSON_SAFE_DOMAINS.some(d => feed.url.includes(d));

  if (items.length === 0 && isSafeForRss2Json) {
    try {
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, {
        signal: AbortSignal.timeout(4500)
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.status === 'ok' && Array.isArray(data?.items) && data.items.length > 0) {
          items = data.items.map((item: any) => {
            const title = newsService.cleanText(item.title || '');
            const desc = newsService.cleanText(item.description || item.content || '');
            const rawThumb = item.thumbnail || item.enclosure?.link || newsService.extractFirstImage(desc) || '';
            return {
              id: Math.random().toString(36).substr(2, 9),
              title,
              link: item.link || item.guid || '#',
              pubDate: item.pubDate || new Date().toISOString(),
              content: desc,
              description: desc,
              author: item.author || feed.label,
              thumbnail: rawThumb ? newsService.proxyImage(rawThumb) : APP_PLACEHOLDER,
              region: assignRegion(title + ' ' + desc, feed.region),
              topic: assignTopic(title + ' ' + desc),
              source: feed.label,
            } as NewsItem;
          }).filter((n: NewsItem) => n.title.length > 5);
        }
      }
    } catch (_) {}
  }

  // 3. Fallback through resilient, active CORS proxies (No dead thingproxy)
  if (items.length === 0) {
    const proxies = [
      (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
      (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`
    ];

    for (const proxy of proxies) {
      try {
        const pUrl = proxy(feed.url);
        const res = await fetch(pUrl, { signal: AbortSignal.timeout(4500) });
        if (!res.ok) continue;
        let text = '';
        if (pUrl.includes('/get?url=')) {
          const json = await res.json();
          text = json?.contents || '';
        } else {
          text = await res.text();
        }
        if (text && text.length > 50) {
          const parsed = parseRSS(text, feed.label, feed.region);
          if (parsed.length > 0) {
            items = parsed;
            break;
          }
        }
      } catch (_) {}
    }
  }

  // 4. Cache valid results
  if (items.length > 0) {
    try {
      sessionStorage.setItem(FEED_CACHE_PREFIX + feed.url, JSON.stringify({ ts: Date.now(), data: items }));
    } catch (_) {}
  }

  return items;
};

const assignTopic = (text: string): NewsItem['topic'] => {
  const t = text.toLowerCase();
  if (/فرصة عمل|فرص عمل|مطلوب موظف|مطلوب موظفة|وظائف|وظيفة|توظيف|job|career|hiring|recruit|شواغر|سيرة ذاتية|التقديم على/.test(t)) return 'وظائف';
  if (/سياسة|سياسي|حكومة|برلمان|وزير|انتخاب|رئيس|دبلوماسي|علاقات دولية|مفاوضات|politics|government|parliament|minister/.test(t)) return 'سياسة';
  if (/رياضة|رياضي|كرة قدم|مباراة|بطولة|دوري|هدف|لاعب|نادي|كأس|مونديال|منتخب|sport|football|match|fifa|league/.test(t)) return 'رياضة';
  if (/تقنية|تكنول|ذكاء|برمج|tech|software|ai|digital|رقمي/.test(t)) return 'تقنية';
  if (/اقتصاد|اقتصادي|سوق|نفط|بورصة|finance|market|invest|gdp/.test(t)) return 'اقتصاد';
  return 'مقالات';
};

const assignRegion = (text: string, base: NewsItem['region']): NewsItem['region'] => {
  if (/عراق|بغداد|بصرة|اربيل|iraq/.test(text.toLowerCase())) return 'iraq';
  return base;
};

const REGION_IMGS: Record<string, string> = {
  iraq:   APP_PLACEHOLDER,
  arab:   APP_PLACEHOLDER,
  global: APP_PLACEHOLDER,
};
const TOPIC_IMGS: Record<string, string> = {
  وظائف: APP_PLACEHOLDER,
  سياسة: APP_PLACEHOLDER,
  رياضة: APP_PLACEHOLDER,
  تقنية: APP_PLACEHOLDER,
  اقتصاد: APP_PLACEHOLDER,
  مقالات: APP_PLACEHOLDER,
};

// ── NewsCard ─────────────────────────────────────────────────────────────────
const openLink = (link: string) => {
  if (!link || link === '#') return;
  window.open(link, '_blank', 'noopener,noreferrer');
};

const NewsCard = ({ item, featured = false, onSelect }: { item: NewsItem; featured?: boolean, onSelect?: (item: NewsItem) => void }) => {
  const img = newsService.proxyImage(item.thumbnail) ||
    TOPIC_IMGS[item.topic] ||
    REGION_IMGS[item.region] ||
    APP_PLACEHOLDER;

  const hasLink = item.link && item.link !== '#';
  const regionBadge = item.region === 'iraq' ? { label: '🇮🇶 عراق', cls: 'bg-emerald-500' }
    : item.region === 'arab' ? { label: '🌙 عربي', cls: 'bg-blue-600' }
    : { label: '🌐 عالمي', cls: 'bg-slate-700' };

  if (featured) return (
    <motion.div
      onClick={() => onSelect ? onSelect(item) : openLink(item.link)}
      whileHover={{ scale: 1.01 }}
      className={`block group bg-white dark:bg-[#0f172a] rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xl hover:shadow-2xl transition-all ${hasLink ? 'cursor-pointer' : 'cursor-default'}`}>
      <div className="h-64 overflow-hidden relative">
        <img src={img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100"
          onError={(e) => handleImageError(e, REGION_IMGS[item.region])} alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />
        <div className="absolute top-4 right-4 flex gap-2">
          <span className={`${regionBadge.cls} text-white text-[9px] font-black px-2.5 py-1 rounded-full shadow-lg shadow-white/5`}>{regionBadge.label}</span>
          <span className="bg-blue-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full shadow-lg shadow-blue-500/20">{item.topic}</span>
        </div>
        <div className="absolute bottom-0 p-6 text-white w-full">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black text-blue-400">{item.source}</span>
            <span className="text-slate-500">•</span>
            <p className="text-[10px] font-bold text-slate-300 flex items-center gap-1"><Clock size={10} />{safeTimeAgo(item.pubDate)}</p>
          </div>
          <h3 className="font-black text-xl leading-tight group-hover:text-blue-300 transition-colors break-words overflow-hidden line-clamp-3 text-white">{item.title}</h3>
        </div>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      onClick={() => onSelect ? onSelect(item) : openLink(item.link)}
      whileHover={{ x: -4 }}
      className={`flex flex-col md:flex-row items-stretch gap-4 p-4 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-500/50 shadow-sm hover:shadow-md transition-all group diwani-neon-card ${hasLink ? 'cursor-pointer' : 'cursor-default'}`}>
      <div className="relative shrink-0 w-full md:w-32 h-40 md:h-24">
        <img src={img} className="w-full h-full rounded-xl object-cover border border-slate-100 dark:border-slate-800 shadow-inner"
          onError={(e) => handleImageError(e, REGION_IMGS[item.region])} alt="" />
        {hasLink && <div className="absolute top-2 left-2 p-1.5 bg-blue-600 text-white rounded-lg shadow-lg"><ExternalLink size={12} /></div>}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className={`${regionBadge.cls} text-white text-[8px] font-black px-2.5 py-1 rounded-full shadow-sm`}>{regionBadge.label}</span>
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[8px] font-black px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">{item.topic}</span>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-0.5"><Clock size={10} />{safeTimeAgo(item.pubDate)}</span>
        </div>
        <h4 className="font-black text-sm text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors break-words">{item.title}</h4>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black mt-2 uppercase tracking-wider">{item.source}</p>
      </div>
    </motion.div>
  );
};

// ── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = () => (
  <div className="space-y-4">
    <div className="h-60 bg-slate-100 dark:bg-slate-800 rounded-[2rem] animate-pulse" />
    {[1,2,3].map(i => (
      <div key={i} className="flex gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse w-1/3" />
          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    ))}
  </div>
);

// ── NewsCarousel (for feed sidebar & home view) ──────────────────────────────
export function NewsCarousel({ 
  appUser, 
  onViewAll,
  onViewNews 
}: { 
  appUser: any; 
  onViewAll?: () => void;
  onViewNews?: (item: NewsItem, list: NewsItem[]) => void;
}) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);

      useEffect(() => {
      const loadNews = async (force = false) => {
        try {
          const cached = localStorage.getItem('prolink_news_cache_v2') || sessionStorage.getItem('prolink_news_v4');
          if (cached && !force) {
            try {
              const parsedObj = JSON.parse(cached);
              const ts = parsedObj.ts || 0;
              const isFresh = (Date.now() - ts) < (15 * 60 * 1000); // 15 mins
              const parsed: NewsItem[] = Array.isArray(parsedObj) ? parsedObj : (parsedObj.data || []);
              const jobNews = parsed.filter(n => n.topic === 'وظائف' || /فرصة|وظيفة|وظائف|تعيين|توظيف|شواغر|سيرة ذاتية|التقديم على/i.test(n.title + ' ' + (n.description || '')));
              if (jobNews.length > 0) {
                setItems(jobNews.slice(0, 8));
                setLoading(false);
                if (isFresh) return; // Only skip fetch if younger than 15 mins
              }
            } catch {}
          }

          const sources = newsService.getDefaultSources();
          const results = await Promise.all(sources.map(s => newsService.fetchRSS(s.url, s.name)));
          const flat = results.flat().sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
          const jobNews = flat.filter(n => n.topic === 'وظائف' || /فرصة|وظيفة|وظائف|تعيين|توظيف|شواغر|سيرة ذاتية|التقديم على/i.test(n.title + ' ' + (n.description || '')));
          
          if (jobNews.length > 0) {
            setItems(jobNews.slice(0, 8));
            sessionStorage.setItem('prolink_news_v4', JSON.stringify({ ts: Date.now(), data: jobNews }));
          } else if (flat.length > 0) {
            setItems(flat.slice(0, 8));
          }
        } catch (e) {
          console.error("NewsCarousel error:", e);
        } finally {
          setLoading(false);
        }
      };
      loadNews();
      // ⚡ Auto-refresh carousel news every 15 minutes (ربع ساعة)
      const interval = setInterval(() => {
        loadNews(true);
      }, 15 * 60 * 1000);
      return () => clearInterval(interval);
    }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [items.length]);

  const handleDragEnd = (e: any, { offset }: any) => {
    if (offset.x < -50) {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    } else if (offset.x > 50) {
      setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    }
  };

  const currentItem = items[currentIndex];

  if (!currentItem) return null;

  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] p-5 border border-slate-100 dark:border-slate-800 shadow-sm mb-4 relative overflow-hidden group min-h-[190px] diwani-neon-card">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100 dark:border-blue-800/40">
            <Award className="text-[#0a66c2] dark:text-blue-400" size={18} />
          </div>
          <div>
             <h3 className="font-black text-slate-800 dark:text-white text-sm leading-none mb-1">وظائف العراق</h3>
             <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> 
               تحديث مباشر
             </p>
          </div>
        </div>
        {onViewAll && (
          <button onClick={onViewAll} className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-600 transition-all flex items-center gap-1.5 border border-slate-100 dark:border-slate-700">
            عرض كل الأخبار <ArrowLeft size={12} />
          </button>
        )}
      </div>

      {/* Stable Carousel Item Container with min-height to prevent layout jumps */}
      <div className="relative min-h-[88px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div 
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            onClick={() => {
              if (onViewNews) {
                onViewNews(currentItem, items);
              } else {
                setSelectedNews(currentItem);
              }
            }}
            className="flex items-center gap-3.5 cursor-pointer bg-slate-50/60 dark:bg-slate-800/60 p-3 rounded-[1.5rem] hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors border border-slate-100/60 dark:border-slate-700/60"
          >
            <img 
              src={currentItem.thumbnail || REGION_IMGS[currentItem.region]} 
              onError={handleImageError} 
              className="w-16 h-16 rounded-2xl object-cover shrink-0 shadow-sm border border-slate-100 dark:border-slate-700 pointer-events-none" 
              alt="" 
            />
            <div className="flex-1 min-w-0 py-0.5 pointer-events-none">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2.5 py-0.5 rounded-lg border border-blue-100/50 dark:border-blue-800/40">{currentItem.topic}</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1"><Clock size={10} />{safeTimeAgo(currentItem.pubDate)}</span>
              </div>
              <h4 className="font-black text-xs text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{currentItem.title}</h4>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        {items.length > 1 && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev - 1 + items.length) % items.length); }}
              className="absolute -right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white dark:bg-slate-800 shadow-md text-slate-400 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all border border-slate-100 dark:border-slate-700 z-10"
            >
              <ChevronRight size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev + 1) % items.length); }}
              className="absolute -left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white dark:bg-slate-800 shadow-md text-slate-400 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all border border-slate-100 dark:border-slate-700 z-10"
            >
              <ChevronLeft size={14} />
            </button>
          </>
        )}
      </div>

      {/* Progress Indicators */}
      <div className="flex justify-center gap-1.5 mt-3.5">
        {items.map((_, i) => (
          <button 
            key={i} 
            onClick={() => setCurrentIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-6 bg-[#0a66c2]' : 'w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300'}`} 
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      <AnimatePresence>
        {selectedNews && (
          <DetailFeedPage
            type="news"
            items={items.length > 0 ? items : [selectedNews]}
            initialIndex={items.findIndex(n => n.id === selectedNews.id) >= 0 ? items.findIndex(n => n.id === selectedNews.id) : 0}
            onClose={() => setSelectedNews(null)}
            appUser={appUser}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Cache key constant ───────────────────────────────────────────────────────
const CACHE_KEY_MAIN = 'prolink_news_cache_v2';
const CACHE_TTL_MS = 15 * 60 * 1000;

const getInitialNews = (): NewsItem[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_MAIN) || sessionStorage.getItem(CACHE_KEY_MAIN);
    if (!raw) return FALLBACK;
    const { ts, data } = JSON.parse(raw);
    if (Array.isArray(data) && data.length > 0) return data;
    return FALLBACK;
  } catch { return FALLBACK; }
};

// ── Main NewsView ─────────────────────────────────────────────────────────────
export function NewsView({ 
  appUser,
  onViewNews 
}: { 
  appUser: any;
  onViewNews?: (item: NewsItem, list: NewsItem[]) => void;
}) {
  const { addToast, setActiveTab } = useAppContext();
  const [news, setNews] = useState<NewsItem[]>(getInitialNews);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY_MAIN) || sessionStorage.getItem(CACHE_KEY_MAIN);
      return !!raw;
    } catch { return false; }
  });
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);


  const isAdmin = !!(appUser?.isAdmin || appUser?.role === 'admin' || (appUser as any)?.role === 'superadmin' || (appUser as any)?.is_admin || (appUser as any)?.hasSupportAccess);
  const [showAdminSources, setShowAdminSources] = useState(false);

  // Unified sources config key (shared with NewsSourcesAdmin)
  const SOURCES_CONFIG_KEY = 'prolink_news_sources_config_v2';

const DEFAULT_SOURCES_LIST: NewsSourceItem[] = [
  {
    id: 'src-1',
    name: 'قناة وظائف العراق (تيليجرام)',
    type: 'telegram',
    url: 'https://t.me/s/thekhana',
    category: 'jobs',
    enabled: true,
  },
  {
    id: 'src-2',
    name: 'الجزيرة نت - أخبار عامة (RSS)',
    type: 'rss',
    url: 'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9',
    category: 'general',
    enabled: true,
  },
  {
    id: 'src-3',
    name: 'الجزيرة نت - أخبار الرياضة (RSS)',
    type: 'rss',
    url: 'https://www.aljazeera.net/aljazeerarss/0be57742-7a9b-4a74-b7e7-daab0cd1be3b/5dcae4d3-3ef5-4ee3-bb9c-5b4bef94e0c9',
    category: 'sports',
    enabled: true,
  },
  {
    id: 'src-4',
    name: 'CNN الاقتصادية - مال وأعمال (RSS)',
    type: 'rss',
    url: 'https://arabic.cnn.com/api/v1/rss/business/rss.xml',
    category: 'economy',
    enabled: true,
  },
  {
    id: 'src-5',
    name: 'سكاي نيوز عربية (RSS)',
    type: 'rss',
    url: 'https://www.skynewsarabia.com/rss',
    category: 'general',
    enabled: true,
  },
  {
    id: 'src-6',
    name: 'BBC عربي - أخبار وتحليلات (RSS)',
    type: 'rss',
    url: 'https://feeds.bbci.co.uk/arabic/rss.xml',
    category: 'politics',
    enabled: true,
  },
  {
    id: 'src-7',
    name: 'وظائف العراق الهندسية والإدارية (تيليجرام)',
    type: 'telegram',
    url: 'https://t.me/s/engahmad88',
    category: 'jobs',
    enabled: true,
  },
  {
    id: 'src-8',
    name: 'الجزيرة نت - مال واقتصاد (RSS)',
    type: 'rss',
    url: 'https://www.aljazeera.net/aljazeerarss/67035676-e820-410a-8bf8-be9ca0b0d3bf/a0dafa02-cb45-4df3-be4a-efad5aaef5fa',
    category: 'economy',
    enabled: true,
  }
];

  const sanitizeSources = (list: any[]): NewsSourceItem[] => {
    // Filter out defunct / broken legacy URLs from older saves
    const defunctHosts = ['argaam.com', 'yallakora.com', 'mubasher.info', 'alarabiya.net/tools/rss', 'beinsports.com'];
    const cleaned = list.filter(s => !defunctHosts.some(d => s.url && s.url.includes(d)));
    if (cleaned.length < 3) return DEFAULT_SOURCES_LIST;
    return cleaned;
  };

  const [sources, setSources] = useState<NewsSourceItem[]>(() => {
    try {
      const saved = localStorage.getItem(SOURCES_CONFIG_KEY) || localStorage.getItem('prolink_news_sources_config_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeSources(parsed);
      }
    } catch {}
    return DEFAULT_SOURCES_LIST;
  });

  // Re-read sources whenever admin panel closes/updates
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SOURCES_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setSources(parsed);
      }
    } catch {}
  }, [showAdminSources]);

  // ⚡ Cache expires strictly after 15 minutes (CACHE_TTL_MS)
  const getCache = (): NewsItem[] | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY_MAIN) || sessionStorage.getItem(CACHE_KEY_MAIN);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS) return null; // Cache is expired!
      return Array.isArray(data) && data.length > 0 ? data : null;
    } catch { return null; }
  };

  // Get stale cached news for instant render while revalidating
  const getStaleCache = (): NewsItem[] | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY_MAIN) || sessionStorage.getItem(CACHE_KEY_MAIN);
      if (!raw) return null;
      const { data } = JSON.parse(raw);
      return Array.isArray(data) && data.length > 0 ? data : null;
    } catch { return null; }
  };

  const setCache = (items: NewsItem[]) => {
    try {
      const payload = JSON.stringify({ ts: Date.now(), data: items });
      localStorage.setItem(CACHE_KEY_MAIN, payload);
      sessionStorage.setItem(CACHE_KEY_MAIN, payload);
    } catch {}
  };

  const fetchNews = useCallback(async (force = false) => {
    const cachedValid = getCache();
    const stale = getStaleCache();

    // Show existing data immediately so user never sees empty screen
    if (stale && (!news || news.length === 0)) {
      setNews(stale);
      setIsLive(true);
    }

    // If cache is still fresh (< 15 mins) and not a forced refresh, no need to query network
    if (cachedValid && !force) {
      setNews(cachedValid);
      setIsLive(true);
      setLoading(false);
      return;
    }

    if (!stale) {
      setLoading(true);
    }

    try {
      const activeSources = sources.filter(s => s.enabled);

      const allFeedPromises = activeSources.map(async (src, idx) => {
        // Stagger requests by 250ms to prevent bursting rate limits
        if (idx > 0) {
          await new Promise(res => setTimeout(res, idx * 250));
        }
        try {
          if (src.type === 'rss') {
            const items = await fetchFeed({
              url: src.url,
              label: src.name,
              region: src.category === 'sports' || src.category === 'economy' ? 'arab' : 'global'
            });
            return items.map(it => ({
              ...it,
              topic: src.category === 'sports' ? 'رياضة' :
                     src.category === 'economy' ? 'اقتصاد' :
                     src.category === 'politics' ? 'سياسة' :
                     src.category === 'tech' ? 'تقنية' :
                     src.category === 'jobs' ? 'وظائف' : it.topic || 'عام'
            }));
          } else if (src.type === 'telegram') {
            const cleanUser = src.url.replace(/^.*t\.me\/s?\/?/, '').replace('@', '').split('/')[0].trim();
            const items = await newsService.fetchRSS(newsService.getTelegramRssUrl(cleanUser), src.name || `@${cleanUser}`);
            return items.map(it => ({
              ...it,
              topic: src.category === 'sports' ? 'رياضة' :
                     src.category === 'economy' ? 'اقتصاد' :
                     src.category === 'politics' ? 'سياسة' :
                     src.category === 'tech' ? 'تقنية' :
                     src.category === 'jobs' ? 'وظائف' : 'وظائف'
            }));
          } else if (src.type === 'api') {
            const headers: Record<string, string> = {};
            if (src.apiKey) {
              headers['Authorization'] = `Bearer ${src.apiKey}`;
              headers['X-Api-Key'] = src.apiKey;
            }
            const res = await fetch(src.url, { headers, signal: AbortSignal.timeout(5000) });
            if (res.ok) {
              const json = await res.json();
              const articles = json.articles || json.items || json.data || (Array.isArray(json) ? json : []);
              return articles.slice(0, 80).map((a: any) => ({
                id: Math.random().toString(36).substr(2, 9),
                title: newsService.cleanText(a.title || a.name || ''),
                link: a.url || a.link || '#',
                pubDate: a.publishedAt || a.pubDate || new Date().toISOString(),
                content: newsService.cleanText(a.description || a.content || ''),
                description: newsService.cleanText(a.description || a.content || ''),
                author: a.source?.name || a.author || src.name,
                thumbnail: a.urlToImage || a.thumbnail || a.image || APP_PLACEHOLDER,
                region: 'arab' as const,
                topic: src.category === 'sports' ? 'رياضة' :
                       src.category === 'economy' ? 'اقتصاد' :
                       src.category === 'politics' ? 'سياسة' :
                       src.category === 'tech' ? 'تقنية' : 'عام',
                source: src.name,
              }));
            }
          }
        } catch (err) {
          console.error('Fetch source error for:', src.name, err);
        }
        return [] as NewsItem[];
      });

      const results = await Promise.allSettled(allFeedPromises);
      const collected: NewsItem[] = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => (r as PromiseFulfilledResult<NewsItem[]>).value);

      // Include curated fallbacks so every category has guaranteed rich content
      const allNews = [...collected, ...FALLBACK];

      if (allNews.length > 0) {
        const seen = new Set<string>();
        const merged = allNews
          .filter(n => { const k = n.title.slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; })
          .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
          .slice(0, 150);

        setNews(merged);
        setIsLive(true);
        setLastFetch(new Date());
        setCache(merged);
      } else if (!news || news.length === 0) {
        setNews(FALLBACK);
        setIsLive(false);
      }
    } catch (e) {
      console.error('News fetch error:', e);
      if (!news || news.length === 0) {
        setNews(FALLBACK);
        setIsLive(false);
      }
    }
    setLoading(false);
  }, [sources, appUser?.isAdmin]);

  useEffect(() => { 
    fetchNews(); 
    // ⚡ Auto-refresh news every 15 minutes (تحديث الأخبار تلقائياً كل ربع ساعة)
    const interval = setInterval(() => {
      fetchNews(true);
    }, CACHE_TTL_MS);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const NEWS_CATEGORIES = [
    {
      id: 'iraq',
      label: 'أخبار العراق',
      icon: Flag,
      grad: ['#059669', '#047857'],
      deco: ['🇮🇶', '🏛️'],
      matches: (n: NewsItem) => n.region === 'iraq' || /عراق|بغداد|أربيل|البصرة|الموصل|كركوك|النجف|كربلاء|السليمانية|سومر|دجلة|الرافدين/i.test(n.title + ' ' + (n.description || ''))
    },
    {
      id: 'sports',
      label: 'أخبار الرياضة',
      icon: Trophy,
      grad: ['#EA580C', '#DC2626'],
      deco: ['⚽', '🏆'],
      matches: (n: NewsItem) => n.topic === 'رياضة' || /رياضة|كرة|دوري|منتخب|مباراة|بطولة|كأس|نادي|ريال|برشلونة|فيفا|هدف/i.test(n.title + ' ' + (n.description || ''))
    },
    {
      id: 'jobs',
      label: 'وظائف وأعمال',
      icon: Briefcase,
      grad: ['#2563EB', '#1D4ED8'],
      deco: ['💼', '📈'],
      matches: (n: NewsItem) => n.topic === 'وظائف' || /وظيفة|وظائف|تعيين|شاغر|توظيف|فرصة عمل|مسار مهني|سوق العمل/i.test(n.title + ' ' + (n.description || ''))
    },
    {
      id: 'tech',
      label: 'تقنية وتكنولوجيا',
      icon: Cpu,
      grad: ['#7C3AED', '#6D28D9'],
      deco: ['⚡', '🤖'],
      matches: (n: NewsItem) => n.topic === 'تقنية' || /تقنية|تكنولوجيا|ذكاء|برمجة|حاسوب|هاتف|تطبيق|آبل|جوجل|مايكروسوفت|أندرويد/i.test(n.title + ' ' + (n.description || ''))
    },
    {
      id: 'economy',
      label: 'مال واقتصاد',
      icon: TrendingUp,
      grad: ['#0D9488', '#0F766E'],
      deco: ['📊', '💰'],
      matches: (n: NewsItem) => n.topic === 'اقتصاد' || /اقتصاد|نفط|دولار|دينار|بورصة|مركزي|استثمار|أسواق|تجارة|مالي|أرباح/i.test(n.title + ' ' + (n.description || ''))
    },
    {
      id: 'politics',
      label: 'أخبار سياسية',
      icon: Scale,
      grad: ['#475569', '#334155'],
      deco: ['⚖️', '🏛️'],
      matches: (n: NewsItem) => n.topic === 'سياسة' || /سياسة|حكومة|برلمان|وزير|رئاسة|دبلوماسي|قمة|اتفاقية|مجلس النواب/i.test(n.title + ' ' + (n.description || ''))
    },
    {
      id: 'articles',
      label: 'مقالات وتحليلات',
      icon: BookOpen,
      grad: ['#E11D48', '#BE123C'],
      deco: ['✍️', '📰'],
      matches: (n: NewsItem) => n.topic === 'مقالات' || /مقال|تحليل|رأي|دراسة|تقرير|افتتاحية/i.test(n.title + ' ' + (n.description || ''))
    },
    {
      id: 'global',
      label: 'أخبار دولية',
      icon: Globe2,
      grad: ['#0284C7', '#0369A1'],
      deco: ['🌍', '✈️'],
      matches: (n: NewsItem) => n.region === 'global' || n.region === 'arab' || /دولي|عالمي|واشنطن|أوروبا|الأمم المتحدة|العالم/i.test(n.title + ' ' + (n.description || ''))
    },
  ];

  const filtered = React.useMemo(() => {
    if (!selectedCategory) return news;
    const cat = NEWS_CATEGORIES.find(c => c.id === selectedCategory);
    if (!cat) return news;
    return news.filter(n => cat.matches(n));
  }, [news, selectedCategory]);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  const handleSelectNews = (item: NewsItem) => {
    const list = filtered.length > 0 ? filtered : news;
    if (onViewNews) {
      onViewNews(item, list);
    } else {
      setSelectedNews(item);
    }
  };

  return (
    <div className="space-y-5 pb-36 text-slate-800 dark:text-slate-100" dir="rtl">
      {/* ── Top Header & Filters Card — Dark themed in dark mode ── */}
      <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
              <Globe2 size={24} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  المركز الإخباري
                </h2>
                {appUser?.isAdmin && (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                    بث مباشر 🔴
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                {appUser?.isAdmin ? (
                  isLive
                    ? <><Wifi size={11} className="text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400">بث مباشر من {sources.filter(s=>s.enabled).length} قنوات</span></>
                    : <><WifiOff size={11} /><span>أخبار محررة</span></>
                ) : (
                  <span>أحدث مستجدات سوق العمل والفرص المهنية</span>
                )}
                {lastFetch && <span className="text-slate-400 dark:text-slate-500">• {safeTimeAgo(lastFetch.toISOString())}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative flex-wrap">
            {isAdmin && (
              <button 
                onClick={() => setShowAdminSources(!showAdminSources)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all border shadow-sm ${
                  showAdminSources 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-blue-500/25' 
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-500'
                }`}
                title="إدارة قنوات ومصادر الأخبار والـ API"
              >
                <Globe size={15} className={showAdminSources ? 'text-white' : 'text-blue-500'} />
                <span>إدارة قنوات الأخبار والـ API (للأدمن)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-400">
                  {showAdminSources ? 'إغلاق ✕' : 'إضافة وتعديل ⚙️'}
                </span>
              </button>
            )}

            <button 
              onClick={async () => {
                await fetchNews(true);
                if (addToast) addToast('تم تحديث الأخبار المباشرة بنجاح 🔄');
              }} 
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl border border-blue-100 dark:border-blue-800/40 shadow-sm transition-all text-xs font-black active:scale-95 disabled:opacity-50"
              title="تحديث شريط الأخبار"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>تحديث الأخبار</span>
            </button>
          </div>
        </div>

        {/* ── لوحة إدارة قنوات ومصادر الأخبار وتيليجرام للأدمن ── */}
        <AnimatePresence>
          {showAdminSources && isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: -12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -12, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-slate-900/95 dark:bg-slate-900/95 text-white rounded-3xl p-4 sm:p-6 border border-blue-500/30 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
                      <Globe size={16} />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-white">إدارة قنوات ومصادر الأخبار وتيليجرام</h3>
                      <p className="text-[10px] font-bold text-slate-400">يمكنك إضافة قنوات تيليجرام أو روابط RSS أو خلاصات API ليتم سحب الأخبار منها فورياً</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAdminSources(false)}
                    className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black transition-all cursor-pointer"
                  >
                    إغلاق ✕
                  </button>
                </div>

                <NewsSourcesAdmin addToast={addToast} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── بطاقات تصنيفات الأخبار المربعة الأنيقة بنفس تصميم سوق المهن ── */}
        <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none" dir="rtl" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-2.5 w-max py-1">
            {NEWS_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const count = news.filter(cat.matches).length;
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                  className={`relative flex-shrink-0 w-[92px] h-[86px] sm:w-[102px] sm:h-[94px] rounded-2xl overflow-hidden transition-all duration-200 active:scale-95 group ${
                    isSelected
                      ? 'ring-2 ring-blue-500 dark:ring-white/90 shadow-xl shadow-blue-500/20 scale-105'
                      : 'opacity-85 hover:opacity-100 hover:scale-[1.03] shadow-sm'
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${cat.grad[0]}, ${cat.grad[1]})`,
                  }}
                >
                  {/* أيقونات زخرفية صغيرة بالزوايا */}
                  <span className="absolute top-1.5 right-2 text-[9px] opacity-40 select-none pointer-events-none" aria-hidden="true">{cat.deco[0]}</span>
                  <span className="absolute top-1.5 left-2 text-[9px] opacity-40 select-none pointer-events-none" aria-hidden="true">{cat.deco[1]}</span>

                  {/* المحتوى الرئيسي للكارد */}
                  <div className="relative z-10 flex flex-col items-center justify-end h-full pb-2 px-1 gap-1">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform">
                      <IconComp size={18} className="text-white drop-shadow-sm" />
                    </div>
                    <span className="text-white font-black text-[10px] sm:text-[11px] drop-shadow text-center leading-tight truncate w-full">
                      {cat.label}
                    </span>
                    {count > 0 && (
                      <span className="text-[8.5px] font-black text-white/90 bg-black/30 px-1.5 py-0.5 rounded-full leading-none">
                        {count} خبر
                      </span>
                    )}
                  </div>

                  {/* طبقة توهج عند التحديد */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-white/20 backdrop-blur-[0.5px] border-2 border-white/70 rounded-2xl pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* مؤشر الفلتر النشط وزر مسح الفلتر */}
        {selectedCategory && (
          <div className="flex items-center justify-between px-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-300">
              <span className="text-slate-400">القسم المختار:</span>
              <span className="text-blue-600 dark:text-blue-400 font-black">
                {NEWS_CATEGORIES.find(c => c.id === selectedCategory)?.label}
              </span>
              <span className="text-slate-400 text-[10px]">({filtered.length} خبر)</span>
            </div>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-[10px] font-black text-red-500 hover:text-red-600 transition-colors flex items-center gap-1 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-100 dark:border-red-900/40"
            >
              <span>عرض كل الأخبار</span>
              <span>✕</span>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Skeleton />
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="py-20 text-center bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
            <Info size={36} className="mx-auto text-slate-200 dark:text-slate-700 mb-3" />
            <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">لا توجد أخبار في هذا القسم حالياً</p>
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {featured && <NewsCard item={featured} featured onSelect={handleSelectNews} />}
            {rest.map((n, i) => (
              <RecedeCard key={n.id || i}>
                <NewsCard item={n} onSelect={handleSelectNews} />
              </RecedeCard>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedNews && (
          <DetailFeedPage
            type="news"
            items={filtered.length > 0 ? filtered : [selectedNews]}
            initialIndex={filtered.findIndex(n => n.id === selectedNews.id) >= 0 ? filtered.findIndex(n => n.id === selectedNews.id) : 0}
            onClose={() => setSelectedNews(null)}
            onNavigateHome={() => {
              setSelectedNews(null);
              if (setActiveTab) setActiveTab('home');
            }}
            onNavigateTab={(tab) => {
              setSelectedNews(null);
              if (setActiveTab) setActiveTab(tab);
            }}
            appUser={appUser}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

