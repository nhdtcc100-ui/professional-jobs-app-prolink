import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Phone, Lock, User, ArrowRight, ShieldCheck, Sparkles, CheckCircle, AlertCircle, Wrench, Building2, MapPin, FileQuestion } from "lucide-react";
import { GlassCard } from "../ui";
import { CalligraphyBg } from "../ui/CalligraphyBg";
import { authService, unifiedAuth } from "../../lib/services/authService";
import { detectIdentifierType, checkPasswordStrength, sanitizeInput, validateName } from "../../lib/security/inputValidator";
import { supabase } from "../../lib/supabase";

interface AuthViewProps {
  onSuccess?: () => void;
  handleGoogleLogin?: () => Promise<void>;
  onGuestMode?: () => void;
  [key: string]: any;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess, handleGoogleLogin: propGoogleLogin, onGuestMode }) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<"seeker" | "employer">("seeker");

  // حقول إضافية للمنظومة الجديدة
  const [location, setLocation] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const identifierType = detectIdentifierType(identifier);
  const passwordStrength = checkPasswordStrength(password);

  // 🛡️ Real-time input security scanning handlers
  const handleIdentifierChange = async (value: string) => {
    setIdentifier(value);
    if (!value.trim()) {
      setIdentifierError(null);
      return;
    }
    const { validateField } = await import("../../lib/security/inputValidator");
    const check = validateField(value, "البريد الإلكتروني / رقم الهاتف", undefined, `/auth/${mode}`);
    setIdentifierError(check.valid ? null : (check.error ?? null));
  };

  const handlePasswordChange = async (value: string) => {
    setPassword(value);
    if (!value) {
      setPasswordError(null);
      return;
    }
    const { validateField } = await import("../../lib/security/inputValidator");
    const check = validateField(value, "كلمة السر", undefined, `/auth/${mode}`);
    setPasswordError(check.valid ? null : (check.error ?? null));
  };

  // Real-time name validation — fires on every keystroke
  const handleNameChange = (value: string) => {
    setName(value);
    if (value.trim().length === 0) {
      setNameError(null);
      return;
    }
    const result = validateName(value, undefined, '/auth/signup');
    setNameError(result.valid ? null : (result.error ?? null));
  };

  const onGoogleClick = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      if (propGoogleLogin) {
        await propGoogleLogin();
      } else {
        const { error } = await authService.googleLogin();
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err?.message || "فشل تسجيل الدخول باستخدام حساب كوكل");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!identifier.trim()) {
      setError("يرجى إدخال البريد الإلكتروني أو رقم الهاتف");
      return;
    }

    // 🛡️ WAF Security validation on email/phone identifier
    const { validateField } = await import("../../lib/security/inputValidator");
    const identCheck = validateField(identifier, "البريد الإلكتروني / رقم الهاتف", undefined, `/auth/${mode}`);
    if (!identCheck.valid) {
      setError(identCheck.error ?? "المدخل يحتوي على كودات أو رموز محظورة");
      return;
    }

    if (mode === "signup") {
      const primaryName = selectedRole === 'employer' ? (name || companyName) : name;
      if (!primaryName || primaryName.trim().length < 2) {
        setError("يرجى إدخال الاسم الصريح (حرفين على الأقل)");
        return;
      }
      // 🛡️ Final security name check before submission
      const nameCheck = validateName(primaryName, undefined, '/auth/signup');
      if (!nameCheck.valid) {
        setError(nameCheck.error ?? 'الاسم يحتوي على رموز محظورة');
        return;
      }
    }

    if (!password || password.length < 8) {
      setError("كلمة السر يجب أن لا تقل عن 8 أحرف");
      return;
    }

    // 🛡️ WAF Security validation on password input
    const passCheck = validateField(password, "كلمة السر", undefined, `/auth/${mode}`);
    if (!passCheck.valid) {
      setError(passCheck.error ?? "كلمة السر تحتوي على كودات أو رموز محظورة");
      return;
    }

    setLoading(true);

    try {
      let finalName = sanitizeInput(name, 100);
      let displayTitle = '';

      if (selectedRole === 'seeker') {
        displayTitle = finalName;
      } else if (selectedRole === 'employer') {
        finalName = name || companyName;
        displayTitle = finalName;
      }

      const res: any = await unifiedAuth(identifier, password, finalName, mode, selectedRole);

      if (res?.error) {
        setError(res.error.message || "حدث خطأ أثناء الاتصال، يرجى المحاولة لاحقاً");
      } else {
        // حفظ الدور المحدد والبيانات الإضافية فوراً في البروفايل (فقط عند إنشاء حساب جديد)
        if (mode === "signup") {
          const registeredUserId = res?.data?.user?.id;
          if (registeredUserId) {
            try {
              await authService.selectRole(registeredUserId, selectedRole, {
                location: sanitizeInput(location, 100) || null,
                company_name: selectedRole === 'employer' ? sanitizeInput(companyName, 100) : null,
                display_title: displayTitle || null,
                specialty: null,
                freelancer_type: null,
                home_address: null,
                service_request: null,
              });
            } catch (updateErr) {
              console.warn('[AuthView] Role and profile fields save warning:', updateErr);
            }
          }
        }

        if (mode === "signup" && identifier.includes("@")) {
          setSuccessMsg("تم إنشاء الحساب بنجاح! يرجى تفقد بريدك الإلكتروني لتأكيد الحساب.");
        } else {
          setSuccessMsg("تم تسجيل الدخول بنجاح!");
          if (onSuccess) onSuccess();
        }
      }
    } catch (err: any) {
      setError(err.message || "فشلت عملية المصادقة، يرجى التأكد من البيانات");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans" dir="rtl">
      {/* Background Soft Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-400/15 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-indigo-400/15 dark:bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* خلفية خط ديواني للصفحة كاملة */}
      <CalligraphyBg word="تواصل" size="14rem" opacity={0.04} position="top-right" />
      <CalligraphyBg word="فرصة" size="12rem" opacity={0.035} position="bottom-left" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md z-10">
        <GlassCard className="p-8 rounded-3xl backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl shadow-blue-950/5 bg-white/90 dark:bg-slate-900/95 text-slate-800 dark:text-white relative overflow-hidden">
          {/* خلفية خط ديواني داخل الكارد */}
          <CalligraphyBg word="دخول" size="8rem" opacity={0.045} position="bottom-right" color="#6366f1" />
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-500/25 border border-white/20">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-1">PROLINK</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">منصة التوظيف والفرص المهنية الأولى</p>
          </div>

          <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl mb-5 border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => { setMode("login"); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${mode === "login" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-600" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"}`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => { setMode("signup"); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${mode === "signup" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-600" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"}`}
            >
              إنشاء حساب جديد
            </button>
          </div>

          {/* 🚀 Google OAuth Direct Button */}
          <button
            type="button"
            onClick={onGoogleClick}
            disabled={googleLoading || loading}
            className="w-full py-3 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-60 mb-5"
          >
            {googleLoading ? (
              <span className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>المتابعة مباشرة بواسطة Google</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative mb-5 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative bg-white dark:bg-slate-900 px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500">
              أو عبر البريد / رقم الهاتف
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200/80 text-red-600 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </motion.div>
            )}
            {successMsg && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-bold flex items-center gap-2">
                <CheckCircle size={16} className="shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* اختيار نوع الحساب فقط عند إنشاء الحساب الجديد */}
            {mode === "signup" && (
              <div className="space-y-1.5 mb-3">
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-200">نوع الحساب (اختر فئتك):</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRole("seeker")}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedRole === "seeker"
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <span className="text-[11px] font-black block">باحث عن عمل</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">👤 وظائف وCV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole("employer")}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedRole === "employer"
                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <span className="text-[11px] font-black block">صاحب عمل</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">💼 نشر وظائف</span>
                  </button>
                </div>
              </div>
            )}

            {mode === "signup" && (
              <>

                {/* حقول صاحب العمل */}
                {selectedRole === "employer" && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">اسم المنشأة / الشركة</label>
                    <div className="relative">
                      <Building2 className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="مثال: شركة النور للمقاولات"
                        className="w-full bg-slate-50/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-10 pl-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-semibold"
                      />
                    </div>
                  </div>
                )}

                {/* حقل الاسم الصريح */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {selectedRole === 'seeker'
                      ? 'الاسم الصريح (الاختصاص)'
                      : selectedRole === 'employer'
                        ? 'الاسم الكامل للمسؤول / المدير'
                        : 'الاسم الصريح'}
                  </label>
                  <div className="relative">
                    <User
                      className={`absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors ${nameError ? 'text-red-400' : 'text-slate-400 dark:text-slate-500'}`}
                      size={16}
                    />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder={
                        selectedRole === 'seeker'
                          ? "مثال: أحمد علي (مهندس برمجيات)"
                          : "اسمك الكامل أو اسم الشركة"
                      }
                      className={`w-full bg-slate-50/80 dark:bg-slate-800 border rounded-xl py-2.5 pr-10 pl-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 transition-all font-semibold ${
                        nameError
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                          : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/10'
                      }`}
                    />
                  </div>
                  {nameError && (
                    <div className="mt-1 flex items-start gap-1.5 text-red-600 dark:text-red-400 text-[11px] font-semibold">
                      <AlertCircle size={13} className="shrink-0 mt-0.5" />
                      <span>{nameError}</span>
                    </div>
                  )}
                </div>

                {/* حقل الموقع الجغرافي */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">تحديد الموقع (المدينة / المنطقة)</label>
                  <div className="relative">
                    <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="مثال: بغداد، الكرادة"
                      className="w-full bg-slate-50/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-10 pl-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 font-semibold"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200">البريد الإلكتروني أو رقم الهاتف</label>
                {identifierType !== "unknown" && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${identifierType === "email" ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800" : "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"}`}>
                    {identifierType === "email" ? <Mail size={10} /> : <Phone size={10} />}
                    {identifierType === "email" ? "بريد إلكتروني" : "رقم هاتف"}
                  </span>
                )}
              </div>
              <div className="relative">
                {identifierType === "phone" ? (
                  <Phone className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${identifierError ? 'text-red-400' : 'text-emerald-600'}`} size={16} />
                ) : (
                  <Mail className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${identifierError ? 'text-red-400' : 'text-slate-400 dark:text-slate-500'}`} size={16} />
                )}
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => handleIdentifierChange(e.target.value)}
                  placeholder="07701234567 أو name@domain.com"
                  className={`w-full bg-slate-50/80 dark:bg-slate-800 border rounded-xl py-2.5 pr-10 pl-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 transition-all font-semibold ltr ${
                    identifierError
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                      : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/10'
                  }`}
                />
              </div>
              {identifierError && (
                <div className="mt-1 flex items-start gap-1.5 text-red-600 dark:text-red-400 text-[11px] font-semibold">
                  <AlertCircle size={13} className="shrink-0 mt-0.5 text-red-500" />
                  <span>{identifierError}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">كلمة السر</label>
              <div className="relative">
                <Lock className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${passwordError ? 'text-red-400' : 'text-slate-400 dark:text-slate-500'}`} size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full bg-slate-50/80 dark:bg-slate-800 border rounded-xl py-2.5 pr-10 pl-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 transition-all font-semibold ${
                    passwordError
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                      : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/10'
                  }`}
                />
              </div>
              {passwordError && (
                <div className="mt-1 flex items-start gap-1.5 text-red-600 dark:text-red-400 text-[11px] font-semibold">
                  <AlertCircle size={13} className="shrink-0 mt-0.5 text-red-500" />
                  <span>{passwordError}</span>
                </div>
              )}

              {mode === "signup" && password && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">قوة كلمة السر:</span>
                    <span style={{ color: passwordStrength.color }} className="font-extrabold">{passwordStrength.label}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-600/50">
                    <div className="h-full transition-all duration-300" style={{ width: `${(passwordStrength.score + 1) * 20}%`, backgroundColor: passwordStrength.color }} />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 active:scale-[0.99] cursor-pointer"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب مجاني"}</span>
                  <ArrowRight size={16} className="rotate-180" />
                </>
              )}
            </button>
          </form>

          {/* ── زر التصفح بدون تسجيل دخول ── */}
          {onGuestMode && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onGuestMode}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold transition-all group cursor-pointer"
              >
                <span className="text-lg group-hover:scale-110 transition-transform">👁️</span>
                تصفح بدون تسجيل الدخول
              </button>
            </div>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
};
