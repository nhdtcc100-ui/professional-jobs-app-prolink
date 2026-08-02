import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Briefcase, BookOpen } from 'lucide-react';
import { jobService } from '../../lib/services/jobService';
import { courseService } from '../../lib/services/courseService';
import { supabase } from '../../lib/supabase';
import { Job, AppUser, Course } from '../../types';
import { useAppContext } from '../../contexts/AppContext';
import { SkeletonJobCardCompact, SkeletonJobCard, SkeletonApplicationCard } from '../ui';
import {
  JobCard,
  JobDetailModal,
  JobPostForm,
  ApplicationsListView,
  MyJobsView,
  CoursesView,
  PostCourseModal,
  AnalyticsDashboard,
} from './missions';

interface MissionsViewProps {
  jobs: Job[];
  appUser: AppUser | null;
  allUsers: AppUser[];
  addToast: (m: string, t?: any) => void;
  messages: any[];
  onApplyJob: (job: Job) => void;
}

const EMPTY_JOB_FORM = {
  title: '', company: '', description: '', requirements: '',
  location: '', salary: '', jobType: 'دوام كامل', working_hours: '', imageUrl: '', is_active: true
};

type MainTab = 'jobs' | 'courses';
type JobSubTab = 'discover' | 'my-posts' | 'requests' | 'analytics';

