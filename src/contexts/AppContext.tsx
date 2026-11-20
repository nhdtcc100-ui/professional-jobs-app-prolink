import { revealTheme } from '../lib/motion/transitions';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AppUser, Post, Job, AppConnection, AppNotification } from '../types';
import { authService, postService, jobService, networkService, profileService } from '../lib/services';
import { callService } from '../lib/services/callService';
import { sanitizeInput } from '../lib/utils/sanitize';
import { isUserAdmin, canUserPostAndInteract } from '../lib/utils/roleUtils';
import { platformSettingsService, PlatformPublicSettings } from '../lib/services/platformSettingsService';
import { getJobCategory } from '../lib/utils/jobCategoryUtils';
import { mockDataService } from '../lib/services/mockDataService';
import { resetStuckLocksAndQueues, ensureFreshSession } from '../lib/services/sessionRecovery';

interface AppContextType {
  // Auth State
  user: any | null;
  appUser: AppUser | null;
  loading: boolean;
  needsRole: boolean;
  authLoading: boolean;
  authMode: 'login' | 'signup' | 'phone';
  setAuthMode: (mode: 'login' | 'signup' | 'phone') => void;
  pendingEmailVerification: string | null;
  setPendingEmailVerification: (email: string | null) => void;
  authEmail: string;
  setAuthEmail: (s: string) => void;
  authPhone: string;
  setAuthPhone: (s: string) => void;
  authName: string;
  setAuthName: (s: string) => void;
  authPassword: string;
  setAuthPassword: (s: string) => void;
  
  // Data State
  posts: Post[];
  jobs: Job[];
  allUsers: AppUser[];
  connections: AppConnection[];
  seenConnectionIds: Set<string>;
  setSeenConnectionIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  notifications: AppNotification[];
  readNotifIds: Set<string>;
  setReadNotifIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  readNotifTimestamps: Record<string, number>;
  messages: any[];
  readMessageIds: Set<string>;
  readChatSenders: Record<string, number>;
  unreadMessagesCount: number;
  pendingRequestsCount: number;
  unreadNotificationsCount: number;
  reports: any[];
  myGroups: any[];
  setMyGroups: React.Dispatch<React.SetStateAction<any[]>>;
  allGroups: any[];
  setAllGroups: React.Dispatch<React.SetStateAction<any[]>>;
  fetchGroups: () => Promise<void>;
  
  // UI State
  activeTab: string;
  setActiveTab: (tab: string) => void;
  platformSettings: PlatformPublicSettings;
  canUseMessaging: boolean;
  canUseSupportChat: boolean;
  canUseGroups: boolean;
  canUseNetwork: boolean;
  canUseAccountSwitch: boolean;
  canUseKhakiTheme: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedProfile: AppUser | null;
  setSelectedProfile: (user: AppUser | null) => void;
  isEditingProfile: boolean;
  setIsEditingProfile: (is: boolean) => void;
  toasts: { id: number, message: string, type: 'success' | 'error' | 'info' | 'warning' }[];
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
  showAdmin: boolean;
  setShowAdmin: (show: boolean) => void;
  selectedChat: AppUser | null;
  setSelectedChat: (user: AppUser | null) => void;
  selectedGroup: any | null;
  setSelectedGroup: (group: any | null) => void;
  isPublishingArticle: boolean;
  setIsPublishingArticle: (is: boolean) => void;
  // Theme State
  theme: 'light' | 'dark' | 'khaki';
  setTheme: (t: 'light' | 'dark' | 'khaki') => void;
  toggleTheme: () => void;
  isMockEnabled?: boolean;
  
  // Actions
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  handleGoogleLogin: () => Promise<void>;
  handleEmailLogin: (e: React.FormEvent) => Promise<void>;
  handleEmailSignUp: (e: React.FormEvent) => Promise<void>;
  handlePhoneAuth: (e: React.FormEvent) => Promise<void>;
  logout: () => Promise<void>;
  refreshData: (silent?: boolean, userId?: string) => Promise<void>;
  handleApplyJob: (job: Job, text: string, file: File | null) => Promise<void>;
  setAppUser: (user: AppUser | null | ((prev: AppUser | null) => AppUser | null)) => void;
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  setAllUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  selectRole: (role: 'seeker' | 'employer' | 'freelancer', extraData?: Record<string, any>) => Promise<void>;
  handleSyncSignal: (targetUser: AppUser) => Promise<void>;
  handleAcceptSync: (notif: AppNotification) => Promise<void>;
  handleAcceptConnection: (connId: string) => Promise<void>;
  handleRejectConnection: (connId: string) => Promise<void>;
  handleLike: (postId: string) => Promise<void>;
  handleDislike: (postId: string) => Promise<void>;
  likedPosts: Set<string>;
  dislikedPosts: Set<string>;
  handleAddComment: (postId: string, commentContent: string) => Promise<void>;
  handleEchoPost: (post: Post) => Promise<void>;
  handleDeletePost: (postId: string) => Promise<boolean>;
  handleDeleteJob: (jobId: string) => Promise<boolean>;
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  handleRelocateToUser: (targetUser: AppUser, post: Post) => Promise<void>;
  toggleProRank: () => Promise<void>;
  fetchMyGroups: () => Promise<void>;
  markConnectionAsSeen: (connId: string) => void;
  markMessageAsRead: (msgId: string) => Promise<void>;
  markChatMessagesAsRead: (senderId: string) => Promise<void>;
  markNotificationAsRead: (notifId: string) => Promise<void>;
  markJobApplicationNotificationsAsRead: () => Promise<void>;
  deleteReadNotifications: () => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  userTotalPostsCount: number;
  setUserTotalPostsCount: React.Dispatch<React.SetStateAction<number>>;
  // ── Guest Mode ──
  isGuestMode: boolean;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Maps raw Supabase profile row → AppUser shape used by the UI
export const mapProfile = (p: any): any => {
  // ✅ Admin status comes only from DB-backed fields (is_admin / role), never email matching
  const isTargetAdmin = Boolean(
    p.is_admin === true ||
    p.isAdmin === true ||
    p.role === 'admin' ||
    p.role === 'superadmin'
  );
  // ✅ is_active: treat NULL/undefined as active (default), only false = banned
  const isActive = p.is_active !== false;
  return {
    ...p,
    id: p.id,
    name: (p.name && p.name !== 'مستخدم' && p.name !== 'مستخدم محادثة')
      ? p.name
      : (p.full_name || p.display_name || p.raw_user_meta_data?.full_name || p.raw_user_meta_data?.name || p.user_metadata?.full_name || p.user_metadata?.name || (p.email ? p.email.split('@')[0] : '') || p.name || 'مستخدم'),
    email: p.email || '',
    title: p.title || p.job_title || p.headline || p.profession || '',
    job_title: p.title || p.job_title || p.headline || p.profession || '',
    avatar: p.avatar_url || p.avatar || p.photo_url || p.image_url || null,
    avatar_url: p.avatar_url || p.avatar || p.photo_url || p.image_url || null,
    role: p.role ?? '',  // لا تضع قيمة افتراضية — القيمة الفارغة مهمة لتحديد needsRole
    bio: p.bio || '',
    location: p.location || '',
    companyName: p.company_name || p.companyName || '',
    phone: p.phone || '',
    skills: p.skills || [],
    languages: p.languages || [],
    workExperiences: (Array.isArray(p.work_experiences) && p.work_experiences.length > 0)
      ? p.work_experiences
      : (Array.isArray(p.workExperiences) && p.workExperiences.length > 0)
        ? p.workExperiences
        : (Array.isArray(p.cv_data?.workExperiences) && p.cv_data.workExperiences.length > 0)
          ? p.cv_data.workExperiences
          : (Array.isArray(p.cv_data?.work_experiences) && p.cv_data.work_experiences.length > 0)
            ? p.cv_data.work_experiences
            : [],
    cv_data: p.cv_data || null,
    cvData: p.cv_data || null,
    experience: p.experience || '',
    education: p.education || '',
    isPro: p.is_pro || false,
    is_pro: p.is_pro || false,
    isAdmin: isTargetAdmin,
    is_admin: isTargetAdmin,
    isActive: isActive,
    is_active: p.is_active,
    hasErpAccess: isTargetAdmin, // ✅ ERP مخصص للأدمن فقط — صاحب العمل لا يملك صلاحية الدخول
    hasCallsAccess: isTargetAdmin, // ✅ المكالمات مخصصة للإدارة العليا فقط
    hasSupportAccess: isTargetAdmin || p.has_support_access === true,
    has_support_access: isTargetAdmin || p.has_support_access === true,
    coverUrl: p.cover_url || null,
    cvUrl: p.cv_url || null,
    cv_url: p.cv_url || null,
    // ✅ حالة التوفر للعمل — يجب تمريرها حتى لا تُعاد للـ 'none' عند الريفريش
    open_to: p.open_to || (p.is_available ? 'work' : 'none'),
    isAvailable: Boolean(p.is_available || p.open_to === 'work'),
    is_available: Boolean(p.is_available || p.open_to === 'work'),
    displayTitle: p.display_title || p.displayTitle || '',
    display_title: p.display_title || p.displayTitle || '',
    freelancerType: p.freelancer_type || p.freelancerType || null,
    freelancer_type: p.freelancer_type || p.freelancerType || null,
    specialty: p.specialty || '',
    homeAddress: p.home_address || p.homeAddress || '',
    home_address: p.home_address || p.homeAddress || '',
    serviceRequest: p.service_request || p.serviceRequest || '',
    service_request: p.service_request || p.serviceRequest || '',
    companyLogoUrl: p.company_logo_url || p.companyLogoUrl || null,
    company_logo_url: p.company_logo_url || p.companyLogoUrl || null,
    companyBio: p.company_bio || p.companyBio || '',
    company_bio: p.company_bio || p.companyBio || '',
  };
};

export const getDeletedPostIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem('prolink_deleted_posts');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
};

