import { normalizePhoneDigits } from '../utils/contact';

export type CvLanguage = 'ar' | 'en';
export type CvLanguageLevel = '' | 'native' | 'fluent' | 'advanced' | 'intermediate' | 'basic';

export interface CvIdentity {
  fullName: string;
  title: string;
  location: string;
  phone: string;
  email: string;
  website: string;
}

export interface CvExperience {
  id: string;
  role: string;
  company: string;
  location: string;
  start: string;
  end: string;
  current: boolean;
  description: string;
}

export interface CvEducation {
  id: string;
  degree: string;
  school: string;
  field: string;
  start: string;
  end: string;
  description: string;
}

export interface CvLanguageSkill {
  id: string;
  name: string;
  level: CvLanguageLevel;
}

export interface CvCertification {
  id: string;
  name: string;
  issuer: string;
  year: string;
}

export interface CvLink {
  id: string;
  label: string;
  url: string;
}

export interface CvSettings {
  language: CvLanguage;
  showPhoto: boolean;
  showPhone: boolean;
  showEmail: boolean;
}

export interface CvData {
  version: 1;
  personal: CvIdentity;
  summary: string;
  experiences: CvExperience[];
  education: CvEducation[];
  skills: string[];
  languages: CvLanguageSkill[];
  certifications: CvCertification[];
  links: CvLink[];
  settings: CvSettings;
  updatedAt: string;
}

export interface CvSnapshot {
  version: 1;
  data: CvData;
  capturedAt: string;
}

export function snapshotCv(input: CvData): CvSnapshot {
  const data = normalizeCvData(input);
  if (!data.settings.showPhone) data.personal.phone = '';
  if (!data.settings.showEmail) data.personal.email = '';
  data.settings.showPhoto = false;
  return { version: 1, data, capturedAt: new Date().toISOString() };
}

export function readCvSnapshot(input: unknown): CvSnapshot | null {
  const raw = asRecord(input);
  if (raw.version !== 1 || !raw.data) return null;
  const data = normalizeCvData(raw.data);
  if (!cvHasContent(data)) return null;
  return { version: 1, data, capturedAt: cleanCvText(raw.capturedAt, 40) };
}

export const PLATFORM_URL = 'https://nhdtcc100-ui.github.io/professional-jobs-app-prolink/';

export const CV_LIMITS = {
  name: 80,
  title: 100,
  location: 80,
  phone: 20,
  email: 120,
  url: 200,
  summary: 1000,
  experiences: 10,
  role: 100,
  company: 100,
  date: 20,
  experienceDescription: 1000,
  education: 6,
  degree: 120,
  school: 120,
  field: 100,
  educationDescription: 500,
  skills: 30,
  skill: 40,
  languages: 8,
  languageName: 40,
  certifications: 10,
  certificationName: 120,
  issuer: 100,
  links: 5,
  linkLabel: 40,
  descriptionLines: 25,
  maxBytes: 60000,
} as const;

export const CV_LANGUAGE_LEVELS: Exclude<CvLanguageLevel, ''>[] = ['native', 'fluent', 'advanced', 'intermediate', 'basic'];

export const CV_LABELS = {
  ar: {
    documentTitle: 'السيرة الذاتية',
    summary: 'النبذة المهنية',
    experience: 'الخبرات العملية',
    education: 'التعليم والمؤهلات',
    skills: 'المهارات',
    languages: 'اللغات',
    certifications: 'الشهادات والدورات',
    links: 'روابط',
    present: 'حتى الآن',
    whatsapp: 'واتساب',
    footerBrand: 'سيرة ذاتية أُنشئت عبر منصة عمل',
    page: (n: number, total: number) => `صفحة ${n} من ${total}`,
    levels: { native: 'اللغة الأم', fluent: 'طلاقة تامة', advanced: 'متقدم', intermediate: 'متوسط', basic: 'مبتدئ' },
  },
  en: {
    documentTitle: 'Curriculum Vitae',
    summary: 'Professional Summary',
    experience: 'Work Experience',
    education: 'Education',
    skills: 'Skills',
    languages: 'Languages',
    certifications: 'Certifications & Courses',
    links: 'Links',
    present: 'Present',
    whatsapp: 'WhatsApp',
    footerBrand: 'Created with Amal (عمل) platform',
    page: (n: number, total: number) => `Page ${n} of ${total}`,
    levels: { native: 'Native', fluent: 'Fluent', advanced: 'Advanced', intermediate: 'Intermediate', basic: 'Basic' },
  },
} as const;

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const STRIP_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const EMAIL_RE = /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[^\s@<>()"',;:]{2,}$/;
const INTERNAL_EMAIL_RE = /@prolink\.(internal|local)$/i;

export function newCvId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 16);
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
}

