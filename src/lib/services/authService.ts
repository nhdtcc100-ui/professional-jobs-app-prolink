import { supabase } from '../supabase';
import { AppUser } from '../../types';
import { rateLimiter } from '../security/rateLimiter';
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
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  },

  // ── Email Login (with Rate Limiting) ────────────────────────────────────────
  async emailLogin(email: string, pass: string) {
    const cleanEmail = sanitizeInput(email, 255).toLowerCase();

    // 1. Validate format
    const emailCheck = validateEmail(cleanEmail);
    if (!emailCheck.valid) throw new Error(emailCheck.error);

    // 2. Check rate limit BEFORE hitting Supabase
    const rlCheck = rateLimiter.check(cleanEmail);
    if (!rlCheck.allowed) {
      throw new Error(`⛔ الحساب مقفل مؤقتاً. حاول مجدداً بعد ${rlCheck.remainingMinutes} دقيقة`);
    }

    // 3. Attempt login
    const result = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass,
    });

    if (result.error) {
      // ── تحقق من حالة "البريد غير مُؤكَّد" ──────────────────────────────────
      // Supabase يُعيد رسالة مختلفة إذا كان البريد لم يُؤكَّد بعد
      if (
        result.error.message?.toLowerCase().includes('email not confirmed') ||
        result.error.message?.toLowerCase().includes('email_not_confirmed')
      ) {
        throw new Error(
          '📧 بريدك الإلكتروني لم يُؤكَّد بعد. يرجى فحص صندوق البريد والنقر على رابط التأكيد.'
        );
      }

      // Record failure and potentially lock
      const { locked, remainingAttempts } = rateLimiter.recordFailure(cleanEmail);
      if (locked) {
        throw new Error(`🔒 تم قفل الحساب مؤقتاً لمدة 15 دقيقة بسبب المحاولات المتعددة`);
      }
      throw new Error(
        remainingAttempts > 0
          ? `بيانات الدخول غير صحيحة. تبقّى ${remainingAttempts} محاولات`
          : 'بيانات الدخول غير صحيحة'
      );
    }

    // 4. Success — reset rate limiter
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
  async emailSignUp(email: string, pass: string, name?: string) {
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
          full_name: cleanName,   // ← يُستخدم من الـ Trigger لإنشاء الـ profile
          phone: '',
          avatar_url: null,
        },
        emailRedirectTo: `${window.location.origin}`,  // ← الرابط بعد التأكيد
      }
    });

    if (error) throw error;

    // ── تحقق من حالة البريد ──────────────────────────────────────────────────
    // إذا كانت data.session = null وdata.user موجود → بريد التأكيد أُرسِل ✅
    // إذا كانت data.session موجودة → التسجيل مباشر (email confirmation معطّل)
    if (data.user && !data.session) {
      // حالة طبيعية مع تأكيد البريد:
      // DB Trigger قد عمل بالفعل وأنشأ profile
      // المستخدم الآن ينتظر تأكيد البريد
      return {
        data,
        error: null,
        requiresEmailConfirmation: true,
        message: '📧 تم إنشاء حسابك! يرجى فحص بريدك الإلكتروني والنقر على رابط التأكيد لإكمال التسجيل.'
      };
    }

    // حالة استثنائية: التسجيل المباشر (email confirmation معطّل في Supabase)
    // هنا نضمن وجود الـ profile كإجراء احترازي
    if (data.user && data.session) {
      await authService.ensureProfile(data.user.id, {
        name: cleanName,
        email: cleanEmail,
        phone: '',
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
    userData: { name: string; email: string; phone?: string }
  ): Promise<void> {
    try {
      // تحقق أولاً إذا كان موجوداً
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (existing) return; // موجود، لا داعي لإعادة الإنشاء

      // إنشاء profile مع role = '' (ليُوجَّه لشاشة اختيار الدور)
      await supabase.from('profiles').insert({
        id: userId,
        name: sanitizeInput(userData.name, 100),
        email: userData.email,
        phone: userData.phone || '',
        role: '',      // ← سلسلة فارغة عمداً لجعلها متوافقة مع NOT NULL وتوجيه المستخدم لشاشة اختيار الدور
        is_pro: false,
        bio: ''
      } as any);
    } catch (err) {
      // نتجاهل الأخطاء (ON CONFLICT في الـ Trigger يعالجها)
      console.warn('[authService.ensureProfile] Skipped:', (err as Error).message);
    }
  },

  // ── Phone Auth (normalized, no master password) ──────────────────────────────
  /**
   * تسجيل الدخول/التسجيل عبر رقم الهاتف:
   * - إذا كان الحساب موجوداً: تسجيل دخول
   * - إذا كان الحساب غير موجود + اسم مُدخَل: إنشاء حساب جديد
   *
   * تحويل الهاتف: 07701234567 → 07701234567@prolink.internal (email داخلي)
   */
  async phoneAuth(phone: string, pass: string, name?: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) throw new Error('رقم الهاتف غير صحيح');

    const internalEmail = `${cleanPhone}@prolink.internal`;

    // Rate limit by phone number
    const rlCheck = rateLimiter.check(cleanPhone);
    if (!rlCheck.allowed) {
      throw new Error(`⛔ الرقم مقفل مؤقتاً. حاول مجدداً بعد ${rlCheck.remainingMinutes} دقيقة`);
    }

    // ── محاولة تسجيل الدخول أولاً ────────────────────────────────────────────
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password: pass,
    });

    if (!signInError) {
      // ✅ تسجيل دخول ناجح
      rateLimiter.reset(cleanPhone);
      return { data, error: null, isNewUser: false };
    }

    // ── تحليل نوع الخطأ ──────────────────────────────────────────────────────
    const isEmailNotConfirmed = 
      signInError?.message?.toLowerCase().includes('email not confirmed') ||
      signInError?.message?.toLowerCase().includes('email_not_confirmed');

    if (isEmailNotConfirmed) {
      throw new Error(
        'التسجيل برقم الهاتف معطل حالياً بسبب تفعيل ميزة (Confirm email) في إعدادات Supabase. يرجى الذهاب إلى Authentication -> Providers -> Email وإيقاف تفعيل خيار Confirm email.'
      );
    }

    const isUserNotFound =
      signInError.message?.includes('Invalid login credentials') ||
      signInError.message?.includes('invalid_credentials') ||
      signInError.message?.toLowerCase().includes('not found');

    if (isUserNotFound && name && name.trim().length >= 2) {
      // ── المستخدم جديد + الاسم مُدخَل → إنشاء حساب ───────────────────────

      const { locked } = rateLimiter.recordFailure(cleanPhone);
      if (locked) throw new Error('🔒 تم قفل الرقم مؤقتاً لمدة 15 دقيقة');

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: internalEmail,
        password: pass,
        options: {
          data: {
            full_name: sanitizeInput(name, 100),
            phone: cleanPhone,
            avatar_url: null,
          },
          // لا يوجد emailRedirectTo لحسابات الهاتف (لا email حقيقي)
        }
      });

      if (signUpError) {
        throw new Error(signUpError.message || 'فشل إنشاء حساب الهاتف');
      }

      // ✅ تسجيل ناجح - DB Trigger سيُنشئ الـ profile تلقائياً
      rateLimiter.reset(cleanPhone);

      // حسابات الهاتف: لا تأكيد بريد → جلسة مباشرة عادةً
      if (signUpData.user && signUpData.session) {
        // ضمان وجود الـ profile (fallback للـ Trigger)
        await authService.ensureProfile(signUpData.user.id, {
          name: sanitizeInput(name, 100),
          email: internalEmail,
          phone: cleanPhone,
        });
      }

      return { data: signUpData, error: null, isNewUser: true };
    }

    // ── فشل تسجيل الدخول (كلمة مرور خاطئة) ─────────────────────────────────
    const { locked, remainingAttempts } = rateLimiter.recordFailure(cleanPhone);
    if (locked) throw new Error('🔒 تم قفل الحساب مؤقتاً لمدة 15 دقيقة');
    throw new Error(
      remainingAttempts > 0
        ? `بيانات الدخول غير صحيحة. تبقّى ${remainingAttempts} محاولات`
        : 'بيانات الدخول غير صحيحة'
    );
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

  // ── Role Selection (شاشة اختيار الدور بعد تأكيد البريد) ──────────────────
  async selectRole(userId: string, role: 'seeker' | 'employer', userData: Record<string, unknown>) {
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
      role: role,       // ← الآن يُحدَّث الدور الذي اختاره المستخدم
      is_pro: false,
      bio: ''
    };

    // upsert: سينشئ إذا لم يكن موجوداً، أو يُحدِّث role إذا كان موجوداً مع role=NULL
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

export const unifiedAuth = async (identifier: string, pass: string, name?: string, mode: "login" | "signup" = "login") => {
  const cleanId = identifier.trim();
  const isEmail = cleanId.includes("@");
  
  if (isEmail) {
    if (mode === "login") {
      return authService.emailLogin(cleanId, pass);
    } else {
      if (!name || name.trim().length < 2) {
        throw new Error("الاسم الكامل مطلوب وإنشائه يتطلب حرفين على الأقل");
      }
      return authService.emailSignUp(cleanId, pass, name);
    }
  } else {
    // Phone Auth Flow
    return authService.phoneAuth(cleanId, pass, name);
  }
};

