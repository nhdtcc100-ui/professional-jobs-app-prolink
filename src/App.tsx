import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Briefcase, Phone, PhoneOff } from 'lucide-react';
import { supabase } from './lib/supabase';
import { Post, Job, AppUser } from './types';
import { SkeletonPostCard } from './components/ui';
import { 
  ToastContainer, ProfileModal, PostTransmissionCard, AuthView, RoleSelectionView,
  PostBox, NewsCarousel, SearchView, ApplyJobModal, QuickShareJobModal, RelocateModal,
  OnboardingModal, useOnboarding, CallingOverlay, PostNewsCard, PostDetailModal,
  EmailVerificationScreen
} from './components/features';
import { mapProfile, useAppContext } from './contexts/AppContext';
import { IcyBackground, HomeSidebar, IntelligenceCenter, NotificationPanel, GlobalPostModal, MobileNav, Navbar } from './components/layout';
import { callService } from './lib/services/callService';
import { WebRTCService } from './lib/services/webRTCService';
import { profileService } from './lib/services/profileService';
import { JobDetailModal } from './components/features/missions/JobDetailModal';
import { JobCard } from './components/features/missions/JobCard';
import { CallsView } from './components/features';

declare global {
  interface Window {
    pendingPeerCall: any;
    onCallClosed?: () => void;
    quickShareJob?: (job: Job) => void;
    viewJobDetails?: (jobId: string) => void;
    refreshApplications?: () => void;
  }
}

