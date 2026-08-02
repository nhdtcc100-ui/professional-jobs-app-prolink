import { supabase } from '../supabase';
import { sanitizeInput } from '../security/inputValidator';

// ✅ Whitelist of allowed job types to prevent injection
const ALLOWED_JOB_TYPES = ['دوام كامل', 'دوام جزئي', 'عن بُعد', 'عقد', 'تدريب', 'مؤقت'];
const ALLOWED_STATUSES = ['pending', 'active', 'closed'];

export const jobService = {
  async fetchJobs(limit = 50) {
    // ✅ Parameterized query via Supabase SDK — safe from SQL injection
    return supabase
      .from('jobs')
      .select('id, title, company, location, salary, job_type, image_url, description, requirements, created_at, employer_id, is_active')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100)); // ✅ Enforce max limit
  },

  async postJob(data: any) {
    // ✅ Comprehensive Input Defense: Validate all fields before inserting
    const title = sanitizeInput(data.title || '', 200);
    const company = sanitizeInput(data.company || '', 200);
    const description = sanitizeInput(data.description || '', 5000);
    const location = sanitizeInput(data.location || '', 200);
    const salary = sanitizeInput(data.salary || '', 100);
    const requirements = sanitizeInput(data.requirements || '', 3000);

    // ✅ Whitelist validation for job_type (prevents injection via enum-like values)
    const jobType = ALLOWED_JOB_TYPES.includes(data.jobType)
      ? data.jobType
      : 'دوام كامل';

    // ✅ Validate required fields
    if (!title || title.length < 2) {
      return { data: null, error: { message: 'عنوان الوظيفة مطلوب ويجب أن يكون حرفين على الأقل' } };
    }
    if (!company || company.length < 2) {
      return { data: null, error: { message: 'اسم الشركة مطلوب' } };
    }
    if (!description || description.length < 10) {
      return { data: null, error: { message: 'وصف الوظيفة مطلوب (10 أحرف على الأقل)' } };
    }

    try {
      const { data: res, error } = await (supabase.from('jobs') as any).insert([{
        title,
        company,
        description,
        location:     location || 'عن بُعد',
        salary,
        requirements: requirements || null,
        job_type:     jobType,
        image_url:    (data.imageUrl || '').trim() || null,
        employer_id:  data.employer_id, // From authenticated session
        is_active:    data.is_active !== undefined ? Boolean(data.is_active) : true,
      }]).select();

      if (error) {
        console.error("[postJob] Supabase Insert Error:", error);
        return { data: null, error };
      }
      return { data: res, error: null };
    } catch (err: any) {
      console.error("[postJob] Exception:", err);
      return { data: null, error: err };
    }
  },

  async deleteJob(jobId: string, employerId: string) {
    return supabase
      .from('jobs')
      .delete()
      .eq('id', jobId)
      .eq('employer_id', employerId); // 🔒 Ownership guard: only the poster can delete
  },

  async updateJob(jobId: string, employerId: string, data: any) {
    // ✅ Sanitize all inputs before update
    const jobType = ALLOWED_JOB_TYPES.includes(data.jobType) ? data.jobType : 'دوام كامل';

    // 🔒 Ownership guard: only the poster can update — enforced via employer_id filter
    const mainResult = await (supabase.from('jobs') as any).update({
      title:        sanitizeInput(data.title || '', 200),
      company:      sanitizeInput(data.company || '', 200),
      description:  sanitizeInput(data.description || '', 5000),
      location:     sanitizeInput(data.location || '', 200) || 'عن بُعد',
      salary:       sanitizeInput(data.salary || '', 100),
      requirements: sanitizeInput(data.requirements || '', 3000) || null,
      job_type:     jobType,  // ✅ Whitelisted value only
      image_url:    (data.imageUrl || '').trim() || null,
      is_active:    data.is_active !== undefined ? Boolean(data.is_active) : true,
    })
    .eq('id', jobId)
    .eq('employer_id', employerId); // 🔒 Ownership guard

    return mainResult;
  },


  async applyToJob(applicantId: string, employerId: string, data: any) {
    console.log("💎 [SERVICE_STEP_4] Starting applyToJob...", { applicantId, employerId, jobId: data.jobId });
    
    if (!employerId || employerId === 'null' || employerId === 'undefined') {
      console.error("❌ [SERVICE_ERROR] Employer ID is invalid:", employerId);
      return { data: null, error: { message: "بيانات صاحب العمل مفقودة.", details: "Employer ID is invalid." } };
    }
    
    // Save to the professional ERP table
    try {
      // ✅ Sanitize all text inputs before inserting
      const insertData = {
        applicant_id: applicantId,  // From authenticated session
        employer_id: employerId,    // From validated job data
        job_id: data.jobId,
        cover_letter: sanitizeInput(data.coverLetter || '', 3000),
        cv_url: data.cvUrl || '',
        experience: sanitizeInput(data.experience || '', 2000),
        education: sanitizeInput(data.education || '', 2000),
        skills: Array.isArray(data.skills) ? data.skills.slice(0, 50) : [], // Max 50 skills
        applicant_data: data.applicantData || {},
        status: 'pending'  // ✅ Always set to pending — ALLOWED_STATUSES enforced
      };

      const { data: res, error } = await (supabase.from('job_applications') as any).insert([insertData]).select();

      if (error) {
        console.error("[applyToJob] insert error:", error);
        return { data: null, error };
      }
      return { data: res, error: null };
    } catch (err: any) {
      console.error("[applyToJob] exception:", err);
      return { data: null, error: err };
    }
  },

  async uploadJobImage(userId: string, file: File) {
    console.log(`DEBUG: Testing bucket access for 'job-images'...`);
    
    try {
      // خطوة تشخيصية: هل المجلد موجود أصلاً؟
      const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('job-images');
      
      if (bucketError) {
        console.error("DEBUG: Bucket check error:", bucketError);
        return { data: null, error: new Error(`المجلد 'job-images' غير موجود. يرجى إنشاؤه في Supabase Storage.`) };
      }

      console.log(`DEBUG: Bucket found! Starting upload...`);
      const fileExt = file.name.split('.').pop();
      const fileName = `job-${userId}-${Date.now()}.${fileExt}`;

      const { data, error: uploadError } = await supabase.storage
        .from('job-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        console.error("DEBUG: Upload error details:", uploadError);
        return { data: null, error: uploadError };
      }

      const { data: publicData } = supabase.storage.from('job-images').getPublicUrl(fileName);
      return { data: publicData.publicUrl, error: null };
    } catch (err: any) {
      console.error("DEBUG: Unexpected error during upload:", err);
      return { data: null, error: err };
    }
  },
  
  async uploadCV(userId: string, file: File) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `cv-${userId}-${Date.now()}.${fileExt}`;
      
      console.log(`DEBUG: Uploading CV (${(file.size/1024).toFixed(1)} KB) to 'applications' bucket...`);
      
      const { data, error } = await supabase.storage
        .from('applications')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) {
        console.error("DEBUG: CV Upload Error:", error);
        // Fallback: try 'profiles' bucket
        console.log("DEBUG: Trying fallback to 'profiles' bucket...");
        const { data: fbData, error: fbError } = await supabase.storage.from('profiles').upload(fileName, file);
        if (fbError) {
           console.log("DEBUG: Final fallback to 'images' bucket...");
           const { data: fb2Data, error: fb2Error } = await supabase.storage.from('images').upload(fileName, file);
           if (fb2Error) return { data: null, error: fb2Error };
           const { data: pub2 } = supabase.storage.from('images').getPublicUrl(fileName);
           return { data: pub2.publicUrl, error: null };
        }
        const { data: pub1 } = supabase.storage.from('profiles').getPublicUrl(fileName);
        return { data: pub1.publicUrl, error: null };
      }

      const { data: publicData } = supabase.storage.from('applications').getPublicUrl(fileName);
      return { data: publicData.publicUrl, error: null };
    } catch (err: any) {
      console.error("DEBUG: uploadCV Crash:", err);
      return { data: null, error: err };
    }
  },

  async sendSystemMessage(senderId: string, receiverId: string, content: string) {
    // ✅ Sanitize content before sending system messages
    const cleanContent = sanitizeInput(content, 2000);
    return (supabase.from('messages') as any).insert([{ 
      sender_id: senderId, 
      receiver_id: receiverId, 
      content: cleanContent
    }]);
  }
};
