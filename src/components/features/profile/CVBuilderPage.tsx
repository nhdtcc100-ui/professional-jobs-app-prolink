import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ArrowRight, Printer, CheckCircle2, Sparkles, Plus, Trash2,
  Briefcase, GraduationCap, Languages, Wrench, MapPin, Phone, Mail,
  FileText, Download, Eye, Edit3, Building2, Calendar, Award, Share2,
  Save, Loader2, MessageCircle
} from 'lucide-react';
import { AppUser, WorkExperience } from '../../../types';
import { profileService } from '../../../lib/services/profileService';
import { sanitizeInput } from '../../../lib/security/inputValidator';

interface CVBuilderPageProps {
  appUser: AppUser;
  onBack: () => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  setAppUser?: (user: any) => void;
}

interface LanguageItem {
  id: string;
  name: string;
  level: string;
}

const COMMON_SKILL_SUGGESTIONS = [
  'React', 'TypeScript', 'JavaScript', 'Node.js', 'PostgreSQL', 'Tailwind CSS',
  'إدارة المشاريع', 'خدمة العملاء', 'التسويق الرقمي', 'المبيعات الميدانية',
  'المحاسبة المالية', 'تحليل البيانات', 'Figma', 'UI/UX', 'إدارة الموارد البشرية',
  'Excel متقدم', 'حل المشكلات', 'العمل الجماعي', 'التفاوض والإقناع', 'الأمن السيبراني'
];

const LANGUAGE_LEVELS = [
  'اللغة الأم',
  'طليق / ممتاز (C2/C1)',
  'متقدم (B2)',
  'متوسط (B1)',
  'مبتدئ (A2/A1)'
];

