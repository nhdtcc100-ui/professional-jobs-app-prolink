import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Download, CheckCircle, XCircle, Clock, Search, ExternalLink,
  User, Briefcase, FileSpreadsheet, Calendar, MessageCircle, Mail,
  RotateCcw, Trash2, MapPin, Globe, Sparkles, DollarSign, MessageSquare,
  Loader2, Star, StickyNote, ArrowRight, ChevronUp, ChevronDown, Phone, Eye
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { AppUser } from '../../../types';
import { sanitizeInput } from '../../../lib/utils/sanitize';
import { GlassCard, CloseButton } from '../../ui';
import { useAppContext } from '../../../contexts/AppContext';
import { EmployeeOnboardingModal } from '../erp/EmployeeOnboardingModal';
import { AIEvaluationModal } from './AIEvaluationModal';
interface ApplicantData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  title?: string;
  companyName?: string;
  industry?: string;
  experience?: string;
  education?: string;
  skills?: string | string[];
  avatar?: string;
  cvUrl?: string;
  cv_url?: string;
  prevWorks?: any[];
  bio?: string;
  id?: string;
}

interface JobApplication {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  applicant_id?: string;
  applicant_data?: ApplicantData;
  cover_letter?: string;
  cv_url?: string;
  jobTitle?: string;
  job?: {
    title: string;
  };
  jobs?: {
    title: string;
  };
}

