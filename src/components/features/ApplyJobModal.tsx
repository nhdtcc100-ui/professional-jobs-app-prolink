import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase, MapPin, Info, Sparkles, FileText, Trash2, Paperclip,
  CheckCircle2, Send, Loader2, X, GraduationCap, Clock, Globe
} from 'lucide-react';
import { Job, AppUser } from '../../types';
import { jobService } from '../../lib/services/jobService';

interface ApplyJobModalProps {
  applyingJob: Job | null;
  appUser: AppUser;
  applySuccess: boolean;
  setApplySuccess: (s: boolean) => void;
  setApplyingJob: (j: Job | null) => void;
  cvCoverLetter: string;
  setCvCoverLetter: (t: string) => void;
  cvFileObj: File | null;
  setCvFileObj: (f: File | null) => void;
  cvExperience: string;
  setCvExperience: (t: string) => void;
  cvEducation: string;
  setCvEducation: (t: string) => void;
  isApplying: boolean;
  setIsApplying: (b: boolean) => void;
  isUploadingCv: boolean;
  setIsUploadingCv: (b: boolean) => void;
  addToast: (msg: string, type?: 'success' | 'error') => void;
}

interface PrevWork {
  company: string;
  role: string;
  tasks: string;
  skills: string;
  hours: string;
  salary: string;
}

