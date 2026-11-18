import React, { useId } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { CV_LABELS, CV_LANGUAGE_LEVELS, CV_LIMITS, newCvId } from '../../../lib/cv/cvData';
import type { CvData, CvLanguageLevel, CvSettings } from '../../../lib/cv/cvData';

export type CvFieldErrors = Record<string, string>;
type FieldsProps = { data: CvData; onChange: (data: CvData) => void; errors: CvFieldErrors };
const controlBase = 'w-full min-w-0 rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:bg-slate-900 dark:text-slate-100';
const control = `${controlBase} border-slate-300 dark:border-slate-600`;
const smallButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800';

function TextField({ field, label, value, onChange, max, error, multiline = false, placeholder, dir = 'auto', type = 'text', hint }: {
  field: string; label: string; value: string; onChange: (value: string) => void; max: number;
  error?: string; multiline?: boolean; placeholder?: string; dir?: 'auto' | 'ltr'; type?: 'text' | 'email' | 'tel'; hint?: string;
}) {
  const id = useId();
  const props = {
    id, value, maxLength: max, placeholder, dir, 'data-cv-field': field,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    'aria-invalid': Boolean(error), 'aria-describedby': `${id}-help${error ? ` ${id}-error` : ''}`,
    className: error ? `${controlBase} border-red-500 dark:border-red-400` : control,
  };
  return <div className="min-w-0 space-y-1.5">
    <label htmlFor={id} className="block text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</label>
    {multiline ? <textarea {...props} rows={5} /> : <input {...props} type={type} autoComplete="off" />}
    <p id={`${id}-help`} className="text-xs leading-5 text-slate-500 dark:text-slate-400">{hint ? `${hint} · ` : ''}{value.length}/{max}</p>
    {error && <p id={`${id}-error`} className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  </div>;
}

function AddButton({ onClick, count, limit, children }: { onClick: () => void; count: number; limit: number; children: React.ReactNode }) {
  return <button type="button" className={smallButton} disabled={count >= limit} onClick={onClick}>
    <Plus size={18} aria-hidden="true" />{children}<span className="text-xs">({count}/{limit})</span>
  </button>;
}

function Entry({ title, onRemove, children, onUp, onDown, first, last }: {
  title: string; onRemove: () => void; children: React.ReactNode; onUp?: () => void; onDown?: () => void; first?: boolean; last?: boolean;
}) {
  return <section aria-label={title} className="space-y-4 rounded-lg border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-700 dark:bg-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <div className="flex gap-1">
        {onUp && <button type="button" className={smallButton} onClick={onUp} disabled={first} aria-label={`نقل ${title} للأعلى`}><ArrowUp size={18} aria-hidden="true" /></button>}
        {onDown && <button type="button" className={smallButton} onClick={onDown} disabled={last} aria-label={`نقل ${title} للأسفل`}><ArrowDown size={18} aria-hidden="true" /></button>}
        <button type="button" className={smallButton} onClick={onRemove} aria-label={`حذف ${title}`}><Trash2 size={18} aria-hidden="true" /><span>حذف</span></button>
      </div>
    </div>
    {children}
  </section>;
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm leading-6 text-slate-600 dark:border-slate-600 dark:text-slate-300">{children} يمكنك ترك هذا القسم فارغاً.</p>;
}

export function CvPersonalFields({ data, onChange, errors }: FieldsProps) {
  const change = (key: keyof CvData['personal'], value: string) => onChange({ ...data, personal: { ...data.personal, [key]: value } });
  return <div className="grid min-w-0 gap-4 sm:grid-cols-2">
    <TextField field="personal.fullName" label="الاسم الكامل (مطلوب للحفظ والتصدير)" value={data.personal.fullName} onChange={v => change('fullName', v)} max={CV_LIMITS.name} error={errors['personal.fullName']} />
    <TextField field="personal.title" label="المسمى المهني" value={data.personal.title} onChange={v => change('title', v)} max={CV_LIMITS.title} placeholder="مثال: مهندس مدني" />
    <TextField field="personal.location" label="المدينة / الموقع" value={data.personal.location} onChange={v => change('location', v)} max={CV_LIMITS.location} placeholder="مثال: بغداد، العراق" />
    <TextField field="personal.phone" label="رقم التواصل" value={data.personal.phone} onChange={v => change('phone', v)} max={CV_LIMITS.phone} type="tel" dir="ltr" error={errors['personal.phone']} hint="رقم عراقي أو دولي مع رمز الدولة" />
    <TextField field="personal.email" label="بريد التواصل في السيرة فقط" value={data.personal.email} onChange={v => change('email', v)} max={CV_LIMITS.email} type="email" dir="ltr" error={errors['personal.email']} hint="لا يغيّر بريد تسجيل الدخول" />
    <TextField field="personal.website" label="الموقع الإلكتروني (اختياري)" value={data.personal.website} onChange={v => change('website', v)} max={CV_LIMITS.url} dir="ltr" placeholder="https://example.com" error={errors['personal.website']} />
  </div>;
}

export function CvSummaryField({ data, onChange, errors }: FieldsProps) {
  return <TextField field="summary" label="النبذة المهنية" value={data.summary} onChange={summary => onChange({ ...data, summary })} max={CV_LIMITS.summary} multiline error={errors.summary} placeholder="اكتب تخصصك، أبرز خبراتك وإنجازاتك، والقيمة التي تقدمها لجهة العمل." hint={`حتى ${CV_LIMITS.descriptionLines} سطراً؛ لا تغيّر نبذة ملفك الشخصي`} />;
}

export function CvExperienceFields({ data, onChange, errors }: FieldsProps) {
  const patch = (id: string, values: Partial<CvData['experiences'][number]>) => onChange({ ...data, experiences: data.experiences.map(e => e.id === id ? { ...e, ...values, id: e.id } : e) });
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= data.experiences.length) return;
    const experiences = [...data.experiences];
    [experiences[index], experiences[target]] = [experiences[target], experiences[index]];
    onChange({ ...data, experiences });
  };
  return <div className="space-y-4">
    {!data.experiences.length && <EmptyNote>أضف خبراتك بدءاً بالأحدث، أو استخدم أزرار النقل لترتيبها.</EmptyNote>}
    {data.experiences.map((e, index) => <Entry key={e.id} title={`الخبرة ${index + 1}`} onRemove={() => onChange({ ...data, experiences: data.experiences.filter(item => item.id !== e.id) })} onUp={() => move(index, -1)} onDown={() => move(index, 1)} first={index === 0} last={index === data.experiences.length - 1}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField field={`experiences.${e.id}.role`} label="المسمى الوظيفي" value={e.role} onChange={role => patch(e.id, { role })} max={CV_LIMITS.role} error={errors[`experiences.${e.id}.role`]} />
        <TextField field={`experiences.${e.id}.company`} label="الشركة / جهة العمل" value={e.company} onChange={company => patch(e.id, { company })} max={CV_LIMITS.company} />
        <TextField field={`experiences.${e.id}.location`} label="مكان العمل" value={e.location} onChange={location => patch(e.id, { location })} max={CV_LIMITS.location} />
        <div className="flex items-center"><label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-800 dark:text-slate-200"><input type="checkbox" className="h-5 w-5 accent-blue-600" checked={e.current} onChange={event => patch(e.id, { current: event.target.checked, end: event.target.checked ? '' : e.end })} />أعمل هنا حالياً</label></div>
        <TextField field={`experiences.${e.id}.start`} label="تاريخ البداية" value={e.start} onChange={start => patch(e.id, { start })} max={CV_LIMITS.date} placeholder="مثال: 2022 أو 2022/03" />
        {!e.current && <TextField field={`experiences.${e.id}.end`} label="تاريخ النهاية" value={e.end} onChange={end => patch(e.id, { end })} max={CV_LIMITS.date} placeholder="مثال: 2025" />}
      </div>
      <TextField field={`experiences.${e.id}.description`} label="المهام والإنجازات" value={e.description} onChange={description => patch(e.id, { description })} max={CV_LIMITS.experienceDescription} multiline error={errors[`experiences.${e.id}.description`]} hint={`حتى ${CV_LIMITS.descriptionLines} سطراً؛ إنجازات واضحة ونتائج قابلة للقياس`} />
    </Entry>)}
    <AddButton count={data.experiences.length} limit={CV_LIMITS.experiences} onClick={() => onChange({ ...data, experiences: [...data.experiences, { id: newCvId(), role: '', company: '', location: '', start: '', end: '', current: false, description: '' }] })}>إضافة خبرة</AddButton>
  </div>;
}

