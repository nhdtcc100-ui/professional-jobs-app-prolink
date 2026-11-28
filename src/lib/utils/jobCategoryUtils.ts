import React from 'react';
import { Wrench, Laptop, Building2, Newspaper, MoreHorizontal, Layers } from 'lucide-react';
import { Job } from '../../types';

export interface JobCategoryDef {
  id: string;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  gradient: string;
  emoji: string;
  aliases: string[];
}

export const JOB_CATEGORIES: JobCategoryDef[] = [
  {
    id: 'مهنية',
    label: 'مهنية',
    desc: 'حرف، فنية وهندسة',
    Icon: Wrench,
    color: 'from-amber-500 to-orange-500',
    gradient: 'from-amber-400 to-orange-500',
    emoji: '🛠️',
    aliases: [
      'مهنية', 'مهنيه', 'مهني', 'مهن', 'فنية', 'فنيه', 'فني', 'حرفية', 'حرفيه', 'حرفي',
      'صناعية', 'صناعيه', 'صناعي', 'هندسة', 'هندسه', 'هندسي', 'مهندس', 'vocational', 'craft', 'technical'
    ],
  },
  {
    id: 'تقنية',
    label: 'تقنية',
    desc: 'برمجة وتكنولوجيا',
    Icon: Laptop,
    color: 'from-blue-600 to-cyan-500',
    gradient: 'from-blue-500 to-cyan-500',
    emoji: '💻',
    aliases: [
      'تقنية', 'تقنيه', 'تقني', 'تكنولوجيا', 'تكنولوجي', 'برمجة', 'برمجه', 'برمجي', 'مبرمج',
      'حاسوب', 'معلوماتية', 'معلوماتيه', 'شبكات', 'سوفتوير', 'مطور', 'tech', 'technology', 'it', 'software', 'dev'
    ],
  },
  {
    id: 'إدارية',
    label: 'إدارية',
    desc: 'إدارة ومحاسبة وموارد',
    Icon: Building2,
    color: 'from-indigo-600 to-violet-600',
    gradient: 'from-indigo-500 to-violet-600',
    emoji: '📋',
    aliases: [
      'إدارية', 'إداريه', 'إداري', 'إدارة', 'إداره',
      'ادارية', 'اداريه', 'اداري', 'ادارة', 'اداره',
      'محاسبة', 'محاسبه', 'محاسب', 'موارد بشرية', 'موارد بشريه', 'سكرتارية', 'سكرتاريه',
      'تسويق', 'مبيعات', 'استقبال', 'خدمة عملاء', 'خدمه عملاء', 'admin', 'administrative', 'management', 'hr'
    ],
  },
  {
    id: 'أخبار',
    label: 'أخبار',
    desc: 'إعلانات وفرص رسمية',
    Icon: Newspaper,
    color: 'from-emerald-500 to-teal-600',
    gradient: 'from-emerald-500 to-teal-600',
    emoji: '📰',
    aliases: [
      'أخبار', 'اخبار', 'خبر', 'إعلان', 'إعلانات', 'اعلان', 'اعلانات',
      'بيان', 'بيانات', 'تنويه', 'اشعار', 'إشعار', 'مسابقة', 'مسابقه', 'news', 'announcement'
    ],
  },
  {
    id: 'أخرى',
    label: 'أخرى',
    desc: 'تخصصات متنوعة',
    Icon: MoreHorizontal,
    color: 'from-slate-500 to-slate-700',
    gradient: 'from-slate-400 to-slate-600',
    emoji: '🌐',
    aliases: [
      'أخرى', 'اخري', 'اخرى', 'عام', 'عامة', 'عامه', 'متنوع', 'متنوعة', 'متنوعه', 'other', 'general'
    ],
  },
];

export const ALL_CATEGORY_IDS = ['الكل', ...JOB_CATEGORIES.map(c => c.id)];

/** Normalize Arabic text: remove diacritics, normalize alef variants, ta marbuta */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel
    .replace(/[أإآٱ]/g, 'ا')               // Normalize alef variants
    .replace(/ة/g, 'ه')                    // Ta marbuta → ha
    .replace(/ى/g, 'ي')                    // Alef maqsura → ya
    .toLowerCase()
    .trim();
}

const CATEGORY_TAG_REGEX = /\[CATEGORY:([^\]]+)\]/i;

/**
 * Finds matching category ID from any raw string using alias and normalized matching.
 */
