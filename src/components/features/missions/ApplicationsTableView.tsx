import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Download, CheckCircle, XCircle, Clock, Search, ExternalLink,
  User, Briefcase, FileSpreadsheet, Calendar, MessageCircle, Mail,
  RotateCcw, Trash2, MapPin, Globe, Sparkles, DollarSign, MessageSquare,
  Loader2, Star, StickyNote
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { AppUser } from '../../../types';
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
  handleApplicationAction: (appId: string, jobTitle: string, status: 'approved' | 'rejected' | 'pending') => Promise<void>;
  onDeleteApplication: (appId: string) => Promise<void>;
  addToast: (msg: string, type?: any) => void;
  appUser: AppUser | null;
}

export function ApplicationsListView({
  incomingApplications,
  handleApplicationAction,
  onDeleteApplication,
  addToast,
  appUser,
}: ApplicationsListViewProps) {
  const { setActiveTab, setSelectedChat, allUsers } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
  const [ratingFilter, setRatingFilter] = useState<number>(0); // 0 = all

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

  const setRating = (appId: string, rating: number) => {
    const next = { ...ratings, [appId]: rating };
    setRatings(next);
    localStorage.setItem('prolink_app_ratings', JSON.stringify(next));
  };

  const saveNote = (appId: string, note: string) => {
    const next = { ...notes, [appId]: note };
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

  const filteredApps = incomingApplications.filter(app => {
    const name = (app.applicant_data?.name || '').toLowerCase();
    const title = (app.job?.title || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = name.includes(query) || title.includes(query);
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleScheduleInterview = async () => {
    if (!interviewDate || !interviewTime || !appUser || !selectedApp) {
      addToast('يرجى تحديد التاريخ والوقت أولاً', 'error');
      return;
    }

    const phone = selectedApp.applicant_data?.phone || '';
    const name = selectedApp.applicant_data?.name || 'متقدمنا العزيز';
    const jobTitle = selectedApp.job?.title || selectedApp.jobs?.title || selectedApp.jobTitle || 'الوظيفة';

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

      // 💬 2. WhatsApp Message
      const waMessage = `مرحباً ${name}،%0A%0Aتمت مراجعة سيرتك الذاتية ويسعدنا إخبارك بأنه تم ترشيحك لمقابلة عمل لوظيفة "${jobTitle}".%0A%0A📆 موعد المقابلة: ${interviewDate}%0A⏰ الساعة: ${interviewTime}%0A%0Aيرجى تأكيد الحضور، بالتوفيق!`;

      if (phone) {
        const cleanPhone = phone.replace(/[^0-9+]/g, '');
        window.open(`https://wa.me/${cleanPhone}?text=${waMessage}`, '_blank');
      }

      // 🚀 3. Update status in Database
      await handleApplicationAction(selectedApp.id, jobTitle, 'approved');

      setShowScheduler(false);
      setSelectedApp(null);
      addToast('✅ تم تحديد موعد المقابلة وإرسال الدعوة بنجاح!');
    } catch (err: any) {
      addToast('فشل في إرسال الدعوة: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Filter Area */}
      <div className="bg-slate-800 p-6 rounded-[2.5rem] border border-slate-700 shadow-[0_8px_30px_rgba(255,255,255,0.05)] space-y-4 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white">طلبات التوظيف</h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold uppercase tracking-widest mt-0.5">لديك {incomingApplications.length} طلب تقديم قيد الإدارة</p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Export Buttons */}
            <div className="flex gap-2">
              <button onClick={() => exportToExcel(incomingApplications, 'الكل', addToast, allUsers)} disabled={incomingApplications.length === 0} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black border border-blue-100 dark:border-blue-800/50 hover:bg-blue-100 transition-all disabled:opacity-50">
                <Download size={14} /> إكسل للكل
              </button>
              <button onClick={() => exportToExcel(incomingApplications.filter(a => a.status === 'approved'), 'المقبولين', addToast, allUsers)} disabled={incomingApplications.filter(a => a.status === 'approved').length === 0} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-[10px] font-black border border-emerald-100 dark:border-emerald-800/50 hover:bg-emerald-100 transition-all disabled:opacity-50">
                <Download size={14} /> المقبولين
              </button>
              <button onClick={() => exportToExcel(incomingApplications.filter(a => a.status === 'rejected'), 'المرفوضين', addToast, allUsers)} disabled={incomingApplications.filter(a => a.status === 'rejected').length === 0} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black border border-red-100 dark:border-red-800/50 hover:bg-red-100 transition-all disabled:opacity-50">
                <Download size={14} /> المرفوضين
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'pending', label: 'قيد المراجعة' },
                { id: 'approved', label: 'المقبولين' },
                { id: 'rejected', label: 'المرفوضين' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id as any)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${statusFilter === f.id ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-slate-700/30 text-slate-400 dark:text-slate-300 hover:bg-slate-700/50'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500" size={16} />
          <input
            type="text"
            placeholder="ابحث باسم المتقدم أو المسمى الوظيفي..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 pr-12 pl-4 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-blue-50/50 dark:focus:ring-blue-900/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredApps.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-20 text-center bg-white/50 dark:bg-slate-800/50 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-700">
              <FileText className="mx-auto text-slate-200 dark:text-slate-600 mb-4" size={48} />
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500">لا توجد طلبات مطابقة حالياً</p>
            </motion.div>
          ) : filteredApps.map((app, i) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.05 }}
              layout
            >
              <GlassCard className="p-5 rounded-[2.2rem] border border-white dark:border-slate-700 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all group relative overflow-hidden bg-white/90 dark:bg-slate-800/90">
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <img
                      src={app.applicant_data?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.applicant_data?.name || 'U')}&background=0a66c2&color=fff`}
                      className="w-14 h-14 rounded-2xl object-cover shadow-md border-2 border-white dark:border-slate-700"
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
                        <h3 className="text-sm font-black text-slate-800 dark:text-white truncate">{app.applicant_data?.name}</h3>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mb-1 flex items-center gap-1">
                          <Briefcase size={10} /> {app.jobTitle || app.jobs?.title || app.job?.title}
                        </p>
                        {/* ⭐ Star Rating */}
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
                        {/* Notes input */}
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
                      </div>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold whitespace-nowrap">
                        {new Date(app.created_at).toLocaleDateString('ar-EG')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => { setSelectedApp(app); setShowScheduler(false); }}
                        className="flex-[2] py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-[10px] font-black hover:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-sm border border-transparent dark:border-slate-700"
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
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedApp && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-center justify-center px-4"
            onClick={() => setSelectedApp(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl max-w-4xl w-full max-h-[calc(100vh-180px)] flex flex-col relative overflow-hidden border border-white/20 dark:border-slate-700 my-[90px]"
              onClick={e => e.stopPropagation()}
            >
              {/* Blue Header */}
              <div className="bg-gradient-to-r from-[#0a66c2] to-[#004182] p-6 md:p-8 flex items-center justify-between border-b border-white/10 text-white">
                <div className="flex items-center gap-5">
                  <div className="relative group">
                    <img
                      src={selectedApp.applicant_data?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedApp.applicant_data?.name || 'U')}&background=random`}
                      className="w-16 h-16 rounded-3xl object-cover border-2 border-white/30 shadow-xl group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-[#0a66c2] rounded-full flex items-center justify-center text-white">
                      <CheckCircle size={12} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-black text-white truncate">{selectedApp.applicant_data?.name}</h3>
                    <p className="text-xs font-bold text-blue-100/70 flex items-center gap-2 mt-1">
                      <Briefcase size={12} className="text-blue-200" /> {selectedApp.job?.title}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all border border-white/10"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 no-scrollbar bg-white dark:bg-slate-800">

                {/* 📞 Contact Info (Name, Phone, Email, Location) */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <User className="text-blue-600 dark:text-blue-400" size={16} />
                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">بيانات المتقدم والتواصل</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-blue-500 shadow-sm"><User size={16} /></div>
                      <div className="min-w-0">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">الاسم الكامل</span>
                        <span className="text-sm font-black text-slate-800 dark:text-white truncate block">{selectedApp.applicant_data?.name}</span>
                      </div>
                    </div>
                    <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-emerald-500 shadow-sm"><MessageCircle size={16} /></div>
                      <div className="min-w-0">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">رقم التواصل</span>
                        <span className="text-sm font-black text-slate-800 dark:text-white truncate block">{selectedApp.applicant_data?.phone || 'غير متوفر'}</span>
                      </div>
                    </div>
                    <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-amber-500 shadow-sm"><Mail size={16} /></div>
                      <div className="min-w-0">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">البريد الإلكتروني</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate block">{selectedApp.applicant_data?.email || 'غير متوفر'}</span>
                      </div>
                    </div>
                    <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-indigo-500 shadow-sm"><MapPin size={16} /></div>
                      <div className="min-w-0">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">الموقع السكني</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate block">{selectedApp.applicant_data?.location || 'غير محدد'}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 📝 Cover Letter / Application Message */}
                {selectedApp.cover_letter && (
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <MessageSquare className="text-indigo-600 dark:text-indigo-400" size={16} />
                      <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">رسالة التقديم المرفقة</h4>
                    </div>
                    <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-[2rem] border border-indigo-100/50 dark:border-indigo-800/20 shadow-sm">
                      <p className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed font-bold whitespace-pre-wrap">
                        {selectedApp.cover_letter}
                      </p>
                    </div>
                  </section>
                )}

                {/* 🏆 Profile Experience & Skills */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Sparkles className="text-amber-500" size={16} />
                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">نبذة الخبرة والمهارات (من الملف الشخصي)</h4>
                  </div>
                  <div className="space-y-4">
                    {/* Experience Bio */}
                    <div className="p-6 bg-amber-50/30 dark:bg-amber-900/10 rounded-[2rem] border border-amber-100/50 dark:border-amber-800/20">
                      <span className="block text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Clock size={12} /> خلاصة الخبرة العملية
                      </span>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
                        {selectedApp.applicant_data?.experience || 'لا توجد نبذة خبرة مسجلة في الملف الشخصي.'}
                      </p>
                    </div>

                    {/* Profile Skills */}
                    {(selectedApp.applicant_data?.skills && selectedApp.applicant_data?.skills.length > 0) && (
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(selectedApp.applicant_data.skills) ? selectedApp.applicant_data.skills : selectedApp.applicant_data.skills.split(',')).map((s: string, i: number) => (
                          <span key={i} className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black shadow-lg transition-transform hover:scale-105">
                            {s.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* 🏢 Structured Previous Works */}
                {selectedApp.applicant_data?.prevWorks && selectedApp.applicant_data.prevWorks.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <Briefcase className="text-emerald-600 dark:text-emerald-400" size={16} />
                      <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">سجل الخبرات العملية (التفصيلي)</h4>
                    </div>
                    <div className="space-y-4">
                      {selectedApp.applicant_data.prevWorks.map((work: any, idx: number) => (
                        <div key={idx} className="bg-slate-50 dark:bg-slate-900/40 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700/50 relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 group-hover:w-2 transition-all" />
                          <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <h5 className="text-sm font-black text-slate-800 dark:text-white mb-1 flex items-center gap-2">
                                  <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">{idx + 1}</span>
                                  {work.company}
                                </h5>
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mr-10">{work.role}</p>
                              </div>
                              <div className="mr-10">
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">المهام والمسؤوليات</span>
                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner">
                                  {work.tasks}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 content-center">
                              <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl"><DollarSign size={14} /></div>
                                <div>
                                  <span className="block text-[9px] font-black text-slate-400 uppercase">الراتب السابق</span>
                                  <span className="text-xs font-black text-slate-800 dark:text-white">{work.salary || 'غير محدد'}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl"><Clock size={14} /></div>
                                <div>
                                  <span className="block text-[9px] font-black text-slate-400 uppercase">ساعات العمل</span>
                                  <span className="text-xs font-black text-slate-800 dark:text-white">{work.hours || 'غير محدد'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 📎 CV Link */}
                {(selectedApp.cv_url || selectedApp.applicant_data?.cvUrl) && (
                  <a href={selectedApp.cv_url || selectedApp.applicant_data?.cvUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between p-6 bg-gradient-to-r from-[#0a66c2] to-[#004182] rounded-[2rem] text-white shadow-xl shadow-blue-200 dark:shadow-none hover:scale-[1.02] transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/30"><FileText size={20} /></div>
                      <div>
                        <span className="text-sm font-black block">تحميل السيرة الذاتية (CV)</span>
                        <span className="text-[10px] text-blue-100 font-bold">الملف الأصلي المرفق من المتقدم</span>
                      </div>
                    </div>
                    <ExternalLink size={18} className="text-white/70 group-hover:text-white transition-colors" />
                  </a>
                )}
              </div>

              {/* Blue Footer */}
              <div className="p-6 md:p-8 bg-gradient-to-r from-[#0a66c2] to-[#004182] border-t border-white/10">
                {showScheduler ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-black text-white flex items-center gap-2"><Calendar size={16} className="text-blue-200" /> تحديد موعد المقابلة</h4>
                      <button onClick={() => setShowScheduler(false)} className="text-[10px] font-bold text-blue-200 hover:text-white">إلغاء</button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-blue-100 block mb-1">التاريخ</label>
                        <input type="date" value={interviewDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInterviewDate(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-white/30" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-blue-100 block mb-1">الوقت</label>
                        <input type="time" value={interviewTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInterviewTime(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-white/30" />
                      </div>
                    </div>

                    <button
                      onClick={handleScheduleInterview}
                      className="w-full py-4 bg-[#25D366] text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-[#1ebd5b] transition-all shadow-lg"
                    >
                      <MessageCircle size={18} /> تأكيد وإرسال دعوة عبر الواتساب
                    </button>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {/* Primary Status Actions */}
                    <div className="flex flex-wrap gap-3">
                      {selectedApp.status !== 'approved' && (
                        <button
                          onClick={() => { if(selectedApp) handleApplicationAction(selectedApp.id, selectedApp.job?.title || selectedApp.jobs?.title || selectedApp.jobTitle || 'وظيفة', 'approved'); setSelectedApp(null); }}
                          className="flex-1 min-w-[140px] py-4 bg-white text-[#0a66c2] rounded-2xl text-xs font-black hover:bg-blue-50 transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                          <CheckCircle size={16} /> قبول الطلب
                        </button>
                      )}

                      {selectedApp.status !== 'rejected' && (
                        <>
                          <button
                            onClick={() => setShowScheduler(true)}
                            className="flex-1 min-w-[140px] py-4 bg-white/10 text-white border border-white/20 rounded-2xl text-xs font-black hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                          >
                            <Calendar size={16} /> تحديد مقابلة
                          </button>

                          {selectedApp.status === 'approved' && (
                            <button
                              onClick={() => setShowOnboarding(true)}
                              className="flex-1 min-w-[140px] py-4 bg-emerald-500 text-white rounded-2xl text-xs font-black hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                              <Briefcase size={16} /> تعيين في نظام (ERP)
                            </button>
                          )}

                          <button
                            onClick={() => {
                              const applicantId = selectedApp.applicant_id;
                              if (applicantId) {
                                const targetUser = allUsers.find(u => u.id === applicantId);
                                if (targetUser) {
                                  setSelectedChat(targetUser);
                                  setActiveTab('messages');
                                  setSelectedApp(null);
                                } else {
                                  addToast('لم يتم العثور على حساب المتقدم في النظام', 'error');
                                }
                              }
                            }}
                            className="flex-1 min-w-[140px] py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                          >
                            <MessageSquare size={16} /> دردشة فورية
                          </button>
                        </>
                      )}

                      {selectedApp.status !== 'rejected' && (
                        <button
                          onClick={() => { if(selectedApp) handleApplicationAction(selectedApp.id, selectedApp.job?.title || selectedApp.jobs?.title || selectedApp.jobTitle || 'وظيفة', 'rejected'); setSelectedApp(null); }}
                          className="flex-1 min-w-[140px] py-4 bg-red-500 text-white rounded-2xl text-xs font-black hover:bg-red-600 transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                          <XCircle size={16} /> رفض الطلب
                        </button>
                      )}
                    </div>

                    {/* Secondary Management Actions */}
                    <div className="flex gap-3 pt-2">
                      {selectedApp.status !== 'pending' && (
                        <button
                          onClick={() => { if(selectedApp) handleApplicationAction(selectedApp.id, selectedApp.job?.title || selectedApp.jobs?.title || selectedApp.jobTitle || 'وظيفة', 'pending'); setSelectedApp(null); }}
                          className="flex-1 py-3 bg-white/10 text-white border border-white/20 rounded-xl text-[10px] font-black hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                        >
                          <RotateCcw size={14} /> إعادة لقيد المراجعة
                        </button>
                      )}

                      <button
                        onClick={() => { onDeleteApplication(selectedApp.id); setSelectedApp(null); }}
                        className="flex-1 py-3 bg-white/10 text-white border border-white/20 rounded-xl text-[10px] font-black hover:bg-red-500 transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 size={14} /> حذف الطلب نهائياً
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <EmployeeOnboardingModal
        show={showOnboarding}
        app={selectedApp}
        employerId={appUser?.id || ''}
        addToast={addToast}
        onClose={() => { setShowOnboarding(false); setSelectedApp(null); }}
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
