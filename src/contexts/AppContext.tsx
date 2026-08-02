import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { AppUser, Post, Job, AppConnection, AppNotification } from '../types';
import { authService, postService, jobService, networkService, profileService } from '../lib/services';

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
  notifications: AppNotification[];
  messages: any[];
  reports: any[];
  myGroups: any[];
  setMyGroups: React.Dispatch<React.SetStateAction<any[]>>;
  allGroups: any[];
  setAllGroups: React.Dispatch<React.SetStateAction<any[]>>;
  fetchGroups: () => Promise<void>;
  
  // UI State
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedProfile: AppUser | null;
  setSelectedProfile: (user: AppUser | null) => void;
  isEditingProfile: boolean;
  setIsEditingProfile: (is: boolean) => void;
  toasts: { id: number, message: string, type: 'success' | 'error' }[];
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
  showAdmin: boolean;
  setShowAdmin: (show: boolean) => void;
  selectedChat: AppUser | null;
  setSelectedChat: (user: AppUser | null) => void;
  selectedGroup: any | null;
  setSelectedGroup: (group: any | null) => void;
  // Theme State
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  toggleTheme: () => void;
  
  // Actions
  addToast: (message: string, type?: 'success' | 'error') => void;
  handleGoogleLogin: () => Promise<void>;
  handleEmailLogin: (e: React.FormEvent) => Promise<void>;
  handleEmailSignUp: (e: React.FormEvent) => Promise<void>;
  handlePhoneAuth: (e: React.FormEvent) => Promise<void>;
  logout: () => Promise<void>;
  refreshData: () => Promise<void>;
  handleApplyJob: (job: Job, text: string, file: File | null) => Promise<void>;
  setAppUser: (user: AppUser | null) => void;
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  setAllUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  selectRole: (role: 'seeker' | 'employer') => Promise<void>;
  handleSyncSignal: (targetUser: AppUser) => Promise<void>;
  handleAcceptSync: (notif: AppNotification) => Promise<void>;
  handleLike: (postId: string) => Promise<void>;
  handleAddComment: (postId: string, commentContent: string) => Promise<void>;
  handleEchoPost: (post: Post) => Promise<void>;
  handleRelocateToUser: (targetUser: AppUser, post: Post) => Promise<void>;
  toggleProRank: () => Promise<void>;
  fetchMyGroups: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Maps raw Supabase profile row → AppUser shape used by the UI
