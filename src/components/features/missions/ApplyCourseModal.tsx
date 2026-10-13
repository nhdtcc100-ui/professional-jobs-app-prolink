import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap, Clock, DollarSign, Info, Sparkles, FileText,
  CheckCircle2, Send, Loader2, ArrowRight, BookOpen, Paperclip,
  Trash2, User, Award, ShieldCheck
} from 'lucide-react';
import { Course, AppUser } from '../../../types';
import { courseService } from '../../../lib/services/courseService';

interface ApplyCourseModalProps {
  course: Course | null;
  appUser: AppUser;
  allUsers?: AppUser[];
  onClose: () => void;
  onSuccess: (courseId: string) => void;
  addToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ApplyCourseModal: React.FC<ApplyCourseModalProps> = ({
  course,
  appUser,
  allUsers = [],
  onClose,
  onSuccess,
  addToast
}) => {
  const [motivation, setMotivation] = useState('');
  const [experience, setExperience] = useState((appUser as any)?.experience || '');
  const [education, setEducation] = useState((appUser as any)?.education || '');
  const [cvFileObj, setCvFileObj] = useState<File | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  if (!course || !appUser) return null;

  const publisher = (allUsers || []).find((u: any) => u.id === course.provider_id);
  const coverBannerUrl = publisher?.coverUrl || (publisher as any)?.cover_url || course.image_url;

  const profileCompletion =
    ((appUser as any).bio         ? 25 : 0) +
    (((appUser as any).skills?.length > 0) ? 25 : 0) +
    ((appUser as any).location    ? 25 : 0) +
    (motivation.trim().length > 10 ? 25 : 0);

  const handleSubmit = async () => {
    if (!appUser || !course) return;

    setIsApplying(true);
    let succeeded = false;

    // Safety timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (!succeeded) {
        setIsApplying(false);
        addToast('انتهت مهلة التسجيل. يرجى التأكد من اتصال الإنترنت والمحاولة مجدداً.', 'error');
      }
    }, 15000);

    try {
      let uploadedCvUrl = (appUser as any)?.cv_url || (appUser as any)?.cvUrl || '';
      if (cvFileObj) {
        try {
          const { cvService } = await import('../../../lib/services/cvService');
          const { data: uploadedUrl, error: cvErr } = await cvService.uploadCV(appUser.id, cvFileObj);
          if (uploadedUrl) {
            uploadedCvUrl = uploadedUrl;
          } else if (cvErr) {
            console.warn('[ApplyCourseModal] File upload warning:', cvErr);
          }
        } catch (uploadErr) {
          console.warn('[ApplyCourseModal] File upload exception:', uploadErr);
        }
      }

      const { data, error } = await courseService.applyToCourse(
        appUser.id,
        course.provider_id,
        course.id,
        {
          notes: motivation,
          experience,
          education,
          cvUrl: uploadedCvUrl,
          applicantData: {
            name: appUser.name,
            avatar: appUser.avatar,
            title: appUser.title
          }
        }
      );

      if (error) throw error;

      succeeded = true;
      clearTimeout(timeoutId);
      setIsApplying(false);
      setApplySuccess(true);
      onSuccess(course.id);
      addToast('🎉 تم إرسال طلب تسجيلك في الدورة بنجاح!');

      setTimeout(() => {
        setApplySuccess(false);
        onClose();
      }, 2500);

    } catch (err: any) {
      clearTimeout(timeoutId);
      setIsApplying(false);
      addToast(err.message || 'فشل إرسال طلب التسجيل', 'error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] z-[300] bg-slate-900/80 backdrop-blur-md flex flex-col justify-end md:justify-center items-center p-0 md:p-4"
      dir="rtl"
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92dvh] md:max-h-[88dvh] overflow-hidden relative border border-white/20 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Success Animation Overlay ── */}
        <AnimatePresence>
          {applySuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
                <CheckCircle2 size={40} className="animate-bounce" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">تم إرسال طلب التسجيل بنجاح! 🎓</h3>
              <p className="text-slate-400 text-xs max-w-sm leading-relaxed mb-4">
                تم إشعار مدرب الدورة بطلب انضمامك. ستتلقى إشعاراً فور قبول طلبك وبدء التدريب.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Header (Sticky Top with Safe Area) ── */}
        <div
          className="shrink-0 bg-gradient-to-bl from-indigo-700 via-blue-700 to-blue-950 pb-5 px-5 text-white relative overflow-hidden shadow-md z-20"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}
        >
          {coverBannerUrl ? (
            <img src={coverBannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay pointer-events-none" />
          ) : (
            <div className="absolute -top-8 -left-8 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          )}

          <div className="flex items-center justify-between gap-3 mb-3 relative z-10">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 active:scale-95 rounded-2xl transition-all border border-white/20 text-white text-xs font-black shadow-sm cursor-pointer"
              title="رجوع"
            >
              <ArrowRight size={17} />
              <span>رجوع</span>
            </button>
            <span className="text-[10px] font-black text-blue-200 bg-white/10 px-3 py-1 rounded-full border border-white/10">
              إكمال التسجيل في الدورة التدريبية
            </span>
          </div>

          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-lg shrink-0">
              <GraduationCap size={24} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base md:text-lg font-black tracking-tight leading-snug truncate text-white">
                {course.title}
              </h2>
              <p className="text-blue-100/90 text-xs font-bold flex items-center gap-2 truncate mt-0.5">
                <span>{publisher?.name || course.providerName || 'المدرب'}</span>
                <span>•</span>
                <span className="text-emerald-300">{course.price || 'مجاني'}</span>
                <span>•</span>
                <span>{course.duration || 'مرن'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Body Form ── */}
        <div className="p-4 md:p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/60">

          {/* Profile Completion Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-center mb-2 text-xs font-bold">
              <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                اكتمال بيانات طلب التسجيل
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-black">{profileCompletion}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                animate={{ width: `${profileCompletion}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>

          {/* Student Profile Preview */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-blue-600 text-white flex items-center justify-center text-sm font-black shrink-0 shadow-md">
              {appUser.avatar ? (
                <img src={appUser.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={20} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs md:text-sm font-black text-slate-800 dark:text-white truncate">
                {appUser.name}
              </h4>
              <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5">
                {appUser.title || appUser.companyName || 'متدرب مهتم'} {appUser.location ? `• ${appUser.location}` : ''}
              </p>
            </div>
            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/40 shrink-0">
              ملفك الشخصي
            </span>
          </div>

          {/* Motivation / Registration Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <BookOpen size={14} className="text-blue-500" />
              أهدافك من الالتحاق بالدورة / رسالة للمدرب
            </label>
            <textarea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder="اكتب نبذة عن سبب اهتمامك بهذه الدورة وما الذي تتطلع إلى اكتسابه وتطويره..."
              className="w-full h-28 p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs md:text-sm font-medium focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 focus:border-blue-500 outline-none resize-none transition-all"
              maxLength={1500}
            />
          </div>

          {/* Background Knowledge & Experience */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Award size={14} className="text-indigo-500" />
              الخلفية التعليمية أو المعرفة السابقة (اختياري)
            </label>
            <input
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="مثال: خريج هندسة حاسوب / مبتدئ في مجال التصميم..."
              className="w-full p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs md:text-sm font-medium focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* CV / Portfolio Document Attachment */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Paperclip size={14} className="text-slate-500" />
              إرفاق سيرة ذاتية أو معرض أعمال (اختياري)
            </label>
            {cvFileObj ? (
              <div className="flex items-center justify-between p-3.5 bg-blue-50/60 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText size={18} className="text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{cvFileObj.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCvFileObj(null)}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-2xl cursor-pointer bg-white dark:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all">
                <Paperclip size={16} />
                <span>اختر ملف PDF أو Word من جهازك</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setCvFileObj(e.target.files[0]);
                  }}
                />
              </label>
            )}
          </div>

        </div>

        {/* ── Sticky Bottom Action ── */}
        <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0 shadow-lg">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="px-6 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 rounded-2xl text-xs font-black transition-all cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isApplying}
            className={`flex-1 sm:flex-none px-8 py-3.5 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
              !isApplying
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25 active:scale-95'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            {isApplying ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>جاري إرسال طلب التسجيل...</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>تأكيد وإرسال طلب التسجيل 🎓</span>
              </>
            )}
          </button>
        </div>

      </div>
    </motion.div>
  );
};
