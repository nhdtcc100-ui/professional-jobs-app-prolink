import { supabase } from '../supabase';
import { AppUser } from '../../types';
import { rateLimiter } from '../security/rateLimiter';
import { serverRateLimiter } from '../security/serverRateLimiter';
import { sanitizeInput, validateEmail, validatePassword } from '../security/inputValidator';

/**
 * 🔑 Admin Role System
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin status is determined by the `is_admin` column in the `profiles` table.
 * This column is NEVER set by the client — only via Supabase SQL Editor by the
 * database owner. The client only reads it.
 *
 * To grant admin to a user, run this in Supabase SQL Editor:
 *   UPDATE profiles SET is_admin = true WHERE id = '<user-uuid>';
 *
 * To revoke:
 *   UPDATE profiles SET is_admin = false WHERE id = '<user-uuid>';
 *
 * RLS ensures users cannot set their own is_admin to true.
 */

/**
 * 📨 Email Confirmation Flow
 * ─────────────────────────────────────────────────────────────────────────────
 * تدفق التسجيل بالبريد الإلكتروني (مع تأكيد البريد مُفعَّل):
 *
 * 1. emailSignUp()     → Supabase ينشئ auth.users + يرسل بريد تأكيد
 * 2. DB Trigger        → يُنشئ profile (role=NULL) تلقائياً
 * 3. المستخدم يفتح الرابط → Supabase يُطلق SIGNED_IN event
 * 4. onAuthStateChange → getProfile() → profile موجود (role=NULL)
 * 5. needsRole = true  → شاشة اختيار الدور
 * 6. selectRole()      → يُحدِّث role في profiles
 * 7. المستخدم يدخل التطبيق ✅
 */

