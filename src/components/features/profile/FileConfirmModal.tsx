import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, X, FileText, Image, File, User, LayoutTemplate } from "lucide-react";

export type ConfirmFileType = "avatar" | "cover" | "cv";

interface FileConfirmModalProps {
  file: File | null;
  type: ConfirmFileType;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

const TYPE_CONFIG = {
  avatar: {
    title: "تغيير صورة الحساب",
    subtitle: "هل تريد استخدام هذه الصورة كصورتك الشخصية؟",
    confirmLabel: "تعيين كصورة الحساب",
    Icon: User,
    accent: "from-blue-600 to-indigo-600",
  },
  cover: {
    title: "تغيير صورة الغلاف",
    subtitle: "هل تريد استخدام هذه الصورة كصورة غلاف لملفك الشخصي؟",
    confirmLabel: "تعيين كصورة الغلاف",
    Icon: LayoutTemplate,
    accent: "from-purple-600 to-pink-600",
  },
  cv: {
    title: "إرفاق السيرة الذاتية",
    subtitle: "هل تريد رفع هذا المستند كسيرتك الذاتية؟",
    confirmLabel: "رفع السيرة الذاتية",
    Icon: FileText,
    accent: "from-emerald-600 to-teal-600",
  },
} as const;

export const FileConfirmModal: React.FC<FileConfirmModalProps> = ({ file, type, onConfirm, onCancel }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const isImage = type === "avatar" || type === "cover";
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.avatar;

  useEffect(() => {
    if (!file || !isImage) {
      setPreviewUrl(null);
      return;
    }
    setImgError(false);
    let url: string | null = null;
    try {
      url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } catch (e) {
      console.warn("[FileConfirmModal] Failed to createObjectURL:", e);
      setImgError(true);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, isImage]);

  if (typeof document === "undefined") return null;

  const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(1) : "0";
  const fileName = file?.name || (type === "cv" ? "document.pdf" : "image.jpg");
  const IconComp = config.Icon;

  return createPortal(
    <AnimatePresence>
      {file && (
        <motion.div
          key="file-confirm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-3 sm:p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: 80, scale: 0.94, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 80, scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`bg-gradient-to-r ${config.accent} p-4 flex items-center justify-between text-white`}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <IconComp size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm leading-tight">{config.title}</h3>
                  <span className="text-[10px] text-white/80 font-bold">معاينة قبل الاعتماد</span>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all active:scale-90"
              >
                <X size={16} />
              </button>
            </div>

            {/* Preview Box */}
            <div className="p-4 space-y-3">
              {isImage ? (
                <div className={`rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 ${type === "cover" ? "aspect-[2.8/1]" : "aspect-square max-h-60"} mx-auto flex items-center justify-center shadow-inner`}>
                  {previewUrl && !imgError ? (
                    <img
                      src={previewUrl}
                      alt="معاينة"
                      className="w-full h-full object-cover"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400 p-6">
                      <Image size={38} strokeWidth={1.5} />
                      <span className="text-xs font-bold">تم اختيار الصورة بنجاح</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 p-5 flex items-center gap-4 border border-slate-200 dark:border-slate-700">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <FileText size={28} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-slate-800 dark:text-white truncate">{fileName}</p>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">{fileSizeMB} ميغابايت</p>
                  </div>
                </div>
              )}

              {/* Meta details */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold px-1">
                <File size={12} />
                <span className="truncate max-w-[200px]">{fileName}</span>
                <span className="mr-auto flex-shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-[10px]">
                  {fileSizeMB} MB
                </span>
              </div>

              <p className="text-center text-[12px] text-slate-600 dark:text-slate-300 font-bold leading-relaxed px-2">
                {config.subtitle}
              </p>
            </div>

            {/* Actions */}
            <div className="px-4 pb-5 pt-1 flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
              >
                إلغاء
              </button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => onConfirm(file)}
                className={`flex-[2] py-3 rounded-2xl bg-gradient-to-r ${config.accent} text-white font-black text-sm shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95`}
              >
                <CheckCircle2 size={16} />
                <span>{config.confirmLabel}</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
