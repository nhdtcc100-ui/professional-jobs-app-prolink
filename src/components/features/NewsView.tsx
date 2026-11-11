import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe, Globe2, RefreshCw, ExternalLink, Clock,
  ChevronLeft, ChevronRight, ArrowLeft, ArrowUpRight, Search, Eye, Filter, Bookmark, Send, Building2, CheckCircle2, ShieldAlert, Award,
  Flag, Wifi, WifiOff, Info, Home
} from 'lucide-react';
import { newsService } from '../../lib/services/newsService';
import { DetailFeedPage } from './DetailFeedPage';
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

    return Array.from(doc.querySelectorAll('item')).slice(0, 20).map(el => {
      const get = (tag: string) => el.querySelector(tag)?.textContent?.trim() || '';
      const title = newsService.cleanText(get('title'));
      const link  = get('link') || el.querySelector('guid')?.textContent?.trim() || '#';
      const desc  = newsService.cleanText(get('content:encoded') || get('description') || get('content') || '');
      const date  = get('pubDate') || get('dc:date') || get('published') || new Date().toISOString();
      const thumb = el.querySelector('media\\:thumbnail, enclosure')?.getAttribute('url') ||
                    el.querySelector('media\\:content')?.getAttribute('url') || '';
      
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

// Fetch one feed with fast fallback (RSS2JSON, Direct, or Proxies)
const fetchFeed = async (feed: { url: string; region: NewsItem['region']; label: string }): Promise<NewsItem[]> => {
  // 1. Try rss2json API first (instant JSON, zero XML parsing issues, bypasses CORS)
  try {
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.status === 'ok' && Array.isArray(data?.items) && data.items.length > 0) {
        return data.items.map((item: any) => {
          const title = newsService.cleanText(item.title || '');
          const desc = newsService.cleanText(item.description || item.content || '');
          return {
            id: Math.random().toString(36).substr(2, 9),
            title,
            link: item.link || item.guid || '#',
            pubDate: item.pubDate || new Date().toISOString(),
            content: desc,
            description: desc,
            author: item.author || feed.label,
            thumbnail: item.thumbnail || item.enclosure?.link || APP_PLACEHOLDER,
            region: assignRegion(title + ' ' + desc, feed.region),
            topic: assignTopic(title + ' ' + desc),
            source: feed.label,
          } as NewsItem;
        }).filter((n: NewsItem) => n.title.length > 5);
      }
    }
  } catch (_) {}

  // 2. Direct fetch (native mobile WebView / CORS-enabled)
  try {
    const res = await fetch(feed.url, { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const text = await res.text();
      const items = parseRSS(text, feed.label, feed.region);
      if (items.length > 0) return items;
    }
  } catch (_) {}

  // 3. Fallback through resilient proxies
  const proxies = [
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`,
  ];
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy(feed.url), { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const text = await res.text();
      const items = parseRSS(text, feed.label, feed.region);
      if (items.length > 0) return items;
    } catch (_) {}
  }
  return [];
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
  const img = item.thumbnail ||
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
      className={`flex flex-col md:flex-row items-stretch gap-4 p-4 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-500/50 shadow-sm hover:shadow-md transition-all group ${hasLink ? 'cursor-pointer' : 'cursor-default'}`}>
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
export function NewsCarousel({ appUser, onViewAll }: { appUser: any, onViewAll?: () => void }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNews = async () => {
      try {
        const cached = localStorage.getItem('prolink_news_cache_v2') || sessionStorage.getItem('prolink_news_v4');
        if (cached) {
          try {
            const parsedObj = JSON.parse(cached);
            const parsed: NewsItem[] = Array.isArray(parsedObj) ? parsedObj : (parsedObj.data || []);
            const jobNews = parsed.filter(n => n.topic === 'وظائف' || /فرصة|وظيفة|وظائف|تعيين|توظيف|شواغر|سيرة ذاتية|التقديم على/i.test(n.title + ' ' + (n.description || '')));
            if (jobNews.length > 0) {
              setItems(jobNews.slice(0, 8));
              setLoading(false);
              return;
            }
          } catch {}
        }

        const sources = newsService.getDefaultSources();
        const results = await Promise.all(sources.map(s => newsService.fetchRSS(s.url, s.name)));
        const flat = results.flat().sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
        const jobNews = flat.filter(n => n.topic === 'وظائف' || /فرصة|وظيفة|وظائف|تعيين|توظيف|شواغر|سيرة ذاتية|التقديم على/i.test(n.title + ' ' + (n.description || '')));
        
        if (jobNews.length > 0) {
          setItems(jobNews.slice(0, 8));
          sessionStorage.setItem('prolink_news_v4', JSON.stringify(jobNews));
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
    <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] p-5 border border-slate-100 dark:border-slate-800 shadow-sm mb-4 relative overflow-hidden group min-h-[190px]">
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
            onClick={() => setSelectedNews(currentItem)}
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
export function NewsView({ appUser }: { appUser: any }) {
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
  const [region, setRegion] = useState<'all' | 'iraq' | 'arab' | 'global'>('all');
  const [topic, setTopic] = useState('الكل');

  const [tgInput, setTgInput] = useState('');
  const [showSources, setShowSources] = useState(false);

  // Allowed Telegram sources (admin-defined only)
  const DEFAULT_TG_SOURCES = [
    { id: '1', username: 'thekhana', label: 'الخانة', enabled: true },
    { id: '2', username: 'Keko4444', label: 'الوسيط', enabled: true },
    { id: '3', username: 'engahmad88', label: 'أحمد إنج', enabled: true },
  ];

  const [sources, setSources] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('prolink_news_sources_v1');
      if (!saved) return DEFAULT_TG_SOURCES;
      const parsed = JSON.parse(saved);
      // Validate: only keep sources whose username matches known list or was explicitly saved
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
    return DEFAULT_TG_SOURCES;
  });

  useEffect(() => {
    localStorage.setItem('prolink_news_sources_v1', JSON.stringify(sources));
  }, [sources]);

  const getCache = (): NewsItem[] | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY_MAIN) || sessionStorage.getItem(CACHE_KEY_MAIN);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS && (!data || data.length === 0)) return null;
      return data;
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
    const cached = getCache();
    if (cached && !force) {
      setNews(cached);
      setIsLive(true);
      setLoading(false);
    } else if (!cached) {
      setLoading(true);
    }

    try {
      const activeSources = sources.filter(s => s.enabled);

      // Build allowed source labels for strict filtering
      const allowedSources = new Set<string>([
        ...activeSources.map(s => `@${s.username}`),
        ...activeSources.map(s => s.username),
      ]);

      const allFeedPromises = [
        // Telegram channels (only configured app sources)
        ...activeSources.map(async (src) => {
          try {
            const items = await newsService.fetchRSS(newsService.getTelegramRssUrl(src.username), `@${src.username}`);
            return items.map(item => {
              const cleanContent = newsService.cleanText(item.content);
              return { ...item, title: newsService.cleanText(item.title), content: cleanContent, description: cleanContent, region: 'iraq' as const, topic: 'وظائف', source: `@${src.username}` } as NewsItem;
            });
          } catch { return [] as NewsItem[]; }
        }),
      ];

      const results = await Promise.allSettled(allFeedPromises);
      const collected: NewsItem[] = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => (r as PromiseFulfilledResult<NewsItem[]>).value)
        // ✅ Strict source filter: only keep items from registered sources
        .filter(n => !n.source || allowedSources.has(n.source));

      // Always include political, sports, and economic news links so topic filters are rich and responsive
      const nonJobFallbacks = FALLBACK.filter(f => f.topic !== 'وظائف');
      const allNews = [...collected, ...nonJobFallbacks];

      if (allNews.length > 0) {
        const seen = new Set<string>();
        const merged = allNews
          .filter(n => { const k = n.title.slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; })
          .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
          .slice(0, 80);

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
  }, [sources, appUser?.isAdmin, news]);

  useEffect(() => { fetchNews(); }, []);

  const toggleSource = (id: string) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const removeSource = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const handleAddSource = () => {
    if (!tgInput.trim()) return;
    let cleanChannel = tgInput.trim()
      .replace(/^@/, '')
      .replace(/^https?:\/\/t\.me\//, '')
      .replace(/^t\.me\//, '')
      .split('/')[0]
      .trim();
      
    if (cleanChannel) {
      if (sources.some(s => s.username === cleanChannel)) return;
      const newSource = {
        id: Math.random().toString(36).substr(2, 9),
        username: cleanChannel,
        label: cleanChannel,
        enabled: true
      };
      setSources(prev => [...prev, newSource]);
      setTgInput('');
    }
  };

  const REGIONS = [
    { id: 'all', label: 'الكل', icon: Globe2, cls: 'bg-slate-900 dark:bg-blue-600' },
    { id: 'iraq', label: '🇮🇶 عراق', icon: Flag, cls: 'bg-emerald-600' },
    { id: 'arab', label: '🌙 عربي', icon: Globe2, cls: 'bg-blue-600' },
    { id: 'global', label: '🌐 عالمي', icon: Globe2, cls: 'bg-slate-700' },
  ] as const;

  const TOPICS = ['الكل', 'وظائف', 'سياسة', 'رياضة', 'تقنية', 'اقتصاد', 'مقالات'];

  const filtered = React.useMemo(() => {
    return news.filter(n => {
      const rOk = region === 'all' || n.region === region;
      const tOk = topic === 'الكل' || n.topic === topic;
      return rOk && tOk;
    });
  }, [news, region, topic]);

  const featured = filtered[0];
  const rest = filtered.slice(1);

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

          <div className="flex items-center gap-2 relative">
            {appUser?.isAdmin && (
              <button 
                onClick={() => setShowSources(!showSources)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black transition-all border shadow-sm ${
                  showSources 
                    ? 'bg-blue-600 text-white border-transparent' 
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Globe size={14} />
                إدارة مصادر التليجرام
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

            {/* Sources Dashboard Dropdown (Admins only) */}
            <AnimatePresence>
              {appUser?.isAdmin && showSources && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute left-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-50 p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[11px] font-black text-slate-800 dark:text-white">تخصيص المصادر</h4>
                    <span className="text-[9px] text-slate-400 font-bold">{sources.length} مصادر</span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar mb-4">
                    {sources.map(src => (
                      <div key={src.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 truncate w-32">@{src.username}</span>
                          <span className="text-[8px] text-slate-400 font-bold">{src.enabled ? 'مفعل' : 'متوقف'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => toggleSource(src.id)}
                            className={`p-1.5 rounded-lg transition-all ${src.enabled ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}
                          >
                            <Wifi size={12} />
                          </button>
                          <button 
                            onClick={() => removeSource(src.id)}
                            className="p-1.5 bg-red-50 dark:bg-red-950/50 text-red-500 rounded-lg hover:bg-red-100"
                          >
                            <Info size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="relative pt-2 border-t border-slate-100 dark:border-slate-800">
                    <input
                      type="text"
                      value={tgInput}
                      onChange={(e) => setTgInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
                      placeholder="أضف قناة (مثال: thekhana)"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2 text-[10px] font-bold focus:outline-none focus:border-blue-400 text-slate-800 dark:text-white"
                    />
                    <button 
                      onClick={handleAddSource}
                      className="absolute left-1 top-3 bottom-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black transition-colors"
                    >
                      إضافة
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Region filter pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1" style={{ scrollbarWidth: 'none' }}>
          {REGIONS.map(r => (
            <button key={r.id} onClick={() => setRegion(r.id as any)}
              className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black transition-all border ${
                region === r.id 
                  ? `${r.cls} text-white border-transparent shadow-md` 
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm'
              }`}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Topic filter */}
        <div className="flex gap-2 p-1.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none' }}>
          {TOPICS.map(t => (
            <button key={t} onClick={() => setTopic(t)}
              className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${
                topic === t 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}>
              {t}
            </button>
          ))}
        </div>
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
            {featured && <NewsCard item={featured} featured onSelect={setSelectedNews} />}
            {rest.map((n, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <NewsCard item={n} onSelect={setSelectedNews} />
              </motion.div>
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
            appUser={appUser}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