export const CVBuilderPage: React.FC<CVBuilderPageProps> = ({
  appUser,
  onBack,
  addToast,
  setAppUser,
}) => {
  // Mobile tab toggle between editor and preview
  const [activeView, setActiveView] = useState<'editor' | 'preview'>('editor');
  const [isSaving, setIsSaving] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // 0. Resolve saved CV data from database or localStorage
  const savedCvData = (appUser as any)?.cv_data || (appUser as any)?.cvData;

  // 1. Personal & Contact Info
  const [fullName, setFullName] = useState(savedCvData?.name || appUser.name || '');
  const [title, setTitle] = useState(savedCvData?.title || appUser.title || appUser.displayTitle || '');
  const [phone, setPhone] = useState(savedCvData?.phone || appUser.phone || '');
  const [email, setEmail] = useState(savedCvData?.email || appUser.email || '');
  const [location, setLocation] = useState(savedCvData?.location || appUser.location || '');
  const [bio, setBio] = useState(savedCvData?.bio || appUser.bio || '');

  // 2. Education
  const [education, setEducation] = useState(savedCvData?.education || appUser.education || '');

  // 3. Skills
  const [skills, setSkills] = useState<string[]>(() => {
    if (Array.isArray(savedCvData?.skills) && savedCvData.skills.length > 0) return [...savedCvData.skills];
    return Array.isArray(appUser.skills) ? [...appUser.skills] : [];
  });
  const [newSkillInput, setNewSkillInput] = useState('');

  // 4. Languages
  const [languages, setLanguages] = useState<LanguageItem[]>(() => {
    const parseLangItem = (l: any, i: number) => {
      if (typeof l === 'object' && l && l.name) return { id: l.id || `lang-${i}`, name: l.name, level: l.level || 'طليق / ممتاز' };
      const str = String(l || '').trim();
      const parenMatch = str.match(/^(.+?)\s*\((.+?)\)$/);
      if (parenMatch) return { id: `lang-${i}`, name: parenMatch[1].trim(), level: parenMatch[2].trim() };
      const dashMatch = str.split(' - ');
      if (dashMatch.length > 1) return { id: `lang-${i}`, name: dashMatch[0].trim(), level: dashMatch[1].trim() };
      return { id: `lang-${i}`, name: str, level: 'طليق / ممتاز' };
    };

    if (Array.isArray(savedCvData?.languages) && savedCvData.languages.length > 0) {
      return savedCvData.languages.map((l: any, i: number) => parseLangItem(l, i)).filter(Boolean);
    }
    const saved = localStorage.getItem(`prolink_ats_languages_${appUser.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((l: any, i: number) => parseLangItem(l, i)).filter(Boolean);
        }
      } catch (_) {}
    }
    if (Array.isArray(appUser.languages) && appUser.languages.length > 0) {
      return appUser.languages.map((l: any, i: number) => parseLangItem(l, i)).filter(Boolean);
    }
    return [
      { id: 'l-1', name: 'العربية', level: 'اللغة الأم' },
      { id: 'l-2', name: 'الإنجليزية', level: 'متقدم (B2)' }
    ];
  });
  const [newLangName, setNewLangName] = useState('');
  const [newLangLevel, setNewLangLevel] = useState(LANGUAGE_LEVELS[0]);

  // 5. Work Experiences
  const [experiences, setExperiences] = useState<WorkExperience[]>(() => {
    if (Array.isArray(savedCvData?.workExperiences) && savedCvData.workExperiences.length > 0) {
      return [...savedCvData.workExperiences];
    }
    const saved = localStorage.getItem(`prolink_ats_experiences_${appUser.id}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    if (Array.isArray(appUser.workExperiences) && appUser.workExperiences.length > 0) {
      return [...appUser.workExperiences];
    }
    return [
      {
        id: 'exp-1',
        role: title || 'أخصائي مهني',
        company: appUser.companyName || 'شركة رائدة',
        duration: '2023 - حتى الآن',
        tasks: 'قيادة وتنفيذ المهام التخصصية بكفاءة عالية، وتطوير أداء الفريق، وتحقيق أهداف المنشأة وفق أعلى المعايير.',
        skills: 'التخطيط، إدارة الوقت، حل المشكلات'
      }
    ];
  });

  // State for new experience form
  const [expRole, setExpRole] = useState('');
  const [expCompany, setExpCompany] = useState('');
  const [expDuration, setExpDuration] = useState('');
  const [expTasks, setExpTasks] = useState('');
  const [expSkills, setExpSkills] = useState('');
  const [isAddingExp, setIsAddingExp] = useState(false);

  // ── Skill handlers ──
  const handleAddSkill = (skillToAdd?: string) => {
    const target = (skillToAdd || newSkillInput).trim();
    if (!target) return;
    if (skills.some(s => s.toLowerCase() === target.toLowerCase())) {
      addToast('هذه المهارة مضافة بالفعل', 'info');
      return;
    }
    setSkills(prev => [...prev, target]);
    if (!skillToAdd) setNewSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(prev => prev.filter(s => s !== skillToRemove));
  };

  // ── Language handlers ──
  const handleAddLanguage = () => {
    if (!newLangName.trim()) {
      addToast('يرجى إدخال اسم اللغة', 'error');
      return;
    }
    setLanguages(prev => [
      ...prev,
      { id: `lang-${Date.now()}`, name: newLangName.trim(), level: newLangLevel }
    ]);
    setNewLangName('');
    setNewLangLevel(LANGUAGE_LEVELS[1]);
  };

  const handleRemoveLanguage = (id: string) => {
    setLanguages(prev => prev.filter(l => l.id !== id));
  };

  // ── Work experience handlers ──
  const handleAddExperience = () => {
    if (!expRole.trim() || !expCompany.trim()) {
      addToast('يرجى إدخال المسمى الوظيفي واسم الشركة', 'error');
      return;
    }
    const newExp: WorkExperience = {
      id: `exp-${Date.now()}`,
      role: expRole.trim(),
      company: expCompany.trim(),
      duration: expDuration.trim() || 'فترة غير محددة',
      tasks: expTasks.trim() || 'القيام بالمهام والمسؤوليات الموكلة بنجاح.',
      skills: expSkills.trim()
    };
    setExperiences(prev => [newExp, ...prev]);
    setExpRole('');
    setExpCompany('');
    setExpDuration('');
    setExpTasks('');
    setExpSkills('');
    setIsAddingExp(false);
    addToast('تمت إضافة الخبرة بنجاح ✅');
  };

  const handleRemoveExperience = (id: string) => {
    setExperiences(prev => prev.filter(e => e.id !== id));
  };

  // ── Export & Save to all job applications ──
  const handleExportToAllJobs = async () => {
    if (!fullName.trim()) {
      addToast('الاسم الكامل مطلوب لتصدير السيرة', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const formattedLangStrings = languages.map(l => `${l.name} (${l.level})`);

      // Format clean experience summary text
      const formattedExpText = experiences.map(e =>
        `• ${e.role} لدى ${e.company} (${e.duration}):\n  ${e.tasks}${e.skills ? `\n  [المهارات: ${e.skills}]` : ''}`
      ).join('\n\n');

      const fullCVBundle = {
        name: sanitizeInput(fullName, 100),
        title: sanitizeInput(title, 120),
        bio: sanitizeInput(bio, 1000),
        phone: sanitizeInput(phone, 30),
        email: sanitizeInput(email, 120),
        location: sanitizeInput(location, 100),
        education: sanitizeInput(education, 300),
        skills,
        languages: formattedLangStrings,
        languagesList: languages,
        workExperiences: experiences,
        experienceText: formattedExpText,
        updatedAt: new Date().toISOString(),
        isATSVerified: true
      };

      // 1. Save to local storage for instant application auto-filling
      localStorage.setItem(`prolink_ats_cv_${appUser.id}`, JSON.stringify(fullCVBundle));
      localStorage.setItem(`prolink_ats_experiences_${appUser.id}`, JSON.stringify(experiences));
      localStorage.setItem(`prolink_ats_languages_${appUser.id}`, JSON.stringify(languages));

      // 2. Update Supabase profiles table with complete cv_data payload
      const profileUpdates: any = {
        name: fullCVBundle.name,
        title: fullCVBundle.title,
        display_title: fullCVBundle.title,
        bio: fullCVBundle.bio,
        location: fullCVBundle.location,
        education: fullCVBundle.education,
        skills: fullCVBundle.skills,
        experience: fullCVBundle.experienceText,
        cv_data: fullCVBundle,
        cv_template: 'standard_ats',
        cv_updated_at: new Date().toISOString(),
      };

      if (phone) profileUpdates.phone = fullCVBundle.phone;

      const res = await profileService.updateProfile(appUser.id, profileUpdates);
      if (res?.error) {
        console.warn('Profile sync warning:', res.error);
      }

      // 3. Update React context state & localStorage cache
      if (setAppUser) {
        setAppUser((prev: AppUser | null) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            name: fullCVBundle.name,
            title: fullCVBundle.title,
            displayTitle: fullCVBundle.title,
            bio: fullCVBundle.bio,
            location: fullCVBundle.location,
            education: fullCVBundle.education,
            skills: fullCVBundle.skills,
            languages: fullCVBundle.languages,
            workExperiences: fullCVBundle.workExperiences,
            experience: fullCVBundle.experienceText,
            cv_data: fullCVBundle,
            cvData: fullCVBundle,
          };
          try {
            localStorage.setItem('prolink_cached_user', JSON.stringify(updated));
          } catch (_) {}
          return updated;
        });
      }

      // 4. Notify all open views
      window.dispatchEvent(new CustomEvent('prolink_cv_updated', { detail: fullCVBundle }));

      addToast('🎉 تم حفظ وتصدير سيرتك الذاتية المعتمدة (ATS) لجميع الوظائف بنجاح! سيتم إرفاقها تلقائياً مع كل طلب تقديم.', 'success');
    } catch (err: any) {
      console.error('Save ATS CV error:', err);
      addToast('فشل حفظ السيرة الذاتية: ' + (err.message || 'خطأ غير معروف'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const summary = [
      `📄 *السيرة الذاتية المهنية (ATS) المعتمدة - ProLink*`,
      `👤 *الاسم:* ${fullName}`,
      `💼 *المسمى المهني:* ${title}`,
      location ? `📍 *الموقع:* ${location}` : '',
      phone ? `📞 *الهاتف:* ${phone}` : '',
      email ? `✉️ *البريد:* ${email}` : '',
      bio ? `\n📝 *النبذة:*\n${bio}` : '',
      experiences.length > 0 ? `\n🏢 *الخبرات:*\n` + experiences.slice(0, 3).map(e => `• ${e.role} لدى ${e.company} (${e.duration})`).join('\n') : '',
      skills.length > 0 ? `\n🛠️ *المهارات:*\n${skills.slice(0, 6).join(' • ')}` : '',
      languages.length > 0 ? `\n🌐 *اللغات:*\n` + languages.map(l => `${l.name} (${l.level})`).join(' • ') : '',
      `\n🔗 *رابط الملف المهني:* ${window.location.origin}`
    ].filter(Boolean).join('\n');

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(summary)}`;
    window.open(waUrl, '_blank');
    addToast('تم فتح واتساب لمشاركة سيرتك الذاتية 📲', 'success');
  };

  // ── Calculate dynamic content density for responsive 1-page A4 scaling ──
  const contentDensity = useMemo<'compact' | 'normal' | 'spacious'>(() => {
    let score = 0;
    if (bio) score += Math.ceil(bio.length / 90);
    score += (experiences?.length || 0) * 3;
    experiences?.forEach((exp) => {
      if (exp.tasks) score += Math.ceil(exp.tasks.length / 75);
    });
    if (education) score += Math.ceil(education.length / 80) + 1;
    score += Math.ceil((skills?.length || 0) / 4);
    score += Math.ceil((languages?.length || 0) / 3);

    if (score > 13) return 'compact';
    if (score < 8) return 'spacious';
    return 'normal';
  }, [bio, experiences, education, skills, languages]);

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors" dir="rtl">
      {/* ── Top Navigation Bar: Responsive, Clean & Adaptive ── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black transition-all cursor-pointer active:scale-95 shrink-0 shadow-xs"
          >
            <ArrowRight size={15} />
            <span>الرجوع</span>
          </button>

          {/* Title & Badge */}
          <div className="text-center flex-1 min-w-0">
            <h1 className="text-xs sm:text-sm md:text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center justify-center gap-1.5 truncate">
              <span className="truncate">السيرة الذاتية (ATS)</span>
              <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[9px] sm:text-[10px] font-black border border-blue-200 dark:border-blue-800 shrink-0">
                معتمدة ✨
              </span>
            </h1>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              title="مشاركة السيرة الذاتية عبر واتساب"
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
            >
              <MessageCircle size={15} />
              <span className="hidden sm:inline">واتساب</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              title="طباعة أو تصدير PDF"
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">طباعة / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportToAllJobs}
              disabled={isSaving}
              title="حفظ كافة تعديلات السيرة الذاتية وتصديرها للتقديم المباشر"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white text-xs font-black shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
            </button>
          </div>
        </div>

        {/* Mobile View Switcher (Editor vs ATS Preview) */}
        <div className="flex sm:hidden mt-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveView('editor')}
            className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all ${
              activeView === 'editor'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            محرر السيرة
          </button>
          <button
            type="button"
            onClick={() => setActiveView('preview')}
            className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all ${
              activeView === 'preview'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            معاينة ATS
          </button>
        </div>
      </header>

      {/* ── Main Workspace: Split View on Desktop ── */}
      <main className="max-w-7xl mx-auto w-full p-3 sm:p-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 print:block print:p-0 print:m-0 print:max-w-none">
        {/* ── Left / Editor Column (Hidden on mobile if preview tab is active) ── */}
        <div className={`lg:col-span-6 space-y-5 print:hidden cv-editor-column ${activeView === 'preview' ? 'hidden lg:block' : 'block'}`}>
          {/* Card: Personal Info */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileText size={18} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 dark:text-white">البيانات الشخصية والمهنية</h2>
                <p className="text-[11px] font-bold text-slate-400">تظهر في أعلى السيرة لجهات التوظيف</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: أحمد علي"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">المسمى الوظيفي / الاختصاص</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: مهندس برمجيات أول Full-Stack"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">رقم الهاتف للتواصل</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="مثال: 07701234567"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ltr text-right"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ltr text-right"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">الموقع الجغرافي (المدينة / الدولة)</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="مثال: بغداد، الكرادة"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">نبذة مهنية تلخيصية (Professional Summary)</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="اكتب نبذة مهنية تلخص كفاءاتك وسنوات خبرتك وشغفك المهني..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Card: Skills */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Wrench size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-white">المهارات والقدرات التقنية</h2>
                  <p className="text-[11px] font-bold text-slate-400">تساعد خوارزميات ATS في مطابقة ملفك مع الوظائف</p>
                </div>
              </div>
              <span className="text-xs font-black text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30">
                {skills.length} مهارة
              </span>
            </div>

            {/* Add skill input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                placeholder="أضف مهارة جديدة (مثلاً: React, إدارة الوقت)..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => handleAddSkill()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-xs"
              >
                <Plus size={16} />
                <span>إضافة</span>
              </button>
            </div>

            {/* Active Skills Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {skills.map((s, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 group"
                >
                  <span>{s}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(s)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                    title="حذف المهارة"
                  >
                    ×
                  </button>
                </span>
              ))}
              {skills.length === 0 && (
                <p className="text-xs text-slate-400 font-bold py-2">لا توجد مهارات مضافة بعد. أضف مهاراتك من الحقل أعلاه أو من الاقتراحات السريعة.</p>
              )}
            </div>

            {/* Quick Suggestions */}
            <div>
              <p className="text-[11px] font-black text-slate-400 mb-2">اقتراحات سريعة (انقر للإضافة):</p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SKILL_SUGGESTIONS.filter(cs => !skills.includes(cs)).slice(0, 10).map((cs, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddSkill(cs)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/60 dark:border-slate-700/60 transition-all cursor-pointer"
                  >
                    + {cs}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card: Work Experience & Previous Works */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Briefcase size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-white">الأعمال والخبرات السابقة</h2>
                  <p className="text-[11px] font-bold text-slate-400">سجل إنجازاتك وخبراتك الوظيفية بالترتيب</p>
                </div>
              </div>

              {!isAddingExp && (
                <button
                  type="button"
                  onClick={() => setIsAddingExp(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-black transition-all border border-emerald-200 dark:border-emerald-800 cursor-pointer shadow-2xs"
                >
                  <Plus size={14} />
                  <span>إضافة خبرة</span>
                </button>
              )}
            </div>

            {/* Add Experience Form */}
            {isAddingExp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/15 border border-emerald-200 dark:border-emerald-800/80 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-300">إضافة سجل عمل جديد</h4>
                  <button
                    type="button"
                    onClick={() => setIsAddingExp(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    إلغاء
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 mb-1">المسمى الوظيفي *</label>
                    <input
                      type="text"
                      value={expRole}
                      onChange={(e) => setExpRole(e.target.value)}
                      placeholder="مثال: مطور واجهات أمامية"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 mb-1">اسم المنشأة / الشركة *</label>
                    <input
                      type="text"
                      value={expCompany}
                      onChange={(e) => setExpCompany(e.target.value)}
                      placeholder="مثال: شركة آسياسيل"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 mb-1">الفترة الزمنية</label>
                    <input
                      type="text"
                      value={expDuration}
                      onChange={(e) => setExpDuration(e.target.value)}
                      placeholder="مثال: 2022 - 2024"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 mb-1">المهارات المكتسبة / المستخدمة</label>
                    <input
                      type="text"
                      value={expSkills}
                      onChange={(e) => setExpSkills(e.target.value)}
                      placeholder="مثال: React, Tailwind, Git"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 mb-1">المهام والمسؤوليات والإنجازات</label>
                    <textarea
                      rows={2}
                      value={expTasks}
                      onChange={(e) => setExpTasks(e.target.value)}
                      placeholder="اذكر أهم المهام والإنجازات التي حققتها خلال عملك..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingExp(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleAddExperience}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer"
                  >
                    حفظ الخبرة
                  </button>
                </div>
              </motion.div>
            )}

            {/* List of existing experiences */}
            <div className="space-y-3">
              {experiences.map((exp) => (
                <div
                  key={exp.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 relative group"
                >
                  <button
                    type="button"
                    onClick={() => handleRemoveExperience(exp.id)}
                    className="absolute top-3.5 left-3.5 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all cursor-pointer"
                    title="حذف هذا السجل"
                  >
                    <Trash2 size={15} />
                  </button>

                  <div className="pr-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">{exp.role}</h4>
                      <span className="text-[10px] text-slate-400 font-bold">@ {exp.company}</span>
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black mt-0.5">{exp.duration}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-2 leading-relaxed whitespace-pre-line">{exp.tasks}</p>
                    {exp.skills && (
                      <p className="text-[10px] text-slate-400 font-bold mt-2">
                        المهارات: <span className="text-slate-700 dark:text-slate-300">{exp.skills}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {experiences.length === 0 && (
                <p className="text-xs text-slate-400 font-bold text-center py-4">
                  لم تضف أية أعمال سابقة بعد. انقر على «إضافة خبرة» للبدء.
                </p>
              )}
            </div>
          </div>

          {/* Card: Languages & Education */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Languages size={18} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 dark:text-white">اللغات والمؤهلات العلمية</h2>
                <p className="text-[11px] font-bold text-slate-400">اللغات المتقنة والمستوى والشهادات الأكاديمية</p>
              </div>
            </div>

            {/* Languages Section */}
            <div className="space-y-3">
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300">اللغات المتقنة</label>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newLangName}
                  onChange={(e) => setNewLangName(e.target.value)}
                  placeholder="اسم اللغة (مثال: الألمانية، الكردية)..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                />
                <select
                  value={newLangLevel}
                  onChange={(e) => setNewLangLevel(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                >
                  {LANGUAGE_LEVELS.map((lvl, i) => (
                    <option key={i} value={lvl}>{lvl}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddLanguage}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-xs cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus size={14} />
                  <span>إضافة</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {languages.map((l) => (
                  <span
                    key={l.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 text-xs font-bold border border-amber-200 dark:border-amber-800/60"
                  >
                    <span>{l.name}</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">({l.level})</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLanguage(l.id)}
                      className="text-amber-400 hover:text-red-500 transition-colors p-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Education Section */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                المؤهل الأكاديمي والتعليم (Education)
              </label>
              <input
                type="text"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                placeholder="مثال: بكالوريوس هندسة حاسبات - جامعة بغداد (2020)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              />
            </div>

            {/* 💾 Save Changes Action Card (Always visible at bottom of editor) */}
            <div className="pt-5 border-t border-slate-200 dark:border-slate-700 space-y-2">
              <button
                type="button"
                onClick={handleExportToAllJobs}
                disabled={isSaving}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>جاري حفظ السيرة الذاتية في قاعدة البيانات...</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>حفظ التعديلات واعتماد السيرة الذاتية (ATS)</span>
                  </>
                )}
              </button>
              <p className="text-center text-[10px] text-slate-400 font-bold">
                💡 يتم حفظ التعديلات فوراً في ملفك الشخصي وتطبيقها تلقائياً على كل طلبات التقديم للوظائف.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right / ATS Preview Column (Always visible on desktop, or when activeView==='preview' on mobile) ── */}
        <div className={`lg:col-span-6 space-y-4 print:w-full print:p-0 print:m-0 print:block ${activeView === 'editor' ? 'hidden lg:block' : 'block'}`}>
          <div className="flex items-center justify-between px-1 print:hidden">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Eye size={15} className="text-blue-600 dark:text-blue-400" />
              <span>المعاينة الحية للسيرة بنظام ATS القياسي</span>
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              جاهز للطباعة والتقديم المباشر
            </span>
          </div>

          {/* 📄 Paper ATS Document Card ── Pure Black & White ATS standard with Adaptive Density ── */}
          <div
            ref={printAreaRef}
            className={`printable-cv-area w-full bg-white text-black ${densityStyles.container} rounded-[2rem] shadow-xl border border-slate-300/80 dark:border-slate-700 print:shadow-none print:border-none print:p-0 print:m-0`}
            style={{ color: '#000000', backgroundColor: '#ffffff' }}
          >
            {/* Header: Name & Contact Details */}
            <div className={`printable-section border-b-2 border-black ${densityStyles.headerPad} text-center`}>
              <h1 className={`${densityStyles.titleSize} font-black tracking-tight text-black uppercase`}>
                {fullName || 'الاسم الكامل للمرشح'}
              </h1>
              <p className={`${densityStyles.subtitleSize} font-bold text-slate-800 tracking-wide`}>
                {title || 'المسمى الوظيفي والتخصص المهني'}
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
                {experiences.map((exp, idx) => (
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
                  {languages.map((l, idx) => (
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
      </main>

      {/* Floating Save Button on Mobile Editor View */}
      {activeView === 'editor' && (
        <div className="sm:hidden fixed bottom-4 left-4 right-4 z-40 print:hidden pointer-events-auto">
          <button
            type="button"
            onClick={handleExportToAllJobs}
            disabled={isSaving}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 active:scale-95 transition-all cursor-pointer disabled:opacity-50 border border-blue-400/30 backdrop-blur-md"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{isSaving ? 'جاري الحفظ...' : '💾 حفظ التعديلات الآن'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
