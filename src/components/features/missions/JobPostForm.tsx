import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Briefcase, MapPin, DollarSign, FileText, Tag, Building2,
  Send, Loader2, ChevronDown, AlignLeft, Edit3, CheckCircle, XCircle, Clock, AlertCircle, ArrowRight, Sparkles, X
} from 'lucide-react';
import { validateField } from '../../../lib/security/inputValidator';
import { JOB_CATEGORIES } from '../../../lib/utils/jobCategoryUtils';

export interface JobPostFormData {
  title: string;
  company: string;
  description: string;
  requirements: string;
  location: string;
  salary: string;
  jobType: string;
  category?: string;
  working_hours: string;
  imageUrl: string;
  is_active: boolean;
}

export interface JobPostFormProps {
  show?: boolean;
  formData: any;
  setFormData: any;
  onSubmit: () => void;
  isPosting: boolean;
  onClose: () => void;
  isEditing?: boolean;
  appUser: any;
  asPage?: boolean;
}

const inputClass =
  'w-full bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-700/90 rounded-2xl px-4 py-3.5 text-xs md:text-sm font-medium focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all outline-none placeholder:text-slate-300 dark:placeholder:text-slate-500 text-slate-800 dark:text-white shadow-sm';
const labelClass = 'text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5';

const JOB_TYPES = ['دوام كامل', 'دوام جزئي', 'عن بُعد', 'عقد مؤقت', 'تدريب', 'استشاري'];

