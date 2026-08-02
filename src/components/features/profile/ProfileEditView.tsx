import React from 'react';
import { motion } from 'motion/react';
import { 
  User as UserIcon, 
  Book, 
  FileText, 
  Globe, 
  Phone, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  CloudUpload, 
  Tag, 
  Plus, 
  Briefcase, 
  GraduationCap 
} from 'lucide-react';
import { GlassCard } from '../../ui';

interface ProfileEditViewProps {
  formData: any;
  handleFieldChange: (field: string, value: any) => void;
  addToast: (m: string, t?: any) => void;
  setActiveTab: (tab: any) => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  handleCVUpload?: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onScrollToTop?: () => void;
}

const inputClass =
  'w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-blue-50 focus:border-blue-200 transition-all outline-none shadow-sm placeholder:text-slate-300 text-slate-800';

const labelClass = 'text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block';

export const ProfileEditView: React.FC<ProfileEditViewProps> = ({
  formData,
  handleFieldChange,
  addToast,
  setActiveTab,
  saveStatus = 'idle',
  handleCVUpload,
  onScrollToTop
}) => {

  const saveBannerConfig = {
    idle:   { bg: 'bg-slate-50',    border: 'border-slate-100', icon: <CloudUpload size={14} className="text-slate-400" />,             text: 'التعديلات تُحفظ تلقائياً أثناء الكتابة',  textColor: 'text-slate-500' },
    saving: { bg: 'bg-amber-50',    border: 'border-amber-100', icon: <Loader2 size={14} className="text-amber-500 animate-spin" />,   text: 'جاري الحفظ في قاعدة البيانات...',          textColor: 'text-amber-600' },
    saved:  { bg: 'bg-emerald-50',  border: 'border-emerald-100', icon: <CheckCircle2 size={14} className="text-emerald-500" />,       text: 'تم الحفظ بنجاح في قاعدة البيانات ✓',      textColor: 'text-emerald-600' },
    error:  { bg: 'bg-red-50',      border: 'border-red-100',   icon: <AlertCircle size={14} className="text-red-500" />,              text: 'فشل الحفظ، تحقق من اتصالك بالإنترنت',     textColor: 'text-red-600' },
  }[saveStatus];

  return (
    <motion.div
      key="edit"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="space-y-8 w-full pb-20"
    >
      {/* Auto-save status banner */}
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border ${saveBannerConfig.bg} ${saveBannerConfig.border} transition-all`}>
        {saveBannerConfig.icon}
        <p className={`text-xs font-bold ${saveBannerConfig.textColor}`}>{saveBannerConfig.text}</p>
      </div>

      {/* ─── Section 1: Personal & Contact ────────────────── */}
      <GlassCard className="p-8 rounded-[2.5rem] space-y-6 border border-slate-100 shadow-xl bg-white/50">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-200">
            <UserIcon size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">المعلومات الشخصية والاتصال</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">المعلومات الأساسية للوصول إليك</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label htmlFor="edit-name" className={labelClass}>الاسم الكامل</label>
            <input
              id="edit-name"
              name="name"
              className={inputClass}
              value={formData.name}
              onChange={e => handleFieldChange('name', e.target.value)}
              placeholder="الاسم كما يظهر في الوثائق الرسمية"
            />
          </div>

          <div>
            <label htmlFor="edit-industry" className={labelClass}>المسمى الوظيفي الحالي</label>
            <input
              id="edit-industry"
              name="industry"
              className={inputClass}
              value={formData.industry}
              onChange={e => handleFieldChange('industry', e.target.value)}
              placeholder="مثال: مصمم واجهات، مهندس مدني"
            />
          </div>

          <div>
            <label htmlFor="edit-company" className={labelClass}>المنشأة الحالية (اختياري)</label>
            <input
              id="edit-company"
              name="companyName"
              className={inputClass}
              value={formData.companyName}
              onChange={e => handleFieldChange('companyName', e.target.value)}
              placeholder="اسم الشركة أو الجهة"
            />
          </div>

          <div>
            <label htmlFor="edit-location" className={labelClass}>الموقع الجغرافي</label>
            <div className="relative">
              <input
                id="edit-location"
                name="location"
                className={`${inputClass} pl-10`}
                value={formData.location}
                onChange={e => handleFieldChange('location', e.target.value)}
                placeholder="المدينة، الدولة"
              />
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            </div>
          </div>

          <div>
            <label htmlFor="edit-phone" className={labelClass}>رقم الهاتف</label>
            <div className="relative">
              <input
                id="edit-phone"
                name="phone"
                className={`${inputClass} pl-10`}
                value={formData.phone}
                onChange={e => handleFieldChange('phone', e.target.value)}
                placeholder="+966 XXXXXXXX"
              />
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="edit-website" className={labelClass}>الموقع الإلكتروني أو LinkedIn</label>
            <input
              id="edit-website"
              name="website"
              className={inputClass}
              value={formData.website}
              onChange={e => handleFieldChange('website', e.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>
      </GlassCard>

      {/* ─── Section 2: Professional Summary ────────────────── */}
      <GlassCard className="p-8 rounded-[2.5rem] space-y-5 border border-slate-100 shadow-xl bg-white/50">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-200">
            <Book size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">النبذة المهنية</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">ملخص سريع لإنجازاتك وقدراتك</p>
          </div>
        </div>

        <textarea
          id="edit-bio"
          name="bio"
          className={`${inputClass} h-36 resize-none leading-relaxed`}
          value={formData.bio}
          onChange={e => handleFieldChange('bio', e.target.value)}
          placeholder="اكتب نبذة مهنية مختصرة تركز على مهاراتك وأهدافك..."
        />
      </GlassCard>

      {/* ─── Section 3: Professional Experience ─────────────────────────── */}
      <GlassCard className="p-8 rounded-[2.5rem] space-y-6 border border-slate-100 shadow-xl bg-white/50">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200">
            <Briefcase size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">الخبرة العملية</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">سجلك المهني وتفاصيل المهام</p>
          </div>
        </div>

        <textarea
          id="edit-experience"
          name="experience"
          className={`${inputClass} h-48 resize-none leading-relaxed`}
          value={formData.experience}
          onChange={e => handleFieldChange('experience', e.target.value)}
          placeholder="اكتب خبراتك بالترتيب الزمني (الأحدث أولاً)&#10;مثال: 2022-الحالي: مبرمج أول في شركة X&#10;- تطوير واجهات المستخدم باستخدام React&#10;- تحسين أداء التطبيق بنسبة 30%"
        />
      </GlassCard>

      {/* ─── Section 4: Academic Background ─────────────────────────── */}
      <GlassCard className="p-8 rounded-[2.5rem] space-y-6 border border-slate-100 shadow-xl bg-white/50">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-200">
            <GraduationCap size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">التعليم والمؤهلات</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">الشهادات والدرجات العلمية</p>
          </div>
        </div>

        <textarea
          id="edit-education"
          name="education"
          className={`${inputClass} h-32 resize-none leading-relaxed`}
          value={formData.education}
          onChange={e => handleFieldChange('education', e.target.value)}
          placeholder="مثال: 2018: بكالوريوس في هندسة البرمجيات — جامعة الملك سعود"
        />
      </GlassCard>

      {/* ─── Section 5: Key Skills ────────────────────────────── */}
      <GlassCard className="p-8 rounded-[2.5rem] space-y-5 border border-slate-100 shadow-xl bg-white/50">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-teal-200">
            <Tag size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">المهارات والكلمات المفتاحية</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">المهارات التقنية والناعمة</p>
          </div>
        </div>

        <div className="space-y-3">
          <input
            id="edit-skills"
            name="skills"
            className={inputClass}
            value={(formData.skills || []).join(', ')}
            onChange={e =>
              handleFieldChange(
                'skills',
                e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)
              )
            }
            placeholder="أضف مهاراتك مفصولة بفاصلة (مثال: React, القيادة, حل المشكلات)"
          />

          <div className="flex flex-wrap gap-2 pt-1">
            {(formData.skills || []).map((s: string) => (
              <span
                key={s}
                className="group flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl text-[11px] font-black border border-emerald-100 hover:bg-emerald-100 transition-all cursor-default"
              >
                {s}
                <button
                  type="button"
                  onClick={() => {
                    handleFieldChange('skills', formData.skills.filter((sk: string) => sk !== s));
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-emerald-200 rounded-md"
                >
                  <Plus size={10} className="rotate-45" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* ─── Section 6: Document Management (CV Upload) ───────────────────────── */}
      <GlassCard className="p-8 rounded-[2.5rem] space-y-5 border border-slate-100 shadow-xl bg-white/50 relative overflow-hidden">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-200">
            <FileText size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">ملف السيرة الذاتية (CV)</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">رفع ملف PDF جاهز للمطابقة</p>
          </div>
        </div>

        <div className="relative group cursor-pointer">
          <input 
            type="file" 
            onChange={handleCVUpload}
            accept=".pdf,.doc,.docx"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 group-hover:border-blue-400 group-hover:bg-blue-50/30 transition-all">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
              <CloudUpload className="text-blue-500" size={24} />
            </div>
            <p className="text-xs font-black text-slate-700">اضغط لرفع ملف السيرة الذاتية</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">PDF, DOCX (Max 5MB)</p>
          </div>
        </div>

        {formData.cv_url && (
          <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-800">تم رفع الملف بنجاح</p>
                <p className="text-[9px] text-emerald-600 font-bold truncate">
                  {formData.cv_url.split('/').pop()}
                </p>
              </div>
            </div>
            <a 
              href={formData.cv_url} 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 bg-white text-emerald-600 text-[10px] font-black rounded-xl shadow-sm hover:shadow-md transition-all shrink-0"
            >
              عرض الملف
            </a>
          </div>
        )}
      </GlassCard>

      {/* ─── Back to top button ─────────────────────────────────────────────────── */}
      <div className="pt-4 flex justify-center">
        <button
          onClick={onScrollToTop}
          className="flex items-center gap-2 px-8 py-3 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 hover:text-slate-600 transition-all border border-slate-100"
        >
          <Plus size={14} className="-rotate-90" />
          العودة للأعلى
        </button>
      </div>
    </motion.div>
  );
};
