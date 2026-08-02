import { supabase } from '../supabase';

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  content: string;
  description: string;
  author: string;
  thumbnail: string;
  source: string;
  category?: string;
  region: 'iraq' | 'arab' | 'global';
  topic: string;
}

// Proxy configurations with type info
type ProxyDef = { url: string; isJson: boolean };
const PROXY_LIST: ProxyDef[] = [
  // allorigins JSON wrapper — most reliable, supports Telegram
  { url: 'https://api.allorigins.win/get?url=', isJson: true },
  // allorigins raw — direct passthrough
  { url: 'https://api.allorigins.win/raw?url=', isJson: false },
  // corsproxy.io — fast alternative
  { url: 'https://corsproxy.io/?', isJson: false },
  // codetabs — sometimes slow/down, keep as last resort
  { url: 'https://api.codetabs.com/v1/proxy?quest=', isJson: false },
];

// Fetch with timeout to avoid hanging on dead proxies
async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const newsService = {
  // Helper to proxy images that are blocked (like Telegram images)
  proxyImage(url: string): string {
    if (!url) return '';
    if (url.includes('telesco.pe') || url.includes('telegram.org') || url.includes('cdn4.telegram')) {
      return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    }
    return url;
  },

  // Keep old `proxies` array for any legacy references
  proxies: PROXY_LIST.map(p => p.url),

  async fetchWithFallback(url: string): Promise<string> {
    // 1. Check cache first (10 min expiry)
    const cacheKey = `news_cache_v5_${url}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 10 * 60 * 1000) return data;
      } catch { /* ignore corrupt cache */ }
    }

    // 2. Try each proxy with timeout
    for (const proxy of PROXY_LIST) {
      const proxyUrl = proxy.url + encodeURIComponent(url);
      try {
        console.log(`[newsService] Trying proxy: ${proxy.url}`);
        const response = await fetchWithTimeout(proxyUrl, 8000);

        if (!response.ok) {
          console.warn(`[newsService] Proxy returned ${response.status}: ${proxy.url}`);
          continue;
        }

        let text = '';
        if (proxy.isJson) {
          const json = await response.json();
          text = json?.contents || '';
        } else {
          text = await response.text();
        }

        if (text && text.length > 100) {
          localStorage.setItem(cacheKey, JSON.stringify({ data: text, timestamp: Date.now() }));
          console.log(`[newsService] ✅ Success with proxy: ${proxy.url}`);
          return text;
        }
        console.warn(`[newsService] Proxy returned empty/short content: ${proxy.url}`);
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          console.warn(`[newsService] ⏱ Timeout on proxy: ${proxy.url}`);
        } else {
          console.warn(`[newsService] ❌ Error on proxy: ${proxy.url}`, e?.message);
        }
      }
    }
    throw new Error('All proxies failed to fetch content');
  },

  async fetchRSS(url: string, sourceName: string): Promise<NewsItem[]> {
    if (url.includes('telegram_scraper:')) {
      const username = url.split(':')[1];
      return this.scrapeTelegram(username, sourceName);
    }
    try {
      const xml = await this.fetchWithFallback(url);
      return this.parseXML(xml, sourceName);
    } catch (error) {
      console.error(`Error fetching RSS from ${sourceName}:`, error);
      return [];
    }
  },

  async scrapeTelegram(username: string, sourceName: string): Promise<NewsItem[]> {
    const webUrl = `https://t.me/s/${username}`;
    try {
      const html = await this.fetchWithFallback(webUrl);
      if (!html || !html.includes('tgme_widget_message')) return [];

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const messages = Array.from(doc.querySelectorAll('.tgme_widget_message_wrap')).slice(-12);

      return messages.map((msg, idx) => {
        const textEl = msg.querySelector('.tgme_widget_message_text');
        const photoEl = msg.querySelector('.tgme_widget_message_photo_wrap') as HTMLElement;
        const dateEl = msg.querySelector('.tgme_widget_message_date time') as HTMLTimeElement;
        const linkEl = msg.querySelector('.tgme_widget_message_date') as HTMLAnchorElement;

        const content = this.cleanText(textEl?.innerHTML || '');
        const title = textEl?.textContent?.split('\n')[0].slice(0, 100).trim() || 'تحديث جديد';
        
        let thumbnail = '';
        if (photoEl) {
          const style = photoEl.getAttribute('style') || '';
          const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (match) {
            thumbnail = this.proxyImage(match[1]);
          }
        }

        return {
          id: `${username}-${idx}-${Date.now()}`,
          title: this.cleanText(title),
          link: linkEl?.href || `https://t.me/${username}`,
          pubDate: dateEl?.dateTime || new Date().toISOString(),
          content: content,
          description: content,
          author: `@${username}`,
          thumbnail: thumbnail,
          source: sourceName,
          region: 'iraq' as const,
          topic: 'وظائف'
        };
      }).reverse();
    } catch (e) {
      console.error(`Error scraping Telegram for ${username}:`, e);
      return [];
    }
  },

  // Clean text from HTML tags and normalize whitespace
  cleanText(html: string): string {
    if (!html) return '';
    // Strip HTML tags
    let text = html.replace(/<[^>]*>?/gm, ' ');
    // Decode common HTML entities
    text = text.replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>');
               
    // SMART NORMALIZATION V5: 
    // 1. Initial cleanup: Preserve double newlines as markers
    let cleaned = html.replace(/\r/g, '').replace(/<p[^>]*>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n');
    
    // 2. Strip other tags
    cleaned = cleaned.replace(/<[^>]*>?/gm, ' ');
    
    // 3. Normalize whitespace
    cleaned = cleaned.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    
    // 4. Consolidate multiple newlines into double newlines for paragraph breaks
    cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');
    
    return cleaned.trim();
  },

  parseXML(xml: string, source: string): NewsItem[] {
    try {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const items = Array.from(doc.querySelectorAll('item, entry')).slice(0, 15);
      return items.map(el => {
        const get = (tag: string) => el.querySelector(tag)?.textContent?.trim() || '';
        const rawContent = get('description') || get('content') || get('summary') || '';
        const link = get('link') || el.querySelector('link')?.getAttribute('href') || '#';
        const title = this.cleanText(get('title'));
        
        return {
          id: get('guid') || get('id') || link || Math.random().toString(),
          title: title || 'خبر جديد',
          link: link,
          pubDate: get('pubDate') || get('updated') || get('published') || new Date().toISOString(),
          content: this.cleanText(rawContent),
          description: this.cleanText(rawContent),
          author: source,
          thumbnail: this.proxyImage(el.querySelector('enclosure')?.getAttribute('url') || 
                     this.extractFirstImage(rawContent) || ''),
          source: source,
          region: 'iraq' as const,
          topic: 'أخبار'
        };
      }).filter(i => i.title !== 'خبر جديد');
    } catch { return []; }
  },

  extractFirstImage(html: string): string | null {
    if (!html) return null;
    const match = html.match(/<img[^>]+src="([^">]+)"/);
    return match ? match[1] : null;
  },

  getTelegramRssUrl(username: string): string {
    return `telegram_scraper:${username}`;
  },

  getDefaultSources() {
    return [
      { name: 'الوسيط (وظائف)', url: this.getTelegramRssUrl('Keko4444') },
      { name: 'أحمد إنج (وظائف)', url: this.getTelegramRssUrl('engahmad88') },
      { name: 'وظائف العراق', url: 'https://www.iraqjobs24.com/feeds/posts/default' },
    ];
  }
};
