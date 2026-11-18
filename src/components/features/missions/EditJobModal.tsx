import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Briefcase, X } from "lucide-react";
import { Job } from "../../../types";
import { JobPostForm } from "./JobPostForm";
import { supabase } from "../../../lib/supabase";
import { useAppContext } from "../../../contexts/AppContext";
import { getJobCategory, encodeCategoryInDescription } from "../../../lib/utils/jobCategoryUtils";

interface EditJobModalProps {
  job: Job | null;
  onClose: () => void;
  onSuccess?: (updatedJob: Job) => void;
}

export const EditJobModal = ({ job, onClose, onSuccess }: EditJobModalProps) => {
  const { addToast, refreshData, appUser, updateJobInState } = useAppContext();
  const [isPosting, setIsPosting] = useState(false);
  const [formData, setFormData] = useState({
    title: job?.title || "",
    company: job?.company || "",
    description: job?.description || "",
    requirements: job?.requirements || "",
    location: job?.location || "",
    salary: job?.salary || "",
    jobType: job?.jobType || "full-time",
    category: job ? getJobCategory(job) : "أخرى",
    working_hours: (job as any)?.working_hours || "",
    imageUrl: (job as any)?.imageUrl || (job as any)?.image_url || "",
    is_active: job?.is_active !== false,
  });

  if (!job) return null;

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.company.trim()) {
      addToast("يرجى تعبئة العنوان واسم الشركة", "error");
      return;
    }
    if (!formData.category || !formData.category.trim()) {
      addToast("يرجى اختيار قسم الوظيفة (حقل إجباري)", "error");
      return;
    }
    setIsPosting(true);
    try {
      const descriptionWithCat = encodeCategoryInDescription(formData.description.trim(), formData.category.trim());
      const payload: Record<string, any> = {
        title: formData.title.trim(),
        company: formData.company.trim(),
        description: descriptionWithCat,
        requirements: formData.requirements.trim(),
        location: formData.location.trim(),
        salary: formData.salary.trim(),
        job_type: formData.jobType,
        working_hours: formData.working_hours.trim(),
        image_url: formData.imageUrl.trim() || null,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      };
      // Optimistic state & cache update immediately
      updateJobInState(job.id, {
        title: formData.title.trim(),
        company: formData.company.trim(),
        description: descriptionWithCat,
        requirements: formData.requirements.trim(),
        location: formData.location.trim(),
        salary: formData.salary.trim(),
        jobType: formData.jobType,
        workingHours: formData.working_hours.trim(),
        working_hours: formData.working_hours.trim(),
        image_url: formData.imageUrl.trim() || undefined,
        is_active: formData.is_active,
        category: formData.category.trim(),
      });

      const { data, error } = await (supabase as any)
        .from("jobs")
        .update(payload)
        .eq("id", job.id)
        .select()
        .single();
      if (error) throw error;
      addToast("تم تحديث الوظيفة بنجاح ✅");
      if (onSuccess && data) onSuccess(data as Job);
      if (refreshData) refreshData();
      onClose();
    } catch (err: any) {
      addToast("فشل تحديث الوظيفة: " + err.message, "error");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-50 dark:bg-[#090d16] flex flex-col min-h-screen text-slate-900 dark:text-white"
        dir="rtl"
      >
        {/* Full-Page Top Navigation Header */}
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#090d16]/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-4 md:px-8 py-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <ArrowRight size={18} />
              <span className="text-xs font-black hidden sm:inline">الرجوع للتغذية</span>
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Briefcase size={18} />
              </div>
              <div>
                <h1 className="text-sm md:text-base font-black text-slate-800 dark:text-white leading-none">تعديل بيانات الوظيفة والفرصة المهنية</h1>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1">تحديث وتطوير تفاصيل وشروط العمل بسهولة</p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </header>

        {/* Scrollable Page Body Container */}
        <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8 space-y-6 pb-28">
          <JobPostForm
            formData={formData}
            setFormData={setFormData as any}
            onSubmit={handleSubmit}
            isPosting={isPosting}
            onClose={onClose}
            isEditing={true}
            appUser={appUser}
            asPage={true}
          />
        </main>
      </motion.div>
    </AnimatePresence>
  );
};
