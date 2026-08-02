import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, RefreshCw, ExternalLink, Clock,
  Globe2, Flag, Wifi, WifiOff, Info, ArrowLeft, ChevronLeft, ChevronRight
} from 'lucide-react';
import { newsService } from '../../lib/services/newsService';
import NewsDetailModal from './NewsDetailModal';

// Use global NewsItem from newsService
import type { NewsItem } from '../../lib/services/newsService';

// ── Fallback curated news ────────────────────────────────────────────────────
const FALLBACK: NewsItem[] = [
  { id: 'f1', author: 'Elevate عراق', content: 'سوق العمل العراقي يشهد نمواً ملحوظاً في القطاعات التقنية والرقمية.', title: 'سوق العمل العراقي يشهد نمواً في قطاع التقنية', link: '#', pubDate: new Date().toISOString(), description: 'سوق العمل العراقي يشهد نمواً ملحوظاً في القطاعات التقنية والرقمية.', thumbnail: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=300&fit=crop', region: 'iraq', topic: 'وظائف', source: 'Elevate عراق' },
  { id: 'f2', author: 'Elevate عراق', content: 'الذكاء الاصطناعي يتصدر قائمة المهارات الأكثر طلباً في الأسواق العربية.', title: 'أهم 10 مهارات يبحث عنها أصحاب العمل العرب في 2026', link: '#', pubDate: new Date(Date.now() - 3.6e6 * 3).toISOString(), description: 'الذكاء الاصطناعي يتصدر قائمة المهارات الأكثر طلباً في الأسواق العربية.', thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=300&fit=crop', region: 'arab', topic: 'وظائف', source: 'Elevate عراق' },
  { id: 'f3', author: 'Elevate عراق', content: 'تحولات كبرى في سوق العمل العالمي بسبب تقنيات الذكاء الاصطناعي التوليدي.', title: 'الذكاء الاصطناعي يعيد رسم خارطة التوظيف العالمي', link: '#', pubDate: new Date(Date.now() - 3.6e6 * 24).toISOString(), description: 'تحولات كبرى في سوق العمل العالمي بسبب تقنيات الذكاء الاصطناعي التوليدي.', thumbnail: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&h=300&fit=crop', region: 'global', topic: 'تقنية', source: 'Elevate عراق' },
  { id: 'f4', author: 'Elevate عراق', content: 'الإمارات تطلق حزمة مبادرات لدعم المواهب الرقمية والمبرمجين.', title: 'الإمارات تطلق مبادرات لاستقطاب المواهب الرقمية', link: '#', pubDate: new Date(Date.now() - 3.6e6 * 5).toISOString(), description: 'الإمارات تطلق حزمة مبادرات لدعم المواهب الرقمية والمبرمجين.', thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=300&fit=crop', region: 'arab', topic: 'اقتصاد', source: 'Elevate عراق' },
  { id: 'f5', author: 'Elevate عراق', content: 'زيادة ملحوظة في اعتماد الشركات العراقية على نظام العمل عن بعد.', title: 'فرص العمل عن بُعد في ازدياد مستمر بالعراق', link: '#', pubDate: new Date(Date.now() - 3.6e6 * 10).toISOString(), description: 'زيادة ملحوظة في اعتماد الشركات العراقية على نظام العمل عن بعد.', thumbnail: 'https://images.unsplash.com/photo-1587560699334-cc4ff634909a?w=600&h=300&fit=crop', region: 'iraq', topic: 'مقالات', source: 'Elevate عراق' },
];

// Two CORS proxies to try in order
const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

// ── RSS Feeds ────────────────────────────────────────────────────────────────
const FEEDS: { url: string; region: NewsItem['region']; label: string }[] = [
  { url: 'https://feeds.bbci.co.uk/arabic/rss.xml', region: 'arab', label: 'BBC عربي' },
  { url: 'https://feeds.bbci.co.uk/arabic/business/rss.xml', region: 'arab', label: 'BBC اقتصاد' },
  { url: 'https://www.skynewsarabia.com/rss.xml', region: 'arab', label: 'Sky News عربية' },
  { url: 'https://aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a2396e2adf12/69599544-2454-46c5-9279-d102e75e533c', region: 'arab', label: 'الجزيرة' },
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
        thumbnail: thumb,
        region: assignRegion(title + ' ' + desc, baseRegion),
        topic: assignTopic(title + ' ' + desc),
        source,
      } as NewsItem;
    }).filter(n => n.title.length > 5);
  } catch { return []; }
};

