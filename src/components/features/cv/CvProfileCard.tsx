import React, { lazy, Suspense, useEffect, useState } from 'react';
import { FileText, Pencil, Eye, Upload, Download, Loader2 } from 'lucide-react';
import { AppUser } from '../../../types';
import { useAppContext } from '../../../contexts/AppContext';
import { CvData, cvHasContent } from '../../../lib/cv/cvData';
import { cvProfileService, CvProfileRecord } from '../../../lib/services/cvProfileService';
import { CvViewerModal } from './CvViewerModal';

const CvBuilderView = lazy(() => import('./CvBuilderView').then(module => ({ default: module.CvBuilderView })));

interface Props {
  user: AppUser;
  isMe: boolean;
  cvUrl: string;
  pendingName: string | null;
  uploading: boolean;
  downloading: boolean;
  progress: number;
  onPick: () => void;
  onPreviewFile: () => void;
  onDownloadFile: () => void;
  onUpload: () => void;
  onSaved: (data: CvData) => void;
}

export function CvProfileCard(props: Props) {
  const canUseCvUpload = true;
  const [record, setRecord] = useState<CvProfileRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setEditing(false); setViewing(false);
  }, [props.user.id, props.isMe]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setRecord(null);
    const request = props.isMe ? cvProfileService.loadOwn(props.user.id) : cvProfileService.loadPublic(props.user.id);
    request.then(value => { if (active) setRecord(value); }).catch(() => { if (active) setError('تعذر تحميل بيانات السيرة؛ حاول مرة أخرى'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [props.user.id, props.isMe, revision]);
  const ready = cvHasContent(record?.data);
  return <section className="p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4" aria-labelledby="cv-card-title">
    <div className="flex items-center gap-3"><FileText className="text-[#0a66c2]" size={24} /><div><h2 id="cv-card-title" className="font-black text-lg text-slate-800 dark:text-white">السيرة الذاتية</h2><p className="text-sm text-slate-500">{props.isMe ? 'أدخل تفاصيلك وأنشئ سيرة احترافية بالعربية أو الإنجليزية' : 'السيرة التي اختار صاحب الملف إظهارها'}</p></div></div>
    {loading && <p role="status" className="text-sm text-slate-500">جاري تحميل السيرة...</p>}
    {error && <div role="alert" className="text-sm text-red-600">{error} <button onClick={() => setRevision(n => n + 1)} className="underline">إعادة المحاولة</button></div>}
    {props.isMe && <button onClick={() => setEditing(true)} className="w-full bg-[#0a66c2] text-white font-bold px-4 py-3 rounded-xl flex gap-2 items-center justify-center"><Pencil size={18} />{ready ? 'تعديل السيرة الذاتية' : 'إعداد سيرتي الذاتية'}</button>}
    {ready && record && <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">{props.isMe ? record.storage === 'local' ? 'مسودة محفوظة على هذا الجهاز' : record.isPublic ? 'متاحة للعرض' : 'خاصة؛ تُرفق عند التقديم' : 'متاحة للعرض'}</p><button onClick={() => setViewing(true)} className="border border-blue-200 text-[#0a66c2] px-3 py-2 rounded-lg flex gap-2 items-center text-sm"><Eye size={16} />معاينة وتصدير PDF</button></div>}
    {!loading && !ready && !props.isMe && <p className="text-sm text-slate-500">لا توجد سيرة متاحة للعرض</p>}
    {props.cvUrl && <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3"><p className="text-sm font-bold text-slate-700 dark:text-slate-200">ملف السيرة المحفوظ سابقاً</p><div className="flex flex-wrap gap-2"><button onClick={props.onPreviewFile} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex gap-2 items-center"><Eye size={16} />معاينة الملف</button><button disabled={props.downloading} onClick={props.onDownloadFile} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex gap-2 items-center disabled:opacity-50"><Download size={16} />{props.downloading ? 'جاري التنزيل...' : 'تنزيل الملف'}</button></div></div>}
    {props.isMe && canUseCvUpload && <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2"><button onClick={props.onPick} disabled={props.uploading} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex gap-2 items-center"><Upload size={16} />{props.cvUrl ? 'استبدال الملف' : 'رفع ملف جاهز'}</button><p className="text-xs text-slate-500">PDF أو Word؛ الحد الأقصى 25 ميغابايت</p>{props.pendingName && <><p className="text-sm break-all">{props.pendingName}</p><button onClick={props.onUpload} disabled={props.uploading} className="bg-[#0a66c2] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50 flex gap-2 items-center">{props.uploading && <Loader2 size={16} className="animate-spin" />}حفظ الملف</button></>}{props.uploading && <p role="status" className="text-sm">جاري الرفع... {props.progress}%</p>}</div>}
    {props.isMe && !canUseCvUpload && <p className="text-xs text-slate-500">رفع الملفات الجاهزة مغلق حالياً؛ يمكنك إنشاء سيرتك ومشاركتها دون رفع ملف.</p>}
    {props.isMe && editing && <Suspense fallback={<div role="status" className="fixed inset-0 z-[1300] bg-white flex items-center justify-center">جاري فتح محرر السيرة...</div>}><CvBuilderView user={props.user} onClose={() => { setEditing(false); setRevision(n => n + 1); }} onSaved={data => { props.onSaved(data); setRevision(n => n + 1); }} /></Suspense>}
    {viewing && record && <CvViewerModal data={record.data} avatarUrl={props.user.avatar} onClose={() => setViewing(false)} />}
  </section>;
}