export function matchCategoryString(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const normalized = normalizeArabic(raw);

  // Exact ID match first
  for (const cat of JOB_CATEGORIES) {
    if (normalizeArabic(cat.id) === normalized) {
      return cat.id;
    }
  }

  // Alias match
  for (const cat of JOB_CATEGORIES) {
    for (const alias of cat.aliases) {
      if (normalizeArabic(alias) === normalized) {
        return cat.id;
      }
    }
  }

  // Partial / contains match in alias
  for (const cat of JOB_CATEGORIES) {
    for (const alias of cat.aliases) {
      const normAlias = normalizeArabic(alias);
      if (normalized.includes(normAlias) || normAlias.includes(normalized)) {
        return cat.id;
      }
    }
  }

  return null;
}

/**
 * Extracts category from a job object with normalized Arabic comparison.
 * Priority:
 * 1. Explicit job.category property (alias + normalized match).
 * 2. Embedded [CATEGORY:...] tag in description (alias + normalized match).
 * 3. Keyword analysis in title and description (heuristic).
 * 4. Fallback: 'أخرى'.
 */
export function getJobCategory(job: Partial<Job> | any): string {
  if (!job) return 'أخرى';

  // 1. Explicit category property
  if (job.category && typeof job.category === 'string' && job.category.trim()) {
    const matched = matchCategoryString(job.category.trim());
    if (matched) return matched;
  }

  // 2. Embedded [CATEGORY:...] tag in description
  const desc = String(job.description || '');
  const tagMatch = desc.match(CATEGORY_TAG_REGEX);
  if (tagMatch && tagMatch[1]) {
    const matched = matchCategoryString(tagMatch[1].trim());
    if (matched) return matched;
  }

  // 3. Heuristic keyword detection (for legacy / untagged jobs)
  const combinedText = normalizeArabic(`${job.title || ''} ${job.description || ''} ${job.requirements || ''}`);

  if (/اعلان|خبر|بيان|حكومي|وزاره|اشعار|تنويه|مسابقه|فرصه رسميه/.test(combinedText)) {
    return 'أخبار';
  }

  if (/برمج|مبرمج|مطور|تقني|تطوير|حاسوب|شبكات|موقع|تطبيق|frontend|backend|fullstack|software|ذكاء اصطناعي|داتا/.test(combinedText)) {
    return 'تقنية';
  }

  if (/مهندس|فني|ميكانيك|كهرباء|حداد|نجار|سباك|صيانه|سائق|طباخ|خياط|حلاق|بناء|مصنع|عامل|وشه|فنيين/.test(combinedText)) {
    return 'مهنية';
  }

  if (/ادار|مدير|محاسب|سكرتير|شؤون|موارد بشريه|تسويق|مبيعات|خدمه عملاء|كول سنتر|استقبال|علاقات عامه|مندوب|امين صندوق|مشرف/.test(combinedText)) {
    return 'إدارية';
  }

  return 'أخرى';
}

/**
 * Checks if a job belongs to the target category with fuzzy Arabic normalization.
 */
export function isJobInCategory(job: Partial<Job> | any, targetCategory: string): boolean {
  if (!targetCategory || targetCategory === 'الكل') return true;
  const targetId = matchCategoryString(targetCategory) || targetCategory;
  const jobCategory = getJobCategory(job);
  return normalizeArabic(jobCategory) === normalizeArabic(targetId);
}

/**
 * Strips the [CATEGORY:...] tag from description so users don't see raw markup.
 */
export function cleanJobDescription(text: string): string {
  if (!text) return '';
  return text.replace(CATEGORY_TAG_REGEX, '').trim();
}

/**
 * Encodes category into description string for zero-data-loss storage.
 */
export function encodeCategoryInDescription(description: string, category: string): string {
  const clean = cleanJobDescription(description);
  if (!category) return clean;
  // Always use the canonical category ID if available
  const canonical = matchCategoryString(category) || category.trim();
  return `[CATEGORY:${canonical}] ${clean}`.trim();
}

/**
 * Determines uniformly whether a job is currently open for applications.
 * Prioritizes explicit boolean `is_active`, falling back to `status` only when `is_active` is nullish.
 */
export function isJobActive(job?: Partial<Job> | any): boolean {
  if (!job) return true;
  if (typeof job.is_active === 'boolean') return job.is_active;
  if (job.is_active === 'false') return false;
  if (job.is_active === 'true') return true;
  if (job.status === 'closed') return false;
  return true;
}