// 🚀 Lazy-loaded heavy feature views (only downloaded when user navigates to them)
const MessagingView   = lazy(() => import('./components/features/MessagingView').then(m => ({ default: m.MessagingView })));
const MissionsView    = lazy(() => import('./components/features/MissionsView').then(m => ({ default: m.MissionsView })));
const NetworkView     = lazy(() => import('./components/features/NetworkView').then(m => ({ default: m.NetworkView })));
const NewsView        = lazy(() => import('./components/features/NewsView').then(m => ({ default: m.NewsView })));
const GroupsView      = lazy(() => import('./components/features/GroupsView').then(m => ({ default: m.GroupsView })));
const AdminDashboard  = lazy(() => import('./components/features/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const ERPView         = lazy(() => import('./components/features/erp/ERPView').then(m => ({ default: m.ERPView })));

// Fallback spinner for Suspense
const TabSkeleton = () => (
  <div className="space-y-4 pt-2">
    {[...Array(3)].map((_, i) => <SkeletonPostCard key={i} />)}
  </div>
);

function App() {
  const {
    user, appUser, loading, needsRole, authLoading, authMode, setAuthMode,
    pendingEmailVerification, setPendingEmailVerification,
    posts, setPosts, jobs, allUsers, connections, notifications, messages, reports,
    activeTab, setActiveTab, searchQuery, setSearchQuery,
    selectedProfile, setSelectedProfile, isEditingProfile, setIsEditingProfile,
    toasts, showNotifications, setShowNotifications, showAdmin, setShowAdmin,
    selectedChat, setSelectedChat,
    selectedGroup, setSelectedGroup,
    addToast, handleGoogleLogin, handleEmailLogin, handleEmailSignUp, handlePhoneAuth, logout,
    handleApplyJob, setAppUser, selectRole, handleSyncSignal, handleAcceptSync,
    handleLike, handleAddComment, handleEchoPost, handleRelocateToUser, toggleProRank,
    setNotifications, setAllUsers, setMessages,
    authEmail, setAuthEmail, authPhone, setAuthPhone, authName, setAuthName, authPassword, setAuthPassword,
    myGroups, fetchMyGroups, allGroups, fetchGroups,
    theme, toggleTheme
  } = useAppContext();

  useEffect(() => {
    fetchGroups();
  }, []);

  const [isApplying, setIsApplying] = useState(false);
  const [applyingJob, setApplyingJob] = useState<Job | null>(null);
  const [sharingJob, setSharingJob] = useState<Job | null>(null);
  const [cvCoverLetter, setCvCoverLetter] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showPostFormGlobal, setShowPostFormGlobal] = useState(false);
  const [sharedPost, setSharedPost] = useState<Post | null>(null);
  const [relocatingPost, setRelocatingPost] = useState<Post | null>(null);
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const [cvExperience, setCvExperience] = useState('');
  const [cvEducation, setCvEducation] = useState('');
  const [cvExperiences, setCvExperiences] = useState<any[]>([]);
  const [cvFileObj, setCvFileObj] = useState<File | null>(null);
  const [applySuccess, setApplySuccess] = useState(false);
  const [isSelectingRole, setIsSelectingRole] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());
  const [activeCall, setActiveCall] = useState<{
    id?: string;
    user: any;
    type: 'incoming' | 'outgoing' | 'active';
    show: boolean;
    isExpanded: boolean;
    callMode: 'voice' | 'video';
  } | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [selectedPostDetail, setSelectedPostDetail] = useState<Post | null>(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState<Job | null>(null);
  const webRTCServiceRef = useRef<WebRTCService | null>(null);
  
  // 💓 Presence Heartbeat: Update 'last_seen_at' every 60 seconds
  useEffect(() => {
    if (!appUser?.id) return;
    
    const updatePresence = () => {
      profileService.updateProfile(appUser.id, { 
        last_seen_at: new Date().toISOString() 
      }).catch(err => {
        console.warn("Presence update skipped:", err.message || "Column missing");
      });
    };

    updatePresence(); // Initial update
    const heartbeat = setInterval(updatePresence, 60000);
    return () => clearInterval(heartbeat);
  }, [appUser?.id]);

  const callTimeoutRef = useRef<any>(null);

  // ── Global Scroll to Top on Tab Change ──────────────────────────────────
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  // Handle global tab change events (e.g. from Admin Panel)
  useEffect(() => {
    const handleSetTab = (e: any) => {
      if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener('setTab', handleSetTab);
    return () => window.removeEventListener('setTab', handleSetTab);
  }, [setActiveTab]);

  // ── Call Timeout Logic (WhatsApp Style) ──────────────────────────────────
  useEffect(() => {
    if (activeCall?.type === 'outgoing' && activeCall.show) {
      // Set 45 second timeout
      callTimeoutRef.current = setTimeout(() => {
        if (activeCall.type === 'outgoing') {
          addToast('لا يوجد رد من الطرف الآخر', 'error');
          endCall();
        }
      }, 45000);
    } else {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    }
    return () => {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    };
  }, [activeCall?.type, activeCall?.show]);

  const activeCallRef = useRef(activeCall);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!appUser?.id) return;
    
    // Initialize WebRTC
    webRTCServiceRef.current = new WebRTCService(appUser.id);
    
    // Listen for incoming PeerJS calls (The media part)
    webRTCServiceRef.current.onIncomingCall((peerCall) => {
      console.log("DEBUG: WebRTC Incoming Call Received from PeerJS");
      // Store the pending peer call to answer it when user clicks Accept
      window.pendingPeerCall = peerCall;
    });

    return () => {
      webRTCServiceRef.current?.destroy();
      webRTCServiceRef.current = null;
    };
  }, [appUser?.id]);

  useEffect(() => {
    activeCallRef.current = activeCall;
    // Handle ringtone logic
    if (activeCall?.type === 'incoming' && activeCall.show && !activeCall.isExpanded) {
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
        ringtoneRef.current.loop = true;
      }
      ringtoneRef.current.play().catch(e => console.log("Audio play blocked"));
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }
  }, [activeCall]);

  const endCall = async () => {
    if (!activeCallRef.current) return;
    const callToClose = activeCallRef.current;
    
    // 🚀 Optimistic UI: Clear local state immediately for instant feedback
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    activeCallRef.current = null;

    console.log("DEBUG: fail-safe endCall initiated");
    try {
      if (callToClose?.id) {
        // If it was ringing and ended by caller, it's a missed call
        if (callToClose.type === 'outgoing' && !remoteStream) {
          await callService.notifyMissedCall(appUser?.id || '', callToClose.user.id, appUser?.name || 'مستخدم', callToClose.callMode);
        }
        await callService.endCall(callToClose.id);
      } else if (callToClose?.user?.id) {
        // Fallback
        await (supabase as any).from('calls')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .or(`and(caller_id.eq.${appUser?.id},receiver_id.eq.${callToClose.user.id}),and(caller_id.eq.${callToClose.user.id},receiver_id.eq.${appUser?.id})`)
          .eq('status', 'ringing');
      }
      webRTCServiceRef.current?.endCall();
    } catch (err) {
      console.warn("DEBUG: endCall failed:", err);
    } finally {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      addToast('تم إنهاء المكالمة', 'success');
    }
  };


  // Global hook for PeerJS closing
  React.useEffect(() => {
    window.onCallClosed = () => {
      console.log("DEBUG: window.onCallClosed triggered");
      endCall();
    };
    return () => { delete window.onCallClosed; };
  }, []);

  // Cleanup on tab close
  useEffect(() => {
    const handleUnload = () => {
      if (activeCallRef.current) endCall();
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  useEffect(() => {
    if (!appUser?.id) return;

    const channel = callService.subscribeToCalls(appUser.id, async (payload) => {
      console.log("DEBUG: App.tsx received event from Service:", payload);
      const eventType = payload.eventType || payload.event;
      
      // 1. Handle New Incoming Call (INSERT)
      if (eventType === 'INSERT') {
        const incomingCall = payload.new;
        if (incomingCall.receiver_id !== appUser.id) return;
        if (activeCallRef.current?.show) return; 
        if (incomingCall.status !== 'ringing') return;

        addToast('📞 مكالمة مهنية واردة...', 'success');
        setActiveCall({ 
          id: incomingCall.id, 
          user: { name: 'مستخدم ProLink', avatar: null },
          type: 'incoming', 
          show: true,
          isExpanded: false,
          callMode: incomingCall.type || 'voice'
        });

        const { data: callerData } = await supabase.from('profiles').select('id, name, avatar_url, role, title, company_name, is_pro').eq('id', incomingCall.caller_id).single();
        if (callerData) setActiveCall(prev => prev ? { ...prev, user: mapProfile(callerData) } : null);
      }

      // 2. Handle Call Updates (UPDATE)
      if (eventType === 'UPDATE') {
        const updatedCall = payload.new;
        const currentActive = activeCallRef.current;
        if (!currentActive) return;

        // Robust match: Check ID or match participants in either direction
        const isMatch = currentActive.id === updatedCall.id || 
                       (updatedCall.caller_id === appUser.id && updatedCall.receiver_id === currentActive.user?.id) ||
                       (updatedCall.receiver_id === appUser.id && updatedCall.caller_id === currentActive.user?.id);

        if (!isMatch) return;

        console.log("DEBUG: Call Update Received - Status:", updatedCall.status);

        if (updatedCall.status === 'ended') {
          console.log("DEBUG: Call status 'ended' detected for ID:", updatedCall.id);
          endCall();
        } else if (updatedCall.status === 'active' && currentActive.type === 'outgoing') {
          console.log("DEBUG: Receiver accepted, transitioning UI and starting media...");
          
          // 1. Transition UI Instantly
          setActiveCall(prev => prev ? { ...prev, type: 'active', id: updatedCall.id } : null);
          addToast('تم قبول المكالمة', 'success');

          // 2. Start Media in background
          const isVideo = currentActive.callMode === 'video';
          webRTCServiceRef.current?.getLocalStream(isVideo).then(async (stream) => {
            if (stream) {
              setLocalStream(stream);
              await webRTCServiceRef.current?.callUser(updatedCall.receiver_id, (rStream) => {
                console.log("DEBUG: Remote stream received for caller!");
                setRemoteStream(rStream);
              });
            }
          });
        }
      }
    });

    return () => { supabase.removeChannel(channel); };
  }, [appUser?.id]);

  // ── Call Handlers ───────────────────────────────────────────────────────────
  const startCall = async (u: any, mode: 'voice' | 'video' = 'voice') => {
    if (!appUser) return;
    setActiveCall({ user: u, type: 'outgoing', show: true, isExpanded: true, callMode: mode });
    
    try {
      const { data } = await callService.initiateCall(appUser.id, u.id, mode);
      if (data) {
        setActiveCall(prev => prev ? { ...prev, id: (data as any).id } : null);
      }
    } catch (e) {
      addToast('فشل بدء الاتصال', 'error');
      setActiveCall(null);
    }
  };

  const acceptCall = async () => {
    if (!activeCall?.id) return;
    
    // 1. Update UI and DB
    setActiveCall(prev => prev ? { ...prev, type: 'active', isExpanded: true } : null);
    await callService.acceptCall(activeCall.id);

    // 2. Connect Media
    const peerCall = window.pendingPeerCall;
    if (peerCall && webRTCServiceRef.current) {
      const lStream = await webRTCServiceRef.current.getLocalStream(activeCall.callMode === 'video');
      if (lStream) setLocalStream(lStream);
      
      await webRTCServiceRef.current.answerCall(peerCall, (rStream) => {
        setRemoteStream(rStream);
      });
      window.pendingPeerCall = null;
    }
  };


  // ── Onboarding ─────────────────────────────────────────────────────────────
  const { showOnboarding, setShowOnboarding } = useOnboarding(appUser);

  React.useEffect(() => {
    window.quickShareJob = (job: Job) => {
      if (!appUser) {
        addToast('يرجى تسجيل الدخول أولاً', 'error');
        return;
      }
      setSharingJob(job);
    };

    window.viewJobDetails = (jobId: string) => {
      setActiveTab('jobs');
      const job = jobs.find(j => j.id === jobId);
      if (job) {
        setSearchQuery(job.title);
      }
    };
  }, [appUser, selectedChat, jobs, setActiveTab, addToast, setSearchQuery]);

  const handleShareJobToUser = async (targetUser: AppUser, job: Job) => {
    if (!appUser) return;
    try {
      const jobMsg = `[JOB_CARD:${job.id}|${job.title}|${job.company}|${job.location || 'عن بُعد'}|${job.salary || 'غير محدد'}|${job.image_url || ''}]`;
      const { error } = await (supabase as any).from('messages').insert([{ 
        sender_id: appUser.id, 
        receiver_id: targetUser.id, 
        content: jobMsg 
      }]);
      
      if (error) throw error;
      
      addToast(`تم إرسال الوظيفة إلى ${targetUser.name} ✅`);
      setSharingJob(null);
      setSelectedChat(targetUser);
      setActiveTab('messages');
    } catch (e) {
      addToast('فشل إرسال الوظيفة', 'error');
    }
  };

  const filteredPosts = posts.filter(p =>
    (p.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.authorName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredJobs = jobs.filter(j =>
    (j.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (j.company || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = allUsers.filter(u =>
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.companyName && u.companyName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredGroups = allGroups.filter(g =>
    (g.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col items-center justify-center relative overflow-hidden" dir="rtl">
      <IcyBackground />
      <div className="z-10 flex flex-col items-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-blue-600/20 rounded-full" />
          <div className="absolute top-0 w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <Briefcase className="absolute inset-0 m-auto text-blue-600 animate-pulse" size={32} />
        </div>
        <div className="mt-8 text-center">
          <h2 className="text-xl font-black text-slate-800 tracking-tighter mb-2">Elevate عراق</h2>
          <p className="font-bold text-slate-400 uppercase tracking-[0.3em] text-[10px] animate-pulse">
            {loading ? 'جاري الاتصال بالمجرة المهنية...' : 'جاري مزامنة ملفك الشخصي...'}
          </p>
        </div>
      </div>
    </div>
  );

  // ── Email Verification Screen (shown right after sign-up) ────────────────────
  if (pendingEmailVerification) {
    return (
      <EmailVerificationScreen
        email={pendingEmailVerification}
        onBack={() => {
          setPendingEmailVerification(null);
          setAuthMode('login');
        }}
      />
    );
  }

  if (!user) {
    return (
      <AuthView
        authMode={authMode} setAuthMode={setAuthMode}
        handleGoogleLogin={handleGoogleLogin} handleEmailLogin={handleEmailLogin}
        handleEmailSignUp={handleEmailSignUp} handlePhoneAuth={handlePhoneAuth}
        authLoading={authLoading} authEmail={authEmail} setAuthEmail={setAuthEmail}
        authPhone={authPhone} setAuthPhone={setAuthPhone}
        authName={authName} setAuthName={setAuthName}
        authPassword={authPassword} setAuthPassword={setAuthPassword}
      />
    );
  }

  if (needsRole || isSelectingRole) {
    return <RoleSelectionView selectRole={selectRole} />;
  }

  return (
    <div className="min-h-screen bg-[#f3f2ef] dark:bg-[#020817] text-slate-800 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900 font-sans transition-colors duration-500" dir="rtl">
      <IcyBackground />

      <Navbar
        activeTab={activeTab} setActiveTab={setActiveTab}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        showNotifications={showNotifications} setShowNotifications={setShowNotifications}
        notifications={notifications} appUser={appUser}
        setSelectedProfile={setSelectedProfile} setIsEditingProfile={setIsEditingProfile}
        toggleProRank={toggleProRank} setShowAdmin={setShowAdmin}
        setIsSelectingRole={setIsSelectingRole} logout={logout}
        theme={theme} toggleTheme={toggleTheme}
      />

      <MobileNav
        activeTab={activeTab} setActiveTab={setActiveTab}
        showMobileMenu={showMobileMenu} setShowMobileMenu={setShowMobileMenu}
        setShowPostFormGlobal={setShowPostFormGlobal}
        appUser={appUser} setSelectedProfile={setSelectedProfile}
        notifications={notifications}
        toggleProRank={toggleProRank} logout={logout}
        setShowAdmin={setShowAdmin}
      />

      <AnimatePresence mode="wait">
        {/* Incoming Call Notification Banner (Ultra-High Priority) */}
        {activeCall?.type === 'incoming' && activeCall.show && !activeCall.isExpanded && (
          <motion.div
            key="call-banner"
            initial={{ y: -120, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -120, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed top-6 left-4 right-4 md:left-auto md:right-6 md:w-[420px] z-[9999] bg-slate-900/95 backdrop-blur-2xl border-2 border-blue-500/30 rounded-[2.5rem] p-5 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.6)] cursor-pointer group ring-4 ring-blue-500/10"
            onClick={() => setActiveCall(prev => prev ? { ...prev, isExpanded: true } : null)}
          >
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-blue-500 rounded-2xl blur-md animate-pulse opacity-40" />
                <img 
                  src={activeCall.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeCall.user?.name || 'U')}&background=random`} 
                  className="relative w-16 h-16 rounded-2xl object-cover border-2 border-white/20 shadow-xl"
                  alt=""
                />
                <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-blue-500 rounded-full border-4 border-slate-900 flex items-center justify-center shadow-lg">
                  <Phone size={12} className="text-white animate-pulse" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-black text-white truncate tracking-tight">{activeCall.user?.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <p className="text-[11px] font-black text-blue-400 uppercase tracking-[0.2em] animate-pulse">
                     مكالمة {activeCall.callMode === 'video' ? 'فيديو' : 'صوتية'} واردة...
                  </p>
                </div>
              </div>

              <div className="flex gap-3 shrink-0">
                <button 
                  onClick={(e) => { e.stopPropagation(); endCall(); }}
                  className="w-12 h-12 flex items-center justify-center bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20 active:scale-95"
                >
                  <PhoneOff size={22} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); acceptCall(); }}
                  className="w-14 h-14 flex items-center justify-center bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/30 active:scale-95 animate-bounce"
                >
                  <Phone size={24} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeCall?.show && activeCall.isExpanded && (
          <motion.div 
            key="call-overlay-container" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[2001]"
          >
            <CallingOverlay 
              show={activeCall.show} 
              callId={activeCall.id}
              user={activeCall.user} 
              type={activeCall.type} 
              mode={activeCall.callMode}
              localStream={localStream}
              remoteStream={remoteStream}
              onEnd={endCall}
              onAccept={acceptCall}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Main Feed --- */}
      <main className={`relative z-10 ${activeTab === 'messages' ? 'max-w-7xl' : 'max-w-6xl'} mx-auto px-0 md:px-4 ${activeTab === 'messages' ? 'h-[100dvh] overflow-hidden' : 'pt-0 pb-28 md:pb-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'}`}>
        
        <GlobalPostModal
          showPostFormGlobal={showPostFormGlobal} setShowPostFormGlobal={setShowPostFormGlobal}
          appUser={appUser} setActiveTab={setActiveTab} addToast={addToast}
        />

        <AnimatePresence mode="wait">
          {applyingJob && appUser && (
            <ApplyJobModal
              key="apply-job-modal"
              applyingJob={applyingJob} appUser={appUser}
              applySuccess={applySuccess} setApplySuccess={setApplySuccess}
              setApplyingJob={setApplyingJob} cvCoverLetter={cvCoverLetter} setCvCoverLetter={setCvCoverLetter}
              cvFileObj={cvFileObj} setCvFileObj={setCvFileObj}
              cvExperience={cvExperience} setCvExperience={setCvExperience}
              cvEducation={cvEducation} setCvEducation={setCvEducation}
              isApplying={isApplying} setIsApplying={setIsApplying}
              isUploadingCv={isUploadingCv} setIsUploadingCv={setIsUploadingCv}
              addToast={addToast}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {showNotifications && (
            <NotificationPanel
              key="notification-panel"
              notifications={notifications} readNotifIds={readNotifIds}
              setReadNotifIds={setReadNotifIds} setNotifications={setNotifications}
              setShowNotifications={setShowNotifications} setActiveTab={setActiveTab}
              handleAcceptSync={handleAcceptSync} addToast={addToast}
            />
          )}
        </AnimatePresence>

        {/* Left: Profile & Links */}
        {activeTab !== 'messages' && (
          <HomeSidebar appUser={appUser} setSelectedProfile={setSelectedProfile} />
        )}

        {/* Center: Feed Transmission */}
        <div className={`${activeTab === 'messages' ? 'lg:col-span-12' : 'lg:col-span-6'} space-y-4`}>
          {searchQuery ? (
            <SearchView
              searchQuery={searchQuery} filteredUsers={filteredUsers}
              filteredJobs={filteredJobs} filteredPosts={filteredPosts}
              filteredGroups={filteredGroups}
              setSelectedProfile={setSelectedProfile} setActiveTab={setActiveTab}
              setSearchQuery={setSearchQuery} user={user} allUsers={allUsers}
              handleEchoPost={handleEchoPost} setRelocatingPost={setRelocatingPost}
              addToast={addToast} handleLike={handleLike} handleAddComment={handleAddComment}
              onDeletePost={(id) => setPosts(prev => prev.filter(p => p.id !== id))}
              setSelectedPostDetail={setSelectedPostDetail}
              onSelectGroup={(g) => { setSelectedChat(null); setSelectedGroup(g); setActiveTab('messages'); }}
            />
          ) : (
            <>
              {activeTab === 'home' && (
                <>
                  <NewsCarousel appUser={appUser} onViewAll={() => setActiveTab('news')} />
                  <PostBox avatar={appUser?.avatar} appUser={appUser} addToast={addToast} />
                  <div className="space-y-4 pb-20">
                    {(() => {
                      // Combined feed logic
                      const combined = [
                        ...posts.map(p => ({ ...p, feedType: 'post' })),
                        ...jobs.map(j => ({ ...j, feedType: 'job', timestamp: j.postedAt }))
                      ].sort((a, b) => {
                        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date();
                        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date();
                        return dateB.getTime() - dateA.getTime();
                      });

                      return combined.map((item: any, idx) => (
                        <React.Fragment key={item.id}>
                          {item.feedType === 'post' ? (
                            <PostNewsCard
                              post={item}
                              delay={idx * 0.05}
                              onClick={() => setSelectedPostDetail(item)}
                              onAuthorClick={() => {
                                const found = allUsers.find(au => au.id === item.authorId);
                                if (found) setSelectedProfile(found);
                              }}
                              allUsers={allUsers}
                            />
                          ) : (
                            <div className="px-1">
                              <JobCard 
                                job={item} 
                                onClick={(job) => {
                                  setSelectedJobDetail(job as Job);
                                }}
                                delay={idx * 0.05}
                              />
                            </div>
                          )}
                        </React.Fragment>
                      ));
                    })()}
                  </div>
                  
                  <JobDetailModal
                    job={selectedJobDetail}
                    onClose={() => setSelectedJobDetail(null)}
                    onApply={(job, text) => {
                      setSelectedJobDetail(null);
                      handleApplyJob(job, text || '', null);
                    }}
                    onQuickApply={(job) => {
                      setSelectedJobDetail(null);
                      handleApplyJob(job, 'تقديم سريع عبر الواجهة الرئيسية', null);
                    }}
                    appUser={appUser}
                    allUsers={allUsers}
                  />
                </>
              )}

              {activeTab === 'jobs' && (
                <div className="pb-safe-bottom px-1 md:px-0">
                  <Suspense fallback={<TabSkeleton />}>
                    <MissionsView 
                      jobs={jobs} 
                      appUser={appUser} 
                      allUsers={allUsers}
                      addToast={addToast} 
                      messages={messages} 
                      onApplyJob={(job) => {
                        setApplyingJob(job);
                        setIsApplying(false);
                      }} 
                    />
                  </Suspense>
                </div>
              )}
              {activeTab === 'network' && (
                <div className="pb-safe-bottom px-1 md:px-0">
                  <Suspense fallback={<TabSkeleton />}>
                    <NetworkView users={allUsers} connections={connections} onUserClick={setSelectedProfile} onSyncSignal={handleSyncSignal} currentId={appUser?.id || ''} onMessageClick={(id) => { const u = allUsers.find(x => x.id === id); if (u) { setSelectedChat(u); setActiveTab('messages'); } }} />
                  </Suspense>
                </div>
              )}
              {activeTab === 'calls' && appUser?.isAdmin && (
                <div className="pb-safe-bottom px-1 md:px-0">
                  <CallsView 
                    appUser={appUser} 
                    allUsers={allUsers} 
                    onStartCall={startCall}
                    onSelectChat={(u) => { setSelectedChat(u); setActiveTab('messages'); }}
                  />
                </div>
              )}
              {activeTab === 'messages' && (
                <div className="pb-safe-bottom md:pb-0 h-full">
                  <Suspense fallback={<TabSkeleton />}>
                    <MessagingView 
                      messages={messages} 
                      setMessages={setMessages} 
                      currentUser={appUser} 
                      allUsers={allUsers} 
                      connections={connections} 
                      notifications={notifications}
                      selectedChat={selectedChat} 
                      onSelectChat={setSelectedChat}
                      selectedGroup={selectedGroup}
                      setSelectedGroup={setSelectedGroup}
                      myGroups={myGroups}
                      addToast={addToast}
                      fetchMyGroups={fetchMyGroups}
                      setSelectedProfile={setSelectedProfile}
                      onStartCall={startCall}
                    />
                  </Suspense>
                </div>
              )}
              {activeTab === 'news' && (
                <div className="pb-safe-bottom px-1 md:px-0">
                  <Suspense fallback={<TabSkeleton />}>
                    <NewsView appUser={appUser} />
                  </Suspense>
                </div>
              )}
              {activeTab === 'erp' && appUser?.isAdmin && (
                <div className="pb-safe-bottom px-1 md:px-0">
                  <Suspense fallback={<TabSkeleton />}>
                    <ERPView appUser={appUser} addToast={addToast} />
                  </Suspense>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Intelligence Center */}
        {activeTab !== 'messages' && (
          <IntelligenceCenter addToast={addToast} />
        )}

        <AnimatePresence mode="wait">
          {relocatingPost && (
            <RelocateModal
              key="relocate-modal"
              post={relocatingPost} connections={connections} allUsers={allUsers}
              currentId={appUser?.id || ''} onClose={() => setRelocatingPost(null)}
              onRelocate={(u) => { handleRelocateToUser(u, relocatingPost); setRelocatingPost(null); }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {sharingJob && (
            <QuickShareJobModal
              key="share-job-modal"
              job={sharingJob} connections={connections} allUsers={allUsers}
              currentId={appUser?.id || ''} onClose={() => setSharingJob(null)}
              onShare={(u) => handleShareJobToUser(u, sharingJob)}
            />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence mode="wait">
        {selectedProfile && (
          <ProfileModal
            key="profile-modal"
            profile={selectedProfile} isMe={selectedProfile.id === appUser?.id}
            isEditing={isEditingProfile} user={user}
            isConnected={connections.some(c =>
              c.status === 'accepted' &&
              ((c.requesterId === appUser?.id && c.recipientId === selectedProfile.id) ||
                (c.requesterId === selectedProfile.id && c.recipientId === appUser?.id))
            )}
            onSyncSignal={() => handleSyncSignal(selectedProfile)}
            handleRelocatePost={handleEchoPost} setRelocatingPost={setRelocatingPost}
            addToast={addToast} onLike={handleLike} onAddComment={handleAddComment}
            onClose={() => { setSelectedProfile(null); setIsEditingProfile(false); }}
            setAppUser={(updated) => {
              setAppUser(updated as any);
              setSelectedProfile(updated as any);
            }}
            onMessageClick={() => {
              setSelectedChat(selectedProfile);
              setActiveTab('messages');
              setSelectedProfile(null);
            }}
            onCallClick={startCall}
            onSave={async (updates) => {
              // ProfileModal handles DB writes via profileService.updateProfile.
              // Here we only sync the local state so the rest of the app reflects changes instantly.
              if (appUser) {
                const merged = { ...appUser, ...updates };
                setAppUser(merged as any);
                setSelectedProfile(merged as any);
              }
            }}
          />
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} />

      {/* Onboarding Modal for new users */}
      <AnimatePresence mode="wait">
        {showOnboarding && appUser && (
          <OnboardingModal
            key="onboarding-modal"
            appUser={appUser}
            onClose={() => setShowOnboarding(false)}
            setActiveTab={setActiveTab}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {selectedPostDetail && (
          <PostDetailModal
            post={selectedPostDetail}
            appUser={appUser}
            onClose={() => setSelectedPostDetail(null)}
            onLike={handleLike}
            onAddComment={handleAddComment}
            onEcho={handleEchoPost}
            onShareToGroup={(p) => { 
               setSharedPost(p); 
               setActiveTab('messages'); 
               setSelectedPostDetail(null);
               addToast('تمت إضافة المنشور للمشاركة في المجموعات 🌐'); 
            }}
            onRelocate={(p) => {
               setRelocatingPost(p);
               setSelectedPostDetail(null);
            }}
            allUsers={allUsers}
            addToast={addToast}
            setSelectedProfile={setSelectedProfile}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showAdmin && appUser?.isAdmin && (
          <Suspense fallback={null} key="admin-dashboard">
            <AdminDashboard reports={reports} onClose={() => setShowAdmin(false)} addToast={addToast} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