export const ApplyJobModal: React.FC<ApplyJobModalProps> = ({
  applyingJob, appUser, applySuccess, setApplySuccess,
  setApplyingJob, cvCoverLetter, setCvCoverLetter,
  cvFileObj, setCvFileObj, cvExperience, setCvExperience,
  cvEducation, setCvEducation, isApplying, setIsApplying,
  isUploadingCv, setIsUploadingCv, addToast
}) => {
  const [prevWorks, setPrevWorks] = useState<PrevWork[]>([]);

  if (!applyingJob || !appUser) return null;

  const profileCompletion =
    ((appUser as any).bio         ? 20 : 0) +
    (((appUser as any).skills?.length > 0) ? 20 : 0) +
    ((appUser as any).location    ? 20 : 0) +
    ((appUser as any).experience  ? 20 : 0) +
    (prevWorks.length > 0         ? 20 : 0);

  const handleClose = () => {
    if (!isApplying) setApplyingJob(null);
  };

  const addPrevWork = () => {
    setPrevWorks([...prevWorks, { company: '', role: '', tasks: '', skills: '', hours: '', salary: '' }]);
  };

  const removePrevWork = (index: number) => {
    setPrevWorks(prevWorks.filter((_, i) => i !== index));
  };

  const updatePrevWork = (index: number, field: keyof PrevWork, value: string) => {
    const updated = [...prevWorks];
    updated[index][field] = value;
    setPrevWorks(updated);
  };

  const handleSubmit = async () => {
    if (!appUser || !applyingJob) return;

    if (!applyingJob.employer_id) {
      addToast('لا يمكن التقديم: صاحب العمل غير محدد في هذه الوظيفة', 'error');
      return;
    }

    setIsApplying(true);
    let succeeded = false;

    // Safety timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (!succeeded) {
        setIsApplying(false);
        setIsUploadingCv(false);
        addToast('انتهت مهلة التقديم. يرجى التأكد من اتصال الإنترنت والمحاولة مجدداً.', 'error');
      }
    }, 15000);

    try {
      // Use profile CV if available, or upload new one
      let cvUrl = (appUser as any).cv_url || (appUser as any).cvUrl || '';
      console.log("💎 [UI_STEP_1] CV logic check...", { cvUrl });
      
      if (cvFileObj) {
        console.log("💎 [UI_STEP_2] Uploading new CV...");
        setIsUploadingCv(true);
        const { data, error: uploadError } = await jobService.uploadCV(appUser.id, cvFileObj);
        setIsUploadingCv(false);
        if (uploadError) throw new Error('فشل رفع السيرة الذاتية: ' + uploadError.message);
        cvUrl = data || '';
      }

      const formattedPrevWorks = prevWorks.map(pw => 
        `🏢 الشركة: ${pw.company}\n🎯 المسمى: ${pw.role}\n📋 المهام: ${pw.tasks}\n🛠️ المهارات: ${pw.skills}\n⏰ الساعات: ${pw.hours}\n💰 الراتب: ${pw.salary}`
      ).join('\n\n');

      const fullExperience = cvExperience + (formattedPrevWorks ? `\n\n--- خبرات سابقة ---\n${formattedPrevWorks}` : '');

      console.log("💎 [UI_STEP_3] Calling service.applyToJob...");
      const { error } = await jobService.applyToJob(appUser.id, applyingJob.employer_id!, {
        jobId: applyingJob.id,
        coverLetter: cvCoverLetter,
        cvUrl,
        experience: fullExperience,
        education: cvEducation,
        skills: appUser.skills || [],
        applicantData: {
          name: appUser.name,
          avatar: appUser.avatar,
          industry: (appUser as any).industry,
          location: (appUser as any).location,
          phone: (appUser as any).phone,
          bio: (appUser as any).bio,
          prevWorks
        }
      });
      
      if (error) throw error;

      clearTimeout(timeoutId);
      succeeded = true;
      setApplySuccess(true);
      
      try { if (window.refreshApplications) window.refreshApplications(); } catch (_) {}

      setTimeout(() => {
        setApplySuccess(false);
        setApplyingJob(null);
        setCvFileObj(null);
        setCvExperience('');
        setCvEducation('');
        setCvCoverLetter('');
        setPrevWorks([]);
        setIsApplying(false);
      }, 2800);

    } catch (e: any) {
      clearTimeout(timeoutId);
      console.error('Apply error:', e);
      addToast('فشل التقديم: ' + (e.message || 'خطأ غير معروف'), 'error');
      setIsApplying(false);
      setIsUploadingCv(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden relative max-h-[calc(100vh-180px)] flex flex-col my-auto border border-white/20"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* ── Success overlay ── */}
        <AnimatePresence>
          {applySuccess && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.65, delay: 0.1 }}
                className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6"
              >
                <CheckCircle2 size={48} className="text-emerald-500" />
              </motion.div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">تم الإرسال بنجاح! 🎉</h3>
              <p className="text-sm font-bold text-slate-500 leading-relaxed max-w-xs">
                تم إيصال ملفك الاحترافي لمدير التوظيف. تابع رسائلك للردّ. حظاً موفقاً!
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Header ── */}
        <div className="bg-gradient-to-bl from-[#0a66c2] via-[#0d5ca8] to-[#003d7a] pt-8 pb-12 px-7 text-white relative overflow-hidden">
          <div className="absolute -top-8 -left-8 w-36 h-36 bg-white/5 rounded-full blur-2xl" />
          <button onClick={handleClose} className="absolute top-5 left-5 p-2 bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/10 z-10">
            <X size={18} />
          </button>
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-white/15 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-xl shrink-0">
              <Briefcase size={26} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-blue-200 uppercase tracking-[0.2em] mb-1">إكمال التقديم الاحترافي</p>
              <h2 className="text-xl font-black tracking-tight leading-tight mb-1">{applyingJob.title}</h2>
              <p className="text-blue-100/90 text-xs font-bold flex items-center gap-2">
                <MapPin size={11} className="text-blue-200" /> {applyingJob.company} • {applyingJob.location || 'عن بُعد'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">

          {/* Profile card */}
          <div className="flex items-center gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <img
              src={appUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(appUser.name)}&background=random`}
              className="w-13 h-12 w-12 rounded-full border-2 border-white shadow-md object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="font-black text-slate-800 text-sm truncate">{appUser.name}</p>
              <p className="text-xs text-slate-500 font-medium truncate">
                {(appUser as any).industry || (appUser as any).companyName || (appUser as any).bio?.slice(0, 40) || 'باحث عن عمل'}
              </p>
            </div>
            <div className={`text-[10px] font-black px-3 py-1.5 rounded-full shrink-0 ${
              profileCompletion >= 75 ? 'bg-emerald-100 text-emerald-700' :
              profileCompletion >= 50 ? 'bg-blue-100 text-blue-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {profileCompletion}% مكتمل
            </div>
          </div>

          {/* Profile weak warning */}
          {profileCompletion < 75 && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3 items-start">
              <Info size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-black text-amber-800 uppercase tracking-wider mb-1">ملفك غير مكتمل</p>
                <p className="text-xs font-bold text-amber-700 leading-relaxed">
                  أصحاب العمل يفضلون الملفات المكتملة. أكمل نبذتك ومهاراتك وخبراتك لرفع فرص القبول.
                </p>
              </div>
            </div>
          )}

          {/* Auto-filled info summary */}
          <div className="bg-blue-50/50 rounded-2xl p-4 space-y-3 border border-blue-100/60">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">بياناتك تُرسل تلقائياً</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'الموقع', value: (appUser as any).location },
                { label: 'القطاع', value: (appUser as any).industry },
                { label: 'الموقع الإلكتروني', value: (appUser as any).website },
                { label: 'البريد', value: appUser.email },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-xl p-3 border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{item.label}</p>
                  <p className="text-xs font-bold text-slate-700 truncate">{item.value || 'غير محدد'}</p>
                </div>
              ))}
            </div>
            {((appUser as any).skills?.length > 0) && (
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">المهارات</p>
                <div className="flex flex-wrap gap-1.5">
                  {((appUser as any).skills || []).slice(0, 6).map((s: string) => (
                    <span key={s} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black border border-blue-100">{s}</span>
                  ))}
                  {((appUser as any).skills || []).length > 6 && (
                    <span className="px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-black border border-slate-100">+{((appUser as any).skills || []).length - 6}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Extra fields */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Sparkles size={14} className="text-amber-500" />
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">إضافات اختيارية تقوّي طلبك</p>
            </div>

            {/* Cover letter */}
            <div>
              <label htmlFor="apply-cover-letter" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">رسالة التقديم (Cover Letter)</label>
              <textarea
                id="apply-cover-letter"
                name="coverLetter"
                placeholder="اكتب رسالة مهنية قصيرة تعبّر فيها عن دوافعك ولماذا أنت المرشح المثالي..."
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium min-h-[120px] focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none resize-none leading-relaxed transition-all"
                value={cvCoverLetter}
                onChange={e => setCvCoverLetter(e.target.value)}
              />
            </div>

            {/* Experience + Education */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="apply-experience" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Clock size={10} /> سنوات الخبرة الكلية
                </label>
                <input
                  id="apply-experience"
                  name="experience"
                  placeholder="مثال: 5 سنوات"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                  value={cvExperience}
                  onChange={e => setCvExperience(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="apply-education" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <GraduationCap size={10} /> المؤهل العلمي
                </label>
                <input
                  id="apply-education"
                  name="education"
                  placeholder="مثال: ماجستير"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                  value={cvEducation}
                  onChange={e => setCvEducation(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* --- Previous Jobs Section --- */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Briefcase size={10} /> خبرات العمل السابقة
                </label>
                <button 
                  onClick={addPrevWork}
                  className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 hover:bg-blue-100 transition-all"
                >
                  + إضافة عمل سابق
                </button>
              </div>

              <div className="space-y-4">
                {prevWorks.map((work, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    key={idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3 relative"
                  >
                    <button 
                      onClick={() => removePrevWork(idx)}
                      className="absolute top-2 left-2 p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">الشركة</p>
                        <input 
                          value={work.company} onChange={e => updatePrevWork(idx, 'company', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-blue-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">المسمى الوظيفي</p>
                        <input 
                          value={work.role} onChange={e => updatePrevWork(idx, 'role', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-blue-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">المهام والمسؤوليات</p>
                      <textarea 
                        value={work.tasks} onChange={e => updatePrevWork(idx, 'tasks', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-blue-400 min-h-[60px] resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">المهارات المستخدمة</p>
                        <input 
                          value={work.skills} onChange={e => updatePrevWork(idx, 'skills', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-blue-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ساعات العمل / الراتب</p>
                        <div className="flex gap-2">
                           <input 
                             placeholder="ساعات" value={work.hours} onChange={e => updatePrevWork(idx, 'hours', e.target.value)}
                             className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-bold outline-none focus:border-blue-400"
                           />
                           <input 
                             placeholder="راتب" value={work.salary} onChange={e => updatePrevWork(idx, 'salary', e.target.value)}
                             className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-bold outline-none focus:border-blue-400"
                           />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* CV Upload */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">السيرة الذاتية (PDF / Word)</label>
              <div
                onClick={() => document.getElementById('cv-upload-main')?.click()}
                className={`w-full border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  cvFileObj || (appUser as any).cv_url || (appUser as any).cvUrl ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200 hover:border-blue-200 hover:bg-blue-50/30'
                }`}
              >
                {cvFileObj || (appUser as any).cv_url || (appUser as any).cvUrl ? (
                  <div className="flex items-center gap-3 w-full">
                    <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow"><FileText size={20} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">{cvFileObj ? cvFileObj.name : 'السيرة الذاتية المرفوعة مسبقاً'}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{cvFileObj ? `${(cvFileObj.size / 1024 / 1024).toFixed(2)} MB` : 'جاهزة للإرسال'}</p>
                    </div>
                    {cvFileObj && (
                      <button
                        onClick={e => { e.stopPropagation(); setCvFileObj(null); }}
                        className="p-2 hover:bg-red-50 text-red-400 rounded-xl transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-300 mb-3"><Paperclip size={24} /></div>
                    <p className="text-xs font-bold text-slate-600">اضغط لرفع السيرة الذاتية</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">PDF, DOC, DOCX — الحد الأقصى 5 ميجابايت</p>
                  </>
                )}
                <input
                  id="cv-upload-main" type="file" className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) { addToast('حجم الملف يجب أن لا يتجاوز 5 ميجابايت', 'error'); return; }
                    setCvFileObj(file);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="p-6 border-t border-slate-50 flex gap-3 bg-white">
          <button
            onClick={handleClose}
            disabled={isApplying}
            className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={isApplying || isUploadingCv}
            className={`flex-[2] py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg ${
              isApplying || isUploadingCv
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-[#0a66c2] hover:bg-[#004182] text-white shadow-blue-200 hover:shadow-blue-300 active:scale-[0.98]'
            }`}
          >
            {isUploadingCv ? (
              <div className="flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" />
                <span>جاري رفع الملف...</span>
              </div>
            ) : isApplying ? (
              <div className="flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" />
                <span>جاري الإرسال...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Send size={15} />
                <span>تقديم احترافي ⚡</span>
              </div>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
