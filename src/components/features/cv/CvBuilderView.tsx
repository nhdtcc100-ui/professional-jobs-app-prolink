import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ArrowRight, Check, Download, FileText, Loader2, Save, Share2, X } from 'lucide-react';
import type { AppUser } from '../../../types';
import { useAppContext } from '../../../contexts/AppContext';
import { profileService } from '../../../lib/services/profileService';
import { cvProfileService } from '../../../lib/services/cvProfileService';
import type { CvProfileRecord } from '../../../lib/services/cvProfileService';
import {
  CV_LABELS, CV_LIMITS, cvByteSize, cvCompleteness, cvFromProfile, cvHasContent,
  normalizeCvData, normalizeCvEmail, normalizeCvPhone, normalizeCvUrl,
} from '../../../lib/cv/cvData';
import type { CvData } from '../../../lib/cv/cvData';
import { isContactPhone, normalizePhoneDigits } from '../../../lib/utils/contact';
import { downloadCvPdf, exportCvPdf, shareCvPdf } from '../../../lib/cv/cvExport';
import { CvPreview } from './CvPreview';
import {
  CvCertificationLinkFields, CvEducationFields, CvExperienceFields, CvPersonalFields,
  CvPreviewSettings, CvSkillsLanguageFields, CvSummaryField,
} from './CvBuilderFields';
import type { CvFieldErrors } from './CvBuilderFields';

export interface CvBuilderViewProps {
  user: AppUser;
  onClose: () => void;
  onSaved?: (data: CvData) => void;
}

type Notice = { tone: 'info' | 'success' | 'warning' | 'error'; text: string };
type Operation = 'save' | 'prepare' | 'share' | 'download';
type PreparedPdf = { blob: Blob; data: CvData; revision: number; avatarUrl?: string };
const steps = ['البيانات الشخصية', 'النبذة المهنية', 'الخبرات', 'التعليم', 'المهارات واللغات', 'الشهادات والروابط', 'المعاينة والتصدير'];
const buttonBase = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50';
const button = `${buttonBase} border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800`;
const primaryButton = `${buttonBase} border-blue-700 bg-blue-700 text-white hover:bg-blue-800 dark:border-blue-600 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700`;
const activeStepButton = `${buttonBase} border-blue-600 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-100 dark:hover:bg-blue-900`;

// Validate BEFORE normalization: invalid supplied contacts/links must never disappear silently.
function validateFields(data: CvData, requireName = false): CvFieldErrors {
  const errors: CvFieldErrors = {};
  if (requireName && !data.personal.fullName.trim()) errors['personal.fullName'] = 'أدخل الاسم الكامل.';
  if (data.personal.email.trim() && (/\s/.test(data.personal.email.trim()) || !normalizeCvEmail(data.personal.email))) {
    errors['personal.email'] = 'أدخل بريد تواصل صالحاً، أو اترك الحقل فارغاً.';
  }
  if (data.personal.phone.trim() && (!/^\+?[\d\s()-]+$/.test(normalizePhoneDigits(data.personal.phone.trim())) || !isContactPhone(data.personal.phone) || !normalizeCvPhone(data.personal.phone))) {
    errors['personal.phone'] = 'أدخل رقماً عراقياً صالحاً أو رقماً دولياً مع رمز الدولة، مثل +9647701234567.';
  }
  const checkUrl = (value: string, field: string) => {
    if (value.trim() && (/\s/.test(value.trim()) || !normalizeCvUrl(value))) errors[field] = 'أدخل رابط http أو https صالحاً دون مسافات، أو اترك الحقل فارغاً.';
  };
  const checkLines = (value: string, field: string) => {
    if (value.split(/\r\n?|\n|[\u2028\u2029]/).length > CV_LIMITS.descriptionLines) errors[field] = `اختصر النص إلى ${CV_LIMITS.descriptionLines} سطراً حتى لا تُحذف التفاصيل.`;
  };
  checkUrl(data.personal.website, 'personal.website');
  checkLines(data.summary, 'summary');
  data.experiences.forEach(e => {
    if (!(e.role.trim() || e.company.trim() || e.description.trim()) && (e.location.trim() || e.start.trim() || e.end.trim() || e.current)) errors[`experiences.${e.id}.role`] = 'أضف مسمى أو جهة عمل أو وصفاً لهذه الخبرة، أو احذفها.';
    checkLines(e.description, `experiences.${e.id}.description`);
  });
  data.education.forEach(e => {
    if (!(e.degree.trim() || e.school.trim() || e.field.trim() || e.description.trim()) && (e.start.trim() || e.end.trim())) errors[`education.${e.id}.degree`] = 'أضف مؤهلاً أو جهة تعليم أو تخصصاً أو وصفاً، أو احذف هذا العنصر.';
    checkLines(e.description, `education.${e.id}.description`);
  });
  data.languages.forEach(l => {
    if (!l.name.trim() && l.level) errors[`languages.${l.id}.name`] = 'أدخل اسم اللغة أو احذفها.';
  });
  data.certifications.forEach(c => {
    if (!c.name.trim() && (c.issuer.trim() || c.year.trim())) errors[`certifications.${c.id}.name`] = 'أدخل اسم الشهادة أو احذفها.';
  });
  data.links.forEach(l => {
    if (!l.url.trim() && l.label.trim()) errors[`links.${l.id}.url`] = 'أدخل رابطاً لهذا العنوان أو احذف العنصر.';
    checkUrl(l.url, `links.${l.id}.url`);
  });
  if (cvByteSize(normalizeCvData(data)) > CV_LIMITS.maxBytes) errors.document = 'السيرة طويلة جداً؛ اختصر بعض التفاصيل قبل الحفظ أو التصدير.';
  return errors;
}