// Fetch one feed with proxy fallback
const fetchFeed = async (feed: { url: string; region: NewsItem['region']; label: string }): Promise<NewsItem[]> => {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy(feed.url), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const text = await res.text();
      const items = parseRSS(text, feed.label, feed.region);
      if (items.length > 0) return items;
    } catch (_) {}
  }
  return [];
};

// ── Helper utils ─────────────────────────────────────────────────────────────
const timeAgo = (ds: string) => {
  try {
    const h = Math.floor((Date.now() - new Date(ds).getTime()) / 3.6e6);
    if (h < 1) return 'منذ قليل';
    if (h < 24) return `منذ ${h}س`;
    const d = Math.floor(h / 24);
    if (d < 7) return `منذ ${d}ي`;
    return `منذ ${Math.floor(d / 7)} أسابيع`;
  } catch { return ''; }
};

const assignTopic = (text: string): NewsItem['topic'] => {
  const t = text.toLowerCase();
  if (/وظيف|توظيف|job|career|hire|recruit|عمل/.test(t)) return 'وظائف';
  if (/تقنية|تكنول|ذكاء|برمج|tech|software|ai|digital|رقم/.test(t)) return 'تقنية';
  if (/اقتصاد|اقتصادي|سوق|نفط|economy|finance|market|invest|gdp/.test(t)) return 'اقتصاد';
  return 'مقالات';
};

const assignRegion = (text: string, base: NewsItem['region']): NewsItem['region'] => {
  if (/عراق|بغداد|بصرة|اربيل|iraq/.test(text.toLowerCase())) return 'iraq';
  return base;
};



