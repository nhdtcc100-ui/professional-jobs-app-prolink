import { supabase } from '../supabase';
import { sanitizeInput } from '../security/inputValidator';
import { validateFile, imageService } from './imageService';
import { verifyFileMimeType } from '../security/mimeValidator';
import { logger } from '../logger';
import { withMutex, concurrencyMutex } from './concurrencyMutex';
import { idempotencyEngine, withIdempotency } from './idempotencyEngine';
import { withCollisionRetry } from './collisionHandler';
import { generateUUID } from '../security/distributedId';
import { getJobCategory, encodeCategoryInDescription } from '../utils/jobCategoryUtils';
import { cvService } from './cvService';
import { withTimeout } from '../utils/withTimeout';
import { CV_LIMITS } from '../cv/cvData';
import { cvApplicationFields } from '../cv/cvApplication';
import { readApplicantCvSnapshot } from '../cv/cvApplicantExport';

// ✅ Whitelist of allowed job types to prevent injection
const ALLOWED_JOB_TYPES = ['دوام كامل', 'دوام جزئي', 'عن بُعد', 'عقد', 'تدريب', 'مؤقت'];
const ALLOWED_STATUSES = ['pending', 'active', 'closed'];
const MAX_JOB_DESCRIPTION_LENGTH = 8000;

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
    if ((data.description || '').length > MAX_JOB_DESCRIPTION_LENGTH) {
      return { data: null, error: { message: 'وصف الوظيفة يتجاوز الحد الأقصى 8000 حرف' } };
    }
    const employerId = data.employer_id || 'anonymous';
    const mutexKey = `job_post_${employerId}`;
    const idempotencyKey = idempotencyEngine.generateKey('jobs', employerId, {
      title: data.title,
      company: data.company,
      description: data.description,
      employer_id: employerId,
    });

    try {
      const result: any = await withMutex(mutexKey, () =>
        withIdempotency(
          idempotencyKey,
          async () => {
            // ✅ Comprehensive Input Defense: Validate all fields before inserting
            const title = sanitizeInput(data.title || '', 200);
            const company = sanitizeInput(data.company || '', 200);
            const description = sanitizeInput(data.description || '', MAX_JOB_DESCRIPTION_LENGTH);
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
              let profile: any = null;
              try {
                const r: any = await withTimeout(supabase.from('profiles').select('id, role, is_admin').eq('id', data.employer_id).maybeSingle(), 10000, 'postJob.roleCheck');
                profile = r?.data ?? null;
              } catch (e) {
                logger.warn('[postJob] role check timed out; continuing (server RLS enforces role)', e);
              }
              if (profile && !profile.is_admin && (profile.role === 'seeker' || profile.role === 'باحث' || profile.role !== 'employer')) {
                return { data: null, error: { message: 'نشر الوظائف مخصص لأصحاب العمل والمؤسسات فقط 🚫' } };
              }
            }

            return withCollisionRetry(async (_attempt, freshId) => {
              const workingHours = sanitizeInput(data.working_hours || '', 100);
              const finalDescription = data.category
                ? encodeCategoryInDescription(description, data.category)
                : description;

              let insertRes: any;
              try {
                insertRes = await withTimeout((supabase.from('jobs') as any).insert([{
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
              }]).select(), 20000, 'postJob.insert');
              } catch (e: any) {
                return { data: null, error: { message: 'انتهت مهلة الاتصال أثناء نشر الوظيفة. تحقق من الإنترنت وأعد المحاولة.' } };
              }
              const { data: res, error } = insertRes;

              if (error) {
                console.error("[postJob] Supabase Insert Error:", error);
                return { data: null, error };
              }
              return { data: res, error: null };
            }, { scope: 'postJob' });
          },
          { ttlMs: 5000, scope: 'jobs' }
        )
      );

      if (result?.error) {
        idempotencyEngine.invalidate(idempotencyKey);
        concurrencyMutex.clearKey(mutexKey);
      }
      return result;
    } catch (err: any) {
      idempotencyEngine.invalidate(idempotencyKey);
      concurrencyMutex.clearKey(mutexKey);
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
    if ((data.description || '').length > MAX_JOB_DESCRIPTION_LENGTH) {
      return { data: null, error: { message: 'وصف الوظيفة يتجاوز الحد الأقصى 8000 حرف' } };
    }
    // ✅ Sanitize all inputs before update
    const jobType = ALLOWED_JOB_TYPES.includes(data.jobType) ? data.jobType : 'دوام كامل';
    const rawDesc = sanitizeInput(data.description || '', MAX_JOB_DESCRIPTION_LENGTH);
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
    if (!employerId || employerId === 'null' || employerId === 'undefined') {
      return { data: null, error: { message: 'بيانات صاحب العمل مفقودة.', details: 'Employer ID is invalid.' } };
    }

    const rawApplicantData = data.applicantData && typeof data.applicantData === 'object' && !Array.isArray(data.applicantData) ? data.applicantData : {};
    const snapshot = readApplicantCvSnapshot(rawApplicantData.cv);
    if (rawApplicantData.cv != null && !snapshot) {
      return { data: null, error: { code: 'INVALID_APPLICANT_CV', message: `السيرة الذاتية المرفقة غير صالحة أو تتجاوز الحد الأقصى ${CV_LIMITS.maxBytes} بايت. أعد تجهيزها وحاول مجدداً.` } };
    }
    const cvFields = snapshot ? cvApplicationFields(snapshot.data) : null;
    const experienceMetadata = sanitizeInput(data.experience || rawApplicantData.experience || cvFields?.experience || '', CV_LIMITS.maxBytes);
    const educationMetadata = sanitizeInput(data.education || rawApplicantData.education || cvFields?.education || '', CV_LIMITS.maxBytes);
    const experience = experienceMetadata.slice(0, 2000);
    const education = educationMetadata.slice(0, 2000);
    const applicationSkills = Array.isArray(data.skills) ? data.skills : [];
    const metadataSkills = Array.isArray(rawApplicantData.skills) ? rawApplicantData.skills : typeof rawApplicantData.skills === 'string' ? rawApplicantData.skills.split(',') : [];
    const rawSkills = applicationSkills.length ? applicationSkills : metadataSkills.length ? metadataSkills : cvFields?.skills || [];
    const skills = rawSkills.filter((skill: unknown) => typeof skill === 'string').slice(0, 50).map((skill: string) => sanitizeInput(skill, CV_LIMITS.skill));
    const applicantData = {
      ...rawApplicantData,
      experience: experienceMetadata, education: educationMetadata, skills,
      ...(snapshot ? {
        cv: snapshot,
        name: snapshot.data.personal.fullName,
        title: snapshot.data.personal.title,
        location: snapshot.data.personal.location,
        phone: snapshot.data.personal.phone,
        email: snapshot.data.personal.email,
        bio: snapshot.data.summary,
      } : {}),
    };
    const mutexKey = `job_app_${applicantId}_${data.jobId}`;
    const idempotencyKey = idempotencyEngine.generateKey('job_apps', applicantId, { jobId: data.jobId });
    const coverLetterText = sanitizeInput(data.coverLetter || data.notes || '', 3000);
    const cvUrlText = data.cvUrl || '';
    // Schema fallbacks must never discard the captured CV.
    const minimalUpdate = { cover_letter: coverLetterText, applicant_data: applicantData, status: 'pending' };
    const standardUpdate = { ...minimalUpdate, cv_url: cvUrlText };
    const fullUpdate = { ...standardUpdate, experience, education, skills };
    const isMissingColumn = (error: any) => error?.code === '42703' || error?.code === 'PGRST204';
    const writeError = (error: any) => isMissingColumn(error) && /\bapplicant_data\b/i.test(`${error.message || ''} ${error.details || ''} ${error.hint || ''}`)
      ? { code: 'CV_APPLICATION_MIGRATION_REQUIRED', message: 'تعذر حفظ بيانات الطلب والسيرة الذاتية. يلزم ترقية قاعدة البيانات لإضافة عمود applicant_data إلى job_applications؛ لم يتم إرسال الطلب بدون السيرة.' }
      : error;

    const updateApplication = async (filters: Record<string, string>) => {
      for (const [level, payload] of [fullUpdate, standardUpdate, minimalUpdate].entries()) {
        let query = (supabase.from('job_applications') as any).update(payload);
        for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
        const res: any = await withTimeout(query.select(), 8000, `apply.update${level + 1}`);
        if (!res.error) {
          if (!res.data?.length) return { data: null, error: { code: 'APPLICATION_NOT_UPDATED', message: 'تعذر تحديث الطلب؛ تحقق من صلاحية الوصول وأعد المحاولة.' } };
          return { data: res.data, error: null, isUpdated: true };
        }
        const error = writeError(res.error);
        if (error !== res.error || !isMissingColumn(error) || level === 2) return { data: null, error };
      }
      throw new Error('Application update fallback exhausted');
    };

    try {
      let existingApp: any = null;
      try {
        const res: any = await withTimeout(
          (supabase.from('job_applications') as any).select('id, status').eq('applicant_id', applicantId).eq('job_id', data.jobId).maybeSingle(),
          6000, 'apply.checkExisting'
        );
        existingApp = res.data;
      } catch (checkErr) {
        console.warn('[applyToJob] Non-fatal check error, proceeding to insert:', checkErr);
      }
      if (existingApp?.id) return await updateApplication({ id: existingApp.id });

      return await withMutex(mutexKey, () => withIdempotency(
        idempotencyKey,
        () => withCollisionRetry(async (_attempt, freshId) => {
          const identity = { id: freshId, applicant_id: applicantId, job_id: data.jobId };
          const payloads = [
            { ...identity, employer_id: employerId, ...fullUpdate },
            { ...identity, employer_id: employerId, ...standardUpdate },
            { ...identity, ...minimalUpdate },
          ];
          for (const [level, payload] of payloads.entries()) {
            const res: any = await withTimeout((supabase.from('job_applications') as any).insert([payload]).select(), 10000, `apply.insert${level + 1}`);
            if (!res.error) return { data: res.data, error: null };
            const error = writeError(res.error);
            if (error !== res.error) return { data: null, error };
            // Concurrent submissions can race the existing-application check.
            if (error.code === '23505') {
              const updated = await updateApplication({ applicant_id: applicantId, job_id: data.jobId });
              // Preserve ID collisions for the collision retry mechanism.
              return updated.error?.code === 'APPLICATION_NOT_UPDATED' ? { data: null, error } : updated;
            }
            if (!isMissingColumn(error) || level === 2) return { data: null, error };
          }
          throw new Error('Application insert fallback exhausted');
        }, { scope: 'applyToJob' }),
        { ttlMs: 5000, scope: 'job_applications' }
      ));
    } catch (error: any) {
      return { data: null, error: writeError(error) };
    } finally {
      // Preserve immediate resubmission without refreshing, on all paths.
      idempotencyEngine.invalidate(idempotencyKey);
      concurrencyMutex.clearKey(mutexKey);
    }
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