function profileUpdates(data: CvData) {
  const present = CV_LABELS[data.settings.language].present;
  return {
    name: data.personal.fullName, title: data.personal.title,
    display_title: data.personal.title, displayTitle: data.personal.title,
    location: data.personal.location, phone: data.personal.phone, website: data.personal.website,
    skills: [...data.skills],
    experience: data.experiences.map(e => [
      [e.role, e.company].filter(Boolean).join(' — '),
      [e.start, e.current ? present : e.end].filter(Boolean).join(' — '), e.description,
    ].filter(Boolean).join('\n')).join('\n\n'),
    education: data.education.map(e => [
      [e.degree, e.school, e.field].filter(Boolean).join(' — '),
      [e.start, e.end].filter(Boolean).join(' — '), e.description,
    ].filter(Boolean).join('\n')).join('\n\n'),
    // CV summary, login email, roles, avatar, and the previously uploaded cvUrl are deliberately absent.
  };
}

function NoticeBlock({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const colors = {
    info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100',
    success: 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100',
    warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
    error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
  };
  return <p role={notice.tone === 'error' || notice.tone === 'warning' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm leading-6 ${colors[notice.tone]}`}>{notice.text}</p>;
}

export function CvBuilderView(props: CvBuilderViewProps) {
  // A new user gets an isolated session; stale async work cannot target the next account.
  return <CvBuilderSession key={props.user.id} {...props} />;
}

function CvBuilderSession({ user, onClose, onSaved }: CvBuilderViewProps) {
  const { appUser, setAppUser } = useAppContext();
  const id = useId();
  const [data, setData] = useState<CvData>(() => cvFromProfile(user));
  const [isPublic, setIsPublic] = useState(false);
  const [step, setStep] = useState(0);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadNotice, setLoadNotice] = useState<Notice | null>(null);
  const [draftNotice, setDraftNotice] = useState<Notice | null>(null);
  const [actionNotice, setActionNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<Operation | null>(null);
  const [prepared, setPrepared] = useState<PreparedPdf | null>(null);
  const [requireName, setRequireName] = useState(false);
  const [closeWarning, setCloseWarning] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const alive = useRef(false);
  const closed = useRef(false);
  const loadTicket = useRef(0);
  const revision = useRef(0);
  const operation = useRef<Operation | null>(null);
  const dirty = useRef(false);
  const fallback = useRef<CvProfileRecord | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const closeHeading = useRef<HTMLHeadingElement>(null);
  const authenticatedSessionSeen = useRef(Boolean(appUser));
  if (appUser) authenticatedSessionSeen.current = true;
  const latest = useRef({ data, isPublic, loadState, appUser, onClose, onSaved, step, closeWarning, user });
  latest.current = { data, isPublic, loadState, appUser, onClose, onSaved, step, closeWarning, user };
  const isActive = useCallback(() => alive.current && !closed.current && (!authenticatedSessionSeen.current || latest.current.appUser?.id === user.id), [user.id]);
  const normalized = useMemo(() => normalizeCvData(data), [data]);
  const errors = useMemo(() => validateFields(data, requireName), [data, requireName]);
  const canExport = Boolean(normalized.personal.fullName && cvHasContent(normalized));
  const avatarUrl = appUser?.id === user.id ? appUser.avatar || undefined : user.avatar || undefined;

  const persistDraft = useCallback((notify = true): boolean => {
    const current = latest.current;
    if (current.loadState !== 'ready' || !dirty.current) return true;
    try {
      const problems = validateFields(current.data);
      const firstError = Object.values(problems)[0];
      if (firstError) {
        if (notify && isActive()) setDraftNotice({ tone: 'warning', text: `لم تُحفظ آخر التغييرات على الجهاز: ${firstError}` });
        return false;
      }
      const draft = { ...current.data, updatedAt: new Date().toISOString() };
      cvProfileService.writeDraft(user.id, draft, current.isPublic);
      dirty.current = false;
      if (notify && isActive()) setDraftNotice({ tone: 'info', text: `حُفظت المسودة على هذا الجهاز فقط (${new Date(draft.updatedAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}). حفظ الحساب والنشر يتطلبان زر «حفظ السيرة».` });
      return true;
    } catch {
      if (notify && isActive()) setDraftNotice({ tone: 'warning', text: 'تعذر حفظ المسودة على الجهاز؛ قد تكون مساحة التخزين ممتلئة أو التخزين محظوراً. لا تغلق المعالج قبل حفظ السيرة بنجاح.' });
      if (!notify) console.warn('[CV builder] Local draft could not be persisted.');
      return false;
    }
  }, [isActive, user.id]);

  useEffect(() => {
    alive.current = true;
    closed.current = false;
    return () => {
      alive.current = false;
      loadTicket.current += 1;
      revision.current += 1;
      if (!closed.current) persistDraft(false);
    };
  }, [persistDraft]);

  const applyLoaded = useCallback((record: CvProfileRecord | null) => {
    if (!isActive()) return;
    const next = record?.data || { ...cvFromProfile(latest.current.user), updatedAt: new Date().toISOString() };
    // A recovered draft remembers the user's choice, not proof of publication.
    // Local-only saves explicitly reset this choice to false below.
    const visibility = record?.isPublic === true;
    revision.current += 1;
    dirty.current = !record;
    setData(next);
    setIsPublic(Boolean(visibility));
    setPrepared(null);
    setLoadState('ready');
    latest.current = { ...latest.current, data: next, isPublic: Boolean(visibility), loadState: 'ready' };
    if (record?.storage === 'local') {
      setDraftNotice({ tone: 'info', text: 'استعدنا مسودة السيرة من هذا الجهاز. لا تؤكد المسودة حالة النشر على حسابك؛ اضغط «حفظ السيرة» لتحديث نسخة الحساب وظهورها.' });
    } else if (record) {
      setDraftNotice({ tone: 'info', text: record.isPublic ? 'تم تحميل السيرة المحفوظة العامة. لتغيير ظهورها، عدّل الخيار ثم احفظ.' : 'تم تحميل سيرتك الخاصة المحفوظة على الحساب.' });
    }
  }, [isActive]);

  useEffect(() => {
    const ticket = ++loadTicket.current;
    setLoadState('loading');
    setLoadNotice(null);
    try {
      // readDraft intentionally catches errors; surface unavailable browser storage here.
      void window.localStorage.length;
      fallback.current = cvProfileService.readDraft(user.id);
    } catch {
      fallback.current = null;
      setDraftNotice({ tone: 'warning', text: 'تخزين الجهاز غير متاح؛ قد لا يمكن استعادة مسودة أو حفظها تلقائياً.' });
    }
    void cvProfileService.loadOwn(user.id).then(record => {
      if (!isActive() || loadTicket.current !== ticket) return;
      applyLoaded(record);
    }).catch(() => {
      if (!isActive() || loadTicket.current !== ticket) return;
      setLoadState('error');
      setLoadNotice({ tone: 'error', text: 'تعذر تحميل نسخة الحساب. يمكنك إعادة المحاولة أو المتابعة بمسودة الجهاز / بيانات ملفك. الحفظ بعد المتابعة قد يستبدل نسخة حساب لم نتمكن من تحميلها.' });
    });
    return () => { if (loadTicket.current === ticket) loadTicket.current += 1; };
  }, [user.id, loadAttempt, applyLoaded, isActive]);

  useEffect(() => {
    if (loadState !== 'ready') return;
    const timer = window.setTimeout(() => { persistDraft(); }, 650);
    return () => window.clearTimeout(timer);
  }, [data, isPublic, loadState, persistDraft]);

  useEffect(() => {
    const flush = () => { persistDraft(); };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility); };
  }, [persistDraft]);

  useEffect(() => {
    revision.current += 1;
    setPrepared(null);
  }, [avatarUrl]);

  const changeData = (next: CvData) => {
    if (operation.current || !isActive()) return;
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    revision.current += 1;
    dirty.current = true;
    latest.current.data = stamped;
    setData(stamped);
    setPrepared(null);
    setActionNotice(null);
    setDraftNotice({ tone: 'info', text: 'تغييرات غير محفوظة على الحساب؛ جارٍ حفظ مسودة الجهاز…' });
  };
  const changeVisibility = (value: boolean) => {
    if (operation.current || !isActive()) return;
    revision.current += 1;
    dirty.current = true;
    const stamped = { ...latest.current.data, updatedAt: new Date().toISOString() };
    latest.current = { ...latest.current, data: stamped, isPublic: value };
    setData(stamped);
    setIsPublic(value);
    setPrepared(null);
    setActionNotice(null);
    setDraftNotice({ tone: 'info', text: 'تغيير الظهور لم يُحفظ على الحساب بعد؛ جارٍ حفظ مسودة الجهاز…' });
  };

  const finishClose = useCallback(() => {
    closed.current = true;
    revision.current += 1;
    latest.current.onClose();
  }, []);
  const requestClose = useCallback(() => {
    if (operation.current) {
      setActionNotice({ tone: 'info', text: 'انتظر انتهاء العملية الحالية قبل الإغلاق.' });
      return;
    }
    if (!persistDraft()) { setCloseWarning(true); return; }
    finishClose();
  }, [finishClose, persistDraft]);
  const goBack = useCallback(() => {
    if (latest.current.closeWarning) { setCloseWarning(false); return; }
    if (latest.current.step > 0) setStep(current => current - 1);
    else requestClose();
  }, [requestClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (latest.current.closeWarning) setCloseWarning(false);
        else requestClose();
      } else if (event.key === 'Tab' && dialog.current) {
        const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter(element => element.getClientRects().length && !element.closest('fieldset:disabled'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) { event.preventDefault(); heading.current?.focus(); return; }
        const outside = !focusable.includes(document.activeElement as HTMLElement);
        if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    let disposed = false;
    let removeNativeListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      void CapacitorApp.addListener('backButton', () => { if (!disposed) goBack(); }).then(handle => {
        const remove = () => { void handle.remove().catch(() => undefined); };
        if (disposed) remove(); else removeNativeListener = remove;
      }).catch(() => { if (!disposed) setLoadNotice({ tone: 'warning', text: 'تعذر تفعيل زر الرجوع في الجهاز؛ استخدم زر الرجوع أعلى الشاشة.' }); });
    }
    return () => {
      disposed = true;
      removeNativeListener?.();
      document.removeEventListener('keydown', keydown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [goBack, requestClose]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scrollArea.current?.scrollTo({ top: 0 });
      if (closeWarning) { closeHeading.current?.focus(); return; }
      heading.current?.focus();
      if (pendingFocus.current) {
        const field = Array.from(dialog.current?.querySelectorAll<HTMLElement>('[data-cv-field]') || []).find(element => element.dataset.cvField === pendingFocus.current);
        field?.focus();
        pendingFocus.current = null;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step, loadState, closeWarning, focusRequest]);

  const validated = (forExport: boolean): CvData | null => {
    const current = latest.current.data;
    const problems = validateFields(current, true);
    setRequireName(true);
    const first = Object.keys(problems)[0];
    if (first) {
      pendingFocus.current = first;
      const section = first.split('.')[0];
      setStep(section === 'personal' ? 0 : section === 'summary' ? 1 : section === 'experiences' ? 2 : section === 'education' ? 3 : section === 'languages' || section === 'skills' ? 4 : section === 'document' ? 6 : 5);
      setFocusRequest(value => value + 1);
      setActionNotice({ tone: 'error', text: `صحّح الحقل قبل الحفظ أو التصدير: ${problems[first]}` });
      return null;
    }
    const result = normalizeCvData(current);
    if (forExport && !cvHasContent(result)) {
      setStep(1);
      setActionNotice({ tone: 'error', text: 'أضف نبذة أو خبرة أو تعليماً أو مهارة أو شهادة قبل تجهيز السيرة للمشاركة.' });
      return null;
    }
    return { ...result, updatedAt: new Date().toISOString() };
  };
  const startOperation = (name: Operation): boolean => {
    if (operation.current || latest.current.loadState !== 'ready' || !isActive()) return false;
    operation.current = name;
    setBusy(name);
    setActionNotice(null);
    return true;
  };
  const endOperation = (name: Operation) => {
    if (operation.current !== name) return;
    operation.current = null;
    if (isActive()) setBusy(null);
  };

  const save = async () => {
    if (operation.current || !isActive()) return;
    const snapshot = validated(false);
    if (!snapshot || !startOperation('save')) return;
    try {
      const record = await cvProfileService.save(user.id, snapshot, latest.current.isPublic);
      if (!isActive()) return;
      if (!record || (record.storage !== 'database' && record.storage !== 'local')) throw new Error('Unconfirmed CV save');
      const publicValue = record.storage === 'database' && record.isPublic;
      revision.current += 1;
      dirty.current = false;
      latest.current = { ...latest.current, data: record.data, isPublic: Boolean(publicValue) };
      setData(record.data);
      setIsPublic(Boolean(publicValue));
      setPrepared(null);
      setLoadNotice(null);
      const cvReport = record.storage === 'local'
        ? 'حُفظت السيرة على هذا الجهاز فقط؛ ترحيل قاعدة بيانات السير غير مطبّق، ولم تُنشر السيرة ولن تنتقل إلى جهاز آخر.'
        : record.isPublic ? 'حُفظت السيرة على الحساب وأصبحت جميع بياناتها مرئية للمستخدمين المسجّلين.' : 'حُفظت السيرة الخاصة على الحساب.';
      if (record.storage === 'local') {
        // The fallback must not leave a draft claiming it is public.
        try {
          cvProfileService.writeDraft(user.id, record.data, false);
          setDraftNotice({ tone: 'warning', text: cvReport });
        } catch {
          dirty.current = true;
          setDraftNotice({ tone: 'warning', text: 'تم حفظ نسخة محلية، لكن تعذر تحديث خيار خصوصية المسودة على الجهاز. النسخة المحلية ليست منشورة.' });
        }
      } else {
        setDraftNotice({ tone: 'info', text: 'نسخة الحساب والمسودة المحلية محفوظتان. أي تعديل جديد يتطلب حفظ الحساب مرة أخرى.' });
      }
      setActionNotice({ tone: 'info', text: `${cvReport} جارٍ مزامنة بيانات الملف الشخصي…` });
      try {
        const updates = profileUpdates(record.data);
        const result = await profileService.updateProfile(user.id, updates);
        if (!isActive()) return;
        if (!result || result.error || !result.data || (Array.isArray(result.data) && !result.data.length)) throw new Error('Profile sync failed');
        // AppContext supports functional updates at runtime; merge into the live user, never a stale prop.
        (setAppUser as Dispatch<SetStateAction<AppUser | null>>)(previous => previous?.id === user.id ? { ...previous, ...updates } : previous);
        setActionNotice({ tone: record.storage === 'local' ? 'warning' : 'success', text: `${cvReport} تمت مزامنة الاسم والمسمى والموقع والهاتف والموقع الإلكتروني والمهارات والخبرة والتعليم مع ملفك الشخصي. لم تتغير النبذة أو بريد الدخول أو ملف PDF المرفوع سابقاً.` });
      } catch {
        if (!isActive()) return;
        setActionNotice({ tone: 'warning', text: `${cvReport} حفظ جزئي: تعذرت مزامنة الملف الشخصي، ولا نؤكد حفظ بياناته. أعد الضغط على «حفظ السيرة» للمحاولة مجدداً.` });
      }
      if (isActive()) {
        try { latest.current.onSaved?.(record.data); }
        catch { console.warn('[CV builder] Saved CV callback failed.'); }
      }
    } catch {
      if (isActive()) setActionNotice({ tone: 'error', text: 'تعذر تأكيد حفظ السيرة على الحساب أو الجهاز. لم نبدأ مزامنة الملف الشخصي؛ احتفظ بالمعالج مفتوحاً وأعد المحاولة. إذا كان التخزين ممتلئاً فقد تفشل المسودة أيضاً.' });
    } finally { endOperation('save'); }
  };

  const preparePdf = async () => {
    if (operation.current || !isActive()) return;
    const snapshot = validated(true);
    if (!snapshot || !startOperation('prepare')) return;
    const ticket = revision.current;
    const photo = snapshot.settings.showPhoto ? avatarUrl : undefined;
    setPrepared(null);
    try {
      const blob = await exportCvPdf(snapshot, photo);
      if (!isActive()) return;
      if (revision.current !== ticket) {
        setActionNotice({ tone: 'info', text: 'تغيّرت بيانات المعاينة أثناء التجهيز؛ جهّز PDF مجدداً.' });
        return;
      }
      if (!blob.size) throw new Error('Empty PDF');
      setPrepared({ blob, data: snapshot, revision: ticket, avatarUrl: photo });
      setActionNotice({ tone: 'success', text: 'تم تجهيز PDF بنجاح. اختر «مشاركة PDF» أو «تنزيل PDF». التجهيز والمشاركة لا ينشران السيرة على المنصة.' });
    } catch {
      if (isActive()) setActionNotice({ tone: 'error', text: 'تعذر تجهيز PDF. تحقق من اتصالك لتحميل الخط والصورة ثم أعد المحاولة، أو جرّب إخفاء الصورة.' });
    } finally { endOperation('prepare'); }
  };

  const deliverPdf = async (mode: 'share' | 'download') => {
    if (!prepared || prepared.revision !== revision.current || prepared.avatarUrl !== (data.settings.showPhoto ? avatarUrl : undefined) || !canExport || !startOperation(mode)) return;
    try {
      // Invoke directly in the click handler: no PDF generation or async validation before native sharing.
      if (mode === 'share') await shareCvPdf(prepared.blob, prepared.data);
      else await downloadCvPdf(prepared.blob, prepared.data);
      if (isActive()) setActionNotice({ tone: 'success', text: mode === 'share' ? 'تم تنفيذ إجراء مشاركة PDF؛ إذا لم يدعم المتصفح المشاركة يُنزّل الملف بدلاً منها. لم تتغير خصوصية السيرة على المنصة.' : 'تم تنفيذ إجراء حفظ PDF؛ قد يستخدم الجهاز نافذة المشاركة لاختيار مكان الحفظ.' });
    } catch (error) {
      if (!isActive()) return;
      const cancelled = error instanceof Error && error.name === 'AbortError';
      setActionNotice({ tone: cancelled ? 'info' : 'error', text: cancelled ? 'أُلغيت المشاركة. ملف PDF ما زال جاهزاً.' : mode === 'share' ? 'تعذرت المشاركة على هذا الجهاز. يمكنك استخدام «تنزيل PDF» وإرساله يدوياً.' : 'تعذر تنزيل PDF؛ أعد المحاولة أو استخدم زر المشاركة.' });
    } finally { endOperation(mode); }
  };

  const fieldsProps = { data, onChange: changeData, errors };
  const disabled = Boolean(busy) || closeWarning;
  const pdfReady = Boolean(prepared && prepared.revision === revision.current && prepared.avatarUrl === (data.settings.showPhoto ? avatarUrl : undefined) && canExport);
  const content = <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} dir="rtl" lang="ar" className="fixed inset-0 z-[1400] flex min-w-0 flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}>
    <header className="shrink-0 border-b border-slate-200 bg-white px-3 py-3 sm:px-6 dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <button type="button" className={button} onClick={goBack} aria-label={step > 0 ? 'الرجوع إلى الخطوة السابقة' : 'الرجوع وإغلاق المعالج'}><ArrowRight size={20} aria-hidden="true" /></button>
        <div className="min-w-0 flex-1"><h1 id={`${id}-title`} className="text-lg font-bold">إنشاء السيرة الذاتية</h1><p className="text-xs leading-5 text-slate-500 dark:text-slate-400">خاص افتراضياً · مسودة محلية · PDF عربي أو إنجليزي</p></div>
        <button type="button" className={button} onClick={requestClose} aria-label="إغلاق معالج السيرة الذاتية"><X size={20} aria-hidden="true" /></button>
      </div>
    </header>
    <nav aria-label="خطوات إنشاء السيرة الذاتية" className="shrink-0 overflow-x-auto border-b border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
      <ol className="mx-auto flex w-max min-w-full gap-2 py-2 sm:w-auto sm:max-w-5xl sm:flex-wrap">
        {steps.map((label, index) => <li key={label}><button type="button" onClick={() => setStep(index)} disabled={loadState !== 'ready' || disabled} aria-current={step === index ? 'step' : undefined} className={step === index ? activeStepButton : button}><span aria-hidden="true">{index + 1}.</span>{label}</button></li>)}
      </ol>
    </nav>
    <div ref={scrollArea} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={loadState === 'loading'}>
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-6">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold outline-none">{steps[step]} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">({step + 1}/{steps.length})</span></h2>
        <NoticeBlock notice={loadNotice} />
        {loadState === 'loading' && <div role="status" className="space-y-4 py-4"><p className="text-sm text-slate-600 dark:text-slate-300">جارٍ تحميل سيرتك ومسودة الجهاز…</p><div className="h-12 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" /><div className="h-32 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" /></div>}
        {loadState === 'error' && <div className="flex flex-wrap gap-3"><button type="button" className={primaryButton} onClick={() => setLoadAttempt(value => value + 1)}>إعادة المحاولة</button><button type="button" className={button} onClick={() => {
          applyLoaded(fallback.current);
          setLoadNotice({ tone: 'warning', text: 'تتابع دون التحقق من نسخة الحساب. الحفظ قد يستبدلها؛ تأكد من محتوى المسودة قبل الحفظ.' });
        }}>{fallback.current ? 'المتابعة بمسودة الجهاز' : 'المتابعة ببيانات الملف الشخصي'}</button></div>}
        {loadState === 'ready' && <>
          <NoticeBlock notice={draftNotice} />
          <NoticeBlock notice={actionNotice} />
          {closeWarning && <section role="alertdialog" aria-labelledby={`${id}-close-warning`} className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <h3 ref={closeHeading} id={`${id}-close-warning`} tabIndex={-1} className="font-bold outline-none">آخر التغييرات ليست محفوظة على الجهاز</h3>
            <p className="text-sm leading-6">صحّح أخطاء الحقول أو مشكلة التخزين قبل الإغلاق. الإغلاق الآن قد يفقد آخر التغييرات.</p>
            <div className="flex flex-wrap gap-2"><button type="button" className={primaryButton} onClick={() => setCloseWarning(false)}>البقاء وتصحيح المشكلة</button><button type="button" className={button} onClick={finishClose}>إغلاق دون حفظ آخر التغييرات</button></div>
          </section>}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300"><span>اكتمال مقترح: {cvCompleteness(normalized)}٪ — ليس شرطاً للحفظ</span><span>كل الحقول اختيارية عدا الاسم للحفظ والتصدير.</span></div>
          <fieldset disabled={disabled} className="min-w-0 space-y-5">
            <legend className="sr-only">{steps[step]}</legend>
            {step === 0 && <CvPersonalFields {...fieldsProps} />}
            {step === 1 && <CvSummaryField {...fieldsProps} />}
            {step === 2 && <CvExperienceFields {...fieldsProps} />}
            {step === 3 && <CvEducationFields {...fieldsProps} />}
            {step === 4 && <CvSkillsLanguageFields {...fieldsProps} />}
            {step === 5 && <CvCertificationLinkFields {...fieldsProps} />}
            {step === 6 && <>
              <CvPreviewSettings settings={data.settings} onChange={settings => changeData({ ...data, settings })} />
              {Object.keys(errors).length > 0 && <NoticeBlock notice={{ tone: 'warning', text: 'المعاينة تستبعد بيانات التواصل أو الروابط غير الصالحة مؤقتاً. صحّح أخطاء الحقول قبل الحفظ أو تجهيز PDF.' }} />}
              {errors.document && <NoticeBlock notice={{ tone: 'error', text: errors.document }} />}
              {!canExport && <NoticeBlock notice={{ tone: 'info', text: 'للمشاركة، أدخل الاسم وأضف نبذة أو خبرة أو تعليماً أو مهارة أو شهادة.' }} />}
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">المعاينة مصغّرة لتناسب الشاشة؛ PDF يُجهّز بحجم A4 وترقيم صفحاته النهائي قد يختلف عن هذه المعاينة.</p>
              <CvPreview data={normalized} avatarUrl={avatarUrl} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className={primaryButton} onClick={() => void preparePdf()} disabled={disabled || !canExport}>{busy === 'prepare' ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <FileText size={18} aria-hidden="true" />}{busy === 'prepare' ? 'جارٍ تجهيز PDF…' : 'تجهيز PDF'}</button>
                <button type="button" className={button} onClick={() => void deliverPdf('share')} disabled={disabled || !pdfReady}><Share2 size={18} aria-hidden="true" />مشاركة PDF</button>
                <button type="button" className={button} onClick={() => void deliverPdf('download')} disabled={disabled || !pdfReady}><Download size={18} aria-hidden="true" />تنزيل PDF</button>
              </div>
              {pdfReady && <p role="status" className="flex items-center gap-2 text-sm text-green-800 dark:text-green-300"><Check size={18} aria-hidden="true" />ملف PDF جاهز. أي تعديل يُلغي التجهيز السابق.</p>}
            </>}
            <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700" aria-label="خصوصية السيرة وحفظ الملف الشخصي">
              <label className="flex min-h-11 items-start gap-3 text-sm font-semibold"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-blue-600" checked={isPublic} onChange={event => changeVisibility(event.target.checked)} /><span>نشر السيرة: جميع بيانات السيرة ستكون مرئية لأي مستخدم مسجّل الدخول عند تفعيل الخيار وحفظها.</span></label>
              <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">عند إيقاف الخيار وحفظها، تبقى السيرة خاصة بك. تغيير الخيار وحده أو حفظ المسودة لا يغيّر ظهور نسخة الحساب. إخفاء الهاتف والبريد في PDF لا يخفيهما من السيرة العامة.</p>
              <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">«حفظ السيرة» يزامن الاسم والمسمى والموقع والهاتف والموقع الإلكتروني والمهارات والخبرة والتعليم مع ملفك الشخصي، وفق خصوصية ذلك الملف. لا يغيّر نبذته أو بريد تسجيل الدخول أو صورة الحساب أو ملفات PDF المرفوعة سابقاً.</p>
            </section>
          </fieldset>
        </>}
      </div>
    </div>
    <footer className="shrink-0 border-t border-slate-200 bg-white px-3 pt-3 sm:px-6 dark:border-slate-700 dark:bg-slate-900" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={goBack} disabled={disabled}>السابق</button>{step < steps.length - 1 && <button type="button" className={button} onClick={() => setStep(current => current + 1)} disabled={loadState !== 'ready' || disabled}>التالي</button>}</div>
        <button type="button" className={primaryButton} onClick={() => void save()} disabled={loadState !== 'ready' || disabled}>{busy === 'save' ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}{busy === 'save' ? 'جارٍ الحفظ والمزامنة…' : 'حفظ السيرة'}</button>
      </div>
      {busy && <p role="status" className="mx-auto mt-2 max-w-5xl text-xs text-slate-600 dark:text-slate-300">{busy === 'prepare' ? 'جارٍ تجهيز PDF…' : busy === 'save' ? 'جارٍ حفظ السيرة ومزامنة الملف الشخصي…' : busy === 'share' ? 'جارٍ مشاركة PDF…' : 'جارٍ تنزيل PDF…'}</p>}
    </footer>
  </div>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}

export default CvBuilderView;
