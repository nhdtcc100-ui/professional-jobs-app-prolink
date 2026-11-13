import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Sparkles,
  FileText,
  Lock,
  Globe2,
  Zap,
  ArrowRight,
  HeadphonesIcon,
  Send,
  MessageCircle,
  CheckCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Scale,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppContext } from '../../contexts/AppContext';
import { telegramSupportService } from '../../lib/services/telegramSupportService';

import { isUUID, sanitizeInput } from '../../lib/utils/sanitize';

/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */
const SUPPORT_PHONE   = '07724053743';
const SUPPORT_PHONE_2 = '07724053748';

/* ─────────────────────────────────────────────────────────────
   Props
───────────────────────────────────────────────────────────── */
/* ────────────────────────────────────────────────────────────
   Types
──────────────────────────────────────────────────────────── */
interface AboutPageProps {
  onBack?: () => void;
  appUser?: any;
  onOpenChat?: (targetUser: any) => void;
}

interface SupportMessage {
  id: string;
  sender_id: string;
  receiver_id?: string;
  content: string;
  message_type?: 'text' | 'role_change_request' | 'system';
  metadata?: Record<string, any> | null;
  created_at: string;
  read: boolean;
}

// جدول منفصل تماماً عن جدول الرسائل العادية
const SUPPORT_TABLE = 'support_messages';

