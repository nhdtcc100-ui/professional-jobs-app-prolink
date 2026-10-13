import { supabase } from '../supabase';
import { sanitizeInput } from '../security/inputValidator';
import { validateFile, imageService } from './imageService';
import { verifyFileMimeType } from '../security/mimeValidator';
import { logger } from '../logger';
import { withMutex } from './concurrencyMutex';
import { idempotencyEngine, withIdempotency } from './idempotencyEngine';
import { withCollisionRetry } from './collisionHandler';
import { generateUUID } from '../security/distributedId';
import { getJobCategory, encodeCategoryInDescription } from '../utils/jobCategoryUtils';
import { cvService } from './cvService';

// ✅ Whitelist of allowed job types to prevent injection
const ALLOWED_JOB_TYPES = ['دوام كامل', 'دوام جزئي', 'عن بُعد', 'عقد', 'تدريب', 'مؤقت'];
const ALLOWED_STATUSES = ['pending', 'active', 'closed'];

export const jobService = {
  async fetchJobs(limit = 50) {
    // ✅ Parameterized query via Supabase SDK — safe from SQL injection
    const res = await supabase
      .from('jobs')
      .select('id, title, company, location, salary, job_type, working_hours, image_url, description, requirements, created_at, employer_id, is_active')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100)); // ✅ Enforce max limit

    if (res.data) {
      res.data = (res.data as any[]).map((j: any) => ({
        ...j,
        category: getJobCategory(j)
      }));
    }
    return res;
  },

  async postJob(data: any) {
    const employerId = data.employer_id || 'anonymous';
    const mutexKey = `job_post_${employerId}`;
    const idempotencyKey = idempotencyEngine.generateKey('jobs', employerId, {
      title: data.title,
      company: data.company,
      employer_id: employerId,
    });

    return withMutex(mutexKey, () =>
      withIdempotency(
        idempotencyKey,
        async () => {
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

          // 🚫 Strict Server/Service Guard: Only Employers and Admins can post jobs
          if (data.employer_id) {
            const { data: profile } = await supabase.from('profiles').select('id, role, is_admin').eq('id', data.employer_id).single();
            if (profile && !profile.is_admin && (profile.role === 'seeker' || profile.role === 'باحث' || profile.role !== 'employer')) {
              return { data: null, error: { message: 'نشر الوظائف مخصص لأصحاب العمل والمؤسسات فقط 🚫' } };
            }
          }

          return withCollisionRetry(async (_attempt, freshId) => {
            const workingHours = sanitizeInput(data.working_hours || '', 100);
            const finalDescription = data.category
              ? encodeCategoryInDescription(description, data.category)
              : description;

            const { data: res, error } = await (supabase.from('jobs') as any).insert([{
              id:            data.id || freshId,
              title,
              company,
              description:   finalDescription,
              location:      location || 'عن بُعد',
              salary,
              requirements:  requirements || null,
              job_type:      jobType,
              working_hours: workingHours || null,
              image_url:     (data.imageUrl || '').trim() || null,
              employer_id:   data.employer_id,
              is_active:     data.is_active !== undefined ? Boolean(data.is_active) : true,
            }]).select();

            if (error) {
              console.error("[postJob] Supabase Insert Error:", error);
              return { data: null, error };
            }
            return { data: res, error: null };
          }, { scope: 'postJob' });
        },
        { ttlMs: 30000, scope: 'jobs' }
      )
    );
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
    const rawDesc = sanitizeInput(data.description || '', 5000);
    const finalDescription = data.category
      ? encodeCategoryInDescription(rawDesc, data.category)
      : rawDesc;

    // 🔒 Ownership guard: only the poster can update — enforced via employer_id filter
    const mainResult = await (supabase.from('jobs') as any).update({
      title:        sanitizeInput(data.title || '', 200),
      company:      sanitizeInput(data.company || '', 200),
      description:  finalDescription,
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

    const mutexKey = `job_app_${applicantId}_${data.jobId}`;
    const idempotencyKey = idempotencyEngine.generateKey('job_apps', applicantId, { jobId: data.jobId });

    return withMutex(mutexKey, () =>
      withIdempotency(
        idempotencyKey,
        async () => {
          const coverLetterText = sanitizeInput(data.coverLetter || data.notes || '', 3000);
          const cvUrlText = data.cvUrl || '';

          return withCollisionRetry(async (_attempt, freshId) => {
            // 1. Try full insert (all fields including extended metadata)
            const fullPayload = {
              id: freshId,
              applicant_id: applicantId,
              employer_id: employerId,
              job_id: data.jobId,
              cover_letter: coverLetterText,
              cv_url: cvUrlText,
              experience: sanitizeInput(data.experience || '', 2000),
              education: sanitizeInput(data.education || '', 2000),
              skills: Array.isArray(data.skills) ? data.skills.slice(0, 50) : [],
              applicant_data: data.applicantData || {},
              status: 'pending'
            };

            try {
              const res = await (supabase.from('job_applications') as any).insert([fullPayload]).select();
              if (!res.error) return { data: res.data, error: null };

              console.warn("⚠️ [applyToJob] Full payload insert returned error, attempting standard fallback:", res.error);
              
              // 2. Fallback level 1: Standard columns without extended schema
              const standardPayload = {
                id: freshId,
                applicant_id: applicantId,
                employer_id: employerId,
                job_id: data.jobId,
                cover_letter: coverLetterText,
                cv_url: cvUrlText,
                status: 'pending'
              };

              const res2 = await (supabase.from('job_applications') as any).insert([standardPayload]).select();
              if (!res2.error) return { data: res2.data, error: null };

              console.warn("⚠️ [applyToJob] Standard payload insert returned error, attempting minimal fallback:", res2.error);

              // 3. Fallback level 2: Minimal essential columns
              const minPayload = {
                id: freshId,
                applicant_id: applicantId,
                job_id: data.jobId,
                cover_letter: coverLetterText,
                status: 'pending'
              };

              const res3 = await (supabase.from('job_applications') as any).insert([minPayload]).select();
              return { data: res3.data, error: res3.error };

            } catch (err: any) {
              console.error("❌ [applyToJob] exception:", err);
              return { data: null, error: err };
            }
          }, { scope: 'applyToJob' });
        },
        { ttlMs: 60000, scope: 'job_applications' }
      )
    );
  },

  async uploadJobImage(userId: string, file: File) {
    const val = validateFile(file, 'image');
    if (!val.valid) return { data: null, error: new Error(val.error) };

    const magic = await verifyFileMimeType(file, file.type);
    if (!magic.valid) return { data: null, error: new Error(magic.error) };

    try {
      const presigned = await imageService.createPresignedUploadUrl(userId, file.type, 'job-images');
      if (presigned) {
        return { data: presigned.publicUrl, error: null };
      }

      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `job-${userId}-${generateUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('job-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        logger.error("[jobService] Upload job image error:", uploadError);
        return { data: null, error: uploadError };
      }

      const { data: publicData } = supabase.storage.from('job-images').getPublicUrl(fileName);
      return { data: publicData.publicUrl, error: null };
    } catch (err: any) {
      logger.error("[jobService] Unexpected error during image upload:", err);
      return { data: null, error: err };
    }
  },
  
  async uploadCV(userId: string, file: File) {
    return cvService.uploadCV(userId, file);
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
