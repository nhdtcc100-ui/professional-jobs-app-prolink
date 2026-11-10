import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Briefcase, BookOpen, Sparkles, RefreshCw } from 'lucide-react';
import { jobService } from '../../lib/services/jobService';
import { courseService } from '../../lib/services/courseService';
import { filterAndRankJobs } from '../../lib/services/matchingService';
import { supabase } from '../../lib/supabase';
import { Job, AppUser, Course } from '../../types';
import { useAppContext } from '../../contexts/AppContext';
import { sanitizeInput } from '../../lib/utils/sanitize';
import { isJobPoster, isUserAdmin } from '../../lib/utils/roleUtils';
import { SkeletonJobCardCompact, SkeletonJobCard, SkeletonApplicationCard } from '../ui';
import { SuggestedCandidates } from './missions/SuggestedCandidates';
import { DetailFeedPage } from './DetailFeedPage';
import {
  JobCard,
  JobDetailModal,
  JobPostForm,
  ApplicationsListView,
  MyJobsView,
  CoursesView,
  PostCourseModal,
  CoursePostForm,
  CoursePostFormData,
  AnalyticsDashboard,
} from './missions';

import { getJobCategory } from '../../lib/utils/jobCategoryUtils';

interface MissionsViewProps {
  jobs: Job[];
  appUser: AppUser | null;
  allUsers: AppUser[];
  addToast: (m: string, t?: any) => void;
  messages: any[];
  onApplyJob: (job: Job) => void;
  setActiveTab?: (tab: string) => void;
  onPublisherClick?: (user: any) => void;
}

const EMPTY_JOB_FORM = {
  title: '', company: '', description: '', requirements: '',
  location: '', salary: '', jobType: 'دوام كامل', category: '', working_hours: '', imageUrl: '', is_active: true
};

const EMPTY_COURSE_FORM: CoursePostFormData = {
  title: '',
  description: '',
  requirements: '',
  outcomes: '',
  image_url: '',
  duration: '',
  price: 'مجاني',
  level: 'مبتدئ',
  is_active: true,
};

type MainTab = 'jobs' | 'courses';
type JobSubTab = 'discover' | 'my-posts' | 'requests' | 'analytics';

