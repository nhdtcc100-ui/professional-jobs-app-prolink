import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  User as UserIcon,
  Book,
  FileText,
  Globe,
  Phone,
  CheckCircle2,
  Loader2,
  AlertCircle,
  CloudUpload,
  Tag,
  Plus,
  Briefcase,
  GraduationCap,
  ArrowLeftRight,
  Clock,
  Send,
  Lock,
  Sparkles,
  X,
  Camera,
  Image as ImageIcon,
  Wrench,
  Building2
} from 'lucide-react';
import { GlassCard } from '../../ui';
import { validateField } from '../../../lib/security/inputValidator';
import { profileService } from '../../../lib/services/profileService';
import { useAppContext } from '../../../contexts/AppContext';
import { supabase } from '../../../lib/supabase';

interface ProfileEditViewProps {
  formData: any;
  handleFieldChange: (field: string, value: any) => void;
  addToast: (m: string, t?: any) => void;
  setActiveTab: (tab: any) => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  handleCVUpload?: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAvatarChange?: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleCoverChange?: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleSave?: () => Promise<void>;
  onScrollToTop?: () => void;
  pendingCVName?: string | null;
}

const inputClass =
  'w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-blue-50 focus:border-blue-200 transition-all outline-none shadow-sm placeholder:text-slate-300 text-slate-800';

const labelClass = 'text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block';

