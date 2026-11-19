import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Printer, Share2, Briefcase, GraduationCap, MapPin,
  Phone, Mail, Globe, CheckCircle2, Award, Sparkles, Building2,
  Calendar, Wrench, Download, ExternalLink
} from 'lucide-react';
import { AppUser } from '../../../types';
import { openContactMenu } from '../../../lib/utils/contact';

export interface GeneratedCVModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AppUser | any;
  applicantData?: any;
  coverLetter?: string;
}

export const GeneratedCVModal: React.FC<GeneratedCVModalProps> = ({
  isOpen,
  onClose,
  user,
  applicantData,
  coverLetter,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !user) return null;

  // Resolve merged profile fields
  const name = applicantData?.name || user?.name || user?.fullName || 'محترف ProLink';
  const avatar = applicantData?.avatar || user?.avatar || user?.avatarUrl || user?.avatar_url || '';
  const title = applicantData?.title || user?.title || user?.displayTitle || user?.specialty || user?.headline || 'متخصص مهني';
  const industry = applicantData?.industry || user?.industry || 'كفاءات ProLink';
  const location = applicantData?.location || user?.location || 'العراق';
  const phone = applicantData?.phone || user?.phone || '';
  const email = applicantData?.email || user?.email || '';
  const website = applicantData?.website || user?.website || '';
  const bio = applicantData?.bio || user?.bio || '';
  const experience = applicantData?.experience || user?.experience || '';
  const education = applicantData?.education || user?.education || '';
  const skills: string[] = Array.isArray(applicantData?.skills) && applicantData.skills.length > 0
    ? applicantData.skills
    : Array.isArray(user?.skills) && user.skills.length > 0
    ? user.skills
    : [];

  const prevWorks = applicantData?.prevWorks || [];

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `السيرة الذاتية - ${name}`,
          text: `السيرة الذاتية الرسمية للمحترف ${name} من منصة ProLink`,
          url: window.location.href,
        });
      } catch (_) {}
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto printable-cv-modal print:p-0 print:m-0 print:bg-white print:static print:overflow-visible"
        dir="rtl"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] print:border-none print:shadow-none print:w-full print:max-w-none print:max-h-none print:rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar Header (Not printed) */}
          <div className="shrink-0 px-5 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-[#0a66c2] text-white flex items-center justify-between shadow-md print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-black text-sm sm:text-base leading-tight">
                  السيرة الذاتية الرقمية المعتمدة
                </h3>
                <p className="text-[10px] text-blue-100 font-bold mt-0.5">
                  منشأة وموثقة تلقائياً بواسطة المنصة 🛡️
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-black text-xs flex items-center gap-1.5 backdrop-blur-md border border-white/25 transition-all active:scale-95 cursor-pointer shadow-sm"
                title="طباعة أو حفظ كملف PDF"
              >
                <Printer size={15} />
                <span className="hidden sm:inline">طباعة / PDF</span>
              </button>

              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  type="button"
                  onClick={handleShare}
                  className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all active:scale-95 cursor-pointer"
                  title="مشاركة"
                >
                  <Share2 size={16} />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all active:scale-95 cursor-pointer"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Printable CV Canvas */}
          <div
            ref={printAreaRef}
            className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 bg-slate-50/50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 print:bg-white print:text-black print:p-0 print:overflow-visible"
            id="prolink-generated-cv"
          >
            {/* CV Sheet Container */}
            <div className="printable-cv-area bg-white dark:bg-slate-800/90 rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/80 dark:border-slate-700/80 space-y-6 print:border-none print:shadow-none print:p-0 print:bg-white">
              
              {/* Header: Name, Contact & Avatar */}
              <div className="printable-section flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-100 dark:border-slate-700/60 print:border-blue-600 print:border-b-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-right">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={name}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-4 border-white dark:border-slate-700 shadow-md ring-2 ring-blue-500/20 shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-3xl font-black shadow-md shrink-0">
                      {name.charAt(0)}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white print:text-black">
                        {name}
                      </h1>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-black print:border-blue-600">
                        <CheckCircle2 size={11} className="text-blue-600 dark:text-blue-400" />
                        سيرة موثقة بالمنصة
                      </span>
                    </div>

                    <p className="text-base font-bold text-blue-600 dark:text-blue-400 print:text-blue-700">
                      {title}
                    </p>

                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500">
                      {industry} • {location}
                    </p>

                    {/* Contact Badges */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                      {phone && (
                        <div
                          onClick={() => openContactMenu({ phone })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-emerald-50 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer print:bg-slate-100"
                        >
                          <Phone size={12} className="text-emerald-500" />
                          <span dir="ltr">{phone}</span>
                        </div>
                      )}

                      {email && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-bold print:bg-slate-100">
                          <Mail size={12} className="text-blue-500" />
                          <span dir="ltr">{email}</span>
                        </div>
                      )}

                      {location && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-bold print:bg-slate-100">
                          <MapPin size={12} className="text-amber-500" />
                          <span>{location}</span>
                        </div>
                      )}

                      {website && (
                        <a
                          href={website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-blue-50 text-blue-600 dark:text-blue-400 text-xs font-bold transition-all print:bg-slate-100"
                        >
                          <Globe size={12} />
                          <span dir="ltr">{website}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* ProLink Official Stamp Card */}
                <div className="hidden md:flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-700/40 dark:to-slate-800/40 border border-blue-100 dark:border-slate-700 text-center shrink-0 w-36">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md mb-1.5">
                    <Award size={16} />
                  </div>
                  <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    PROLINK CV
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold mt-0.5">
                    معتمدة رقمياً
                  </span>
                </div>
              </div>

              {/* Cover Letter / Note (If viewing inside an application) */}
              {coverLetter && (
                <section className="space-y-2">
                  <h2 className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <Sparkles size={14} />
                    خطاب التقديم والرسالة التعريفية
                  </h2>
                  <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-sm font-medium leading-relaxed whitespace-pre-line">
                    {coverLetter}
                  </div>
                </section>
              )}

              {/* Bio / Summary */}
              {bio && (
                <section className="space-y-2.5">
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#0a66c2] dark:text-blue-400 flex items-center gap-2 border-r-4 border-[#0a66c2] pr-2.5">
                    النبذة المهنية والشخصية
                  </h2>
                  <p className="text-sm md:text-base leading-relaxed text-slate-700 dark:text-slate-200 print:text-black whitespace-pre-line font-medium bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                    {bio}
                  </p>
                </section>
              )}

              {/* Previous Works (Structured) */}
              {prevWorks && prevWorks.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#0a66c2] dark:text-blue-400 flex items-center gap-2 border-r-4 border-[#0a66c2] pr-2.5">
                    <Building2 size={15} />
                    سجل الأعمال والشركات السابقة
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {prevWorks.map((pw: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-black text-sm text-slate-800 dark:text-white print:text-black">
                            {pw.role || 'المسمى الوظيفي'}
                          </h3>
                          {pw.company && (
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                              {pw.company}
                            </span>
                          )}
                        </div>
                        {pw.tasks && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {pw.tasks}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1 text-[10px] text-slate-400">
                          {pw.skills && <span>🛠️ المهارات: {pw.skills}</span>}
                          {pw.hours && <span>⏰ {pw.hours}</span>}
                          {pw.salary && <span>💰 {pw.salary}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Professional Experience */}
              {experience && (
                <section className="space-y-2.5">
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#0a66c2] dark:text-blue-400 flex items-center gap-2 border-r-4 border-[#0a66c2] pr-2.5">
                    <Briefcase size={15} />
                    الخبرات العملية وسجل الإنجازات
                  </h2>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 text-sm leading-relaxed text-slate-700 dark:text-slate-200 print:text-black whitespace-pre-line font-medium">
                    {experience}
                  </div>
                </section>
              )}

              {/* Education */}
              {education && (
                <section className="space-y-2.5">
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#0a66c2] dark:text-blue-400 flex items-center gap-2 border-r-4 border-[#0a66c2] pr-2.5">
                    <GraduationCap size={15} />
                    التعليم والمؤهلات الأكاديمية والشهادات
                  </h2>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 text-sm leading-relaxed text-slate-700 dark:text-slate-200 print:text-black whitespace-pre-line font-medium">
                    {education}
                  </div>
                </section>
              )}

              {/* Key Skills */}
              {skills.length > 0 && (
                <section className="space-y-2.5">
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#0a66c2] dark:text-blue-400 flex items-center gap-2 border-r-4 border-[#0a66c2] pr-2.5">
                    <Wrench size={15} />
                    المهارات والكفاءات الرئيسية
                  </h2>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {skills.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200/60 dark:border-blue-800/50 print:bg-slate-100 print:text-black print:border-slate-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Footer */}
              <div className="pt-6 border-t border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between text-slate-400 text-[10px] font-bold gap-2 print:text-slate-500">
                <span>تم إنشاء هذه السيرة الذاتية عبر منصة ProLink المهنية © {new Date().getFullYear()}</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={12} />
                  معتمد وموثق رقمياً
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Actions Bar (Not printed) */}
          <div className="shrink-0 p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 print:hidden">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95 cursor-pointer"
            >
              إغلاق المعاينة
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-[#0a66c2] hover:from-blue-700 hover:to-[#08529c] text-white text-xs font-black shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Printer size={15} />
              <span>طباعة وتصدير PDF 📄</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
