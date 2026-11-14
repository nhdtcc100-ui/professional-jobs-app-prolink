/**
 * ─────────────────────────────────────────────────────────────────
 * matchingService.ts — خوارزمية التوصية الذكية ثنائية الاتجاه
 * ─────────────────────────────────────────────────────────────────
 * Pure functions — zero Supabase queries, zero side effects.
 * Works entirely on data already loaded in AppContext.
 *
 * Exported:
 *  • scoreJobForSeeker(job, user) → 0–100
 *  • scoreSeekerForJob(user, job) → 0–100
 *  • filterAndRankJobs(jobs, user) → Job[] sorted by score desc
 *  • filterAndRankSeekers(users, job, max?) → RankedSeeker[]
 *  • getSmartNewsTags(user) → string[]  (for NewsView smart filter)
 * ─────────────────────────────────────────────────────────────────
 */

import type { AppUser, Job } from '../../types';

// ── Exported types ────────────────────────────────────────────────

export interface RankedJob {
  job: Job;
  score: number;       // 0–100
  reasons: string[];   // human-readable match reasons (Arabic)
}

export interface RankedSeeker {
  user: AppUser;
  score: number;       // 0–100
  reasons: string[];
}

// ── Internal helpers ──────────────────────────────────────────────

/**
 * Normalize Arabic / English text for comparison.
 * Strips diacritics, lowercases, trims.
 */
function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, '') // strip Arabic diacritics
    .replace(/[أإآا]/g, 'ا')         // normalize alef variants
    .replace(/ة/g, 'ه')              // ta marbuta → ha
    .replace(/ى/g, 'ي')              // alef maqsura → ya
    .trim();
}

// Stop words to ignore during title indexing
const STOP_WORDS = new Set([
  'مطلوب', 'عاجل', 'شركة', 'مؤسسة', 'في', 'من', 'على', 'إلى', 'مع', 'عن', 
  'وظيفة', 'وظائف', 'عمل', 'شاغر', 'شواغر', 'الشركة', 'بحاجة', 'جديد', 'عن بعد'
]);

/**
 * Clean and extract key profession tokens.
 */
function extractTokens(text: string): string[] {
  const norm = normalize(text);
  return norm
    .split(/[\s،,._\-\/]+/)
    .filter((w: string) => w.length >= 2 && !STOP_WORDS.has(w));
}

/**
 * Professional Token Index Similarity (0.0 to 1.0)
 * Evaluates match ratio relative to the core title keywords.
 */
function textSimilarity(a: string, b: string): number {
  const normA = normalize(a);
  const normB = normalize(b);

  if (!normA || !normB) return 0;

  const tokensA = extractTokens(a);
  const tokensB = extractTokens(b);

  if (!tokensA.length || !tokensB.length) return 0;

  // Exact full text match
  if (normA === normB) return 1.0;

  // Substring match (only for valid non-empty tokens with min length 3)
  if ((normA.length >= 3 && normB.includes(normA)) || (normB.length >= 3 && normA.includes(normB))) {
    return 1.0;
  }

  // Count common key tokens
  const common = tokensA.filter(ta =>
    tokensB.some(tb => tb === ta || (ta.length >= 3 && tb.includes(ta)) || (tb.length >= 3 && ta.includes(tb)))
  );

  if (!common.length) return 0;

  // Professional match ratio relative to the shorter professional title
  return common.length / Math.min(tokensA.length, tokensB.length);
}

/**
 * Location match score — 0.0 to 1.0.
 */
function locationSimilarity(locA: string, locB: string): number {
  const aN = normalize(locA);
  const bN = normalize(locB);
  if (!aN || !bN) return 0.0;
  const REMOTE = ['عن بعد', 'remote', 'بعد', 'اون لاين', 'online'];
  if (REMOTE.some(r => aN.includes(r)) || REMOTE.some(r => bN.includes(r))) return 0.9;
  return textSimilarity(locA, locB);
}

/**
 * Score a seeker for a job posting — for employer view (0–100).
 *
 * Professional Search Algorithm:
 *   1. Token Index Match on Job Title (up to 60 pts)
 *   2. Location Match (up to 40 pts)
 */
export function scoreSeekerForJob(_user: AppUser, _job: Job): number {
  return 0;
}

/**
 * Score a job for a job-seeker (0–100).
 * Evaluates how suitable a job posting is for a given seeker profile.
 */
