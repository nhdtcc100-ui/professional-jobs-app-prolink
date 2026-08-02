import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase, MapPin, DollarSign, FileText, Tag, Building2,
  X, Send, Loader2, ChevronDown, AlignLeft, Edit3, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { CloseButton } from '../../ui';


interface JobPostFormData {
  title: string;
  company: string;
  description: string;
  requirements: string;
  location: string;
  salary: string;
  jobType: string;
  working_hours: string;
  imageUrl: string;
  is_active: boolean;
}


interface JobPostFormProps {
  show: boolean;
  formData: JobPostFormData;
  setFormData: (data: JobPostFormData) => void;
  onSubmit: () => void;
  isPosting: boolean;
  onClose: () => void;
  isEditing?: boolean;
  appUser: any;
}

const inputClass =
  'w-full bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 focus:border-blue-300 dark:focus:border-blue-700 focus:bg-white dark:focus:bg-slate-800 transition-all outline-none placeholder:text-slate-300 dark:placeholder:text-slate-500 text-slate-800 dark:text-white';
const labelClass = 'text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5';

const JOB_TYPES = ['دوام كامل', 'دوام جزئي', 'عن بُعد', 'عقد مؤقت', 'تدريب', 'استشاري'];

export const JobPostForm: React.FC<JobPostFormProps> = ({
  show, formData, setFormData, onSubmit, isPosting, onClose, isEditing = false, appUser
}) => {
  const isValid = (formData.title || '').trim().length > 2 && 
                  (formData.company || '').trim().length > 1 && 
                  (formData.description || '').trim().length > 10;

  const completionScore = [
    (formData.title || '').trim().length > 2,
    (formData.company || '').trim().length > 1,
    (formData.description || '').trim().length > 10,
    (formData.requirements || '').trim().length > 5,
    (formData.location || '').trim().length > 1,
    (formData.salary || '').trim().length > 0,
    true, // Image is now automatic
  ].filter(Boolean).length;

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
            <div className="relative bg-gradient-to-bl from-[#0a66c2] via-[#0d5ca8] to-[#004182] p-7 text-white overflow-hidden shrink-0">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
              <div className="absolute bottom-0 right-0 w-60 h-32 bg-white/5 rounded-full blur-3xl" />
              <button 
                onClick={onClose}
                className="absolute top-5 left-5 z-[100] p-2.5 bg-white/10 hover:bg-red-500 text-white backdrop-blur-md rounded-xl transition-all active:scale-90 border border-white/20"
                title="إغلاق"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-5 relative z-10">
                <div className="w-14 h-14 bg-white/15 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-xl">
                  <Briefcase size={26} className="text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-blue-200 uppercase tracking-[0.25em] mb-1">صاحب عمل — Elevate عراق</p>
                  <h2 className="text-xl font-black tracking-tight">
                    {isEditing ? 'تعديل الفرصة الوظيفية' : 'نشر فرصة وظيفية'}
                  </h2>
                  <p className="text-blue-200/70 text-xs font-medium mt-0.5">
                    {isEditing ? 'تحديث بيانات الوظيفة المنشورة' : 'اجذب أفضل المواهب المهنية'}
                  </p>
                </div>
              </div>

              {/* Completion bar */}
              <div className="mt-5 relative z-10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-blue-200 uppercase tracking-widest">اكتمال النموذج</span>
                  <span className="text-[9px] font-black text-white">{Math.round((completionScore / 7) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-white rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(completionScore / 7) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            </div>

            {/* Form body */}
            <div className="flex-1 overflow-y-auto p-7 space-y-5 bg-white dark:bg-slate-900">

              {/* Title + Company */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}><Briefcase size={11} /> المسمى الوظيفي *</label>
                  <input
                    id="job-title"
                    name="title"
                    className={inputClass}
                    placeholder="مثال: مصمم واجهات مستخدم سينيور"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    maxLength={80}
                  />
                </div>
                <div>
                  <label className={labelClass}><Building2 size={11} /> اسم الشركة *</label>
                  <input
                    id="job-company"
                    name="company"
                    className={inputClass}
                    placeholder="اسم الشركة أو المؤسسة"
                    value={formData.company}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    maxLength={60}
                  />
                </div>
              </div>

              {/* Location + Job Type + Salary */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="job-location" className={labelClass}><MapPin size={11} /> الموقع</label>
                  <input
                    id="job-location"
                    name="location"
                    className={inputClass}
                    placeholder="الرياض / عن بُعد"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="job-hours" className={labelClass}><Clock size={11} /> ساعات العمل</label>
                  <input
                    id="job-hours"
                    name="working_hours"
                    className={inputClass}
                    placeholder="مثال: 8 ص - 4 م"
                    value={formData.working_hours || ''}
                    onChange={e => setFormData({ ...formData, working_hours: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="job-type" className={labelClass}><Tag size={11} /> نوع الدوام</label>
                  <div className="relative">
                    <select
                      id="job-type"
                      name="jobType"
                      className={`${inputClass} appearance-none cursor-pointer`}
                      value={formData.jobType}
                      onChange={e => setFormData({ ...formData, jobType: e.target.value })}
                    >
                      {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label htmlFor="job-salary" className={labelClass}><DollarSign size={11} /> الراتب / النطاق</label>
                  <input
                    id="job-salary"
                    name="salary"
                    className={inputClass}
                    placeholder="مثال: 8,000–12,000 ر.س"
                    value={formData.salary}
                    onChange={e => setFormData({ ...formData, salary: e.target.value })}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="job-description" className={labelClass}><AlignLeft size={11} /> وصف الوظيفة *</label>
                <textarea
                  id="job-description"
                  name="description"
                  className={`${inputClass} min-h-[130px] resize-none leading-loose`}
                  placeholder="صف الوظيفة، المهام اليومية، بيئة العمل..."
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  maxLength={5000}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">الحد الأقصى 5000 حرف</p>
                  <p className={`text-[10px] font-bold ${(formData.description || '').length > 4800 ? 'text-red-500' : 'text-slate-400'}`}>
                    {(formData.description || '').length.toLocaleString()} / 5,000
                  </p>
                </div>
              </div>

              {/* Requirements */}
              <div>
                <label htmlFor="job-requirements" className={labelClass}><FileText size={11} /> المتطلبات والمؤهلات</label>
                <textarea
                  id="job-requirements"
                  name="requirements"
                  className={`${inputClass} min-h-[100px] resize-none leading-loose`}
                  placeholder="مثال:&#10;• خبرة لا تقل عن 3 سنوات في React&#10;• إجادة اللغة الإنجليزية&#10;• القدرة على العمل ضمن فريق"
                  value={formData.requirements || ''}
                  onChange={e => setFormData({ ...formData, requirements: e.target.value })}
                  maxLength={3000}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">الحد الأقصى 3000 حرف</p>
                  <p className={`text-[10px] font-bold ${(formData.requirements || '').length > 2800 ? 'text-red-500' : 'text-slate-400'}`}>
                    {(formData.requirements || '').length.toLocaleString()} / 3,000
                  </p>
                </div>
              </div>

              {/* Job Availability Toggle */}
              <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800 rounded-[1.5rem] border border-slate-100 dark:border-slate-700">
                <div className="space-y-0.5">
                  <p className="text-sm font-black text-slate-700 dark:text-white">حالة التقديم</p>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    {formData.is_active ? 'مفتوح — يمكن للمتقدمين إرسال طلباتهم الآن' : 'مغلق — لن يتمكن أحد من التقديم'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none shadow-inner ${
                    formData.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span className={`absolute top-1 w-5 h-5 bg-white dark:bg-slate-200 rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${
                    formData.is_active ? 'right-1 translate-x-7' : 'right-1'
                  }`}>
                    {formData.is_active 
                      ? <CheckCircle size={10} className="text-emerald-500" /> 
                      : <XCircle size={10} className="text-slate-400" />}
                  </span>
                </button>
              </div>

              {/* Professional Preview */}
              <div className="relative rounded-[2rem] overflow-hidden border border-blue-100 shadow-sm bg-slate-50 group/preview">
                <div className="h-24 bg-blue-100 relative">
                  <img src={appUser?.coverUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80'} className="w-full h-full object-cover opacity-80" alt="Cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent" />
                </div>
                <div className="px-6 pb-4 relative">
                  <div className="relative -mt-8 mb-3 flex items-end justify-between">
                    <div className="w-14 h-14 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-white">
                      <img src={appUser?.avatar || 'https://ui-avatars.com/api/?name=Company'} className="w-full h-full object-cover" alt="Avatar" />
                    </div>
                    <div className="bg-blue-600 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">معاينة مباشرة</div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[#0a66c2] uppercase tracking-[0.2em] mb-0.5">هوية الإعلان التلقائية</p>
                    <p className="text-[9px] text-slate-500 font-bold leading-relaxed">
                      سيتم استخدام صورتك الشخصية وصورة الغلاف من ملفك الشخصي لتمييز هذا الإعلان بشكل احترافي.
                    </p>
                  </div>
                </div>
              </div>

              {/* Validation hint */}
              {!isValid && (
                <p className="text-[11px] text-amber-600 font-bold bg-amber-50 px-4 py-3 rounded-2xl border border-amber-100 flex items-center gap-2">
                  <span className="text-amber-500">⚠️</span>
                  يرجى تعبئة المسمى الوظيفي، الشركة، والوصف على الأقل.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-3 shrink-0">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                إلغاء
              </button>
              <button
                onClick={onSubmit}
                disabled={isPosting || !isValid}
                className={`flex-[2] py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg ${
                  isPosting || !isValid
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-[#0a66c2] hover:bg-[#004182] text-white shadow-blue-200 dark:shadow-none hover:shadow-blue-300 active:scale-[0.98]'
                }`}
              >
                {isPosting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> 
                    <span>جاري {isEditing ? 'التحديث' : 'النشر'}...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {isEditing ? <Edit3 size={15} /> : <Send size={15} />} 
                    <span>{isEditing ? 'حفظ التعديلات' : 'نشر الوظيفة الآن'}</span>
                  </span>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
