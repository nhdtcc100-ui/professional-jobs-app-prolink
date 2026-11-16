import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe, Plus, Trash2, CheckCircle2, XCircle, RefreshCw, Send,
  Rss, Code2, ExternalLink, Shield, Zap, AlertCircle, ToggleLeft, ToggleRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sanitizeInput } from '../../lib/utils/sanitize';

export interface NewsSourceItem {
  id: string;
  name: string;
  type: 'telegram' | 'rss' | 'api';
  url: string;
  category: 'jobs' | 'tech' | 'general' | 'economy' | 'sports' | 'politics';
  apiKey?: string;
  enabled: boolean;
  lastFetchedAt?: string;
  lastStatus?: 'success' | 'error';
  itemCount?: number;
}

const STORAGE_KEY = 'prolink_news_sources_config_v2';
const SETTING_KEY = 'news_sources_config';

const DEFAULT_SOURCES: NewsSourceItem[] = [
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

export const NewsSourcesAdmin: React.FC<{ addToast: (msg: string, type?: 'success' | 'error' | 'info') => void }> = ({ addToast }) => {
  const [sources, setSources] = useState<NewsSourceItem[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return DEFAULT_SOURCES;
  });

  const [isAdding, setIsAdding] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'telegram' | 'rss' | 'api'>('rss');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState<'jobs' | 'tech' | 'general' | 'economy' | 'sports' | 'politics'>('jobs');
  const [newApiKey, setNewApiKey] = useState('');


  // Quick-fill examples for each type and category
  const API_EXAMPLES = [
    {
      label: '🗞️ الجزيرة - أخبار عامة (RSS)',
      type: 'rss' as const,
      category: 'general' as const,
      name: 'الجزيرة نت - أخبار عامة',
      url: 'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9',
      apiKey: ''
    },
    {
      label: '⚽ الجزيرة - رياضة (RSS)',
      type: 'rss' as const,
      category: 'sports' as const,
      name: 'الجزيرة الرياضية',
      url: 'https://www.aljazeera.net/aljazeerarss/0be57742-7a9b-4a74-b7e7-daab0cd1be3b/5dcae4d3-3ef5-4ee3-bb9c-5b4bef94e0c9',
      apiKey: ''
    },
    {
      label: '💼 وظائف العراق الهندسية والإدارية (تيليجرام)',
      type: 'telegram' as const,
      category: 'jobs' as const,
      name: 'قناة أحمد إنج - وظائف هندسية',
      url: 'https://t.me/s/engahmad88',
      apiKey: ''
    },
    {
      label: '📈 CNN الاقتصادية - مال وأعمال (RSS)',
      type: 'rss' as const,
      category: 'economy' as const,
      name: 'CNN الاقتصادية',
      url: 'https://arabic.cnn.com/api/v1/rss/business/rss.xml',
      apiKey: ''
    },
    {
      label: '💼 وظائف العراق - الخانة (تيليجرام)',
      type: 'telegram' as const,
      category: 'jobs' as const,
      name: 'قناة الخانة - وظائف العراق',
      url: 'https://t.me/s/thekhana',
      apiKey: ''
    },
    {
      label: '📡 BBC عربي - أخبار وتحليلات (RSS)',
      type: 'rss' as const,
      category: 'general' as const,
      name: 'BBC عربي - أخبار',
      url: 'https://feeds.bbci.co.uk/arabic/rss.xml',
      apiKey: ''
    },
    {
      label: '📰 سكاي نيوز عربية (RSS)',
      type: 'rss' as const,
      category: 'general' as const,
      name: 'سكاي نيوز عربية',
      url: 'https://www.skynewsarabia.com/rss',
      apiKey: ''
    },
    {
      label: '💹 الجزيرة - مال واقتصاد (RSS)',
      type: 'rss' as const,
      category: 'economy' as const,
      name: 'الجزيرة نت - اقتصاد',
      url: 'https://www.aljazeera.net/aljazeerarss/67035676-e820-410a-8bf8-be9ca0b0d3bf/a0dafa02-cb45-4df3-be4a-efad5aaef5fa',
      apiKey: ''
    },
    {
      label: '🤖 NewsAPI - أخبار تقنية (JSON API)',
      type: 'api' as const,
      category: 'tech' as const,
      name: 'NewsAPI - تقنية (يلزم مفتاح API مجاني)',
      url: 'https://newsapi.org/v2/top-headlines?country=sa&category=technology&apiKey=YOUR_KEY_HERE',
      apiKey: 'YOUR_NEWSAPI_KEY'
    }
  ];

  const fillExample = (ex: typeof API_EXAMPLES[0]) => {
    setNewName(ex.name);
    setNewType(ex.type);
    setNewUrl(ex.url);
    setNewCategory(ex.category);
    setNewApiKey(ex.apiKey);
    setIsAdding(true);
  };

  // Load from DB on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('platform_settings')
          .select('value')
          .eq('key', SETTING_KEY)
          .maybeSingle();

        if (data?.value) {
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSources(parsed);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          }
        }
      } catch (_) {}
    })();
  }, []);

  const saveSources = async (updated: NewsSourceItem[]) => {
    setSources(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    setSaving(true);
    try {
      await (supabase as any).from('platform_settings').upsert({
        key: SETTING_KEY,
        value: JSON.stringify(updated),
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    } catch (_) {}
    setSaving(false);
  };

  const handleToggle = (id: string) => {
    const next = sources.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    saveSources(next);
    addToast('تم تحديث حالة تفعيل المصدر بنجاح');
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا المصدر الإخباري؟')) return;
    const next = sources.filter(s => s.id !== id);
    saveSources(next);
    addToast('تم حذف المصدر الإخباري بنجاح 🗑️');
  };

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeInput(newName.trim());
    const cleanUrl = newUrl.trim();

    if (!cleanName || !cleanUrl) {
      addToast('يرجى ملء اسم المصدر والرابط بصورة صحيحة', 'error');
      return;
    }

    const newItem: NewsSourceItem = {
      id: `src-${Date.now()}`,
      name: cleanName,
      type: newType,
      url: cleanUrl,
      category: newCategory,
      apiKey: newApiKey.trim() || undefined,
      enabled: true,
      lastFetchedAt: new Date().toISOString(),
      lastStatus: 'success'
    };

    const next = [newItem, ...sources];
    saveSources(next);

    setNewName('');
    setNewUrl('');
    setNewApiKey('');
    setIsAdding(false);
    addToast('✅ تمت إضافة المصدر الإخباري بنجاح!');
  };

  const handleTestFetch = async (source: NewsSourceItem) => {
    setTestingId(source.id);
    addToast(`جاري الاتصال واختبار الجلب من «${source.name}»...`, 'info');

    try {
      let endpoint = source.url;
      if (source.type === 'telegram') {
        const username = source.url.replace(/^.*t\.me\/s?\/?/, '').replace('@', '');
        endpoint = `https://t.me/s/${username}`;
      }

      // Try with multi-proxy
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(endpoint)}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
      const data = await res.json();

      if (data?.contents && data.contents.length > 50) {
        addToast(`✅ نجح الاتصال بالمصدر! تم التحقق من استجابة البيانات.`, 'success');
        const next = sources.map(s => s.id === source.id ? {
          ...s,
          lastFetchedAt: new Date().toISOString(),
          lastStatus: 'success' as const
        } : s);
        saveSources(next);
      } else {
        throw new Error('استجابة غير متوافقة');
      }
    } catch (err: any) {
      addToast(`تنبيه: تعذر الجلب المباشر (${err.message || 'مهلة الاتصال'}). يرجى التأكد من الرابط أو مفتاح الـ API.`, 'error');
      const next = sources.map(s => s.id === source.id ? {
        ...s,
        lastFetchedAt: new Date().toISOString(),
        lastStatus: 'error' as const
      } : s);
      saveSources(next);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-indigo-900/30 shrink-0">
            <Globe size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white">إدارة مصادر الأخبار وقنوات الـ API</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/30">
                {sources.length} مصادر مسجلة
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              إضافة روابط الـ API، خلاصات RSS، وقنوات تيليجرام لتغذية قسم الأخبار بمحتوى لحظي ومحدث دورياً
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-900/30 flex items-center gap-2 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>{isAdding ? 'إلغاء الإضافة' : 'إضافة مصدر أو رابط API'}</span>
        </button>
      </div>


      {/* Quick-Add Examples Reference */}
      <div className="bg-slate-900/50 border border-slate-700/40 rounded-3xl p-5 space-y-3">
        <h4 className="text-xs font-black text-slate-300 flex items-center gap-2 uppercase tracking-widest">
          <Zap size={14} className="text-amber-400" />
          أمثلة روابط جاهزة - اضغط لتعبئة النموذج تلقائياً
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {API_EXAMPLES.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => fillExample(ex)}
              className="text-right px-3.5 py-2.5 rounded-2xl bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700/50 hover:border-blue-500/50 text-xs font-bold text-slate-300 hover:text-white transition-all active:scale-95 flex items-center gap-2"
            >
              <span className="text-sm">{ex.label.split(' ')[0]}</span>
              <span className="flex-1 text-right leading-tight">{ex.label.replace(/^[^s]+s/, '')}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 font-medium">
          ملاحظة: روابط RSS و تيليجرام مجانية. روابط JSON API مثل NewsAPI تتطلب مفتاح API مجاني من موقعهم.
        </p>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddSource}
            className="p-6 rounded-3xl bg-slate-900/70 border border-blue-500/30 space-y-4 overflow-hidden"
          >
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Zap size={16} className="text-amber-400" />
              <span>إدخال بيانات المصدر الإخباري أو رابط الـ API</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-black text-slate-300 block mb-1.5">اسم المصدر / القناة:</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="مثال: قناة وظائف العراق، رويترز، الشرق..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-300 block mb-1.5">نوع المصدر (Protocol):</label>
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors font-bold"
                >
                  <option value="rss">خلاصة RSS Feed (XML)</option>
                  <option value="telegram">قناة تيليجرام عامة (t.me/s/...)</option>
                  <option value="api">واجهة برمجية JSON REST API</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-300 block mb-1.5">رابط المصدر (URL / Endpoint):</label>
                <input
                  type="url"
                  required
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://example.com/rss أو https://t.me/channel"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-300 block mb-1.5">التصنيف الإخباري:</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors font-bold"
                >
                  <option value="jobs">فرص ووظائف (Jobs)</option>
                  <option value="tech">تقنية وذكاء اصطناعي (Tech)</option>
                  <option value="economy">أعمال واقتصاد (Economy)</option>
                  <option value="general">أخبار عامة (General)</option>
                  <option value="sports">رياضة وكرة قدم (Sports)</option>
                  <option value="politics">أخبار سياسية (Politics)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-black text-slate-300 block mb-1.5">مفتاح الـ API أو ترويسة التحقق (اختياري للـ APIs الخاصة):</label>
                <input
                  type="password"
                  value={newApiKey}
                  onChange={e => setNewApiKey(e.target.value)}
                  placeholder="Bearer token أو API key..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-black rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-900/30"
              >
                حفظ المصدر
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Sources Table */}
      <div className="space-y-3">
        {sources.map(source => {
          const typeIcons = {
            telegram: <Send size={14} className="text-sky-400 rotate-[-45deg]" />,
            rss: <Rss size={14} className="text-amber-400" />,
            api: <Code2 size={14} className="text-purple-400" />
          };

          return (
            <div
              key={source.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                source.enabled
                  ? 'bg-slate-900/60 border-slate-700/60'
                  : 'bg-slate-900/30 border-slate-800 opacity-60'
              }`}
            >
              <div className="flex items-start md:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  {typeIcons[source.type]}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-black text-white">{source.name}</h4>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                      {source.type}
                    </span>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      {source.category === 'jobs' ? 'وظائف' : source.category === 'tech' ? 'تقنية' : source.category === 'economy' ? 'اقتصاد' : 'عام'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-md" dir="ltr">
                    {source.url}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleTestFetch(source)}
                  disabled={testingId === source.id}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all"
                  title="اختبار جلب الأخبار من المصدر"
                >
                  <RefreshCw size={12} className={testingId === source.id ? 'animate-spin' : ''} />
                  <span>فحص وجلب</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggle(source.id)}
                  className={`p-2 rounded-xl text-xs font-bold transition-all border ${
                    source.enabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                  title={source.enabled ? 'إيقاف المصدر' : 'تفعيل المصدر'}
                >
                  {source.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(source.id)}
                  className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 border border-red-500/20 transition-all"
                  title="حذف المصدر"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

