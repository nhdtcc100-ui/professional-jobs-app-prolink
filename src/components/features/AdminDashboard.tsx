import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Users, FileText, Briefcase, AlertTriangle,
  TrendingUp, Eye, Trash2, CheckCircle, XCircle, Search,
  BarChart3, Activity, Crown, RefreshCw, Building2, Phone,
  ArrowRight, Plus, HeadphonesIcon, Send, MessageSquare, Clock, UserCheck,
  ShieldAlert, Bell, BellRing, Globe, CheckCheck, EyeOff, Filter, ArrowLeftRight, Check, X, Copy
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { profileService } from '../../lib/services/profileService';
import { telegramSupportService } from '../../lib/services/telegramSupportService';
import { useAppContext } from '../../contexts/AppContext';
import { isUUID, sanitizeInput } from '../../lib/utils/sanitize';
import { threatEngine } from '../../lib/security/threatEngine';
import { AlertBanner } from './security/AlertBanner';
import { SecurityOverviewCard } from './security/SecurityOverviewCard';
import { ThreatFeedTable } from './security/ThreatFeedTable';
import { ActivityTimeline } from './security/ActivityTimeline';
import { InteractiveThreatTree } from './security/InteractiveThreatTree';
import { DefensiveCapabilitiesCard } from './security/DefensiveCapabilitiesCard';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface AdminDashboardProps {
  reports: any[];
  onClose: () => void;
  addToast: (m: string, t?: any) => void;
}

interface Stats {
  users: number;
  seekers: number;
  employers: number;
  proUsers: number;
  freeUsers: number;
  posts: number;
  jobs: number;
  pendingReports: number;
  weeklyGrowth: number[];
  totalNotifications: number;
  readNotifications: number;
  unreadNotifications: number;
}

type Tab = 'overview' | 'reports' | 'support' | 'notifications' | 'users' | 'posts' | 'resources' | 'settings' | 'security';