export function CvEducationFields({ data, onChange, errors }: FieldsProps) {
  const patch = (id: string, values: Partial<CvData['education'][number]>) => onChange({ ...data, education: data.education.map(e => e.id === id ? { ...e, ...values, id: e.id } : e) });
  return <div className="space-y-4">
    {!data.education.length && <EmptyNote>أضف المؤهلات الدراسية والتدريب الأكاديمي.</EmptyNote>}
    {data.education.map((e, index) => <Entry key={e.id} title={`المؤهل ${index + 1}`} onRemove={() => onChange({ ...data, education: data.education.filter(item => item.id !== e.id) })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField field={`education.${e.id}.degree`} label="الشهادة / الدرجة العلمية" value={e.degree} onChange={degree => patch(e.id, { degree })} max={CV_LIMITS.degree} error={errors[`education.${e.id}.degree`]} />
        <TextField field={`education.${e.id}.school`} label="الجامعة / المعهد" value={e.school} onChange={school => patch(e.id, { school })} max={CV_LIMITS.school} />
        <TextField field={`education.${e.id}.field`} label="التخصص" value={e.field} onChange={field => patch(e.id, { field })} max={CV_LIMITS.field} />
        <TextField field={`education.${e.id}.start`} label="تاريخ البداية" value={e.start} onChange={start => patch(e.id, { start })} max={CV_LIMITS.date} placeholder="مثال: 2018" />
        <TextField field={`education.${e.id}.end`} label="تاريخ التخرج / النهاية" value={e.end} onChange={end => patch(e.id, { end })} max={CV_LIMITS.date} placeholder="مثال: 2022 أو متوقع 2027" />
      </div>
      <TextField field={`education.${e.id}.description`} label="تفاصيل إضافية" value={e.description} onChange={description => patch(e.id, { description })} max={CV_LIMITS.educationDescription} multiline error={errors[`education.${e.id}.description`]} hint={`حتى ${CV_LIMITS.descriptionLines} سطراً`} />
    </Entry>)}
    <AddButton count={data.education.length} limit={CV_LIMITS.education} onClick={() => onChange({ ...data, education: [...data.education, { id: newCvId(), degree: '', school: '', field: '', start: '', end: '', description: '' }] })}>إضافة مؤهل</AddButton>
  </div>;
}

export function CvSkillsLanguageFields({ data, onChange, errors }: FieldsProps) {
  const id = useId();
  return <div className="space-y-6">
    <section aria-labelledby={`${id}-skills`} className="space-y-4">
      <h3 id={`${id}-skills`} className="font-semibold">المهارات</h3>
      {!data.skills.length && <EmptyNote>أضف مهارات مهنية محددة مثل Excel أو إدارة المشاريع.</EmptyNote>}
      <div className="grid gap-3 sm:grid-cols-2">
        {data.skills.map((skill, index) => <div key={index} className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1"><TextField field={`skills.${index}`} label={`المهارة ${index + 1}`} value={skill} onChange={value => onChange({ ...data, skills: data.skills.map((s, i) => i === index ? value : s) })} max={CV_LIMITS.skill} /></div>
          <button type="button" className={`${smallButton} mt-7`} onClick={() => onChange({ ...data, skills: data.skills.filter((_, i) => i !== index) })} aria-label={`حذف المهارة ${index + 1}`}><Trash2 size={18} aria-hidden="true" /></button>
        </div>)}
      </div>
      <AddButton count={data.skills.length} limit={CV_LIMITS.skills} onClick={() => onChange({ ...data, skills: [...data.skills, ''] })}>إضافة مهارة</AddButton>
    </section>
    <section aria-labelledby={`${id}-languages`} className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-700">
      <h3 id={`${id}-languages`} className="font-semibold">اللغات</h3>
      {!data.languages.length && <EmptyNote>أضف اللغات ومستوى إتقانك لها.</EmptyNote>}
      {data.languages.map((l, index) => <Entry key={l.id} title={`اللغة ${index + 1}`} onRemove={() => onChange({ ...data, languages: data.languages.filter(item => item.id !== l.id) })}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField field={`languages.${l.id}.name`} label="اسم اللغة" value={l.name} max={CV_LIMITS.languageName} error={errors[`languages.${l.id}.name`]} onChange={name => onChange({ ...data, languages: data.languages.map(item => item.id === l.id ? { ...item, name } : item) })} />
          <label className="block space-y-1.5 text-sm font-semibold">مستوى الإتقان<select className={control} value={l.level} onChange={event => onChange({ ...data, languages: data.languages.map(item => item.id === l.id ? { ...item, level: event.target.value as CvLanguageLevel } : item) })}>
            <option value="">بدون تحديد</option>{CV_LANGUAGE_LEVELS.map(level => <option key={level} value={level}>{CV_LABELS.ar.levels[level]}</option>)}
          </select></label>
        </div>
      </Entry>)}
      <AddButton count={data.languages.length} limit={CV_LIMITS.languages} onClick={() => onChange({ ...data, languages: [...data.languages, { id: newCvId(), name: '', level: '' }] })}>إضافة لغة</AddButton>
    </section>
  </div>;
}

export function CvCertificationLinkFields({ data, onChange, errors }: FieldsProps) {
  const id = useId();
  return <div className="space-y-6">
    <section aria-labelledby={`${id}-certifications`} className="space-y-4">
      <h3 id={`${id}-certifications`} className="font-semibold">الشهادات والدورات</h3>
      {!data.certifications.length && <EmptyNote>أضف شهاداتك المهنية والدورات المرتبطة بتخصصك.</EmptyNote>}
      {data.certifications.map((c, index) => {
        const patch = (values: Partial<typeof c>) => onChange({ ...data, certifications: data.certifications.map(item => item.id === c.id ? { ...item, ...values, id: item.id } : item) });
        return <Entry key={c.id} title={`الشهادة ${index + 1}`} onRemove={() => onChange({ ...data, certifications: data.certifications.filter(item => item.id !== c.id) })}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField field={`certifications.${c.id}.name`} label="اسم الشهادة / الدورة" value={c.name} onChange={name => patch({ name })} max={CV_LIMITS.certificationName} error={errors[`certifications.${c.id}.name`]} />
            <TextField field={`certifications.${c.id}.issuer`} label="الجهة المانحة" value={c.issuer} onChange={issuer => patch({ issuer })} max={CV_LIMITS.issuer} />
            <TextField field={`certifications.${c.id}.year`} label="السنة / التاريخ" value={c.year} onChange={year => patch({ year })} max={CV_LIMITS.date} placeholder="مثال: 2025" />
          </div>
        </Entry>;
      })}
      <AddButton count={data.certifications.length} limit={CV_LIMITS.certifications} onClick={() => onChange({ ...data, certifications: [...data.certifications, { id: newCvId(), name: '', issuer: '', year: '' }] })}>إضافة شهادة</AddButton>
    </section>
    <section aria-labelledby={`${id}-links`} className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-700">
      <h3 id={`${id}-links`} className="font-semibold">الروابط المهنية</h3>
      {!data.links.length && <EmptyNote>أضف معرض أعمالك أو حسابك المهني؛ تقبل روابط http وhttps فقط.</EmptyNote>}
      {data.links.map((l, index) => <Entry key={l.id} title={`الرابط ${index + 1}`} onRemove={() => onChange({ ...data, links: data.links.filter(item => item.id !== l.id) })}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField field={`links.${l.id}.label`} label="عنوان الرابط" value={l.label} onChange={label => onChange({ ...data, links: data.links.map(item => item.id === l.id ? { ...item, label } : item) })} max={CV_LIMITS.linkLabel} placeholder="مثال: معرض أعمالي" />
          <TextField field={`links.${l.id}.url`} label="الرابط" value={l.url} onChange={url => onChange({ ...data, links: data.links.map(item => item.id === l.id ? { ...item, url } : item) })} max={CV_LIMITS.url} dir="ltr" placeholder="https://example.com" error={errors[`links.${l.id}.url`]} />
        </div>
      </Entry>)}
      <AddButton count={data.links.length} limit={CV_LIMITS.links} onClick={() => onChange({ ...data, links: [...data.links, { id: newCvId(), label: '', url: '' }] })}>إضافة رابط</AddButton>
    </section>
  </div>;
}

export function CvPreviewSettings({ settings, onChange }: { settings: CvSettings; onChange: (settings: CvSettings) => void }) {
  return <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <label className="block space-y-2 text-sm font-semibold">لغة عناوين السيرة وملف PDF<select className={control} value={settings.language} onChange={event => onChange({ ...settings, language: event.target.value === 'en' ? 'en' : 'ar' })}>
      <option value="ar">العربية — RTL</option><option value="en">English — LTR</option>
    </select></label>
    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">لا تُترجم النصوص تلقائياً؛ اكتب محتواك باللغة المطلوبة.</p>
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-blue-600" checked={settings.showPhoto} onChange={event => onChange({ ...settings, showPhoto: event.target.checked })} />إظهار صورة الملف الشخصي</label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-blue-600" checked={settings.showPhone} onChange={event => onChange({ ...settings, showPhone: event.target.checked })} />إظهار الهاتف في PDF</label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-blue-600" checked={settings.showEmail} onChange={event => onChange({ ...settings, showEmail: event.target.checked })} />إظهار البريد في PDF</label>
    </div>
    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">خيارات الإخفاء تخص المعاينة وPDF فقط، ولا تخفي البيانات من سيرة عامة على المنصة.</p>
  </div>;
}