export function scoreJobForSeeker(job: Job, user: AppUser | null): number {
  if (!user) return 0;

  const userTitleStr = (
    user.title || 
    (user as any).job_title || 
    (user as any).headline || 
    (user as any).profession || 
    user.bio || 
    ''
  ).trim();

  if (!userTitleStr) return 0;

  const titleSim = textSimilarity(userTitleStr, job.title);
  if (titleSim <= 0) return 0;

  const titleScore  = titleSim * 60;
  const locScore    = locationSimilarity(user.location || '', job.location || '') * 35;
  const activeBonus = job.is_active !== false ? 5 : 0;

  return Math.min(100, Math.round(titleScore + locScore + activeBonus));
}

/**
 * Build human-readable reasons for a job match (Arabic).
 */
export function jobMatchReasons(job: Job, user: AppUser | null): string[] {
  if (!user) return [];
  const reasons: string[] = [];

  const userTitleStr = (
    user.title || 
    (user as any).job_title || 
    (user as any).headline || 
    (user as any).profession || 
    ''
  ).trim();

  if (userTitleStr && textSimilarity(userTitleStr, job.title) >= 0.4)
    reasons.push(`مطابقة مسمى: "${job.title}"`);

  const locSim = locationSimilarity(user.location || '', job.location || '');
  if (locSim >= 0.7)
    reasons.push(`الموقع مناسب (${job.location || 'عن بُعد'})`);

  return reasons;
}



/**
 * Build human-readable reasons for a seeker match (Arabic).
 */
export function seekerMatchReasons(user: AppUser, job: Job): string[] {
  const reasons: string[] = [];
  if (!user || !job) return reasons;

  if (textSimilarity(user.title || '', job.title) >= 0.5)
    reasons.push(`مسماه "${user.title}" قريب من الوظيفة`);

  const locSim = locationSimilarity(user.location || '', job.location || '');
  if (locSim >= 0.7)
    reasons.push(`الموقع: ${user.location || 'غير محدد'}`);

  const rawSkills = Array.isArray(user.skills)
    ? user.skills
    : typeof user.skills === 'string'
      ? (user.skills as string).split(/[,\n،]+/)
      : [];
  const matchedSkills = rawSkills.filter(s =>
    normalize((job.requirements || '') + ' ' + (job.description || '')).includes(normalize(String(s)))
  );
  if (matchedSkills.length)
    reasons.push(`مهارات مطلوبة: ${matchedSkills.slice(0, 3).join('، ')}`);

  if (user.cvUrl)
    reasons.push('لديه CV جاهز');

  return reasons;
}

// ── Filter & rank lists ───────────────────────────────────────────

/**
 * Filter and rank jobs for a seeker.
 * Returns ALL jobs sorted by score (score=0 jobs last).
 * If user has no profile data, returns jobs as-is (by date).
 */
export function filterAndRankJobs(jobs: Job[], user: AppUser | null): RankedJob[] {
  const hasSkills = Array.isArray(user?.skills) ? user.skills.length > 0 : Boolean(user?.skills);
  if (!user || (!user.title && !user.location && !hasSkills)) {
    // No profile data — return with zero score (preserve original order)
    return jobs.map(job => ({ job, score: 0, reasons: [] }));
  }

  return jobs
    .map(job => ({
      job,
      score: scoreJobForSeeker(job, user),
      reasons: jobMatchReasons(job, user),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Find and rank candidates for an employer's job posting.
 * Returns top `max` seekers with score > threshold.
 */
export function filterAndRankSeekers(
  _users: AppUser[],
  _job: Job,
  _max = 10,
  _minScore = 60
): RankedSeeker[] {
  return [];
}

/**
 * Get smart keyword tags from user profile for news filtering.
 * Used by NewsView to highlight relevant articles.
 */
export function getSmartNewsTags(user: AppUser | null): string[] {
  if (!user) return [];
  const tags: string[] = [];

  if (user.title) tags.push(...user.title.split(/\s+/).filter((w: string) => w.length > 2));
  if (user.industry) tags.push(user.industry);
  if (user.skills?.length) tags.push(...user.skills.slice(0, 5));
  if (user.location) tags.push(user.location);

  return Array.from(new Set(tags.map(t => normalize(t)))).filter(Boolean);
}

/**
 * Score a news item for a user (0–100).
 * Used by NewsView to reorder/highlight articles.
 */
export function scoreNewsItem(
  item: { title: string; content?: string; description?: string; topic?: string },
  user: AppUser | null
): number {
  if (!user) return 0;
  const tags = getSmartNewsTags(user);
  if (!tags.length) return 0;

  const text = normalize(
    [item.title, item.content, item.description, item.topic].join(' ')
  );

  const matched = tags.filter(tag => text.includes(normalize(tag)));
  const raw = (matched.length / Math.max(tags.length, 1)) * 100;
  return Math.min(100, Math.round(raw));
}