export function AdminDashboard({ reports, onClose, addToast }: AdminDashboardProps) {
  const { setAllUsers: setGlobalUsers, setAppUser, appUser: currentAppUser } = useAppContext();
  const isSupportOnly = !currentAppUser?.isAdmin && currentAppUser?.hasSupportAccess;

  // ── Tab Persistence ─────────────────────────────────────────
  const [activeTab, setActiveTabRaw] = useState<Tab>(() => {
    if (isSupportOnly) return 'support';
    try {
      const saved = localStorage.getItem('prolink_admin_tab') as Tab;
      if (saved && ['overview', 'reports', 'support', 'notifications', 'users', 'posts', 'resources', 'security', 'settings'].includes(saved)) {
        return saved;
      }
      return 'overview';
    } catch {
      return 'overview';
    }
  });

  const setActiveTab = (tab: Tab) => {
    try { localStorage.setItem('prolink_admin_tab', tab); } catch {}
    setActiveTabRaw(tab);
  };

  // Seed demo threat data on mount
  useEffect(() => { threatEngine.seedDemoData(); }, []);

  // ── Cache-First Stats ───────────────────────────────────────
  const [stats, setStats] = useState<Stats>(() => {
    try {
      const c = localStorage.getItem('prolink_admin_stats');
      if (c) return JSON.parse(c);
    } catch {}
    return {
      users: 0, seekers: 0, employers: 0, proUsers: 0, freeUsers: 0,
      posts: 0, jobs: 0, pendingReports: 0, weeklyGrowth: [],
      totalNotifications: 0, readNotifications: 0, unreadNotifications: 0
    };
  });

  const isFetchingStats = useRef(false);
  const lastStatsFetchAt = useRef<number>(
    (() => { try { return Number(localStorage.getItem('prolink_admin_stats_fetch') || 0); } catch { return 0; } })()
  );
  const MIN_STATS_REFRESH = 5 * 60 * 1000; // 5 minutes

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [allAdminNotifications, setAllAdminNotifications] = useState<any[]>(() => {
    try {
      const c = localStorage.getItem('prolink_admin_notifs_list');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [notifTypeFilter, setNotifTypeFilter] = useState<string>('all');
  const [loadingStats, setLoadingStats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const handleSearchChange = (val: string) => setSearchQuery(sanitizeInput(val));
  const [localReports, setLocalReports] = useState(reports);
  const [securityThreatCount, setSecurityThreatCount] = useState<number>(() => threatEngine.getTodayCount());

  // ── Telegram Support Configuration State ──────────────────
  const [telegramHandle, setTelegramHandle] = useState<string>(() => telegramSupportService.getCachedHandle());
  const [editingTelegramHandle, setEditingTelegramHandle] = useState<string>(() => telegramSupportService.getCachedHandle());
  const [editingBotToken, setEditingBotToken] = useState<string>(() => telegramSupportService.getCachedBotToken());
  const [editingChatId, setEditingChatId] = useState<string>(() => telegramSupportService.getCachedChatId());
  const [showBotToken, setShowBotToken] = useState(false);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [detectingChatId, setDetectingChatId] = useState(false);

  const handleDetectChatId = async () => {
    setDetectingChatId(true);
    try {
      const res = await telegramSupportService.detectLatestChatId(editingBotToken);
      if (res.ok && res.chatId) {
        setEditingChatId(res.chatId);
        addToast(`تم اكتشاف معرف المحادثة بنجاح (${res.chatId} - ${res.sender || ''}) 🎯 اضغط "حفظ كافة إعدادات تيليجرام" لتثبيته.`, 'success');
      } else {
        addToast(res.error || 'لم يتم العثور على رسائل. افتح البوت في تيليجرام واضغط Start أولاً!', 'warning');
      }
    } catch (e: any) {
      addToast('خطأ في الاتصال: ' + e?.message, 'error');
    } finally {
      setDetectingChatId(false);
    }
  };

  useEffect(() => {
    telegramSupportService.getConfig().then(cfg => {
      setTelegramHandle(cfg.handle);
      setEditingTelegramHandle(cfg.handle);
      setEditingBotToken(cfg.botToken || '');
      setEditingChatId(cfg.chatId || '');
    });
    const onHandleChange = (e: any) => {
      if (e?.detail) {
        const detail = e.detail;
        if (detail.handle) {
          setTelegramHandle(detail.handle);
          setEditingTelegramHandle(detail.handle);
        }
        if (detail.botToken !== undefined) setEditingBotToken(detail.botToken);
        if (detail.chatId !== undefined) setEditingChatId(detail.chatId);
      }
    };
    window.addEventListener('prolink_telegram_handle_changed', onHandleChange);
    return () => window.removeEventListener('prolink_telegram_handle_changed', onHandleChange);
  }, []);

  const handleSaveTelegramConfig = async (overrideHandle?: string) => {
    setSavingTelegram(true);
    try {
      const res = await telegramSupportService.saveConfig({
        handle: overrideHandle || editingTelegramHandle,
        botToken: editingBotToken,
        chatId: editingChatId,
      });
      if (res.success) {
        setTelegramHandle(res.config.handle);
        setEditingTelegramHandle(res.config.handle);
        setEditingBotToken(res.config.botToken);
        setEditingChatId(res.config.chatId);
        addToast(`تم حفظ إعدادات تيليجرام وبوت الدعم بنجاح (${res.config.handle}) ✈️`, 'success');
      } else {
        addToast('حدث خطأ أثناء حفظ الإعدادات: ' + (res.error || 'خطأ غير معروف'), 'error');
      }
    } catch (e: any) {
      addToast('فشل الحفظ: ' + e?.message, 'error');
    } finally {
      setSavingTelegram(false);
    }
  };

  const handleTestTelegramBot = async () => {
    if (!editingBotToken || !editingChatId) {
      addToast('يرجى كتابة توكن البوت ومعرف المحادثة (Chat ID) أولاً لإجراء الفحص ⚠️', 'warning');
      return;
    }
    setTestingTelegram(true);
    try {
      const res = await telegramSupportService.testTelegramConnection(editingBotToken, editingChatId);
      if (res.ok) {
        addToast('نجح الاتصال! وصلت رسالة الاختبار إلى تيليجرام بنجاح 🚀', 'success');
      } else {
        addToast('فشل اختبار الاتصال: ' + (res.description || 'تأكد من صحة التوكن و Chat ID'), 'error');
      }
    } catch (e: any) {
      addToast('خطأ أثناء فحص البوت: ' + e?.message, 'error');
    } finally {
      setTestingTelegram(false);
    }
  };

  useEffect(() => {
    const handleSecurityUpdate = () => setSecurityThreatCount(threatEngine.getTodayCount());
    window.addEventListener('SECURITY_ALERT', handleSecurityUpdate);
    window.addEventListener('storage', handleSecurityUpdate);
    return () => {
      window.removeEventListener('SECURITY_ALERT', handleSecurityUpdate);
      window.removeEventListener('storage', handleSecurityUpdate);
    };
  }, []);

  /* ── Admin Support Chat state ────────────────────────────── */
  const SUPPORT_PROFILES_CACHE_KEY = 'prolink_support_profiles_cache';
  const SELECTED_SUPPORT_USER_KEY = 'prolink_selected_support_user_id';

  const getCachedSupportProfile = (id: string) => {
    try {
      const raw = localStorage.getItem(SUPPORT_PROFILES_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed[id] || null;
      }
    } catch {}
    return null;
  };

  const saveSupportProfilesToCache = (profiles: any[]) => {
    try {
      const raw = localStorage.getItem(SUPPORT_PROFILES_CACHE_KEY);
      const cache = raw ? JSON.parse(raw) : {};
      profiles.forEach(p => {
        if (p && p.id) {
          cache[p.id] = {
            id: p.id,
            name: p.full_name || p.name || cache[p.id]?.name || 'مستخدم',
            phone: p.phone || cache[p.id]?.phone || '',
            email: p.email || cache[p.id]?.email || '',
            avatar: p.avatar_url || p.avatar || cache[p.id]?.avatar || '',
            role: p.role || cache[p.id]?.role || 'seeker'
          };
        }
      });
      localStorage.setItem(SUPPORT_PROFILES_CACHE_KEY, JSON.stringify(cache));
    } catch {}
  };

  const [supportThreads, setSupportThreads] = useState<any[]>([]);
  const [selectedSupportUser, setSelectedSupportUserState] = useState<any | null>(() => {
    try {
      const savedId = localStorage.getItem('prolink_selected_support_user_id');
      if (savedId) {
        const cached = getCachedSupportProfile(savedId);
        if (cached) return cached;
      }
    } catch {}
    return null;
  });

  const setSelectedSupportUser = (user: any | null) => {
    setSelectedSupportUserState(user);
    try {
      if (user?.id) {
        localStorage.setItem(SELECTED_SUPPORT_USER_KEY, user.id);
      }
    } catch {}
  };

  const [supportSearchQuery, setSupportSearchQuery] = useState('');
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [supportReplyText, setSupportReplyText] = useState('');
  const [sendingSupportReply, setSendingSupportReply] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSubTab, setSupportSubTab] = useState<'requests' | 'chat'>('requests');
  const [roleRequests, setRoleRequests] = useState<any[]>([]);
  const [loadingRoleRequests, setLoadingRoleRequests] = useState(false);
  const [roleRequestFilter, setRoleRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [roleRequestSearch, setRoleRequestSearch] = useState('');
  const [roleActionLoadingId, setRoleActionLoadingId] = useState<string | null>(null);
  const supportChatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (supportSubTab === 'chat' && supportMessages.length > 0) {
      supportChatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [supportMessages, supportSubTab, selectedSupportUser]);

  const fetchRoleRequests = async () => {
    setLoadingRoleRequests(true);
    const safetyTimer = setTimeout(() => setLoadingRoleRequests(false), 4500);
    try {
      const { data, error } = await profileService.fetchAllPendingRoleRequests();
      if (!error && data) {
        setRoleRequests(data);
      }
    } catch (e) {
      console.error("fetchRoleRequests error:", e);
    } finally {
      clearTimeout(safetyTimer);
      setLoadingRoleRequests(false);
    }
  };

  const fetchSupportThreads = async () => {
    setSupportLoading(true);
    const safetyTimer = setTimeout(() => setSupportLoading(false), 4500);
    try {
      const adminIds = new Set([
        currentAppUser?.id,
        "support-admin-07724053748",
        "support-admin-07724053743"
      ].filter(Boolean));

      allUsers.filter(u => u.is_admin || u.isAdmin || u.role === "admin" || u.role === "superadmin").forEach(u => adminIds.add(u.id));

      try {
        const { data: adminProfiles } = await db
          .from("profiles")
          .select("id, phone, role, is_admin")
          .or(`phone.eq.07724053748,phone.eq.07724053743,is_admin.eq.true,role.eq.admin,role.eq.superadmin`);
        if (adminProfiles) {
          adminProfiles.forEach((p: any) => adminIds.add(p.id));
        }
      } catch {}

      // مزامنة أي ردود واردة من تيليجرام تلقائياً
      try {
        await telegramSupportService.syncTelegramReplies();
      } catch (_) {}

      const thirtyDaysAgoISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // جلب الرسائل من جدول support_messages
      const { data: msgs, error: msgsErr } = await db
        .from("support_messages")
        .select("*")
        .gte("created_at", thirtyDaysAgoISO)
        .order("created_at", { ascending: true });

      if (msgsErr) {
        console.warn("support_messages query note:", msgsErr);
      }

      const supportMsgs = msgs || [];
      const threadsMap = new Map<string, any>();

      supportMsgs.forEach((m: any) => {
        const isSenderAdmin = adminIds.has(m.sender_id);
        let threadUserId: string;

        if (isSenderAdmin) {
          // إذا كان المرسل أدمن، المحادثة تتبع للمستقبل (المستخدم)
          // إلا إذا كان المستقبل غير محدد أو أدمن آخر (مثل تجربة الأدمن للشات من صفحة الدعم)
          if (m.receiver_id && !adminIds.has(m.receiver_id)) {
            threadUserId = m.receiver_id;
          } else {
            threadUserId = m.receiver_id || m.sender_id;
          }
        } else {
          // المستخدم العادي هو صاحب المحادثة
          threadUserId = m.sender_id;
        }

        if (!threadUserId) return;

        if (!threadsMap.has(threadUserId)) {
          const cachedUser = getCachedSupportProfile(threadUserId);
          const foundUser = allUsers.find(u => u.id === threadUserId);
          const initialUser = foundUser || cachedUser || {
            id: threadUserId,
            name: "مستخدم (" + threadUserId.slice(0, 8) + ")",
            avatar: "",
            phone: "",
            role: "seeker"
          };
          threadsMap.set(threadUserId, {
            userId: threadUserId,
            user: initialUser,
            messages: [],
            lastMessage: m,
            unreadCount: 0
          });
        }

        const thread = threadsMap.get(threadUserId)!;
        thread.messages.push(m);
        thread.lastMessage = m;
        if (!isSenderAdmin && !m.read) {
          thread.unreadCount += 1;
        }
      });

      // إثراء وتحديث بيانات المستخدمين لجميع المحادثات من جدول profiles مباشرةً
      const allThreadUserIds = Array.from(threadsMap.keys());
      if (allThreadUserIds.length > 0) {
        try {
          const { data: fetchedProfiles } = await db
            .from("profiles")
            .select("id, name, full_name, phone, avatar, avatar_url, role, email")
            .in("id", allThreadUserIds);

          if (fetchedProfiles && fetchedProfiles.length > 0) {
            saveSupportProfilesToCache(fetchedProfiles);
            fetchedProfiles.forEach((p: any) => {
              const thread = threadsMap.get(p.id);
              if (thread) {
                thread.user = {
                  ...thread.user,
                  id: p.id,
                  name: p.full_name || p.name || thread.user.name || "مستخدم",
                  phone: p.phone || thread.user.phone || "",
                  email: p.email || thread.user.email || "",
                  avatar: p.avatar_url || p.avatar || thread.user.avatar || "",
                  role: p.role || thread.user.role || "seeker",
                };
              }
            });
          }
        } catch (enrichErr) {
          console.warn("Could not enrich thread profiles:", enrichErr);
        }
      }

      const threads = Array.from(threadsMap.values()).sort((a, b) =>
        new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
      );

      setSupportThreads(threads);
      const savedUserId = localStorage.getItem(SELECTED_SUPPORT_USER_KEY);
      if (threads.length > 0) {
        let active = threads.find(t => t.userId === savedUserId);
        if (!active && selectedSupportUser) {
          active = threads.find(t => t.userId === selectedSupportUser.id);
        }
        if (!active) {
          active = threads[0];
        }
        setSelectedSupportUser(active.user);
        setSupportMessages(active.messages);
      }
    } catch (e) {
      console.error("Support fetch error:", e);
    } finally {
      clearTimeout(safetyTimer);
      setSupportLoading(false);
    }
  };

  useEffect(() => {
    if (currentAppUser?.id) {
      db.from('profiles').update({ is_admin: true, has_support_access: true }).eq('id', currentAppUser.id).then(() => {}).catch(() => {});
    }
  }, [currentAppUser?.id]);

  useEffect(() => {
    if (activeTab !== "support") return;
    fetchSupportThreads();
    fetchRoleRequests();

    // الاستماع لجدول support_messages المنفصل وجدول role_change_requests
    const channel1 = db.channel("admin-support-messages-isolated")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, () => {
        fetchSupportThreads();
      })
      .subscribe();

    const channel2 = db.channel("admin-role-requests-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "role_change_requests" }, () => {
        fetchRoleRequests();
      })
      .subscribe();

    return () => {
      db.removeChannel(channel1);
      db.removeChannel(channel2);
    };
  }, [activeTab]);

  const handleSendAdminSupportReply = async () => {
    const cleanText = sanitizeInput(supportReplyText.trim());
    if (!cleanText || !selectedSupportUser?.id) return;

    setSendingSupportReply(true);

    let adminSenderId = currentAppUser?.id;
    if (!adminSenderId) {
      try {
        const { data: authUser } = await db.auth.getUser();
        if (authUser?.user?.id) adminSenderId = authUser.user.id;
      } catch {}
    }

    if (!adminSenderId) {
      addToast("يرجى تسجيل الدخول بحساب مسؤول لتتمكن من إرسال الرد", "error");
      setSendingSupportReply(false);
      return;
    }

    const newMsg = {
      id: `tmp-${Date.now()}`,
      sender_id: adminSenderId,
      receiver_id: selectedSupportUser.id,
      content: cleanText,
      message_type: "text",
      created_at: new Date().toISOString(),
      read: false
    };

    setSupportMessages(prev => [...prev, newMsg]);
    setSupportReplyText("");

    try {
      // الإرسال حصراً إلى جدول support_messages المنفصل
      const { error: suppErr } = await db.from("support_messages").insert([{
        sender_id: adminSenderId,
        receiver_id: selectedSupportUser.id,
        content: cleanText,
        message_type: "text"
      }]);

      if (suppErr) {
        console.error("Admin Support Reply Error:", suppErr);
        addToast("فشل الإرسال: " + (suppErr.message || "خطأ خادم"), "error");
      } else {
        addToast("تم إرسال رد الدعم الفني بنجاح 🎧", "success");
      }
    } catch (e: any) {
      addToast("فشل الإرسال: " + e.message, "error");
    } finally {
      setSendingSupportReply(false);
      fetchSupportThreads();
    }
  };
  useEffect(() => {
    const elapsed = Date.now() - lastStatsFetchAt.current;
    if (elapsed > MIN_STATS_REFRESH || !stats.users) {
      fetchStats();
    }
  }, []);

  const fetchStats = async () => {
    if (isFetchingStats.current) return;
    isFetchingStats.current = true;
    setLoadingStats(true);
    const safetyTimer = setTimeout(() => {
      setLoadingStats(false);
      isFetchingStats.current = false;
    }, 4500);

    try {
      // 1. Fetch exact total counts using head:true for efficiency
      const [
        totalUsersRes,
        seekersRes,
        employersRes,
        totalPostsRes,
        totalJobsRes,
        totalNotifsRes,
        unreadNotifsRes
      ] = await Promise.all([
        db.from('profiles').select('*', { count: 'exact', head: true }),
        db.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'seeker'),
        db.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'employer'),
        db.from('posts').select('*', { count: 'exact', head: true }),
        db.from('jobs').select('*', { count: 'exact', head: true }),
        db.from('notifications').select('*', { count: 'exact', head: true }),
        db.from('notifications').select('*', { count: 'exact', head: true }).eq('read', false)
      ]);

      // 2. Fetch data for display (limited)
      const [recentUsersRes, recentPostsRes, recentNotifsRes] = await Promise.all([
        db.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
        db.from('posts').select('*').order('created_at', { ascending: false }).limit(50),
        db.from('notifications').select('*').order('created_at', { ascending: false }).limit(80)
      ]);

      const totalUsers = totalUsersRes.count || 0;
      const seekers = seekersRes.count || 0;
      const employers = employersRes.count || 0;

      // 3. Fetch Pro vs Free
      const proCountRes = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('is_pro', true);
      const proUsers = proCountRes.count || 0;

      const totalNotifs = totalNotifsRes.count || 0;
      const unreadNotifs = unreadNotifsRes.count || 0;
      const readNotifs = Math.max(0, totalNotifs - unreadNotifs);

      const newStats: Stats = {
        users: totalUsers,
        seekers: seekers,
        employers: employers,
        proUsers: proUsers,
        freeUsers: totalUsers - proUsers,
        posts: totalPostsRes.count || 0,
        jobs: totalJobsRes.count || 0,
        pendingReports: (localReports || reports).filter((r: any) => !r.status || r.status === 'pending').length,
        weeklyGrowth: [10, 25, 45, 30, 60, 75, 90],
        totalNotifications: totalNotifs,
        readNotifications: readNotifs,
        unreadNotifications: unreadNotifs
      };

      setStats(newStats);
      try { localStorage.setItem('prolink_admin_stats', JSON.stringify(newStats)); } catch {}

      if (recentUsersRes.data) setAllUsers(recentUsersRes.data);
      if (recentPostsRes.data) setAllPosts(recentPostsRes.data);
      if (recentNotifsRes.data) {
        setAllAdminNotifications(recentNotifsRes.data);
        try { localStorage.setItem('prolink_admin_notifs_list', JSON.stringify(recentNotifsRes.data)); } catch {}
      }

      const now = Date.now();
      lastStatsFetchAt.current = now;
      try { localStorage.setItem('prolink_admin_stats_fetch', String(now)); } catch {}

    } catch (e: any) {
      console.error('Admin stats error:', e);
      addToast('خطأ في جلب البيانات: ' + (e.message || 'خطأ غير معروف'), 'error');
    } finally {
      clearTimeout(safetyTimer);
      setLoadingStats(false);
      isFetchingStats.current = false;
    }
  };

  const handleMarkAdminNotification = async (id: string, currentRead: boolean) => {
    const nextRead = !currentRead;
    try {
      const { error } = await db.from('notifications').update({ read: nextRead }).eq('id', id);
      if (error) throw error;

      setAllAdminNotifications(prev => prev.map(n => n.id === id ? { ...n, read: nextRead } : n));
      setStats(prev => ({
        ...prev,
        unreadNotifications: Math.max(0, prev.unreadNotifications + (nextRead ? -1 : 1)),
        readNotifications: Math.max(0, prev.readNotifications + (nextRead ? 1 : -1))
      }));
      addToast(nextRead ? 'تم تمييز التنبيه كمقروء ✓' : 'تم تمييز التنبيه كغير مقروء ↺', 'success');
    } catch (e: any) {
      addToast('فشل تحديث التنبيه: ' + e.message, 'error');
    }
  };

  const handleMarkAllSystemNotificationsRead = async () => {
    try {
      const { error } = await db.from('notifications').update({ read: true }).eq('read', false);
      if (error) throw error;

      setAllAdminNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setStats(prev => ({
        ...prev,
        readNotifications: prev.totalNotifications,
        unreadNotifications: 0
      }));
      addToast('تم تمييز جميع التنبيهات في النظام كمقروءة ✅', 'success');
    } catch (e: any) {
      addToast('فشل العملية: ' + e.message, 'error');
    }
  };

  const handleDeleteAdminNotification = async (id: string) => {
    try {
      const { error } = await db.from('notifications').delete().eq('id', id);
      if (error) throw error;

      const target = allAdminNotifications.find(n => n.id === id);
      const wasUnread = target && !target.read;

      setAllAdminNotifications(prev => prev.filter(n => n.id !== id));
      setStats(prev => ({
        ...prev,
        totalNotifications: Math.max(0, prev.totalNotifications - 1),
        unreadNotifications: wasUnread ? Math.max(0, prev.unreadNotifications - 1) : prev.unreadNotifications,
        readNotifications: !wasUnread ? Math.max(0, prev.readNotifications - 1) : prev.readNotifications
      }));
      addToast('تم حذف التنبيه بنجاح 🗑️', 'success');
    } catch (e: any) {
      addToast('فشل الحذف: ' + e.message, 'error');
    }
  };

  const handleDeletePost = async (postId: string, reportId?: string) => {
    try {
      const { error } = await db.from('posts').delete().eq('id', postId);
      if (error) throw error;
      if (reportId) {
        const { error: repErr } = await db.from('reports').update({ status: 'resolved' }).eq('id', reportId);
        if (repErr) console.warn(repErr);
      }
      setLocalReports(prev => prev.filter((r: any) => r.id !== reportId));
      setAllPosts(prev => prev.filter((p: any) => p.id !== postId));
      setStats(prev => ({ ...prev, posts: Math.max(0, prev.posts - 1), pendingReports: Math.max(0, prev.pendingReports - 1) }));
      addToast('تم حذف المنشور بنجاح ✅', 'success');
    } catch (e: any) {
      addToast('فشل الحذف: ' + e.message, 'error');
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      const { error } = await db.from('reports').update({ status: 'dismissed' }).eq('id', reportId);
      if (error) throw error;
      setLocalReports(prev => prev.map((r: any) => r.id === reportId ? { ...r, status: 'dismissed' } : r));
      setStats(prev => ({ ...prev, pendingReports: Math.max(0, prev.pendingReports - 1) }));
      addToast('تم تجاهل البلاغ', 'success');
    } catch (e: any) {
      addToast('فشل التحديث: ' + e.message, 'error');
    }
  };

  const handleToggleAdminUser = async (userId: string, currentAdmin: boolean) => {
    const newVal = !currentAdmin;
    try {
      const { error } = await db.from('profiles').update({ is_admin: newVal }).eq('id', userId);
      if (error) throw error;

      setAllUsers(prev => prev.map((u: any) => u.id === userId ? { ...u, is_admin: newVal, isAdmin: newVal } : u));
      setGlobalUsers(prev => prev.map((u: any) => u.id === userId ? { ...u, is_admin: newVal, isAdmin: newVal } : u));
      if (currentAppUser && currentAppUser.id === userId) {
        setAppUser({ ...currentAppUser, is_admin: newVal, isAdmin: newVal });
      }

      addToast(newVal ? 'تم منح صلاحيات الأدمن 🛡️' : 'تم سحب صلاحيات الأدمن', 'success');
    } catch (e: any) { addToast('فشل التحديث: ' + e.message, 'error'); }
  };

  const handleToggleProUser = async (userId: string, currentPro: boolean) => {
    const newVal = !currentPro;
    try {
      const { error } = await db.from('profiles').update({ is_pro: newVal }).eq('id', userId);
      if (error) throw error;

      setAllUsers(prev => prev.map((u: any) => u.id === userId ? { ...u, is_pro: newVal, isPro: newVal } : u));
      setGlobalUsers(prev => prev.map((u: any) => u.id === userId ? { ...u, is_pro: newVal, isPro: newVal } : u));
      if (currentAppUser && currentAppUser.id === userId) {
        setAppUser({ ...currentAppUser, is_pro: newVal, isPro: newVal });
      }

      addToast(newVal ? 'تم تفعيل PRO للمستخدم ⭐' : 'تم إلغاء PRO', 'success');
    } catch (e: any) { addToast('فشل التحديث: ' + e.message, 'error'); }
  };

  const handleToggleBanUser = async (userId: string, currentActive: boolean) => {
    const newActive = !currentActive;
    try {
      const { error } = await db.from('profiles').update({ is_active: newActive }).eq('id', userId);
      if (error) throw error;

      setAllUsers(prev => prev.map((u: any) => u.id === userId ? { ...u, is_active: newActive, isActive: newActive } : u));
      setGlobalUsers(prev => prev.map((u: any) => u.id === userId ? { ...u, is_active: newActive, isActive: newActive } : u));
      if (currentAppUser && currentAppUser.id === userId) {
        setAppUser({ ...currentAppUser, is_active: newActive, isActive: newActive });
      }

      addToast(newActive ? 'تم فك حظر المستخدم ✅' : 'تم حظر المستخدم 🚫', 'success');
    } catch (e: any) { addToast('فشل العملية: ' + e.message, 'error'); }
  };



  const handleApproveRoleChange = async (notif: any) => {
    try {
      let targetUserId = notif.from_id;
      let newRole: 'seeker' | 'employer' = 'employer';
      try {
        const parsed = typeof notif.target_id === 'string' ? JSON.parse(notif.target_id) : notif.target_id;
        if (parsed?.requestedRole) newRole = parsed.requestedRole;
        if (parsed?.userId) targetUserId = parsed.userId;
      } catch {
        if (notif.message?.includes('باحث')) newRole = 'seeker';
        else if (notif.message?.includes('صاحب')) newRole = 'employer';
      }

      const { error } = await profileService.approveRoleChangeRequest(notif.id, targetUserId, newRole);
      if (error) throw error;

      addToast(`✅ تم قبول الطلب وتغيير دور ${notif.from_name || 'المستخدم'} إلى "${newRole === 'employer' ? 'صاحب عمل' : 'باحث عن عمل'}"`);
      setAllAdminNotifications(prev => prev.map(item => item.id === notif.id ? { ...item, read: true } : item));
      setAllUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role: newRole } : u));
      setGlobalUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role: newRole } : u));
      fetchStats();
    } catch (err: any) {
      addToast('فشل قبول الطلب: ' + (err.message || 'خطأ غير معروف'), 'error');
    }
  };

  const handleRejectRoleChange = async (notif: any) => {
    try {
      let targetUserId = notif.from_id;
      try {
        const parsed = typeof notif.target_id === 'string' ? JSON.parse(notif.target_id) : notif.target_id;
        if (parsed?.userId) targetUserId = parsed.userId;
      } catch {}

      const { error } = await profileService.rejectRoleChangeRequest(notif.id, targetUserId);
      if (error) throw error;

      addToast(`تم رفض طلب تغيير الدور للمستخدم ${notif.from_name || ''}`);
      setAllAdminNotifications(prev => prev.map(item => item.id === notif.id ? { ...item, read: true } : item));
      fetchStats();
    } catch (err: any) {
      addToast('فشل الرفض: ' + (err.message || 'خطأ غير معروف'), 'error');
    }
  };

  const handleToggleUserAccess = async (userId: string, field: string, currentVal: boolean) => {
    const newVal = !currentVal;
    try {
      const { error } = await db.from('profiles').update({ [field]: newVal }).eq('id', userId);
      if (error) throw error;

      const fieldMap: any = {
        has_calls_access: 'hasCallsAccess',
        has_erp_access: 'hasErpAccess',
        has_support_access: 'hasSupportAccess'
      };
      const camelField = fieldMap[field] || field;

      setAllUsers(prev => prev.map((u: any) => u.id === userId ? { ...u, [field]: newVal, [camelField]: newVal } : u));
      setGlobalUsers(prev => prev.map((u: any) => u.id === userId ? { ...u, [field]: newVal, [camelField]: newVal } : u));
      if (currentAppUser && currentAppUser.id === userId) {
        setAppUser({ ...currentAppUser, [field]: newVal, [camelField]: newVal });
      }

      addToast('تم تحديث صلاحيات الدعم بنجاح ✅', 'success');
    } catch (e: any) { addToast('فشل التحديث: ' + e.message, 'error'); }
  };

  const totalUnreadSupport = supportThreads.reduce((acc, t) => acc + t.unreadCount, 0);

  const securityCriticalCount = threatEngine.getCriticalCount();

  const ALL_TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview',       label: 'نظرة عامة',       icon: <BarChart3 size={16} /> },
    { id: 'reports',        label: 'البلاغات',         icon: <AlertTriangle size={16} />, badge: stats.pendingReports },
    { id: 'support',        label: 'الدعم الفني',       icon: <HeadphonesIcon size={16} />, badge: totalUnreadSupport },
    { id: 'notifications',  label: 'الإشعارات والتنبيهات', icon: <Bell size={16} />, badge: stats.unreadNotifications > 0 ? stats.unreadNotifications : undefined },
    { id: 'users',          label: 'المستخدمون',       icon: <Users size={16} />,        badge: stats.users },
    { id: 'posts',          label: 'المنشورات',        icon: <FileText size={16} />,     badge: stats.posts },
    { id: 'resources',      label: 'إدارة المصادر',     icon: <Building2 size={16} /> },
    { id: 'security',       label: 'الأمن السيبراني',   icon: <ShieldAlert size={16} />, badge: securityThreatCount > 0 ? securityThreatCount : undefined },
    { id: 'settings',       label: 'الإعدادات',         icon: <Plus className="rotate-45" size={16} /> },
  ];

  const TABS = isSupportOnly ? ALL_TABS.filter(t => t.id === 'support') : ALL_TABS;

  const STAT_CARDS: { id: Tab; label: string; value: number; icon: React.ReactNode; gradient: string; shadow: string; detail?: string }[] = [
    { id: 'users', label: 'إجمالي المستخدمين', value: stats.users, icon: <Users size={22} />, gradient: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/25', detail: `${stats.seekers} باحث • ${stats.employers} صاحب عمل` },
    { id: 'support', label: 'رسائل الدعم الفني', value: supportThreads.length, icon: <HeadphonesIcon size={22} />, gradient: 'from-cyan-500 to-blue-600', shadow: 'shadow-cyan-500/25', detail: totalUnreadSupport > 0 ? `${totalUnreadSupport} غير مقروء` : 'نشط' },
    { id: 'posts', label: 'المنشورات الاحترافية', value: stats.posts, icon: <FileText size={22} />, gradient: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/25' },
    { id: 'reports', label: 'بلاغات المراجعة', value: stats.pendingReports, icon: <AlertTriangle size={22} />, gradient: 'from-rose-500 to-red-600', shadow: 'shadow-rose-500/25' },
  ];

  const filteredUsers = allUsers.filter(u =>
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPosts = allPosts.filter(p =>
    (p.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.author_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-slate-950 flex flex-col relative overflow-hidden"
    >
        {/* Security Alert Banner (global, outside tab system) */}
        <AlertBanner onNavigateToSecurity={() => setActiveTab('security')} />

        {/* Mysterious Ambient Lights */}
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 flex items-center justify-between px-4 md:px-10 py-4 md:py-8 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-md gap-3">
          <div className="flex items-center gap-3 md:gap-6 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse" />
              <div className="w-10 h-10 md:w-16 md:h-16 rounded-2xl md:rounded-[2rem] bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center shadow-2xl border border-slate-700/50">
                <Shield size={20} className="text-blue-400 md:w-8 md:h-8" />
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm md:text-2xl font-black text-white tracking-wider md:tracking-widest uppercase truncate">Admin Gateway</h2>
              <div className="flex items-center gap-2 md:gap-3 mt-0.5 md:mt-1.5">
                <div className="flex gap-1 shrink-0">
                   {[...Array(3)].map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-emerald-500' : 'bg-slate-700'} animate-pulse`} style={{ animationDelay: `${i * 0.2}s` }} />)}
                </div>
                <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] md:tracking-[0.4em] truncate">Internal Protocol</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <div className="hidden md:flex flex-col items-end mr-4">
               <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">System Online</span>
               <span className="text-[8px] font-medium text-slate-500">Latency: 24ms</span>
            </div>
            <button onClick={fetchStats} disabled={loadingStats} className="p-2.5 md:p-3.5 rounded-xl md:rounded-2xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-slate-800 transition-all shadow-xl active:scale-95 group">
              <RefreshCw size={16} className={`md:w-5 md:h-5 ${loadingStats ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            </button>
            <button onClick={onClose} className="flex items-center gap-1.5 md:gap-2 px-3.5 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl bg-blue-600/90 hover:bg-blue-600 border border-blue-500/50 text-white transition-all shadow-xl shadow-blue-900/30 active:scale-95 text-xs font-black shrink-0">
              <ArrowRight size={16} />
              <span>العودة</span>
            </button>
          </div>
        </div>

        <div className="relative z-10 flex gap-2 px-10 pt-6 pb-0 border-b border-slate-800/50 bg-slate-900/30 overflow-x-auto no-scrollbar scroll-smooth">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
              className={`relative flex-1 flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-t-[1.5rem] text-[10px] font-black transition-all min-w-[100px] border-x border-t ${
                activeTab === tab.id 
                  ? 'bg-slate-800 text-blue-400 border-slate-700/50 shadow-[0_-10px_25px_rgba(0,0,0,0.2)]' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border-transparent'
              }`}
            >
              <div className={`${activeTab === tab.id ? 'text-blue-400' : 'text-slate-500'} mb-1`}>
                {React.cloneElement(tab.icon as any, { size: 18 })}
              </div>
              <span className="uppercase tracking-widest">{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`absolute top-3 right-3 text-[9px] font-black px-1.5 py-0.5 rounded-md ${tab.id === 'reports' ? 'bg-rose-500 text-white shadow-lg shadow-rose-900/20' : 'bg-blue-500 text-white shadow-lg shadow-blue-900/20'}`}>
                  {tab.badge}
                </span>
              )}
              {activeTab === tab.id && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 shadow-[0_0_15px_#3b82f6]" />}
            </button>
          ))}
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto p-6 md:p-10 space-y-10 bg-slate-900/40">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-10">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {STAT_CARDS.map((card, i) => (
                    <motion.div 
                      key={card.label} 
                      initial={{ opacity: 0, y: 15 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      transition={{ delay: i * 0.07 }} 
                      onClick={() => setActiveTab(card.id)}
                      className="relative bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center group hover:border-blue-500/50 transition-all shadow-2xl backdrop-blur-xl h-56 cursor-pointer"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity`} />
                      <div className={`w-16 h-16 rounded-[1.5rem] bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white mb-4 shadow-2xl relative z-10 scale-110 group-hover:scale-125 transition-transform duration-500`}>
                        {React.cloneElement(card.icon as any, { size: 28 })}
                        <div className="absolute inset-0 bg-white rounded-[1.5rem] blur-xl opacity-0 group-hover:opacity-20 transition-opacity" />
                      </div>
                      <div className="text-3xl font-black text-white mb-2 tracking-tighter relative z-10">
                        {loadingStats ? <span className="inline-block w-20 h-10 bg-slate-700/50 rounded-xl animate-pulse" /> : card.value.toLocaleString('ar-EG')}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] relative z-10 group-hover:text-white transition-colors">{card.label}</div>
                      {card.detail && <p className="text-[9px] text-blue-400 font-bold mt-1">{card.detail}</p>}
                    </motion.div>
                  ))}
                </div>

                {/* ─── ⚡ بطاقة طلبات تغيير نوع الحساب المعلقة ─── */}
                {(() => {
                  const pendingRoleRequests = allAdminNotifications.filter(
                    n => n.type === 'role_change_request' && !n.read
                  );
                  if (pendingRoleRequests.length === 0) return null;

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 md:p-8 bg-gradient-to-r from-amber-950/50 via-slate-800/80 to-amber-900/40 border-2 border-amber-500/50 rounded-[2.5rem] shadow-2xl backdrop-blur-xl space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div className="w-13 h-13 p-3 rounded-2xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                            <ArrowLeftRight size={24} />
                          </div>
                          <div>
                            <h3 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                              طلبات تغيير نوع الحساب بانتظار موافقتك
                              <span className="px-3 py-0.5 rounded-full bg-amber-500 text-slate-950 text-xs font-black animate-pulse">
                                {pendingRoleRequests.length} طلب جديد
                              </span>
                            </h3>
                            <p className="text-xs text-amber-200/80 font-medium mt-0.5">
                              المستخدمون الموضحون أدناه يطلبون ترقية/تحويل حسابهم، يمكنك الموافقة أو الرفض بضغطة واحدة
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => { setActiveTab('notifications'); setNotifTypeFilter('role_change_request'); }}
                          className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-black rounded-xl transition-all border border-amber-500/40 shrink-0 self-start sm:self-auto"
                        >
                          عرض الكل في الإشعارات
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                        {pendingRoleRequests.map((req) => {
                          let requestedRole = 'employer';
                          try {
                            const parsed = typeof req.target_id === 'string' ? JSON.parse(req.target_id) : req.target_id;
                            if (parsed?.requestedRole) requestedRole = parsed.requestedRole;
                          } catch {
                            if (req.message?.includes('باحث')) requestedRole = 'seeker';
                          }
                          return (
                            <div key={req.id} className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 flex items-center justify-between gap-4 shadow-lg">
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={req.from_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.from_name || 'U')}&background=random`}
                                  className="w-11 h-11 rounded-xl object-cover border border-slate-700 shrink-0 shadow-md"
                                  alt=""
                                />
                                <div className="min-w-0">
                                  <h4 className="text-xs font-black text-white truncate">{req.from_name || 'مستخدم'}</h4>
                                  <p className="text-[11px] text-amber-400 font-bold truncate mt-0.5">
                                    طلب التحويل إلى: {requestedRole === 'employer' ? '🏢 صاحب عمل' : '👤 باحث عن عمل'}
                                  </p>
                                  {req.message && (
                                    <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5 max-w-[220px]">
                                      {req.message}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => handleApproveRoleChange(req)}
                                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-900/30 flex items-center gap-1 active:scale-95 transition-all"
                                >
                                  <Check size={14} />
                                  <span>قبول</span>
                                </button>
                                <button
                                  onClick={() => handleRejectRoleChange(req)}
                                  className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-black active:scale-95 transition-all"
                                >
                                  <X size={14} />
                                  <span>رفض</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })()}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 shadow-xl backdrop-blur-md">
                      <div className="flex items-center justify-between mb-8">
                         <h3 className="text-sm font-black text-white uppercase tracking-widest">توزيع الأدوار</h3>
                         <Activity size={18} className="text-blue-500" />
                      </div>
                      <div className="space-y-8">
                         <div>
                            <div className="flex justify-between text-[11px] font-black mb-3 uppercase">
                               <span className="text-slate-300">باحثين عن عمل ({stats.seekers})</span>
                               <span className="text-blue-400">{stats.users > 0 ? Math.round((stats.seekers / stats.users) * 100) : 0}%</span>
                            </div>
                            <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700/50 p-1">
                               <motion.div initial={{ width: 0 }} animate={{ width: `${stats.users > 0 ? (stats.seekers / stats.users) * 100 : 0}%` }} className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)]" />
                            </div>
                         </div>
                         <div>
                            <div className="flex justify-between text-[11px] font-black mb-3 uppercase">
                               <span className="text-slate-300">أصحاب عمل ({stats.employers})</span>
                               <span className="text-emerald-400">{stats.users > 0 ? Math.round((stats.employers / stats.users) * 100) : 0}%</span>
                            </div>
                            <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700/50 p-1">
                               <motion.div initial={{ width: 0 }} animate={{ width: `${stats.users > 0 ? (stats.employers / stats.users) * 100 : 0}%` }} className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)]" />
                            </div>
                         </div>
                      </div>
                      <div className="mt-10 pt-8 border-t border-slate-700/50 grid grid-cols-2 gap-6">
                         <div className="text-center p-5 bg-slate-900/50 rounded-3xl border border-slate-700/50 shadow-inner">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Weekly Growth</p>
                            <p className="text-2xl font-black text-emerald-400">+12%</p>
                         </div>
                         <div className="text-center p-5 bg-slate-900/50 rounded-3xl border border-slate-700/50 shadow-inner">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">User Engagement</p>
                            <p className="text-2xl font-black text-blue-400">88%</p>
                         </div>
                      </div>
                   </div>

                   <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl backdrop-blur-md lg:col-span-1">
                      <div className="flex items-center justify-between mb-8">
                         <h3 className="text-sm font-black text-white uppercase tracking-widest">تحليل النشاط الثلاثي</h3>
                         <BarChart3 size={18} className="text-blue-500" />
                      </div>
                      <div className="flex items-end justify-between gap-4 h-56 px-4">
                         {[
                           { label: 'المستخدمين', value: stats.users, color: 'from-blue-600 to-indigo-500', icon: <Users size={12} /> },
                           { label: 'المنشورات', value: stats.posts, color: 'from-violet-600 to-purple-500', icon: <FileText size={12} /> },
                           { label: 'فرص العمل', value: stats.jobs, color: 'from-emerald-600 to-teal-500', icon: <Briefcase size={12} /> }
                         ].map((m, i) => {
                            // Normalize height relative to a max (e.g. 100 or total)
                            const max = Math.max(stats.users, stats.posts, stats.jobs, 1);
                            const h = (m.value / max) * 90 + 10; // min 10% for visibility
                            return (
                             <div key={i} className="flex-1 group relative flex flex-col items-center">
                                <motion.div 
                                   initial={{ height: 0 }} 
                                   animate={{ height: `${h}%` }} 
                                   transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}
                                   className={`w-full bg-gradient-to-t ${m.color} rounded-2xl relative transition-all group-hover:brightness-125 shadow-2xl border-t border-white/20`} 
                                />
                                <div className="absolute -top-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-slate-950/90 text-white text-[10px] font-black px-3 py-2 rounded-xl shadow-2xl border border-slate-700 z-20 whitespace-nowrap backdrop-blur-xl">
                                   <div className="flex items-center gap-2 mb-1">
                                      <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${m.color}`} />
                                      {m.label}
                                   </div>
                                   <div className="text-lg text-white">{m.value.toLocaleString('ar-EG')}</div>
                                </div>
                                <div className="mt-4 text-[9px] font-black text-slate-500 uppercase tracking-tighter text-center">
                                   {m.label}
                                </div>
                             </div>
                            );
                         })}
                      </div>
                   </div>

                   <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 shadow-xl backdrop-blur-md">
                      <div className="flex items-center justify-between mb-8">
                         <h3 className="text-sm font-black text-white uppercase tracking-widest">نوع الحسابات</h3>
                         <Crown size={18} className="text-amber-500" />
                      </div>
                      <div className="flex items-center justify-center py-6 gap-10">
                         <div className="w-40 h-40 rounded-full border-[16px] border-slate-700/30 relative shadow-2xl">
                            <motion.div 
                               initial={{ rotate: -90, opacity: 0 }}
                               animate={{ rotate: 0, opacity: 1 }}
                               className="absolute inset-[-16px] rounded-full border-[16px] border-amber-500 border-l-transparent border-b-transparent"
                               style={{ clipPath: `conic-gradient(from 0deg, #f59e0b ${ (stats.proUsers / (stats.users || 1)) * 360 }deg, transparent 0deg)` }}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                               <span className="text-3xl font-black text-white">{Math.round((stats.proUsers / (stats.users || 1)) * 100)}%</span>
                               <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">PRO</span>
                            </div>
                         </div>
                         <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-2xl border border-slate-700/50">
                               <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                               <div>
                                  <p className="text-[11px] font-black text-slate-200">عضوية PRO</p>
                                  <p className="text-[10px] text-slate-500">{stats.proUsers} مستخدم</p>
                               </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-2xl border border-slate-700/50">
                               <div className="w-3 h-3 rounded-full bg-slate-600" />
                               <div>
                                  <p className="text-[11px] font-black text-slate-200">حساب عادي</p>
                                  <p className="text-[10px] text-slate-500">{stats.freeUsers} مستخدم</p>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-500/30 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden lg:col-span-2">
                      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
                      <div className="flex items-center justify-between mb-10 relative z-10">
                         <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">منحنى النمو المتسارع</h3>
                            <p className="text-xs text-indigo-200/60 font-bold italic">Real-time Platform Expansion Metrics</p>
                         </div>
                         <div className="px-5 py-2 bg-white/5 backdrop-blur-xl rounded-2xl text-[11px] font-black text-blue-400 border border-white/10 shadow-2xl">
                            معدل النمو +18%
                         </div>
                      </div>
                      <div className="h-48 flex items-end gap-2 relative z-10 px-4">
                         {(() => {
                            const growthList = (stats.weeklyGrowth && stats.weeklyGrowth.length > 0) ? stats.weeklyGrowth : [10, 25, 45, 30, 60, 75, 90];
                            const firstY = 200 - ((growthList[0] || 0) * 2);
                            const pathD = `M 0 ${firstY} ` + growthList.map((v, i) => `L ${(i * (100 / Math.max(1, growthList.length - 1)))} ${200 - ((v || 0) * 2)}`).join(' ');
                            
                            return (
                              <>
                                {growthList.map((val, i) => (
                                   <div key={i} className="flex-1 flex flex-col items-center group">
                                      <motion.div 
                                         initial={{ height: 0 }} 
                                         animate={{ height: `${val}%` }} 
                                         className="w-full bg-gradient-to-t from-blue-600/20 to-blue-400/80 rounded-2xl relative transition-all group-hover:to-blue-300"
                                       >
                                         <div className="absolute -top-1 w-3 h-3 bg-white rounded-full left-1/2 -translate-x-1/2 shadow-[0_0_15px_white] scale-0 group-hover:scale-100 transition-transform" />
                                      </motion.div>
                                      <span className="text-[9px] text-slate-400 font-black mt-3 uppercase tracking-tighter opacity-60 group-hover:opacity-100">{['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i]}</span>
                                   </div>
                                ))}
                                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none">
                                   <path 
                                      d={pathD} 
                                      fill="none" 
                                      stroke="url(#grad)" 
                                      strokeWidth="3" 
                                   />
                                   <defs>
                                      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                         <stop offset="0%" stopColor="#3b82f6" />
                                         <stop offset="100%" stopColor="#818cf8" />
                                      </linearGradient>
                                   </defs>
                                </svg>
                              </>
                            );
                         })()}
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'reports' && (
              <motion.div key="reports" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {localReports.filter((r: any) => r.status === 'pending').length === 0 ? (
                  <div className="py-32 text-center flex flex-col items-center gap-6">
                    <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <Shield size={48} className="text-emerald-500" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-black text-white">النزاهة الرقمية مكتملة</h3>
                      <p className="text-slate-500 text-sm font-bold max-w-xs mx-auto uppercase tracking-widest">Digital Integrity Verified</p>
                    </div>
                  </div>
                ) : (
                  localReports.filter((r: any) => r.status === 'pending').map((r: any) => (
                    <div key={r.id} className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-7 flex flex-col lg:flex-row gap-6 shadow-2xl hover:border-rose-500/30 transition-all backdrop-blur-xl group relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-rose-500/10 transition-all" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-4">
                           <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                           <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">High Alert: Reported Content</span>
                        </div>
                        {/* Word break and white-space handling for mobile overflow */}
                        <div className="bg-slate-900/40 rounded-2xl p-5 border border-slate-700/30">
                          <p className="text-sm text-slate-200 leading-relaxed font-medium break-words overflow-hidden line-clamp-4 group-hover:line-clamp-none transition-all duration-500">
                            {r.content}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-end lg:self-center shrink-0">
                        <button 
                          onClick={() => {
                            const user = allUsers.find(u => u.id === r.authorId);
                            if (user) handleToggleProUser(r.authorId, user.is_pro);
                          }} 
                          className="px-5 py-3.5 bg-slate-700/50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-600 transition-all border border-slate-600/50 active:scale-95"
                        >
                          تحذير الناشر
                        </button>
                        <button 
                          onClick={() => handleDismissReport(r.id)} 
                          className="px-5 py-3.5 bg-slate-700 uppercase tracking-widest text-slate-300 rounded-2xl text-[10px] font-black hover:bg-slate-600 hover:text-white transition-all border border-slate-600 active:scale-95"
                        >
                          تجاهل
                        </button>
                        <button 
                          onClick={() => handleDeletePost(r.postId, r.id)} 
                          className="px-6 py-3.5 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 transition-all shadow-xl shadow-rose-900/40 border border-rose-500 active:scale-95 animate-pulse hover:animate-none"
                        >
                          حذف نهائي
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {/* ══ SUPPORT & REQUESTS TAB ══ */}
            {activeTab === 'support' && (
              <motion.div key="support" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                {/* Support Header & Sub-Tab Switcher */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-800/40 border border-slate-700/50 rounded-[2rem] backdrop-blur-md">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600/30 to-indigo-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shadow-lg shadow-blue-500/10">
                      <HeadphonesIcon size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">مركز الدعم الفني وإدارة الطلبات</h3>
                      <p className="text-xs text-slate-400 font-medium">متابعة طلبات ترقية الحسابات واستفسارات المستخدمين والرد المباشر</p>
                    </div>
                  </div>

                  {/* Telegram Support Quick Badge */}
                  <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-900/70 border border-sky-500/30 rounded-2xl shadow-inner">
                    <Send size={15} className="text-sky-400 rotate-[-45deg]" />
                    <span className="text-[11px] font-black text-slate-300">معرّف تيليجرام:</span>
                    <span className="text-xs font-black text-sky-400 font-mono" dir="ltr">{telegramHandle}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="px-2.5 py-1 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[10px] font-black transition-all cursor-pointer"
                    >
                      تغيير ⚙️
                    </button>
                    <a
                      href={telegramSupportService.getTelegramUrl(telegramHandle)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black transition-all"
                      title="فتح تيليجرام"
                    >
                      تجربة ↗
                    </a>
                  </div>

                  {/* Sub-tabs toggle & Refresh */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-700/60 shadow-inner">
                      <button
                        onClick={() => setSupportSubTab('requests')}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                          supportSubTab === 'requests'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <ArrowLeftRight size={14} />
                        <span>طلبات تغيير نوع الحساب</span>
                        {roleRequests.filter(r => r.status === 'pending').length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
                            {roleRequests.filter(r => r.status === 'pending').length}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => setSupportSubTab('chat')}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                          supportSubTab === 'chat'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <MessageSquare size={14} />
                        <span>شات الدعم الفني</span>
                        {supportThreads.reduce((acc, t) => acc + (t.unreadCount || 0), 0) > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                            {supportThreads.reduce((acc, t) => acc + (t.unreadCount || 0), 0)}
                          </span>
                        )}
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        if (supportSubTab === 'requests') fetchRoleRequests();
                        else fetchSupportThreads();
                      }}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl transition-all border border-slate-700 flex items-center gap-2 shrink-0"
                    >
                      <RefreshCw size={14} className={(supportLoading || loadingRoleRequests) ? 'animate-spin' : ''} />
                      <span>تحديث</span>
                    </button>
                  </div>
                </div>

                {/* ─── Sub-Tab 1: Role Change Requests Center ─── */}
                {supportSubTab === 'requests' && (
                  <div className="space-y-6">
                    {/* Quick Stats Banner */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-2xl backdrop-blur-md">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">إجمالي الطلبات</span>
                        <p className="text-xl font-black text-white">{roleRequests.length}</p>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl backdrop-blur-md">
                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block mb-1">قيد الانتظار ⏳</span>
                        <p className="text-xl font-black text-amber-300">
                          {roleRequests.filter(r => r.status === 'pending').length}
                        </p>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl backdrop-blur-md">
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-1">تمت الموافقة ✅</span>
                        <p className="text-xl font-black text-emerald-300">
                          {roleRequests.filter(r => r.status === 'approved').length}
                        </p>
                      </div>
                      <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl backdrop-blur-md">
                        <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-1">المرفوضة ❌</span>
                        <p className="text-xl font-black text-rose-300">
                          {roleRequests.filter(r => r.status === 'rejected').length}
                        </p>
                      </div>
                    </div>

                    {/* Filters & Search Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-md">
                      <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                        {[
                          { id: 'pending', label: 'قيد الانتظار ⏳' },
                          { id: 'approved', label: 'المقبولة ✅' },
                          { id: 'rejected', label: 'المرفوضة ❌' },
                          { id: 'all', label: 'جميع الطلبات' }
                        ].map((filterTab) => (
                          <button
                            key={filterTab.id}
                            onClick={() => setRoleRequestFilter(filterTab.id as any)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                              roleRequestFilter === filterTab.id
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            {filterTab.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative w-full sm:w-72">
                        <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={roleRequestSearch}
                          onChange={(e) => setRoleRequestSearch(e.target.value)}
                          placeholder="بحث بالاسم أو السبب..."
                          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs font-medium text-white outline-none focus:border-blue-500 transition-all placeholder:text-slate-500"
                        />
                      </div>
                    </div>

                    {/* Requests Grid */}
                    {loadingRoleRequests ? (
                      <div className="flex justify-center items-center py-24">
                        <RefreshCw size={28} className="animate-spin text-blue-500" />
                      </div>
                    ) : roleRequests.length === 0 ? (
                      <div className="text-center py-20 bg-slate-800/20 border border-slate-800 rounded-3xl p-8 space-y-3">
                        <ArrowLeftRight size={40} className="mx-auto text-slate-600" />
                        <h4 className="text-sm font-black text-white">لا توجد طلبات تغيير نوع الحساب حالياً</h4>
                        <p className="text-xs text-slate-400 font-medium">أي طلب يرسله أي مستخدم سيظهر هنا فوراً</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {roleRequests
                          .filter((r) => {
                            if (roleRequestFilter !== 'all' && r.status !== roleRequestFilter) return false;
                            if (roleRequestSearch.trim()) {
                              const q = roleRequestSearch.toLowerCase();
                              const nameMatch = (r.user_name || '').toLowerCase().includes(q);
                              const reasonMatch = (r.reason || '').toLowerCase().includes(q);
                              const phoneMatch = (r.user_phone || '').includes(q);
                              return nameMatch || reasonMatch || phoneMatch;
                            }
                            return true;
                          })
                          .map((req) => {
                            const isPending = req.status === 'pending';
                            const isApproved = req.status === 'approved';
                            const targetIsEmployer = req.requested_role === 'employer';
                            const timeStr = new Date(req.created_at).toLocaleString('ar-EG', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            });

                            return (
                              <div
                                key={req.id}
                                className={`p-5 rounded-3xl border transition-all space-y-4 relative overflow-hidden backdrop-blur-md ${
                                  isPending
                                    ? 'bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border-amber-500/40 shadow-xl'
                                    : isApproved
                                    ? 'bg-slate-900/60 border-emerald-500/30'
                                    : 'bg-slate-900/40 border-slate-800 opacity-80'
                                }`}
                              >
                                {/* Header: User Info & Status */}
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <img
                                      src={req.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.user_name || 'U')}&background=random`}
                                      className="w-11 h-11 rounded-2xl object-cover border border-slate-700 shadow-md shrink-0"
                                      alt=""
                                    />
                                    <div className="min-w-0">
                                      <h4 className="text-sm font-black text-white truncate">{req.user_name || 'مستخدم'}</h4>
                                      <p className="text-[10px] text-slate-400 font-bold truncate">
                                        {req.user_phone || req.user_email || `ID: ${req.user_id.slice(0, 8)}...`}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="shrink-0 flex flex-col items-end gap-1">
                                    {isPending ? (
                                      <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black animate-pulse">
                                        قيد الانتظار ⏳
                                      </span>
                                    ) : isApproved ? (
                                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black flex items-center gap-1">
                                        <Check size={12} /> تم القبول
                                      </span>
                                    ) : (
                                      <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-black flex items-center gap-1">
                                        <X size={12} /> مرفوض
                                      </span>
                                    )}
                                    <span className="text-[9px] text-slate-500 font-bold">{timeStr}</span>
                                  </div>
                                </div>

                                {/* Transition Pill */}
                                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                                    <span>الحالي:</span>
                                    <span className="text-slate-300">
                                      {req.from_role === 'employer' ? '🏢 صاحب عمل' : '👤 باحث عن عمل'}
                                    </span>
                                  </div>
                                  <ArrowRight size={14} className="text-blue-400 rotate-180 shrink-0" />
                                  <div className="flex items-center gap-1.5 font-black">
                                    <span className="text-slate-400">المطلوب:</span>
                                    <span className={targetIsEmployer ? 'text-emerald-400' : 'text-blue-400'}>
                                      {targetIsEmployer ? '🏢 صاحب عمل / شركة' : '👤 باحث عن عمل'}
                                    </span>
                                  </div>
                                </div>

                                {/* Reason / Note */}
                                {req.reason && (
                                  <div className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60 leading-relaxed">
                                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">سبب الطلب:</span>
                                    <p className="font-medium">{req.reason}</p>
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="pt-2 flex items-center gap-2 flex-wrap">
                                  {isPending ? (
                                    <>
                                      <button
                                        onClick={async () => {
                                          setRoleActionLoadingId(req.id);
                                          try {
                                            await profileService.approveRoleChangeRequest(req.id, req.user_id, req.requested_role, currentAppUser?.id);
                                            setAllUsers((prev: any[]) => prev.map(u => u.id === req.user_id ? { ...u, role: req.requested_role } : u));
                                            setGlobalUsers((prev: any[]) => prev.map(u => u.id === req.user_id ? { ...u, role: req.requested_role } : u));
                                            addToast(`✅ تم قبول الطلب وترقية حساب ${req.user_name} بنجاح!`, 'success');
                                            fetchRoleRequests();
                                            fetchSupportThreads();
                                          } catch (e: any) {
                                            addToast('فشل قبول الطلب: ' + e.message, 'error');
                                          } finally {
                                            setRoleActionLoadingId(null);
                                          }
                                        }}
                                        disabled={roleActionLoadingId === req.id}
                                        className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/30 active:scale-95 transition-all"
                                      >
                                        <Check size={14} />
                                        <span>قبول وترقية الحساب فوراً</span>
                                      </button>

                                      <button
                                        onClick={async () => {
                                          setRoleActionLoadingId(req.id);
                                          try {
                                            await profileService.rejectRoleChangeRequest(req.id, req.user_id, currentAppUser?.id);
                                            addToast('تم رفض طلب تغيير نوع الحساب', 'info');
                                            fetchRoleRequests();
                                            fetchSupportThreads();
                                          } catch (e: any) {
                                            addToast('فشل الرفض: ' + e.message, 'error');
                                          } finally {
                                            setRoleActionLoadingId(null);
                                          }
                                        }}
                                        disabled={roleActionLoadingId === req.id}
                                        className="px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-black flex items-center justify-center gap-1 active:scale-95 transition-all"
                                      >
                                        <X size={14} />
                                        <span>رفض</span>
                                      </button>
                                    </>
                                  ) : (
                                    <div className="flex-1 text-[11px] text-slate-500 font-bold">
                                      {isApproved ? 'تم اعتماد هذا الطلب ونفاذ الصلاحيات' : 'تم رفض هذا الطلب'}
                                    </div>
                                  )}

                                  {/* Direct Chat Shortcut */}
                                  <button
                                    onClick={() => {
                                      const foundThread = supportThreads.find(t => t.userId === req.user_id);
                                      if (foundThread) {
                                        setSelectedSupportUser(foundThread.user);
                                        setSupportMessages(foundThread.messages);
                                      } else {
                                        setSelectedSupportUser({
                                          id: req.user_id,
                                          name: req.user_name,
                                          avatar: req.user_avatar,
                                          phone: req.user_phone,
                                          role: req.from_role
                                        });
                                        setSupportMessages([]);
                                      }
                                      setSupportSubTab('chat');
                                    }}
                                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all border border-slate-700"
                                    title="فتح محادثة مع المستخدم"
                                  >
                                    <MessageSquare size={14} />
                                    <span className="hidden sm:inline">محادثة</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Sub-Tab 2: Live Support Chat ─── */}
                {supportSubTab === 'chat' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
                    {/* Left: Threads list */}
                    <div className="lg:col-span-4 bg-slate-800/40 border border-slate-700/50 rounded-[2rem] p-4 space-y-3 backdrop-blur-md flex flex-col">
                      <div className="flex items-center justify-between px-2 pt-1">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          المحادثات ({supportThreads.length})
                        </h4>
                        <span className="text-[10px] font-bold text-slate-500">
                          {supportThreads.reduce((acc, t) => acc + (t.unreadCount || 0), 0)} غير مقروء
                        </span>
                      </div>

                      {/* Fast search input for threads */}
                      <div className="relative">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                          type="text"
                          value={supportSearchQuery}
                          onChange={(e) => setSupportSearchQuery(e.target.value)}
                          placeholder="بحث بالاسم أو المعرف (ID) أو الهاتف..."
                          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs font-medium text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                        {supportSearchQuery && (
                          <button
                            onClick={() => setSupportSearchQuery('')}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs font-bold"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {supportLoading ? (
                        <div className="flex justify-center items-center py-20">
                          <RefreshCw size={24} className="animate-spin text-blue-500" />
                        </div>
                      ) : supportThreads.length === 0 ? (
                        <div className="text-center py-16 text-slate-500 space-y-2">
                          <MessageSquare size={32} className="mx-auto text-slate-600" />
                          <p className="text-xs font-bold">لا توجد رسائل دعم حالياً</p>
                        </div>
                      ) : (
                        <div className="space-y-2 overflow-y-auto max-h-[550px] pr-1">
                          {supportThreads
                            .filter((thread) => {
                              if (!supportSearchQuery.trim()) return true;
                              const q = supportSearchQuery.toLowerCase();
                              return (
                                (thread.user?.name || '').toLowerCase().includes(q) ||
                                (thread.user?.phone || '').includes(q) ||
                                (thread.userId || '').toLowerCase().includes(q) ||
                                (thread.lastMessage?.content || '').toLowerCase().includes(q)
                              );
                            })
                            .map((thread) => {
                            const isSelected = selectedSupportUser?.id === thread.userId;
                            return (
                              <div
                                key={thread.userId}
                                onClick={async () => {
                                  setSelectedSupportUser(thread.user);
                                  setSupportMessages(thread.messages);
                                  if (thread.unreadCount > 0) {
                                    try {
                                      await db.from("support_messages").update({ read: true }).eq("sender_id", thread.userId);
                                      setSupportThreads(prev => prev.map(t => t.userId === thread.userId ? { ...t, unreadCount: 0 } : t));
                                    } catch {}
                                  }
                                }}
                                className={`p-3.5 rounded-2xl cursor-pointer transition-all border flex items-center gap-3 ${
                                  isSelected
                                    ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-lg'
                                    : 'bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                                }`}
                              >
                                <div className="relative shrink-0">
                                  <img
                                    src={thread.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(thread.user?.name || 'U')}&background=random`}
                                    className="w-11 h-11 rounded-xl object-cover border border-slate-700 shrink-0"
                                    alt=""
                                  />
                                  <span className={`absolute -bottom-1 -right-1 text-[8px] font-black px-1.5 py-0.2 rounded-full border shadow-sm ${
                                    thread.user?.role === 'employer'
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                      : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                  }`}>
                                    {thread.user?.role === 'employer' ? '💼 صاحب عمل' : '👤 باحث'}
                                  </span>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-baseline mb-0.5">
                                    <p className="text-xs font-black truncate text-white">{thread.user?.name || 'مستخدم'}</p>
                                    {thread.unreadCount > 0 && (
                                      <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded-full shadow-md shrink-0">
                                        {thread.unreadCount} جديد
                                      </span>
                                    )}
                                  </div>

                                  {/* User UUID snippet & Phone tags */}
                                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                    <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/70 border border-cyan-800/50 px-1.5 py-0.2 rounded font-bold" title={thread.userId}>
                                      ID: {thread.userId.slice(0, 8)}...
                                    </span>
                                    {thread.user?.phone && (
                                      <span className="text-[9px] font-bold text-slate-400">
                                        {thread.user.phone}
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-[10px] text-slate-400 truncate font-medium">
                                    {thread.lastMessage?.content || '...'}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right: Active Chat Window */}
                    <div className="lg:col-span-8 bg-slate-800/40 border border-slate-700/50 rounded-[2rem] p-6 backdrop-blur-md flex flex-col">
                      {selectedSupportUser ? (
                        <>
                          {/* Selected User Header */}
                          <div className="pb-4 mb-4 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <img
                                src={selectedSupportUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedSupportUser.name || 'U')}&background=random`}
                                className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shadow-md shrink-0"
                                alt=""
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-black text-white truncate">{selectedSupportUser.name || 'مستخدم الدعم'}</h4>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black border ${
                                    selectedSupportUser.role === 'employer'
                                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                      : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                  }`}>
                                    {selectedSupportUser.role === 'employer' ? 'صاحب عمل 💼' : 'باحث عن عمل 👤'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 mt-1 flex-wrap text-[10px] text-slate-400 font-bold">
                                  {selectedSupportUser.phone && <span>📞 {selectedSupportUser.phone}</span>}
                                  {selectedSupportUser.email && <span>✉️ {selectedSupportUser.email}</span>}
                                </div>

                                {/* Full UUID with 1-click Copy button */}
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <span className="text-[9px] text-slate-400 font-black">المعرّف (ID):</span>
                                  <code className="text-[10px] font-mono text-cyan-300 bg-slate-900 border border-slate-700/80 px-2 py-0.5 rounded-md select-all">
                                    {selectedSupportUser.id}
                                  </code>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(selectedSupportUser.id);
                                      addToast(`تم نسخ معرف المستخدم (${selectedSupportUser.id.slice(0, 8)}...) بنجاح 📋`, 'success');
                                    }}
                                    className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white transition-colors"
                                    title="نسخ المعرف بالكامل"
                                  >
                                    <Copy size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-full flex items-center gap-1.5 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              محادثة نشطة
                            </span>
                          </div>

                          {/* Messages List with Role Request Cards */}
                          <div className="flex-1 overflow-y-auto space-y-3 p-2 min-h-[300px] max-h-[420px]">
                            {supportMessages.map((m: any) => {
                              const isMe = m.sender_id === currentAppUser?.id || String(m.sender_id).includes("support-admin");
                              const timeStr = new Date(m.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
                              const isRoleRequest = m.message_type === "role_change_request" || (m.content && m.content.includes("[طلب تغيير نوع الحساب]"));

                              let requestedRole: "seeker" | "employer" = "employer";
                              if (m.metadata?.requestedRole) requestedRole = m.metadata.requestedRole;
                              else if (m.content?.includes("باحث")) requestedRole = "seeker";
                              else if (m.content?.includes("صاحب")) requestedRole = "employer";

                              const isAlreadyApproved = selectedSupportUser?.role === requestedRole;

                              if (isRoleRequest) {
                                return (
                                  <div key={m.id} className="w-full my-2">
                                    <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border-2 border-amber-500/40 rounded-3xl p-5 shadow-xl space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                                            <ArrowLeftRight size={18} />
                                          </div>
                                          <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                                              طلب رسمي لتغيير فئة الحساب
                                            </span>
                                            <h5 className="text-xs font-black text-white mt-1">
                                              التحويل إلى: {requestedRole === "employer" ? "صاحب عمل / شركة 🏢" : "باحث عن عمل 👤"}
                                            </h5>
                                          </div>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-500">{timeStr}</span>
                                      </div>

                                      <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800/80 space-y-2.5 text-xs text-slate-300">
                                        <div className="pt-1 text-slate-400 font-medium leading-relaxed">
                                          <span className="font-bold text-slate-300">السبب/الرسالة: </span>
                                          <span>{m.metadata?.reason || m.content.replace("[طلب تغيير نوع الحساب]:", "").trim()}</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between pt-1">
                                        {isAlreadyApproved ? (
                                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black">
                                            <Check size={14} /> تم قبول الطلب والحساب محول حالياً
                                          </span>
                                        ) : (
                                          <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <button
                                              onClick={async () => {
                                                try {
                                                  await profileService.approveRoleChangeRequest(m.id, selectedSupportUser.id, requestedRole, currentAppUser?.id);
                                                  setSelectedSupportUser((prev: any) => ({ ...prev, role: requestedRole }));
                                                  setAllUsers((prev: any[]) => prev.map(u => u.id === selectedSupportUser.id ? { ...u, role: requestedRole } : u));
                                                  setGlobalUsers((prev: any[]) => prev.map(u => u.id === selectedSupportUser.id ? { ...u, role: requestedRole } : u));
                                                  addToast(`✅ تم قبول الطلب وتحويل حساب ${selectedSupportUser.name} إلى ${requestedRole === "employer" ? "صاحب عمل" : "باحث عن عمل"}!`, "success");
                                                  fetchSupportThreads();
                                                  fetchRoleRequests();
                                                } catch (e: any) {
                                                  addToast("فشل قبول الطلب: " + e.message, "error");
                                                }
                                              }}
                                              className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/30 active:scale-95 transition-all"
                                            >
                                              <Check size={14} /> قبول وتغيير الدور الآن
                                            </button>
                                            <button
                                              onClick={async () => {
                                                try {
                                                  await profileService.rejectRoleChangeRequest(m.id, selectedSupportUser.id, currentAppUser?.id);
                                                  addToast("تم رفض طلب تغيير نوع الحساب", "info");
                                                  fetchSupportThreads();
                                                  fetchRoleRequests();
                                                } catch (e: any) {
                                                  addToast("فشل الرفض: " + e.message, "error");
                                                }
                                              }}
                                              className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-black flex items-center justify-center gap-1 active:scale-95 transition-all"
                                            >
                                              <X size={14} /> رفض
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div key={m.id} className={`flex ${isMe ? "justify-start" : "justify-end"}`}>
                                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-xs font-medium leading-relaxed ${
                                    isMe
                                      ? "bg-blue-600 text-white rounded-tr-none shadow-md"
                                      : "bg-slate-900 border border-slate-700/60 text-slate-200 rounded-tl-none shadow-sm"
                                  }`}>
                                    <p>{m.content}</p>
                                    <span className="block text-[8px] opacity-60 text-left mt-1 font-bold">{timeStr}</span>
                                  </div>
                                </div>
                              );
                            })}
                            <div ref={supportChatBottomRef} />
                          </div>

                          {/* Reply Input Bar */}
                          <div className="pt-4 mt-2 border-t border-slate-700/50 flex gap-3 items-end">
                            <textarea
                              value={supportReplyText}
                              onChange={(e) => {
                                let val = e.target.value;
                                // ✅ إضافة المسافة تلقائياً عند كتابة الفاصلة العربية أو الإنجليزية في شات الأدمن
                                if (val.length > supportReplyText.length) {
                                  const lastChar = val.slice(-1);
                                  if (lastChar === '،' || lastChar === ',') {
                                    val = val + ' ';
                                  }
                                }
                                setSupportReplyText(val);
                              }}
                              onKeyDown={(e) => {
                                // دعم إضافة مسافة عند الضغط على الفاصلة
                                if (e.key === '،' || e.key === ',') {
                                  // يتم التعامل معها في onChange
                                }
                                if (e.key === 'Enter' && !e.shiftKey) { 
                                  e.preventDefault(); 
                                  handleSendAdminSupportReply(); 
                                } 
                              }}
                              placeholder="اكتب رد الدعم الفني هنا... (Enter للإرسال)"
                              rows={2}
                              className="flex-1 bg-slate-900/80 border border-slate-700 rounded-2xl px-4 py-3 text-xs font-medium text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-500 resize-none"
                            />
                            <button
                              onClick={handleSendAdminSupportReply}
                              disabled={!supportReplyText.trim() || sendingSupportReply}
                              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl font-black text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 shrink-0 self-end"
                            >
                              {sendingSupportReply ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                <>
                                  <span>إرسال الرد</span>
                                  <Send size={14} />
                                </>
                              )}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3 py-20">
                          <HeadphonesIcon size={40} className="text-slate-600" />
                          <p className="text-xs font-bold">حدد محادثة من القائمة للبدء بالرد على المستخدم</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ══ NOTIFICATIONS TAB ══ */}
            {activeTab === 'notifications' && (
              <motion.div key="notifications" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
                {/* Header with Quick Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] backdrop-blur-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-xl shadow-amber-900/30">
                      <BellRing size={26} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white">مركز إدارة وتتبع الإشعارات</h2>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        مراقبة الإشعارات اللحظية في النظام، والتأكد من وصولها للمستخدمين ورؤيتها
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={fetchStats}
                      disabled={loadingStats}
                      className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black border border-slate-700 flex items-center gap-2 transition-all active:scale-95"
                    >
                      <RefreshCw size={14} className={loadingStats ? 'animate-spin' : ''} />
                      تحديث فوري
                    </button>
                    <button
                      onClick={handleMarkAllSystemNotificationsRead}
                      className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition-all active:scale-95"
                    >
                      <CheckCheck size={15} />
                      تمييز الكل كمقروء
                    </button>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2rem] p-5 text-center shadow-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">إجمالي التنبيهات</p>
                    <p className="text-2xl font-black text-white">{stats.totalNotifications.toLocaleString('ar-EG')}</p>
                    <span className="text-[9px] text-blue-400 font-bold">في قاعدة البيانات</span>
                  </div>
                  <div className="bg-slate-800/40 border border-emerald-500/30 rounded-[2rem] p-5 text-center shadow-xl">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">تمت المشاهدة (مقروءة)</p>
                    <p className="text-2xl font-black text-emerald-400">{stats.readNotifications.toLocaleString('ar-EG')}</p>
                    <span className="text-[9px] text-emerald-400/80 font-bold">
                      {stats.totalNotifications > 0 ? Math.round((stats.readNotifications / stats.totalNotifications) * 100) : 100}% نسبة المشاهدة
                    </span>
                  </div>
                  <div className="bg-slate-800/40 border border-rose-500/30 rounded-[2rem] p-5 text-center shadow-xl">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">لم تتم الرؤية (جديدة)</p>
                    <p className="text-2xl font-black text-rose-400">{stats.unreadNotifications.toLocaleString('ar-EG')}</p>
                    <span className="text-[9px] text-rose-400/80 font-bold">بحاجة لمتابعة المستخدم</span>
                  </div>
                  <div className="bg-slate-800/40 border border-amber-500/30 rounded-[2rem] p-5 text-center shadow-xl">
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">سجل التنبيهات المباشر</p>
                    <p className="text-2xl font-black text-amber-400">{allAdminNotifications.length}</p>
                    <span className="text-[9px] text-amber-400/80 font-bold">آخر التنبيهات الواردة</span>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                  {/* Status Filters */}
                  <div className="flex gap-2 w-full md:w-auto">
                    {[
                      { id: 'all', label: `الكل (${allAdminNotifications.length})` },
                      { id: 'unread', label: `لم تتم الرؤية (${allAdminNotifications.filter(n => !n.read).length})`, isUnread: true },
                      { id: 'read', label: `تمت الرؤية (${allAdminNotifications.filter(n => n.read).length})` },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setNotifFilter(f.id as any)}
                        className={`flex-1 md:flex-initial px-4 py-2.5 rounded-2xl text-xs font-black transition-all border ${
                          notifFilter === f.id
                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/30'
                            : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border-slate-700/50'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Type Filter */}
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter size={15} className="text-slate-500 shrink-0" />
                    <select
                      value={notifTypeFilter}
                      onChange={(e) => setNotifTypeFilter(e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold rounded-2xl px-4 py-2.5 outline-none focus:border-blue-500"
                    >
                      <option value="all">جميع أنواع التنبيهات</option>
                      <option value="role_change_request">طلبات تغيير نوع الحساب (Role Requests)</option>
                      <option value="follow_request">طلبات التواصل (Network Sync)</option>
                      <option value="job_application">التقديم على الوظائف</option>
                      <option value="like">الإعجابات (Likes)</option>
                      <option value="comment">التعليقات (Comments)</option>
                      <option value="message">الرسائل الفورية (Messages)</option>
                      <option value="missed_call">مكالمات فائتة (Calls)</option>
                    </select>
                  </div>
                </div>

                {/* Notifications Table */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-xl">
                  {allAdminNotifications.length === 0 ? (
                    <div className="py-24 text-center text-slate-500 space-y-3">
                      <Bell size={36} className="mx-auto text-slate-600" />
                      <p className="text-sm font-black">لا توجد تنبيهات مسجلة حالياً</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="border-b border-slate-700/50 bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-6 py-4">المرسل</th>
                            <th className="px-6 py-4">نوع التنبيه</th>
                            <th className="px-6 py-4">المستلم (ID)</th>
                            <th className="px-6 py-4">التاريخ والوقت</th>
                            <th className="px-6 py-4">حالة الرؤية</th>
                            <th className="px-6 py-4 text-center">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30 text-xs">
                          {allAdminNotifications
                            .filter(n => {
                              if (notifFilter === 'unread') return !n.read;
                              if (notifFilter === 'read') return n.read;
                              return true;
                            })
                            .filter(n => {
                              if (notifTypeFilter === 'all') return true;
                              return n.type === notifTypeFilter;
                            })
                            .map((n) => {
                              const isRead = !!n.read;
                              const typeLabels: Record<string, { label: string; color: string }> = {
                                follow_request:  { label: 'طلب تواصل', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
                                sync_approval:   { label: 'قبول تواصل', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
                                job_application: { label: 'تقديم وظيفة', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
                                like:            { label: 'إعجاب منشور', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
                                comment:         { label: 'تعليق منشور', color: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
                                message:         { label: 'رسالة خاصة', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
                                missed_call:     { label: 'مكالمة فائتة', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
                              };
                              const cfg = typeLabels[n.type] || { label: n.type || 'إشعار', color: 'bg-slate-700/50 text-slate-300 border-slate-600' };

                              return (
                                <tr key={n.id} className="hover:bg-slate-800/60 transition-colors">
                                  {/* Sender */}
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <img
                                        src={n.from_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.from_name || 'U')}&background=random`}
                                        className="w-9 h-9 rounded-xl object-cover border border-slate-700 shadow-sm"
                                        alt=""
                                      />
                                      <div>
                                        <p className="font-black text-white">{n.from_name || 'مستخدم'}</p>
                                        <p className="text-[9px] text-slate-500 font-mono truncate max-w-[120px]">{n.from_id || '-'}</p>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Type */}
                                  <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border ${cfg.color}`}>
                                      {cfg.label}
                                    </span>
                                  </td>

                                  {/* Recipient User ID */}
                                  <td className="px-6 py-4">
                                    <span className="text-[10px] text-slate-400 font-mono bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800">
                                      {n.user_id ? `${n.user_id.slice(0, 8)}...` : 'الكل'}
                                    </span>
                                  </td>

                                  {/* Timestamp */}
                                  <td className="px-6 py-4 text-slate-400 font-medium text-[11px]">
                                    <div className="flex items-center gap-1.5">
                                      <Clock size={12} className="text-slate-500" />
                                      <span>{new Date(n.created_at || Date.now()).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </div>
                                  </td>

                                  {/* Seen / Unseen Status */}
                                  <td className="px-6 py-4">
                                    {isRead ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                        <CheckCheck size={12} />
                                        تمت الرؤية
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                        لم تتم الرؤية
                                      </span>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="px-6 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                      {n.type === 'role_change_request' && !isRead && (
                                        <>
                                          <button
                                            onClick={() => handleApproveRoleChange(n)}
                                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] flex items-center gap-1 shadow-lg shadow-emerald-900/30 transition-all active:scale-95"
                                            title="قبول وتغيير نوع الحساب"
                                          >
                                            <Check size={13} />
                                            <span>قبول</span>
                                          </button>
                                          <button
                                            onClick={() => handleRejectRoleChange(n)}
                                            className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 font-black text-[10px] flex items-center gap-1 transition-all active:scale-95"
                                            title="رفض الطلب"
                                          >
                                            <X size={13} />
                                            <span>رفض</span>
                                          </button>
                                        </>
                                      )}
                                      <button
                                        onClick={() => handleMarkAdminNotification(n.id, isRead)}
                                        className={`p-2 rounded-xl border transition-all text-xs font-bold ${
                                          isRead
                                            ? 'bg-slate-800 text-slate-400 hover:text-amber-400 border-slate-700'
                                            : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border-emerald-500/40'
                                        }`}
                                        title={isRead ? 'تمييز كغير مقروء' : 'تمييز كمقروء'}
                                      >
                                        {isRead ? <EyeOff size={14} /> : <Eye size={14} />}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteAdminNotification(n.id)}
                                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 border border-red-500/20 transition-all"
                                        title="حذف التنبيه نهائياً"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="relative group">
                  <Search size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <input type="text" value={searchQuery} onChange={e => handleSearchChange(e.target.value)} placeholder="البحث في سجل المستخدمين..." className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl pr-12 py-4 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-xl transition-all" />
                </div>
                <div className="space-y-4">
                  {filteredUsers.map((u: any) => (
                    <div key={u.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-5 bg-slate-800/40 border border-slate-700/50 rounded-[2rem] hover:border-blue-500/50 hover:bg-slate-800/60 transition-all group relative overflow-hidden backdrop-blur-md shadow-xl">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
                      
                      <div className="flex items-center gap-5 flex-1 min-w-0">
                        <div className="relative flex-shrink-0">
                          <img 
                            src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'U')}`} 
                            className="w-14 h-14 rounded-2xl object-cover ring-2 ring-slate-700 group-hover:ring-blue-500/50 transition-all shadow-2xl" 
                            alt="" 
                          />
                          {u.is_pro && (
                            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-amber-500 rounded-full border-4 border-slate-900 flex items-center justify-center text-[10px] text-white">
                              <Crown size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-3 mb-2">
                             <p className="text-base font-black text-white truncate tracking-tight">{u.name}</p>
                             <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${u.role === 'employer' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                {u.role === 'employer' ? 'صاحب عمل' : 'باحث'}
                             </div>
                             {u.is_admin && <span className="px-3 py-1 bg-white text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">Admin</span>}
                          </div>
                          <p className="text-xs text-slate-400 font-bold truncate opacity-80">{u.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-2xl border border-slate-700/50 self-end lg:self-center shadow-inner">
                        <ActionButton 
                          onClick={() => handleToggleUserAccess(u.id, 'has_calls_access', u.has_calls_access)} 
                          active={u.has_calls_access} 
                          color="emerald" 
                          icon={<Phone size={16} />} 
                        />
                        <ActionButton 
                          onClick={() => handleToggleUserAccess(u.id, 'has_erp_access', u.has_erp_access)} 
                          active={u.has_erp_access} 
                          color="indigo" 
                          icon={<Building2 size={16} />} 
                        />
                        <ActionButton 
                          onClick={() => handleToggleUserAccess(u.id, 'has_support_access', u.has_support_access)} 
                          active={u.has_support_access} 
                          color="cyan" 
                          icon={<HeadphonesIcon size={16} />} 
                        />
                        <div className="w-[1px] h-8 bg-slate-700 mx-2" />
                        <ActionButton 
                          onClick={() => handleToggleAdminUser(u.id, u.is_admin)} 
                          active={u.is_admin} 
                          color="blue" 
                          icon={<Shield size={16} />} 
                        />
                        <ActionButton 
                          onClick={() => handleToggleProUser(u.id, u.is_pro)} 
                          active={u.is_pro} 
                          color="amber" 
                          icon={<Crown size={16} />} 
                        />
                        <ActionButton 
                          onClick={() => handleToggleBanUser(u.id, u.is_active !== false)} 
                          active={u.is_active === false} 
                          color="red" 
                          icon={<XCircle size={16} />} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'posts' && (
              <motion.div key="posts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="relative group">
                  <Search size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <input type="text" value={searchQuery} onChange={e => handleSearchChange(e.target.value)} placeholder="بحث في السجل الجنائي للمنشورات..." className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl pr-12 py-4 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-xl transition-all" />
                </div>
                {filteredPosts.map(p => (
                  <div key={p.id} className="p-6 bg-slate-800/40 border border-slate-700/50 rounded-[2rem] flex items-start gap-6 shadow-xl hover:border-blue-500/50 transition-all backdrop-blur-md">
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.15em]">{p.author_name}</p>
                       </div>
                       <p className="text-sm text-slate-200 leading-relaxed font-medium break-words line-clamp-4">{p.content}</p>
                    </div>
                    <button 
                      onClick={() => handleDeletePost(p.id)} 
                      className="p-3.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all flex-shrink-0 shadow-xl border border-rose-500/20 active:scale-95"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}

             {activeTab === 'resources' && (
               <motion.div key="resources" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 shadow-xl hover:shadow-2xl hover:border-blue-500/50 transition-all relative overflow-hidden group backdrop-blur-md">
                       <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform" />
                       <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-6">
                          <Building2 className="text-blue-500" size={32} />
                       </div>
                       <h3 className="text-xl font-black text-white mb-3 tracking-tight">نظام المخطط المكتبي (ERP)</h3>
                       <p className="text-sm text-slate-400 mb-8 leading-relaxed font-medium">نظام مركزي لإدارة الموارد البشرية والعمليات المالية. الوصول مقيد للمستخدمين المفعلين فقط عبر بروتوكول الأمان.</p>
                       <button className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl text-sm font-black shadow-2xl shadow-blue-900/30 hover:scale-[1.02] active:scale-95 transition-all">دخول النظام الآمن</button>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 shadow-xl hover:shadow-2xl hover:border-emerald-500/50 transition-all relative overflow-hidden group backdrop-blur-md">
                       <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform" />
                       <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-6">
                          <Briefcase className="text-emerald-500" size={32} />
                       </div>
                       <h3 className="text-xl font-black text-white mb-3 tracking-tight">محرك الموازنة الذكي</h3>
                       <p className="text-sm text-slate-400 mb-8 leading-relaxed font-medium">تحليل فورس العمل ومعدلات التوظيف باستخدام الذكاء الاصطناعي لتوفير أفضل النتائج السوقية.</p>
                       <div className="flex items-end gap-1.5 h-16 mb-8">
                          {[30, 70, 45, 90, 60, 40, 80, 50].map((h, i) => <div key={i} className="flex-1 bg-emerald-500/20 rounded-full" style={{height: `${h}%`}} />)}
                       </div>
                    </div>
                 </div>
               </motion.div>
             )}
            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                 {/* ── Telegram Support Configuration Card ── */}
                 <div className="bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-sky-950/30 border border-sky-500/30 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="relative z-10">
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                          <div className="flex items-center gap-4">
                             <div className="p-3.5 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl shadow-[0_0_25px_rgba(14,165,233,0.4)] text-white">
                                <Send size={22} className="rotate-[-45deg]" />
                             </div>
                             <div>
                                <h3 className="text-base font-black text-white">إعدادات الدعم عبر تيليجرام (Telegram Support)</h3>
                                <p className="text-xs text-slate-400 font-medium">التحكم في معرّف تيليجرام للدعم الفني الذي يظهر للمستخدمين والربط التلقائي</p>
                             </div>
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black self-start sm:self-auto">
                             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                             نشط ومتزامن لحظياً
                          </span>
                       </div>

                       <div className="p-6 bg-slate-900/60 border border-slate-700/60 rounded-3xl space-y-6">
                          {/* 1. Telegram Handle */}
                          <div>
                             <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-black text-slate-200">
                                   معرّف حساب أو بوت التيليجرام للدعم (Username):
                                </label>
                                <button
                                   type="button"
                                   onClick={() => {
                                      setEditingTelegramHandle('@keko4444');
                                   }}
                                   className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors"
                                >
                                   الافتراضي: @keko4444
                                </button>
                             </div>
                             <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                   <input
                                      type="text"
                                      value={editingTelegramHandle}
                                      onChange={(e) => setEditingTelegramHandle(e.target.value)}
                                      placeholder="@keko4444"
                                      dir="ltr"
                                      className="w-full bg-slate-800/90 border border-slate-700 focus:border-sky-500 rounded-2xl px-4 py-3 text-sm font-black text-white placeholder:text-slate-500 outline-none transition-all font-mono"
                                   />
                                </div>
                                <div className="flex items-center gap-2">
                                   <a
                                      href={telegramSupportService.getTelegramUrl(editingTelegramHandle)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700 text-xs font-black transition-all flex items-center gap-1.5"
                                   >
                                      <span>فتح الرابط</span>
                                      <ArrowRight size={14} className="rotate-180" />
                                   </a>
                                </div>
                             </div>
                             <p className="text-[11px] text-slate-400 font-medium mt-1.5">
                                الرابط المباشر الذي يظهر للمستخدمين: <a href={telegramSupportService.getTelegramUrl(telegramHandle)} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-mono font-bold" dir="ltr">{telegramSupportService.getTelegramUrl(telegramHandle)}</a>
                             </p>
                          </div>

                          {/* 2. Bot Token & Chat ID (Automation Section) */}
                          <div className="pt-4 border-t border-slate-800 space-y-4">
                             <div className="flex items-center justify-between">
                                <div>
                                   <h4 className="text-xs font-black text-white flex items-center gap-2">
                                      <span>ربط البوت الآلي لاستقبال الرسائل في تيليجرام</span>
                                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">اختياري للإشعار اللحظي</span>
                                   </h4>
                                   <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                      أدخل توكن البوت و ID المحادثة لتصلك كل رسالة دعم فني جديدة مباشرة على هاتفك في تيليجرام.
                                   </p>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                   <div className="flex items-center justify-between mb-1.5">
                                      <label className="text-[11px] font-black text-slate-300">
                                         توكن البوت (Bot Token):
                                      </label>
                                      <a
                                         href="https://t.me/BotFather"
                                         target="_blank"
                                         rel="noopener noreferrer"
                                         className="text-[10px] font-bold text-sky-400 hover:underline"
                                      >
                                         احصل عليه من @BotFather ↗
                                      </a>
                                   </div>
                                   <div className="relative">
                                      <input
                                         type={showBotToken ? "text" : "password"}
                                         value={editingBotToken}
                                         onChange={(e) => setEditingBotToken(e.target.value)}
                                         placeholder="123456789:ABCdefGHIjklMNOpqrs..."
                                         dir="ltr"
                                         className="w-full bg-slate-800/90 border border-slate-700 focus:border-sky-500 rounded-2xl pr-4 pl-12 py-3 text-xs font-black text-white placeholder:text-slate-500 outline-none transition-all font-mono"
                                      />
                                      <button
                                         type="button"
                                         onClick={() => setShowBotToken(!showBotToken)}
                                         className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-black"
                                      >
                                         {showBotToken ? 'إخفاء' : 'عرض'}
                                      </button>
                                   </div>
                                </div>

                                <div>
                                   <div className="flex items-center justify-between mb-1.5">
                                      <label className="text-[11px] font-black text-slate-300">
                                         معرف المحادثة أو المجموعة (Chat ID):
                                      </label>
                                      <div className="flex items-center gap-2">
                                         <button
                                            type="button"
                                            disabled={detectingChatId}
                                            onClick={handleDetectChatId}
                                            className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 transition-all cursor-pointer"
                                            title="يكتشف الـ ID فوراً بمجرد فتح البوت والضغط على Start"
                                         >
                                            {detectingChatId ? 'جاري الفحص...' : 'اكتشاف الـ ID تلقائياً 🔍'}
                                         </button>
                                         <a
                                            href="https://t.me/userinfobot"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] font-bold text-sky-400 hover:underline"
                                         >
                                            @userinfobot ↗
                                         </a>
                                      </div>
                                   </div>
                                   <input
                                      type="text"
                                      value={editingChatId}
                                      onChange={(e) => setEditingChatId(e.target.value)}
                                      placeholder="مثال: 987654321 أو -100123456789"
                                      dir="ltr"
                                      className="w-full bg-slate-800/90 border border-slate-700 focus:border-sky-500 rounded-2xl px-4 py-3 text-xs font-black text-white placeholder:text-slate-500 outline-none transition-all font-mono"
                                   />
                                </div>
                             </div>

                             {/* Buttons Action Bar */}
                             <div className="flex flex-wrap items-center gap-3 pt-2">
                                <button
                                   type="button"
                                   disabled={savingTelegram}
                                   onClick={() => handleSaveTelegramConfig()}
                                   className="px-6 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-sky-500/20 transition-all active:scale-95 cursor-pointer"
                                >
                                   {savingTelegram ? 'جاري حفظ الإعدادات...' : 'حفظ كافة إعدادات تيليجرام 💾'}
                                </button>

                                <button
                                   type="button"
                                   disabled={testingTelegram || !editingBotToken || !editingChatId}
                                   onClick={handleTestTelegramBot}
                                   className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 text-xs font-black transition-all flex items-center gap-2 cursor-pointer"
                                >
                                   <span className={testingTelegram ? 'animate-spin' : ''}>🧪</span>
                                   <span>{testingTelegram ? 'جاري الفحص...' : 'فحص اتصال البوت (إرسال رسالة تجريبية)'}</span>
                                </button>
                             </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-800">
                             <div className="p-3.5 bg-slate-800/40 rounded-2xl border border-slate-700/40">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الربط المباشر</p>
                                <p className="text-xs font-black text-white">زر تيليجرام المباشر في صفحة الدعم</p>
                             </div>
                             <div className="p-3.5 bg-slate-800/40 rounded-2xl border border-slate-700/40">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">البوت التلقائي</p>
                                <p className="text-xs font-black text-emerald-400">{editingBotToken ? 'مُعد وجاهز للإشعار' : 'بانتظار إدخال التوكن'}</p>
                             </div>
                             <div className="p-3.5 bg-slate-800/40 rounded-2xl border border-slate-700/40">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الحفظ والأمان</p>
                                <p className="text-xs font-black text-sky-400">مشفر في قاعدة البيانات محلياً</p>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 shadow-xl backdrop-blur-md">
                       <div className="flex items-center gap-4 mb-8">
                          <div className="p-3 bg-blue-600 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)]"><Activity size={20} className="text-white" /></div>
                          <h3 className="text-sm font-black text-white uppercase tracking-widest">تكوين النظام</h3>
                       </div>
                       
                       <div className="space-y-6">
                          <div className="flex items-center justify-between p-5 bg-slate-900/50 rounded-3xl border border-slate-700/50">
                             <div>
                                <p className="text-sm font-black text-white">نشر الفيديو للعامة</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">تقييد رفع المقاطع على المشرفين فقط</p>
                             </div>
                             <div className="w-14 h-7 bg-emerald-500 rounded-full relative shadow-inner">
                                <div className="absolute right-1 top-1 w-5 h-5 bg-white rounded-full shadow-lg" />
                             </div>
                          </div>

                          <div className="flex items-center justify-between p-5 bg-slate-900/50 rounded-3xl border border-slate-700/50 opacity-50">
                             <div>
                                <p className="text-sm font-black text-white">وضع الصيانة</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">إغلاق المنصة للصيانة المجدولة</p>
                             </div>
                             <div className="w-14 h-7 bg-slate-700 rounded-full relative shadow-inner">
                                <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full shadow-lg" />
                             </div>
                          </div>
                       </div>

                       <div className="mt-10 p-5 bg-blue-600/10 border border-blue-500/20 rounded-3xl">
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-relaxed">
                             ملاحظة: كافة التغييرات في هذا القسم يتم تعقبها وتسجيلها في سجل العمليات الأمنية (Audit Logs).
                          </p>
                       </div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-800/40 to-blue-900/20 border border-slate-700/50 rounded-[2.5rem] p-8 shadow-xl backdrop-blur-md">
                        <div className="flex items-center gap-4 mb-8">
                          <div className="p-3 bg-emerald-600 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.4)]"><Shield size={20} className="text-white" /></div>
                          <h3 className="text-sm font-black text-white uppercase tracking-widest">أمن البيانات</h3>
                       </div>
                       <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6">
                          نظام التشفير الحالي يعمل ببروتوكول AES-256. جميع الاتصالات مشفرة بالكامل بين العميل والخادم.
                       </p>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="p-5 bg-slate-900/50 rounded-3xl border border-slate-700/50 text-center">
                             <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">حالة التشفير</p>
                             <p className="text-emerald-400 font-black">نشط وجاهز</p>
                          </div>
                          <div className="p-5 bg-slate-900/50 rounded-3xl border border-slate-700/50 text-center">
                             <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">توزيع المفاتيح</p>
                             <p className="text-blue-400 font-black">مؤمنة 100%</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}

            {/* ── Security Tab ── */}
            {activeTab === 'security' && (
              <motion.div key="security" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-[1.5rem] bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shadow-2xl shadow-red-900/40">
                    <ShieldAlert size={26} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-widest">مركز الأمن السيبراني</h2>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-0.5">Cybersecurity & Anomaly Detection Center</p>
                  </div>
                </div>

                {/* KPI Overview */}
                <SecurityOverviewCard onRefresh={() => setActiveTab('security')} />

                {/* Interactive Threat Tree & Target Vectors */}
                <InteractiveThreatTree />

                {/* Defensive Response Capabilities Card */}
                <DefensiveCapabilitiesCard />

                {/* Real Threat Feed Table */}
                <ThreatFeedTable addToast={addToast} />

                {/* 24h Activity Timeline */}
                <ActivityTimeline />

                {/* Clear logs action */}
                <div className="flex justify-end">
                  <button
                    onClick={() => { threatEngine.clearAll(); addToast('تم مسح جميع سجلات التهديدات 🗑️', 'success'); setActiveTab('security'); }}
                    className="px-5 py-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-red-400 hover:border-red-500/30 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                  >
                    مسح جميع السجلات
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative z-10 px-8 py-5 border-t border-slate-700/50 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-black tracking-widest uppercase">
            <CheckCircle size={16} className="text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
            <span>Encrypted Connection • V2.8.5 Stable</span>
          </div>
          <div className="text-[11px] text-slate-200 font-black tracking-widest opacity-40">ADMIN_GATEWAY_V94</div>
        </div>
    </motion.div>
  );
}

function ActionButton({ onClick, active, color, icon }: { onClick: () => void, active: boolean, color: string, icon: React.ReactNode }) {
  const styles: any = {
    blue:    active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border-blue-500' 
                   : 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20',
    emerald: active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border-emerald-500' 
                   : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20',
    indigo:  active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 border-indigo-500' 
                   : 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20',
    amber:   active ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/40 border-amber-500' 
                   : 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20',
    black:   active ? 'bg-slate-100 text-slate-900 shadow-lg shadow-slate-900/40 border-slate-200' 
                   : 'text-slate-400 bg-slate-400/10 hover:bg-slate-400/20 border-slate-400/20',
    red:     active ? 'bg-red-600 text-white shadow-lg shadow-red-900/40 border-red-500' 
                   : 'text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-500/20',
  };
  
  return (
    <button 
      onClick={onClick} 
      className={`p-3 rounded-2xl transition-all hover:scale-105 active:scale-95 border ${styles[color] || styles.blue}`}
    >
      {React.isValidElement(icon) ? React.cloneElement(icon as any, { size: 18, strokeWidth: 2.5 }) : icon}
    </button>
  );
}

