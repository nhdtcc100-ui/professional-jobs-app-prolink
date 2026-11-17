import React, { useEffect, useState } from 'react';
import { Phone, MessageCircle, Copy, Check, Link2, X, FileText } from 'lucide-react';
import { ContactMenuDetail, normalizeIraqiPhone, telUrl, whatsappUrl } from '../../lib/utils/contact';
import { resolveCvUrl, openCv } from '../../lib/utils/cv';

export function ContactMenu({ detail, onClose }: { detail: ContactMenuDetail; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [sharingCv, setSharingCv] = useState(false);
  const phone = (detail.phone || '').trim();
  const normalized = normalizeIraqiPhone(phone);
  const website = (detail.website || '').trim();
  const cvUrl = (detail.cvUrl || '').trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const openWebsite = () => {
    const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    window.open(url, '_blank', 'noopener');
  };

  const shareCv = async () => {
    if (!cvUrl || sharingCv) return;
    setSharingCv(true);
    try {
      if (cvUrl.startsWith('data:') || cvUrl.startsWith('blob:')) {
        await openCv(cvUrl);
      } else {
        const link = await resolveCvUrl(cvUrl);
        const text = `${detail.name ? `السيرة الذاتية لـ ${detail.name}` : 'السيرة الذاتية'}\n${link}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      }
    } finally {
      setSharingCv(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-7 sm:pb-5 animate-[slideUp_.2s_ease-out]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">
            {detail.name ? `التواصل مع ${detail.name}` : 'خيارات التواصل'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>
        {phone && <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-mono" dir="ltr">{phone}</p>}

        <div className="grid gap-2.5">
          {normalized && (
            <>
              <a
                href={whatsappUrl(phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors"
              >
                <MessageCircle size={20} />
                مراسلة عبر واتساب
              </a>
              <a
                href={telUrl(phone)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl bg-[#0a66c2] hover:bg-[#004182] text-white font-bold transition-colors"
              >
                <Phone size={20} />
                اتصال هاتفي مباشر
              </a>
              <button
                onClick={copyNumber}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-colors"
              >
                {copied ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
                {copied ? 'تم نسخ الرقم' : 'نسخ الرقم'}
              </button>
            </>
          )}
          {website && (
            <button
              onClick={openWebsite}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-colors"
            >
              <Link2 size={20} />
              الرابط المنشور (موقع / لينكدإن)
            </button>
          )}
          {cvUrl && (
            <button
              onClick={shareCv}
              disabled={sharingCv}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white font-bold transition-colors"
            >
              <FileText size={20} />
              {sharingCv ? 'جاري تجهيز السيرة...' : 'إرسال السيرة الذاتية (CV) عبر واتساب'}
            </button>
          )}
          {!normalized && !website && !cvUrl && (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-3">لا تتوفر بيانات تواصل لهذا المستخدم</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ContactMenuHost() {
  const [detail, setDetail] = useState<ContactMenuDetail | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<ContactMenuDetail>).detail;
      if (d && (d.phone || d.website || d.cvUrl)) setDetail(d);
    };
    window.addEventListener('prolink:contact-menu', onOpen);
    return () => window.removeEventListener('prolink:contact-menu', onOpen);
  }, []);

  if (!detail) return null;
  return <ContactMenu detail={detail} onClose={() => setDetail(null)} />;
}