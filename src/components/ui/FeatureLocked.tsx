import React from 'react';
import { Lock } from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import { whatsappUrl } from '../../lib/utils/contact';

export function FeatureLocked({ title, message, icon }: { title: string; message: string; icon?: React.ReactNode }) {
  const context = useAppContext() as any;
  const platformSettings = context?.platformSettings || {};
  const telegram = (platformSettings.supportTelegram || '').replace(/^@+/, '').replace(/^https?:\/\/t\.me\//, '');

  return (
    <div
      className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 my-8 max-w-md mx-auto shadow-xl"
      dir="rtl"
    >
      <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
        {icon || <Lock size={30} />}
      </div>
      <h3 className="text-base font-black text-slate-800 dark:text-white">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-2 leading-relaxed">{message}</p>
      <div className="mt-5 grid gap-2.5">
        {platformSettings.supportWhatsapp && (
          <a
            href={whatsappUrl(platformSettings.supportWhatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span>الدعم عبر واتساب</span>
          </a>
        )}
        {telegram && (
          <a
            href={`https://t.me/${telegram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-black text-xs rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span>الدعم عبر تلكرام</span>
          </a>
        )}
      </div>
    </div>
  );
}