export const ProfileEditView: React.FC<ProfileEditViewProps> = ({
  formData,
  handleFieldChange,
  addToast,
  setActiveTab,
  saveStatus = 'idle',
  handleCVUpload,
  handleAvatarChange,
  handleCoverChange,
  handleSave,
  onScrollToTop,
  pendingCVName,
}) => {
  const { appUser } = useAppContext();
  const effectiveUserId = formData?.id || (formData as any)?.user_id || appUser?.id;

  const [skillsText, setSkillsText] = React.useState<string>(() =>
    Array.isArray(formData?.skills) ? formData.skills.join(', ') : (formData?.skills || '')
  );

  // ─── Unified Security Validation State ────────────────────────────────────
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string | null>>({});

  // ─── Role Change Request State ────────────────────────────────────────────
  const [pendingRoleRequest, setPendingRoleRequest] = useState<any | null>(null);
  const [loadingRoleCheck, setLoadingRoleCheck] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [targetRoleToRequest, setTargetRoleToRequest] = useState<'seeker' | 'employer' | 'freelancer' | null>(null);
  const [roleReason, setRoleReason] = useState('');
  const [isSendingRoleRequest, setIsSendingRoleRequest] = useState(false);

  const currentRole = formData?.role || appUser?.role || 'seeker';
  const isPendingRoleChange = !!(pendingRoleRequest && pendingRoleRequest.status === 'pending' && pendingRoleRequest.requested_role !== currentRole);

  // التحقق من وجود طلب معلق عند التحميل ومتابعة التحديثات اللحظية (Realtime)
  useEffect(() => {
    if (!effectiveUserId) return;
    let isMounted = true;
    setLoadingRoleCheck(true);

    const checkPending = () => {
      profileService.fetchPendingRoleChangeRequest(effectiveUserId).then(({ pending, request }) => {
        if (isMounted) {
          if (pending && request && request.requested_role === currentRole) {
            setPendingRoleRequest(null);
            try { localStorage.removeItem('prolink_pending_role_req'); } catch {}
          } else {
            setPendingRoleRequest(pending ? request : null);
          }
          setLoadingRoleCheck(false);
        }
      }).catch(() => {
        if (isMounted) setLoadingRoleCheck(false);
      });
    };

    checkPending();

    // 📡 Live Realtime listener: يحدّث حالة الطلب فور موافقة أو رفض الإدارة
    const channel = supabase
      .channel(`user-role-requests-${effectiveUserId}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'role_change_requests',
        filter: `user_id=eq.${effectiveUserId}`
      }, (payload) => {
        console.log("⚡ [ProfileEditView] Realtime role_change_requests update:", payload);
        checkPending();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${effectiveUserId}`
      }, (payload) => {
        console.log("⚡ [ProfileEditView] Realtime profiles update:", payload);
        const updated = payload.new as any;
        if (updated?.role) {
          handleFieldChange('role', updated.role);
        }
        checkPending();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [effectiveUserId, currentRole]);

  const handleRoleCardClick = (role: 'seeker' | 'employer' | 'freelancer') => {
    if (role === currentRole) return;
    if (isPendingRoleChange) {
      addToast('لديك طلب قيد المراجعة، يرجى انتظار رد الإدارة أولاً.', 'error');
      return;
    }
    setTargetRoleToRequest(role);
    setRoleReason('');
    setShowRoleModal(true);
  };

  const handleSendRoleRequest = async () => {
    console.log("🔘 [ProfileEditView] تم الضغط على زر إرسال الطلب للإدارة...", {
      targetRoleToRequest,
      effectiveUserId,
      currentRole,
      roleReason,
      isSendingRoleRequest
    });

    if (!targetRoleToRequest) {
      addToast('يرجى اختيار نوع الحساب المطلوب', 'error');
      return;
    }

    if (!effectiveUserId) {
      console.error("❌ [ProfileEditView] خطأ: تعذر العثور على معرّف المستخدم (UserId is missing)", { formData, appUser });
      addToast('تعذر تحديد حساب المستخدم، يرجى إعادة تسجيل الدخول', 'error');
      return;
    }

    if (isSendingRoleRequest) return;
    setIsSendingRoleRequest(true);

    try {
      // إرسال مباشر إلى جدول role_change_requests في قاعدة البيانات
      const { data, error } = await profileService.sendRoleChangeRequest(
        effectiveUserId,
        formData?.name || appUser?.name || 'مستخدم',
        formData?.avatar || appUser?.avatar || '',
        currentRole,
        targetRoleToRequest,
        roleReason.trim()
      );
      if (error) {
        console.error("❌ [ProfileEditView] فشل إرسال الطلب:", error);
        throw error;
      }

      console.log("✅ [ProfileEditView] تم إرسال الطلب بنجاح تام!", data);
      const targetLabel = targetRoleToRequest === 'employer' 
        ? 'صاحب عمل / شركة 🏢' 
        : targetRoleToRequest === 'freelancer'
          ? 'عمل حر / كشفي ⚡'
          : 'باحث عن عمل 👤';
      addToast(`✅ تم إرسال طلب التحويل إلى "${targetLabel}" للإدارة بنجاح!`, 'success');
      setShowRoleModal(false);
      setPendingRoleRequest({
        requested_role: targetRoleToRequest,
        status: 'pending',
        created_at: new Date().toISOString()
      });
    } catch (e: any) {
      console.error("❌ [ProfileEditView] خطأ في الإرسال:", e);
      addToast('فشل إرسال الطلب: ' + (e.message || 'خطأ غير معروف'), 'error');
    } finally {
      setIsSendingRoleRequest(false);
    }
  };

  // كاشف موحد لجميع حقول الملف الشخصي
  const handleSecureFieldChange = (fieldKey: string, label: string, val: string) => {
    handleFieldChange(fieldKey, val);
    if (!val.trim()) {
      setFieldErrors(prev => ({ ...prev, [fieldKey]: null }));
      return;
    }
    const result = validateField(
      val, label,
      { id: formData?.id, name: formData?.name, email: formData?.email },
      '/profile/edit'
    );
    setFieldErrors(prev => ({ ...prev, [fieldKey]: result.valid ? null : (result.error ?? null) }));
  };

  const handleSkillsInputChange = (raw: string) => {
    setSkillsText(raw);
    const parsed = raw.split(',').map(s => s.trim()).filter(Boolean);
    handleFieldChange('skills', parsed);
  };

  const hasAnyError = Object.values(fieldErrors).some(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-8 pb-10"
      dir="rtl"
    >

      {/* ─── حالة التوفر للعمل (Available for Work) — حصرياً في الملف الشخصي ─── */}
      {currentRole !== 'employer' && (
        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border-2 border-emerald-500/30 rounded-[2.5rem] p-6 sm:p-7 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4 text-right">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
              formData.open_to === 'work' || formData.is_available
                ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
            }`}>
              <Briefcase size={26} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">
                خاصية الملف الشخصي
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                حالة التوفر للعمل (متاح للعمل 🟢 / غير متاح ⚪)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                تظهر هذه الشارة في ملفك الشخصي فقط لتنبيه أصحاب العمل بجاهزيتك للتوظيف والفرص
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => {
                handleFieldChange('open_to', 'work');
                handleFieldChange('is_available', true);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                formData.open_to === 'work' || formData.is_available
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <span>🟢 متاح للعمل الآن</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleFieldChange('open_to', 'none');
                handleFieldChange('is_available', false);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                formData.open_to === 'none' && !formData.is_available
                  ? 'bg-slate-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <span>⚪ غير متاح للعمل</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Section 0: نوع الحساب والصلاحيات ───────────────── */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-800/60 dark:to-blue-950/20 rounded-[2.5rem] border border-blue-100/60 dark:border-blue-900/40 p-6 md:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60 dark:border-slate-700/60">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-wider mb-2">
              <Sparkles size={12} />
              نوع الحساب والصلاحيات
            </div>
            <h3 className="text-base font-black text-slate-800 dark:text-white">
              تحديد فئة الحساب (باحث عن عمل / صاحب عمل / عمل حر)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
              تغيير نوع الحساب يتطلب مراجعة وموافقة من إدارة المنصة لضمان أمان الصلاحيات
            </p>
          </div>

          {loadingRoleCheck ? (
            <Loader2 size={16} className="animate-spin text-slate-400" />
          ) : isPendingRoleChange ? (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black">
              <Clock size={14} className="animate-pulse" />
              <span>طلبك قيد المراجعة لدى الإدارة ⏳</span>
            </div>
          ) : null}
        </div>

        {/* خيارات نوع الحساب */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* باحث عن عمل */}
          <div
            onClick={() => handleRoleCardClick('seeker')}
            className={`p-5 rounded-2xl border-2 transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
              currentRole === 'seeker'
                ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/50 shadow-md ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 hover:border-blue-300 dark:hover:border-blue-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                currentRole === 'seeker'
                  ? 'bg-blue-600 text-white shadow-blue-500/30'
                  : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
              }`}>
                <UserIcon size={22} />
              </div>
              {currentRole === 'seeker' ? (
                <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full shadow-sm flex items-center gap-1">
                  <CheckCircle2 size={12} /> حسابك الحالي
                </span>
              ) : (
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black rounded-full flex items-center gap-1">
                  <ArrowLeftRight size={11} /> اضغط للطلب
                </span>
              )}
            </div>
            <div>
              <h4 className="font-black text-sm text-slate-800 dark:text-white mb-1">👤 باحث عن عمل</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                تصفح الفرص والتقديم بالـ CV وبناء الملف المهني.
              </p>
            </div>
          </div>

          {/* صاحب عمل */}
          <div
            onClick={() => handleRoleCardClick('employer')}
            className={`p-5 rounded-2xl border-2 transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
              currentRole === 'employer'
                ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/50 shadow-md ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 hover:border-emerald-300 dark:hover:border-emerald-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                currentRole === 'employer'
                  ? 'bg-emerald-600 text-white shadow-emerald-500/30'
                  : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              }`}>
                <Briefcase size={22} />
              </div>
              {currentRole === 'employer' ? (
                <span className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-black rounded-full shadow-sm flex items-center gap-1">
                  <CheckCircle2 size={12} /> حسابك الحالي
                </span>
              ) : (
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black rounded-full flex items-center gap-1">
                  <ArrowLeftRight size={11} /> اضغط للطلب
                </span>
              )}
            </div>
            <div>
              <h4 className="font-black text-sm text-slate-800 dark:text-white mb-1">🏢 صاحب عمل / شركة</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                نشر الوظائف الشاغرة واستقطاب وإدارة المتقدمين.
              </p>
            </div>
          </div>

          {/* عمل حر / كشفي */}
          <div
            onClick={() => handleRoleCardClick('freelancer')}
            className={`p-5 rounded-2xl border-2 transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
              currentRole === 'freelancer'
                ? 'border-amber-600 bg-amber-50/80 dark:bg-amber-950/50 shadow-md ring-2 ring-amber-500/20'
                : 'border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 hover:border-amber-300 dark:hover:border-amber-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                currentRole === 'freelancer'
                  ? 'bg-amber-600 text-white shadow-amber-500/30'
                  : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
              }`}>
                <Wrench size={22} />
              </div>
              {currentRole === 'freelancer' ? (
                <span className="px-3 py-1 bg-amber-600 text-white text-[10px] font-black rounded-full shadow-sm flex items-center gap-1">
                  <CheckCircle2 size={12} /> حسابك الحالي
                </span>
              ) : (
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black rounded-full flex items-center gap-1">
                  <ArrowLeftRight size={11} /> اضغط للطلب
                </span>
              )}
            </div>
            <div>
              <h4 className="font-black text-sm text-slate-800 dark:text-white mb-1">⚡ عمل حر / كشفي</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                خدمات ميدانية سريعة وتواصل فوري بالرقم والموقع.
              </p>
            </div>
          </div>
        </div>

        {/* ملاحظة أمنية */}
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
          <Lock size={13} className="text-slate-400" />
          <span>عند اختيار النوع الآخر، يتم إرسال طلب رسمي للإدارة وتبقى الصلاحيات الحالية كما هي حتى تتم الموافقة.</span>
        </div>
      </div>

      {/* ─── Modal طلب تغيير نوع الحساب — يُرسل مباشرة لجدول role_change_requests ─── */}
      <AnimatePresence>
        {showRoleModal && targetRoleToRequest && (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            dir="rtl"
            onClick={() => !isSendingRoleRequest && setShowRoleModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 18 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 relative"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 ${
                  targetRoleToRequest === 'employer'
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
                    : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30'
                }`}>
                  {targetRoleToRequest === 'employer' ? <Briefcase size={22} /> : <UserIcon size={22} />}
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">طلب تغيير فئة الحساب</p>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white leading-tight">
                    التحويل إلى: {targetRoleToRequest === 'employer' ? 'صاحب عمل / شركة 🏢' : 'باحث عن عمل 👤'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
                >
                  <X size={17} />
                </button>
              </div>

              {/* سبب الطلب */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                  سبب الطلب (اختياري — يساعد في سرعة القبول)
                </label>
                <textarea
                  value={roleReason}
                  onChange={e => setRoleReason(e.target.value)}
                  placeholder={
                    targetRoleToRequest === 'employer'
                      ? 'أرغب في نشر وظائف وإدارة موظفين...'
                      : 'أرغب في البحث عن فرص عمل مناسبة...'
                  }
                  rows={3}
                  maxLength={500}
                  className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 text-slate-800 dark:text-white resize-none transition-all placeholder:text-slate-400"
                />
              </div>

              {/* ملاحظة */}
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
                <ShieldCheck size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                  يُحفظ الطلب في عمود <strong>طلبات تغيير</strong> بقاعدة البيانات وتراجعه الإدارة في قسم الدعم لتوافق أو ترفض مباشرةً.
                </p>
              </div>

              {/* أزرار الإرسال */}
              <div className="flex gap-3">
                <button
                  id="btn-send-role-request"
                  onClick={handleSendRoleRequest}
                  disabled={isSendingRoleRequest}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-xs text-white shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 transition-all ${
                    targetRoleToRequest === 'employer'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/30'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-600/30'
                  }`}
                >
                  {isSendingRoleRequest ? (
                    <><Loader2 size={15} className="animate-spin" /> جاري الإرسال لقاعدة البيانات...</>
                  ) : (
                    <><Send size={14} /> إرسال الطلب للإدارة</>
                  )}
                </button>
                <button
                  onClick={() => setShowRoleModal(false)}
                  disabled={isSendingRoleRequest}
                  className="px-5 py-3.5 rounded-2xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Section 1: Personal & Contact ────────────────── */}
      <GlassCard className="p-8 rounded-[2.5rem] space-y-6 border border-slate-100 shadow-xl bg-white/50">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-200">
            <UserIcon size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">المعلومات الشخصية والاتصال</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">المعلومات الأساسية للوصول إليك</p>
          </div>
        </div>

        {/* ─── Profile Photos & Visual Identity ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          {/* Avatar Upload Card */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-blue-500 shadow-md shrink-0 bg-white dark:bg-slate-700">
                <img
                  src={formData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'User')}&background=random`}
                  alt="Avatar Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h5 className="text-xs font-black text-slate-800 dark:text-white">الصورة الشخصية</h5>
                <p className="text-[9px] font-bold text-slate-400">تُحفظ وتُستبدل مباشرة وتلقائياً</p>
              </div>
            </div>

            {handleAvatarChange && (
              <>
                <label 
                  htmlFor="avatar-file-input-edit" 
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black cursor-pointer shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Camera size={13} />
                  <span>تغيير الصورة</span>
                </label>
                <input
                  id="avatar-file-input-edit"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                  onChange={handleAvatarChange}
                />
              </>
            )}
          </div>

          {/* Cover Photo Upload Card */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-md shrink-0 bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-center">
                {formData.coverUrl || (formData as any).cover_url ? (
                  <img
                    src={formData.coverUrl || (formData as any).cover_url}
                    alt="Cover Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon size={20} className="text-white/70" />
                )}
              </div>
              <div className="min-w-0">
                <h5 className="text-xs font-black text-slate-800 dark:text-white">صورة الغلاف (الخلفية)</h5>
                <p className="text-[9px] font-bold text-slate-400">تُحفظ وتُستبدل مباشرة وتلقائياً</p>
              </div>
            </div>

            {handleCoverChange && (
              <>
                <label 
                  htmlFor="cover-file-input-edit" 
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <ImageIcon size={13} />
                  <span>تغيير الغلاف</span>
                </label>
                <input
                  id="cover-file-input-edit"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                  onChange={handleCoverChange}
                />
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label htmlFor="edit-name" className={labelClass}>الاسم الكامل</label>
            <input
              id="edit-name"
              name="name"
              className={`${inputClass} ${fieldErrors.name ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
              value={formData.name}
              onChange={e => handleSecureFieldChange('name', 'الاسم', e.target.value)}
              placeholder="اسمك الكامل"
            />
            {fieldErrors.name && (
              <div className="mt-1.5 flex items-start gap-1.5 text-red-600 text-[11px] font-semibold">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{fieldErrors.name}</span>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="edit-phone" className={labelClass}>رقم الهاتف</label>
            <div className="relative">
              <Phone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
              <input
                id="edit-phone"
                name="phone"
                className={`${inputClass} pr-10 ${fieldErrors.phone ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                value={formData.phone || ''}
                onChange={e => handleSecureFieldChange('phone', 'رقم الهاتف', e.target.value)}
                placeholder="07XXXXXXXXX"
                dir="ltr"
              />
            </div>
            {fieldErrors.phone && (
              <div className="mt-1.5 flex items-start gap-1.5 text-red-600 text-[11px] font-semibold">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{fieldErrors.phone}</span>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="edit-location" className={labelClass}>المدينة / الموقع</label>
            <input
              id="edit-location"
              name="location"
              className={inputClass}
              value={formData.location || ''}
              onChange={e => handleFieldChange('location', e.target.value)}
              placeholder="بغداد، العراق"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="edit-website" className={labelClass}>الموقع الإلكتروني / LinkedIn</label>
            <div className="relative">
              <Globe size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
              <input
                id="edit-website"
                name="website"
                className={`${inputClass} pr-10 ${fieldErrors.website ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                value={formData.website || ''}
                onChange={e => handleSecureFieldChange('website', 'الموقع الإلكتروني', e.target.value)}
                placeholder="https://linkedin.com/in/..."
                dir="ltr"
              />
            </div>
            {fieldErrors.website && (
              <div className="mt-1.5 flex items-start gap-1.5 text-red-600 text-[11px] font-semibold">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{fieldErrors.website}</span>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* ─── Section 2: Professional Info ────────────────── */}
      <GlassCard className="p-8 rounded-[2.5rem] space-y-5 border border-slate-100 shadow-xl bg-white/50">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-violet-200">
            <Briefcase size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">المعلومات المهنية</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">تخصصك ومجال عملك</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label htmlFor="edit-title" className={labelClass}>المسمى الوظيفي / التخصص</label>
            <input
              id="edit-title"
              name="industry"
              className={`${inputClass} ${fieldErrors.industry ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
              value={formData.industry || formData.title || ''}
              onChange={e => handleSecureFieldChange('industry', 'المسمى الوظيفي', e.target.value)}
              placeholder="مثال: مطور ويب — React & Node.js"
            />
            {fieldErrors.industry && (
              <div className="mt-1.5 flex items-start gap-1.5 text-red-600 text-[11px] font-semibold">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{fieldErrors.industry}</span>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="edit-company" className={labelClass}>اسم الشركة / المنشأة</label>
            <input
              id="edit-company"
              name="companyName"
              className={`${inputClass} ${fieldErrors.companyName ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
              value={formData.companyName || ''}
              onChange={e => handleSecureFieldChange('companyName', 'اسم الشركة', e.target.value)}
              placeholder="اسم مؤسستك أو شركتك"
            />
            {fieldErrors.companyName && (
              <div className="mt-1.5 flex items-start gap-1.5 text-red-600 text-[11px] font-semibold">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{fieldErrors.companyName}</span>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="edit-industry" className={labelClass}>مجال النشاط / الصناعة</label>
            <input
              id="edit-industry"
              name="industry"
              className={inputClass}
              value={formData.industry || ''}
              onChange={e => handleFieldChange('industry', e.target.value)}
              placeholder="مثال: تقنية المعلومات، التجارة..."
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="edit-bio" className={labelClass}>نبذة شخصية / عن نفسك</label>
            <textarea
              id="edit-bio"
              name="bio"
              rows={3}
              className={`${inputClass} resize-none ${fieldErrors.bio ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
              value={formData.bio || ''}
              onChange={e => handleSecureFieldChange('bio', 'النبذة الشخصية', e.target.value)}
              placeholder="اكتب نبذة مختصرة عنك وعن خبرتك المهنية..."
            />
            {fieldErrors.bio && (
              <div className="mt-1.5 flex items-start gap-1.5 text-red-600 text-[11px] font-semibold">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{fieldErrors.bio}</span>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* ─── Section 3: Experience ────────────────── */}
      <GlassCard className="p-8 rounded-[2.5rem] space-y-5 border border-slate-100 shadow-xl bg-white/50">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-200">
            <Book size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">الخبرة العملية</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">سنوات العمل والخبرة المكتسبة</p>
          </div>
        </div>
        <div>
          <label htmlFor="edit-experience" className={labelClass}>وصف الخبرة العملية</label>
          <textarea
            id="edit-experience"
            name="experience"
            rows={4}
            className={`${inputClass} resize-none ${fieldErrors.experience ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
            value={formData.experience || ''}
            onChange={e => handleSecureFieldChange('experience', 'الخبرة العملية', e.target.value)}
            placeholder="اذكر مجالات خبرتك وعدد سنوات العمل في كل مجال..."
          />
          {fieldErrors.experience && (
            <div className="mt-1.5 flex items-start gap-1.5 text-red-600 text-[11px] font-semibold">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{fieldErrors.experience}</span>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ─── Section 4: Education ────────────────── */}
      <GlassCard className="p-8 rounded-[2.5rem] space-y-5 border border-slate-100 shadow-xl bg-white/50">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200">
            <GraduationCap size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">المؤهل التعليمي</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">أعلى شهادة أكاديمية حاصل عليها</p>
          </div>
        </div>
        <div>
          <label htmlFor="edit-education" className={labelClass}>التعليم والمؤهلات</label>
          <textarea
            id="edit-education"
            name="education"
            rows={3}
            className={`${inputClass} resize-none ${fieldErrors.education ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
            value={formData.education || ''}
            onChange={e => handleSecureFieldChange('education', 'التعليم', e.target.value)}
            placeholder="مثال: بكالوريوس هندسة حاسبات — جامعة بغداد 2020"
          />
          {fieldErrors.education && (
            <div className="mt-1.5 flex items-start gap-1.5 text-red-600 text-[11px] font-semibold">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{fieldErrors.education}</span>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ─── Section 5: Key Skills ────────────────── */}
      <GlassCard className="p-8 rounded-[2.5rem] space-y-5 border border-slate-100 shadow-xl bg-white/50">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-teal-200">
            <Tag size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">المهارات الرئيسية</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">أبرز مهاراتك التقنية</p>
          </div>
        </div>

        <div className="space-y-3">
          <input
            id="edit-skills"
            name="skills"
            className={`${inputClass} ${fieldErrors.skills ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
            value={skillsText}
            onChange={e => handleSkillsInputChange(e.target.value)}
            placeholder="أدخل المهارات مفصولة بفواصل (مثال: React, JavaScript, تصميم)"
          />
          {fieldErrors.skills && (
            <div className="flex items-start gap-1.5 text-red-600 text-[11px] font-semibold">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{fieldErrors.skills}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {(formData.skills || []).map((s: string) => (
              <span
                key={s}
                className="group flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl text-[11px] font-black border border-emerald-100 hover:bg-emerald-100 transition-all cursor-default"
              >
                {s}
                <button
                  type="button"
                  onClick={() => {
                    const nextSkills = (formData.skills || []).filter((sk: string) => sk !== s);
                    handleFieldChange('skills', nextSkills);
                    setSkillsText(nextSkills.join(', '));
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-emerald-200 rounded-md"
                >
                  <Plus size={10} className="rotate-45" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* ─── Section 6: Document Management (CV Upload) ────────────────── */}
      <GlassCard className="p-8 rounded-[2.5rem] space-y-5 border border-slate-100 shadow-xl bg-white/50 relative overflow-hidden">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-200">
            <FileText size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">رفع السيرة الذاتية (CV)</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">ملف PDF جاهز للتحميل</p>
          </div>
        </div>

        <label 
          htmlFor="profile-cv-upload-input"
          className="relative group cursor-pointer block"
        >
          <input
            id="profile-cv-upload-input"
            type="file"
            onChange={handleCVUpload}
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
          />
          <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 group-hover:border-blue-400 group-hover:bg-blue-50/30 transition-all active:scale-[0.98]">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
              <CloudUpload className="text-blue-500" size={24} />
            </div>
            <p className="text-xs font-black text-slate-700">اضغط لاختيار ورفع ملف السيرة الذاتية</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">PDF, DOCX (Max 25MB)</p>
          </div>
        </label>

        {pendingCVName && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-amber-800">ملف جاهز للرفع عند الحفظ ✓</p>
              <p className="text-[9px] text-amber-600 font-bold truncate">{pendingCVName}</p>
            </div>
            <span className="text-[9px] font-black text-amber-500 bg-amber-100 px-2 py-1 rounded-lg">معلق رفع</span>
          </div>
        )}

        {!pendingCVName && formData.cv_url && (
          <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-800">تم رفع السيرة بنجاح</p>
                <p className="text-[9px] text-emerald-600 font-bold truncate">
                  {formData.cv_url.split('/').pop()}
                </p>
              </div>
            </div>
            <a
              href={formData.cv_url}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-white text-emerald-600 text-[10px] font-black rounded-xl shadow-sm hover:shadow-md transition-all shrink-0"
            >
              عرض الملف
            </a>
          </div>
        )}
      </GlassCard>

      {/* ─── Bottom Actions: Save & Back to Top ────────────────── */}
      <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
        {handleSave && (
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving' || hasAnyError}
            title={hasAnyError ? 'يرجى تصحيح الأخطاء قبل الحفظ' : undefined}
            className={`w-full sm:w-auto px-10 py-4 text-white text-sm font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 ${
              hasAnyError
                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                : 'bg-[#0a66c2] hover:bg-[#004182] active:scale-95 cursor-pointer shadow-blue-200 dark:shadow-none'
            }`}
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>جاري حفظ التغييرات...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>حفظ جميع التغييرات ✓</span>
              </>
            )}
          </button>
        )}
        <button
          onClick={onScrollToTop}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-700"
        >
          <Plus size={14} className="-rotate-90" />
          العودة للأعلى
        </button>
      </div>
    </motion.div>
  );
};