export const mapProfile = (p: any): any => ({
  ...p,
  id: p.id,
  name: p.name || p.full_name || 'مستخدم',
  email: p.email || '',
  avatar: p.avatar_url || p.avatar || null,
  avatar_url: p.avatar_url || p.avatar || null,
  role: p.role ?? '',  // لا تضع قيمة افتراضية — القيمة الفارغة مهمة لتحديد needsRole
  bio: p.bio || '',
  location: p.location || '',
  companyName: p.company_name || p.companyName || '',
  phone: p.phone || '',
  skills: p.skills || [],
  experience: p.experience || '',
  education: p.education || '',
  isPro: p.is_pro || false,
  is_pro: p.is_pro || false,
  // ✅ Admin status comes ONLY from DB column `is_admin` — never from client-side hardcoded values
  isAdmin: p.is_admin === true,
  is_admin: p.is_admin === true,
  hasErpAccess: p.is_admin === true || p.has_erp_access === true,
  hasCallsAccess: p.is_admin === true || p.has_calls_access === true,
  coverUrl: p.cover_url || null,
  cvUrl: p.cv_url || null,
  cv_url: p.cv_url || null,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsRole, setNeedsRole] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'phone'>('login');
  const [pendingEmailVerification, setPendingEmailVerification] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [connections, setConnections] = useState<AppConnection[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  
  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setAllGroups(data);
    } catch (e) {
      console.error("Error fetching all groups:", e);
    }
  };
  
  const [activeTab, setActiveTab] = useState('news');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<AppUser | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [toasts, setToasts] = useState<{ id: number, message: string, type: 'success' | 'error' }[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedChat, setSelectedChat] = useState<AppUser | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('prolink_theme');
    if (saved === 'dark' || saved === 'light') return saved as any;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('prolink_theme', theme);
    // Remove all theme classes first
    document.documentElement.classList.remove('light', 'dark', 'milky', 'pink');
    // Add the current one
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const isFetchingAllData = useRef(false);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
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
    await authService.logout();
    localStorage.clear();
    setUser(null);
    setAppUser(null);
    setPosts([]);
    setJobs([]);
    addToast('تم تسجيل الخروج بنجاح');
  };

  const selectRole = async (role: 'seeker' | 'employer') => {
    if (!user) return;
    try {
      const { error } = await authService.selectRole(user.id, role, user.user_metadata as Record<string, unknown>);
      if (error) throw error;

      // ✅ أعِد تحميل الـ profile من قاعدة البيانات للتأكد من التحديث
      const { data: profile } = await authService.getProfile(user.id);
      if (profile) {
        setAppUser(mapProfile(profile));
      }

      // ✅ الآن نُعيِّن needsRole=false فقط بعد التحقق من وجود profile محدَّث
      setNeedsRole(false);
      addToast(`✅ تم تفعيل حسابك كـ ${role === 'seeker' ? 'باحث عن عمل' : 'صاحب عمل'}! مرحباً بك.`);
    } catch (e: any) {
      addToast("خطأ في حفظ البيانات: " + e.message, "error");
    }
  };

  const fetchAllData = async () => {
    if (!user || isFetchingAllData.current) return;
    isFetchingAllData.current = true;
    
    console.log("DEBUG: Starting global fetch...");
    try {
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
          is_pro_post: p.author_name?.includes('Pro') || false // Approximation if field missing
        }));

        // 🧠 Smart Algorithm Sorting
        const sorted = [...mapped].sort((a, b) => {
          // Calculate Scores
          const now = Date.now();
          const ageA = (now - new Date(a.created_at).getTime()) / 3600000; // hours
          const ageB = (now - new Date(b.created_at).getTime()) / 3600000;

          const scoreA = (a.likesCount * 2) + (a.is_pro_post ? 10 : 0) - (ageA * 0.5);
          const scoreB = (b.likesCount * 2) + (b.is_pro_post ? 10 : 0) - (ageB * 0.5);

          return scoreB - scoreA;
        });

        setPosts(sorted as any);
      }

      const jobsRes = await jobService.fetchJobs() as any;
      if (jobsRes.data) {
        setJobs((jobsRes.data as any[]).map(j => ({ 
          ...j, 
          employerName: j.company, 
          postedAt: { toDate: () => new Date(j.created_at) } 
        })) as any);
      }

      profileService.fetchProfiles().then(res => {
        if (res.data) setAllUsers(res.data.map(mapProfile));
      });

      networkService.fetchConnections(user.id).then(res => {
        if (res.data) setConnections((res.data as any[]).map(c => ({ id: c.id, requesterId: c.requester_id, recipientId: c.recipient_id, status: c.status, timestamp: { toDate: () => new Date(c.created_at) } } as any)));
      });

      networkService.fetchNotifications(user.id).then(res => {
        if (res.data) setNotifications((res.data as any[]).map(n => ({ id: n.id, userId: n.user_id, type: n.type, fromId: n.from_id, fromName: n.from_name, fromAvatar: n.from_avatar, targetId: n.target_id, read: n.read, timestamp: { toDate: () => new Date(n.created_at) } } as any)));
      });

      const msgsRes = await supabase.from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true })
        .limit(100) as any;
      
      if (msgsRes.data) {
        setMessages((msgsRes.data as any[]).map(m => ({ 
          ...m, 
          senderId: m.sender_id, 
          receiverId: m.receiver_id, 
          timestamp: { toDate: () => new Date(m.created_at) } 
        })));
      }

      fetchMyGroups();

    } catch (e) {
      console.error("DEBUG: Global fetch error:", e);
    } finally {
      setTimeout(() => { isFetchingAllData.current = false; }, 100);
    }
  };

  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const handleLike = async (postId: string) => {
    if (!appUser) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Prevent self-like
    if (post.authorId === appUser.id) {
      addToast("لا يمكنك الإعجاب بتوجيهك الخاص 🚫", "error");
      return;
    }

    const isLiked = likedPosts.has(postId);
    const newCount = isLiked ? Math.max(0, (post.likesCount || 0) - 1) : (post.likesCount || 0) + 1;

    // Optimistic Update
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likesCount: newCount } : p));
    const newLikedPosts = new Set(likedPosts);
    if (isLiked) newLikedPosts.delete(postId);
    else newLikedPosts.add(postId);
    setLikedPosts(newLikedPosts);

    try {
      const { error } = await (supabase.from('posts') as any).update({ likes_count: newCount }).eq('id', postId);
      if (error) throw error;
      if (!isLiked) addToast("تم تأكيد الإشارة ✅");
    } catch (e) {
      // Rollback
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likesCount: post.likesCount } : p));
      setLikedPosts(likedPosts);
      addToast("فشل تحديث الإعجاب", "error");
    }
  };

  const handleAddComment = async (postId: string, content: string) => {
    if (!appUser) return;
    try {
      const { error } = await postService.addComment(postId, appUser, content);
      if (error) throw error;
      addToast("تمت إضافة التعليق ✅");
    } catch (e) { addToast("خطأ في إضافة التعليق", "error"); }
  };

  const handleSyncSignal = async (targetUser: AppUser) => {
    if (!appUser) return;
    try {
      const { error } = await networkService.sendSyncSignal(appUser, targetUser as any);
      if (error) throw error;
      addToast("تم إرسال إشارة المزامنة");
    } catch (e) { addToast("فشل إرسال الإشارة", "error"); }
  };

  const handleAcceptSync = async (notif: AppNotification) => {
    try {
      const { error } = await networkService.acceptSync(notif.id, notif.targetId);
      if (error) throw error;
      addToast("تمت المزامنة بنجاح ✅");
      fetchAllData();
    } catch (e) { addToast("خطأ في قبول المزامنة", "error"); }
  };

  const fetchMyGroups = async () => {
    if (!appUser?.id) return;
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, groups(*)')
        .eq('user_id', appUser.id)
        .eq('status', 'accepted');
      
      if (error) throw error;
      if (data) {
        const groupsList = data.map((d: any) => d.groups).filter(Boolean);
        setMyGroups(groupsList);
      }
    } catch (e) {
      console.error("Error fetching my groups:", e);
    }
  };

  const handleEchoPost = async (post: Post) => {
    if (!appUser) return;
    try {
      const { error } = await postService.echoPost(appUser, post);
      if (error) throw error;
      addToast('تم تسجيل صدى الإشارة بنجاح!');
    } catch (e) { addToast('فشل تسجيل الصدى', 'error'); }
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
    if (!appUser) return;
    try {
      let cvUrl = '';
      if (file) {
        const { data: url, error: uploadError } = await jobService.uploadCV(appUser.id, file);
        if (uploadError) throw uploadError;
        cvUrl = url || '';
      }
      
      const { error } = await jobService.applyToJob(appUser.id, job.employer_id || '', {
        jobId: job.id,
        coverLetter: text,
        cvUrl: cvUrl,
        skills: appUser.skills || [],
        applicantData: {
          name: appUser.name,
          avatar: appUser.avatar,
          industry: (appUser as any).industry,
          location: (appUser as any).location,
          phone: (appUser as any).phone,
          bio: (appUser as any).bio,
          email: appUser.email
        },
        experience: (appUser as any).experience || '',
        education: (appUser as any).education || ''
      });
      if (error) throw error;
      addToast("تم إرسال طلب التقديم بنجاح! 🚀");
    } catch (e: any) {
      addToast("فشل التقديم: " + e.message, "error");
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user || null;
      setUser(u as any);

      if (u) {
        setLoading(true);
        // Safety timeout: لا تترك المستخدم في شاشة التحميل أكثر من 10 ثوانٍ
        const timeout = setTimeout(() => setLoading(false), 10000);

        try {
          // ── انتظر قليلاً بعد SIGNED_IN لمنح DB Trigger وقت الإنشاء ─────────
          // الـ Trigger يعمل على مستوى Postgres وقد يأخذ لحظة بعد إنشاء auth.user
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            await new Promise(resolve => setTimeout(resolve, 1200));
          }

          // ── محاولة 1: جلب الـ profile ─────────────────────────────────────
          let { data: profile } = await authService.getProfile(u.id);

          if (!profile) {
            // ── محاولة 2: الـ Trigger لم يعمل → أنشئ الـ profile يدوياً ────
            console.warn('[AppContext] Profile not found after auth event, running ensureProfile...');
            await authService.ensureProfile(u.id, {
              name: u.user_metadata?.full_name ||
                    u.user_metadata?.name ||
                    u.email?.split('@')[0] ||
                    'مستخدم',
              email: u.email || '',
              phone: u.user_metadata?.phone || '',
            });

            // إعادة الجلب بعد الإنشاء اليدوي
            const retry = await authService.getProfile(u.id);
            profile = retry.data;
          }

          if (profile) {
            const mapped = mapProfile(profile);
            setAppUser(mapped);
            setAllUsers(prev => {
              if (prev.some(existing => existing.id === mapped.id)) {
                return prev.map(existing => existing.id === mapped.id ? mapped : existing);
              }
              return [...prev, mapped];
            });

            // ✅ المنطق الصحيح:
            // needsRole = true  إذا كان الـ role فارغاً (NULL أو '') → شاشة اختيار الدور
            // needsRole = false إذا كان الـ role محدداً ('seeker' أو 'employer')
            const hasRole = profile.role && profile.role !== '';
            setNeedsRole(!hasRole);
          } else {
            // حالة نادرة جداً: فشل إنشاء الـ profile → اطلب اختيار الدور
            console.error('[AppContext] Failed to create or fetch profile for user:', u.id);
            setNeedsRole(true);
          }
        } catch (e) {
          console.error('[AppContext] Profile load error:', e);
          setNeedsRole(true);
        } finally {
          clearTimeout(timeout);
          setLoading(false);
        }
      } else {
        // ── تسجيل الخروج ────────────────────────────────────────────────────
        setAppUser(null);
        setNeedsRole(false);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || needsRole) return;
    fetchAllData();
    fetchMyGroups();
    const postsChannel = supabase.channel(`posts-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
        const p = payload.new as any;
        const mappedPost = {
          ...p,
          authorName: p.author_name,
          authorAvatar: p.author_avatar,
          authorId: p.author_id,
          authorTitle: p.author_title || '',
          likesCount: p.likes_count || 0,
          timestamp: { toDate: () => new Date(p.created_at) },
          imageUrl: p.image_url,
          videoUrl: p.video_url || null
        };
        setPosts(prev => {
          // ① إذا كان الـ ID موجود فعلاً (بعد استبدال tempId) → تجاهل
          if (prev.some(x => x.id === p.id)) return prev;
          // ② ابحث عن منشور temp للمستخدم نفسه لاستبداله بدل إضافة نسخة ثانية
          const tempIndex = prev.findIndex(
            x => typeof x.id === 'string' &&
                 x.id.startsWith('temp-') &&
                 (x as any).authorId === p.author_id
          );
          if (tempIndex !== -1) {
            // استبدل التفاؤلي بالحقيقي
            const updated = [...prev];
            updated[tempIndex] = mappedPost as any;
            return updated;
          }
          return [mappedPost as any, ...prev];
        });
      })
      .subscribe();
    const profilesChannel = supabase.channel(`profiles-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        const p = payload.new as any;
        if (p.id) {
          setAllUsers(prev => prev.map(u => u.id === p.id ? mapProfile(p) : u));
          if (appUser?.id === p.id) setAppUser(mapProfile(p));
        }
      })
      .subscribe();
    const jobsChannel = supabase.channel(`jobs-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, payload => {
        const j = payload.new as any;
        const mappedJob = {
          ...j,
          employerName: j.company,
          postedAt: { toDate: () => new Date(j.created_at) }
        };
        setJobs(prev => {
          if (prev.some(x => x.id === j.id)) return prev;
          return [mappedJob as any, ...prev];
        });
      })
      .subscribe();
    const messagesChannel = supabase.channel(`msgs-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const m = payload.new as any;
        if (m.sender_id === user.id || m.receiver_id === user.id) {
          setMessages(prev => {
            if (prev.some(x => x.id === m.id)) return prev;
            // Remove temp messages that match this content to avoid "twice" issue
            const filtered = prev.filter(x => !(x.id && typeof x.id === 'string' && x.id.startsWith('temp-') && x.content === m.content));
            return [...filtered, {
              ...m,
              senderId: m.sender_id,
              receiverId: m.receiver_id,
              timestamp: { toDate: () => new Date(m.created_at) }
            } as any];
          });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [user, needsRole]);

  const value = {
    user, appUser, loading, needsRole, authLoading, authMode, setAuthMode,
    pendingEmailVerification, setPendingEmailVerification,
    posts, jobs, allUsers, connections, notifications, messages, reports, myGroups,
    activeTab, setActiveTab, searchQuery, setSearchQuery,
    selectedProfile, setSelectedProfile, isEditingProfile, setIsEditingProfile,
    toasts, showNotifications, setShowNotifications, showAdmin, setShowAdmin,
    selectedChat, setSelectedChat,
    selectedGroup, setSelectedGroup,
    theme, setTheme, toggleTheme,
    addToast, handleGoogleLogin, handleEmailLogin, handleEmailSignUp, handlePhoneAuth, logout,
    refreshData: fetchAllData, handleApplyJob, 
    setAppUser: (u: AppUser | null) => {
      setAppUser(u);
      if (u) setAllUsers(prev => prev.map(usr => usr.id === u.id ? u : usr));
    },
    setNotifications, setAllUsers, setPosts, setMessages, setMyGroups,
    selectRole, handleSyncSignal, handleAcceptSync, handleLike, handleAddComment, handleEchoPost, handleRelocateToUser, toggleProRank,
    authEmail, setAuthEmail, authPhone, setAuthPhone, authName, setAuthName, authPassword, setAuthPassword,
    fetchMyGroups,
    allGroups,
    setAllGroups,
    fetchGroups,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};
