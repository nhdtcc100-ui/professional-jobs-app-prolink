import { supabase } from '../supabase';
import { generateDistributedId } from '../security/distributedId';

export const courseService = {
  async fetchCourses(limit = 50) {
    return supabase
      .from('courses')
      .select('*, profiles(name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  async postCourse(data: any) {
    try {
      // Step 1: Insert core data (Title and Description are essential)
      const { data: res, error } = await supabase.from('courses').insert([{
        provider_id:  data.provider_id,
        title:        (data.title || '').trim(),
        description:  (data.description || '').trim(),
      }]).select();

      if (error) return { data: null, error };
      const courseId = (res as any)?.[0]?.id;

      if (courseId) {
        // Step 2: Try to update optional fields one by one to avoid schema mismatch errors
        const optionalFields: any = {
          image_url: data.image_url || null,
          duration:  data.duration || null,
          price:     data.price || 'مجاني',
          level:     data.level || 'مبتدئ',
          is_active: data.is_active !== undefined ? data.is_active : true,
        };

        for (const [key, value] of Object.entries(optionalFields)) {
          try {
            await (supabase.from('courses') as any).update({ [key]: value }).eq('id', courseId);
          } catch (e) {
            console.warn(`Column '${key}' missing in 'courses' table. Run SQL migration.`);
          }
        }
      }


      return { data: res, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async registerForCourse(courseId: string, userId: string) {
    // Check if already registered
    const { data: existing } = await supabase
      .from('course_registrations')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) return { data: null, error: { message: 'مسجل مسبقاً' } };

    return supabase.from('course_registrations').insert([{
      course_id: courseId,
      user_id: userId,
      status: 'pending',
    }]).select();
  },

  /**
   * Comprehensive Course Application: registers student, captures application notes & CV, and notifies provider.
   */
  async applyToCourse(
    applicantId: string,
    providerId: string | undefined,
    courseId: string,
    data: {
      notes?: string;
      experience?: string;
      education?: string;
      cvUrl?: string;
      applicantData?: any;
    }
  ) {
    try {
      // 1. Check existing registration
      const { data: existing } = await supabase
        .from('course_registrations')
        .select('id')
        .eq('course_id', courseId)
        .eq('user_id', applicantId)
        .maybeSingle();

      if (existing) {
        return { data: null, error: { message: 'أنت مسجل في هذه الدورة مسبقاً' } };
      }

      // 2. Insert into course_registrations
      const { data: reg, error } = await (supabase.from('course_registrations') as any).insert([{
        course_id: courseId,
        user_id: applicantId,
        provider_id: providerId || null,
        status: 'pending',
        notes: data.notes || '',
        cv_url: data.cvUrl || null,
        created_at: new Date().toISOString(),
      }]).select();

      if (error) {
        // Fallback insert without extra columns if schema is strictly minimal
        const fallbackRes = await (supabase.from('course_registrations') as any).insert([{
          course_id: courseId,
          user_id: applicantId,
          status: 'pending',
        }]).select();
        if (fallbackRes.error) return { data: null, error: fallbackRes.error };
      }

      // 3. Send Notification to Instructor / Provider
      if (providerId && providerId !== applicantId) {
        try {
          await (supabase.from('notifications') as any).insert([{
            user_id: providerId,
            actor_id: applicantId,
            type: 'course_registration',
            content: `قام ${data.applicantData?.name || 'مستخدم'} بالتسجيل في دورتك التدريبية`,
            target_id: courseId,
            is_read: false,
            created_at: new Date().toISOString()
          }]);
        } catch (notifErr) {
          console.warn('[courseService] Notification send error (non-fatal):', notifErr);
        }
      }

      return { data: reg || [{ id: generateDistributedId('reg') }], error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async updateCourse(courseId: string, data: any) {
    try {
      // Step 1: Update core data
      const { data: res, error } = await supabase.from('courses').update({
        title:        (data.title || '').trim(),
        description:  (data.description || '').trim(),
      }).eq('id', courseId).select();

      if (error) return { data: null, error };

      // Step 2: Try to update optional fields one by one to avoid schema mismatch errors
      const optionalFields: any = {
        image_url: data.image_url || null,
        duration:  data.duration || null,
        price:     data.price || 'مجاني',
        level:     data.level || 'مبتدئ',
        is_active: data.is_active !== undefined ? data.is_active : true,
      };

      for (const [key, value] of Object.entries(optionalFields)) {
        try {
          await (supabase.from('courses') as any).update({ [key]: value }).eq('id', courseId);
        } catch (e) {

          console.warn(`Column '${key}' missing in 'courses' table. Run SQL migration.`);
        }
      }

      return { data: res, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async deleteCourse(id: string) {
    return await supabase.from('courses').delete().eq('id', id);
  },

  async getMyRegistrations(userId: string) {
    return supabase
      .from('course_registrations')
      .select('*, courses(*)')
      .eq('user_id', userId);
  },

  async checkRegistration(courseId: string, userId: string) {
    const { data } = await supabase
      .from('course_registrations')
      .select('id, status')
      .eq('course_id', courseId)
      .eq('user_id', userId)
      .maybeSingle();
    return data;
  },

  async getProviderRequests(providerId: string) {
    // 1. Get all courses owned by this provider
    const { data: myCourses } = await supabase
      .from('courses')
      .select('id')
      .eq('provider_id', providerId);

    if (!myCourses || myCourses.length === 0) return { data: [], error: null };

    const courseIds = myCourses.map(c => c.id);

    // 2. Get registrations for these courses
    return supabase
      .from('course_registrations')
      .select(`
        *,
        courses(title),
        profiles:user_id(id, name, avatar_url)
      `)
      .in('course_id', courseIds)
      .order('created_at', { ascending: false });
  },

  async updateRegistrationStatus(regId: string, status: 'approved' | 'rejected') {
    return supabase
      .from('course_registrations')
      .update({ status })
      .eq('id', regId);
  }
};
