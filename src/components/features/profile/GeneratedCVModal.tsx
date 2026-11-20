import React, { useRef, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Printer, Share2, MapPin,
  Phone, Mail, CheckCircle2, Sparkles, Building2, Download, MessageCircle
} from 'lucide-react';
import { AppUser } from '../../../types';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { useAppContext } from '../../../contexts/AppContext';

export interface GeneratedCVModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AppUser | any;
  applicantData?: any;
  coverLetter?: string;
  employerPhone?: string;
  jobTitle?: string;
}

export const GeneratedCVModal: React.FC<GeneratedCVModalProps> = ({
  isOpen,
  onClose,
  user,
  applicantData,
  coverLetter,
  employerPhone,
  jobTitle,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const { appUser } = useAppContext();

  // 🛡️ Owner verification: only the actual owner of the CV can see the WhatsApp share action
  const isOwner = Boolean(
    appUser && (
      (user?.id && appUser.id === user.id) ||
      ((applicantData as any)?.user_id && appUser.id === (applicantData as any).user_id) ||
      ((applicantData as any)?.applicant_id && appUser.id === (applicantData as any).applicant_id)
    )
  );

  // 🔒 Lock background scroll and isolate print layout to this modal only
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('printable-modal-open');
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.classList.remove('printable-modal-open');
    };
  }, [isOpen]);

  // Keyboard navigation: Escape closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Resolve merged profile fields
  // 0. Resolve saved CV data from database or props
  const savedCvData = (applicantData as any)?.cv_data || (user as any)?.cv_data || (applicantData as any)?.cvData || (user as any)?.cvData || (applicantData as any)?.atsCV || (user as any)?.atsCV;

  const fullName = applicantData?.name || savedCvData?.name || savedCvData?.fullName || user?.name || user?.fullName || 'محترف ProLink';
  const title = applicantData?.title || savedCvData?.title || user?.title || user?.displayTitle || user?.display_title || user?.specialty || user?.headline || 'متخصص مهني';
  const location = applicantData?.location || savedCvData?.location || user?.location || 'العراق';
  const phone = applicantData?.phone || savedCvData?.phone || user?.phone || '';
  const email = applicantData?.email || savedCvData?.email || user?.email || '';
  const bio = applicantData?.bio || savedCvData?.bio || savedCvData?.summary || user?.bio || '';
  const education = applicantData?.education || savedCvData?.education || savedCvData?.educationText || user?.education || '';

  // Resolve skills
  const skills: string[] = useMemo(() => {
    if (Array.isArray(savedCvData?.skills) && savedCvData.skills.length > 0) return savedCvData.skills;
    if (Array.isArray(applicantData?.skills) && applicantData.skills.length > 0) return applicantData.skills;
    if (Array.isArray(user?.skills) && user.skills.length > 0) return user.skills;
    return [];
  }, [applicantData?.skills, user?.skills, savedCvData?.skills]);

  // Helper to normalize any language representation
  const parseLanguageItem = (l: any, i: number) => {
    if (typeof l === 'object' && l && l.name) {
      return { id: l.id || `lang-${i}`, name: l.name, level: l.level || 'طليق / ممتاز' };
    }
    const str = String(l || '').trim();
    if (!str) return null;
    const parenMatch = str.match(/^(.+?)\s*\((.+?)\)$/);
    if (parenMatch) {
      return { id: `lang-${i}`, name: parenMatch[1].trim(), level: parenMatch[2].trim() };
    }
    const dashMatch = str.split(' - ');
    if (dashMatch.length > 1) {
      return { id: `lang-${i}`, name: dashMatch[0].trim(), level: dashMatch[1].trim() };
    }
    return { id: `lang-${i}`, name: str, level: 'طليق / ممتاز' };
  };

  // Resolve languages
  const languages = useMemo(() => {
    const rawLangs = savedCvData?.languages || applicantData?.languages || user?.languages;
    if (Array.isArray(rawLangs) && rawLangs.length > 0) {
      const parsed = rawLangs.map((l: any, i: number) => parseLanguageItem(l, i)).filter(Boolean);
      if (parsed.length > 0) return parsed;
    }

    const userId = user?.id || applicantData?.userId;
    if (userId) {
      try {
        const saved = localStorage.getItem(`prolink_ats_languages_${userId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((l: any, i: number) => parseLanguageItem(l, i)).filter(Boolean);
          }
        }
      } catch (_) {}
    }

    return [
      { id: 'l-1', name: 'العربية', level: 'اللغة الأم' },
      { id: 'l-2', name: 'الإنجليزية', level: 'متقدم' }
    ];
  }, [applicantData, user, savedCvData?.languages]);

  // Resolve experiences
  const experiences = useMemo(() => {
    // 1. Helper to find first non-empty array across all candidate paths
    const findArray = (...candidates: any[]) => {
      for (const c of candidates) {
        if (Array.isArray(c) && c.length > 0) return c;
        if (typeof c === 'string' && c.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(c);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          } catch (_) {}
        }
      }
      return null;
    };

    const directExps = findArray(
      savedCvData?.workExperiences,
      savedCvData?.work_experiences,
      applicantData?.workExperiences,
      applicantData?.work_experiences,
      (applicantData as any)?.experiences,
      (applicantData as any)?.cv_data?.workExperiences,
      (applicantData as any)?.cv_data?.work_experiences,
      (user as any)?.workExperiences,
      (user as any)?.work_experiences,
      (user as any)?.cv_data?.workExperiences,
      (user as any)?.cv_data?.work_experiences,
      (user as any)?.cvData?.workExperiences,
      (applicantData as any)?.prevWorks,
      (user as any)?.prevWorks
    );

    if (directExps && directExps.length > 0) {
      return directExps.map((e: any, idx: number) => {
        const expRole = e.role || e.title || e.job_title || e.jobTitle || title || 'أخصائي مهني';
        const expCompany = e.company || e.companyName || e.company_name || 'منشأة معتمدة';
        const expDuration = e.duration || e.period || e.time || (e.hours ? `ساعات العمل: ${e.hours}` : 'سجل الخبرات');
        const expTasks = e.tasks || e.description || e.desc || '';
        const expSkills = e.skills || (e.salary ? `الراتب: ${e.salary}` : '');
        return {
          id: e.id || `exp-${idx}`,
          role: expRole,
          company: expCompany,
          duration: expDuration,
          tasks: expTasks,
          skills: expSkills
        };
      });
    }

    // 2. Fallback to localStorage for the user if viewing own CV
    const userId = user?.id || applicantData?.userId;
    if (userId) {
      try {
        const saved = localStorage.getItem(`prolink_ats_experiences_${userId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((e: any, idx: number) => ({
              id: e.id || `exp-local-${idx}`,
              role: e.role || e.title || title || 'أخصائي مهني',
              company: e.company || e.companyName || 'منشأة معتمدة',
              duration: e.duration || e.period || 'سجل الخبرات',
              tasks: e.tasks || e.description || '',
              skills: e.skills || ''
            }));
          }
        }
      } catch (_) {}
    }

    // 3. Raw text string fallback with intelligent pattern parsing
    const expText = applicantData?.experience || (applicantData as any)?.applicant_data?.experience || user?.experience || savedCvData?.experienceText || savedCvData?.experience;
    if (typeof expText === 'string' && expText.trim().length > 0) {
      const rawBlocks = expText.split(/(?:^|\n)\s*[•\-\*]\s+/).map(l => l.trim()).filter(Boolean);
      const blocks = rawBlocks.length > 0 ? rawBlocks : [expText.trim()];
      return blocks.map((blk, idx) => {
        // Pattern: <role> لدى <company> (<duration>): <tasks> [المهارات: <skills>]
        const pattern = /^(.+?)\s+لدى\s+([^(\n:]+)(?:\s*\(([^)]+)\))?\s*:\s*([\s\S]*)$/;
        const match = blk.match(pattern);
        if (match) {
          const parsedRole = match[1].trim();
          const parsedCompany = match[2].trim();
          const parsedDuration = (match[3] || 'سجل الخبرات المعتمد').trim();
          let parsedTasks = match[4].trim();
          let parsedSkills = '';
          const skillsMatch = parsedTasks.match(/\[(?:المهارات|مهارات):\s*([^\]]+)\]/);
          if (skillsMatch) {
            parsedSkills = skillsMatch[1].trim();
            parsedTasks = parsedTasks.replace(/\[(?:المهارات|مهارات):\s*[^\]]+\]/, '').trim();
          }
          return {
            id: `exp-text-${idx}`,
            role: parsedRole,
            company: parsedCompany,
            duration: parsedDuration,
            tasks: parsedTasks,
            skills: parsedSkills || skills.slice(0, 3).join(', ')
          };
        }
        return {
          id: `exp-text-${idx}`,
          role: title || 'أخصائي مهني',
          company: user?.companyName || 'منشأة معتمدة',
          duration: 'سجل الخبرات المعتمد',
          tasks: blk,
          skills: skills.slice(0, 3).join(', ')
        };
      });
    }

    return [
      {
        id: 'exp-default-1',
        role: title || 'أخصائي مهني',
        company: user?.companyName || 'شركة رائدة',
        duration: '2023 - حتى الآن',
        tasks: 'قيادة وتنفيذ المهام التخصصية بكفاءة عالية، وتطوير أداء الفريق، وتحقيق أهداف المنشأة وفق أعلى المعايير.',
        skills: skills.slice(0, 3).join(', ') || 'التخطيط، إدارة المهام، حل المشكلات'
      }
    ];
  }, [applicantData, user, title, skills, savedCvData]);

  // ── Calculate dynamic content density for responsive 1-page A4 scaling ──
  const contentDensity = useMemo<'compact' | 'normal' | 'spacious'>(() => {
    let score = 0;
    if (bio) score += Math.ceil(bio.length / 90);
    if (coverLetter) score += Math.ceil(coverLetter.length / 90);
    score += (experiences?.length || 0) * 3;
    experiences?.forEach((exp: any) => {
      if (exp.tasks) score += Math.ceil(exp.tasks.length / 75);
    });
    if (education) score += Math.ceil(education.length / 80) + 1;
    score += Math.ceil((skills?.length || 0) / 4);
    score += Math.ceil((languages?.length || 0) / 3);

    if (score > 13) return 'compact';
    if (score < 8) return 'spacious';
    return 'normal';
  }, [bio, coverLetter, experiences, education, skills, languages]);

  const densityStyles = useMemo(() => {
    if (contentDensity === 'compact') {
      return {
        container: 'p-4 sm:p-6 space-y-2.5 print:space-y-1.5 print:p-0',
        headerPad: 'pb-2 mb-1',
        titleSize: 'text-base sm:text-lg print:text-base mb-0.5',
        subtitleSize: 'text-[11px] sm:text-xs print:text-[11px] mb-1',
        contactSize: 'text-[9.5px] print:text-[9px] gap-x-3 gap-y-0.5',
        sectionHeader: 'text-[10px] print:text-[9.5px] pb-0.5 font-black',
        bodyText: 'text-[10px] sm:text-[10.5px] print:text-[9.5px] leading-snug print:leading-[1.2]',
        expSpacing: 'space-y-2',
        badgePadding: 'px-1.5 py-0.5 text-[9px] print:text-[8.5px]',
        langGap: 'gap-2 text-[10px] print:text-[9.5px]',
        footerText: 'text-[8.5px] print:text-[8px] pt-1.5',
      };
    }
    if (contentDensity === 'spacious') {
      return {
        container: 'p-8 sm:p-11 space-y-4 print:space-y-3 print:p-0',
        headerPad: 'pb-3.5 mb-2',
        titleSize: 'text-xl sm:text-2xl print:text-xl mb-1',
        subtitleSize: 'text-xs sm:text-sm print:text-xs mb-2',
        contactSize: 'text-[11px] print:text-[10.5px] gap-x-4 gap-y-1',
        sectionHeader: 'text-[11.5px] print:text-[11px] pb-0.5 font-black',
        bodyText: 'text-xs print:text-[11px] leading-relaxed print:leading-[1.35]',
        expSpacing: 'space-y-3.5',
        badgePadding: 'px-2.5 py-0.5 text-[10.5px] print:text-[10px]',
        langGap: 'gap-3.5 text-xs print:text-[10.5px]',
        footerText: 'text-[9.5px] print:text-[9px] pt-3',
      };
    }
    // Normal default
    return {
      container: 'p-6 sm:p-9 space-y-3.5 print:space-y-2 print:p-0',
      headerPad: 'pb-3 mb-1.5',
      titleSize: 'text-lg sm:text-xl print:text-lg mb-0.5',
      subtitleSize: 'text-xs sm:text-sm print:text-xs mb-1.5',
      contactSize: 'text-[10.5px] print:text-[10px] gap-x-3.5 gap-y-1',
      sectionHeader: 'text-[11px] print:text-[10px] pb-0.5 font-black',
      bodyText: 'text-[11px] sm:text-xs print:text-[10px] leading-normal print:leading-[1.28]',
      expSpacing: 'space-y-2.5',
      badgePadding: 'px-2 py-0.5 text-[10px] print:text-[9px]',
      langGap: 'gap-3 text-[11px] print:text-[10px]',
      footerText: 'text-[9px] print:text-[8.5px] pt-2',
    };
  }, [contentDensity]);

  const handlePrint = () => {
    window.print();
  };

  const generateWhatsAppMessage = () => {
    const summary = [
      `📄 *السيرة الذاتية المهنية (ATS) المعتمدة - ProLink*`,
      `👤 *الاسم:* ${fullName}`,
      `💼 *المسمى المهني:* ${title}`,
      location ? `📍 *الموقع:* ${location}` : '',
      phone ? `📞 *الهاتف:* ${phone}` : '',
      email ? `✉️ *البريد:* ${email}` : '',
      bio ? `\n📝 *نبذة موجزة:*\n${bio}` : '',
      experiences.length > 0 ? `\n🏢 *أبرز الخبرات:*\n` + experiences.slice(0, 3).map(e => `• ${e.role} لدى ${e.company} (${e.duration})`).join('\n') : '',
      skills.length > 0 ? `\n🛠️ *المهارات الأساسية:*\n${skills.slice(0, 6).join(' • ')}` : '',
      languages.length > 0 ? `\n🌐 *اللغات:*\n` + languages.map((l: any) => `${l.name} (${l.level})`).join(' • ') : '',
      `\n🔗 *رابط الملف المهني الموثق:* ${window.location.origin}`
    ].filter(Boolean).join('\n');
    return summary;
  };

  const handleSendWhatsApp = async () => {
    const text = generateWhatsAppMessage();
    const cleanPhone = (employerPhone || '').replace(/[^0-9]/g, '');
    
    // If native Capacitor
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: `السيرة الذاتية - ${fullName}`,
          text: text,
          dialogTitle: 'إرسال السيرة الذاتية عبر واتساب',
        });
        return;
      } catch (_) {}
    }

    // Direct WhatsApp Web / App Link
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    
    window.open(waUrl, '_blank');
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 4000);
  };

  const handleShare = async () => {
    const text = generateWhatsAppMessage();
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: `السيرة الذاتية - ${fullName}`,
          text: text,
          url: window.location.href,
        });
        return;
      } catch (_) {}
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `السيرة الذاتية - ${fullName}`,
          text: text,
          url: window.location.href,
        });
        return;
      } catch (_) {}
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 3000);
    } catch (_) {}
  };

  if (!isOpen || !user) return null;

  // 🚀 Render directly in document.body via Portal to guarantee it is centered in the current viewport!
  return createPortal(
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto printable-cv-modal print:p-0 print:m-0 print:bg-white print:static print:overflow-visible"
        dir="rtl"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[94vh] print:border-none print:shadow-none print:w-full print:max-w-none print:max-h-none print:rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar Controls (Not printed) */}
          <div className="shrink-0 px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-[#0a66c2] text-white flex items-center justify-between shadow-md print:hidden flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <h3 className="font-black text-xs sm:text-sm leading-tight">
                  معاينة السيرة الذاتية القياسية (ATS)
                </h3>
                <p className="text-[10px] text-blue-100 font-bold">
                  تنسيق معتمد • قابل للتصدير كـ PDF ومشاركته للواتساب مباشرة 🛡️
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* WhatsApp Share Button - حصرياً لصاحب السيرة الذاتية فقط */}
              {isOwner && (
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                  title="إرسال السيرة عبر واتساب"
                >
                  <MessageCircle size={14} className="text-white fill-white/20" />
                  <span className="hidden sm:inline">واتساب</span>
                </button>
              )}

              {/* PDF Print / Export Button */}
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-black text-xs flex items-center gap-1.5 backdrop-blur-md border border-white/25 transition-all active:scale-95 cursor-pointer shadow-xs"
                title="تصدير كـ PDF أو طباعة"
              >
                <Download size={14} />
                <span>حفظ PDF</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all active:scale-95 cursor-pointer"
                title="مشاركة السيرة"
              >
                <Share2 size={15} />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all active:scale-95 cursor-pointer"
                title="إغلاق"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Feedback Banner if copied */}
          {copiedNotice && (
            <div className="px-4 py-2 bg-emerald-500 text-white text-[11px] font-bold text-center animate-fade-in print:hidden">
              ✅ تم تجهيز السيرة الذاتية ورابطها المباشر لمشاركتها عبر واتساب!
            </div>
          )}

          {/* 📄 Paper ATS Document Container ── Adaptive Content Density for single-page A4 fit ── */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100/60 dark:bg-slate-950 text-slate-900 print:bg-white print:text-black print:p-0 print:overflow-visible">
            <div
              ref={printAreaRef}
              className={`printable-cv-area w-full max-w-[760px] mx-auto bg-white text-black ${densityStyles.container} rounded-2xl shadow-xl border border-slate-300 print:shadow-none print:border-none print:p-0 print:m-0`}
              style={{ color: '#000000', backgroundColor: '#ffffff' }}
            >
              {/* Header: Full Name & Contact Details */}
              <div className={`printable-section border-b-2 border-black ${densityStyles.headerPad} text-center`}>
                <h1 className={`${densityStyles.titleSize} font-black tracking-tight text-black uppercase`}>
                  {fullName}
                </h1>
                <p className={`${densityStyles.subtitleSize} font-bold text-slate-800 tracking-wide`}>
                  {title}
                </p>

                {/* Contact details line */}
                <div className={`flex flex-wrap items-center justify-center ${densityStyles.contactSize} text-slate-700 font-semibold`}>
                  {phone && (
                    <span className="inline-flex items-center gap-1" dir="ltr">
                      <Phone size={11} className="text-black" />
                      <span>{phone}</span>
                    </span>
                  )}
                  {email && (
                    <span className="inline-flex items-center gap-1" dir="ltr">
                      <Mail size={11} className="text-black" />
                      <span>{email}</span>
                    </span>
                  )}
                  {location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} className="text-black" />
                      <span>{location}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-emerald-800 font-bold">
                    <CheckCircle2 size={11} />
                    <span>عضو موثق في ProLink</span>
                  </span>
                </div>
              </div>

              {/* Cover Letter (If provided with application) */}
              {coverLetter && (
                <div className="printable-section space-y-1">
                  <h3 className={`${densityStyles.sectionHeader} text-black tracking-wider uppercase border-b border-slate-300`}>
                    خطاب التقديم والرسالة التعريفية (Cover Letter)
                  </h3>
                  <p className={`${densityStyles.bodyText} text-slate-800 font-medium whitespace-pre-line`}>
                    {coverLetter}
                  </p>
                </div>
              )}

              {/* Professional Summary */}
              {bio && (
                <div className="printable-section space-y-1">
                  <h3 className={`${densityStyles.sectionHeader} text-black tracking-wider uppercase border-b border-slate-300`}>
                    النبذة المهنية (Professional Summary)
                  </h3>
                  <p className={`${densityStyles.bodyText} text-slate-800 font-medium`}>
                    {bio}
                  </p>
                </div>
              )}

              {/* Work Experiences */}
              <div className="printable-section space-y-1.5">
                <h3 className={`${densityStyles.sectionHeader} text-black tracking-wider uppercase border-b border-slate-300`}>
                  الخبرات العملية وسجل الأعمال السابقة (Work Experience)
                </h3>

                <div className={densityStyles.expSpacing}>
                  {experiences.map((exp: any, idx: number) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`${densityStyles.bodyText} font-black text-black`}>
                          {exp.role} — <span className="font-bold text-slate-700">{exp.company}</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">
                          {exp.duration}
                        </span>
                      </div>

                      <p className={`${densityStyles.bodyText} text-slate-800 font-normal whitespace-pre-line pl-2`}>
                        {exp.tasks}
                      </p>

                      {exp.skills && (
                        <p className="text-[9.5px] print:text-[9px] text-slate-600 font-semibold">
                          المهارات المستخدمة: {exp.skills}
                        </p>
                      )}
                    </div>
                  ))}

                  {experiences.length === 0 && (
                    <p className="text-xs text-slate-400 italic">لم يتم إدراج خبرات سابقة بعد.</p>
                  )}
                </div>
              </div>

              {/* Education */}
              {education && (
                <div className="printable-section space-y-1">
                  <h3 className={`${densityStyles.sectionHeader} text-black tracking-wider uppercase border-b border-slate-300`}>
                    المؤهلات العلمية (Education & Credentials)
                  </h3>
                  <p className={`${densityStyles.bodyText} text-slate-800 font-bold`}>
                    {education}
                  </p>
                </div>
              )}

              {/* Core Competencies & Skills */}
              {skills.length > 0 && (
                <div className="printable-section space-y-1">
                  <h3 className={`${densityStyles.sectionHeader} text-black tracking-wider uppercase border-b border-slate-300`}>
                    المهارات والقدرات الأساسية (Core Competencies)
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {skills.map((s, idx) => (
                      <span
                        key={idx}
                        className={`${densityStyles.badgePadding} rounded bg-slate-100 text-slate-900 font-bold border border-slate-300`}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Languages */}
              {languages.length > 0 && (
                <div className="printable-section space-y-1">
                  <h3 className={`${densityStyles.sectionHeader} text-black tracking-wider uppercase border-b border-slate-300`}>
                    اللغات (Languages)
                  </h3>
                  <div className={`flex flex-wrap ${densityStyles.langGap} text-slate-800 font-medium`}>
                    {languages.map((l: any, idx: number) => (
                      <span key={idx} className="font-bold">
                        {l.name}: <span className="font-normal text-slate-600">{l.level}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ATS Certification Footnote */}
              <div className={`printable-section ${densityStyles.footerText} border-t border-slate-200 flex items-center justify-between text-slate-500 font-bold`}>
                <span>تم إنشاء هذه السيرة وتوثيقها عبر منصة ProLink المهنية</span>
                <span>ATS Compliant Resume • Verified Professional</span>
              </div>
            </div>
          </div>

          {/* Bottom Actions Bar (Not printed) */}
          <div className="shrink-0 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 print:hidden">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95 cursor-pointer"
            >
              إغلاق
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-[#0a66c2] hover:from-blue-700 hover:to-[#08529c] text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Printer size={14} />
              <span>طباعة وتصدير PDF (صفحة واحدة A4)</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