export const authService = {
  // ── Google OAuth ────────────────────────────────────────────────────────────
  async googleLogin() {
    // ✅ redirectTo يجب أن يكون window.location.origin حتى تعود Supabase للتطبيق بعد المصادقة
    // يجب أن يكون هذا الرابط مسجلاً في:
    // 1. Google Cloud Console → Authorized redirect URIs: https://ubeqmsyyyojojmswmidq.supabase.co/auth/v1/callback
    // 2. Supabase Dashboard → Auth → URL Configuration → Site URL: http://localhost:3000
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',  // دائماً اطلب من المستخدم اختيار الحساب
        }
      }
    });
  },

  // ── Email Login (with Rate Limiting) ────────────────────────────────────────
  async emailLogin(email: string, pass: string) {
    const cleanEmail = sanitizeInput(email, 255).toLowerCase();

    // 1. Validate format
    const emailCheck = validateEmail(cleanEmail);
    if (!emailCheck.valid) throw new Error(emailCheck.error);

    // 2. Check DB rate limit BEFORE hitting Supabase
    const rlCheck = await serverRateLimiter.check(cleanEmail);
    if (!rlCheck.allowed) {
      throw new Error(`⛔ الحساب مقفل مؤقتاً. حاول مجدداً بعد ${rlCheck.remainingMinutes} دقيقة`);
    }

    // 3. Attempt login
    const result = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass,
    });

    if (result.error) {
      // Record DB failure
      await serverRateLimiter.record(cleanEmail, false);
      const { locked, remainingAttempts } = rateLimiter.recordFailure(cleanEmail);

      if (
        result.error.message?.toLowerCase().includes('email not confirmed') ||
        result.error.message?.toLowerCase().includes('email_not_confirmed')
      ) {
        throw new Error(
          '📧 بريدك الإلكتروني لم يُؤكَّد بعد. يرجى فحص صندوق البريد والنقر على رابط التأكيد.'
        );
      }

      if (locked) {
        throw new Error(`🔒 تم قفل الحساب مؤقتاً لمدة 15 دقيقة بسبب المحاولات المتعددة`);
      }
      throw new Error(
        remainingAttempts > 0
          ? `بيانات الدخول غير صحيحة. تبقّى ${remainingAttempts} محاولات`
          : 'بيانات الدخول غير صحيحة'
      );
    }

    // 4. Success — reset rate limiters
    await serverRateLimiter.record(cleanEmail, true);
    rateLimiter.reset(cleanEmail);
    return result;
  },

  // ── Email Sign Up ────────────────────────────────────────────────────────────
  /**
   * ✅ التدفق الصحيح (مع تأكيد البريد):
   * - ينشئ مستخدماً في auth.users
   * - DB Trigger يُنشئ profile تلقائياً (role=NULL)
   * - يُرسَل بريد التأكيد
   * - المستخدم يُوجَّه لرسالة "تحقق من بريدك"
   * - بعد التأكيد: onAuthStateChange → شاشة اختيار الدور
   */
  async emailSignUp(email: string, pass: string, name?: string, role: string = '') {
    const cleanEmail = sanitizeInput(email, 255).toLowerCase();
    const cleanName = name ? sanitizeInput(name, 100) : cleanEmail.split('@')[0];

    // Validate
    const emailCheck = validateEmail(cleanEmail);
    if (!emailCheck.valid) throw new Error(emailCheck.error);

    const passCheck = validatePassword(pass);
    if (!passCheck.valid) throw new Error(passCheck.error);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass,
      options: {
        data: {
          full_name: cleanName,
          role: role || '',
          phone: '',
          avatar_url: null,
        },
        emailRedirectTo: `${window.location.origin}`,
      }
    });

    if (error) throw error;

    // ── تحقق من حالة البريد وضمان إنشاء البروفايل فوراً ──────────────────────
    if (data.user) {
      await authService.ensureProfile(data.user.id, {
        name: cleanName,
        email: cleanEmail,
        phone: '',
        role: role
      });
    }

    return { data, error: null, requiresEmailConfirmation: false };
  },

  // ── Helper: ضمان وجود الـ Profile (Defense in Depth) ────────────────────────
  /**
   * إذا فشل الـ Trigger لأي سبب، هذه الدالة تضمن إنشاء الـ profile.
   * تُستدعى من onAuthStateChange عند عدم وجود profile.
   */
  async ensureProfile(
    userId: string,
    userData: { name: string; email: string; phone?: string; role?: string }
  ): Promise<void> {
    try {
      // تحقق أولاً إذا كان موجوداً
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (existing) return; // موجود، لا داعي لإعادة الإنشاء

      // إنشاء profile مع الدور المختار
      await supabase.from('profiles').insert({
        id: userId,
        name: sanitizeInput(userData.name, 100),
        email: userData.email,
        phone: userData.phone || '',
        role: userData.role || '',
        is_pro: false,
        bio: ''
      } as any);
    } catch (err) {
      // نتجاهل الأخطاء (ON CONFLICT في الـ Trigger يعالجها)
      console.warn('[authService.ensureProfile] Skipped:', (err as Error).message);
    }
  },

  // ── Phone Auth (normalized, no duplicates, legacy domain support) ─────────────
  /**
   * تسجيل الدخول/التسجيل عبر رقم الهاتف مع التنسيق الموحد ومنع التكرار نهائياً:
   * - توحيد أرقام الهواتف العراقية والدولية (مثل 0770... / +964770... / 770...)
   * - دعم الحسابات السابقة التي أنشئت تحت نطاقات مختلفة (@prolink.internal, @prolink.phone, إلخ)
   * - منع إنشاء حسابات مكررة لنفس الرقم
   */
  async phoneAuth(
    phone: string,
    pass: string,
    name?: string,
    role: string = '',
    mode: 'login' | 'signup' = 'login'
  ) {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('00964')) {
      cleanPhone = cleanPhone.slice(5);
    } else if (cleanPhone.startsWith('964')) {
      cleanPhone = cleanPhone.slice(3);
    }
    if (cleanPhone.startsWith('7') && cleanPhone.length === 10) {
      cleanPhone = '0' + cleanPhone;
    }
    if (!cleanPhone || cleanPhone.length < 10) throw new Error('رقم الهاتف غير صحيح');

    // Rate limit by phone number (client + server, fail-closed)
    const rlCheck = rateLimiter.check(cleanPhone);
    if (!rlCheck.allowed) {
      throw new Error(`⛔ الرقم مقفل مؤقتاً. حاول مجدداً بعد ${rlCheck.remainingMinutes} دقيقة`);
    }
    const serverCheck = await serverRateLimiter.check(cleanPhone);
    if (!serverCheck.allowed) {
      throw new Error(`⛔ الرقم مقفل مؤقتاً. حاول مجدداً بعد ${serverCheck.remainingMinutes ?? 15} دقيقة`);
    }

    // النطاقات التاريخية والحالية التي قد يكون الحساب مسجلاً بها
    const candidateEmails = [
      `${cleanPhone}@prolink.internal`,
      `${cleanPhone}@prolink.phone`,
      `phone_${cleanPhone}@prolink.app`,
      `${cleanPhone}@prolink.com`,
      `phone_${cleanPhone}@prolink.demo`,
    ];

    // ── 1. في وضع تسجيل الدخول (login): جرب النطاقات السابقة ───────────────────
    for (const emailAttempt of candidateEmails) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailAttempt,
        password: pass,
      });

      if (!error && data?.session) {
        // ✅ تسجيل دخول ناجح
        rateLimiter.reset(cleanPhone);
        await serverRateLimiter.record(cleanPhone, true);
        return { data, error: null, isNewUser: false };
      }
    }

    // إذا كنا في وضع تسجيل الدخول فقط وفشلت المحاولات → لا تنشئ مستخدماً جديداً مطلقاً
    if (mode === 'login') {
      await serverRateLimiter.record(cleanPhone, false);
      const { locked, remainingAttempts } = rateLimiter.recordFailure(cleanPhone);
      if (locked) throw new Error('🔒 تم قفل الحساب مؤقتاً لمدة 15 دقيقة');
      throw new Error(
        remainingAttempts > 0
          ? `بيانات الدخول غير صحيحة. تبقّى ${remainingAttempts} محاولات`
          : 'بيانات الدخول غير صحيحة'
      );
    }

    // ── 2. في وضع إنشاء الحساب (signup) ────────────────────────────────────────
    // تحقق أولاً هل يوجد حساب مسجل مسبقاً بنفس رقم الهاتف لمنع تكرار المستخدمين
    try {
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('id, phone')
        .eq('phone', cleanPhone)
        .limit(1);

      if (existingProfiles && existingProfiles.length > 0) {
        throw new Error('⚠️ رقم الهاتف هذا مسجل مسبقاً بالفعل في المنصة. يرجى التبديل إلى "تسجيل الدخول" وإدخال كلمة المرور.');
      }
    } catch (checkErr: any) {
      if (checkErr.message?.includes('مسجل مسبقاً')) {
        throw checkErr;
      }
      console.warn('[authService.phoneAuth] Existing phone check error:', checkErr);
    }

    const { locked } = rateLimiter.recordFailure(cleanPhone);
    if (locked) throw new Error('🔒 تم قفل الرقم مؤقتاً لمدة 15 دقيقة');

    const primaryInternalEmail = `${cleanPhone}@prolink.internal`;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: primaryInternalEmail,
      password: pass,
      options: {
        data: {
          full_name: sanitizeInput(name || 'مستخدم جديد', 100),
          role: role || '',
          phone: cleanPhone,
          avatar_url: null,
        },
      }
    });

    if (signUpError) {
      // إذا كان البريد الداخلي موجوداً مسبقاً في auth.users
      if (signUpError.message?.toLowerCase().includes('already registered')) {
        throw new Error('⚠️ هذا الحساب مسجل مسبقاً بالفعل. يرجى التبديل إلى "تسجيل الدخول".');
      }
      throw new Error(signUpError.message || 'فشل إنشاء حساب الهاتف');
    }

    // ✅ تسجيل ناجح
    rateLimiter.reset(cleanPhone);
    await serverRateLimiter.record(cleanPhone, true);

    if (signUpData.user) {
      await authService.ensureProfile(signUpData.user.id, {
        name: sanitizeInput(name || 'مستخدم جديد', 100),
        email: primaryInternalEmail,
        phone: cleanPhone,
        role: role,
      });
    }

    return { data: signUpData, error: null, isNewUser: true };
  },

  // ── Logout ───────────────────────────────────────────────────────────────────
  async logout() {
    return supabase.auth.signOut();
  },

  // ── Resend Verification Email ────────────────────────────────────────────────
  async resendVerification(email: string) {
    const cleanEmail = sanitizeInput(email, 255).toLowerCase();
    return supabase.auth.resend({ type: 'signup', email: cleanEmail });
  },

  // ── Role Selection (شاشة اختيار الدور أو تحويل نوع الحساب) ──────────────────
  async selectRole(
    userId: string, 
    role: 'seeker' | 'employer' | 'freelancer', 
    userData: Record<string, unknown> = {}
  ) {
    const extraUpdates: Record<string, any> = {};
    if (userData.display_title) extraUpdates.display_title = sanitizeInput(userData.display_title as string, 120);
    if (userData.displayTitle) extraUpdates.display_title = sanitizeInput(userData.displayTitle as string, 120);
    if (userData.specialty) extraUpdates.specialty = sanitizeInput(userData.specialty as string, 100);
    if (userData.freelancer_type) extraUpdates.freelancer_type = userData.freelancer_type;
    if (userData.freelancerType) extraUpdates.freelancer_type = userData.freelancerType;
    if (userData.home_address) extraUpdates.home_address = sanitizeInput(userData.home_address as string, 200);
    if (userData.homeAddress) extraUpdates.home_address = sanitizeInput(userData.homeAddress as string, 200);
    if (userData.service_request) extraUpdates.service_request = sanitizeInput(userData.service_request as string, 500);
    if (userData.serviceRequest) extraUpdates.service_request = sanitizeInput(userData.serviceRequest as string, 500);
    if (userData.location) extraUpdates.location = sanitizeInput(userData.location as string, 100);
    if (userData.phone) extraUpdates.phone = sanitizeInput(userData.phone as string, 30);

    // 1. تحقق أولاً إذا كان الحساب والملف الشخصي موجوداً بالفعل
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', userId)
      .maybeSingle();

    if (existing) {
      // ✅ الحساب موجود: نُحدِّث فقط الدور (role) مع أي بيانات إضافية
      return supabase
        .from('profiles')
        .update({ role: role, ...extraUpdates })
        .eq('id', userId);
    }

    // 2. مستخدم جديد لأول مرة عند التسجيل:
    const cleanName = sanitizeInput(
      (userData?.full_name as string) ||
      (userData?.name as string) ||
      ((userData?.email as string) || '').split('@')[0] ||
      'مستخدم جديد',
      100
    );

    const profileData = {
      id: userId,
      name: cleanName,
      email: (userData?.email as string) || '',
      avatar_url: (userData?.avatar_url as string) || null,
      phone: (userData?.phone as string) || '',
      role: role,
      is_pro: false,
      bio: '',
      ...extraUpdates,
    };

    // upsert: سينشئ إذا لم يكن موجوداً
    return supabase.from('profiles').upsert(profileData as any, {
      onConflict: 'id',
      ignoreDuplicates: false,
    });
  },

  // ── Get Profile (admin status read from DB, never hardcoded) ─────────────────
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle() as any;

    if (data) {
      // ✅ Admin status comes ONLY from DB column `is_admin` — never from client logic
      const isAdmin = data.is_admin === true;
      return {
        data: {
          ...data,
          is_admin: isAdmin,
          isAdmin: isAdmin,
        },
        error
      };
    }
    return { data, error };
  }
};

export const unifiedAuth = async (
  identifier: string, 
  pass: string, 
  name?: string, 
  mode: "login" | "signup" = "login",
  role: 'seeker' | 'employer' | 'freelancer' = 'seeker'
) => {
  const cleanId = identifier.trim();
  const isEmail = cleanId.includes("@");
  
  if (isEmail) {
    if (mode === "login") {
      return authService.emailLogin(cleanId, pass);
    } else {
      if (!name || name.trim().length < 2) {
        throw new Error("الاسم الكامل مطلوب وإنشائه يتطلب حرفين على الأقل");
      }
      return authService.emailSignUp(cleanId, pass, name, role);
    }
  } else {
    return authService.phoneAuth(cleanId, pass, name, role, mode);
  }
};

