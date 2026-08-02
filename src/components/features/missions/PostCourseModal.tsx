import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Clock, DollarSign, X, Send, Loader2, 
  ChevronDown, AlignLeft, CheckCircle, XCircle, Image as ImageIcon
} from 'lucide-react';

interface PostCourseModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  appUser: any;
  initialData?: any;
  isEditing?: boolean;
}

const inputClass = 'w-full bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 focus:border-blue-300 dark:focus:border-blue-700 focus:bg-white dark:focus:bg-slate-800 transition-all outline-none placeholder:text-slate-300 dark:placeholder:text-slate-500 text-slate-800 dark:text-white';
const labelClass = 'text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5';

const LEVELS = ['مبتدئ', 'متوسط', 'متقدم'];

export function PostCourseModal({ show, onClose, onSubmit, appUser, initialData, isEditing }: PostCourseModalProps) {
  const [isPosting, setIsPosting] = useState(false);
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    requirements: initialData?.requirements || '',
    outcomes: initialData?.outcomes || '',
    image_url: initialData?.image_url || '',
    duration: initialData?.duration || '',
    price: initialData?.price || 'مجاني',
    level: initialData?.level || 'مبتدئ',
    is_active: initialData?.is_active ?? true,
  });

  // Sync form data when initialData changes or modal opens
  React.useEffect(() => {
    if (show) {
      setFormData({
        title: initialData?.title || '',
        description: initialData?.description || '',
        requirements: initialData?.requirements || '',
        outcomes: initialData?.outcomes || '',
        image_url: initialData?.image_url || '',
        duration: initialData?.duration || '',
        price: initialData?.price || 'مجاني',
        level: initialData?.level || 'مبتدئ',
        is_active: initialData?.is_active ?? true,
      });
    }
  }, [initialData, show]);

  const isValid = formData.title.trim().length > 2 && formData.description.trim().length > 10;

  const completionScore = [
    formData.title.trim().length > 2,
    formData.description.trim().length > 10,
    formData.requirements.trim().length > 5,
    formData.outcomes.trim().length > 5,
    formData.duration.trim().length > 0,
    formData.image_url.trim().length > 0,
  ].filter(Boolean).length;

  const handleSubmit = async () => {
    if (!isValid || isPosting) return;
    setIsPosting(true);
    try {
      await onSubmit({ 
        ...formData, 
        provider_id: appUser?.id,
        image_url: formData.image_url || appUser?.coverUrl || null,
      });
      setFormData({ 
        title: '', 
        description: '', 
        requirements: '', 
        outcomes: '', 
        image_url: '', 
        duration: '', 
        price: 'مجاني', 
        level: 'مبتدئ', 
        is_active: true 
      });
      onClose();
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed top-[75px] bottom-[85px] left-2 right-2 z-[200] flex items-center justify-center" onClick={onClose} dir="rtl">
          {/* Background Dimmer */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm rounded-[2.5rem]" 
          />
          
          <motion.div
            initial={{ scale: 0.9, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-2xl w-full h-full flex flex-col overflow-hidden relative z-10 border border-white/20 dark:border-slate-800"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-bl from-indigo-600 via-blue-600 to-blue-800 p-7 text-white overflow-hidden shrink-0">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
              <div className="absolute bottom-0 right-0 w-60 h-32 bg-white/5 rounded-full blur-3xl" />
              <button onClick={onClose} className="absolute top-5 left-5 p-2.5 bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/10 z-20">
                <X size={18} />
              </button>
              <div className="flex items-center gap-5 relative z-10">
                <div className="w-14 h-14 bg-white/15 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-xl">
                  <BookOpen size={26} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-blue-200 uppercase tracking-[0.25em] mb-1">مدرب محترف — Elevate عراق</p>
                  <h2 className="text-xl font-black">{isEditing ? 'تعديل الدورة' : 'نشر دورة تدريبية'}</h2>
                  <p className="text-blue-200/70 text-xs font-medium mt-0.5">{isEditing ? 'قم بتحديث بيانات الدورة التدريبية' : 'شارك خبرتك مع المجتمع المهني'}</p>
                </div>
              </div>
              {/* Completion bar */}
              <div className="mt-5 relative z-10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-blue-200 uppercase tracking-widest">اكتمال النموذج</span>
                  <span className="text-[9px] font-black text-white">{Math.round((completionScore / 6) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-white rounded-full"
                    animate={{ width: `${(completionScore / 6) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-7 space-y-5 bg-white dark:bg-slate-900">
              <div>
                <label className={labelClass}><BookOpen size={11} /> عنوان الدورة *</label>
                <input
                  className={inputClass}
                  placeholder="مثال: احتراف تصميم UI/UX من الصفر"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  maxLength={100}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}><Clock size={11} /> المدة الزمنية</label>
                  <input
                    className={inputClass}
                    placeholder="مثال: 20 ساعة"
                    value={formData.duration}
                    onChange={e => setFormData({ ...formData, duration: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}><DollarSign size={11} /> السعر</label>
                  <input
                    className={inputClass}
                    placeholder="مجاني / 99 ر.س"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}><ChevronDown size={11} /> المستوى</label>
                <div className="flex gap-2">
                  {LEVELS.map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setFormData({ ...formData, level: lvl })}
                      className={`flex-1 py-3 rounded-2xl text-xs font-black border transition-all ${
                        formData.level === lvl 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}><AlignLeft size={11} /> وصف الدورة *</label>
                <textarea
                  className={`${inputClass} min-h-[100px] resize-none leading-loose`}
                  placeholder="صف محتوى الدورة بشكل عام..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  maxLength={3000}
                />
              </div>

              <div>
                <label className={labelClass}><CheckCircle size={11} /> ماذا سيتعلم الطالب؟ (أهم المخرجات)</label>
                <textarea
                  className={`${inputClass} min-h-[100px] resize-none leading-loose`}
                  placeholder="مثال: إتقان أدوات Figma، فهم سيكولوجية الألوان..."
                  value={formData.outcomes}
                  onChange={e => setFormData({ ...formData, outcomes: e.target.value })}
                  maxLength={2000}
                />
              </div>

              <div>
                <label className={labelClass}><XCircle size={11} /> المتطلبات المسبقة</label>
                <textarea
                  className={`${inputClass} min-h-[100px] resize-none leading-loose`}
                  placeholder="مثال: معرفة أساسية بأساسيات التصميم، جهاز كمبيوتر بمواصفات متوسطة..."
                  value={formData.requirements}
                  onChange={e => setFormData({ ...formData, requirements: e.target.value })}
                  maxLength={2000}
                />
              </div>

              <div>
                <label className={labelClass}><ImageIcon size={11} /> رابط صورة الغلاف (اختياري)</label>
                <input
                  className={inputClass}
                  placeholder="https://..."
                  value={formData.image_url}
                  onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                />
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800 rounded-[1.5rem] border border-slate-100 dark:border-slate-700">
                <div>
                  <p className="text-sm font-black text-slate-700 dark:text-white">حالة التسجيل</p>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                    {formData.is_active ? 'مفتوح — يمكن للطلاب التسجيل الآن' : 'مغلق — لن يتمكن أحد من التسجيل'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`relative w-14 h-7 rounded-full transition-all duration-300 shadow-inner ${formData.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <span className={`absolute top-1 w-5 h-5 bg-white dark:bg-slate-200 rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${formData.is_active ? 'right-1 translate-x-7' : 'right-1'}`}>
                    {formData.is_active ? <CheckCircle size={10} className="text-emerald-500" /> : <XCircle size={10} className="text-slate-400" />}
                  </span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-3 shrink-0">
              <button onClick={onClose} className="flex-1 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPosting || !isValid}
                className={`flex-[2] py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg ${
                  isPosting || !isValid
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-none active:scale-[0.98]'
                }`}
              >
                {isPosting ? (
                  <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</>
                ) : (
                  <><Send size={15} /> {isEditing ? 'حفظ التعديلات' : 'نشر الدورة الآن'}</>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