export function MissionsView({ jobs, appUser, allUsers, addToast, messages, onApplyJob }: MissionsViewProps) {
  const { refreshData } = useAppContext();

  const [mainTab, setMainTab] = useState<MainTab>('jobs');
  const [activeSubTab, setActiveSubTab] = useState<JobSubTab>('discover');
  const [isPosting, setIsPosting] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [showPostCourse, setShowPostCourse] = useState(false);
  const [selectedJobDetails, setSelectedJobDetails] = useState<Job | null>(null);
  const [formData, setFormData] = useState(EMPTY_JOB_FORM);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('الكل');
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseData, setEditCourseData] = useState<Course | null>(null);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [incomingApplications, setIncomingApplications] = useState<any[]>([]);
  const [sentApplications, setSentApplications] = useState<any[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  // ── Applications ─────────────────────────────────────────────────────────────
  const fetchApplications = async () => {
    if (!appUser?.id) return;
    setAppsLoading(true);
    try {
      const { data: incoming } = await (supabase as any)
        .from('job_applications')
        .select('*, jobs(title, company, description, requirements)')
        .eq('employer_id', appUser.id)
        .order('created_at', { ascending: false });

      if (incoming) {
        setIncomingApplications((incoming as any[]).map((app: any) => {
          const job = app.jobs || jobs.find((j: any) => j.id === app.job_id);
          return {
            ...app,
            applicantName: app.applicant_data?.name || 'متقدم مجهول',
            jobTitle: job?.title || 'وظيفة غير معروفة',
            requirements: job?.requirements || job?.description || ''
          };
        }));
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
      }
    } catch (err) {
      console.error('fetchApplications error:', err);
    } finally {
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
  const filteredJobs = React.useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch =
        !searchQuery ||
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.location || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'الكل' || (job as any).jobType === filterType;
      return matchesSearch && matchesType;
    });
  }, [jobs, searchQuery, filterType]);

  // ── Post Job ─────────────────────────────────────────────────────────────────
  const handlePostJob = async () => {
    if (!appUser) { addToast('يجب تسجيل الدخول أولاً', 'error'); return; }
    const company = formData.company.trim() || appUser.companyName || '';
    if (!formData.title.trim()) { addToast('يرجى إدخال المسمى الوظيفي', 'error'); return; }
    if (!company) { addToast('يرجى إدخال اسم الشركة', 'error'); return; }

    setIsPosting(true);

    // Safety timeout — resets loading after 15 seconds no matter what
    const safetyTimer = setTimeout(() => {
      setIsPosting(false);
      addToast('انتهت المهلة، يرجى المحاولة مجدداً', 'error');
    }, 15000);

    try {
      const finalImageUrl = appUser.coverUrl || appUser.avatar || '';
      const postData = {
        title: formData.title,
        company,
        description: formData.description,
        requirements: formData.requirements,
        location: formData.location || appUser.location || 'عن بُعد',
        salary: formData.salary,
        jobType: formData.jobType,
        working_hours: formData.working_hours,
        imageUrl: finalImageUrl,
        employer_id: appUser.id,
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
  const handlePostCourse = async (data: any) => {
    try {
      const { error } = editingCourseId
        ? await courseService.updateCourse(editingCourseId, data)
        : await courseService.postCourse(data);
      if (error) throw new Error(error.message);
      addToast(editingCourseId ? '🎓 تم تحديث الدورة بنجاح!' : '🎓 تم نشر الدورة بنجاح!');
      setShowPostCourse(false);
      setEditingCourseId(null);
      setEditCourseData(null);
    } catch (e: any) {
      addToast('فشل العملية: ' + e.message, 'error');
      throw e;
    }
  };

  const handleEditCourse = (course: Course) => {
    setEditCourseData(course);
    setEditingCourseId(course.id);
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
      
      // Logic moved to interview scheduler or managed separately by user
      fetchApplications();
      addToast(status === 'approved' ? '✅ تم تحديث الحالة للمراجعة' : status === 'rejected' ? 'تم الرفض' : '🔄 تمت الإعادة للمراجعة');
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
      const { error } = await jobService.applyToJob(appUser.id, job.employer_id, {
        jobId: job.id,
        skills: appUser.skills || [],
        applicantData: { name: appUser.name, avatar: appUser.avatar },
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

  return (
    <div className="space-y-6 pb-20 min-h-screen" dir="rtl">
      
      {/* ── Main Tab Switcher: Jobs / Courses ── */}
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
          <span>الدورات التدريبية</span>
        </button>
      </div>

      {/* ── JOBS TAB ── */}
      <AnimatePresence mode="wait">
        {mainTab === 'jobs' && (
          <motion.div key="jobs" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            {/* Sub-tabs (Premium Scrollable Bar) */}
            <div className="relative group">
              <div className="flex gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-xl dark:shadow-none overflow-x-auto no-scrollbar scroll-smooth">
                {[
                  { id: 'discover', label: 'اكتشف', icon: null },
                  { id: 'my-posts', label: `وظائفي (${myPostedJobs.length})`, icon: null },
                  { 
                    id: 'requests', 
                    label: 'الطلبات', 
                    badge: incomingApplications.filter(a => a.status === 'pending').length 
                  },
                  { id: 'analytics', label: 'إحصائيات', icon: null },
                ].map((tab) => (
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

            {activeSubTab === 'discover' && (
              <>
                <div className="bg-white dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">الفرص المهنية</h2>
                    {appUser?.isAdmin && (
                      <button onClick={() => setShowPostForm(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-full font-black text-xs hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center gap-2 hover:bg-blue-700 transition-all border border-transparent shadow-lg shadow-blue-500/20">
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
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className={filteredJobs.length >= 3 ? "flex flex-col gap-2" : "grid gap-4 md:grid-cols-2 lg:grid-cols-3"}>
                  {filteredJobs.length === 0 && !appsLoading ? (
                    <div className="col-span-full py-16 text-center">
                      <Briefcase className="mx-auto text-slate-200 mb-3" size={40} />
                      <p className="text-sm font-bold text-slate-400">لا توجد وظائف مطابقة</p>
                    </div>
                  ) : filteredJobs.map((job, i) => (
                    <JobCard 
                      key={job.id} 
                      job={job} 
                      onClick={setSelectedJobDetails} 
                      delay={i * 0.04} 
                      compact={filteredJobs.length >= 3}
                      matchScore={calculateMatchScore(job.requirements || job.description || '')}
                    />
                  ))}
                </div>
                <JobDetailModal
                  job={selectedJobDetails}
                  onClose={() => setSelectedJobDetails(null)}
                  onApply={(job, text) => {
                    if (job.is_active === false) { addToast('هذه الوظيفة مغلقة للتقديم', 'error'); return; }
                    if (text) {
                      // Direct application if text is provided
                      const { handleApplyJob } = (useAppContext as any)();
                      if (handleApplyJob) handleApplyJob(job, text, null);
                    } else {
                      onApplyJob(job);
                    }
                    setSelectedJobDetails(null);
                  }}
                  onQuickApply={handleQuickApply}
                  appUser={appUser}
                  allUsers={allUsers}
                />
              </>
            )}

            {activeSubTab === 'my-posts' && (
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
                    // Fallback search event or direct access via window
                    const event = new CustomEvent('viewUserProfile', { detail: userId });
                    window.dispatchEvent(event);
                  }
                }}
              />
            )}

            {activeSubTab === 'requests' && (
              appsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => <SkeletonApplicationCard key={i} />)}
                </div>
              ) : (
                <ApplicationsListView
                  incomingApplications={incomingApplications}
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

        {/* ── COURSES TAB ── */}
        {mainTab === 'courses' && (
          <motion.div key="courses" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
            <CoursesView 
              appUser={appUser} 
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
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <JobPostForm
        show={showPostForm}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handlePostJob}
        isPosting={isPosting}
        onClose={() => { setShowPostForm(false); setEditingJobId(null); setFormData(EMPTY_JOB_FORM); }}
        isEditing={!!editingJobId}
        appUser={appUser}
      />

      <PostCourseModal
        show={showPostCourse}
        onClose={() => { setShowPostCourse(false); setEditingCourseId(null); setEditCourseData(null); }}
        onSubmit={handlePostCourse}
        appUser={appUser}
        initialData={editCourseData}
        isEditing={!!editingCourseId}
      />

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
    </div>
  );
}
