import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Phone, Lock, User, ArrowRight, ShieldCheck, Sparkles, CheckCircle, AlertCircle, Wrench, Building2, MapPin, FileQuestion } from "lucide-react";
import { GlassCard } from "../ui";
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
  const [selectedRole, setSelectedRole] = useState<"seeker" | "employer" | "freelancer">("seeker");

  // حقول إضافية للمنظومة الجديدة
  const [location, setLocation] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [freelancerType, setFreelancerType] = useState<"technician" | "client">("technician");
  const [specialty, setSpecialty] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [serviceRequest, setServiceRequest] = useState("");

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
      } else if (selectedRole === 'freelancer') {
        if (freelancerType === 'technician' && specialty.trim()) {
          displayTitle = `${finalName} (${specialty.trim()})`;
        } else {
          displayTitle = finalName;
        }
      }

      const res: any = await unifiedAuth(identifier, password, finalName, mode, selectedRole);

      if (res?.error) {
        setError(res.error.message || "حدث خطأ أثناء الاتصال، يرجى المحاولة لاحقاً");
      } else {
        // إذا كان هناك حساب جديد ومسجل الجلسة، حفظ الحقول الإضافية فوراً
        const registeredUserId = res?.data?.user?.id;
        if (registeredUserId) {
          try {
            await supabase.from('profiles').update({
              location: sanitizeInput(location, 100) || null,
              company_name: selectedRole === 'employer' ? sanitizeInput(companyName, 100) : null,
              display_title: displayTitle || null,
              specialty: selectedRole === 'freelancer' ? sanitizeInput(specialty, 100) : null,
              freelancer_type: selectedRole === 'freelancer' ? freelancerType : null,
              home_address: (selectedRole === 'freelancer' && freelancerType === 'client') ? sanitizeInput(homeAddress, 200) : null,
              service_request: (selectedRole === 'freelancer' && freelancerType === 'client') ? sanitizeInput(serviceRequest, 500) : null,
            }).eq('id', registeredUserId);
          } catch (updateErr) {
            console.warn('[AuthView] Additional profile fields save warning:', updateErr);
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
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/60 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans" dir="rtl">
      {/* Background Soft Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-400/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-indigo-400/15 rounded-full blur-[100px] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md z-10">
        <GlassCard className="p-8 rounded-3xl backdrop-blur-2xl border border-slate-200/80 shadow-2xl shadow-blue-950/5 bg-white/90 text-slate-800">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-500/25 border border-white/20">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">PROLINK</h1>
            <p className="text-xs text-slate-500 font-bold">منصة التوظيف والفرص المهنية الأولى</p>
          </div>

          <div className="flex bg-slate-100/80 p-1.5 rounded-2xl mb-5 border border-slate-200/60">
            <button
              onClick={() => { setMode("login"); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${mode === "login" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"}`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => { setMode("signup"); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${mode === "signup" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"}`}
            >
              إنشاء حساب جديد
            </button>
          </div>

          {/* 🚀 Google OAuth Direct Button */}
          <button
            type="button"
            onClick={onGoogleClick}
            disabled={googleLoading || loading}
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-60 mb-5"
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
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative bg-white px-3 text-[10px] font-bold text-slate-400">
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
            {mode === "signup" && (
              <>
                <div className="space-y-1.5 mb-3">
                  <label className="block text-[11px] font-black text-slate-700">نوع الحساب (اختر فئتك):</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedRole("seeker")}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedRole === "seeker"
                          ? "border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20 shadow-sm"
                          : "border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-[11px] font-black block">باحث عن عمل</span>
                      <span className="text-[9px] text-slate-400 font-bold block mt-0.5">👤 وظائف وCV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole("employer")}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedRole === "employer"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-sm"
                          : "border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-[11px] font-black block">صاحب عمل</span>
                      <span className="text-[9px] text-slate-400 font-bold block mt-0.5">💼 نشر وظائف</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole("freelancer")}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedRole === "freelancer"
                          ? "border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20 shadow-sm"
                          : "border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-[11px] font-black block">عمل حر / كشفي</span>
                      <span className="text-[9px] text-slate-400 font-bold block mt-0.5">⚡ فني وميداني</span>
                    </button>
                  </div>
                </div>

                {/* تفاصيل العمل الحر إن كان مختاراً */}
                {selectedRole === "freelancer" && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-2xl space-y-2.5 mb-2">
                    <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">نوع الحساب الميداني:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFreelancerType("technician")}
                        className={`py-2 px-3 rounded-xl border text-xs font-black transition-all ${
                          freelancerType === "technician"
                            ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                            : "bg-white text-slate-600 border-amber-200"
                        }`}
                      >
                        🔧 فني مقدّم خدمة
                      </button>
                      <button
                        type="button"
                        onClick={() => setFreelancerType("client")}
                        className={`py-2 px-3 rounded-xl border text-xs font-black transition-all ${
                          freelancerType === "client"
                            ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                            : "bg-white text-slate-600 border-amber-200"
                        }`}
                      >
                        🏠 طالب خدمة (زبون)
                      </button>
                    </div>

                    {freelancerType === "technician" ? (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 mb-1">الاختصاص المهني</label>
                          <input
                            type="text"
                            value={specialty}
                            onChange={(e) => setSpecialty(e.target.value)}
                            placeholder="مثال: كهربائي، تبريد وتكييف، سيراميك، بناء..."
                            className="w-full bg-white border border-amber-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 font-semibold"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 mb-1">عنوان البيت / المنطقة</label>
                          <input
                            type="text"
                            value={homeAddress}
                            onChange={(e) => setHomeAddress(e.target.value)}
                            placeholder="مثال: بغداد، المنصور، قرب جامع..."
                            className="w-full bg-white border border-amber-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 mb-1">شرح المشكلة / المطلوب</label>
                          <textarea
                            value={serviceRequest}
                            onChange={(e) => setServiceRequest(e.target.value)}
                            placeholder="شرح المشكلة بالتفصيل للتواصل المباشر..."
                            rows={2}
                            className="w-full bg-white border border-amber-200 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 font-semibold resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* حقول صاحب العمل */}
                {selectedRole === "employer" && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم المنشأة / الشركة</label>
                    <div className="relative">
                      <Building2 className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="مثال: شركة النور للمقاولات"
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 font-semibold"
                      />
                    </div>
                  </div>
                )}

                {/* حقل الاسم الصريح */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {selectedRole === 'seeker'
                      ? 'الاسم الصريح (الاختصاص)'
                      : selectedRole === 'employer'
                        ? 'الاسم الكامل للمسؤول / المدير'
                        : 'الاسم الصريح'}
                  </label>
                  <div className="relative">
                    <User
                      className={`absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors ${nameError ? 'text-red-400' : 'text-slate-400'}`}
                      size={16}
                    />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder={
                        selectedRole === 'seeker'
                          ? "مثال: أحمد علي (مهندس برمجيات)"
                          : selectedRole === 'freelancer' && freelancerType === 'technician'
                            ? "مثال: سالم (كهربائي منازل)"
                            : "اسمك الكامل"
                      }
                      className={`w-full bg-slate-50/80 border rounded-xl py-2.5 pr-10 pl-4 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 transition-all font-semibold ${
                        nameError
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                          : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'
                      }`}
                    />
                  </div>
                  {nameError && (
                    <div className="mt-1 flex items-start gap-1.5 text-red-600 text-[11px] font-semibold">
                      <AlertCircle size={13} className="shrink-0 mt-0.5" />
                      <span>{nameError}</span>
                    </div>
                  )}
                </div>

                {/* حقل الموقع الجغرافي */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">تحديد الموقع (المدينة / المنطقة)</label>
                  <div className="relative">
                    <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="مثال: بغداد، الكرادة"
                      className="w-full bg-slate-50/80 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 font-semibold"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-700">البريد الإلكتروني أو رقم الهاتف</label>
                {identifierType !== "unknown" && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${identifierType === "email" ? "bg-blue-50 text-blue-600 border border-blue-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
                    {identifierType === "email" ? <Mail size={10} /> : <Phone size={10} />}
                    {identifierType === "email" ? "بريد إلكتروني" : "رقم هاتف"}
                  </span>
                )}
              </div>
              <div className="relative">
                {identifierType === "phone" ? (
                  <Phone className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${identifierError ? 'text-red-400' : 'text-emerald-600'}`} size={16} />
                ) : (
                  <Mail className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${identifierError ? 'text-red-400' : 'text-slate-400'}`} size={16} />
                )}
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => handleIdentifierChange(e.target.value)}
                  placeholder="07701234567 أو name@domain.com"
                  className={`w-full bg-slate-50/80 border rounded-xl py-2.5 pr-10 pl-4 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 transition-all font-semibold ltr ${
                    identifierError
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'
                  }`}
                />
              </div>
              {identifierError && (
                <div className="mt-1 flex items-start gap-1.5 text-red-600 text-[11px] font-semibold">
                  <AlertCircle size={13} className="shrink-0 mt-0.5 text-red-500" />
                  <span>{identifierError}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">كلمة السر</label>
              <div className="relative">
                <Lock className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${passwordError ? 'text-red-400' : 'text-slate-400'}`} size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full bg-slate-50/80 border rounded-xl py-2.5 pr-10 pl-4 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 transition-all font-semibold ${
                    passwordError
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'
                  }`}
                />
              </div>
              {passwordError && (
                <div className="mt-1 flex items-start gap-1.5 text-red-600 text-[11px] font-semibold">
                  <AlertCircle size={13} className="shrink-0 mt-0.5 text-red-500" />
                  <span>{passwordError}</span>
                </div>
              )}

              {mode === "signup" && password && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-bold">قوة كلمة السر:</span>
                    <span style={{ color: passwordStrength.color }} className="font-extrabold">{passwordStrength.label}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                    <div className="h-full transition-all duration-300" style={{ width: `${(passwordStrength.score + 1) * 20}%`, backgroundColor: passwordStrength.color }} />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 active:scale-[0.99]"
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
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onGuestMode}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold transition-all group"
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
