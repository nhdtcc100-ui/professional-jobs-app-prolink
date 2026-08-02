import { supabase } from '../supabase';

export const profileService = {
  async fetchProfiles(limit = 20) {
    try {
      const response = await supabase
        .from('profiles')
        .select('id, name, avatar_url, cover_url, role, is_pro, company_name, bio, skills')
        .limit(limit);
      
      if (response.error) {
        console.error("DEBUG: Profile fetch error details:", response.error);
      }
      return response;
    } catch (err) {
      console.error("DEBUG: Exception in fetchProfiles:", err);
      throw err;
    }
  },

  async getProfileById(userId: string) {
    return supabase.from('profiles').select('*').eq('id', userId).single();
  },

  async updateProfile(userId: string, updates: any) {
    // ✅ [SECURITY FIX MED-2] Defense-in-depth: explicitly block privilege-escalation fields.
    // Even though RLS on Supabase prevents is_admin changes at the DB level,
    // we reject them here too to enforce the principle of least privilege.
    const FORBIDDEN_FIELDS = ['is_admin', 'isAdmin', 'id', 'email'];
    for (const field of FORBIDDEN_FIELDS) {
      if (updates[field] !== undefined) {
        console.warn(`[Security] Blocked attempt to update forbidden field: '${field}'. This field cannot be changed by the client.`);
        delete updates[field];
      }
    }

    const dbUpdates: Record<string, any> = {};

    // Only include fields that are actually defined to avoid overwriting with undefined
    if (updates.name !== undefined)        dbUpdates.name          = updates.name;
    if (updates.bio !== undefined)         dbUpdates.bio           = updates.bio;
    if (updates.companyName !== undefined) dbUpdates.company_name  = updates.companyName;
    if (updates.location !== undefined)    dbUpdates.location      = updates.location;
    if (updates.industry !== undefined)    dbUpdates.industry      = updates.industry;
    if (updates.website !== undefined)     dbUpdates.website       = updates.website;
    if (updates.avatar !== undefined)      dbUpdates.avatar_url    = updates.avatar;
    if (updates.coverUrl !== undefined)    dbUpdates.cover_url     = updates.coverUrl;
    if (updates.experience !== undefined)  dbUpdates.experience    = updates.experience;
    if (updates.education !== undefined)   dbUpdates.education     = updates.education;
    if (updates.skills !== undefined)      dbUpdates.skills        = updates.skills;
    if (updates.phone !== undefined)       dbUpdates.phone         = updates.phone;
    if (updates.cvUrl !== undefined)      dbUpdates.cv_url        = updates.cvUrl;
    if (updates.cv_url !== undefined)     dbUpdates.cv_url        = updates.cv_url;
    if (updates.current_peer_id !== undefined) dbUpdates.current_peer_id = updates.current_peer_id;
    if (updates.last_seen_at !== undefined)    dbUpdates.last_seen_at    = updates.last_seen_at;

    // تمت إزالة updated_at لأنه غير موجود في قاعدة البيانات ويسبب خطأ 400
    
    console.log("DEBUG: Initiating Supabase update for:", userId, dbUpdates);
    const result = await supabase.from('profiles').update(dbUpdates).eq('id', userId);
    
    if (result.error) {
      console.error(`DEBUG: Supabase update FAILED for field(s): ${Object.keys(dbUpdates).join(', ')}`, result.error.message);
      if (result.error.message.includes('column') && result.error.message.includes('not find')) {
        console.warn("⚠️ IMPORTANT: It seems some database columns are missing. Please run the SQL migration script from the implementation plan.");
      }
    } else {
      console.log("DEBUG: Supabase update SUCCESSFUL ✅");
    }
    return result;
  },

  async toggleProStatus(userId: string, currentStatus: boolean) {
    return supabase.from('profiles').update({ is_pro: !currentStatus }).eq('id', userId);
  }
};
