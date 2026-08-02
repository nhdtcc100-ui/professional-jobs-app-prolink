import { supabase } from '../supabase';

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
      const courseId = res?.[0]?.id;

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
            await supabase.from('courses').update({ [key]: value }).eq('id', courseId);
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
          await supabase.from('courses').update({ [key]: value }).eq('id', courseId);
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