// ─── Professional Excel Export (HTML based .xls) ─────────────────────────────
function exportToExcel(apps: JobApplication[], label: string, addToast: (msg: string, type?: any) => void, allUsers: AppUser[]) {
  try {
    const ERP_HEADERS = [
      '\u0627\u0644\u0631\u0642\u0645',
      '\u0627\u0644\u0627\u0633\u0645\u0020\u0627\u0644\u0643\u0627\u0645\u0644',
      '\u0627\u0644\u0628\u0631\u064a\u062f\u0020\u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
      '\u0631\u0642\u0645\u0020\u0627\u0644\u0647\u0627\u062a\u0641',
      '\u0627\u0644\u0645\u0648\u0642\u0639\u0020\u0627\u0644\u062c\u063a\u0631\u0627\u0641\u064a',
      '\u0627\u0644\u0645\u0633\u0645\u0649\u0020\u0627\u0644\u062d\u0627\u0644\u064a',
      '\u0627\u0644\u0634\u0631\u0643\u0629\u0020\u0627\u0644\u062d\u0627\u0644\u064a\u0629',
      '\u0627\u0644\u0635\u0646\u0627\u0639\u0629',
      '\u0633\u0646\u0648\u0627\u062a\u0020\u0627\u0644\u062e\u0628\u0631\u0629',
      '\u0627\u0644\u062a\u0631\u0628\u064a\u0629\u0020\u0648\u0627\u0644\u062a\u0639\u0644\u064a\u0645',
      '\u0627\u0644\u0645\u0647\u0627\u0631\u0627\u062a',
      '\u0627\u0644\u0646\u0628\u0630\u0629\u0020\u0627\u0644\u0634\u062e\u0635\u064a\u0629',
      '\u0633\u062c\u0644\u0020\u0627\u0644\u062e\u0628\u0631\u0627\u062a\u0020\u0627\u0644\u062a\u0641\u0635\u064a\u0644\u064a',
      '\u0627\u0644\u0648\u0638\u064a\u0641\u0629\u0020\u0627\u0644\u0645\u062a\u0642\u062f\u0645\u0020\u0644\u0647\u0627',
      '\u0631\u0627\u0628\u0637\u0020\u0627\u0644\u0633\u064a\u0631\u0629\u0020\u0627\u0644\u0630\u0627\u062a\u064a\u0629',
      '\u0627\u0644\u062d\u0627\u0644\u0629',
      '\u062a\u0627\u0631\u064a\u062e\u0020\u0627\u0644\u062a\u0642\u062f\u064a\u0645',
    ];

    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; direction: rtl; font-family: 'Segoe UI', Arial, sans-serif; }
          th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; padding: 15px; border: 1px solid #e2e8f0; text-align: right; font-size: 14px; }
          td { padding: 12px; border: 1px solid #e2e8f0; text-align: right; vertical-align: top; font-size: 12px; color: #334155; }
          .header-row { background-color: #f1f5f9; }
          .row-even { background-color: #f8fafc; }
          .status-approved { color: #16a34a; font-weight: bold; }
          .status-rejected { color: #dc2626; font-weight: bold; }
          .status-pending { color: #d97706; font-weight: bold; }
          .job-title { color: #0a66c2; font-weight: bold; }
          .cv-link { color: #2563eb; text-decoration: underline; }
        </style>
      </head>
      <body>
        <h2 style="color: #1e3a8a; font-family: sans-serif;">تقرير Elevate عراق الاحترافي لإدارة الكفاءات - ${label}</h2>
        <p style="color: #64748b; font-size: 12px;">تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}</p>
        <table border="1">
          <thead>
            <tr>${ERP_HEADERS.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
    `;

    apps.forEach((app, idx) => {
      // Find full profile from allUsers to ensure complete data
      const fullProfile = allUsers.find(u => u.id === app.applicant_id);
      const a = { ...(app.applicant_data || {}), ...(fullProfile || {}) };

      const skills = Array.isArray(a.skills) ? a.skills.join(' • ') : (a.skills || '');
      const statusText = app.status === 'approved' ? 'مقبول' : app.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة';
      const statusClass = app.status === 'approved' ? 'status-approved' : app.status === 'rejected' ? 'status-rejected' : 'status-pending';
      const rowClass = idx % 2 === 0 ? 'row-even' : '';

      // Format career history (prevWorks)
      let careerHistory = '-';
      if (a.prevWorks && Array.isArray(a.prevWorks)) {
        careerHistory = a.prevWorks.map((w: any) =>
          `[${w.company || w.companyName}: ${w.role || w.title} | الراتب: ${w.salary || 'غير محدد'} | المهام: ${w.tasks || '-'}]`
        ).join('\n');
      }

      const cvUrl = app.cv_url || a.cvUrl || a.cv_url || '-';
      const jobTitle = app.jobTitle || app.jobs?.title || app.job?.title || 'وظيفة غير معروفة';

      tableHtml += `
        <tr class="${rowClass}">
          <td>${idx + 1}</td>
          <td><b>${a.name || '-'}</b></td>
          <td>${a.email || '-'}</td>
          <td>${a.phone || '-'}</td>
          <td>${a.location || '-'}</td>
          <td>${a.title || '-'}</td>
          <td>${a.companyName || '-'}</td>
          <td>${a.industry || '-'}</td>
          <td>${a.experience || '-'}</td>
          <td>${a.education || '-'}</td>
          <td>${skills}</td>
          <td>${a.bio || a.experience || '-'}</td>
          <td style="white-space: pre-wrap;">${careerHistory}</td>
          <td class="job-title">${jobTitle}</td>
          <td>${cvUrl !== '-' ? `<a href="${cvUrl}" class="cv-link">فتح السيرة الذاتية</a>` : '-'}</td>
          <td class="${statusClass}">${statusText}</td>
          <td>${new Date(app.created_at).toLocaleDateString('ar-EG')}</td>
        </tr>
      `;
    });

    tableHtml += `</tbody></table></body></html>`;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `Elevate_Iraq_ERP_Report_${label}_${date}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast(`✅ تم تصدير التقرير الشامل بنجاح`);
  } catch (e) {
    console.error('Export Error:', e);
    addToast('فشل التصدير', 'error');
  }
}

interface ApplicationsListViewProps {
  incomingApplications: JobApplication[];
  isSentView?: boolean;
  handleApplicationAction: (appId: string, jobTitle: string, status: 'approved' | 'rejected' | 'pending') => Promise<void>;
  onDeleteApplication: (appId: string) => Promise<void>;
  addToast: (msg: string, type?: any) => void;
  appUser: AppUser | null;
}

// ── Error Boundary for ApplicationsListView ──
class ApplicationsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('ApplicationsListView crashed:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 dark:bg-red-950/30 rounded-3xl border border-red-200 dark:border-red-800/40 text-center space-y-4">
          <p className="text-sm font-black text-red-600 dark:text-red-400">حدث خطأ أثناء عرض الطلبات</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl"
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ApplicationsListView(props: ApplicationsListViewProps) {
  return (
    <ApplicationsErrorBoundary>
      <ApplicationsListViewContent {...props} />
    </ApplicationsErrorBoundary>
  );
}

function ApplicationsListViewContent({
  incomingApplications = [],
  isSentView = false,
  handleApplicationAction,
  onDeleteApplication,
  addToast,
  appUser,
}: ApplicationsListViewProps) {
  const { setActiveTab, setSelectedChat, allUsers = [], activeTab } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selectedAppIndex, setSelectedAppIndex] = useState<number | null>(null);
  const [highlightedAppId, setHighlightedAppId] = useState<string | null>(null);
  const detailContainerRef = React.useRef<HTMLDivElement>(null);
  const [ratingFilter, setRatingFilter] = useState<number>(0); // 0 = all

  // 🛡️ Keep-Alive guard: close the fixed z-[300] overlay when user navigates away.
  // Because MissionsView uses CSS `hidden` (not unmount), this component stays in
  // DOM and the full-screen overlay keeps blocking touches on every other tab.
  useEffect(() => {
    if (activeTab !== 'jobs' && selectedAppIndex !== null) {
      setSelectedAppIndex(null);
      try { document.body.style.overflow = ''; } catch (_) {}
    }
  }, [activeTab, selectedAppIndex]);

  // 🛡️ Always ensure body scrolling is restored on unmount or navigation
  useEffect(() => {
    return () => {
      setSelectedAppIndex(null);
      try {
        document.body.style.overflow = '';
      } catch (_) {}
    };
  }, []);

  // 🛡️ Mobile & Browser Back-Button Handling for Applicant Detail View
  useEffect(() => {
    if (selectedAppIndex !== null) {
      window.history.pushState({ modal: 'applicant-detail' }, '');
      const handlePop = () => {
        setSelectedAppIndex(null);
      };
      window.addEventListener('popstate', handlePop);
      return () => {
        window.removeEventListener('popstate', handlePop);
      };
    }
  }, [selectedAppIndex]);

  // Safe zero-freeze direct CV open & download helpers (100% Native - No iframes, No modals, Popup-blocker resistant)
  const handleOpenApplicantCV = async (cvUrl: string, name?: string) => {
    if (!cvUrl) {
      addToast('لا يوجد ملف سيرة ذاتية مرفق لهذا الطلب', 'error');
      return;
    }

    if (cvUrl.startsWith('blob:') || cvUrl.startsWith('data:') || cvUrl.includes('/storage/v1/object/public/')) {
      window.open(cvUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // فتح نافذة متزامنة فوراً لتثبيت إذن المتصفح وتجنب الحظر في المرات المتكررة
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.opener = null;
      try {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html dir="rtl">
            <head><title>معاينة السيرة الذاتية - ${name || ''}</title><meta charset="utf-8"></head>
            <body style="background:#0f172a;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
              <div style="text-align:center;">
                <div style="width:36px;height:36px;border:3px solid #1e293b;border-top-color:#38bdf8;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px;"></div>
                <p style="font-size:15px;font-weight:bold;color:#f1f5f9;margin:0 0 6px;">جاري فتح السيرة الذاتية لـ ${name || 'المتقدم'}...</p>
                <p style="font-size:12px;color:#64748b;margin:0;">يرجى الانتظار ثوانٍ معدودة</p>
              </div>
              <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            </body>
          </html>
        `);
      } catch (_) {}
    }

    try {
      let finalUrl = cvUrl;
      const markers = [
        { marker: '/storage/v1/object/sign/resumes/', bkt: 'resumes' },
        { marker: '/storage/v1/object/sign/applications/', bkt: 'applications' },
        { marker: '/resumes/', bkt: 'resumes' },
        { marker: '/applications/', bkt: 'applications' },
      ];
      for (const { marker, bkt } of markers) {
        if (cvUrl.includes(marker)) {
          const path = decodeURIComponent(cvUrl.split(marker)[1]?.split('?')[0] || '');
          if (path) {
            try {
              const { data } = await supabase.storage.from(bkt).createSignedUrl(path, 300);
              if (data?.signedUrl) finalUrl = data.signedUrl;
            } catch (_) {}
          }
          break;
        }
      }

      if (newWindow && !newWindow.closed) {
        newWindow.location.href = finalUrl;
      } else {
        const a = document.createElement('a');
        a.href = finalUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (_) {
      if (newWindow && !newWindow.closed) {
        newWindow.location.href = cvUrl;
      } else {
        window.open(cvUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleDownloadApplicantCV = async (cvUrl: string, name?: string) => {
    if (!cvUrl) return;
    try {
      const a = document.createElement('a');
      a.href = cvUrl;
      a.target = '_blank';
      a.download = `CV_${name || 'applicant'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (_) {
      window.open(cvUrl, '_blank');
    }
  };

  // Helper to reliably retrieve complete applicant profile
  const resolveApplicant = (app: JobApplication) => {
    const profile = (app as any).applicant || allUsers.find(u => u.id === app.applicant_id);
    const data = app.applicant_data || {};
    return {
      ...(profile || {}),
      ...data,
      name: data.name || (app as any).applicantName || profile?.name || (profile as any)?.full_name || 'متقدم',
      avatar: data.avatar || profile?.avatar || (profile as any)?.avatar_url || '',
      phone: data.phone || profile?.phone || '',
      email: data.email || profile?.email || '',
      location: data.location || profile?.location || '',
      title: data.title || profile?.title || (profile as any)?.job_title || (profile as any)?.headline || '',
      bio: data.bio || profile?.bio || '',
      cvUrl: app.cv_url || data.cvUrl || data.cv_url || profile?.cvUrl || (profile as any)?.cv_url || '',
    };
  };

  // ── Rating system (localStorage) ─────────────────────────────────────
  const getRatings = (): Record<string, number> => {
    try { return JSON.parse(localStorage.getItem('prolink_app_ratings') || '{}'); } catch { return {}; }
  };
  const getNotes = (): Record<string, string> => {
    try { return JSON.parse(localStorage.getItem('prolink_app_notes') || '{}'); } catch { return {}; }
  };
  const [ratings, setRatings] = useState<Record<string, number>>(getRatings);
  const [notes, setNotes] = useState<Record<string, string>>(getNotes);
  const [showNotesFor, setShowNotesFor] = useState<string | null>(null);

  // ── Return to specific applicant in the list & auto-scroll ─────────────
  const handleReturnToApplicant = (index?: number) => {
    const targetIdx = index !== undefined ? index : (selectedAppIndex ?? 0);
    const targetApp = filteredApps[targetIdx];
    setSelectedAppIndex(null);
    setShowScheduler(false);

    if (targetApp) {
      setHighlightedAppId(targetApp.id);
      setTimeout(() => {
        const el = document.getElementById(`app-card-${targetApp.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);

      setTimeout(() => {
        setHighlightedAppId(null);
      }, 3500);
    }
  };

  const setRating = (appId: string, rating: number) => {
    const next = { ...(ratings || {}), [appId]: rating };
    setRatings(next);
    localStorage.setItem('prolink_app_ratings', JSON.stringify(next));
  };

  const saveNote = (appId: string, note: string) => {
    const next = { ...(notes || {}), [appId]: note };
    setNotes(next);
    localStorage.setItem('prolink_app_notes', JSON.stringify(next));
  };

  // Interview Scheduler State
  const [showScheduler, setShowScheduler] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [showAIEval, setShowAIEval] = useState(false);
  const [appForAI, setAppForAI] = useState<JobApplication | null>(null);

  const safeApps = Array.isArray(incomingApplications) ? incomingApplications : [];

  const filteredApps = safeApps.filter(app => {
    if (!app) return false;
    const name = (app.applicant_data?.name || (app as any).applicantName || '').toLowerCase();
    const title = (app.job?.title || app.jobs?.title || (app as any).jobTitle || '').toLowerCase();
    const query = (searchQuery || '').toLowerCase();
    const matchesSearch = !query || name.includes(query) || title.includes(query);
    const matchesStatus = app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedApp = selectedAppIndex !== null && filteredApps[selectedAppIndex] ? filteredApps[selectedAppIndex] : null;

  // Snap Scroll Navigation for detail view
  useEffect(() => {
    if (selectedAppIndex !== null) {
      const el = document.getElementById(`app-detail-item-${selectedAppIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    }
  }, [selectedAppIndex]);

  // Automatically mark currently opened applicant as seen
  useEffect(() => {
    if (selectedAppIndex !== null && filteredApps[selectedAppIndex] && appUser?.id) {
      const currentId = filteredApps[selectedAppIndex].id;
      try {
        const raw = localStorage.getItem(`prolink_seen_apps_${appUser.id}`);
        const set = raw ? new Set(JSON.parse(raw)) : new Set<string>();
        if (!set.has(currentId)) {
          set.add(currentId);
          localStorage.setItem(`prolink_seen_apps_${appUser.id}`, JSON.stringify(Array.from(set)));
          window.dispatchEvent(new Event('prolink_seen_apps_updated'));
        }
      } catch (_) {}
    }
  }, [selectedAppIndex, filteredApps, appUser?.id]);

  const scrollToApp = (index: number) => {
    if (index < 0 || index >= filteredApps.length) return;
    setSelectedAppIndex(index);
    if (detailContainerRef.current) {
      detailContainerRef.current.scrollTo({
        top: 0,
        behavior: 'instant'
      });
    }
  };

  const handleScheduleInterview = async () => {
    if (!interviewDate || !interviewTime || !appUser || !selectedApp) {
      addToast('يرجى تحديد التاريخ والوقت أولاً', 'error');
      return;
    }

    const phone = selectedApp.applicant_data?.phone || '';
    const name = selectedApp.applicant_data?.name || (selectedApp as any).applicantName || 'متقدمنا العزيز';
    const jobTitle = selectedApp.job?.title || selectedApp.jobs?.title || (selectedApp as any).jobTitle || 'الوظيفة';

    // 📨 1. Internal Message (Professional Card Template)
    const professionalMessage = `
🗓️ **دعوة رسمية لمقابلة عمل**

عزيزي/تـي **${name}**،
يسرنا إبلاغك بأنه قد تم ترشيحك لإجراء مقابلة عمل لوظيفة **"${jobTitle}"** في شركتنا، وذلك بناءً على تميز سيرتك الذاتية.

📍 **تفاصيل الموعد:**
- **التاريخ:** ${interviewDate}
- **الوقت:** ${interviewTime}

نحن بانتظار حضورك في الوقت المحدد لمناقشة فرص انضمامك لفريقنا المتميز. 
يرجى تأكيد استلامك لهذه الدعوة.

تمنياتنا لك بالتوفيق والنجاح.
    `.trim();

    try {
      if (selectedApp.applicant_id) {
        await (supabase.from('messages') as any).insert([{
          sender_id: appUser.id,
          receiver_id: selectedApp.applicant_id,
          content: professionalMessage
        }]);
      }

      // 🚀 Update status in Database silently and professionally
      await handleApplicationAction(selectedApp.id, jobTitle, 'approved');

      setShowScheduler(false);
      addToast('✅ تم قبول الطلب وتحديد موعد المقابلة بنجاح');
    } catch (err: any) {
      addToast('فشل في حفظ موعد المقابلة: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Filter Area */}
      {/* Header & Control Area (White Theme Horizontal Bars) */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-5 transition-colors">
        
        {/* Title Row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white">طلبات التوظيف</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              إدارة وتنظيم {incomingApplications.length} طلب تقديم
            </p>
          </div>
          <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black border border-blue-100 dark:border-blue-800/40">
            {statusFilter === 'pending' ? `قيد المراجعة (${filteredApps.length})` : statusFilter === 'approved' ? `المقبولين (${filteredApps.length})` : `المرفوضين (${filteredApps.length})`}
          </span>
        </div>

        {/* ── BAR 1 (Upper Horizontal Bar): Filter Tabs ── */}
        <div className="space-y-1.5">
          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">تصفية الحالات:</p>
          <div className="flex gap-2 items-center flex-wrap w-full overflow-x-auto pb-1">
            {[
              { id: 'pending', label: 'قيد المراجعة' },
              { id: 'approved', label: 'المقبولين' },
              { id: 'rejected', label: 'المرفوضين' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as any)}
                className={`flex-1 sm:flex-none min-w-[90px] text-center px-5 py-2.5 rounded-2xl text-[11px] font-black transition-all ${
                  statusFilter === f.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── BAR 2 (Lower Horizontal Bar): Excel Export Buttons ── */}
        {!isSentView && (
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">تصدير وتقارير الإكسل:</p>
            <div className="flex gap-2 items-center flex-wrap w-full">
              <button
                onClick={() => exportToExcel(incomingApplications, 'الكل', addToast, allUsers)}
                disabled={incomingApplications.length === 0}
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl text-[11px] font-black border border-blue-100 dark:border-blue-800/50 hover:bg-blue-100 transition-all disabled:opacity-50 shadow-sm"
              >
                <Download size={14} /> إكسل للكل
              </button>
              <button
                onClick={() => exportToExcel(incomingApplications.filter(a => a.status === 'approved'), 'المقبولين', addToast, allUsers)}
                disabled={incomingApplications.filter(a => a.status === 'approved').length === 0}
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl text-[11px] font-black border border-emerald-100 dark:border-emerald-800/50 hover:bg-emerald-100 transition-all disabled:opacity-50 shadow-sm"
              >
                <Download size={14} /> المقبولين
              </button>
              <button
                onClick={() => exportToExcel(incomingApplications.filter(a => a.status === 'rejected'), 'المرفوضين', addToast, allUsers)}
                disabled={incomingApplications.filter(a => a.status === 'rejected').length === 0}
                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl text-[11px] font-black border border-red-100 dark:border-red-800/50 hover:bg-red-100 transition-all disabled:opacity-50 shadow-sm"
              >
                <Download size={14} /> المرفوضين
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative pt-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
          <input
            type="text"
            placeholder="ابحث باسم المتقدم أو المسمى الوظيفي..."
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-blue-50/50 dark:focus:ring-blue-900/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(sanitizeInput(e.target.value))}
          />
        </div>
      </div>


      {/* Vertical Single-Column List of Applicant Cards */}
      <div className="flex flex-col space-y-4 w-full">

        <AnimatePresence mode="popLayout">
          {filteredApps.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-20 text-center bg-white/50 dark:bg-slate-800/50 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-700">
              <FileText className="mx-auto text-slate-200 dark:text-slate-600 mb-4" size={48} />
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500">لا توجد طلبات مطابقة حالياً</p>
            </motion.div>
          ) : filteredApps.map((app, i) => {
            const isHighlighted = highlightedAppId === app.id;
            return (
              <motion.div
                key={app.id}
                id={`app-card-${app.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                layout
                className="scroll-mt-24 transition-all duration-300"
              >
                <GlassCard className={`p-5 rounded-[2.2rem] transition-all duration-300 group relative overflow-hidden ${
                  isHighlighted
                    ? 'ring-4 ring-blue-500/80 border-blue-500 shadow-2xl shadow-blue-500/30 scale-[1.01] bg-blue-50/70 dark:bg-blue-950/50'
                    : 'border border-white dark:border-slate-700 shadow-sm hover:shadow-xl hover:translate-y-[-4px] bg-white/90 dark:bg-slate-800/90'
                }`}>
                  {isHighlighted && (
                    <div className="absolute top-2 left-2 z-20 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-[9px] font-black shadow-lg flex items-center gap-1.5 animate-bounce">
                      <Sparkles size={11} className="text-amber-300" />
                      <span>المتقدم المعروض حالياً 📍</span>
                    </div>
                  )}
                  {(() => {
                    const resolved = resolveApplicant(app);
                    return (
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <img
                            src={resolved.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolved.name || 'U')}&background=0a66c2&color=fff`}
                            className={`w-14 h-14 rounded-2xl object-cover shadow-md border-2 transition-all ${isHighlighted ? 'border-blue-500 scale-105' : 'border-white dark:border-slate-700'}`}
                            alt=""
                          />
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-slate-700 flex items-center justify-center shadow-sm ${app.status === 'approved' ? 'bg-emerald-500' :
                            app.status === 'rejected' ? 'bg-red-500' :
                              'bg-amber-500'
                          }`}>
                          {app.status === 'approved' ? <CheckCircle size={10} className="text-white" /> :
                            app.status === 'rejected' ? <XCircle size={10} className="text-white" /> :
                              <Clock size={10} className="text-white" />}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-sm font-black text-slate-800 dark:text-white truncate">
                              {isSentView ? (app.jobTitle || app.jobs?.title || 'وظيفة مهنية') : resolved.name}
                            </h3>
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mb-1 flex items-center gap-1">
                              <Briefcase size={10} /> {isSentView ? ((app as any).company || (app.jobs as any)?.company || 'الشركة المعلنة') : (app.jobTitle || app.jobs?.title || app.job?.title)}
                            </p>

                        {/* Status badge for sent applications */}
                        {isSentView && (
                          <div className="mt-1.5 mb-1 flex items-center gap-1.5 flex-wrap">
                            {app.status === 'approved' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl text-[10px] font-black">
                                <CheckCircle size={12} /> تم قبول طلبك بنجاح 🎉
                              </span>
                            )}
                            {app.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 rounded-xl text-[10px] font-black">
                                <XCircle size={12} /> تم الاعتذار عن الطلب 😔
                              </span>
                            )}
                            {(!app.status || app.status === 'pending') && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-xl text-[10px] font-black">
                                <Clock size={12} /> قيد المراجعة والانتظار ⏳
                              </span>
                            )}
                          </div>
                        )}

                        {/* ⭐ Star Rating - Employer view only */}
                        {!isSentView && (
                          <div className="flex items-center gap-0.5 mb-2">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                onClick={(e) => { e.stopPropagation(); setRating(app.id, star); }}
                                className="p-0.5 transition-transform hover:scale-125 active:scale-95"
                              >
                                <Star
                                  size={12}
                                  className={star <= (ratings[app.id] || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-600'}
                                />
                              </button>
                            ))}
                            {ratings[app.id] > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowNotesFor(showNotesFor === app.id ? null : app.id); }}
                                className={`mr-1 p-0.5 rounded transition-all ${notes[app.id] ? 'text-blue-500' : 'text-slate-300 hover:text-blue-400'}`}
                                title="ملاحظة خاصة"
                              >
                                <StickyNote size={11} />
                              </button>
                            )}
                          </div>
                        )}
                        {/* Notes input */}
                        {!isSentView && (
                          <AnimatePresence>
                            {showNotesFor === app.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="mb-2 overflow-hidden"
                              >
                                <textarea
                                  autoFocus
                                  defaultValue={notes[app.id] || ''}
                                  onBlur={(e) => saveNote(app.id, e.target.value)}
                                  placeholder="أضف ملاحظة خاصة..."
                                  className="w-full text-[10px] font-bold bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                                  rows={2}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold whitespace-nowrap">
                        {new Date(app.created_at).toLocaleDateString('ar-EG')}
                      </span>
                    </div>

                    {isSentView ? (
                      <div className="flex items-center gap-2 mt-3">
                        {app.status === 'approved' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetEmployer = allUsers.find(u => u.id === (app as any).employer_id);
                              if (targetEmployer) {
                                setSelectedChat(targetEmployer);
                                setActiveTab('messages');
                              } else {
                                addToast('يمكنك التواصل مع الشركة عبر صفحة الوظيفة أو الرسائل', 'info');
                              }
                            }}
                            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95"
                          >
                            <MessageSquare size={13} /> محادثة صاحب العمل
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('هل أنت متأكد من سحب هذا الطلب؟')) {
                              onDeleteApplication(app.id);
                            }
                          }}
                          className="py-2.5 px-4 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-xl text-[10px] font-black hover:bg-red-100 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Trash2 size={13} /> سحب الطلب
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => {
                            const idx = filteredApps.findIndex(a => a.id === app.id);
                            setSelectedAppIndex(idx >= 0 ? idx : 0);
                            setShowScheduler(false);
                            if (appUser?.id) {
                              try {
                                const raw = localStorage.getItem(`prolink_seen_apps_${appUser.id}`);
                                const set = raw ? new Set(JSON.parse(raw)) : new Set<string>();
                                set.add(app.id);
                                localStorage.setItem(`prolink_seen_apps_${appUser.id}`, JSON.stringify(Array.from(set)));
                                window.dispatchEvent(new Event('prolink_seen_apps_updated'));
                              } catch (_) {}
                            }
                          }}
                          className="flex-[2] py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-[10px] font-black hover:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-sm border border-transparent dark:border-slate-700 active:scale-95"
                        >
                          <User size={12} /> التفاصيل
                        </button>

                        {/* Quick Actions */}
                        <div className="flex gap-1.5">
                          {app.status === 'approved' ? (
                            <motion.button
                              whileHover={{ scale: 1.1, y: -2 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const targetUser = allUsers.find(u => u.id === app.applicant_id);
                                if (targetUser) {
                                  setSelectedChat(targetUser);
                                  setActiveTab('messages');
                                } else {
                                  addToast('لم يتم العثور على حساب المتقدم', 'error');
                                }
                              }}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/40 transition-all"
                              title="دردشة فورية"
                            >
                              <MessageSquare size={16} />
                            </motion.button>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.1, y: -2 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApplicationAction(app.id, app.job?.title || app.jobs?.title || app.jobTitle || 'وظيفة', 'approved');
                              }}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 hover:bg-emerald-500 hover:text-white transition-all"
                              title="قبول الطلب"
                            >
                              <CheckCircle size={16} />
                            </motion.button>
                          )}

                          <motion.button
                            whileHover={{ scale: 1.1, y: -2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (app.status !== 'rejected') {
                                handleApplicationAction(app.id, app.job?.title || app.jobs?.title || app.jobTitle || 'وظيفة', 'rejected');
                              }
                            }}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${app.status === 'rejected'
                                ? 'bg-red-500 text-white shadow-lg shadow-red-200 dark:shadow-red-900/40 cursor-default'
                                : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-800/30 hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-200 dark:hover:shadow-red-900/40'
                              }`}
                            title="رفض الطلب"
                          >
                            <XCircle size={16} />
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.1, y: -2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAppForAI(app);
                              setShowAIEval(true);
                            }}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-100 dark:border-purple-800/30 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                            title="تحليل الذكاء الاصطناعي"
                          >
                            <Sparkles size={16} />
                          </motion.button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </GlassCard>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>

      {/* Details Full Page Feed with Snap Scrolling */}
      <AnimatePresence>
        {selectedAppIndex !== null && filteredApps.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 h-[100dvh] max-h-[100dvh] z-[300] bg-slate-950 text-slate-800 dark:text-white flex flex-col overflow-hidden"
            dir="rtl"
          >
            {/* ── Top Bar with Counter, Back & Prev/Next ── */}
            <div
              className="shrink-0 relative z-30 flex items-center justify-between px-3 md:px-6 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm gap-2"
              style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
            >
              {/* Back Button to Applications List */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleReturnToApplicant(selectedAppIndex)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl text-xs font-black transition-all active:scale-95 shadow-md shadow-blue-500/30 shrink-0"
                  title="الرجوع لصفحة الطلبات"
                >
                  <ArrowRight size={18} />
                  <span>رجوع للطلبات</span>
                </button>

                <span className="hidden sm:inline-flex px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-[11px] font-black border border-slate-200 dark:border-slate-700">
                  طلب {selectedAppIndex + 1} من {filteredApps.length}
                </span>
              </div>

              {/* Current applicant mini info */}
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={filteredApps[selectedAppIndex]?.applicant_data?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(filteredApps[selectedAppIndex]?.applicant_data?.name || 'U')}&background=random`}
                  className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  alt=""
                />
                <span className="text-xs font-black text-slate-800 dark:text-white truncate max-w-[130px] md:max-w-[200px]">
                  {filteredApps[selectedAppIndex]?.applicant_data?.name}
                </span>
              </div>

              {/* Prev / Next Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => scrollToApp(selectedAppIndex - 1)}
                  disabled={selectedAppIndex <= 0}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
                  title="الطلب السابق"
                >
                  <ChevronUp size={16} />
                </button>
                <span className="sm:hidden text-[10px] font-black text-slate-400 px-1">
                  {selectedAppIndex + 1}/{filteredApps.length}
                </span>
                <button
                  onClick={() => scrollToApp(selectedAppIndex + 1)}
                  disabled={selectedAppIndex >= filteredApps.length - 1}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
                  title="الطلب التالي"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>

            {/* ── Desktop Floating Side Navigation ── */}
            <div className="fixed left-6 top-1/2 -translate-y-1/2 z-[310] hidden lg:flex flex-col gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl">
              <button
                onClick={() => scrollToApp(selectedAppIndex - 1)}
                disabled={selectedAppIndex <= 0}
                className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 disabled:opacity-20 disabled:pointer-events-none transition-all"
                title="الطلب السابق (أعلى)"
              >
                <ChevronUp size={20} />
              </button>
              <div className="text-[10px] font-black text-center text-blue-600 dark:text-blue-400 py-1 border-y border-slate-100 dark:border-slate-800">
                {selectedAppIndex + 1}/{filteredApps.length}
              </div>
              <button
                onClick={() => scrollToApp(selectedAppIndex + 1)}
                disabled={selectedAppIndex >= filteredApps.length - 1}
                className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 disabled:opacity-20 disabled:pointer-events-none transition-all"
                title="الطلب التالي (أسفل)"
              >
                <ChevronDown size={20} />
              </button>
            </div>

            {/* ── Single Isolated Scroll Container for Applicant Details ── */}
            <div
              ref={detailContainerRef}
              className="flex-1 overflow-y-auto no-scrollbar overscroll-contain bg-slate-100 dark:bg-slate-950 flex flex-col"
              style={{
                overscrollBehaviorY: 'contain',
                touchAction: 'pan-y',
                WebkitOverflowScrolling: 'touch' as any,
              }}
            >
              {(() => {
                if (selectedAppIndex === null) return null;
                const app = filteredApps[selectedAppIndex];
                if (!app) return null;
                const index = selectedAppIndex;
                const resolved = resolveApplicant(app);
                const statusBadge = app.status === 'approved' 
                  ? { label: 'مقبول', cls: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' }
                  : app.status === 'rejected'
                  ? { label: 'مرفوض', cls: 'bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400' }
                  : { label: 'قيد المراجعة', cls: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400' };

                return (
                  <motion.div
                    key={app.id || index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="w-full flex-1 flex flex-col justify-between"
                  >
                    {/* Inner Scrollable Content with comfortable bottom padding */}
                    <div
                      className="p-4 md:p-8 space-y-6 max-w-4xl w-full mx-auto"
                      style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 140px), 160px)' }}
                    >

                      {/* 👤 Hero Applicant Header Card */}
                      <div className="bg-gradient-to-r from-[#0a66c2] via-[#0052a3] to-[#003d7a] rounded-[2.5rem] p-6 md:p-8 text-white shadow-xl shadow-blue-500/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
                          <div className="flex items-center gap-4">
                            <div className="relative group">
                              <img
                                src={resolved.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolved.name || 'U')}&background=random`}
                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl object-cover border-4 border-white/30 shadow-2xl"
                                referrerPolicy="no-referrer"
                                alt=""
                              />
                              <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white ${
                                app.status === 'approved' ? 'bg-emerald-500' : app.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                              }`}>
                                {app.status === 'approved' ? <CheckCircle size={12} /> : app.status === 'rejected' ? <XCircle size={12} /> : <Clock size={12} />}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-xl sm:text-2xl font-black text-white">{resolved.name}</h3>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black border bg-white/20 text-white border-white/30`}>
                                  {statusBadge.label}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm font-bold text-blue-100/80 flex items-center gap-1.5 mt-1">
                                <Briefcase size={14} className="text-blue-200" />
                                {app.job?.title || app.jobs?.title || app.jobTitle}
                              </p>
                              <span className="text-[10px] text-blue-200/60 font-bold block mt-1">
                                تاريخ التقديم: {new Date(app.created_at).toLocaleDateString('ar-EG')}
                              </span>
                            </div>
                          </div>

                          {/* Quick Rating on Hero */}
                          <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/15">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                onClick={(e) => { e.stopPropagation(); setRating(app.id, star); }}
                                className="p-0.5 transition-transform hover:scale-125 active:scale-95"
                              >
                                <Star
                                  size={15}
                                  className={star <= (ratings[app.id] || 0) ? 'text-amber-300 fill-amber-300' : 'text-white/30'}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Top Hero Return Button */}
                        <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between gap-3 flex-wrap relative z-10">
                          <button
                            onClick={() => handleReturnToApplicant(index)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-2xl text-xs font-black backdrop-blur-md border border-white/30 transition-all active:scale-95 shadow-sm"
                          >
                            <ArrowRight size={16} />
                            <span>الرجوع لصفحة الطلبات</span>
                          </button>
                          <span className="text-[10px] text-blue-200/80 font-bold">
                            طلب {index + 1} من {filteredApps.length}
                          </span>
                        </div>
                      </div>

                      {/* 📞 Contact Info Cards (One-tap action) */}
                      <section className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                          <User size={14} className="text-blue-600 dark:text-blue-400" />
                          بيانات الاتصال والتواصل المباشر
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-sm"><User size={18} /></div>
                            <div className="min-w-0 flex-1">
                              <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">الاسم الكامل</span>
                              <span className="text-sm font-black text-slate-800 dark:text-white truncate block">{app.applicant_data?.name}</span>
                            </div>
                          </div>

                          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm"><Phone size={18} /></div>
                              <div className="min-w-0">
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">رقم الهاتف</span>
                                <span className="text-sm font-black text-slate-800 dark:text-white truncate block">{app.applicant_data?.phone || 'غير متوفر'}</span>
                              </div>
                            </div>
                            {app.applicant_data?.phone && (
                              <div className="flex gap-1.5 shrink-0">
                                <a
                                  href={`tel:${app.applicant_data.phone}`}
                                  className="p-2 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all shadow-sm"
                                  title="اتصال هاتفي"
                                >
                                  <Phone size={14} />
                                </a>
                                <a
                                  href={`https://wa.me/${app.applicant_data.phone.replace(/[^0-9+]/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 hover:bg-[#25D366] hover:text-white rounded-xl transition-all shadow-sm"
                                  title="مراسلة واتساب"
                                >
                                  <MessageCircle size={14} />
                                </a>
                              </div>
                            )}
                          </div>

                          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-sm"><Mail size={18} /></div>
                              <div className="min-w-0">
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">البريد الإلكتروني</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate block">{app.applicant_data?.email || 'غير متوفر'}</span>
                              </div>
                            </div>
                            {app.applicant_data?.email && (
                              <a
                                href={`mailto:${app.applicant_data.email}`}
                                className="p-2 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white rounded-xl transition-all shadow-sm shrink-0"
                                title="إرسال بريد"
                              >
                                <Mail size={14} />
                              </a>
                            )}
                          </div>

                          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-sm"><MapPin size={18} /></div>
                            <div className="min-w-0 flex-1">
                              <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">الموقع السكني</span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate block">{app.applicant_data?.location || 'غير محدد'}</span>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* 📝 Cover Letter */}
                      {app.cover_letter && (
                        <section className="space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                            <MessageSquare size={14} className="text-indigo-600 dark:text-indigo-400" />
                            رسالة التقديم المرفقة
                          </h4>
                          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">{app.cover_letter}</p>
                          </div>
                        </section>
                      )}

                      {/* 🏆 Experience & Skills */}
                      <section className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                          <Sparkles size={14} className="text-amber-500" />
                          نبذة الخبرة والمهارات
                        </h4>
                        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                          <span className="block text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Clock size={11} /> خلاصة الخبرة العملية
                          </span>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
                            {app.applicant_data?.experience || 'لا توجد نبذة خبرة مسجلة.'}
                          </p>
                        </div>
                        {app.applicant_data?.skills && (
                          <div className="flex flex-wrap gap-2 px-1">
                            {(Array.isArray(app.applicant_data.skills)
                              ? app.applicant_data.skills
                              : typeof app.applicant_data.skills === 'string'
                              ? app.applicant_data.skills.split(',')
                              : []
                            ).map((s: any, i: number) => (
                              <span key={i} className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black shadow-md">{String(s).trim()}</span>
                            ))}
                          </div>
                        )}
                      </section>

                      {/* 🏢 Previous Works */}
                      {Array.isArray(app.applicant_data?.prevWorks) && app.applicant_data.prevWorks.length > 0 && (
                        <section className="space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                            <Briefcase size={14} className="text-emerald-600 dark:text-emerald-400" />
                            سجل الخبرات العملية التفصيلي
                          </h4>
                          <div className="space-y-3">
                            {app.applicant_data.prevWorks.map((work: any, idx: number) => (
                              <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-1 h-full bg-blue-500" />
                                <div className="flex items-start gap-3 mb-3 pr-3">
                                  <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[11px] font-black shrink-0">{idx + 1}</span>
                                  <div>
                                    <h5 className="text-sm font-black text-slate-800 dark:text-white">{work?.company || work?.companyName || '-'}</h5>
                                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{work?.role || work?.title || '-'}</p>
                                  </div>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800 p-3 rounded-xl pr-3">{work?.tasks || '-'}</p>
                                <div className="flex gap-3 mt-3 pr-3">
                                  {work?.salary && <span className="text-[10px] text-slate-500 font-bold">💰 {work.salary}</span>}
                                  {work?.hours && <span className="text-[10px] text-slate-500 font-bold">⏰ {work.hours}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* 📎 CV Options: Direct Native Zero-Freeze Viewer & Download (100% No Freezing) */}
                      {(() => {
                        const cvTargetUrl = app.cv_url || app.applicant_data?.cvUrl || (app.applicant_data as any)?.cv_url || resolved.cvUrl;
                        if (!cvTargetUrl) {
                          return (
                            <div className="p-4 bg-slate-100 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-right">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-750 text-slate-400 flex items-center justify-center shrink-0">
                                  <FileText size={18} />
                                </div>
                                <div>
                                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 block">ملف السيرة الذاتية (CV)</span>
                                  <span className="text-[10px] text-slate-400 font-bold block">لم يرفق المتقدم ملف سيرة ذاتية في هذا الطلب</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="space-y-2.5">
                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                              <FileText size={14} className="text-blue-600 dark:text-blue-400" />
                              ملف السيرة الذاتية (CV) للمتقدم
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {/* Option 1: Direct Open in Browser Native Viewer (100% Zero-Freeze) */}
                              <button
                                type="button"
                                onClick={() => handleOpenApplicantCV(cvTargetUrl, resolved.name)}
                                className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-[#0a66c2] hover:from-blue-700 hover:to-[#08529c] rounded-2xl text-white shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all group text-right cursor-pointer"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30 shrink-0">
                                    <ExternalLink size={18} />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-xs font-black block truncate">معاينة السيرة الذاتية</span>
                                    <span className="text-[9px] text-blue-100 font-bold block">عرض فوري في نافذة جديدة ↗</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/20 text-white text-[11px] font-black group-hover:bg-white/30 transition-colors shrink-0">
                                  <Eye size={13} />
                                  <span>فتح</span>
                                </div>
                              </button>

                              {/* Option 2: Direct Download */}
                              <button
                                type="button"
                                onClick={() => handleDownloadApplicantCV(cvTargetUrl, resolved.name)}
                                className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 rounded-2xl text-white shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all group text-right cursor-pointer"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30 shrink-0">
                                    <Download size={18} />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-xs font-black block truncate">تنزيل السيرة الذاتية</span>
                                    <span className="text-[9px] text-emerald-100 font-bold block">تحميل مباشر للملف ⬇</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/20 text-white text-[11px] font-black group-hover:bg-white/30 transition-colors shrink-0">
                                  <Download size={13} />
                                  <span>تنزيل</span>
                                </div>
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* ⚡ Decision & Action Controls Section (يصل إليها المستخدم عند التمرير لأسفل التفاصيل) */}
                      <section className="pt-4 space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                            <h4 className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                              إجراءات واتخاذ القرار على الطلب
                            </h4>
                          </div>
                          {index < filteredApps.length - 1 && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                              طلب {index + 1} من {filteredApps.length}
                            </span>
                          )}
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-5 md:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-3.5">
                          {/* Primary Action Buttons */}
                          <div className="flex flex-wrap gap-2.5">
                            {app.status !== 'approved' && (
                              <button
                                onClick={() => handleApplicationAction(app.id, app.job?.title || app.jobs?.title || app.jobTitle || 'وظيفة', 'approved')}
                                className="flex-1 min-w-[130px] py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95"
                              >
                                <CheckCircle size={16} /> قبول الطلب
                              </button>
                            )}

                            {app.status !== 'rejected' && (
                              <>
                                {app.status === 'approved' && (
                                  <button
                                    onClick={() => { setShowOnboarding(true); }}
                                    className="flex-1 min-w-[130px] py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95"
                                  >
                                    <Briefcase size={16} /> تعيين في ERP
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    const applicantId = app.applicant_id;
                                    if (applicantId) {
                                      const targetUser = allUsers.find(u => u.id === applicantId);
                                      if (targetUser) {
                                        setSelectedChat(targetUser);
                                        setActiveTab('messages');
                                        setSelectedAppIndex(null);
                                      } else {
                                        addToast('لم يتم العثور على حساب المتقدم', 'error');
                                      }
                                    }
                                  }}
                                  className="flex-1 min-w-[130px] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 active:scale-95"
                                >
                                  <MessageSquare size={16} /> دردشة فورية
                                </button>
                              </>
                            )}

                            {app.status !== 'rejected' && (
                              <button
                                onClick={() => handleApplicationAction(app.id, app.job?.title || app.jobs?.title || app.jobTitle || 'وظيفة', 'rejected')}
                                className="flex-1 min-w-[130px] py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 active:scale-95"
                              >
                                <XCircle size={16} /> رفض الطلب
                              </button>
                            )}
                          </div>

                          {/* Secondary Actions (حذف الطلب & إعادة للمراجعة) */}
                          <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            {app.status !== 'pending' && (
                              <button
                                onClick={() => handleApplicationAction(app.id, app.job?.title || app.jobs?.title || app.jobTitle || 'وظيفة', 'pending')}
                                className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 active:scale-95"
                              >
                                <RotateCcw size={14} /> إعادة لقيد المراجعة
                              </button>
                            )}
                            <button
                              onClick={() => {
                                onDeleteApplication(app.id);
                                if (filteredApps.length <= 1) {
                                  setSelectedAppIndex(null);
                                }
                              }}
                              className="flex-1 py-3.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-500 hover:text-white text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40 rounded-2xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                            >
                              <Trash2 size={14} /> حذف الطلب نهائياً
                            </button>
                          </div>
                        </div>

                        {/* Transition Button to Next Request */}
                        {index < filteredApps.length - 1 && (
                          <div className="pt-2 text-center">
                            <button
                              onClick={() => scrollToApp(index + 1)}
                              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
                            >
                              <span>الانتقال إلى الطلب التالي ({filteredApps[index + 1]?.applicant_data?.name?.split(' ')[0] || 'المتقدم التالي'})</span>
                              <ChevronDown size={16} />
                            </button>
                          </div>
                        )}
                      </section>
                    </div>
                  </motion.div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <EmployeeOnboardingModal
        show={showOnboarding}
        app={selectedApp}
        employerId={appUser?.id || ''}
        addToast={addToast}
        onClose={() => { setShowOnboarding(false); }}
      />

      <AnimatePresence>
        {showAIEval && appForAI && (
          <AIEvaluationModal
            application={appForAI}
            onClose={() => { setShowAIEval(false); setAppForAI(null); }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