function cutSafe(s: string, max: number): string {
  if (s.length <= max) return s;
  let out = s.slice(0, max);
  const last = out.charCodeAt(out.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) out = out.slice(0, -1);
  return out;
}

export function cleanCvText(value: unknown, max: number, multiline = false): string {
  let s: string;
  if (typeof value === 'string') s = value;
  else if (typeof value === 'number' && Number.isFinite(value)) s = String(value);
  else return '';
  s = s.replace(/\r\n?/g, '\n').replace(/[\u2028\u2029]/g, '\n').replace(/\t/g, ' ').replace(STRIP_RE, '');
  if (multiline) {
    s = s
      .split('\n')
      .map(line => line.replace(/[ \u00A0]{2,}/g, ' ').trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const lines = s.split('\n');
    if (lines.length > CV_LIMITS.descriptionLines) s = lines.slice(0, CV_LIMITS.descriptionLines).join('\n');
  } else {
    s = s.replace(/\s+/g, ' ').trim();
  }
  return cutSafe(s, max).trimEnd();
}

export function normalizeCvUrl(value: unknown): string {
  const raw = cleanCvText(value, CV_LIMITS.url + 20).replace(/\s+/g, '');
  if (!raw) return '';
  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    if (!/^[^/?#@:]+\.[^/?#@:]{2,}([/?#].*)?$/.test(candidate)) return '';
    candidate = `https://${candidate}`;
  }
  if (!/^https?:\/\//i.test(candidate)) return '';
  try {
    const url = new URL(candidate);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname.includes('.')) return '';
    if (url.username || url.password) return '';
    const href = url.href;
    return href.length > CV_LIMITS.url ? '' : href;
  } catch {
    return '';
  }
}

export function normalizeCvEmail(value: unknown): string {
  const s = cleanCvText(value, CV_LIMITS.email).replace(/\s+/g, '').toLowerCase();
  if (!s || !EMAIL_RE.test(s) || INTERNAL_EMAIL_RE.test(s)) return '';
  return s;
}

export function normalizeCvPhone(value: unknown): string {
  const s = normalizePhoneDigits(cleanCvText(value, 40)).replace(/[^0-9+\s()-]/g, '').replace(/\s+/g, ' ').trim();
  const digits = s.replace(/\D/g, '');
  if (digits.length < 6) return '';
  return cutSafe(s, CV_LIMITS.phone).trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanId(value: unknown): string {
  return typeof value === 'string' && ID_RE.test(value) ? value : newCvId();
}

function uniqueIds<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.map(item => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      return item;
    }
    const copy = { ...item, id: newCvId() };
    seen.add(copy.id);
    return copy;
  });
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function createEmptyCvData(language: CvLanguage = 'ar'): CvData {
  return {
    version: 1,
    personal: { fullName: '', title: '', location: '', phone: '', email: '', website: '' },
    summary: '',
    experiences: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    links: [],
    settings: { language, showPhoto: true, showPhone: true, showEmail: true },
    updatedAt: '',
  };
}

export function normalizeCvData(input: unknown): CvData {
  const src = asRecord(input);
  const personal = asRecord(src.personal);
  const settings = asRecord(src.settings);

  const experiences = asArray(src.experiences)
    .map(raw => {
      const e = asRecord(raw);
      const current = bool(e.current, false);
      return {
        id: cleanId(e.id),
        role: cleanCvText(e.role, CV_LIMITS.role),
        company: cleanCvText(e.company, CV_LIMITS.company),
        location: cleanCvText(e.location, CV_LIMITS.location),
        start: cleanCvText(e.start, CV_LIMITS.date),
        end: current ? '' : cleanCvText(e.end, CV_LIMITS.date),
        current,
        description: cleanCvText(e.description, CV_LIMITS.experienceDescription, true),
      };
    })
    .filter(e => e.role || e.company || e.description)
    .slice(0, CV_LIMITS.experiences);

  const education = asArray(src.education)
    .map(raw => {
      const e = asRecord(raw);
      return {
        id: cleanId(e.id),
        degree: cleanCvText(e.degree, CV_LIMITS.degree),
        school: cleanCvText(e.school, CV_LIMITS.school),
        field: cleanCvText(e.field, CV_LIMITS.field),
        start: cleanCvText(e.start, CV_LIMITS.date),
        end: cleanCvText(e.end, CV_LIMITS.date),
        description: cleanCvText(e.description, CV_LIMITS.educationDescription, true),
      };
    })
    .filter(e => e.degree || e.school || e.field || e.description)
    .slice(0, CV_LIMITS.education);

  const seenSkills = new Set<string>();
  const skills = asArray(src.skills)
    .map(s => cleanCvText(s, CV_LIMITS.skill))
    .filter(s => {
      const key = s.toLowerCase();
      if (!s || seenSkills.has(key)) return false;
      seenSkills.add(key);
      return true;
    })
    .slice(0, CV_LIMITS.skills);

  const languages = asArray(src.languages)
    .map(raw => {
      const l = asRecord(raw);
      const level = CV_LANGUAGE_LEVELS.includes(l.level as any) ? (l.level as CvLanguageLevel) : '';
      return { id: cleanId(l.id), name: cleanCvText(l.name, CV_LIMITS.languageName), level };
    })
    .filter(l => l.name)
    .slice(0, CV_LIMITS.languages);

  const certifications = asArray(src.certifications)
    .map(raw => {
      const c = asRecord(raw);
      return {
        id: cleanId(c.id),
        name: cleanCvText(c.name, CV_LIMITS.certificationName),
        issuer: cleanCvText(c.issuer, CV_LIMITS.issuer),
        year: cleanCvText(c.year, CV_LIMITS.date),
      };
    })
    .filter(c => c.name)
    .slice(0, CV_LIMITS.certifications);

  const links = asArray(src.links)
    .map(raw => {
      const l = asRecord(raw);
      return { id: cleanId(l.id), label: cleanCvText(l.label, CV_LIMITS.linkLabel), url: normalizeCvUrl(l.url) };
    })
    .filter(l => l.url)
    .slice(0, CV_LIMITS.links);

  return {
    version: 1,
    personal: {
      fullName: cleanCvText(personal.fullName, CV_LIMITS.name),
      title: cleanCvText(personal.title, CV_LIMITS.title),
      location: cleanCvText(personal.location, CV_LIMITS.location),
      phone: normalizeCvPhone(personal.phone),
      email: normalizeCvEmail(personal.email),
      website: normalizeCvUrl(personal.website),
    },
    summary: cleanCvText(src.summary, CV_LIMITS.summary, true),
    experiences: uniqueIds(experiences),
    education: uniqueIds(education),
    skills,
    languages: uniqueIds(languages),
    certifications: uniqueIds(certifications),
    links: uniqueIds(links),
    settings: {
      language: settings.language === 'en' ? 'en' : 'ar',
      showPhoto: bool(settings.showPhoto, true),
      showPhone: bool(settings.showPhone, true),
      showEmail: bool(settings.showEmail, true),
    },
    updatedAt: typeof src.updatedAt === 'string' && !Number.isNaN(Date.parse(src.updatedAt)) ? src.updatedAt : '',
  };
}

export interface CvProfileSource {
  name?: string;
  fullName?: string;
  title?: string;
  displayTitle?: string;
  display_title?: string;
  specialty?: string;
  location?: string;
  governorate?: string;
  phone?: string;
  email?: string;
  website?: string;
  bio?: string;
  about?: string;
  skills?: any;
  experience?: any;
  education?: any;
  [key: string]: any;
}

export function cvFromProfile(user: CvProfileSource | null | undefined, language: CvLanguage = 'ar'): CvData {
  const data = createEmptyCvData(language);
  if (!user) return data;
  data.personal = {
    fullName: user.fullName || user.name || 'المستخدم',
    title: user.displayTitle || user.display_title || user.title || user.specialty || '',
    location: user.location || user.governorate || '',
    phone: user.phone || '',
    email: user.email || '',
    website: user.website || '',
  };
  data.summary = user.bio || user.about || '';
  data.skills = Array.isArray(user.skills)
    ? user.skills.map((s: any) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
    : [];

  if (Array.isArray(user.experience)) {
    data.experiences = user.experience.map((e: any) => ({
      id: cleanId(e.id),
      role: cleanCvText(e.role || e.title || e.position || '', CV_LIMITS.role),
      company: cleanCvText(e.company || e.employer || '', CV_LIMITS.company),
      location: cleanCvText(e.location || '', CV_LIMITS.location),
      start: cleanCvText(e.start || e.startDate || '', CV_LIMITS.date),
      end: e.current ? '' : cleanCvText(e.end || e.endDate || '', CV_LIMITS.date),
      current: Boolean(e.current),
      description: cleanCvText(e.description || '', CV_LIMITS.experienceDescription, true),
    })).filter((e: any) => e.role || e.company || e.description);
  } else {
    const experienceText = cleanCvText(user.experience, CV_LIMITS.experienceDescription, true);
    if (experienceText) {
      data.experiences = [{ id: newCvId(), role: '', company: '', location: '', start: '', end: '', current: false, description: experienceText }];
    }
  }

  if (Array.isArray(user.education)) {
    data.education = user.education.map((edu: any) => ({
      id: cleanId(edu.id),
      degree: cleanCvText(edu.degree || '', CV_LIMITS.degree),
      school: cleanCvText(edu.school || edu.institution || '', CV_LIMITS.school),
      field: cleanCvText(edu.field || '', CV_LIMITS.field),
      start: cleanCvText(edu.start || edu.startDate || '', CV_LIMITS.date),
      end: cleanCvText(edu.end || edu.endDate || '', CV_LIMITS.date),
      description: cleanCvText(edu.description || '', CV_LIMITS.educationDescription, true),
    })).filter((edu: any) => edu.degree || edu.school || edu.field);
  } else {
    const educationText = cleanCvText(user.education, CV_LIMITS.degree + CV_LIMITS.educationDescription, true);
    if (educationText) {
      const [first, ...rest] = educationText.split('\n');
      data.education = [{ id: newCvId(), degree: first, school: '', field: '', start: '', end: '', description: rest.join('\n') }];
    }
  }

  return normalizeCvData(data);
}

export function withProfileIdentity(data: CvData, user: CvProfileSource | null | undefined): CvData {
  if (!user) return data;
  const fromProfile = cvFromProfile(user, data.settings.language).personal;
  const personal = { ...data.personal };
  (Object.keys(personal) as (keyof CvIdentity)[]).forEach(key => {
    if (!personal[key]) personal[key] = fromProfile[key];
  });
  return { ...data, personal };
}

export function cvHasContent(data: CvData | null | undefined): boolean {
  if (!data) return false;
  return Boolean(
    data.personal.fullName &&
      (data.summary || data.experiences.length || data.education.length || data.skills.length || data.certifications.length)
  );
}

export function cvCompleteness(data: CvData): number {
  const checks: [boolean, number][] = [
    [Boolean(data.personal.fullName), 10],
    [Boolean(data.personal.title), 10],
    [Boolean(data.personal.phone || data.personal.email), 10],
    [Boolean(data.personal.location), 5],
    [data.summary.length >= 40, 15],
    [data.experiences.length > 0, 20],
    [data.education.length > 0, 15],
    [data.skills.length >= 3, 10],
    [data.languages.length > 0, 5],
  ];
  return checks.reduce((sum, [ok, weight]) => sum + (ok ? weight : 0), 0);
}

export function cvByteSize(data: CvData): number {
  return new TextEncoder().encode(JSON.stringify(data)).length;
}

export function cvFileName(data: CvData): string {
  const name = data.personal.fullName.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, '_').slice(0, 60);
  return `CV_${name || 'Prolink'}.pdf`;
}
