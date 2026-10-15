/**
 * PermissionDeniedModal
 * ──────────────────────────────────────────────────────────────────
 * Shown when the user has permanently denied camera / photos access.
 * Guides them to re-enable it from device Settings.
 *
 * Works on:
 *  - Android: Settings → Apps → ProLink → Permissions
 *  - iOS:     Settings → Privacy → Photos / Camera → ProLink
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Settings, X } from 'lucide-react';

interface PermissionDeniedModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 'camera' | 'photos' | 'storage' */
  permissionType?: 'camera' | 'photos' | 'storage';
}

export const PermissionDeniedModal: React.FC<PermissionDeniedModalProps> = ({
  isOpen,
  onClose,
  permissionType = 'photos',
}) => {
  // Detect platform for tailored messaging
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);

  const labels: Record<'camera' | 'photos' | 'storage', { ar: string; icon: string }> = {
    camera:  { ar: 'الكاميرا',          icon: '📷' },
    photos:  { ar: 'مكتبة الصور',       icon: '🖼️' },
    storage: { ar: 'التخزين والملفات',  icon: '📁' },
  };

  const label = labels[permissionType];

  const settingsPath = isIOS
    ? `الإعدادات ← الخصوصية ← ${label.ar} ← ProLink`
    : isAndroid
    ? `الإعدادات ← التطبيقات ← ProLink ← الأذونات`
    : `إعدادات المتصفح ← الأذونات`;

  const openSettings = () => {
    // Capacitor native – open app settings directly
    if (typeof (window as any)?.Capacitor !== 'undefined') {
      import('@capacitor/core').then(({ Capacitor }) => {
        if (Capacitor.isNativePlatform()) {
          import('@capacitor/app').then(({ App }) => {
            // NativeSettings plugin isn't bundled by default; graceful fallback
            console.log('[PermissionDeniedModal] Attempted to open native settings');
          }).catch(() => {});
        }
      }).catch(() => {});
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999]"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0,      opacity: 1 }}
            exit={{   y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 inset-x-0 z-[1000] bg-white dark:bg-slate-900 rounded-t-3xl p-6 shadow-2xl border-t border-slate-100 dark:border-slate-800"
          >
            {/* Handle */}
            <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} className="text-slate-500" />
            </button>

            {/* Icon */}
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <ShieldAlert size={32} className="text-red-500" />
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {label.icon} صلاحية {label.ar} مطلوبة
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
                  لقد رفضت صلاحية الوصول إلى {label.ar} مسبقاً.
                  يرجى تفعيلها من إعدادات الجهاز.
                </p>
              </div>

              {/* Settings path */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-right">
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-2">المسار</p>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200 leading-relaxed" dir="rtl">
                  {settingsPath}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 w-full pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                >
                  إلغاء
                </button>
                <button
                  onClick={openSettings}
                  className="flex-1 py-3 rounded-xl bg-[#0a66c2] text-white font-black text-sm hover:bg-[#004182] transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                >
                  <Settings size={16} />
                  فتح الإعدادات
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PermissionDeniedModal;