export const getDeletedJobIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem('prolink_deleted_jobs');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  
  const [appUser, setAppUserRaw] = useState<AppUser | null>(() => {
    try {
      const isGuest = localStorage.getItem('prolink_guest_mode') === 'true';
      if (isGuest) return null;
      const cached = localStorage.getItem('prolink_cached_user');
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      // ✅ Validate cache has required role — if role missing, discard so user gets fresh DB data
      if (!parsed?.role || !['seeker', 'employer', 'freelancer'].includes(parsed.role)) {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  });

  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('prolink_cached_user');
      if (!cached) return true;
      const parsed = JSON.parse(cached);
      // ✅ Show loading if cached user has no valid role (need to fetch from DB)
      return !parsed?.role || !['seeker', 'employer', 'freelancer'].includes(parsed.role);
    } catch (e) {
      return true;
    }
  });

  const setAppUser = (u: AppUser | null | ((prev: AppUser | null) => AppUser | null)) => {
    setAppUserRaw(prev => {
      const next = typeof u === 'function' ? u(prev) : u;
      try {
        if (next) {
          localStorage.setItem('prolink_cached_user', JSON.stringify(next));
        } else {
          localStorage.removeItem('prolink_cached_user');
        }
      } catch (e) {}
      if (next?.id) {
        setAllUsersRaw(users => users.map(usr => usr.id === next.id ? { ...usr, ...next } : usr));
      }
      return next;
    });
  };

  const [needsRole, setNeedsRole] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  // ── Guest Mode State ──
  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('prolink_guest_mode') === 'true';
    } catch {
      return false;
    }
  });
  const enterGuestMode = useCallback(() => {
    try {
      localStorage.setItem('prolink_guest_mode', 'true');
      localStorage.removeItem('prolink_cached_user');
    } catch {}
    setAppUserRaw(null);
    setIsGuestMode(true);
  }, []);
  const exitGuestMode  = useCallback(() => {
    try { localStorage.removeItem('prolink_guest_mode'); } catch {}
    setIsGuestMode(false);
  }, []);

  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'phone'>('login');
  const [pendingEmailVerification, setPendingEmailVerification] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  
  // ── Cache-First: load posts & jobs from localStorage instantly ──────────
  const [posts, setPosts] = useState<Post[]>(() => {
    try {
      const c = localStorage.getItem('prolink_cached_posts');
      const arr: Post[] = c ? JSON.parse(c) : [];
      const del: string[] = JSON.parse(localStorage.getItem('prolink_deleted_posts') || '[]');
      return del.length ? arr.filter(p => !del.includes(p.id)) : arr;
    } catch { return []; }
  });

  const [jobs, setJobs] = useState<Job[]>(() => {
    try {
      const c = localStorage.getItem('prolink_cached_jobs');
      const arr: Job[] = c ? JSON.parse(c) : [];
      const del: string[] = JSON.parse(localStorage.getItem('prolink_deleted_jobs') || '[]');
      return del.length ? arr.filter(j => !del.includes(j.id)) : arr;
    } catch { return []; }
  });

  // 📊 إجمالي عدد منشورات المستخدم الحقيقي من قاعدة البيانات
  const [userTotalPostsCount, setUserTotalPostsCount] = useState<number>(() => {
    try {
      const savedUid = localStorage.getItem('prolink_last_user_id') || '';
      return savedUid ? Number(localStorage.getItem(`prolink_user_post_count_${savedUid}`) || 0) : 0;
    } catch { return 0; }
  });

  const [allUsers, setAllUsersRaw] = useState<AppUser[]>(() => {
    try {
      const c = localStorage.getItem('prolink_cached_all_users');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });

  const setAllUsers = useCallback((updater: React.SetStateAction<AppUser[]>) => {
    setAllUsersRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem('prolink_cached_all_users', JSON.stringify(next.slice(0, 300))); } catch {}
      return next;
    });
  }, []);

  const [connections, setConnectionsRaw] = useState<AppConnection[]>(() => {
    try {
      const c = localStorage.getItem('prolink_cached_connections');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });

  const setConnections = useCallback((updater: React.SetStateAction<AppConnection[]>) => {
    setConnectionsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem('prolink_cached_connections', JSON.stringify(next.slice(0, 300))); } catch {}
      return next;
    });
  }, []);
  
  // ── Cache-First: persistent notifications & read states ──────────
  const [notifications, setNotificationsRaw] = useState<AppNotification[]>(() => {
    try {
      const c = localStorage.getItem('prolink_cached_notifications');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });

  const setNotifications = useCallback((updater: React.SetStateAction<AppNotification[]>) => {
    setNotificationsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem('prolink_cached_notifications', JSON.stringify(next.slice(0, 100))); } catch {}
      return next;
    });
  }, []);

  const [readNotifIds, setReadNotifIdsRaw] = useState<Set<string>>(() => {
    try {
      const c = localStorage.getItem('prolink_read_notif_ids');
      return c ? new Set(JSON.parse(c)) : new Set();
    } catch { return new Set(); }
  });

  const setReadNotifIds = useCallback((updater: React.SetStateAction<Set<string>>) => {
    setReadNotifIdsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem('prolink_read_notif_ids', JSON.stringify([...next].slice(0, 500))); } catch {}
      return next;
    });
  }, []);

  // ── Persistent Read Notification Timestamps (for 1-hour auto delete) ──
  const [readNotifTimestamps, setReadNotifTimestampsRaw] = useState<Record<string, number>>(() => {
    try {
      const c = localStorage.getItem('prolink_read_notif_timestamps');
      return c ? JSON.parse(c) : {};
    } catch { return {}; }
  });

  const setReadNotifTimestamps = useCallback((updater: React.SetStateAction<Record<string, number>>) => {
    setReadNotifTimestampsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem('prolink_read_notif_timestamps', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Auto-purge read notifications older than 1 hour (3600 seconds) ──
  useEffect(() => {
    const purgeExpired = () => {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      let hasExpired = false;
      const expiredIds: string[] = [];

      setNotifications(prev => {
        const remaining = prev.filter(n => {
          const readAt = readNotifTimestamps[n.id];
          if (readAt && (now - readAt) > oneHour) {
            hasExpired = true;
            expiredIds.push(n.id);
            return false;
          }
          return true;
        });
        return hasExpired ? remaining : prev;
      });

      if (expiredIds.length > 0) {
        supabase.from('notifications').delete().in('id', expiredIds).then(() => {});
      }
    };

    purgeExpired();
    const interval = setInterval(purgeExpired, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [readNotifTimestamps, setNotifications]);

  const [messages, setMessages] = useState<any[]>(() => {
    try {
      const c = localStorage.getItem('prolink_cached_messages');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });

  // Automatically persist messages cache
  useEffect(() => {
    try {
      localStorage.setItem('prolink_cached_messages', JSON.stringify(messages.slice(-200)));
    } catch {}
  }, [messages]);

  // ── Persistent Read Message IDs ─────────────────────────────────
  const [readMessageIds, setReadMessageIdsRaw] = useState<Set<string>>(() => {
    try {
      const c = localStorage.getItem('prolink_read_messages');
      return c ? new Set(JSON.parse(c)) : new Set();
    } catch { return new Set(); }
  });

  const setReadMessageIds = useCallback((updater: React.SetStateAction<Set<string>>) => {
    setReadMessageIdsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem('prolink_read_messages', JSON.stringify([...next].slice(0, 1000))); } catch {}
      return next;
    });
  }, []);

  // ── Persistent Read Chat Senders (Timestamps) ───────────────────
  const [readChatSenders, setReadChatSendersRaw] = useState<Record<string, number>>(() => {
    try {
      const c = localStorage.getItem('prolink_read_chat_senders');
      return c ? JSON.parse(c) : {};
    } catch { return {}; }
  });
  // Ref so markChatMessagesAsRead always reads the LATEST value (no stale closure)
  const readChatSendersRef = useRef<Record<string, number>>(readChatSenders);
  useEffect(() => { readChatSendersRef.current = readChatSenders; }, [readChatSenders]);

  const setReadChatSenders = useCallback((updater: React.SetStateAction<Record<string, number>>) => {
    setReadChatSendersRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      readChatSendersRef.current = next;
      try { localStorage.setItem('prolink_read_chat_senders', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Persistent Seen Connection Requests ─────────────────────────
  const [seenConnectionIds, setSeenConnectionIdsRaw] = useState<Set<string>>(() => {
    try {
      const c = localStorage.getItem('prolink_seen_connections');
      return c ? new Set(JSON.parse(c)) : new Set();
    } catch { return new Set(); }
  });

  const setSeenConnectionIds = useCallback((updater: React.SetStateAction<Set<string>>) => {
    setSeenConnectionIdsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem('prolink_seen_connections', JSON.stringify([...next].slice(0, 500))); } catch {}
      return next;
    });
  }, []);

  const markConnectionAsSeen = useCallback((connId: string) => {
    if (!connId) return;
    setSeenConnectionIds(prev => {
      if (prev.has(connId)) return prev;
      const next = new Set(prev);
      next.add(connId);
      return next;
    });
  }, [setSeenConnectionIds]);

  // ── Mock Data Integration (Client-Side only, 0 Supabase quota used) ──
  const [isMockEnabled, setIsMockEnabled] = useState(() => mockDataService.isEnabled());

  useEffect(() => {
    // 🌐 Sync global mock data setting from platform_settings so it opens for everyone
    mockDataService.syncFromPlatform();
    return mockDataService.onStateChange((enabled) => {
      setIsMockEnabled(enabled);
    });
  }, []);

  // ── Public platform settings: support contacts + global messaging gate ──
  const [platformSettings, setPlatformSettings] = useState<PlatformPublicSettings>(() => platformSettingsService.getCached());

  useEffect(() => {
    let cancelled = false;
    const apply = (s: PlatformPublicSettings) => { if (!cancelled) setPlatformSettings(s); };
    platformSettingsService.fetch().then(apply);
    const onChanged = (e: Event) => {
      const d = (e as CustomEvent<PlatformPublicSettings>).detail;
      if (d) apply(d);
    };
    window.addEventListener('prolink_platform_settings_changed', onChanged);
    const channel = supabase
      .channel('platform-public-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_settings' }, () => {
        platformSettingsService.fetch().then(apply);
      })
      .subscribe();
    return () => {
      cancelled = true;
      window.removeEventListener('prolink_platform_settings_changed', onChanged);
      supabase.removeChannel(channel);
    };
  }, []);

  // 🔒 Admin-only features until an admin opens them for everyone
  const isAdminUser = isUserAdmin(appUser);
  const canUseMessaging = Boolean(isAdminUser || platformSettings.messagingEnabled);
  const canUseSupportChat = Boolean(isAdminUser || platformSettings.supportChatEnabled);
  const canUseGroups = Boolean(isAdminUser || platformSettings.groupsEnabled);
  const canUseNetwork = Boolean(isAdminUser || platformSettings.networkEnabled);
  const canUseAccountSwitch = Boolean(isAdminUser || platformSettings.accountSwitchEnabled);
  const canUseKhakiTheme = Boolean(isAdminUser || platformSettings.khakiThemeEnabled);

  const mockBundle = React.useMemo(() => {
    if (!isMockEnabled) return null;
    return mockDataService.getBundle(appUser?.id || user?.id || 'me');
  }, [isMockEnabled, appUser?.id, user?.id]);

  const effectivePosts = React.useMemo(() => {
    const delSet = getDeletedPostIds();
    const base = posts.filter(p => !delSet.has(p.id));
    if (!isMockEnabled || !mockBundle) return base;
    const realIds = new Set(base.map(p => p.id));
    return [...base, ...mockBundle.posts.filter(p => !realIds.has(p.id) && !delSet.has(p.id))];
  }, [posts, isMockEnabled, mockBundle]);

  const effectiveJobs = React.useMemo(() => {
    const delSet = getDeletedJobIds();
    const base = jobs.filter(j => !delSet.has(j.id));
    if (!isMockEnabled || !mockBundle) return base;
    const realIds = new Set(base.map(j => j.id));
    return [...base, ...mockBundle.jobs.filter(j => !realIds.has(j.id) && !delSet.has(j.id))];
  }, [jobs, isMockEnabled, mockBundle]);

  const effectiveAllUsers = React.useMemo(() => {
    // 🛡️ تصفية ومنع تكرار المستخدمين (deduplication) بحسب الهاتف والمعرّف لمنع ظهور نسخ مكررة لنفس الشخص
    const dedupedUsers: AppUser[] = [];
    const seenPhones = new Set<string>();
    const seenIds = new Set<string>();

    for (const u of allUsers) {
      if (seenIds.has(u.id)) continue;
      seenIds.add(u.id);

      const normPhone = (u.phone || '').replace(/\D/g, '');
      if (normPhone && normPhone.length >= 10) {
        if (seenPhones.has(normPhone)) {
          // إذا كان المستخدم الحالي يطابق هذا الحساب، احتفظ بنسخته
          if (appUser?.id === u.id) {
            const idx = dedupedUsers.findIndex(x => (x.phone || '').replace(/\D/g, '') === normPhone);
            if (idx !== -1) dedupedUsers[idx] = u;
          }
          continue;
        }
        seenPhones.add(normPhone);
      }
      dedupedUsers.push(u);
    }

    if (!isMockEnabled || !mockBundle) return dedupedUsers;
    const realIds = new Set(dedupedUsers.map(u => u.id));
    return [...dedupedUsers, ...mockBundle.users.filter(u => !realIds.has(u.id))];
  }, [allUsers, isMockEnabled, mockBundle, appUser?.id]);

  const effectiveMessages = React.useMemo(() => {
    if (!isMockEnabled || !mockBundle) return messages;
    const realIds = new Set(messages.map(m => m.id));
    return [...messages, ...mockBundle.messages.filter(m => !realIds.has(m.id))];
  }, [messages, isMockEnabled, mockBundle]);

  const markMessageAsRead = useCallback(async (msgId: string) => {
    if (!msgId) return;
    setReadMessageIds(prev => {
      if (prev.has(msgId)) return prev;
      const next = new Set(prev);
      next.add(msgId);
      return next;
    });
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, read: true } : m));
    try {
      await supabase.from('messages').update({ read: true }).eq('id', msgId);
    } catch (err) {
      console.warn('markMessageAsRead DB error:', err);
    }
  }, [setReadMessageIds, setMessages]);

  const markChatMessagesAsRead = useCallback(async (senderId: string) => {
    if (!user?.id || !senderId) return;
    const now = Date.now();
    const targetSenderId = String(senderId).toLowerCase().trim();
    const myId = String(user.id).toLowerCase().trim();

    // 1. Persist timestamp in readChatSenders (both raw and normalized keys)
    setReadChatSenders(prev => ({ ...prev, [senderId]: now, [targetSenderId]: now }));

    // 2. Update local messages state
    const readIds: string[] = [];
    setMessages(prev => {
      let hasChanges = false;
      const next = prev.map(m => {
        const sId = String(m.senderId || m.sender_id || '').toLowerCase().trim();
        const rId = String(m.receiverId || m.receiver_id || '').toLowerCase().trim();
        if (sId === targetSenderId && rId === myId && !m.read) {
          hasChanges = true;
          if (m.id && !String(m.id).startsWith('temp-')) readIds.push(m.id);
          return { ...m, read: true };
        }
        return m;
      });
      return hasChanges ? next : prev;
    });

    // 3. Persist read IDs in local storage
    if (readIds.length > 0) {
      setReadMessageIds(prev => {
        const next = new Set(prev);
        readIds.forEach(id => next.add(id));
        return next;
      });
    }

    // 4. Mark notifications for this sender as read
    setNotifications(prev => prev.map(n => {
      const fromId = String(n.fromId || (n as any).from_user_id || (n as any).fromUserId || '').toLowerCase().trim();
      return (n.type === 'message' && fromId === targetSenderId) ? { ...n, read: true } : n;
    }));

    // 5. ✅ Update Supabase DB directly
    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('receiver_id', user.id)
        .eq('sender_id', senderId);

      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('type', 'message')
        .eq('from_id', senderId);
    } catch (err) {
      console.warn('markChatMessagesAsRead DB error:', err);
    }
  }, [user?.id, setReadChatSenders, setMessages, setReadMessageIds, setNotifications]);

  const markNotificationAsRead = useCallback(async (notifId: string) => {
    if (!notifId) return;
    const now = Date.now();
    setReadNotifTimestamps(prev => ({ ...prev, [notifId]: now }));
    setReadNotifIds(prev => {
      if (prev.has(notifId)) return prev;
      const next = new Set(prev);
      next.add(notifId);
      return next;
    });
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', notifId);
    } catch (err) {
      console.warn('markNotificationAsRead DB error:', err);
    }
  }, [setReadNotifIds, setNotifications, setReadNotifTimestamps]);

  const markJobApplicationNotificationsAsRead = useCallback(async () => {
    const unreadJobNotifs = notifications.filter(n => n.type === 'job_application' && !n.read && !readNotifIds.has(n.id));
    if (unreadJobNotifs.length === 0) return;
    const ids = unreadJobNotifs.map(n => n.id);
    const now = Date.now();
    setReadNotifTimestamps(prev => {
      const next = { ...prev };
      ids.forEach(id => { next[id] = now; });
      return next;
    });
    setReadNotifIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n));
    try {
      await supabase.from('notifications').update({ read: true }).in('id', ids);
    } catch (_) {}
  }, [notifications, readNotifIds, setNotifications, setReadNotifIds, setReadNotifTimestamps]);

  const deleteReadNotifications = useCallback(async () => {
    if (!user?.id) return;
    const readIds = notifications
      .filter(n => n.read || readNotifIds.has(n.id))
      .map(n => n.id);

    if (readIds.length === 0) return;

    setNotifications(prev => prev.filter(n => !n.read && !readNotifIds.has(n.id)));
    try {
      await supabase.from('notifications').delete().in('id', readIds);
    } catch (err) {
      console.warn('deleteReadNotifications error:', err);
    }
  }, [user?.id, notifications, readNotifIds, setNotifications]);

  const deleteAllNotifications = useCallback(async () => {
    if (!user?.id) return;
    const allIds = notifications.map(n => n.id);
    setNotifications([]);
    setReadNotifIds(new Set());
    try {
      if (allIds.length > 0) {
        await supabase.from('notifications').delete().in('id', allIds);
      }
    } catch (err) {
      console.warn('deleteAllNotifications error:', err);
    }
  }, [user?.id, notifications, setNotifications, setReadNotifIds]);

  // ── Accurate Live Unread Counters ───────────────────────────────
  const unreadMessagesCount = React.useMemo(() => {
    if (!user?.id || !canUseMessaging) return 0;
    const myId = String(user.id).toLowerCase().trim();
    return messages.filter(m => {
      const receiver = String(m.receiverId || m.receiver_id || '').toLowerCase().trim();
      const sender = String(m.senderId || m.sender_id || '').toLowerCase().trim();
      const rawSender = m.senderId || m.sender_id;
      if (receiver !== myId) return false;
      if (m.read === true) return false;
      if (readMessageIds.has(m.id)) return false;
      const lastReadAt = readChatSenders[sender] || (rawSender ? readChatSenders[rawSender] : undefined);
      if (lastReadAt) {
        const msgTime = new Date(m.created_at || (m.timestamp?.toDate ? m.timestamp.toDate() : 0)).getTime();
        if (msgTime <= lastReadAt) return false;
      }
      return true;
    }).length;
  }, [messages, user?.id, readMessageIds, readChatSenders, canUseMessaging]);

  const pendingRequestsCount = React.useMemo(() => {
    if (!user?.id) return 0;
    return connections.filter(c => c.status === 'pending' && c.recipientId === user.id && !seenConnectionIds.has(c.id)).length;
  }, [connections, user?.id, seenConnectionIds]);

  const unreadNotificationsCount = React.useMemo(() => {
    return notifications.filter(n => !n.read && !readNotifIds.has(n.id)).length;
  }, [notifications, readNotifIds]);
  const [reports, setReports] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [allGroups, setAllGroups] = useState<any[]>([]);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setAllGroups(data);
    } catch (e) {
      console.error('Error fetching all groups:', e);
    }
  };

  // ── Persist active tab: default to news upon app start/open ──────────
  const [activeTab, setActiveTabRaw] = useState<string>(() => {
    try { return localStorage.getItem('prolink_active_tab') || 'news'; } catch { return 'news'; }
  });
  const featureGateRef = useRef<{ gates: Record<string, boolean>; notify: (m: string) => void }>({ gates: {}, notify: (_m: string) => {} });
  const setActiveTab = useCallback((tab: string) => {
    const gateMessages: Record<string, string> = {
      messages: '🔒 الرسائل مقفلة حالياً ومتاحة للإدارة فقط. للتواصل مع الدعم استخدم واتساب أو تلكرام من صفحة "حول المنصة".',
      network: '🔒 شبكتي المهنية مقفلة حالياً ومتاحة للإدارة فقط، وسيتم فتحها للجميع قريباً.',
      groups: '🔒 المجموعات المهنية مقفلة حالياً ومتاحة للإدارة فقط، وسيتم فتحها للجميع قريباً.',
    };
    if (gateMessages[tab] && featureGateRef.current.gates[tab] === false) {
      featureGateRef.current.notify(gateMessages[tab]);
      return;
    }
    try { localStorage.setItem('prolink_active_tab', tab); } catch {}
    setActiveTabRaw(tab);
  }, []);
  const [_searchQuery, _setSearchQuery] = useState('');
  const searchQuery = _searchQuery;
  // Wrap setter so every search query is sanitised before storing
  const setSearchQuery = useCallback((q: string) => _setSearchQuery(sanitizeInput(q)), []);
  const [selectedProfile, setSelectedProfile] = useState<AppUser | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [toasts, setToasts] = useState<{ id: number, message: string, type: 'success' | 'error' | 'info' | 'warning' }[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedChat, setSelectedChat] = useState<AppUser | null>(() => {
    try {
      const saved = sessionStorage.getItem('prolink_selected_chat');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const selectedChatRef = useRef<AppUser | null>(selectedChat);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
    try {
      if (selectedChat) {
        sessionStorage.setItem('prolink_selected_chat', JSON.stringify(selectedChat));
      } else {
        sessionStorage.removeItem('prolink_selected_chat');
      }
    } catch {}
  }, [selectedChat]);

  // Keep selectedChat synchronized with fresh profile data so real name is never lost on refresh
  useEffect(() => {
    if (selectedChat?.id && allUsers.length > 0) {
      const fresh = allUsers.find(u => String(u.id).toLowerCase() === String(selectedChat.id).toLowerCase());
      if (fresh && fresh.name && fresh.name !== 'مستخدم' && fresh.name !== 'مستخدم محادثة') {
        if (selectedChat.name !== fresh.name || selectedChat.avatar !== fresh.avatar) {
          setSelectedChat(fresh);
        }
      }
    }
  }, [allUsers, selectedChat?.id]);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [isPublishingArticle, setIsPublishingArticle] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark' | 'khaki'>(() => {
    const saved = localStorage.getItem('prolink_theme');
    if (saved === 'dark' || saved === 'light' || saved === 'khaki') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('prolink_theme', theme);
    // Remove all theme classes first
    document.documentElement.classList.remove('light', 'dark', 'khaki', 'milky', 'pink');
    // Add the current one
    document.documentElement.classList.add(theme);
  }, [theme]);

  // 🔒 الثيم الكاكي حصري للأدمن (أو عند فتحه من الإعدادات) — يُعاد للفاتح إذا أُقفل
  useEffect(() => {
    if (theme === 'khaki' && !canUseKhakiTheme) setTheme('light');
  }, [theme, canUseKhakiTheme]);

  const toggleTheme = (e?: any) => {
    const x = e && typeof e.clientX === 'number' && e.clientX > 0 ? e.clientX : (typeof window !== 'undefined' ? window.innerWidth / 2 : 200);
    const y = e && typeof e.clientY === 'number' && e.clientY > 0 ? e.clientY : 40;
    revealTheme(x, y, () => {
      setTheme(prev => {
        if (prev === 'light') return 'dark';
        if (prev === 'dark') return canUseKhakiTheme ? 'khaki' : 'light';
        return 'light';
      });
    });
  };

  const isFetchingAllData = useRef(false);
  const activeChannelsRef = useRef<any[]>([]);
  const msgsChannelRetryRef = useRef<number>(0); // tracks retry count for exponential backoff
  // ── Smart Refresh: track last successful fetch time ───────────────────────
  const lastFetchedAt = useRef<number>(
    (() => { try { return Number(localStorage.getItem('prolink_last_fetch') || 0); } catch { return 0; } })()
  );
  const MIN_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  featureGateRef.current = {
    gates: { messages: canUseMessaging, network: canUseNetwork, groups: canUseGroups },
    notify: (m: string) => addToast(m, 'info'),
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await authService.googleLogin();
      if (error) throw error;
    } catch (e: any) {
      addToast("خطأ في تسجيل الدخول: " + e.message, "error");
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      addToast('يرجى إدخال البريد وكلمة السر', 'error');
      return;
    }
    setAuthLoading(true);
    try {
      await authService.emailLogin(authEmail, authPassword);
      // onAuthStateChange سيتولى تحديث appUser تلقائياً
      addToast('أهلاً بك في المجرة المهنية! 🌌');
    } catch (e: any) {
      addToast(e.message || 'فشل الدخول', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      addToast('يرجى إدخال البريد وكلمة السر', 'error');
      return;
    }
    setAuthLoading(true);
    try {
      const result = await authService.emailSignUp(authEmail, authPassword, authName);
      if (result.error) throw result.error;

      if (result.requiresEmailConfirmation) {
        // ✅ حالة طبيعية مع تأكيد البريد:
        // عرض شاشة "تحقق من بريدك" بدلاً من العودة المباشرة للوجين
        setPendingEmailVerification(authEmail);
        // نظّف الحقول
        setAuthEmail('');
        setAuthPassword('');
        setAuthName('');
      } else {
        // تسجيل مباشر (email confirmation معطّل) — نادر
        addToast('تم إنشاء الحساب وتسجيل الدخول بنجاح! 🎉');
      }
    } catch (e: any) {
      addToast(e.message || 'فشل التسجيل', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePhoneAuth = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!authPhone || !authPassword) {
      addToast('يرجى إدخال رقم الهاتف وكلمة السر', 'error');
      return;
    }

    setAuthLoading(true);
    try {
      const result = await authService.phoneAuth(authPhone, authPassword, authName || undefined);
      if (result.error) throw result.error;

      if (result.isNewUser) {
        addToast('تم إنشاء حساب الهاتف بنجاح! 🎉 اختر دورك للمتابعة.');
      } else {
        addToast('تم تسجيل الدخول بنجاح! 🚀');
      }
      // onAuthStateChange سيتولى تحديث appUser تلقائياً
    } catch (e: any) {
      addToast(e.message || 'يرجى التأكد من البيانات', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    // 1. Immediate UI & state clearing for instant feedback
    setUser(null);
    setAppUser(null);
    setPosts([]);
    setJobs([]);
    setAllUsers([]);
    setMessages([]);
    setNotifications([]);
    setNeedsRole(false);
    setAuthMode('login');

    // حفظ الثيم قبل المسح ثم استعادته
    let savedTheme: string | null = null;
    try { savedTheme = localStorage.getItem('prolink_theme'); } catch (_) {}
    try {
      localStorage.clear();
      sessionStorage.clear();
      if (savedTheme) localStorage.setItem('prolink_theme', savedTheme);
    } catch (e) {}
    addToast('تم تسجيل الخروج بنجاح 👋', 'success');

    // 2. Perform Supabase sign out in background
    try {
      await authService.logout();
    } catch (err) {
      console.warn("Supabase signout handled:", err);
    }
  };

  const selectRole = async (role: 'seeker' | 'employer' | 'freelancer', extraData?: Record<string, any>) => {
    if (!user) return;
    try {
      const mergedUserData = {
        ...(user.user_metadata as Record<string, unknown>),
        ...(extraData || {})
      };
      const { error } = await authService.selectRole(user.id, role, mergedUserData);
      if (error) throw error;

      // ✅ أعِد تحميل الـ profile من قاعدة البيانات للتأكد من التحديث
      const { data: profile } = await authService.getProfile(user.id);
      if (profile) {
        setAppUser(mapProfile(profile));
      }

      // ✅ الآن نُعيِّن needsRole=false فقط بعد التحقق من وجود profile محدَّث
      setNeedsRole(false);
      const roleName = role === 'seeker' ? 'باحث عن عمل' : role === 'employer' ? 'صاحب عمل' : 'عمل حر / كشفي';
      addToast(`✅ تم تفعيل حسابك كـ ${roleName}! مرحباً بك.`);

      // ✅ إعادة تحميل البيانات لتحديث عداد المنشورات والإحصائيات فوراً
      setTimeout(() => fetchAllData(true, user.id), 300);
    } catch (e: any) {
      addToast("خطأ في حفظ البيانات: " + e.message, "error");
    }
  };

  // 🔄 Immediate role refresh without a page reload (fallback when realtime is disconnected)
  useEffect(() => {
    const onRoleUpdated = async () => {
      const uid = user?.id;
      if (!uid) return;
      try {
        const { data: profile } = await profileService.getProfileById(uid);
        if (profile) {
          setAppUser(mapProfile(profile));
          fetchAllData(true, uid, true);
        }
      } catch {}
    };
    window.addEventListener('prolink_role_updated', onRoleUpdated);
    return () => window.removeEventListener('prolink_role_updated', onRoleUpdated);
  }, [user?.id]);

  const fetchAllData = async (silent = false, explicitUserId?: string, force = false) => {
    if (isFetchingAllData.current) {
      if (!force) return;
      const waitStart = Date.now();
      while (isFetchingAllData.current && Date.now() - waitStart < 5000) {
        await new Promise(r => setTimeout(r, 150));
      }
      if (isFetchingAllData.current) return;
    }
    const effectiveUserId = explicitUserId || user?.id;
    isFetchingAllData.current = true;

    // 🔁 التحديث القسري (بعد أي حفظ/حذف) يجب أن يتجاوز كاش القراءة حتى تظهر التغييرات فوراً بدون رفرش
    if (force) postService.invalidateCache();

    // Temporarily expose effectiveUserId as local for queries that need it
    const uid = effectiveUserId;

    if (!silent) console.log('[AppContext] Starting data fetch...');
    try {
      const postsRes = await postService.fetchPosts() as any;
      if (postsRes.data) {
        const mapped = (postsRes.data as any[]).map(p => ({
          ...p,
          authorName: p.author_name,
          authorAvatar: p.author_avatar,
          authorId: p.author_id,
          authorTitle: p.author_title || '',
          likesCount: p.likes_count || 0,
          dislikesCount: p.dislikes_count || 0,
          created_at: p.created_at,
          timestamp: { toDate: () => new Date(p.created_at) },
          imageUrl: p.image_url,
          videoUrl: p.video_url || null,
          is_pro_post: p.author_name?.includes('Pro') || false,
          isEcho: p.is_echo || false,
          originalPostId: p.original_post_id || null,
          originalAuthorName: p.original_author_name || null,
          originalAuthorAvatar: p.original_author_avatar || null,
          originalContent: p.original_content || null,
        }));

        // 🧠 Smart Algorithm Sorting
        const sorted = [...mapped].sort((a, b) => {
          const now = Date.now();
          const ageA = (now - new Date(a.created_at).getTime()) / 3600000;
          const ageB = (now - new Date(b.created_at).getTime()) / 3600000;
          const scoreA = (a.likesCount * 2) + (a.is_pro_post ? 10 : 0) - (ageA * 0.5);
          const scoreB = (b.likesCount * 2) + (b.is_pro_post ? 10 : 0) - (ageB * 0.5);
          return scoreB - scoreA;
        });

        const delPostIds = getDeletedPostIds();
        let filteredPosts = (sorted as any[]).filter(p => !delPostIds.has(p.id));

        // ⏱️ Post Expiration Filter (Admin Controlled):
        // If postExpiryDays > 0 and postExpiryActivatedAt is set, posts created AFTER
        // the activation timestamp that exceed the expiry threshold are hidden from public feed.
        // Posts created BEFORE the activation timestamp remain visible to all.
        const expiryDays = platformSettings?.postExpiryDays || 0;
        const activatedAt = platformSettings?.postExpiryActivatedAt;
        if (expiryDays > 0 && activatedAt) {
          const activatedMs = new Date(activatedAt).getTime();
          const maxAgeMs = expiryDays * 24 * 60 * 60 * 1000;
          const currentTime = Date.now();
          filteredPosts = filteredPosts.filter(p => {
            const pTime = new Date(p.created_at || p.timestamp?.toDate?.() || p.timestamp).getTime();
            if (isNaN(pTime)) return true;
            if (pTime < activatedMs) return true; // Created before activation -> KEEP
            return (currentTime - pTime) <= maxAgeMs;
          });
        }

        setPosts(filteredPosts as any);
        // ✅ Cache posts in localStorage for instant load next time
        try { localStorage.setItem('prolink_cached_posts', JSON.stringify(filteredPosts.slice(0, 60))); } catch {}
      }

      // 📊 جلب دقيق ومباشر لعدد منشورات المستخدم الحالي من قاعدة البيانات
      if (effectiveUserId) {
        try {
          const { count: exactCount } = await (supabase.from('posts') as any)
            .select('id', { count: 'exact', head: true })
            .eq('author_id', effectiveUserId);
          if (exactCount !== null && exactCount !== undefined) {
            setUserTotalPostsCount(exactCount);
            try {
              localStorage.setItem('prolink_last_user_id', effectiveUserId);
              localStorage.setItem(`prolink_user_post_count_${effectiveUserId}`, String(exactCount));
            } catch {}
          }
        } catch (e) {
          console.warn('[AppContext] Failed to fetch exact posts count:', e);
        }
      }

      const jobsRes = await jobService.fetchJobs() as any;
      if (jobsRes.data) {
        const mappedJobs = (jobsRes.data as any[]).map(j => ({
          ...j,
          jobType: j.job_type || j.jobType || 'دوام كامل',
          category: getJobCategory(j),
          working_hours: j.working_hours || j.workingHours || '',
          workingHours: j.working_hours || j.workingHours || '',
          employerName: j.company,
          postedAt: { toDate: () => new Date(j.created_at) }
        }));
        const delJobIds = getDeletedJobIds();
        const filteredJobs = (mappedJobs as any[]).filter(j => !delJobIds.has(j.id));
        setJobs(filteredJobs as any);
        // ✅ Cache jobs in localStorage for instant load next time
        try { localStorage.setItem('prolink_cached_jobs', JSON.stringify(filteredJobs.slice(0, 60))); } catch {}
      }

      if (uid) {
        // 🚀 Parallel resilient data fetch for authenticated user
        const [profilesRes, connsRes, notifsRes, msgsRes] = await Promise.allSettled([
          profileService.fetchProfiles(),
          networkService.fetchConnections(uid),
          networkService.fetchNotifications(uid),
          supabase.from('messages')
            .select('*')
            .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
            .order('created_at', { ascending: false })
            .limit(300)
        ]);

        if (profilesRes.status === 'fulfilled' && profilesRes.value?.data) {
          setAllUsers((profilesRes.value.data as any[]).map(mapProfile));
        }

        if (connsRes.status === 'fulfilled' && connsRes.value?.data) {
          setConnections((connsRes.value.data as any[]).map(c => ({
            id: c.id,
            requesterId: c.requester_id,
            recipientId: c.recipient_id,
            status: c.status,
            timestamp: { toDate: () => new Date(c.created_at) }
          } as any)));
        }

        if (notifsRes.status === 'fulfilled' && notifsRes.value?.data) {
          const readNotifSet = (() => {
            try {
              const c = localStorage.getItem('prolink_read_notif_ids');
              return c ? new Set(JSON.parse(c)) : new Set();
            } catch { return new Set(); }
          })();

          const notifTimestamps = (() => {
            try {
              const c = localStorage.getItem('prolink_read_notif_timestamps');
              return c ? JSON.parse(c) : {};
            } catch { return {}; }
          })();

          const now = Date.now();
          const oneHour = 60 * 60 * 1000;

          const mapped = (notifsRes.value.data as any[])
            .map(n => ({
              id: n.id,
              userId: n.user_id,
              type: n.type,
              fromId: n.from_id,
              fromName: n.from_name,
              fromAvatar: n.from_avatar,
              targetId: n.target_id,
              read: n.read || readNotifSet.has(n.id),
              message: n.message,
              timestamp: { toDate: () => new Date(n.created_at) }
            }))
            .filter(n => {
              const readAt = notifTimestamps[n.id];
              if (readAt && (now - readAt) > oneHour) return false;
              return true;
            });

          setNotifications(mapped as any);
        }

        if (msgsRes.status === 'fulfilled') {
          if (msgsRes.value?.error) {
            console.error('[AppContext] Messages fetch error from Supabase:', msgsRes.value.error);
          } else if (msgsRes.value?.data) {
            const rawMsgs = msgsRes.value.data as any[];
            console.log('[AppContext] Loaded messages from DB count:', rawMsgs.length);

            const readMsgSet = (() => {
              try {
                const c = localStorage.getItem('prolink_read_messages');
                return c ? new Set(JSON.parse(c)) : new Set();
              } catch { return new Set(); }
            })();

            const chatSenders = (() => {
              try {
                const c = localStorage.getItem('prolink_read_chat_senders');
                return c ? JSON.parse(c) : {};
              } catch { return {}; }
            })();

            const sortedMsgs = [...rawMsgs].reverse();

            setMessages(sortedMsgs.map(m => {
              const lastReadAt = chatSenders[m.sender_id];
              const msgTime = new Date(m.created_at).getTime();
              const isRead = m.read === true || readMsgSet.has(m.id) || (lastReadAt && msgTime <= lastReadAt);

              return {
                ...m,
                senderId: m.sender_id,
                receiverId: m.receiver_id,
                read: isRead,
                timestamp: { toDate: () => new Date(m.created_at) }
              };
            }));
          }
        }

        fetchMyGroups();
      } else {
        // 🌐 Guest Mode: fetch public profiles only
        try {
          const profilesRes = await profileService.fetchProfiles();
          if (profilesRes?.data) {
            setAllUsers((profilesRes.data as any[]).map(mapProfile));
          }
        } catch (e) {
          console.warn('[AppContext] Guest fetchProfiles error:', e);
        }
        setConnections([]);
        setNotifications([]);
        setMessages([]);
      }

      // ✅ Record the last successful fetch time
      const now = Date.now();
      lastFetchedAt.current = now;
      try { localStorage.setItem('prolink_last_fetch', String(now)); } catch {}

    } catch (e) {
      console.error('[AppContext] Global fetch error:', e);
    } finally {
      // ✅ Release lock immediately — no setTimeout to avoid stuck locks
      isFetchingAllData.current = false;
    }
  };

  // ─── Guest Mode Auto-fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (isGuestMode && !user) {
      fetchAllData(true);
    }
  }, [isGuestMode, user]);

  const [likedPosts, setLikedPosts] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('prolink_liked_posts');
      if (saved) return new Set(JSON.parse(saved));
    } catch (_) {}
    return new Set();
  });

  useEffect(() => {
    try {
      localStorage.setItem('prolink_liked_posts', JSON.stringify(Array.from(likedPosts)));
    } catch (_) {}
  }, [likedPosts]);

  const [dislikedPosts, setDislikedPosts] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('prolink_disliked_posts');
      if (saved) return new Set(JSON.parse(saved));
    } catch (_) {}
    return new Set();
  });

  useEffect(() => {
    try {
      localStorage.setItem('prolink_disliked_posts', JSON.stringify(Array.from(dislikedPosts)));
    } catch (_) {}
  }, [dislikedPosts]);

  const handleLike = async (postId: string) => {
    if (!appUser) return;

    // 🚫 الباحث عن عمل لا يملك صلاحية التفاعل
    if (!canUserPostAndInteract(appUser)) {
      addToast("التفاعل مع المنشورات مخصص لأصحاب العمل فقط 🔒", "error");
      return;
    }

    const post = (isMockEnabled ? effectivePosts : posts).find(p => p.id === postId);
    if (!post) return;

    if (postId.startsWith('mock-')) {
      const isLiked = likedPosts.has(postId);
      const currentCount = typeof post.likesCount === 'number' ? post.likesCount : 0;
      const newCount = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likesCount: newCount } : p));
      setLikedPosts(prev => {
        const next = new Set(prev);
        if (isLiked) next.delete(postId);
        else next.add(postId);
        return next;
      });
      return;
    }

    // Prevent self-like
    if (post.authorId === appUser.id) {
      addToast("لا يمكنك الإعجاب بتوجيهك الخاص 🚫", "error");
      return;
    }

    const isLiked = likedPosts.has(postId);
    const currentCount = typeof post.likesCount === 'number' ? post.likesCount : 0;
    const newCount = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;

    // Optimistic Update
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likesCount: newCount } : p));
    setLikedPosts(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });

    try {
      const { error } = await (supabase.from('posts') as any).update({ likes_count: newCount }).eq('id', postId);
      if (error) throw error;
      if (!isLiked) {
        addToast("تم تأكيد الإشارة 👍");
      } else {
        addToast("تم إلغاء الإشارة");
      }
    } catch (e) {
      // Rollback
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likesCount: currentCount } : p));
      setLikedPosts(prev => {
        const next = new Set(prev);
        if (isLiked) next.add(postId);
        else next.delete(postId);
        return next;
      });
      addToast("فشل تحديث الإعجاب", "error");
    }
  };

  const handleDislike = async (postId: string) => {
    if (!appUser) return;

    // 🚫 الباحث عن عمل لا يملك صلاحية التفاعل
    if (!canUserPostAndInteract(appUser)) {
      addToast("التفاعل مع المنشورات مخصص لأصحاب العمل فقط 🔒", "error");
      return;
    }

    const post = (isMockEnabled ? effectivePosts : posts).find(p => p.id === postId);
    if (!post) return;

    if (postId.startsWith('mock-')) {
      const isDisliked = dislikedPosts.has(postId);
      const currentCount = typeof post.dislikesCount === 'number' ? post.dislikesCount : 0;
      const newCount = isDisliked ? Math.max(0, currentCount - 1) : currentCount + 1;
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, dislikesCount: newCount } : p));
      setDislikedPosts(prev => {
        const next = new Set(prev);
        if (isDisliked) next.delete(postId);
        else next.add(postId);
        return next;
      });
      return;
    }

    if (post.authorId === appUser.id) {
      addToast("لا يمكنك تقييم منشورك الخاص 🚫", "error");
      return;
    }

    const isDisliked = dislikedPosts.has(postId);
    const currentCount = typeof post.dislikesCount === 'number' ? post.dislikesCount : 0;
    const newCount = isDisliked ? Math.max(0, currentCount - 1) : currentCount + 1;

    // Optimistic Update
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, dislikesCount: newCount } : p));
    setDislikedPosts(prev => {
      const next = new Set(prev);
      if (isDisliked) next.delete(postId);
      else next.add(postId);
      return next;
    });

    try {
      const { error } = await (supabase.from('posts') as any).update({ dislikes_count: newCount }).eq('id', postId);
      if (error) throw error;
    } catch (e) {
      // Rollback
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, dislikesCount: currentCount } : p));
      setDislikedPosts(prev => {
        const next = new Set(prev);
        if (isDisliked) next.add(postId);
        else next.delete(postId);
        return next;
      });
      addToast("فشل تحديث التقييم", "error");
    }
  };

  const handleAddComment = async (postId: string, content: string) => {
    if (!appUser) return;

    // 🚫 الباحث عن عمل لا يملك صلاحية التعليق
    if (!canUserPostAndInteract(appUser)) {
      addToast("التعليق والتفاعل مخصص لأصحاب العمل فقط 🔒", "error");
      return;
    }

    // 🚫 Block banned users from commenting
    if (appUser.isActive === false) {
      addToast("حسابك محظور ولا يمكنك التعليق 🚫", "error");
      return;
    }
    if (postId.startsWith('mock-')) {
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        commentsCount: (p.commentsCount || 0) + 1
      } : p));
      addToast("تمت إضافة التعليق ✅");
      return;
    }
    try {
      const { error } = await postService.addComment(postId, appUser, content);
      if (error) throw error;
      addToast("تمت إضافة التعليق ✅");
    } catch (e) { addToast("خطأ في إضافة التعليق", "error"); }
  };

  const handleSyncSignal = async (targetUser: AppUser) => {
    if (!appUser || isGuestMode) {
      addToast('يجب تسجيل الدخول أو إنشاء حساب لإرسال طلب تواصل أو صداقة 👥', 'info' as any);
      exitGuestMode();
      return;
    }
    const connId = `${appUser.id}_${targetUser.id}`;
    // Optimistic update (bidirectional cleanup)
    setConnections(prev => [
      ...prev.filter(c => !(
        (c.requesterId === appUser.id && c.recipientId === targetUser.id) ||
        (c.requesterId === targetUser.id && c.recipientId === appUser.id) ||
        c.id === connId
      )),
      {
        id: connId,
        requesterId: appUser.id,
        recipientId: targetUser.id,
        status: 'pending',
        timestamp: Date.now(),
        created_at: new Date().toISOString()
      }
    ]);
    try {
      const { data, error } = await networkService.sendSyncSignal(appUser, targetUser as any);
      if (error) throw error;
      if (data && (data as any).status === 'accepted') {
        setConnections(prev => prev.map(c => 
          ((c.requesterId === appUser.id && c.recipientId === targetUser.id) ||
           (c.requesterId === targetUser.id && c.recipientId === appUser.id)) 
          ? { ...c, status: 'accepted' } 
          : c
        ));
        addToast("تم تأكيد التواصل المتبادل بنجاح! 🤝");
      } else {
        addToast("تم إرسال طلب التواصل بنجاح (قيد الانتظار) ⌛");
      }
      if (user?.id) {
        networkService.fetchConnections(user.id).then(res => {
          if (res.data) setConnections((res.data as any[]).map(c => ({
            id: c.id,
            requesterId: c.requester_id,
            recipientId: c.recipient_id,
            status: c.status,
            timestamp: { toDate: () => new Date(c.created_at) }
          } as any)));
        });
      }
    } catch (e) {
      addToast("فشل إرسال الطلب", "error");
      fetchAllData();
    }
  };

  const handleAcceptSync = async (notif: AppNotification) => {
    if (notif.fromId) {
      supabase.from('profiles').select('*').eq('id', notif.fromId).maybeSingle().then(({ data: prof }) => {
        if (prof) {
          const mapped = mapProfile(prof);
          setAllUsers(prev => [...prev.filter(x => x.id !== notif.fromId), mapped]);
        }
      });
    }
    // 1. Optimistic Update: Mark notification read & connection accepted
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    setReadNotifIds(prev => {
      const next = new Set(prev);
      next.add(notif.id);
      return next;
    });
    if (notif.targetId) {
      setConnections(prev => prev.map(c => (c.id === notif.targetId || c.id === `${notif.fromId}_${appUser?.id}` || c.id === `${appUser?.id}_${notif.fromId}`) ? { ...c, status: 'accepted' } : c));
    }

    try {
      const { error } = await networkService.acceptSync(notif.id, notif.targetId);
      if (error) throw error;
      addToast("تمت المزامنة بنجاح ✅");
      if (user?.id) {
        networkService.fetchConnections(user.id).then(res => {
          if (res.data) setConnections((res.data as any[]).map(c => ({
            id: c.id,
            requesterId: c.requester_id,
            recipientId: c.recipient_id,
            status: c.status,
            timestamp: { toDate: () => new Date(c.created_at) }
          } as any)));
        });
      }
    } catch (e) {
      addToast("خطأ في قبول المزامنة", "error");
      fetchAllData();
    }
  };

  const handleAcceptConnection = async (connId: string) => {
    // 1. Optimistic Update — immediate UI response
    setConnections(prev => prev.map(c => (c.id === connId || c.id === `${connId.split('_').reverse().join('_')}`) ? { ...c, status: 'accepted' } : c));
    setNotifications(prev => prev.map(n => n.targetId === connId ? { ...n, read: true } : n));

    const conn = connections.find(c => c.id === connId);
    const otherUserId = conn ? (conn.requesterId === appUser?.id ? conn.recipientId : conn.requesterId) : undefined;
    if (otherUserId) {
      supabase.from('profiles').select('*').eq('id', otherUserId).maybeSingle().then(({ data: prof }) => {
        if (prof) {
          const mapped = mapProfile(prof);
          setAllUsers(prev => [...prev.filter(x => x.id !== otherUserId), mapped]);
        }
      });
    }

    try {
      const { error } = await networkService.acceptConnection(connId, appUser || undefined, otherUserId);
      if (error) throw error;
      addToast("تم قبول طلب التواصل بنجاح ✅");
      // ✅ Re-fetch connections from DB to confirm state (no need for manual refresh)
      if (user?.id) {
        networkService.fetchConnections(user.id).then(res => {
          if (res.data) setConnections((res.data as any[]).map(c => ({
            id: c.id,
            requesterId: c.requester_id,
            recipientId: c.recipient_id,
            status: c.status,
            timestamp: { toDate: () => new Date(c.created_at) }
          } as any)));
        });
      }
    } catch (e) {
      addToast("خطأ في قبول الطلب", "error");
      fetchAllData();
    }
  };

  const handleRejectConnection = async (connId: string) => {
    // 1. Optimistic Update
    setConnections(prev => prev.filter(c => c.id !== connId));
    setNotifications(prev => prev.filter(n => n.targetId !== connId));

    try {
      const { error } = await networkService.rejectConnection(connId);
      if (error) throw error;
      addToast("تم رفض طلب التواصل");
      // ✅ Re-fetch connections from DB silently to confirm state
      if (user?.id) {
        networkService.fetchConnections(user.id).then(res => {
          if (res.data) setConnections((res.data as any[]).map(c => ({
            id: c.id,
            requesterId: c.requester_id,
            recipientId: c.recipient_id,
            status: c.status,
            timestamp: { toDate: () => new Date(c.created_at) }
          } as any)));
        });
      }
    } catch (e) {
      addToast("خطأ في معالجة الطلب", "error");
      fetchAllData();
    }
  };

  const fetchMyGroups = async () => {
    if (!appUser?.id) return;
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, groups(*)')
        .eq('user_id', appUser.id);
      
      if (!error && data) {
        const groupsList = data.map((d: any) => d.groups).filter(Boolean);
        if (groupsList.length > 0) {
          setMyGroups(groupsList);
          return;
        }
      }

      // Fallback: fetch member group IDs and then load groups
      const { data: memberRows } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', appUser.id);

      const groupIds = (memberRows || []).map((m: any) => m.group_id).filter(Boolean);
      if (groupIds.length > 0) {
        const { data: directGroups } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds);
        if (directGroups && directGroups.length > 0) {
          setMyGroups(directGroups);
          return;
        }
      }

      // Also include groups created by current user
      const { data: createdGroups } = await supabase
        .from('groups')
        .select('*')
        .eq('created_by', appUser.id);
      if (createdGroups) {
        setMyGroups(createdGroups);
      }
    } catch (e) {
      console.error("Error fetching my groups:", e);
    }
  };

  const handleEchoPost = async (post: Post) => {
    if (!appUser) return;

    // 🚫 الباحث عن عمل لا يملك صلاحية إعادة النشر
    if (!canUserPostAndInteract(appUser)) {
      addToast("إعادة النشر والتفاعل مخصص لأصحاب العمل فقط 🔒", "error");
      return;
    }

    // 🚫 Block banned users from echoing
    if (appUser.isActive === false) {
      addToast("حسابك محظور ولا يمكنك إعادة النشر 🚫", "error");
      return;
    }
    try {
      const { error } = await postService.echoPost(appUser, post);
      if (error) throw error;
      addToast('تم إعادة النشر بنجاح! 🔁');
      // Refresh posts to show the new echo
      const postsRes = await postService.fetchPosts() as any;
      if (postsRes.data) {
        const mapped = (postsRes.data as any[]).map(p => ({
          ...p,
          authorName: p.author_name,
          authorAvatar: p.author_avatar,
          authorId: p.author_id,
          authorTitle: p.author_title || '',
          likesCount: p.likes_count,
          timestamp: { toDate: () => new Date(p.created_at) },
          imageUrl: p.image_url,
          videoUrl: p.video_url || null,
          isEcho: p.is_echo || false,
          originalPostId: p.original_post_id,
          originalAuthorName: p.original_author_name,
          originalAuthorAvatar: p.original_author_avatar,
          originalContent: p.original_content,
        }));
        setPosts(mapped as any);
      }
    } catch (e) { addToast('فشل تسجيل الصدى', 'error'); }
  };


  const handleDeleteJob = async (jobId: string): Promise<boolean> => {
    try {
      const isAdmin = !!(appUser?.isAdmin || (appUser as any)?.role === 'admin' || (appUser as any)?.role === 'superadmin' || (appUser as any)?.is_admin);
      
      // 1. Delete from Supabase DB (return deleted rows to detect silent RLS 0-row failures)
      let query = (supabase.from('jobs') as any).delete().eq('id', jobId);
      if (!isAdmin && appUser?.id) {
        query = query.eq('employer_id', appUser.id);
      }
      const { data: deletedRows, error } = await query.select('id');
      if (error) {
        console.error('[handleDeleteJob] Supabase DB Error:', error);
        addToast('تعذر حذف الوظيفة: ' + (error.message || 'خطأ في الصلاحيات'), 'error');
        return false;
      }
      if (!deletedRows || deletedRows.length === 0) {
        addToast('تعذر حذف الوظيفة: لا تملك صلاحية حذفها أو لم تعد موجودة', 'error');
        return false;
      }

      // 2. Persist deleted job ID in localStorage so it never returns on refresh
      try {
        const rawDel = localStorage.getItem('prolink_deleted_jobs');
        const deletedArr = rawDel ? JSON.parse(rawDel) : [];
        if (!deletedArr.includes(jobId)) {
          deletedArr.push(jobId);
          localStorage.setItem('prolink_deleted_jobs', JSON.stringify(deletedArr.slice(-300)));
        }
      } catch {}

      // 3. Update state & cached jobs in localStorage
      setJobs(prev => {
        const next = prev.filter(j => j.id !== jobId);
        try { localStorage.setItem('prolink_cached_jobs', JSON.stringify(next.slice(0, 60))); } catch {}
        return next;
      });

      addToast('🗑️ تم حذف الوظيفة نهائياً من قاعدة البيانات بنجاح', 'success');
      return true;
    } catch (err: any) {
      console.error('[handleDeleteJob] Exception:', err);
      addToast('فشل حذف الوظيفة: ' + (err?.message || 'خطأ غير معروف'), 'error');
      return false;
    }
  };

  const handleDeletePost = async (postId: string): Promise<boolean> => {
    try {
      const isAdmin = !!(appUser?.isAdmin || (appUser as any)?.role === 'admin' || (appUser as any)?.role === 'superadmin' || (appUser as any)?.is_admin);
      const { data: deletedRows, error } = await postService.deletePost(postId, appUser?.id, isAdmin);
      if (error) {
        console.error('[handleDeletePost] DB Error:', error);
        addToast('تعذر حذف المنشور من قاعدة البيانات: ' + (error.message || 'خطأ في الصلاحيات'), 'error');
        return false;
      }
      if (!deletedRows || (deletedRows as any[]).length === 0) {
        addToast('تعذر حذف المنشور: لا تملك صلاحية حذفه أو لم يعد موجوداً', 'error');
        return false;
      }

      // Persist deleted post ID in localStorage so it never returns on refresh
      try {
        const rawDel = localStorage.getItem('prolink_deleted_posts');
        const deletedArr = rawDel ? JSON.parse(rawDel) : [];
        if (!deletedArr.includes(postId)) {
          deletedArr.push(postId);
          localStorage.setItem('prolink_deleted_posts', JSON.stringify(deletedArr.slice(-300)));
        }
      } catch {}

      // Success from DB! Invalidate cache & update state + localStorage
      postService.invalidateCache();
      setPosts(prev => {
        const next = prev.filter(p => p.id !== postId);
        try { localStorage.setItem('prolink_cached_posts', JSON.stringify(next.slice(0, 60))); } catch {}
        return next;
      });
      addToast('🗑️ تم حذف المنشور نهائياً من قاعدة البيانات بنجاح', 'success');
      return true;
    } catch (err: any) {
      console.error('[handleDeletePost] Exception:', err);
      addToast('فشل حذف المنشور: ' + (err?.message || 'خطأ غير معروف'), 'error');
      return false;
    }
  };

  const handleRelocateToUser = async (targetUser: AppUser, post: Post) => {
    if (!appUser) return;
    try {
      const { error } = await postService.relocatePost(appUser, targetUser, post);
      if (error) throw error;
      addToast(`تم ترحيل البيانات إلى ${targetUser.name}`);
    } catch (e) { addToast('فشل ترحيل البيانات', 'error'); }
  };

  const toggleProRank = async () => {
    if (user && appUser) {
      try {
        const { error } = await profileService.toggleProStatus(user.id, appUser.isPro);
        if (error) throw error;
        setAppUser({ ...appUser, isPro: !appUser.isPro });
        addToast("تم تحديث حالة العضوية");
      } catch (e) { console.error(e); }
    }
  };

  const handleApplyJob = async (job: Job, text: string, file: File | null) => {
    if (!appUser || isGuestMode) {
      addToast('يجب تسجيل الدخول أو إنشاء حساب للتقديم على هذه الوظيفة 💼', 'info' as any);
      exitGuestMode();
      return;
    }
    // 🚫 Block banned users from applying
    if (appUser.isActive === false) {
      addToast("حسابك محظور ولا يمكنك التقديم على وظائف 🚫", "error");
      return;
    }
    if (job.id.startsWith('mock-')) {
      addToast('✅ تم تقديم طلبك بنجاح على هذه الوظيفة!', 'success');
      return;
    }
    try {
      let cvUrl = (appUser as any).cvUrl || (appUser as any).cv_url || '';
      if (file) {
        const { data: url, error: uploadError } = await jobService.uploadCV(appUser.id, file);
        if (uploadError) throw uploadError;
        if (url) cvUrl = url;
      }
      
      const applicantDataPayload = {
        name: appUser.name || (appUser as any).fullName || 'متقدم',
        avatar: appUser.avatar || '',
        title: (appUser as any).title || (appUser as any).specialty || '',
        industry: (appUser as any).industry || (appUser as any).specialty || '',
        location: (appUser as any).location || '',
        phone: (appUser as any).phone || '',
        bio: (appUser as any).bio || '',
        email: appUser.email || '',
        cvUrl: cvUrl,
        cv_data: (appUser as any).cv_data || (appUser as any).cvData || null,
        workExperiences: (appUser as any).workExperiences || (appUser as any).work_experiences || [],
        languages: (appUser as any).languages || [],
      };

      const { data: applyData, error } = await jobService.applyToJob(appUser.id, job.employer_id || '', {
        jobId: job.id,
        coverLetter: text,
        cvUrl: cvUrl,
        skills: appUser.skills || [],
        applicantData: applicantDataPayload,
        experience: (appUser as any).experience || '',
        education: (appUser as any).education || ''
      });
      if (error) throw error;

      // ⚡ Optimistic broadcast to instant-sync sentApplications
      try {
        const optimisticApp = {
          id: (applyData as any)?.id || `sent-${Date.now()}`,
          job_id: job.id,
          applicant_id: appUser.id,
          employer_id: job.employer_id,
          cover_letter: text,
          cv_url: cvUrl,
          status: 'pending',
          created_at: new Date().toISOString(),
          jobTitle: job.title || 'وظيفة',
          company: job.company || 'شركة',
          applicant_data: applicantDataPayload
        };
        window.dispatchEvent(new CustomEvent('prolink_application_sent', { detail: optimisticApp }));
      } catch (_) {}

      try { if ((window as any).refreshApplications) (window as any).refreshApplications(); } catch (_) {}
      addToast("تم إرسال طلب التقديم بنجاح! 🚀");
    } catch (e: any) {
      addToast("فشل التقديم: " + e.message, "error");
    }
  };

  useEffect(() => {
    let isInitialized = false;

    // ── ① جلب الجلسة الحالية فوراً (بدون انتظار onAuthStateChange) ─────────
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const u = session.user;
          setUser(u as any);
          let { data: profile } = await authService.getProfile(u.id);
          if (profile) {
            // ✅ إذا اختار المستخدم دوراً محدداً أثناء التسجيل (مثلاً باحث عن عمل)، نضمن اعتماده وتحديث قاعدة البيانات
            if (u.user_metadata?.role && profile.role !== u.user_metadata.role && !isUserAdmin(profile)) {
              profile.role = u.user_metadata.role;
              try {
                await supabase.from('profiles').update({ role: u.user_metadata.role }).eq('id', u.id);
              } catch (_) {}
            }

            // ✅ مصدر واحد للحقيقة: role من DB فقط. لا نعتمد user_metadata كبديل
            // إذا كان الدور فارغاً → شاشة اختيار الدور (needsRole=true)
            const mapped = mapProfile(profile);
            setAppUser(mapped);
            setAllUsers(prev => {
              if (prev.some(e => e.id === mapped.id)) return prev;
              return [...prev, mapped];
            });
            const hasRole = profile.role && profile.role !== '';
            setNeedsRole(!hasRole);

            // ✅ Load all data immediately on app open (fixes dashboard refresh bug)
            // Pass userId explicitly to avoid stale closure on `user` state
            if (hasRole) {
              setTimeout(() => fetchAllData(true, session.user.id), 50);
            }
          }
        }
      } catch (e) {
        console.warn('[AppContext] initSession error:', e);
      } finally {
        isInitialized = true;
        setLoading(false);
      }
    };
    initSession();

    // ── ② استمع للتغييرات اللاحقة (تسجيل دخول/خروج جديد) ────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // تجاهل INITIAL_SESSION لأننا عالجناه في initSession أعلاه
      if (event === 'INITIAL_SESSION') return;

      // ── TOKEN_REFRESHED: يحدث في Capacitor عند العودة من الخلفية ──────────
      // إذا كان المستخدم موجوداً في الجلسة لكن appUser لم يُحمَّل بعد (بسبب race condition),
      // نُعيد تحميل البروفايل لضمان عرض الواجهة بشكل صحيح
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user as any);
        // تحقق إذا كان appUser غير محمّل بعد
        setAppUser(prev => {
          if (!prev) {
            // لم يُحمَّل بعد — سيتولى المنطق أدناه التحميل
            return prev;
          }
          return prev; // محمّل بالفعل — لا تفعل شيئاً
        });
        // إذا لم يكن هناك appUser، نُعيد تشغيل initSession
        // نستخدم setTimeout(0) لتجنب race conditions مع React state
        setTimeout(async () => {
          try {
            const { data: profile } = await authService.getProfile(session.user.id);
            if (profile) {
              const mapped = mapProfile(profile);
              setAppUser(prev => prev ?? mapped); // فقط إذا لم يكن محمّلاً
              const hasRole = profile.role && profile.role !== '';
              if (hasRole && !isFetchingAllData.current) {
                fetchAllData(true, session.user.id);
              }
            }
          } catch (e) {
            console.warn('[AppContext] TOKEN_REFRESHED profile reload error:', e);
          }
        }, 0);
        return;
      }

      const u = session?.user || null;
      setUser(u as any);

      // ── مسح كاش المستخدم القديم فوراً إذا تسجّل مستخدم مختلف ──
      if (u) {
        try {
          const cachedRaw = localStorage.getItem('prolink_cached_user');
          if (cachedRaw) {
            const cachedId = JSON.parse(cachedRaw)?.id;
            if (cachedId && cachedId !== u.id) {
              // مستخدم مختلف — امسح فقط بيانات الجلسة والمحادثات للمستخدم السابق
              localStorage.removeItem('prolink_cached_user');
              localStorage.removeItem('prolink_cached_messages');
              localStorage.removeItem('prolink_cached_notifications');
              localStorage.removeItem('prolink_read_notif_ids');
              localStorage.removeItem('prolink_read_messages');
              localStorage.removeItem('prolink_read_chat_senders');
              localStorage.removeItem('prolink_seen_connections');
              sessionStorage.clear();
              setMessages([]);
              setNotifications([]);
            }
          }
        } catch (_) {}
      }

      if (u) {
        if (!isInitialized) setLoading(true);
        const timeout = setTimeout(() => setLoading(false), 10000);

        try {
          let { data: profile } = await authService.getProfile(u.id);

          if (!profile) {
            console.warn('[AppContext] Profile not found after auth event, running ensureProfile...');
            await authService.ensureProfile(u.id, {
              name: u.user_metadata?.full_name ||
                    u.user_metadata?.name ||
                    u.email?.split('@')[0] ||
                    'مستخدم',
              email: u.email || '',
              phone: u.user_metadata?.phone || '',
              role: u.user_metadata?.role || '',
            });
            const retry = await authService.getProfile(u.id);
            profile = retry.data;
          }

          if (profile) {
            // ✅ إذا اختار المستخدم دوراً محدداً أثناء التسجيل (مثلاً باحث عن عمل)، نضمن اعتماده وتحديث قاعدة البيانات
            if (u.user_metadata?.role && profile.role !== u.user_metadata.role && !isUserAdmin(profile)) {
              profile.role = u.user_metadata.role;
              try {
                await supabase.from('profiles').update({ role: u.user_metadata.role }).eq('id', u.id);
              } catch (_) {}
            }

            // ✅ مصدر واحد للحقيقة: role من DB فقط. لا نعتمد user_metadata كبديل
            // إذا كان الدور فارغاً → شاشة اختيار الدور (needsRole=true)
            const mapped = mapProfile(profile);
            setAppUser(mapped);
            setAllUsers(prev => {
              if (prev.some(existing => existing.id === mapped.id)) {
                return prev.map(existing => existing.id === mapped.id ? mapped : existing);
              }
              return [...prev, mapped];
            });
            const isAdm = isUserAdmin(profile);
            const hasValidRole = profile.role === 'seeker' || profile.role === 'employer' || profile.role === 'freelancer';
            const hasRole = isAdm || hasValidRole;
            setNeedsRole(!hasRole);

            // ✅ تحميل فوري وشامل لجميع البيانات (منشورات، وظائف، مستخدمين) لأي مستخدم (إيميل أو هاتف)
            fetchAllData(true, u.id, true);
            if (hasRole) {
              fetchMyGroups();
            }
          } else {
            console.error('[AppContext] Failed to create or fetch profile for user:', u.id);
            setNeedsRole(true);
          }
        } catch (e) {
          console.error('[AppContext] Profile load error:', e);
          setNeedsRole(true);
        } finally {
          clearTimeout(timeout);
          isInitialized = true;
          setLoading(false);
        }
      } else {
        // ── تسجيل الخروج ──────────────────────────────────────────────
        setAppUser(null);
        setNeedsRole(false);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Capacitor App Lifecycle: refresh data when app returns to foreground ──
  useEffect(() => {
    let capacitorListener: any = null;
    const attachCapacitorListener = async () => {
      try {
        // Use Function-based dynamic import to bypass TS module resolution
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const capacitorAppModule = await (new Function('m', 'return import(m)'))('@capacitor/app').catch(() => null);
        const App = capacitorAppModule?.App;
        if (!App) return;
        capacitorListener = await App.addListener('appStateChange', async ({ isActive }: { isActive: boolean }) => {
          if (!isActive || !user) return;
          // App came back to foreground — refresh stale data
          const elapsed = Date.now() - lastFetchedAt.current;
          if (elapsed > MIN_REFRESH_INTERVAL) {
            fetchAllData(true);
          }
          // 🔥 Re-establish ONLY if channels are truly dead (avoid flapping)
          const alive = activeChannelsRef.current.length > 0 &&
            activeChannelsRef.current.every(ch => {
              const state = (ch as any).state;
              return state === 'joined' || state === 'joining';
            });
          if (!alive) {
            console.log('[Capacitor] Channels dead on foreground — rebuilding...');
            setupRealtimeSubscriptionsRef.current?.();
          }
          // Always catch-up on missed messages when returning from background
          try {
            const since = new Date(Date.now() - 60_000).toISOString(); // last 60s
            const { data } = await supabase
              .from('messages')
              .select('*')
              .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
              .gte('created_at', since)
              .order('created_at', { ascending: true });
            if (data && data.length > 0) {
              setMessages((prev: any[]) => {
                const existingIds = new Set(prev.map((m: any) => m.id));
                const newOnes = data
                  .filter((m: any) => !existingIds.has(m.id))
                  .map((m: any) => ({
                    ...m,
                    senderId: m.sender_id,
                    receiverId: m.receiver_id,
                    timestamp: { toDate: () => new Date(m.created_at) }
                  }));
                return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
              });
            }
          } catch (e) {
            console.warn('[Capacitor] catch-up query failed:', e);
          }
        });
      } catch (e) {
        // Not running in Capacitor — ignore
      }
    };
    attachCapacitorListener();
    return () => {
      if (capacitorListener?.remove) capacitorListener.remove();
    };
  }, [user?.id]);

  // ─── Realtime Subscriptions ───────────────────────────────────────────────
  // Stored in a ref so it can be called from multiple effects (visibility,
  // online, Capacitor appStateChange) without stale closure issues.
  const setupRealtimeSubscriptionsRef = useRef<(() => void) | null>(null);

  // ─── Realtime Subscriptions & Background Refresh ─────────────────────────
  useEffect(() => {
    if (!user || needsRole) return;

    fetchAllData();
    fetchMyGroups();

    // ✅ Check if all channels are already healthy — avoid unnecessary teardown
    const isChannelsHealthy = () => {
      if (activeChannelsRef.current.length === 0) return false;
      const isSocketConnected = (supabase.realtime as any)?.isConnected?.() ?? true;
      if (!isSocketConnected) return false;
      return activeChannelsRef.current.every(ch => {
        const state = String((ch as any).state || '').toLowerCase();
        return state === 'joined' || state === 'joining';
      });
    };

    // ✅ Catch-up query: fetch any messages missed during the CLOSED window
    const catchUpMissedMessages = async (userId: string) => {
      try {
        const since = new Date(Date.now() - 30_000).toISOString(); // last 30s
        const { data } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .gte('created_at', since)
          .order('created_at', { ascending: true });

        if (data && data.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = data
              .filter((m: any) => !existingIds.has(m.id))
              .map((m: any) => ({
                ...m,
                senderId: m.sender_id,
                receiverId: m.receiver_id,
                timestamp: { toDate: () => new Date(m.created_at) }
              }));
            return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
          });
        }
      } catch (e) {
        console.warn('[Realtime] catch-up query failed:', e);
      }
    };

    const setupRealtimeSubscriptions = (force = false) => {
      if (!user || needsRole) return;

      // ⚡ Skip if channel is already healthy (prevents unnecessary teardown)
      if (!force && isChannelsHealthy()) {
        console.log('[Realtime] Main channel is healthy, skipping rebuild.');
        return;
      }

      // 🧹 Clean up previous channel cleanly
      if (activeChannelsRef.current.length > 0) {
        console.log('[Realtime] Cleaning up old channel before reconnecting...');
        activeChannelsRef.current.forEach(ch => supabase.removeChannel(ch));
        activeChannelsRef.current = [];
      }

      const channelName = `prolink-main-${user.id}`;
      console.log('[Realtime] Setting up single unified channel:', channelName);

      const handleMessagePayload = (payload: any) => {
        const m = (payload.new || payload.old) as any;
        if (!m) return;

        if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(msg => String(msg.id) === String(m.id) ? {
            ...msg,
            ...m,
            sender_id: m.sender_id || msg.sender_id || msg.senderId,
            receiver_id: m.receiver_id || msg.receiver_id || msg.receiverId,
            senderId: m.sender_id || msg.senderId || msg.sender_id,
            receiverId: m.receiver_id || msg.receiverId || msg.receiver_id,
            read: m.read !== undefined ? Boolean(m.read) : msg.read
          } : msg));
          return;
        }

        if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(msg => String(msg.id) !== String(m.id)));
          return;
        }

        if (payload.eventType === 'INSERT') {
          const sId = String(m.sender_id || m.senderId || '').toLowerCase().trim();
          const rId = String(m.receiver_id || m.receiverId || '').toLowerCase().trim();
          const myId = String(user.id || '').toLowerCase().trim();
          const currentChatId = String(selectedChatRef.current?.id || '').toLowerCase().trim();

          const isRead = m.read || (currentChatId === sId);

          // Auto-mark as read if the chat with this sender is currently open (deferred to avoid setMessages state races)
          if (currentChatId === sId && rId === myId) {
            setTimeout(() => markChatMessagesAsRead(m.sender_id), 150);
          }

          const newMsg = {
            ...m,
            id: String(m.id),
            sender_id: m.sender_id || m.senderId,
            receiver_id: m.receiver_id || m.receiverId,
            senderId: m.sender_id || m.senderId,
            receiverId: m.receiver_id || m.receiverId,
            content: m.content,
            read: isRead,
            created_at: m.created_at || new Date().toISOString()
          } as any;

          setMessages(prev => {
            const existingIdx = prev.findIndex(x => String(x.id) === String(m.id));
            if (existingIdx !== -1) {
              const updated = [...prev];
              updated[existingIdx] = { ...updated[existingIdx], ...newMsg };
              return updated;
            }
            return [...prev, newMsg];
          });
        }
      };

      const unifiedChannel = supabase
        .channel(channelName)
        // 1. Posts (Realtime Live Insert, Update, Delete)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, payload => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setPosts(prev => prev.filter(p => p.id !== oldId));
            }
            return;
          }

          const p = payload.new as any;
          if (!p || !p.id) return;

          const mappedPost = {
            ...p,
            authorName: p.author_name,
            authorAvatar: p.author_avatar,
            authorId: p.author_id,
            authorTitle: p.author_title || '',
            likesCount: p.likes_count || 0,
            dislikesCount: p.dislikes_count || 0,
            timestamp: p.created_at ? { toDate: () => new Date(p.created_at) } : { toDate: () => new Date() },
            imageUrl: p.image_url,
            videoUrl: p.video_url || null
          };

          if (payload.eventType === 'UPDATE') {
            setPosts(prev => prev.map(old => old.id === p.id ? { ...old, ...mappedPost } : old));
          } else if (payload.eventType === 'INSERT') {
            setPosts(prev => {
              if (prev.some(x => x.id === p.id)) return prev;
              return [mappedPost as any, ...prev];
            });
          }
        })
        // 2. Profiles
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
          const p = payload.new as any;
          if (p && p.id) {
            setAllUsers(prev => prev.map(u => u.id === p.id ? mapProfile(p) : u));
            setAppUserRaw(current => {
              if (current && current.id === p.id) {
                const mapped = mapProfile(p);
                try {
                  localStorage.setItem('prolink_cached_user', JSON.stringify(mapped));
                  if (current.role !== mapped.role) {
                    localStorage.removeItem('prolink_pending_role_req');
                    window.dispatchEvent(new CustomEvent('prolink_role_updated', {
                      detail: { role: mapped.role, status: 'approved' }
                    }));
                  }
                } catch (_) {}
                return mapped;
              }
              return current;
            });
          }
        })
        // 3. Jobs (Realtime Live Insert, Update, Delete)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, payload => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setJobs(prev => prev.filter(j => j.id !== oldId));
            }
            return;
          }

          const j = payload.new as any;
          if (!j || !j.id) return;

          const mappedJob = {
            ...j,
            employerName: j.company,
            category: getJobCategory(j),
            postedAt: j.created_at ? { toDate: () => new Date(j.created_at) } : { toDate: () => new Date() }
          };

          if (payload.eventType === 'UPDATE') {
            setJobs(prev => prev.map(old => old.id === j.id ? { ...old, ...mappedJob } : old));
          } else if (payload.eventType === 'INSERT') {
            setJobs(prev => {
              if (prev.some(x => x.id === j.id)) return prev;
              return [mappedJob as any, ...prev];
            });
          }
        })
        // 4. Messages (Instant Live Chat)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages'
        }, (payload) => {
          const m = (payload.new || payload.old) as any;
          if (!m) return;
          const sId = String(m.sender_id || '').toLowerCase().trim();
          const rId = String(m.receiver_id || '').toLowerCase().trim();
          const myId = String(user.id || '').toLowerCase().trim();
          if (sId !== myId && rId !== myId) return;
          console.log('[Realtime] MSG event:', payload.eventType, 'from:', sId.slice(-6), 'to:', rId.slice(-6));
          handleMessagePayload(payload);
        })
        // 5. Notifications
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, payload => {
          const n = (payload.new || payload.old) as any;
          if (!n) return;
          if (payload.eventType === 'DELETE') {
            setNotifications(prev => prev.filter(x => x.id !== n.id));
            return;
          }
          if (n.user_id === user.id) {
            const mappedNotif: AppNotification = {
              id: n.id,
              userId: n.user_id,
              type: n.type,
              fromId: n.from_id,
              fromName: n.from_name,
              fromAvatar: n.from_avatar,
              targetId: n.target_id,
              read: n.read,
              message: n.message,
              timestamp: { toDate: () => new Date(n.created_at || Date.now()) }
            };

            if (payload.eventType === 'INSERT') {
              if (n.type === 'role_change_approved') {
                addToast(n.message || '🎉 تمت الموافقة على طلب ترقية نوع حسابك!', 'success');
                if (user?.id) {
                  authService.getProfile(user.id).then(({ data: prof }) => {
                    if (prof) {
                      const mapped = mapProfile(prof);
                      setAppUser(mapped);
                    }
                  });
                }
              } else if (n.type === 'role_change_rejected') {
                addToast(n.message || 'تم رفض طلب تغيير نوع الحساب', 'error');
              }
            }

            if (n.type === 'follow_request' || n.type === 'sync_approval') {
              networkService.fetchConnections(user.id).then(res => {
                if (res.data) setConnections((res.data as any[]).map(c => ({
                  id: c.id,
                  requesterId: c.requester_id,
                  recipientId: c.recipient_id,
                  status: c.status,
                  timestamp: { toDate: () => new Date(c.created_at || Date.now()) }
                } as any)));
              });
            }

            setNotifications(prev => {
              if (prev.some(x => x.id === n.id)) {
                return prev.map(x => x.id === n.id ? mappedNotif : x);
              }
              return [mappedNotif, ...prev];
            });
          }
        })
        // 6. Connections
        .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, payload => {
          const c = (payload.new || payload.old) as any;
          if (!c) return;
          if (payload.eventType === 'DELETE') {
            setConnections(prev => prev.filter(x => x.id !== c.id && !(
              (x.requesterId === c.requester_id && x.recipientId === c.recipient_id) ||
              (x.requesterId === c.recipient_id && x.recipientId === c.requester_id)
            )));
            return;
          }
          if (c.requester_id === user.id || c.recipient_id === user.id) {
            const mappedConn: AppConnection = {
              id: c.id,
              requesterId: c.requester_id,
              recipientId: c.recipient_id,
              status: c.status,
              timestamp: new Date(c.created_at || Date.now()).getTime(),
            };
            setConnections(prev => {
              const existingIdx = prev.findIndex(x => 
                x.id === c.id || 
                (x.requesterId === c.requester_id && x.recipientId === c.recipient_id) ||
                (x.requesterId === c.recipient_id && x.recipientId === c.requester_id)
              );
              if (existingIdx !== -1) {
                const updated = [...prev];
                updated[existingIdx] = mappedConn;
                return updated;
              }
              return [mappedConn, ...prev];
            });
          }
        })
        // 7. Calls (Unified Channel)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, payload => {
          callService.handleIncomingCallPayload(payload);
        })
        .subscribe((status) => {
          console.log('[Realtime] ProLink Main Channel status:', status);
          if (status === 'SUBSCRIBED') {
            catchUpMissedMessages(user.id);
          }
        });

      activeChannelsRef.current = [unifiedChannel];
    };

    setupRealtimeSubscriptionsRef.current = setupRealtimeSubscriptions;
    setupRealtimeSubscriptions(true); // Force on first mount

    // 🔄 Guaranteed Hybrid Message Heartbeat (Every 3s)
    // Works in parallel with WebSockets so messages NEVER fail to arrive,
    // even if WebSockets are closed, timed out, or blocked by firewalls.
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && user?.id) {
        catchUpMissedMessages(user.id);
      }
    }, 3000);

    const handleVisibilityChange = async () => {
      resetStuckLocksAndQueues();
      if (document.visibilityState !== 'visible' || !user || needsRole) return;
      try {
        await ensureFreshSession();
      } catch (_) {}
      const elapsed = Date.now() - lastFetchedAt.current;
      const isStale = elapsed > MIN_REFRESH_INTERVAL;
      if (isStale) {
        fetchAllData(true);
        fetchMyGroups();
      }
      // Instantly sync any messages received while tab was hidden
      catchUpMissedMessages(user.id);
    };

    const handleOnline = async () => {
      resetStuckLocksAndQueues();
      if (!user || needsRole) return;
      try {
        await ensureFreshSession();
      } catch (_) {}
      fetchAllData(true);
      catchUpMissedMessages(user.id);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (activeChannelsRef.current.length > 0) {
        activeChannelsRef.current.forEach(ch => supabase.removeChannel(ch));
        activeChannelsRef.current = [];
      }
    };
  }, [user?.id, needsRole]);

  const value = {
    user: isGuestMode ? null : user,
    appUser: isGuestMode ? null : appUser,
    loading, needsRole, authLoading, authMode, setAuthMode,
    pendingEmailVerification, setPendingEmailVerification,
    posts: effectivePosts, jobs: effectiveJobs, allUsers: effectiveAllUsers, connections, seenConnectionIds, setSeenConnectionIds,
    notifications, readNotifIds, setReadNotifIds, readNotifTimestamps,
    messages: effectiveMessages, isMockEnabled, readMessageIds, readChatSenders, reports, myGroups,
    unreadMessagesCount, pendingRequestsCount, unreadNotificationsCount,
    activeTab, setActiveTab, searchQuery, setSearchQuery,
    platformSettings, canUseMessaging, canUseSupportChat, canUseGroups, canUseNetwork, canUseAccountSwitch, canUseKhakiTheme,
    selectedProfile, setSelectedProfile, isEditingProfile, setIsEditingProfile,
    toasts, showNotifications, setShowNotifications, showAdmin, setShowAdmin,
    selectedChat, setSelectedChat,
    selectedGroup, setSelectedGroup,
    isPublishingArticle, setIsPublishingArticle,
    theme, setTheme, toggleTheme,
    addToast, handleGoogleLogin, handleEmailLogin, handleEmailSignUp, handlePhoneAuth, logout,
    refreshData: (silent?: boolean, userId?: string) => fetchAllData(silent, userId, true), handleApplyJob, 
    setAppUser: (u: any) => {
      setAppUser(u);
    },
    setNotifications, setAllUsers, setPosts, setMessages, setMyGroups,
    selectRole, handleSyncSignal, handleAcceptSync, handleAcceptConnection, handleRejectConnection, handleLike, likedPosts, handleDislike, dislikedPosts, handleAddComment, handleEchoPost, handleDeletePost, handleDeleteJob, setJobs, handleRelocateToUser, toggleProRank,
    authEmail, setAuthEmail, authPhone, setAuthPhone, authName, setAuthName, authPassword, setAuthPassword,
    fetchMyGroups,
    allGroups,
    setAllGroups,
    fetchGroups,
    markConnectionAsSeen,
    markMessageAsRead,
    markChatMessagesAsRead,
    markNotificationAsRead,
    markJobApplicationNotificationsAsRead,
    deleteReadNotifications,
    deleteAllNotifications,
    userTotalPostsCount,
    setUserTotalPostsCount,
    // ── Guest Mode ──
    isGuestMode,
    enterGuestMode,
    exitGuestMode,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};