export const JobPostForm: React.FC<JobPostFormProps> = ({
  formData, setFormData, onSubmit, isPosting, onClose, isEditing = false, appUser
}) => {
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({});

  const handleFieldChange = (fieldKey: keyof JobPostFormData, label: string, val: string) => {
    setFormData({ ...formData, [fieldKey]: val });
    if (!val.trim()) {
      setFormErrors(prev => ({ ...prev, [fieldKey]: null }));
      return;
    }
    const check = validateField(val, label, appUser ? { id: appUser.id, name: appUser.name, email: appUser.email } : undefined, '/jobs/post');
    setFormErrors(prev => ({ ...prev, [fieldKey]: check.valid ? null : (check.error ?? null) }));
  };

  const hasAnyError = Object.values(formErrors).some(Boolean);

  const isValid = (formData.title || '').trim().length > 2 && 
                  (formData.company || '').trim().length > 1 && 
                  (formData.description || '').trim().length > 10 &&
                  Boolean((formData.category || '').trim()) &&
                  !hasAnyError;

  const completionScore = [
    (formData.title || '').trim().length > 2,
    (formData.company || '').trim().length > 1,
    Boolean((formData.category || '').trim()),
    (formData.description || '').trim().length > 10,
    (formData.requirements || '').trim().length > 5,
    (formData.location || '').trim().length > 1,
    (formData.salary || '').trim().length > 0,
    true, // Profile identity automatic
  ].filter(Boolean).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 px-1 md:px-0" dir="rtl">
      
      {/* ── Top Back & Breadcrumb Bar (Matching Profile Page) ── */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-700 shadow-sm cursor-pointer active:scale-95"
        >
          <ArrowRight size={15} />
          العودة
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-400 dark:text-slate-500">
            {isEditing ? 'تعديل الإعلان الوظيفي' : 'نشر فرصة وظيفية جديدة'}
          </span>
        </div>
      </div>

      {/* ── Premium Hero Header Banner (Matching Profile Header Style) ── */}
      <div className="rounded-[2.5rem] overflow-hidden bg-gradient-to-bl from-[#0a66c2] via-[#0d5ca8] to-[#003d7a] text-white p-6 md:p-8 relative shadow-lg border border-white/10">
        <div className="absolute -top-10 -left-10 w-44 h-44 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-60 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 md:gap-5 relative z-10">
          <div className="w-14 h-14 md:w-16 md:h-16 bg-white/15 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-xl shrink-0">
            <Briefcase size={28} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                بوابة أصحاب الأعمال
              </span>
              <Sparkles size={13} className="text-amber-300" />
            </div>
            <h1 className="text-lg md:text-2xl font-black tracking-tight truncate">
              {formData.title ? formData.title : (isEditing ? 'تعديل بيانات الوظيفة' : 'نشر إعلان وظيفي واستقطاب الكفاءات')}
            </h1>
            <p className="text-blue-100/80 text-xs md:text-sm font-bold truncate mt-0.5">
              {formData.company ? formData.company : 'املأ تفاصيل الوظيفة والشروط المطلوبة لنشرها لآلاف الكوادر المهنية'}
            </p>
          </div>
        </div>

        {/* Completion Progress Widget */}
        <div className="mt-6 pt-5 border-t border-white/15 relative z-10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest">نسبة اكتمال تفاصيل الإعلان</span>
            <span className="text-xs font-black text-white">{Math.round((completionScore / 8) * 100)}%</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-400 rounded-full shadow-sm"
              initial={{ width: 0 }}
              animate={{ width: `${(completionScore / 8) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>

      {/* ── Main Form Content Card (Matching Profile Page Card Container) ── */}
      <div className="p-5 md:p-8 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-6">

        {/* Section 1: Basic Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <Briefcase size={16} className="text-blue-600" />
            المعلومات الأساسية
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>المسمى الوظيفي *</label>
              <input
                id="job-title"
                name="title"
                className={`${inputClass} ${formErrors.title ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                placeholder="مثال: مصمم واجهات مستخدم / مهندس برمجيات"
                value={formData.title}
                onChange={e => handleFieldChange('title', 'المسمى الوظيفي', e.target.value)}
                maxLength={80}
                autoComplete="off"
              />
              {formErrors.title && (
                <div className="mt-1 flex items-center gap-1 text-red-600 text-[10px] font-bold">
                  <AlertCircle size={10} />
                  <span>{formErrors.title}</span>
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>اسم الشركة / المنشأة *</label>
              <input
                id="job-company"
                name="company"
                className={`${inputClass} ${formErrors.company ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                placeholder="مثال: شركة الحلول الرقمية"
                value={formData.company}
                onChange={e => handleFieldChange('company', 'اسم الشركة', e.target.value)}
                maxLength={60}
                autoComplete="off"
              />
              {formErrors.company && (
                <div className="mt-1 flex items-center gap-1 text-red-600 text-[10px] font-bold">
                  <AlertCircle size={11} className="shrink-0" />
                  <span>{formErrors.company}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section: Job Category / قسم وتصنيف الوظيفة (إجباري) */}
        <div className="space-y-3 p-4 md:p-5 bg-blue-50/40 dark:bg-blue-950/20 rounded-2xl md:rounded-3xl border border-blue-100/80 dark:border-blue-900/40">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Tag size={16} className="text-blue-600" />
              قسم وتصنيف الوظيفة <span className="text-red-500 font-bold">* (إجباري)</span>
            </h3>
            {formData.category ? (
              <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 shadow-sm">
                <CheckCircle size={12} />
                تم تحديد: {formData.category}
              </span>
            ) : (
              <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-1 animate-pulse">
                <AlertCircle size={12} />
                يرجى اختيار القسم للمتابعة
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
            اختر القسم الذي تنتمي إليه الوظيفة لتظهر في تصنيفات وفلاتر الصفحة الرئيسية بدقة:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
            {JOB_CATEGORIES.map(cat => {
              const isSelected = formData.category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat.id })}
                  className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border text-center active:scale-95 ${
                    isSelected
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-600 shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40'
                      : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 shadow-sm'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-white/20 text-white shadow-inner'
                        : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    <cat.Icon size={19} />
                  </div>
                  <span className="text-xs font-black">{cat.label}</span>
                  <span
                    className={`text-[9px] font-medium leading-tight ${
                      isSelected ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {cat.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Logistics & Compensation */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <Building2 size={16} className="text-blue-600" />
            بيئة العمل والتعويضات
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="job-location" className={labelClass}><MapPin size={12} className="text-blue-600" /> الموقع الجغرافي</label>
              <input
                id="job-location"
                name="location"
                className={`${inputClass} ${formErrors.location ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                placeholder="بغداد / الرياض / عن بُعد"
                value={formData.location}
                onChange={e => handleFieldChange('location', 'الموقع', e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="job-type" className={labelClass}><Tag size={12} className="text-blue-600" /> نوع الدوام</label>
              <div className="relative">
                <select
                  id="job-type"
                  name="jobType"
                  className={`${inputClass} appearance-none cursor-pointer pr-4 pl-8`}
                  value={formData.jobType}
                  onChange={e => setFormData({ ...formData, jobType: e.target.value })}
                >
                  {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label htmlFor="job-hours" className={labelClass}><Clock size={12} className="text-blue-600" /> ساعات العمل</label>
              <input
                id="job-hours"
                name="working_hours"
                className={`${inputClass} ${formErrors.working_hours ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                placeholder="مثال: 9 ص - 5 م"
                value={formData.working_hours || ''}
                onChange={e => handleFieldChange('working_hours', 'ساعات العمل', e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="job-salary" className={labelClass}><DollarSign size={12} className="text-blue-600" /> الراتب التقديري</label>
              <input
                id="job-salary"
                name="salary"
                className={`${inputClass} ${formErrors.salary ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                placeholder="مثال: 1,500$ أو يُحدد بالمقابلة"
                value={formData.salary}
                onChange={e => handleFieldChange('salary', 'الراتب', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Description */}
        <div className="space-y-2">
          <label htmlFor="job-description" className={labelClass}><AlignLeft size={12} className="text-blue-600" /> الوصف والمهام الوظيفية *</label>
          <textarea
            id="job-description"
            name="description"
            className={`${inputClass} min-h-[120px] resize-none leading-relaxed ${formErrors.description ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
            placeholder="اكتب نبذة شاملة عن الوظيفة، المسؤوليات اليومية، وما تقدمه الشركة..."
            value={formData.description || ''}
            onChange={e => handleFieldChange('description', 'وصف الوظيفة', e.target.value)}
            maxLength={5000}
          />
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span>{formErrors.description ? <span className="text-red-500">{formErrors.description}</span> : 'اكتب وصفاً واضحاً ومفصلاً'}</span>
            <span>{(formData.description || '').length} / 5000</span>
          </div>
        </div>

        {/* Section 4: Requirements */}
        <div className="space-y-2">
          <label htmlFor="job-requirements" className={labelClass}><FileText size={12} className="text-blue-600" /> المتطلبات والمؤهلات المطلوبة</label>
          <textarea
            id="job-requirements"
            name="requirements"
            className={`${inputClass} min-h-[100px] resize-none leading-relaxed ${formErrors.requirements ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
            placeholder="مثال:&#10;• خبرة لا تقل عن سنتين في المجال&#10;• إتقان أدوات العمل الحديثة&#10;• مهارات تواصل ممتازة"
            value={formData.requirements || ''}
            onChange={e => handleFieldChange('requirements', 'المتطلبات', e.target.value)}
            maxLength={3000}
          />
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span>{formErrors.requirements ? <span className="text-red-500">{formErrors.requirements}</span> : 'حدد الشروط والمهارات المطلوبة بدقة'}</span>
            <span>{(formData.requirements || '').length} / 3000</span>
          </div>
        </div>

        {/* Section 5: Availability Status Toggle */}
        <div className="flex items-center justify-between p-4 md:p-5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl md:rounded-3xl border border-slate-100 dark:border-slate-700">
          <div className="space-y-0.5">
            <p className="text-xs md:text-sm font-black text-slate-800 dark:text-white">حالة فتح التقديم على الوظيفة</p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
              {formData.is_active ? 'التقديم مفتوح لاستقبال السير الذاتية فوراً' : 'التقديم متوقف ومغلق مؤقتاً'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
            className={`relative w-13 h-7 rounded-full transition-all duration-300 focus:outline-none shadow-inner cursor-pointer ${
              formData.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white dark:bg-slate-100 rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${
              formData.is_active ? 'right-1 translate-x-6' : 'right-1'
            }`}>
              {formData.is_active 
                ? <CheckCircle size={11} className="text-emerald-600" /> 
                : <XCircle size={11} className="text-slate-400" />}
            </span>
          </button>
        </div>

        {/* Section 6: Publisher Identity Preview */}
        <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-blue-100 dark:border-slate-700 shadow-sm bg-slate-50 dark:bg-slate-900">
          <div className="h-20 bg-gradient-to-r from-blue-600 to-indigo-700 relative">
            <img 
              src={appUser?.coverUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80'} 
              className="w-full h-full object-cover opacity-60" 
              alt="Cover" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
          </div>
          <div className="px-5 pb-4 relative">
            <div className="relative -mt-6 mb-2.5 flex items-end justify-between">
              <div className="w-13 h-13 rounded-2xl border-2 border-white dark:border-slate-800 shadow-md overflow-hidden bg-white">
                <img src={appUser?.avatar || 'https://ui-avatars.com/api/?name=Company'} className="w-full h-full object-cover" alt="Avatar" />
              </div>
              <div className="bg-blue-600 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-md">
                معاينة هوية الناشر
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">
                {appUser?.name || 'صاحب العمل'}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                سيتم نشر الإعلان مقترناً بملفك التعريفي الموثق واسم مؤسستك.
              </p>
            </div>
          </div>
        </div>

        {/* Validation Warning */}
        {!isValid && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-bold">
            <AlertCircle size={15} className="shrink-0 text-amber-500" />
            <span>
              {!formData.category 
                ? 'يرجى تحديد قسم الوظيفة (مهنية، تقنية، إدارية...) - حقل إجباري لنشر الوظيفة.'
                : 'يرجى تعبئة المسمى الوظيفي، اسم المنشأة، والوصف لإتاحة النشر.'}
            </span>
          </div>
        )}
      </div>

      {/* ── Bottom Actions Bar Card ── */}
      <div className="p-4 md:p-6 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3.5 md:py-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs md:text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-[0.98] cursor-pointer"
        >
          إلغاء والعودة
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isPosting || !isValid}
          className={`flex-[2] py-3.5 md:py-4 rounded-2xl font-black text-xs md:text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-[0.98] cursor-pointer ${
            isPosting || !isValid
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-[#0a66c2] via-[#0052a3] to-[#003d7a] hover:brightness-110 text-white shadow-blue-500/25 hover:shadow-blue-500/40'
          }`}
        >
          {isPosting ? (
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span>جاري {isEditing ? 'تحديث البيانات' : 'إطلاق ونشر الوظيفة'}...</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {isEditing ? <Edit3 size={16} /> : <Send size={16} />}
              <span>{isEditing ? 'حفظ التعديلات' : 'نشر الوظيفة الآن 🚀'}</span>
            </span>
          )}
        </button>
      </div>

    </div>
  );
};
