import { supabase } from '../supabase';
import { CV_LIMITS, CvData, cvByteSize, normalizeCvData } from '../cv/cvData';

export interface CvProfileRecord {
  data: CvData;
  isPublic: boolean;
  updatedAt: string;
  storage: 'database' | 'local';
}

const keyFor = (userId: string) => `prolink:cv-draft:v1:${userId}`;
const missingTable = (error: { code?: string } | null) => error?.code === '42P01' || error?.code === 'PGRST205';

function decodeRecord(raw: unknown, storage: CvProfileRecord['storage']): CvProfileRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (!row.data) return null;
  return {
    data: normalizeCvData(row.data),
    isPublic: row.is_public === true,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
    storage,
  };
}

export const cvProfileService = {
  readDraft(userId: string): CvProfileRecord | null {
    try {
      const value = localStorage.getItem(keyFor(userId));
      return value ? decodeRecord(JSON.parse(value), 'local') : null;
    } catch {
      return null;
    }
  },

  writeDraft(userId: string, data: CvData, isPublic: boolean, updatedAt = new Date().toISOString()): void {
    const normalized = normalizeCvData(data);
    if (cvByteSize(normalized) > CV_LIMITS.maxBytes) throw new Error('السيرة طويلة جداً؛ اختصر بعض التفاصيل');
    localStorage.setItem(keyFor(userId), JSON.stringify({ data: normalized, is_public: isPublic, updated_at: updatedAt }));
  },

  async loadOwn(userId: string): Promise<CvProfileRecord | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const { data, error } = await supabase.from('cv_profiles').select('data,is_public,updated_at').eq('user_id', userId).abortSignal(controller.signal).maybeSingle();
      if (missingTable(error)) return this.readDraft(userId);
      if (error) throw new Error('تعذر تحميل السيرة الذاتية؛ حاول مرة أخرى');
      const remote = decodeRecord(data, 'database');
      const draft = this.readDraft(userId);
      if (draft && (!remote || Date.parse(draft.updatedAt) > Date.parse(remote.updatedAt))) return draft;
      return remote;
    } finally {
      clearTimeout(timer);
    }
  },

  async loadPublic(userId: string): Promise<CvProfileRecord | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const { data, error } = await supabase.from('cv_profiles').select('data,is_public,updated_at').eq('user_id', userId).eq('is_public', true).abortSignal(controller.signal).maybeSingle();
      if (missingTable(error)) return null;
      if (error) throw new Error('تعذر عرض السيرة الذاتية');
      return decodeRecord(data, 'database');
    } finally {
      clearTimeout(timer);
    }
  },

  async save(userId: string, input: CvData, isPublic: boolean): Promise<CvProfileRecord> {
    const data = normalizeCvData(input);
    data.updatedAt = new Date().toISOString();
    if (cvByteSize(data) > CV_LIMITS.maxBytes) throw new Error('السيرة طويلة جداً؛ اختصر بعض التفاصيل');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const { error } = await supabase.from('cv_profiles').upsert({ user_id: userId, data, is_public: isPublic, updated_at: data.updatedAt }, { onConflict: 'user_id' }).abortSignal(controller.signal);
      if (error && !missingTable(error)) throw new Error('تعذر حفظ السيرة الذاتية؛ حاول مرة أخرى');
      try { this.writeDraft(userId, data, isPublic, data.updatedAt); }
      catch (draftError) { if (error) throw draftError; }
      return { data, isPublic, updatedAt: data.updatedAt, storage: error ? 'local' : 'database' };
    } finally {
      clearTimeout(timer);
    }
  },
};