/* ─────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────── */
export const AboutPage: React.FC<AboutPageProps> = ({ onBack, appUser }) => {
  const { allUsers = [] } = useAppContext();
  type Tab = 'overview' | 'terms' | 'labor' | 'privacy' | 'support';
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  /* ── Support chat state ────────────────────────────────── */
  const [chatMsg, setChatMsg]         = useState('');
  const [sending, setSending]         = useState(false);
  const [messages, setMessages]       = useState<SupportMessage[]>([]);
  const [adminId, setAdminId]         = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [telegramHandle, setTelegramHandle] = useState<string>(() => telegramSupportService.getCachedHandle());

  useEffect(() => {
    telegramSupportService.getHandle().then(h => setTelegramHandle(h));
    const onHandleChange = (e: any) => {
      if (e?.detail?.handle) setTelegramHandle(e.detail.handle);
    };
    window.addEventListener('prolink_telegram_handle_changed', onHandleChange);
    return () => window.removeEventListener('prolink_telegram_handle_changed', onHandleChange);
  }, []);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ── Resolve ALL admin UUIDs (not just one) ─────────── */
  const resolveAllAdminIDs = async (): Promise<string[]> => {
    try {
      // 1. فحص فوري من قائمة المستخدمين في الذاكرة
      const memIds = (allUsers || [])
        .filter(u => u.isAdmin || u.is_admin || (u as any).role === 'admin' || (u as any).role === 'superadmin' ||
          (u.email && (
            u.email.toLowerCase().includes('admin@prolink.com') ||
            u.email.toLowerCase().includes('nhdtcc100@gmail.com') ||
            u.email.toLowerCase().includes('nhd0770@gmail.com')
          )) ||
          u.phone === SUPPORT_PHONE || u.phone === SUPPORT_PHONE_2
        )
        .map(u => u.id)
        .filter(Boolean);

      if (memIds.length > 0) {
        setAdminId(memIds[0]);
        return memIds;
      }

      // 2. فحص قاعدة البيانات بالبريد، الهاتف، والصلاحيات
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, role, is_admin, phone, email")
        .or(`is_admin.eq.true,role.eq.admin,role.eq.superadmin,phone.eq.${SUPPORT_PHONE},phone.eq.${SUPPORT_PHONE_2},email.ilike.%admin@prolink.com%,email.ilike.%nhdtcc100@gmail.com%,email.ilike.%nhd0770@gmail.com%`);
      if (data && data.length > 0) {
        const ids: string[] = data.map((p: any) => p.id).filter(Boolean);
        if (ids.length > 0) {
          setAdminId(ids[0]);
          return ids;
        }
      }

      // 3. احتياط: أول حساب مسجل في المنصة
      const { data: firstProfiles } = await (supabase as any)
        .from("profiles")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(2);
      if (firstProfiles && firstProfiles.length > 0) {
        const ids = firstProfiles.map((p: any) => p.id).filter(Boolean);
        if (ids.length > 0) {
          setAdminId(ids[0]);
          return ids;
        }
      }
    } catch (e) {
      console.error("resolveAllAdminIDs error:", e);
    }
    return [];
  };

  /* ── Resolve admin ID once when support tab opens ──────── */
  useEffect(() => {
    if (activeTab !== "support" || adminId) return;
    resolveAllAdminIDs();
  }, [activeTab, adminId]);
  /* ── Load conversation history ────────────────────── */
  useEffect(() => {
    if (activeTab !== "support" || !appUser?.id) return;
    setChatLoading(true);

    const threeDaysAgoISO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    (supabase as any)
      .from(SUPPORT_TABLE)
      .select("*")
      .or(`sender_id.eq.${appUser.id},receiver_id.eq.${appUser.id}`)
      .gte("created_at", threeDaysAgoISO)
      .order("created_at", { ascending: true })
      .then(({ data }: any) => {
        setMessages(data || []);
        setChatLoading(false);
      });
  }, [activeTab, appUser?.id]);

  /* ── Auto-sync Telegram replies while in support tab ────── */
  useEffect(() => {
    if (activeTab !== "support" || !appUser?.id) return;

    const pullAndRefresh = async () => {
      try {
        const res = await telegramSupportService.syncTelegramReplies(appUser.id);
        if (res.synced > 0) {
          const threeDaysAgoISO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
          const { data } = await (supabase as any)
            .from(SUPPORT_TABLE)
            .select("*")
            .or(`sender_id.eq.${appUser.id},receiver_id.eq.${appUser.id}`)
            .gte("created_at", threeDaysAgoISO)
            .order("created_at", { ascending: true });
          if (data) setMessages(data as SupportMessage[]);
        }
      } catch (_) {}
    };

    pullAndRefresh();
    const interval = setInterval(pullAndRefresh, 6000);
    return () => clearInterval(interval);
  }, [activeTab, appUser?.id]);

  /* ── Real‑time subscription ─────────────────────── */
  useEffect(() => {
    if (!appUser?.id) return;
    // موجة دعم منفصلة لجدول support_messages فقط
    const channel = (supabase as any)
      .channel(`support-chat-live-${appUser.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: SUPPORT_TABLE,
        filter: `receiver_id=eq.${appUser.id}`,
      }, (payload: any) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as SupportMessage];
        });
      })
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [appUser?.id]);

  /* ── Scroll to bottom whenever messages change ─────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Send message handler ──────────────────────────────── */
  const handleSend = async () => {
    const clean = sanitizeInput(chatMsg.trim());
    if (!clean || !appUser?.id) return;

    setSending(true);

    const adminList = await resolveAllAdminIDs();
    const primaryAdminId = adminId || adminList[0] || appUser.id;

    const newMsg: SupportMessage = {
      id: `tmp-${Date.now()}`,
      sender_id: appUser.id,
      receiver_id: primaryAdminId,
      content: clean,
      message_type: "text",
      created_at: new Date().toISOString(),
      read: false,
    };
    setMessages(prev => [...prev, newMsg]);
    setChatMsg("");

    let insertedId: string | undefined;

    try {
      // 1. محاولة الإرسال بـ primaryAdminId (إذا كان UUID صحيحاً)
      let inserted = false;
      if (primaryAdminId && primaryAdminId !== appUser.id) {
        const { data, error } = await (supabase as any)
          .from(SUPPORT_TABLE)
          .insert([{ sender_id: appUser.id, receiver_id: primaryAdminId, content: clean, message_type: "text" }])
          .select('id');
        if (!error && data?.[0]?.id) {
          insertedId = data[0].id;
          inserted = true;
        } else {
          console.warn("Support Chat: primary admin receiver failed:", error?.message);
        }
      }

      // 2. بديل: إرسال بدون receiver_id (nullable بعد SQL migration)
      if (!inserted) {
        const { data: d2, error: e2 } = await (supabase as any)
          .from(SUPPORT_TABLE)
          .insert([{ sender_id: appUser.id, receiver_id: null, content: clean, message_type: "text" }])
          .select('id');
        if (!e2 && d2?.[0]?.id) {
          insertedId = d2[0].id;
          inserted = true;
        } else {
          console.warn("Support Chat: null-receiver fallback failed:", e2?.message);
        }
      }

      // 3. بديل أخير: إرسال مع receiver_id = appUser.id (مضمون وجوده في auth.users)
      if (!inserted) {
        const { data: d3 } = await (supabase as any)
          .from(SUPPORT_TABLE)
          .insert([{ sender_id: appUser.id, receiver_id: appUser.id, content: clean, message_type: "text" }])
          .select('id');
        if (d3?.[0]?.id) insertedId = d3[0].id;
      }
    } catch (e) {
      console.error("Support Chat insert exception:", e);
    }

    // 🚀 3. إرسال الإشعار الفوري والمباشر إلى بوت تيليجرام
    try {
      await telegramSupportService.sendSupportNotification({
        userName: appUser.name || 'مستخدم المنصة',
        userPhone: appUser.phone || '',
        userRole: appUser.role === 'employer' ? 'صاحب عمل 💼' : 'باحث عن عمل 👤',
        userId: appUser.id,
        content: clean,
        messageId: insertedId,
      });
    } catch (tgErr) {
      console.warn("Telegram notification error:", tgErr);
    } finally {
      setSending(false);
    }
  };

  /* ── Tabs config ────────────────────────────────────────── */
  const TABS = [
    { id: 'overview' as Tab, label: 'عن المنصة',         icon: Building2 },
    { id: 'terms'    as Tab, label: 'شروط الاستخدام',    icon: FileText },
    { id: 'labor'    as Tab, label: 'قانون العمل',        icon: Scale },
    { id: 'privacy'  as Tab, label: 'الخصوصية',          icon: Lock },
    { id: 'support'  as Tab, label: 'الدعم',             icon: HeadphonesIcon },
  ];

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 min-h-screen" dir="rtl">

      {/* ── Top Banner ──────────────────────────────────────── */}
      <div className="relative p-8 md:p-12 rounded-[2.5rem] bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 overflow-hidden border-0 shadow-2xl">
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/4 -top-12 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-black text-white">
              <Sparkles size={14} className="text-amber-300 animate-pulse" />
              منصة عمل أولاً
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black text-white transition-colors"
              >
                <ArrowRight size={14} />
                العودة
              </button>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-white">
            منصة عمل أولاً — التوظيف الذكي
          </h1>
          <p className="text-sm md:text-base font-medium text-blue-100/90 max-w-2xl leading-relaxed">
            المنصة الذكية الأولى للربط المباشر بين أصحاب العمل والباحثين عن الفرص عبر تقنيات المطابقة الدقيقة وتجارب التواصل اللحظي.
          </p>
          <div className="pt-4 flex flex-wrap gap-4 text-xs font-bold text-blue-100">
            <span className="flex items-center gap-1.5"><Globe2 size={15} /> تغطية شاملة للمحافظات</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={15} /> توثيق الحسابات والأدوار</span>
            <span className="flex items-center gap-1.5"><Zap size={15} /> بحث بالرادار الدائري</span>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ────────────────────────────────────────── */}
      <div className="flex gap-1 p-1.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] font-black transition-all flex-1 min-w-0 ${
              activeTab === t.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <t.icon size={15} className="shrink-0" />
            {/* Label: visible on md+, hidden on mobile (icon-only) */}
            <span className="hidden md:block truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ──────────────────────────────────────  */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-5"
        >

          {/* ══ OVERVIEW ══ */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 space-y-4 border border-slate-100 dark:border-slate-700 shadow-sm">
                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                  رؤيتنا ورسالتنا
                </h3>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  نهدف في منصة عمل إلى تمكين المحترفين في العراق والوطن العربي من الوصول الشفاف والسريع للفرص الوظيفية التي تناسب مهاراتهم الفعلية، وتوفير أدوات توظيف متقدمة لأصحاب العمل تعتمد على رادار الموقع والمسمى الوظيفي.
                </p>
              </div>

              {/* 3 feature cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { num: '01', color: 'blue',   title: 'الرادار الدائري',        body: 'استكشاف الكفاءات حولك بنفس المدينة والمسمى الوظيفي بتصميم دائري تفاعلي.' },
                  { num: '02', color: 'indigo',  title: 'نظام متابعة المتقدمين', body: 'لوحة تحكم كاملة لإدارة المتقدمين وفرز السير الذاتية بضغطة زر.' },
                  { num: '03', color: 'purple',  title: 'مراسلة آمنة',           body: 'تواصل مهني مباشر بدون الحاجة لمشاركة الأرقام الشخصية.' },
                ].map(c => (
                  <div key={c.num} className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 space-y-3 border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div className={`w-12 h-12 rounded-2xl bg-${c.color}-100 dark:bg-${c.color}-900/30 text-${c.color}-600 dark:text-${c.color}-400 flex items-center justify-center font-black text-lg`}>
                      {c.num}
                    </div>
                    <h4 className="font-black text-slate-800 dark:text-white text-sm">{c.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{c.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ TERMS ══ */}
          {activeTab === 'terms' && (
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 space-y-5 border border-slate-100 dark:border-slate-700 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4">شروط وأحكام الاستخدام</h3>
              <div className="space-y-5">
                {[
                  { title: '1. قبول الشروط',             body: 'باستخدامك لمنصة عمل، فإنك توافق على الالتزام بكافة الشروط والأحكام المنصوص عليها هنا.' },
                  { title: '2. صحة البيانات',            body: 'يتعهد المستخدم بنشر بيانات صحيحة ودقيقة في ملفه الشخصي وفي إعلانات الوظائف المنشأة.' },
                  { title: '3. السلوك المهني',           body: 'تمنع المنصة أي شكل من أشكال الاحتيال أو النشر العشوائي أو استخدام التواصل لغير أغراض التوظيف.' },
                  { title: '4. حقوق الملكية والتحفظات', body: 'تحتفظ إدارة المنصة بحق تقييد أي حساب يخالف المعايير المهنية.' },
                ].map(item => (
                  <div key={item.title} className="border-r-2 border-blue-200 dark:border-blue-700 pr-4">
                    <h4 className="font-black text-slate-800 dark:text-white text-sm mb-1.5">{item.title}</h4>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ LABOR LAW ══ */}
          {activeTab === 'labor' && (
            <div className="space-y-4" dir="rtl">
              {/* رأس القسم */}
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[2rem] p-6 text-white relative overflow-hidden">
                <div className="absolute -left-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Scale size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg leading-tight">قانون العمل العراقي</h3>
                      <p className="text-emerald-100 text-[11px] font-bold">رقم 37 لسنة 2015 — أبرز المواد والأحكام</p>
                    </div>
                  </div>
                  <p className="text-emerald-50 text-xs font-medium leading-relaxed">
                    هذا ملخص للمواد الأساسية التي تنظم علاقة العمل في جمهورية العراق. يُرجى الرجوع إلى النص الرسمي للقانون لأغراض قانونية رسمية.
                  </p>
                </div>
              </div>

              {/* الباب الأول */}
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 text-[10px] font-black">١</span>
                  </div>
                  <h4 className="font-black text-slate-800 dark:text-white text-sm">الباب الأول: نطاق السريان والمبادئ الأساسية</h4>
                </div>
                {[
                  {
                    art: 'المادة (2)',
                    text: 'تسري أحكام هذا القانون على جميع العمال في جمهورية العراق. لا تسري على: الموظفين العموميين المعينين وفق قانون الخدمة المدنية، وأفراد القوات المسلحة ومنتسبي الشرطة والأمن الداخلي.',
                    color: 'blue',
                  },
                  {
                    art: 'المادة (4)',
                    text: 'العمل حق لكل مواطن قادر عليه، وتعمل الدولة على توفيره على أساس تكافؤ الفرص دون أي نوع من أنواع التمييز.',
                    color: 'blue',
                  },
                  {
                    art: 'المادة (5)',
                    text: 'يُحظر العمل الجبري أو الإلزامي بكافة أشكاله. لا يُعدّ جبرياً: الأعمال المفروضة بحكم قضائي تحت إشراف السلطات العامة، والواجبات المدنية الاعتيادية، وأعمال حالات الطوارئ.',
                    color: 'blue',
                  },
                  {
                    art: 'المادة (7)',
                    text: 'يُحدد الحد الأدنى لسن العمل بعمر (15) خمس عشرة سنة.',
                    color: 'amber',
                  },
                  {
                    art: 'المادة (8)',
                    text: 'يُحظر التمييز في الاستخدام والمهنة على أساس العرق أو اللون أو الجنس أو الدين أو المعتقد أو الرأي السياسي أو الأصل القومي أو الاجتماعي.',
                    color: 'red',
                  },
                  {
                    art: 'المادتان (10) و(11)',
                    text: 'يُحظر التحرش الجنسي في مكان العمل، ومنع خلق بيئة عمل ترهيبية أو عدائية أو مهينة.',
                    color: 'red',
                  },
                ].map(item => (
                  <div key={item.art} className={`border-r-2 border-${item.color}-300 dark:border-${item.color}-700 pr-4 py-1`}>
                    <span className={`inline-block text-[10px] font-black text-${item.color}-600 dark:text-${item.color}-400 bg-${item.color}-50 dark:bg-${item.color}-900/30 px-2 py-0.5 rounded-full mb-1.5`}>{item.art}</span>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>

              {/* عقود العمل */}
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center">
                    <span className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black">٢</span>
                  </div>
                  <h4 className="font-black text-slate-800 dark:text-white text-sm">عقود العمل والتزامات الطرفين</h4>
                </div>
                {[
                  {
                    art: 'المادة (37)',
                    text: 'يُبرم عقد العمل شفوياً أو تحريرياً باتفاق الطرفين. إذا كان مكتوباً يُنظَّم بثلاث نسخ. لا يجوز تحديد مدة للعقد في الأعمال ذات الطبيعة المستمرة. يتمتع العامل بعقد محدد المدة بنفس حقوق العقد الدائم. يُعدّ العقد غير محدد المدة إذا جُدِّد أكثر من مرة.',
                    color: 'indigo',
                  },
                  {
                    art: 'المادة (41) — التزامات صاحب العمل',
                    text: 'توفير بيئة عمل آمنة وصحية، دفع الأجور في مواعيدها، واحترام كرامة العامل وعدم الإساءة إليه.',
                    color: 'indigo',
                  },
                  {
                    art: 'المادة (42) — حقوق العامل',
                    text: 'تقاضي الأجر العادل، التمتع بفترات الراحة اليومية والأسبوعية، والعمل في بيئة خالية من التحرش والتمييز.',
                    color: 'indigo',
                  },
                  {
                    art: 'المادة (43) — التزامات العامل',
                    text: 'أداء الواجبات بدقة وأمانة، الحفاظ على ممتلكات العمل، عدم إفشاء الأسرار، والالتزام بقواعد الصحة والسلامة المهنية.',
                    color: 'indigo',
                  },
                ].map(item => (
                  <div key={item.art} className={`border-r-2 border-${item.color}-300 dark:border-${item.color}-700 pr-4 py-1`}>
                    <span className={`inline-block text-[10px] font-black text-${item.color}-600 dark:text-${item.color}-400 bg-${item.color}-50 dark:bg-${item.color}-900/30 px-2 py-0.5 rounded-full mb-1.5`}>{item.art}</span>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>

              {/* ساعات العمل والإجازات */}
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center">
                    <span className="text-amber-600 dark:text-amber-400 text-[10px] font-black">٣</span>
                  </div>
                  <h4 className="font-black text-slate-800 dark:text-white text-sm">ساعات العمل والأجور والإجازات</h4>
                </div>
                {[
                  {
                    art: 'المادة (66) وما بعدها',
                    text: 'تحديد ساعات العمل اليومية والأسبوعية بحد أقصى 48 ساعة أسبوعياً، وتنظيم العمل النهاري والليلي والمختلط.',
                    color: 'amber',
                  },
                  {
                    art: 'المادة (81) وما بعدها — الإجازات',
                    text: 'حق العامل في الإجازات السنوية المأجورة مع زيادة تدريجية بمرور سنوات الخدمة. الإجازات الخاصة: الزواج، والوفاة، والأعياد الرسمية والدينية.',
                    color: 'amber',
                  },
                ].map(item => (
                  <div key={item.art} className={`border-r-2 border-${item.color}-300 dark:border-${item.color}-700 pr-4 py-1`}>
                    <span className={`inline-block text-[10px] font-black text-${item.color}-600 dark:text-${item.color}-400 bg-${item.color}-50 dark:bg-${item.color}-900/30 px-2 py-0.5 rounded-full mb-1.5`}>{item.art}</span>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>

              {/* حماية المرأة */}
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 bg-pink-100 dark:bg-pink-900/40 rounded-xl flex items-center justify-center">
                    <span className="text-pink-600 dark:text-pink-400 text-[10px] font-black">٤</span>
                  </div>
                  <h4 className="font-black text-slate-800 dark:text-white text-sm">حماية المرأة العاملة</h4>
                </div>
                {[
                  {
                    art: 'المادة (85)',
                    text: 'يُحظر إرغام المرأة الحامل أو المرضع على أداء عمل إضافي أو أي عمل تعده الجهة الصحية مضراً بصحة الأم أو الطفل.',
                    color: 'pink',
                  },
                  {
                    art: 'المادة (86)',
                    text: 'تنظيم ضوابط تشغيل المرأة في العمل الليلي والقيود المفروضة، ومنحها فترة راحة يومية متواصلة لا تقل عن (11) ساعة.',
                    color: 'pink',
                  },
                  {
                    art: 'المادتان (87) و(88)',
                    text: 'إجازات الحمل والوضع والرضاعة وشروطها والأجر خلالها لحماية حقوق الأمومة العاملة.',
                    color: 'pink',
                  },
                ].map(item => (
                  <div key={item.art} className={`border-r-2 border-${item.color}-300 dark:border-${item.color}-700 pr-4 py-1`}>
                    <span className={`inline-block text-[10px] font-black text-${item.color}-600 dark:text-${item.color}-400 bg-${item.color}-50 dark:bg-${item.color}-900/30 px-2 py-0.5 rounded-full mb-1.5`}>{item.art}</span>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>

              {/* تذييل */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-[1.5rem] p-4 border border-emerald-100 dark:border-emerald-900/40 text-center">
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  ⚖️ هذا الملخص لأغراض توعوية فقط — للاستشارات القانونية الرجاء التواصل مع محامٍ مختص أو الجهات العمالية الرسمية.
                </p>
              </div>
            </div>
          )}
          {/* ══ PRIVACY ══ */}
          {activeTab === 'privacy' && (
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 space-y-5 border border-slate-100 dark:border-slate-700 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4">سياسة حماية الخصوصية</h3>
              <div className="space-y-5">
                {[
                  { title: '1. جمع البيانات',                   body: 'نجمع البيانات الأساسية بغرض عرض ملفك المهني وتمكين خوارزمية المطابقة.' },
                  { title: '2. تشفير الاتصالات',                body: 'تتم الاتصالات عبر بروتوكول مشفر End-to-End ولا تملك المنصة تسجيل المكالمات.' },
                  { title: '3. عدم مشاركة البيانات',            body: 'نلتزم بعدم بيع أو مشاركة بيانات المستخدمين مع أي أطراف خارجية.' },
                  { title: '4. التحكم في الحساب',              body: 'يحق للمستخدم تعديل أو حذف بياناته في أي وقت عبر إعدادات الملف الشخصي.' },
                ].map(item => (
                  <div key={item.title} className="border-r-2 border-indigo-200 dark:border-indigo-700 pr-4">
                    <h4 className="font-black text-slate-800 dark:text-white text-sm mb-1.5">{item.title}</h4>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ SUPPORT — Inline Chat ══ */}
          {activeTab === 'support' && (
            <div className="space-y-4">
              {/* Header */}
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <HeadphonesIcon size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-white">تواصل مع فريق الدعم</h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Technical Support — {SUPPORT_PHONE}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  اكتب رسالتك وسيردّ عليك فريق الدعم مباشرةً من لوحة التحكم. السبت–الخميس ٩ص–٩م.
                </p>
              </div>

              {/* Chat window */}
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden" style={{ minHeight: '380px', maxHeight: '60vh' }}>
                {/* Messages area */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {chatLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <span className="animate-spin border-2 border-blue-400 border-t-transparent rounded-full w-6 h-6" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                      <MessageCircle size={32} className="text-slate-200 dark:text-slate-600 mb-3" />
                      <p className="text-sm font-black text-slate-400 dark:text-slate-500">ابدأ المحادثة مع فريق الدعم</p>
                      <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">سيردّ عليك في أقرب وقت</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === appUser?.id;
                      const time = new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
                            isMe
                              ? 'bg-blue-600 text-white rounded-tr-sm'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-tl-sm'
                          }`}>
                            {msg.content}
                            <p className={`text-[9px] mt-1 font-bold opacity-70 text-left`}>{time}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input bar */}
                <div className="border-t border-slate-100 dark:border-slate-700 p-4 flex gap-3 items-end">
                  {!appUser ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium text-center w-full">يجب تسجيل الدخول لإرسال رسالة</p>
                  ) : (
                    <>
                      <textarea
                        value={chatMsg}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (val.length > chatMsg.length) {
                            const lastChar = val.slice(-1);
                            if (lastChar === '،' || lastChar === ',') {
                              val = val + ' ';
                            }
                          }
                          setChatMsg(val);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="اكتب رسالتك هنا... (Enter للإرسال)"
                        rows={2}
                        className="flex-1 resize-none bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 focus:border-blue-300 dark:focus:border-blue-700 transition-all placeholder:text-slate-400"
                      />
                      <button
                        onClick={handleSend}
                        disabled={!chatMsg.trim() || sending}
                        className="flex items-center justify-center w-11 h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl transition-all shadow-md shadow-blue-500/20 active:scale-95 shrink-0 self-end"
                      >
                        {sending
                          ? <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
                          : <Send size={18} />
                        }
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Hours note */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800/30 flex items-center gap-3">
                <HeadphonesIcon size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <p className="text-[10px] text-blue-700 dark:text-blue-300 font-bold">ساعات الدعم: السبت — الخميس | ٩ صباحاً — ٩ مساءً (بتوقيت بغداد)</p>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="text-center pt-2 pb-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 space-y-1">
        <p>منصة عمل © 2026 — الإصدار v2.7.0</p>
        <p>جميع الحقوق محفوظة لمنصة التوظيف الذكي</p>
      </div>
    </div>
  );
};
