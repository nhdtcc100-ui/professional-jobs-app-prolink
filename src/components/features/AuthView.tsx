import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Phone, Lock, User, ArrowRight, ShieldCheck, Sparkles, CheckCircle, AlertCircle } from "lucide-react";
import { GlassCard } from "../ui";
import { unifiedAuth } from "../../lib/services/authService";
import { detectIdentifierType, checkPasswordStrength, sanitizeInput } from "../../lib/security/inputValidator";

interface AuthViewProps {
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const identifierType = detectIdentifierType(identifier);
  const passwordStrength = checkPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!identifier.trim()) {
      setError("يرجى إدخال البريد الإلكتروني أو رقم الهاتف");
      return;
    }

    if (mode === "signup" && (!name || name.trim().length < 2)) {
      setError("يرجى إدخال الاسم الكامل (حرفين على الأقل)");
      return;
    }

    if (!password || password.length < 8) {
      setError("كلمة السر يجب أن لا تقل عن 8 أحرف");
      return;
    }

    setLoading(true);

    try {
      const cleanName = sanitizeInput(name, 100);
      const res: any = await unifiedAuth(identifier, password, cleanName, mode);

      if (res?.error) {
        setError(res.error.message || "حدث خطأ أثناء الاتصال، يرجى المحاولة لاحقاً");
      } else {
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
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-indigo-600/15 rounded-full blur-[100px] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md z-10">
        <GlassCard className="p-8 rounded-3xl backdrop-blur-2xl border border-white/10 shadow-2xl bg-slate-900/80 text-white">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mb-1">PROLINK</h1>
            <p className="text-xs text-slate-400 font-medium">منصة التوظيف والفرص المهنية الأولى</p>
          </div>

          <div className="flex bg-slate-800/80 p-1 rounded-xl mb-6 border border-white/5">
            <button
              onClick={() => { setMode("login"); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${mode === "login" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => { setMode("signup"); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${mode === "signup" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
            >
              إنشاء حساب جديد
            </button>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
            {successMsg && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle size={16} className="shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">الاسم الكامل</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: محمد علي"
                    className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-bold text-slate-300">البريد الإلكتروني أو رقم الهاتف</label>
                {identifierType !== "unknown" && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${identifierType === "email" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"}`}>
                    {identifierType === "email" ? <Mail size={10} /> : <Phone size={10} />}
                    {identifierType === "email" ? "بريد إلكتروني" : "رقم هاتف"}
                  </span>
                )}
              </div>
              <div className="relative">
                {identifierType === "phone" ? (
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" size={16} />
                ) : (
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                )}
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="07701234567 أو name@domain.com"
                  className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">كلمة السر</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {mode === "signup" && password && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-medium">قوة كلمة السر:</span>
                    <span style={{ color: passwordStrength.color }} className="font-bold">{passwordStrength.label}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full transition-all duration-300" style={{ width: `${(passwordStrength.score + 1) * 20}%`, backgroundColor: passwordStrength.color }} />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب مجاني"}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  );
};

