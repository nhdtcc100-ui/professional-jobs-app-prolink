import { supabase } from '../supabase';
import { logger } from '../logger';
import { threatEngine } from '../security/threatEngine';
import { validateName } from '../security/inputValidator';

/** نوع بيانات المرشح القادم من DB — بدون بيانات حساسة */
export interface CandidateRow {
  id: string;
  name: string;
  avatar_url: string | null;
  title: string;
  location: string;
  is_pro: boolean;
  matchScore?: number;
  role?: string;
}

export const profileService = {
  async fetchProfiles(limit = 200) {
    try {
      const response = await supabase
        .from('profiles')
        .select('id, name, avatar_url, cover_url, role, is_pro, company_name, bio, skills, title, location')
        .limit(limit);
      
      if (response.error) {
        logger.error("Profile fetch error:", response.error);
      }
      return response;
    } catch (err) {
      logger.error("Exception in fetchProfiles:", err);
      throw err;
    }
  },

  /**
   * ─────────────────────────────────────────────────────────────────
   * fetchCandidatesForJob — جلب المرشحين المطابقين لوظيفة محددة
   * ─────────────────────────────────────────────────────────────────
   * الشروط الدقيقة (بدون ذكاء اصطناعي):
   *  1. تطابق المسمى الوظيفي (Job Title) مع المسمى في الملف الشخصي للمستخدم
   *  2. تطابق الموقع الجغرافي (Location) مع موقع المستخدم في الملف
   *  3. لا يتم جلب إلا الأشخاص المطابقين لكلا الشرطين فقط
   * ─────────────────────────────────────────────────────────────────
   */
  async fetchCandidatesForJob(
    jobTitle: string,
    jobLocation: string,
    employerId: string,
    limit = 20
  ): Promise<{ data: CandidateRow[]; error: string | null }> {
    try {
      if (!jobTitle || !jobTitle.trim()) return { data: [], error: null };

      // دالة تنظيف ومطابقة النصوص العربية والإنجليزية
      const normalizeText = (str: string): string => {
        if (!str) return '';
        return str
          .toLowerCase()
          .replace(/[أإآ]/g, 'ا')
          .replace(/ة/g, 'ه')
          .replace(/ى/g, 'ي')
          .replace(/[ًٌٍَُِّْـ]/g, '')
          .replace(/[^a-zA-Z0-9\u0621-\u064A\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const STOP = new Set([
        'مطلوب', 'مطلوبة', 'عاجل', 'شركة', 'وظيفة', 'وظائف', 'عمل', 'موظف', 'موظفة', 'مهنة', 'فرصة',
        'في', 'من', 'على', 'عن', 'مع', 'و', 'او', 'أو', 'ل', 'ب', 'ك', 'لل', 'الي', 'إلى',
        'needed', 'wanted', 'urgent', 'job', 'hiring', 'looking', 'for'
      ]);

      const normJobTitle = normalizeText(jobTitle);
      const normJobLocation = normalizeText(jobLocation);

      // استخراج الكلمات المفتاحية للمسمى الوظيفي
      const titleKeywords = normJobTitle
        .split(' ')
        .map(w => w.trim())
        .filter(w => w.length >= 2 && !STOP.has(w));

      // فحص إذا كانت الوظيفة عن بعد
      const isRemoteJob = !normJobLocation ||
        normJobLocation.includes('عن بعد') ||
        normJobLocation.includes('remote') ||
        normJobLocation.includes('اونلاين') ||
        normJobLocation.includes('online') ||
        normJobLocation.includes('الكل') ||
        normJobLocation.includes('اي مكان');

      // استخراج كلمات الموقع
      const locTokens = normJobLocation
        .split(' ')
        .map(w => w.trim())
        .filter(w => w.length >= 2 && !STOP.has(w))
        .map(w => w.startsWith('ال') ? w.slice(2) : w);

      // استعلام قاعدة البيانات لجلب الملفات الشخصية
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, title, location, is_pro, role, skills, bio')
        .neq('id', employerId)
        .not('name', 'is', null)
        .limit(300);

      if (error) {
        logger.error('[fetchCandidatesForJob] DB error:', error.message);
        return { data: [], error: error.message };
      }

      const matched: CandidateRow[] = [];

      for (const candidate of (data || [])) {
        const candTitle = normalizeText(candidate.title || '');
        const candBio = normalizeText(candidate.bio || '');
        const candLoc = normalizeText(candidate.location || '');
        const candSkills = Array.isArray(candidate.skills)
          ? candidate.skills.map((s: string) => normalizeText(s)).join(' ')
          : normalizeText(candidate.skills || '');

        // ── 1. فحص تطابق المسمى الوظيفي ──
        let matchesTitle = false;
        if (candTitle) {
          if (normJobTitle.includes(candTitle) || candTitle.includes(normJobTitle)) {
            matchesTitle = true;
          } else {
            const candTitleWords = candTitle.split(' ').filter(w => w.length >= 2);
            for (const kw of titleKeywords) {
              const kwClean = kw.startsWith('ال') ? kw.slice(2) : kw;
              if (candTitle.includes(kw) || candTitle.includes(kwClean)) {
                matchesTitle = true;
                break;
              }
              for (const cw of candTitleWords) {
                const cwClean = cw.startsWith('ال') ? cw.slice(2) : cw;
                if (kw.includes(cwClean) || cw.includes(kwClean) || cw.includes(kw)) {
                  matchesTitle = true;
                  break;
                }
              }
              if (matchesTitle) break;
            }
          }
        }

        // فحص المهارات أو النبذة إن لم يتطابق العنوان وحده
        if (!matchesTitle && (candSkills || candBio)) {
          for (const kw of titleKeywords) {
            const kwClean = kw.startsWith('ال') ? kw.slice(2) : kw;
            if (candSkills.includes(kw) || candSkills.includes(kwClean) || candBio.includes(kw)) {
              matchesTitle = true;
              break;
            }
          }
        }

        // إذا لم يتطابق المسمى الوظيفي، استبعد المرشح تماماً
        if (!matchesTitle) continue;

        // ── 2. فحص تطابق الموقع الجغرافي ──
        let matchesLocation = false;
        if (isRemoteJob) {
          matchesLocation = true;
        } else if (!candLoc) {
          // إذا لم يحدد المرشح موقعه والوظيفة محددة بموقع، لا يعتبر مطابقاً
          matchesLocation = false;
        } else {
          const isRemoteCand = candLoc.includes('عن بعد') || candLoc.includes('remote') || candLoc.includes('اونلاين');
          if (isRemoteCand) {
            matchesLocation = true;
          } else if (normJobLocation.includes(candLoc) || candLoc.includes(normJobLocation)) {
            matchesLocation = true;
          } else {
            for (const token of locTokens) {
              const candLocClean = candLoc.startsWith('ال') ? candLoc.slice(2) : candLoc;
              if (candLoc.includes(token) || candLocClean.includes(token)) {
                matchesLocation = true;
                break;
              }
            }
          }
        }

        // إذا لم يتطابق الموقع الجغرافي، استبعد المرشح تماماً
        if (!matchesLocation) continue;

        // المرشح مطابق لكلا الشرطين: المسمى الوظيفي والموقع
        matched.push({
          id: candidate.id,
          name: candidate.name || 'مرشح مهني',
          avatar_url: candidate.avatar_url,
          title: candidate.title || jobTitle,
          location: candidate.location || jobLocation || 'غير محدد',
          is_pro: !!candidate.is_pro,
          role: candidate.role
        });
      }

      return { data: matched.slice(0, limit), error: null };
    } catch (err: any) {
      logger.error('[fetchCandidatesForJob] Exception:', err);
      return { data: [], error: String(err) };
    }
  },

  async getProfileById(userId: string) {
    return supabase.from('profiles').select('*').eq('id', userId).single();
  },

  /**
   * fetchSimilarProfiles — الرادار الدائري
   * يبحث عن أشخاص بنفس المسمى الوظيفي والمدينة
   * بغض النظر عن الدور (seeker/employer — كلاهما يظهر)
   */
  async fetchSimilarProfiles(
    myTitle: string,
    myLocation: string,
    myId: string,
    limit = 12
  ): Promise<{ data: CandidateRow[]; error: string | null }> {
    try {
      const STOP = new Set(['مطلوب','عاجل','شركة','وظيفة','في','من','على','عن','مع','و','أو','ل','ب','ك']);
      const titleKeyword = myTitle
        .split(/[\s،,._\-\/]+/)
        .map(w => w.trim())
        .filter(w => w.length >= 2 && !STOP.has(w))[0] || myTitle.trim();

      const rawCity = (myLocation || '').split(/[،,\/\-]/)[0].trim();
      const cityKeyword = rawCity.startsWith('ال') ? rawCity.slice(2) : rawCity;

      if (!titleKeyword) return { data: [], error: null };

      let query = supabase
        .from('profiles')
        .select('id, name, avatar_url, title, location, is_pro, role')
        .neq('id', myId)
        .not('title', 'is', null)
        .neq('title', '')
        .ilike('title', `%${titleKeyword}%`); // بحث بالمسمى بدون تقييد الدور

      if (cityKeyword) {
        query = query
          .not('location', 'is', null)
          .neq('location', '')
          .ilike('location', `%${cityKeyword}%`);
      }

      const { data, error } = await query.limit(limit);
      if (error) return { data: [], error: error.message };
      return { data: (data as CandidateRow[]) || [], error: null };
    } catch (err: any) {
      return { data: [], error: String(err) };
    }
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

    // 🛡️ Service-Layer Name Guard — كاشف نهائي يمنع الأسماء الخبيثة قبل قاعدة البيانات
    if (updates.name !== undefined) {
      const nameCheck = validateName(
        updates.name,
        { id: userId, name: updates.name, email: updates.email },
        '/api/profile/update'
      );
      if (!nameCheck.valid) {
        // Name contains malicious code — block DB write entirely
        logger.error(`[Security] Blocked profile update for user ${userId}: name contains injection pattern "${nameCheck.threat}"`);
        return { data: null, error: { message: nameCheck.error ?? 'الاسم يحتوي على رموز محظورة' } };
      }
      dbUpdates.name = updates.name;
    }
    if (updates.bio !== undefined)         dbUpdates.bio           = updates.bio;
    if (updates.companyName !== undefined) dbUpdates.company_name  = updates.companyName;
    if (updates.location !== undefined)    dbUpdates.location      = updates.location;
    if (updates.industry !== undefined)    dbUpdates.title         = updates.industry;  // ← المسمى الوظيفي يُخزَّن في حقل title
    if (updates.title !== undefined)       dbUpdates.title         = updates.title;
    if (updates.website !== undefined)     dbUpdates.website       = updates.website;
    if (updates.avatar !== undefined)      dbUpdates.avatar_url    = updates.avatar;
    if (updates.avatar_url !== undefined)  dbUpdates.avatar_url    = updates.avatar_url;
    if (updates.coverUrl !== undefined)    dbUpdates.cover_url     = updates.coverUrl;
    if (updates.cover_url !== undefined)   dbUpdates.cover_url     = updates.cover_url;
    if (updates.experience !== undefined)  dbUpdates.experience    = updates.experience;
    if (updates.education !== undefined)   dbUpdates.education     = updates.education;
    if (updates.skills !== undefined)      dbUpdates.skills        = updates.skills;
    if (updates.phone !== undefined)       dbUpdates.phone         = updates.phone;
    if (updates.cvUrl !== undefined)      dbUpdates.cv_url        = updates.cvUrl;
    if (updates.cv_url !== undefined)     dbUpdates.cv_url        = updates.cv_url;
    if (updates.open_to !== undefined)    dbUpdates.open_to       = updates.open_to;  // ← حالة "متاح للعمل"
    if (updates.is_available !== undefined) dbUpdates.is_available = updates.is_available;
    if (updates.isAvailable !== undefined)  dbUpdates.is_available = updates.isAvailable;
    if (updates.display_title !== undefined) dbUpdates.display_title = updates.display_title;
    if (updates.displayTitle !== undefined)  dbUpdates.display_title = updates.displayTitle;
    if (updates.freelancer_type !== undefined) dbUpdates.freelancer_type = updates.freelancer_type;
    if (updates.freelancerType !== undefined)  dbUpdates.freelancer_type = updates.freelancerType;
    if (updates.specialty !== undefined)     dbUpdates.specialty     = updates.specialty;
    if (updates.home_address !== undefined)  dbUpdates.home_address  = updates.home_address;
    if (updates.homeAddress !== undefined)   dbUpdates.home_address  = updates.homeAddress;
    if (updates.service_request !== undefined) dbUpdates.service_request = updates.service_request;
    if (updates.serviceRequest !== undefined)  dbUpdates.service_request = updates.serviceRequest;
    if (updates.company_logo_url !== undefined) dbUpdates.company_logo_url = updates.company_logo_url;
    if (updates.companyLogoUrl !== undefined)   dbUpdates.company_logo_url = updates.companyLogoUrl;
    if (updates.company_bio !== undefined)   dbUpdates.company_bio   = updates.company_bio;
    if (updates.companyBio !== undefined)    dbUpdates.company_bio   = updates.companyBio;
    if (updates.role !== undefined)       dbUpdates.role          = updates.role;     // ← نوع الحساب (seeker / employer / freelancer)
    if (updates.current_peer_id !== undefined) dbUpdates.current_peer_id = updates.current_peer_id;
    // 🛡️ WAF Real-Time Threat Inspection before writing to database
    for (const [key, val] of Object.entries(dbUpdates)) {
      // Skip image URLs, document URLs, and base64 payloads from text XSS inspection
      if (key === 'avatar_url' || key === 'cover_url' || key === 'cv_url') continue;
      const strVal = Array.isArray(val) ? val.join(' ') : typeof val === 'string' ? val : '';
      if (!strVal) continue;
      if (strVal.startsWith('data:image/') || strVal.startsWith('data:application/') || strVal.startsWith('http://') || strVal.startsWith('https://')) continue;

      const xssRes = threatEngine.scanForXSS(strVal);
      if (xssRes.detected) {
        threatEngine.logThreat({
          user_id: userId,
          user_name: dbUpdates.name || updates.name || 'مستخدم الملف الشخصي',
          user_email: updates.email,
          attack_type: 'XSS_ATTACK',
          severity: 'HIGH',
          endpoint: '/api/profile/update',
          payload_sample: strVal.slice(0, 150),
        });
        // Sanitize dangerous HTML script execution tags before DB update
        if (typeof val === 'string') {
          dbUpdates[key] = val
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/javascript\s*:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
        } else if (Array.isArray(val)) {
          dbUpdates[key] = val.map((item: any) =>
            typeof item === 'string'
              ? item
                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                  .replace(/javascript\s*:/gi, '')
                  .replace(/on\w+\s*=/gi, '')
                  .trim()
              : item
          );
        }
      }

      const sqliRes = threatEngine.scanForSQLi(strVal);
      if (sqliRes.detected) {
        threatEngine.logThreat({
          user_id: userId,
          user_name: dbUpdates.name || updates.name || 'مستخدم الملف الشخصي',
          user_email: updates.email,
          attack_type: 'SQL_INJECTION',
          severity: 'CRITICAL',
          endpoint: '/api/profile/update',
          payload_sample: strVal.slice(0, 150),
        });
      }
    }

    const result = await supabase.from('profiles').update(dbUpdates).eq('id', userId).select('id');
    
    if (result.error) {
      logger.error(`Supabase update FAILED for profile: ${userId}`, result.error);
    } else if (!result.data || result.data.length === 0) {
      logger.warn(`⚠️ [profileService] Update returned 0 modified rows for user ${userId}. Retrying with active session...`);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const activeUid = session?.user?.id;
        if (activeUid && activeUid !== userId) {
          const retry = await supabase.from('profiles').update(dbUpdates).eq('id', activeUid).select('id');
          if (retry.data && retry.data.length > 0) {
            return retry;
          }
        }
      } catch (_) {}
    }
    return result;
  },

  async toggleProStatus(userId: string, currentStatus: boolean) {
    return supabase.from('profiles').update({ is_pro: !currentStatus }).eq('id', userId);
  },

  /**
   * ─────────────────────────────────────────────────────────────────
   * sendRoleChangeRequest — يحفظ الطلب في جدول role_change_requests
   * ─────────────────────────────────────────────────────────────────
   */
  async sendRoleChangeRequest(
    userId: string,
    userName: string,
    userAvatar: string,
    currentRole: 'seeker' | 'employer' | 'freelancer',
    requestedRole: 'seeker' | 'employer' | 'freelancer',
    reason: string
  ) {
    try {
      // إدراج الطلب في الجدول المخصص role_change_requests
      const { data, error } = await (supabase as any)
        .from('role_change_requests')
        .insert([{
          user_id: userId,
          user_name: userName,
          user_avatar: userAvatar,
          from_role: currentRole,
          requested_role: requestedRole,
          reason: reason.trim(),
          status: 'pending'
        }])
        .select()
        .single();

      if (error) {
        logger.error('sendRoleChangeRequest DB error:', error);
        return { error };
      }

      // حفظ نسخة محلية للعرض الفوري في الواجهة
      try {
        const cached = JSON.parse(localStorage.getItem('prolink_pending_role_req') || 'null');
        if (!cached || cached.user_id !== userId) {
          localStorage.setItem('prolink_pending_role_req', JSON.stringify({
            id: data?.id,
            user_id: userId,
            requested_role: requestedRole,
            status: 'pending',
            created_at: new Date().toISOString()
          }));
        }
      } catch {}

      return { error: null, data };
    } catch (err: any) {
      logger.error('sendRoleChangeRequest exception:', err);
      return { error: err };
    }
  },

  /**
   * ─────────────────────────────────────────────────────────────────
   * fetchPendingRoleChangeRequest — التحقق من وجود طلب معلق للمستخدم
   * ─────────────────────────────────────────────────────────────────
   */
  async fetchPendingRoleChangeRequest(userId: string) {
    try {
      const { data, error } = await (supabase as any)
        .from('role_change_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error) {
        if (data) {
          try {
            localStorage.setItem('prolink_pending_role_req', JSON.stringify(data));
          } catch {}
          return { pending: true, request: data };
        } else {
          // Database confirmed: no pending requests
          try {
            localStorage.removeItem('prolink_pending_role_req');
          } catch {}
          return { pending: false, request: null };
        }
      }

      // Check local cache fallback ONLY if network error occurred
      try {
        const cached = JSON.parse(localStorage.getItem('prolink_pending_role_req') || 'null');
        if (cached && cached.user_id === userId && cached.status === 'pending') {
          return { pending: true, request: cached };
        }
      } catch {}

      return { pending: false, request: null };
    } catch {
      return { pending: false, request: null };
    }
  },

  /**
   * ─────────────────────────────────────────────────────────────────
   * fetchAllPendingRoleRequests — جلب كل الطلبات المعلقة للأدمن
   * ─────────────────────────────────────────────────────────────────
   */
  async fetchAllPendingRoleRequests() {
    try {
      const { data, error } = await (supabase as any)
        .from('role_change_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return { data: [], error };
      return { data: data || [], error: null };
    } catch (err: any) {
      return { data: [], error: err };
    }
  },

  /**
   * ─────────────────────────────────────────────────────────────────
   * approveRoleChangeRequest — الأدمن يوافق على الطلب
   * ─────────────────────────────────────────────────────────────────
   */
  async approveRoleChangeRequest(
    requestId: string,
    targetUserId: string,
    newRole: 'seeker' | 'employer',
    adminId?: string
  ) {
    try {
      // 1. تحديث دور المستخدم في profiles
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUserId);
      if (profileErr) throw profileErr;

      // 2. تحديث حالة كافة الطلبات المعلقة لهذا المستخدم إلى approved
      const nowIso = new Date().toISOString();
      if (requestId) {
        await (supabase as any)
          .from('role_change_requests')
          .update({
            status: 'approved',
            reviewed_by: adminId || null,
            reviewed_at: nowIso
          })
          .eq('id', requestId);
      }

      await (supabase as any)
        .from('role_change_requests')
        .update({
          status: 'approved',
          reviewed_by: adminId || null,
          reviewed_at: nowIso
        })
        .eq('user_id', targetUserId)
        .eq('status', 'pending');

      // 3. إشعار للمستخدم
      const roleLabel = newRole === 'employer' ? 'صاحب عمل / شركة 🏢' : 'باحث عن عمل 👤';
      try {
        await supabase.from('notifications').insert([{
          user_id: targetUserId,
          type: 'role_change_approved',
          from_id: adminId || targetUserId,
          from_name: 'إدارة ProLink',
          from_avatar: 'https://ui-avatars.com/api/?name=Admin&background=0284c7&color=fff',
          target_id: targetUserId,
          read: false,
          message: `🎉 تمت الموافقة على طلبك! تم ترقية حسابك إلى: ${roleLabel}. يمكنك الآن التمتع بجميع الصلاحيات والميزات الجديدة.`
        }] as any);
      } catch (notifErr) {
        logger.warn('Failed to insert approval notification:', notifErr);
      }

      // 4. مسح الكاش المحلي
      try {
        localStorage.removeItem('prolink_pending_role_req');
      } catch {}

      return { error: null };
    } catch (err: any) {
      logger.error('approveRoleChangeRequest error:', err);
      return { error: err };
    }
  },

  /**
   * ─────────────────────────────────────────────────────────────────
   * rejectRoleChangeRequest — الأدمن يرفض الطلب
   * ─────────────────────────────────────────────────────────────────
   */
  async rejectRoleChangeRequest(
    requestId: string,
    targetUserId: string,
    adminId?: string,
    adminNote?: string
  ) {
    try {
      // 1. تحديث حالة كافة الطلبات المعلقة لهذا المستخدم إلى rejected
      const nowIso = new Date().toISOString();
      if (requestId) {
        await (supabase as any)
          .from('role_change_requests')
          .update({
            status: 'rejected',
            admin_note: adminNote || null,
            reviewed_by: adminId || null,
            reviewed_at: nowIso
          })
          .eq('id', requestId);
      }

      await (supabase as any)
        .from('role_change_requests')
        .update({
          status: 'rejected',
          admin_note: adminNote || null,
          reviewed_by: adminId || null,
          reviewed_at: nowIso
        })
        .eq('user_id', targetUserId)
        .eq('status', 'pending');

      // 2. إشعار للمستخدم
      try {
        const rejectMsg = `نعتذر، تم رفض طلب تغيير نوع حسابك.${adminNote ? ` السبب: ${adminNote}` : ' تم إلغاء حالة المراجعة ويمكنك تقديم طلب جديد متى شئت.'}`;
        await supabase.from('notifications').insert([{
          user_id: targetUserId,
          type: 'role_change_rejected',
          from_id: adminId || targetUserId,
          from_name: 'إدارة ProLink',
          from_avatar: 'https://ui-avatars.com/api/?name=Admin&background=ef4444&color=fff',
          target_id: targetUserId,
          read: false,
          message: rejectMsg
        }] as any);
      } catch (notifErr) {
        logger.warn('Failed to insert rejection notification:', notifErr);
      }

      // 3. مسح الكاش المحلي
      try {
        localStorage.removeItem('prolink_pending_role_req');
      } catch {}

      return { error: null };
    } catch (err: any) {
      logger.error('rejectRoleChangeRequest error:', err);
      return { error: err };
    }
  }
};