export function MissionsView({ jobs, appUser, allUsers, addToast, messages, onApplyJob, setActiveTab, onPublisherClick }: MissionsViewProps) {
  const { refreshData, markJobApplicationNotificationsAsRead } = useAppContext();
  const isAdmin = isUserAdmin(appUser);

  const [mainTab, setMainTab] = useState<MainTab>('jobs');
  const [activeSubTab, setActiveSubTab] = useState<JobSubTab>('discover');
  const [isPosting, setIsPosting] = useState(false);
  const [isPostingCourse, setIsPostingCourse] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);

  useEffect(() => {
    if (!isAdmin && mainTab === 'courses') {
      setMainTab('jobs');
    }
  }, [isAdmin, mainTab]);
  const [showPostCourse, setShowPostCourse] = useState(false);
  const [selectedJobDetails, setSelectedJobDetails] = useState<Job | null>(null);
  const [formData, setFormData] = useState(EMPTY_JOB_FORM);
  const [courseFormData, setCourseFormData] = useState<CoursePostFormData>(EMPTY_COURSE_FORM);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('الكل');
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseData, setEditCourseData] = useState<Course | null>(null);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [incomingApplications, setIncomingApplications] = useState<any[]>([]);
  const [sentApplications, setSentApplications] = useState<any[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  const [seenAppIds, setSeenAppIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`prolink_seen_apps_${appUser?.id}`);
      return raw ? new Set(JSON.parse(raw)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  const markAllIncomingAsSeen = React.useCallback(() => {
    if (!appUser?.id || incomingApplications.length === 0) return;
    const allIds = incomingApplications.map(a => a.id);
    const updated = new Set([...seenAppIds, ...allIds]);
    setSeenAppIds(updated);
    try {
      localStorage.setItem(`prolink_seen_apps_${appUser.id}`, JSON.stringify(Array.from(updated)));
      window.dispatchEvent(new Event('prolink_seen_apps_updated'));
    } catch (_) {}
    if (markJobApplicationNotificationsAsRead) {
      markJobApplicationNotificationsAsRead();
    }
  }, [appUser?.id, incomingApplications, seenAppIds, markJobApplicationNotificationsAsRead]);

  // When employer opens requests tab, mark them as seen and clear notifications
  useEffect(() => {
    if (activeSubTab === 'requests' && incomingApplications.length > 0) {
      markAllIncomingAsSeen();
    }
  }, [activeSubTab, incomingApplications.length, markAllIncomingAsSeen]);

  // ── Applications ─────────────────────────────────────────────────────────────
  const fetchApplications = async () => {
    if (!appUser?.id) { setAppsLoading(false); return; }
    setAppsLoading(true);

    // Safety timeout — if stuck for 5s, stop loading
    const safetyTimer = setTimeout(() => setAppsLoading(false), 5000);

    try {
      let incomingRes = await (supabase as any)
        .from('job_applications')
        .select('*, jobs(title, company, description, requirements), applicant:profiles!applicant_id(id, name, avatar_url, phone, email, location, title, bio, cv_url)')
        .eq('employer_id', appUser.id)
        .order('created_at', { ascending: false });

      if (incomingRes.error) {
        incomingRes = await (supabase as any)
          .from('job_applications')
          .select('*, jobs(title, company, description, requirements)')
          .eq('employer_id', appUser.id)
          .order('created_at', { ascending: false });
      }

      const incoming = incomingRes.data;

      if (incoming) {
        setIncomingApplications((incoming as any[]).map((app: any) => {
          const job = app.jobs || jobs.find((j: any) => j.id === app.job_id);
          const userProfile = app.applicant || allUsers.find((u: any) => u.id === app.applicant_id);
          const applicantData = {
            ...(userProfile || {}),
            ...(app.applicant_data || {}),
            name: app.applicant_data?.name || (userProfile as any)?.name || (userProfile as any)?.full_name || 'متقدم',
            avatar: app.applicant_data?.avatar || userProfile?.avatar || (userProfile as any)?.avatar_url || null,
            phone: app.applicant_data?.phone || userProfile?.phone || '',
            email: app.applicant_data?.email || userProfile?.email || '',
            location: app.applicant_data?.location || userProfile?.location || '',
            title: app.applicant_data?.title || userProfile?.title || (userProfile as any)?.headline || '',
            bio: app.applicant_data?.bio || userProfile?.bio || '',
            cvUrl: app.cv_url || app.applicant_data?.cvUrl || userProfile?.cvUrl || (userProfile as any)?.cv_url || null,
          };
          return {
            ...app,
            applicant_data: applicantData,
            applicantName: applicantData.name,
            jobTitle: job?.title || 'وظيفة غير معروفة',
            requirements: job?.requirements || job?.description || ''
          };
        }));
      } else {
        setIncomingApplications([]);
      }

      const { data: sent } = await (supabase as any)
        .from('job_applications')
        .select('*, jobs(title, company, description, requirements)')
        .eq('applicant_id', appUser.id)
        .order('created_at', { ascending: false });

      if (sent) {
        setSentApplications((sent as any[]).map((app: any) => {
          const job = jobs.find(j => j.id === app.job_id);
          return { ...app, jobTitle: job?.title || 'وظيفة', company: job?.company || 'شركة' };
        }));
      } else {
        setSentApplications([]);
      }
    } catch (err) {
      console.error('fetchApplications error:', err);
      setIncomingApplications([]);
      setSentApplications([]);
    } finally {
      clearTimeout(safetyTimer);
      setAppsLoading(false);
    }
  };

  useEffect(() => {
    if (!appUser?.id) return;
    fetchApplications();
    const channel = supabase.channel(`apps-sync-${appUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, fetchApplications)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [appUser?.id]);

  useEffect(() => {
    (window as any).refreshApplications = fetchApplications;
    return () => { delete (window as any).refreshApplications; };
  }, [fetchApplications]);

  const myPostedJobs = React.useMemo(() => jobs.filter(j => j.employer_id === appUser?.id), [jobs, appUser?.id]);

  // ── Smart Ranked Jobs ────────────────────────────────────────────────────────
  // Uses matchingService to rank jobs by relevance to the current user's title,
  // location, and skills. Falls back to date-order if no profile data exists.
  const rankedJobs = React.useMemo(
    () => filterAndRankJobs(jobs, appUser),
    [jobs, appUser]
  );

  const filteredJobs = React.useMemo(() => {
    const q = searchQuery.toLowerCase();
    return rankedJobs
      .filter(({ job }) => {
        const matchesSearch =
          !q ||
          job.title.toLowerCase().includes(q) ||
          job.company.toLowerCase().includes(q) ||
          (job.location || '').toLowerCase().includes(q) ||
          (job.description || '').toLowerCase().includes(q) ||
          (job.requirements || '').toLowerCase().includes(q);
        const matchesType = filterType === 'الكل' || (job as any).job_type === filterType || (job as any).jobType === filterType;
        return matchesSearch && matchesType;
      });
  }, [rankedJobs, searchQuery, filterType]);

  // ── Post Job ─────────────────────────────────────────────────────────────────
  const handlePostJob = async () => {
    if (!appUser) { addToast('يجب تسجيل الدخول أولاً', 'error'); return; }
    const company = formData.company.trim() || appUser.companyName || '';
    if (!formData.title.trim()) { addToast('يرجى إدخال المسمى الوظيفي', 'error'); return; }
    if (!company) { addToast('يرجى إدخال اسم الشركة', 'error'); return; }
    if (!formData.category || !formData.category.trim()) {
      addToast('يرجى تحديد قسم الوظيفة (مهنية، تقنية، إدارية...) - حقل إجباري ⚠️', 'error');
      return;
    }

    setIsPosting(true);

    // Safety timeout — resets loading after 15 seconds no matter what
    const safetyTimer = setTimeout(() => {
      setIsPosting(false);
      addToast('انتهت المهلة، يرجى المحاولة مجدداً', 'error');
    }, 15000);

    try {
      // لا نحفظ الصورة مرتين — نستخدم employer_id لجلب صورة صاحب العمل من جدول profiles عند العرض
      const postData = {
        title: formData.title,
        company,
        description: formData.description,
        requirements: formData.requirements,
        location: formData.location || appUser.location || 'عن بُعد',
        salary: formData.salary,
        jobType: formData.jobType,
        category: formData.category,
        working_hours: formData.working_hours,
        employer_id: appUser.id,
        imageUrl: formData.imageUrl || appUser.coverUrl || (appUser as any)?.cover_url || null,
        is_active: formData.is_active,
      };

      const { error } = editingJobId
        ? await jobService.updateJob(editingJobId, appUser.id, postData)
        : await jobService.postJob(postData);

      if (error) throw error;

      addToast(editingJobId ? '✅ تم تحديث الوظيفة!' : '🚀 تم نشر الوظيفة!');
      setFormData({ ...EMPTY_JOB_FORM, company: appUser.companyName || '' });
      setShowPostForm(false);
      setEditingJobId(null);
      refreshData();
    } catch (e: any) {
      addToast('فشل: ' + (e.message || 'خطأ غير معروف'), 'error');
    } finally {
      clearTimeout(safetyTimer);
      setIsPosting(false);
    }
  };

  // ── Post / Edit Course ───────────────────────────────────────────────────────────────
  const handlePostCourseSubmit = async () => {
    if (!appUser) { addToast('يجب تسجيل الدخول أولاً', 'error'); return; }
    if (!courseFormData.title.trim()) { addToast('يرجى إدخال عنوان الدورة', 'error'); return; }
    if (!courseFormData.description.trim()) { addToast('يرجى إدخال وصف الدورة', 'error'); return; }

    setIsPostingCourse(true);
    try {
      const payload = {
        ...courseFormData,
        provider_id: appUser.id,
        image_url: courseFormData.image_url || appUser.coverUrl || null,
      };
      const { error } = editingCourseId
        ? await courseService.updateCourse(editingCourseId, payload)
        : await courseService.postCourse(payload);
      if (error) throw new Error(error.message);

      addToast(editingCourseId ? '🎓 تم تحديث بيانات الدورة بنجاح!' : '🎓 تم نشر الدورة التدريبية بنجاح!');
      setShowPostCourse(false);
      setEditingCourseId(null);
      setEditCourseData(null);
      setCourseFormData(EMPTY_COURSE_FORM);
    } catch (e: any) {
      addToast('فشل النشر: ' + (e.message || ''), 'error');
    } finally {
      setIsPostingCourse(false);
    }
  };

  const handleEditCourse = (course: Course) => {
    setEditCourseData(course);
    setEditingCourseId(course.id);
    setCourseFormData({
      title: course.title || '',
      description: course.description || '',
      requirements: course.requirements || '',
      outcomes: course.outcomes || '',
      image_url: course.image_url || '',
      duration: course.duration || '',
      price: course.price || 'مجاني',
      level: course.level || 'مبتدئ',
      is_active: course.is_active !== false,
    });
    setShowPostCourse(true);
  };

  const handleEditJob = (job: Job) => {
    setFormData({
      title: job.title,
      company: job.company,
      description: job.description,
      requirements: job.requirements || '',
      location: job.location || '',
      salary: job.salary || '',
      jobType: (job as any).job_type || (job as any).jobType || 'دوام كامل',
      category: getJobCategory(job),
      working_hours: job.working_hours || '',
      imageUrl: job.image_url || '',
      is_active: job.is_active !== false,
    });
    setEditingJobId(job.id);
    setShowPostForm(true);
  };

  const calculateMatchScore = (jobRequirements: string) => {
    if (!appUser?.skills || !jobRequirements) return 0;
    const reqs = jobRequirements.toLowerCase();
    const skills = appUser.skills.map(s => s.toLowerCase());
    const matches = skills.filter(skill => reqs.includes(skill));
    if (skills.length === 0) return 0;
    // Cap at 100%, based on top 5 skills match
    const score = Math.round((matches.length / Math.min(skills.length, 5)) * 100);
    return Math.min(score, 100);
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!appUser?.id) { addToast('يجب تسجيل الدخول أولاً', 'error'); return; }
    try {
      const { error } = await jobService.deleteJob(jobId, appUser.id);
      if (error) throw error;
      refreshData();
      addToast('تم حذف الوظيفة');
      setJobToDelete(null);
    } catch (e: any) {
      addToast('خطأ: ' + e.message, 'error');
    }
  };

  const handleDeleteApplication = async (appId: string) => {
    if (!window.confirm('هل أنت متأكد؟')) return;
    try {
      const { error } = await supabase.from('job_applications').delete().eq('id', appId);
      if (error) throw error;
      fetchApplications();
      addToast('تم حذف الطلب');
    } catch (e: any) {
      addToast('خطأ: ' + e.message, 'error');
    }
  };

  const handleApplicationAction = async (appId: string, jobTitle: string, status: 'approved' | 'rejected' | 'pending') => {
    if (!appUser) return;
    try {
      const { error } = await (supabase as any).from('job_applications').update({ status }).eq('id', appId);
      if (error) throw error;
      
      // Zero notifications, zero calls — completely silent and clean status change
      fetchApplications();
      addToast(status === 'approved' ? '✅ تم قبول الطلب بنجاح' : status === 'rejected' ? 'تم الرفض' : '🔄 تمت الإعادة للمراجعة');
    } catch (e: any) {
      addToast('خطأ: ' + e.message, 'error');
    }
  };

  const handleQuickApply = async (job: Job) => {
    if (!appUser) return;
    if (job.is_active === false) { addToast('هذه الوظيفة مغلقة حالياً للتقديم', 'error'); return; }
    if (!job.employer_id) { addToast('بيانات صاحب العمل مفقودة', 'error'); return; }
    try {
      addToast('جاري إرسال طلبك... ⚡');
      const cvUrl = (appUser as any).cvUrl || (appUser as any).cv_url || '';
      const { error } = await jobService.applyToJob(appUser.id, job.employer_id, {
        jobId: job.id,
        skills: appUser.skills || [],
        cvUrl: cvUrl,
        applicantData: {
          name: appUser.name || (appUser as any).fullName || 'متقدم',
          avatar: appUser.avatar || '',
          title: (appUser as any).title || (appUser as any).specialty || '',
          industry: (appUser as any).industry || (appUser as any).specialty || '',
          location: (appUser as any).location || '',
          phone: (appUser as any).phone || '',
          bio: (appUser as any).bio || '',
          email: appUser.email || '',
          cvUrl: cvUrl,
        },
        experience: (appUser as any).experience || '',
        education: (appUser as any).education || '',
        coverLetter: 'أرغب في التقديم عبر ملفي الشخصي.'
      });
      if (error) throw error;
      addToast('🚀 تم التقديم بنجاح!');
      setSelectedJobDetails(null);
      fetchApplications();
    } catch (e: any) {
      addToast('فشل التقديم: ' + e.message, 'error');
    }
  };

  // ── إذا كان نموذج نشر الوظيفة مفتوحاً — اعرضه كصفحة كاملة ───────────────────────────
  if (showPostForm) {
    return (
      <JobPostForm
        show={true}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handlePostJob}
        isPosting={isPosting}
        onClose={() => { setShowPostForm(false); setEditingJobId(null); setFormData(EMPTY_JOB_FORM); }}
        isEditing={!!editingJobId}
        appUser={appUser}
      />
    );
  }

  // ── إذا كان نموذج نشر الدورة التدريبية مفتوحاً — اعرضه كصفحة كاملة متطابقة ─────────
  if (showPostCourse) {
    return (
      <CoursePostForm
        formData={courseFormData}
        setFormData={setCourseFormData}
        onSubmit={handlePostCourseSubmit}
        isPosting={isPostingCourse}
        onClose={() => {
          setShowPostCourse(false);
          setEditingCourseId(null);
          setEditCourseData(null);
          setCourseFormData(EMPTY_COURSE_FORM);
        }}
        isEditing={!!editingCourseId}
        appUser={appUser}
      />
    );
  }

  return (
    <div className="space-y-6 pb-36 min-h-screen" dir="rtl">
      
      {/* ── Main Tab Switcher: Jobs / Courses (Visible to Admins ONLY) ── */}
      {isAdmin && (
        <div className="flex gap-2 bg-white p-1.5 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-xl dark:shadow-none backdrop-blur-md">
          <button
            onClick={() => setMainTab('jobs')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all active:scale-[0.98] ${
              mainTab === 'jobs' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                : 'text-slate-900 dark:text-slate-400 hover:text-blue-600 dark:hover:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Briefcase size={16} />
            <span>الوظائف</span>
          </button>
          <button
            onClick={() => setMainTab('courses')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all active:scale-[0.98] ${
              mainTab === 'courses' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                : 'text-slate-900 dark:text-slate-400 hover:text-blue-600 dark:hover:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700/50'
            }`}
          >
            <BookOpen size={16} />
            <span>الدورات التدريبية 👑</span>
          </button>
        </div>
      )}

      {/* ── JOBS TAB ── */}
      <AnimatePresence mode="wait">
        {mainTab === 'jobs' && (
          <motion.div key="jobs" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            {/* Sub-tabs (Tailored per User Role — Employer / Recruiter vs Job Seeker) */}
            {(() => {
              // ✅ Single source of truth — seekers always blocked
              const isEmployerUser = isJobPoster(appUser);
              const availableSubTabs = isEmployerUser ? [
                { id: 'discover', label: 'اكتشف الفرص' },
                { id: 'my-posts', label: `وظائفي (${myPostedJobs.length})` },
                { id: 'requests', label: 'الطلبات الواردة', badge: incomingApplications.filter(a => a.status === 'pending' && !seenAppIds.has(a.id)).length },
                { id: 'analytics', label: 'إحصائيات' }
              ] : [
                { id: 'discover', label: 'اكتشف الوظائف والفرص' },
                { id: 'requests', label: `طلباتي المرسلة (${sentApplications.length})` }
              ];

              return (
                <div className="relative group">
                  <div 
                    className="flex gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-xl dark:shadow-none overflow-x-auto no-scrollbar scroll-smooth"
                    style={{ touchAction: 'pan-x pan-y' }}
                  >
                    {availableSubTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id as any)}
                        className={`relative flex-1 py-2.5 px-4 rounded-xl text-[10px] font-black transition-all active:scale-95 whitespace-nowrap flex items-center justify-center gap-2 ${
                          activeSubTab === tab.id 
                            ? 'bg-blue-600 text-white shadow-[0_10px_25px_rgba(37,99,235,0.3)] ring-2 ring-blue-600/10' 
                            : 'text-slate-900 dark:text-slate-400 hover:text-blue-600 dark:hover:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700/30'
                        }`}
                      >
                        {tab.label}
                        {tab.badge !== undefined && tab.badge > 0 && (
                          <span className={`absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black shadow-md border-2 border-white dark:border-slate-800 ${
                            activeSubTab === tab.id ? 'bg-white text-blue-600' : 'bg-red-500 text-white'
                          }`}>
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {activeSubTab === 'discover' && (
              <>
                <div className="bg-white dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-800 dark:text-white">الفرص المهنية</h2>
                      <button
                        onClick={async () => {
                          if (refreshData) await refreshData();
                          addToast('تم تحديث قائمة الوظائف بنجاح 🔄');
                        }}
                        className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-500 hover:text-blue-600 transition-all border border-slate-100 dark:border-slate-700 shadow-sm active:scale-95"
                        title="تحديث الوظائف"
                      >
                        <RefreshCw size={13} />
                      </button>
                    </div>
                    {isJobPoster(appUser) && (
                      <button onClick={() => setShowPostForm(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-full font-black text-xs hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center gap-2 hover:bg-blue-700 transition-all border border-transparent shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer">
                        <Plus size={16} /> نشر وظيفة
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Search size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl pr-10 pl-4 py-3 text-sm font-bold outline-none dark:text-white transition-all"
                      placeholder="ابحث عن الوظائف..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(sanitizeInput(e.target.value))}
                    />
                  </div>
                </div>
                {/* Smart match hint for seekers */}
                {appUser?.role === 'seeker' && (appUser?.title || appUser?.location) && filteredJobs.some(r => r.score > 0) && (
                  <div className="flex items-center gap-2 px-1 mb-1">
                    <Sparkles size={12} className="text-blue-500" />
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                      مرتبة حسب تطابقها مع ملفك الشخصي
                    </p>
                  </div>
                )}
                <div className={filteredJobs.length >= 3 ? "flex flex-col gap-2" : "grid gap-4 md:grid-cols-2 lg:grid-cols-3"}>
                  {filteredJobs.length === 0 && !appsLoading ? (
                    <div className="col-span-full py-16 text-center">
                      <Briefcase className="mx-auto text-slate-200 mb-3" size={40} />
                      <p className="text-sm font-bold text-slate-400">لا توجد وظائف مطابقة</p>
                    </div>
                  ) : filteredJobs.map(({ job, score }, i) => (
                    <JobCard 
                      key={job.id} 
                      job={job} 
                      onClick={setSelectedJobDetails} 
                      delay={i * 0.04} 
                      compact={filteredJobs.length >= 3}
                      matchScore={score > 0 ? score : calculateMatchScore(job.requirements || job.description || '')}
                      onPublisherClick={onPublisherClick}
                    />
                  ))}
                </div>
              </>
            )}

            {activeSubTab === 'my-posts' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between bg-white dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white">الوظائف والفرص المعلنة من قبلك</h3>
                    <p className="text-[11px] font-bold text-slate-400">إدارة التعديل، المسح، ومتابعة الطلبات المتقدمة</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingJobId(null);
                      setFormData({ ...EMPTY_JOB_FORM, company: appUser?.companyName || '' });
                      setShowPostForm(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-black text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    <Plus size={16} /> إعلان وظيفة جديدة
                  </button>
                </div>
                <MyJobsView 
                  myPostedJobs={myPostedJobs} 
                  onDeleteJob={setJobToDelete} 
                  onEditJob={handleEditJob} 
                  onViewJob={setSelectedJobDetails} 
                  allUsers={allUsers}
                  onUserClick={(userId: string) => {
                    const u = allUsers.find((x: AppUser) => x.id === userId);
                    if (u && (appUser as any).setSelectedProfile) {
                      (appUser as any).setSelectedProfile(u);
                    } else {
                      const event = new CustomEvent('viewUserProfile', { detail: userId });
                      window.dispatchEvent(event);
                    }
                  }}
                />
              </div>
            )}

            {activeSubTab === 'requests' && (
              appsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => <SkeletonApplicationCard key={i} />)}
                </div>
              ) : (
                <ApplicationsListView
                  incomingApplications={isJobPoster(appUser) ? incomingApplications : sentApplications}
                  isSentView={!isJobPoster(appUser)}
                  handleApplicationAction={handleApplicationAction}
                  onDeleteApplication={handleDeleteApplication}
                  addToast={addToast}
                  appUser={appUser}
                />
              )
            )}

            {activeSubTab === 'analytics' && (
              <AnalyticsDashboard
                incomingApplications={incomingApplications}
                myPostedJobs={myPostedJobs}
                loading={appsLoading}
              />
            )}
          </motion.div>
        )}

        {/* ── COURSES TAB (Admin Only) ── */}
        {mainTab === 'courses' && isAdmin && (
          <motion.div key="courses" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
            <CoursesView 
              appUser={appUser}
              allUsers={allUsers}
              addToast={addToast} 
              onPostCourse={() => { 
                if (!appUser?.isAdmin) {
                  addToast('هذه الخاصية مخصصة للإدارة فقط', 'error');
                  return;
                }
                setEditingCourseId(null); 
                setEditCourseData(null); 
                setShowPostCourse(true); 
              }} 
              onEditCourse={handleEditCourse}
              onOpenProfile={(user) => {
                const event = new CustomEvent('viewUserProfile', { detail: user.id });
                window.dispatchEvent(event);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>




      {/* Delete Confirmation */}
      <AnimatePresence>
        {jobToDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center text-red-500 mx-auto mb-6">
                <Plus size={32} className="rotate-45" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">تأكيد الحذف</h3>
              <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
                هل أنت متأكد؟ لا يمكن التراجع.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setJobToDelete(null)} className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm hover:bg-slate-200 transition-all">
                  إلغاء
                </button>
                <button onClick={() => handleDeleteJob(jobToDelete)} className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-black text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-200">
                  حذف
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Job Detail Feed Page (Full View with Snap-Scroll Navigation) */}
      {selectedJobDetails && (
        <DetailFeedPage
          type="job"
          items={filteredJobs.length > 0 ? filteredJobs.map(r => r.job) : jobs}
          initialIndex={Math.max(0, (filteredJobs.length > 0 ? filteredJobs.map(r => r.job) : jobs).findIndex((j: any) => j.id === selectedJobDetails.id))}
          onClose={() => setSelectedJobDetails(null)}
          onApplyJob={(job) => {
            if (job.is_active === false) { 
              addToast('هذه الوظيفة مغلقة للتقديم', 'error'); 
              return; 
            }
            setSelectedJobDetails(null);
            onApplyJob(job);
          }}
          onNavigateHome={() => {
            setSelectedJobDetails(null);
            if (setActiveTab) {
              setActiveTab('home');
            }
          }}
          onNavigateTab={(tab) => {
            setSelectedJobDetails(null);
            if (setActiveTab) {
              setActiveTab(tab);
            }
          }}
          appUser={appUser}
        />
      )}
    </div>
  );
}
