import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, DollarSign, Clock, ArrowLeft, Building2, 
  Send, CheckCircle, XCircle, Bookmark, Sparkles, 
  Briefcase, Shield, Edit2, Trash2, Loader2, Check, X
} from 'lucide-react';
import { Job, AppUser } from '../../../types';
import { useAppContext } from '../../../contexts/AppContext';
import { safeTimeAgo } from '../../../lib/utils/formatDate';
import { supabase } from '../../../lib/supabase';
import { getJobCategory, cleanJobDescription } from '../../../lib/utils/jobCategoryUtils';

interface JobCardProps {
  job: Job;
  onClick: (job: Job) => void;
  delay?: number;
  compact?: boolean;
  matchScore?: number;
  onEditJob?: (job: Job) => void;
  onDeleteJob?: (jobId: string) => void;
  onPublisherClick?: (employer: any) => void;
}

export const JobCard = React.memo(({ job, onClick, delay = 0, compact = false, matchScore = 0, onEditJob, onDeleteJob, onPublisherClick }: JobCardProps) => {
  const { allUsers, appUser, addToast, refreshData } = useAppContext();
  
  const employer = React.useMemo(() => allUsers.find(u => u.id === job.employer_id), [allUsers, job.employer_id]);
  const avatarUrl = (job as any).employer_avatar || (job as any).employerAvatar || employer?.avatar || (employer as any)?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company)}&background=0a66c2&color=fff`;
  
  // Ensure cover and avatar are NEVER the same image (prevent duplicate avatar on cover)
  let rawCover = (job as any).employer_cover || (job as any).employerCover || job.image_url || employer?.coverUrl || (employer as any)?.cover_url;
  if (rawCover && (rawCover === avatarUrl || rawCover === employer?.avatar)) {
    rawCover = (job as any).employer_cover || (job as any).employerCover || employer?.coverUrl || (employer as any)?.cover_url || null;
  }
  const coverUrl = rawCover || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80';
  const isActive = job.is_active !== false;

  // ── Bookmark state (localStorage) ──────────────────────────────
  const getSaved = () => {
    try { return JSON.parse(localStorage.getItem('prolink_saved_jobs') || '[]') as string[]; } catch { return []; }
  };
  const [isBookmarked, setIsBookmarked] = useState(() => getSaved().includes(job.id));

  const toggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    const saved = getSaved();
    const next = isBookmarked ? saved.filter((id: string) => id !== job.id) : [...saved, job.id];
    localStorage.setItem('prolink_saved_jobs', JSON.stringify(next));
    setIsBookmarked(!isBookmarked);
  };

  // Check if current user is the publisher of this job or admin
  const isPublisher = !!(
    appUser?.id && (
      (job.employer_id && appUser.id === job.employer_id) ||
      ((job as any).employerId && appUser.id === (job as any).employerId) ||
      ((job as any).authorId && appUser.id === (job as any).authorId) ||
      ((job as any).author_id && appUser.id === (job as any).author_id) ||
      (job.employer_id && appUser.id.toLowerCase() === job.employer_id.toLowerCase()) ||
      ((job as any).employerId && appUser.id.toLowerCase() === (job as any).employerId.toLowerCase()) ||
      ((job as any).authorId && appUser.id.toLowerCase() === (job as any).authorId.toLowerCase()) ||
      ((job as any).author_id && appUser.id.toLowerCase() === (job as any).author_id.toLowerCase())
    )
  );
  const isAdmin = !!((appUser as any)?.isAdmin || (appUser as any)?.role === 'admin');
  const isPublisherOrAdmin = isPublisher || isAdmin;

  // ── Inline Edit State ──────────────────────────────────────────
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [editTitle, setEditTitle] = useState(job.title);
  const [editCompany, setEditCompany] = useState(job.company);
  const [editLocation, setEditLocation] = useState(job.location || '');
  const [editSalary, setEditSalary] = useState(job.salary || '');
  const [editDescription, setEditDescription] = useState(job.description || '');
  const [isSavingInline, setIsSavingInline] = useState(false);

  const handleInlineEditOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(job.title);
    setEditCompany(job.company);
    setEditLocation(job.location || '');
    setEditSalary(job.salary || '');
    setEditDescription(job.description || '');
    setIsEditingInline(true);
  };

  const handleInlineEditSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editTitle.trim()) return;
    setIsSavingInline(true);
    try {
      const updates: any = {
        title: editTitle.trim(),
        company: editCompany.trim(),
        location: editLocation.trim(),
        salary: editSalary.trim(),
        description: editDescription.trim(),
      };
      const { error } = await (supabase as any).from('jobs').update(updates).eq('id', job.id);
      if (error) throw error;
      // Optimistic update
      (job as any).title = updates.title;
      (job as any).company = updates.company;
      (job as any).location = updates.location;
      (job as any).salary = updates.salary;
      (job as any).description = updates.description;
      if (addToast) addToast('تم تحديث الوظيفة بنجاح ✅');
      setIsEditingInline(false);
    } catch (err: any) {
      if (addToast) addToast('فشل التحديث: ' + err.message, 'error');
    } finally {
      setIsSavingInline(false);
    }
  };

  const handleDeleteJobCard = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!appUser) return;
    if (!window.confirm('هل أنت متأكد من حذف هذه الوظيفة؟')) return;
    if (onDeleteJob) { onDeleteJob(job.id); return; }
    try {
      const { error } = await (supabase as any).from('jobs').delete().eq('id', job.id);
      if (error) throw error;
      if (refreshData) refreshData();
      if (addToast) addToast('تم حذف الوظيفة بنجاح ✅');
    } catch (err: any) {
      if (addToast) addToast('فشل حذف الوظيفة: ' + err.message, 'error');
    }
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(delay, 0.3), duration: 0.3 }}
        onClick={() => onClick(job)}
        className={`group bg-white dark:bg-slate-800/90 border rounded-[1.5rem] overflow-hidden cursor-pointer transition-all duration-300 active:scale-[0.99] flex items-center p-3 gap-4 border-slate-100 dark:border-slate-700 hover:shadow-md hover:border-blue-100 dark:hover:border-blue-900 ${!isActive && 'opacity-70'}`}
      >
        <div className="w-12 h-12 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900 shrink-0">
          <img src={avatarUrl} alt={job.company} className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-black text-slate-800 dark:text-white text-sm truncate group-hover:text-[#0a66c2] transition-colors">
            {job.title}
          </h4>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] font-bold text-slate-400 truncate">{job.company}</span>
            {job.location && (
              <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                <MapPin size={10} /> {job.location}
              </span>
            )}
            {job.salary && (
              <span className="text-[10px] font-black text-emerald-500">
                {job.salary}
              </span>
            )}
            {matchScore > 0 && (
               <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                 <Sparkles size={10} className="animate-pulse" /> {matchScore}% مطابقة
               </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex flex-col items-end gap-0.5 mr-1">
            <span className="text-[9px] font-black text-slate-300 dark:text-slate-600">{safeTimeAgo(job.postedAt || (job as any).created_at)}</span>
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${isActive ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-100 text-slate-400'}`}>
              {isActive ? 'مفتوح' : 'مغلق'}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm border border-transparent dark:border-slate-700">
            <ArrowLeft size={14} />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(delay, 0.4), duration: 0.4 }}
      onClick={() => onClick(job)}
      className={`group rounded-[2.5rem] overflow-hidden cursor-pointer transition-all duration-700 active:scale-[0.98] flex flex-col h-full bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800
        ${isActive 
          ? 'shadow-[0_15px_40px_rgba(0,0,0,0.03)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-[0_40px_80px_rgba(10,102,194,0.15)] hover:-translate-y-2' 
          : 'opacity-75 hover:opacity-100 shadow-sm'
        }`}
    >
      {/* Top Section: Cover */}
      <div className="relative h-32 shrink-0 overflow-hidden">
        <img 
          src={coverUrl} 
          alt="Cover" 
          className={`w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 ${!isActive ? 'grayscale-[60%]' : ''}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-black/20 to-transparent opacity-80" />
        
        {/* Status Badge — prominently placed */}
        <div className={`absolute top-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border shadow-2xl transition-all duration-500 hover:scale-110 ${
          isActive 
            ? 'bg-emerald-500 text-white border-emerald-400/50 shadow-emerald-500/40' 
            : 'bg-slate-800/90 border-slate-700/50 text-slate-300 shadow-black/40'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
          {isActive ? 'مفتوح للتقديم' : 'مغلق حالياً'}
        </div>

        {/* Job Type Tag */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span className="px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-[10px] font-black text-white uppercase tracking-widest shadow-xl transition-all duration-500 hover:bg-white/20 hover:scale-110">
            {job.jobType || 'دوام كامل'}
          </span>
        </div>

        {/* AI Match Badge - Premium Floating */}
        {matchScore > 0 && (
          <div className="absolute bottom-4 left-4 z-20">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 text-white px-5 py-2.5 rounded-2xl shadow-2xl shadow-blue-500/30 flex items-center gap-2.5 border border-white/20 backdrop-blur-md"
            >
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles size={16} className="text-white animate-pulse" />
              </div>
              <div className="flex flex-col -gap-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none">AI Match</span>
                <span className="text-sm font-black leading-tight">طابق {matchScore}%</span>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-7 relative flex-1 pb-7">
        {/* Avatar — clickable to open publisher profile */}
        <div className="relative -mt-12 mb-5 z-10">
          <div
            className={`w-20 h-20 rounded-[2rem] border-4 border-white dark:border-[#0f172a] bg-white dark:bg-slate-800 shadow-[0_15px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_15px_30px_rgba(0,0,0,0.6)] overflow-hidden group-hover:rotate-[6deg] group-hover:scale-110 group-hover:shadow-[0_20px_40px_rgba(10,102,194,0.4)] transition-all duration-700 ${employer ? 'cursor-pointer' : ''}`}
            onClick={(e) => {
              if (!employer || !onPublisherClick) return;
              e.stopPropagation();
              onPublisherClick(employer);
            }}
            title={employer?.name ? `عرض ملف ${employer.name}` : undefined}
          >
            <img src={avatarUrl} alt={job.company} className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Info & Title with Edit/Delete Buttons */}
        <div className="relative mb-6">
          <div className="absolute -inset-x-7 -inset-y-3 bg-blue-50/50 dark:bg-blue-900/10 border-y border-blue-100/50 dark:border-blue-900/20 -z-0" />
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="space-y-1.5 min-w-0 flex-1">
              <h4 className="font-black text-slate-800 dark:text-white text-xl leading-tight group-hover:text-[#0a66c2] dark:group-hover:text-blue-400 transition-colors tracking-tight line-clamp-1">
                {job.title}
              </h4>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-black text-xs uppercase tracking-wide flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Building2 size={14} className="text-[#0a66c2] dark:text-blue-500 shrink-0" />
                  <span className="truncate">{job.company}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-black border border-blue-200/50 dark:border-blue-800/50 shrink-0 shadow-xs">
                  {getJobCategory(job)}
                </span>
              </div>
            </div>

            {/* Edit & Delete Buttons — Next to Job Title */}
            {isPublisherOrAdmin && (
              <div
                className="flex items-center gap-1.5 shrink-0 bg-white/95 dark:bg-slate-800/95 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditJob) {
                      onEditJob(job);
                    } else {
                      handleInlineEditOpen(e);
                    }
                  }}
                  className="p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-95 border border-blue-100 dark:border-blue-800/40 cursor-pointer"
                  title="تعديل الوظيفة"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={handleDeleteJobCard}
                  className="p-2 bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-95 border border-red-100 dark:border-red-800/40 cursor-pointer"
                  title="حذف الوظيفة"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Inline Edit Overlay ── */}
        <AnimatePresence>
          {isEditingInline && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-40 flex flex-col bg-white dark:bg-[#0f172a] rounded-[2.5rem] overflow-y-auto p-6 border border-blue-200 dark:border-blue-800 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                    <Edit2 size={15} className="text-white" />
                  </div>
                  <span className="font-black text-sm text-slate-800 dark:text-white">تعديل الوظيفة</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditingInline(false); }}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Fields */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">عنوان الوظيفة *</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white transition-all"
                    placeholder="عنوان الوظيفة"
                    dir="auto"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">اسم الشركة</label>
                  <input
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white transition-all"
                    placeholder="اسم الشركة"
                    dir="auto"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">الموقع</label>
                    <input
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white transition-all"
                      placeholder="الموقع / عن بُعد"
                      dir="auto"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">الراتب</label>
                    <input
                      value={editSalary}
                      onChange={(e) => setEditSalary(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white transition-all"
                      placeholder="الراتب المتوقع"
                      dir="auto"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">الوصف</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white resize-none transition-all"
                    placeholder="وصف الوظيفة..."
                    dir="auto"
                  />
                </div>
              </div>

              {/* Save/Cancel Buttons */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditingInline(false); }}
                  disabled={isSavingInline}
                  className="flex-1 py-2.5 rounded-2xl text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <X size={13} /> إلغاء
                </button>
                <button
                  onClick={handleInlineEditSave}
                  disabled={isSavingInline || !editTitle.trim()}
                  className="flex-1 py-2.5 rounded-2xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSavingInline
                    ? <><Loader2 size={13} className="animate-spin" /> جاري الحفظ...</>
                    : <><Check size={13} /> حفظ التعديلات</>
                  }
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Meta Grid - Upgraded Professional Organised Layout */}
        <div className="grid grid-cols-2 gap-2.5 mt-6">
          <div className="flex items-center gap-2.5 px-3.5 py-3 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all duration-300">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <MapPin size={13} />
            </div>
            <div className="flex flex-col min-w-0">
               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">المكان</span>
               <span className="text-[10px] font-black text-slate-600 dark:text-slate-200 truncate">{job.location || 'عن بُعد'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 py-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/30 dark:border-emerald-900/20">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
              <DollarSign size={13} />
            </div>
            <div className="flex flex-col min-w-0">
               <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">الراتب</span>
               <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 truncate">{job.salary || 'يحدد لاحقاً'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 py-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/30 dark:border-indigo-900/20">
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Clock size={13} />
            </div>
            <div className="flex flex-col min-w-0">
               <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">الساعات</span>
               <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 truncate">{job.working_hours || 'مرن'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 py-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100/30 dark:border-amber-900/20">
            <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
              <Briefcase size={13} />
            </div>
            <div className="flex flex-col min-w-0">
               <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">النوع</span>
               <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 truncate">{job.jobType || 'دوام كامل'}</span>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed mt-5 line-clamp-2" dir="auto">
          {cleanJobDescription(job.description)}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isPublisher ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-black">
                <Building2 size={12} />
                أنت ناشر هذه الوظيفة 🏢
              </span>
            ) : (
              <>
                <Clock size={12} className="text-blue-500" />
                <span>{safeTimeAgo(job.postedAt || (job as any).created_at)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 text-[11px] font-black transition-all duration-500 group-hover:gap-4 ${isActive ? 'text-[#0a66c2] dark:text-blue-400' : 'text-slate-400'}`}>
              <span className="uppercase tracking-widest">{isActive ? 'تفاصيل العرض' : 'عرض البيانات'}</span>
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30 group-hover:rotate-[-90deg] transition-transform duration-500">
                <ArrowLeft size={16} />
              </div>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
});