const REGION_IMGS: Record<string, string> = {
  iraq:   'https://images.unsplash.com/photo-1548438294-1ad5d5f4f063?w=600&h=300&fit=crop',
  arab:   'https://images.unsplash.com/photo-1583416750470-965b2707b355?w=600&h=300&fit=crop',
  global: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&h=300&fit=crop',
};
const TOPIC_IMGS: Record<string, string> = {
  وظائف: 'https://images.unsplash.com/photo-1454165833767-027ff33027b4?w=600&h=300&fit=crop',
  تقنية: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=600&h=300&fit=crop',
  اقتصاد:'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=300&fit=crop',
  مقالات:'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&h=300&fit=crop',
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
    'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&h=300&fit=crop';

  const hasLink = item.link && item.link !== '#';
  const regionBadge = item.region === 'iraq' ? { label: '🇮🇶 عراق', cls: 'bg-emerald-500' }
    : item.region === 'arab' ? { label: '🌙 عربي', cls: 'bg-blue-600' }
    : { label: '🌐 عالمي', cls: 'bg-slate-700' };

  if (featured) return (
    <motion.div
      onClick={() => onSelect ? onSelect(item) : openLink(item.link)}
      whileHover={{ scale: 1.01 }}
      className={`block group bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-700 shadow-xl hover:shadow-2xl transition-all ${hasLink ? 'cursor-pointer' : 'cursor-default'}`}>
      <div className="h-64 overflow-hidden relative">
        <img src={img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100"
          onError={(e) => (e.currentTarget.src = REGION_IMGS[item.region])} alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
        <div className="absolute top-4 right-4 flex gap-2">
          <span className={`${regionBadge.cls} text-white text-[9px] font-black px-2.5 py-1 rounded-full shadow-lg shadow-white/5`}>{regionBadge.label}</span>
          <span className="bg-blue-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full shadow-lg shadow-blue-500/20">{item.topic}</span>
        </div>
        <div className="absolute bottom-0 p-6 text-white w-full">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black text-blue-400">{item.source}</span>
            <span className="text-slate-500">•</span>
            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Clock size={10} />{timeAgo(item.pubDate)}</p>
          </div>
          <h3 className="font-black text-xl leading-tight group-hover:text-blue-300 transition-colors break-words overflow-hidden line-clamp-3">{item.title}</h3>
        </div>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      onClick={() => onSelect ? onSelect(item) : openLink(item.link)}
      whileHover={{ x: -4 }}
      className={`flex flex-col md:flex-row items-stretch gap-4 p-4 bg-white rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-500/50 shadow-sm hover:shadow-md transition-all group ${hasLink ? 'cursor-pointer' : 'cursor-default'}`}>
      <div className="relative shrink-0 w-full md:w-32 h-40 md:h-24">
        <img src={img} className="w-full h-full rounded-xl object-cover border border-slate-100 dark:border-slate-700 shadow-inner"
          onError={(e) => (e.currentTarget.src = REGION_IMGS[item.region])} alt="" />
        {hasLink && <div className="absolute top-2 left-2 p-1.5 bg-blue-600 text-white rounded-lg shadow-lg"><ExternalLink size={12} /></div>}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className={`${regionBadge.cls} text-white text-[8px] font-black px-2.5 py-1 rounded-full shadow-sm`}>{regionBadge.label}</span>
          <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[8px] font-black px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-600">{item.topic}</span>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-0.5"><Clock size={10} />{timeAgo(item.pubDate)}</span>
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
    <div className="h-60 bg-slate-100 rounded-[2rem] animate-pulse" />
    {[1,2,3].map(i => (
      <div key={i} className="flex gap-4 p-4 bg-white rounded-2xl border border-slate-100">
        <div className="w-16 h-16 bg-slate-100 rounded-xl animate-pulse shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-2.5 bg-slate-100 rounded-full animate-pulse w-1/3" />
          <div className="h-2.5 bg-slate-100 rounded-full animate-pulse" />
          <div className="h-2.5 bg-slate-100 rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    ))}
  </div>
);

// ── NewsCarousel (for feed sidebar) ─────────────────────────────────────────
export function NewsCarousel({ appUser, onViewAll }: { appUser: any, onViewAll?: () => void }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNews = async () => {
      setLoading(true);
      try {
        const cached = sessionStorage.getItem('prolink_news_v4');
        if (cached) {
          const parsed = JSON.parse(cached) as NewsItem[];
          const filtered = parsed.filter(n => n.region === 'iraq');
          if (filtered.length > 0) {
            setItems(filtered.slice(0, 8));
            setLoading(false);
            return;
          }
        }

        const sources = newsService.getDefaultSources();
        const results = await Promise.all(sources.map(s => newsService.fetchRSS(s.url, s.name)));
        const flat = results.flat().sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
        
        if (flat.length > 0) {
          setItems(flat.slice(0, 8));
          sessionStorage.setItem('prolink_news_v4', JSON.stringify(flat));
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
    <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm mb-4 relative overflow-hidden group">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <Sparkles className="text-[#0a66c2]" size={18} />
          </div>
          <div>
             <h3 className="font-black text-slate-800 text-sm leading-none mb-1">وظائف العراق</h3>
             <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> 
               تحديث مباشر
             </p>
          </div>
        </div>
        {onViewAll && (
          <button onClick={onViewAll} className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black hover:bg-slate-100 hover:text-blue-600 transition-all flex items-center gap-1.5">
            عرض كل الأخبار <ArrowLeft size={12} />
          </button>
        )}
      </div>

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentIndex}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            onClick={() => setSelectedNews(currentItem)}
            className="flex items-center gap-4 cursor-pointer bg-slate-50/50 p-3 rounded-[1.5rem] hover:bg-blue-50/50 transition-colors border border-transparent hover:border-blue-100 mx-6"
          >
            <img src={currentItem.thumbnail || REGION_IMGS[currentItem.region]} className="w-20 h-20 rounded-2xl object-cover shrink-0 shadow-sm border border-slate-100 pointer-events-none" alt="" />
            <div className="flex-1 min-w-0 py-1 pointer-events-none">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100/50">{currentItem.topic}</span>
                <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1"><Clock size={10} />{timeAgo(currentItem.pubDate)}</span>
              </div>
              <h4 className="font-black text-sm text-slate-800 leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">{currentItem.title}</h4>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        {items.length > 1 && (
          <>
            <button 
              onClick={() => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
            >
              <ChevronRight size={18} />
            </button>
            <button 
              onClick={() => setCurrentIndex((prev) => (prev + 1) % items.length)}
              className="absolute left-0 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
            >
              <ChevronLeft size={18} />
            </button>
          </>
        )}
      </div>

      {/* Progress Indicators */}
      <div className="flex justify-center gap-1.5 mt-5">
        {items.map((_, i) => (
          <button 
            key={i} 
            onClick={() => setCurrentIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-6 bg-[#0a66c2]' : 'w-1.5 bg-slate-200 hover:bg-slate-300'}`} 
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      <AnimatePresence>
        {selectedNews && (
          <NewsDetailModal item={selectedNews} appUser={appUser} onClose={() => setSelectedNews(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main NewsView ─────────────────────────────────────────────────────────────
export function NewsView({ appUser }: { appUser: any }) {
  const [news, setNews] = useState<NewsItem[]>(FALLBACK);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [region, setRegion] = useState<'all' | 'iraq' | 'arab' | 'global'>('all');
  const [topic, setTopic] = useState('الكل');

  const [tgInput, setTgInput] = useState('');
  const [showSources, setShowSources] = useState(false);
  const [sources, setSources] = useState<any[]>(() => {
    const saved = localStorage.getItem('prolink_news_sources_v1');
    return saved ? JSON.parse(saved) : [
      { id: '1', username: 'thekhana', label: 'الخانة', enabled: true },
      { id: '2', username: 'Keko4444', label: 'الوسيط', enabled: true },
      { id: '3', username: 'engahmad88', label: 'أحمد إنج', enabled: true }
    ];
  });

  useEffect(() => {
    localStorage.setItem('prolink_news_sources_v1', JSON.stringify(sources));
  }, [sources]);

  const fetchNews = useCallback(async (force = false) => {
    setLoading(true);
    const collected: NewsItem[] = [];

    try {
      // ── مصادر التيليجرام متاحة للأدمن وأصحاب الوظائف ────────────────────
      const canSeeSources = appUser?.isAdmin || appUser?.role === 'employer';
      const activeSources = canSeeSources ? sources.filter(s => s.enabled) : [];
      
      // 1. Fetch from all active Telegram sources in parallel (Admin Only)
      const tgPromises = activeSources.map(async (src) => {
        try {
          const items = await newsService.fetchRSS(newsService.getTelegramRssUrl(src.username), `@${src.username}`);
          return items.map(item => {
            const cleanContent = newsService.cleanText(item.content);
            return {
              ...item,
              title: newsService.cleanText(item.title),
              content: cleanContent,
              description: cleanContent,
              region: 'iraq' as const,
              topic: 'وظائف',
            } as NewsItem;
          });
        } catch (e) { return []; }
      });

      const tgResults = await Promise.all(tgPromises);
      tgResults.flat().forEach(item => collected.push(item));

      // 2. Fetch Default Sources
      const defaultSources = newsService.getDefaultSources();
      const sourceResults = await Promise.all(
        defaultSources.map(s => newsService.fetchRSS(s.url, s.name))
      );
      
      sourceResults.flat().forEach(item => {
        const cleanContent = newsService.cleanText(item.content);
        const title = newsService.cleanText(item.title);
        collected.push({
          ...item,
          title: title,
          content: cleanContent,
          description: cleanContent,
          region: assignRegion(title + ' ' + cleanContent, 'iraq') as any,
          topic: assignTopic(title + ' ' + cleanContent),
        });
      });

    } catch (e) {
      console.error("Error fetching news feed", e);
    }

    if (collected.length > 0) {
      const seen = new Set<string>();
      const merged = collected
        .filter(n => { 
          const k = n.title.slice(0, 40); 
          if (seen.has(k)) return false; 
          seen.add(k); 
          return true; 
        })
        .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
        .slice(0, 50);

      setNews(merged);
      setIsLive(true);
      setLastFetch(new Date());
    } else {
      setNews(FALLBACK);
      setIsLive(false);
    }
    setLoading(false);
  }, [sources]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

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

  const filtered = news.filter(n => {
    const rOk = region === 'all' || n.region === region;
    const tOk = topic === 'الكل' || n.topic === topic;
    return rOk && tOk;
  });

  const [featured, ...rest] = filtered;

  const REGIONS = [
    { id: 'all', label: 'الكل', icon: Globe2, cls: 'bg-slate-900' },
    { id: 'iraq', label: '🇮🇶 عراق', icon: Flag, cls: 'bg-emerald-600' },
    { id: 'arab', label: '🌙 عربي', icon: Globe2, cls: 'bg-blue-600' },
    { id: 'global', label: '🌐 عالمي', icon: Globe2, cls: 'bg-slate-700' },
  ] as const;

  const TOPICS = ['الكل', 'وظائف', 'تقنية', 'اقتصاد', 'مقالات'];

  return (
    <div className="space-y-5 pb-28" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tighter">المركز الإخباري</h2>
            <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-2">
              {isLive
                ? <><Wifi size={11} className="text-green-500" /><span className="text-green-600">بث مباشر من {sources.filter(s=>s.enabled).length} قنوات</span></>
                : <><WifiOff size={11} /><span>أخبار محررة</span></>}
              {lastFetch && <span className="text-slate-300">• {timeAgo(lastFetch.toISOString())}</span>}
            </p>
          </div>

          <div className="flex items-center gap-2 relative">
            {(appUser?.isAdmin || appUser?.role === 'employer') && (
              <button 
                onClick={() => setShowSources(!showSources)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black transition-all border shadow-sm ${
                  showSources ? 'bg-blue-600 text-white border-transparent' : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'
                }`}
              >
                <Sparkles size={14} />
                {appUser?.isAdmin ? 'إدارة المصادر' : 'مصادر الوظائف'}
              </button>
            )}
            <button onClick={() => fetchNews(true)} disabled={loading}
              className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm hover:bg-blue-50 hover:border-blue-100 transition-all text-slate-400 hover:text-blue-600">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Sources Dashboard Dropdown */}
            <AnimatePresence>
              {showSources && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[11px] font-black text-slate-800">تخصيص المصادر</h4>
                    <span className="text-[9px] text-slate-400 font-bold">{sources.length} مصادر</span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar mb-4">
                    {sources.map(src => (
                      <div key={src.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-700 truncate w-32">@{src.username}</span>
                          <span className="text-[8px] text-slate-400 font-bold">{src.enabled ? 'مفعل' : 'متوقف'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => toggleSource(src.id)}
                            className={`p-1.5 rounded-lg transition-all ${src.enabled ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}
                          >
                            <Wifi size={12} />
                          </button>
                          <button 
                            onClick={() => removeSource(src.id)}
                            className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"
                          >
                            <Info size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="relative pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      value={tgInput}
                      onChange={(e) => setTgInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
                      placeholder="أضف قناة (مثال: thekhana)"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold focus:outline-none focus:border-blue-400 shadow-inner"
                    />
                    <button 
                      onClick={handleAddSource}
                      className="absolute left-1 top-3 bottom-1 px-2.5 bg-slate-900 text-white rounded-lg text-[9px] font-black hover:bg-black transition-colors"
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
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 -my-2 mb-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {REGIONS.map(r => (
            <button key={r.id} onClick={() => setRegion(r.id as any)}
              className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black transition-all border ${
                region === r.id ? `${r.cls} text-white border-transparent shadow-md` : 'bg-white text-slate-900 dark:text-slate-400 border-slate-100 hover:border-slate-200 shadow-sm'
              }`}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Topic filter */}
        <div className="flex gap-2 p-2 mt-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none' }}>
          {TOPICS.map(t => (
            <button key={t} onClick={() => setTopic(t)}
              className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${
                topic === t ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-900 dark:text-slate-400 hover:text-slate-700'
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
            className="py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
            <Info size={36} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 font-bold text-sm">لا توجد أخبار في هذا القسم حالياً</p>
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
          <NewsDetailModal item={selectedNews} appUser={appUser} onClose={() => setSelectedNews(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
