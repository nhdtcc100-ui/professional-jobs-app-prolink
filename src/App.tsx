import React, { useState, useEffect, useRef, Suspense, lazy, useCallback, useMemo } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  loadMissionsView,
  loadNetworkView,
  loadNewsView,
  loadGroupsView,
  loadAdminDashboard,
  loadERPView,
  loadAboutPage,
  loadProfilePage,
  loadServicesView,
  loadSettingsPage,
  preloadTab
} from './lib/lazyPreload';
import { Briefcase, Phone, PhoneOff, RefreshCw, MessageSquare, Shield } from 'lucide-react';
import { supabase } from './lib/supabase';
import { Post, Job, AppUser } from './types';
import { SkeletonPostCard } from './components/ui';
import { 
  ToastContainer, ProfileModal, PostTransmissionCard, AuthView, RoleSelectionView,
  PostBox, NewsCarousel, SearchView, ApplyJobModal, QuickShareJobModal, RelocateModal,
  OnboardingModal, useOnboarding, CallingOverlay, PostNewsCard, PostDetailModal,
  EmailVerificationScreen, DetailFeedPage, EditPostModal
} from './components/features';
import { SmartJobBanner } from './components/features/SmartJobBanner';
import { mapProfile, useAppContext } from './contexts/AppContext';
import { IcyBackground, HomeSidebar, IntelligenceCenter, NotificationPanel, GlobalPostModal, MobileNav, Navbar } from './components/layout';
import { callService } from './lib/services/callService';
import { WebRTCService } from './lib/services/webRTCService';
import { profileService } from './lib/services/profileService';
import { JobDetailModal } from './components/features/missions/JobDetailModal';
import { JobPostForm } from './components/features/missions/JobPostForm';
import { JobCard } from './components/features/missions/JobCard';
import { EditJobModal } from './components/features/missions/EditJobModal';
import { CallsView } from './components/features';
import { jobService } from './lib/services/jobService';
import { AlertBanner } from './components/features/security/AlertBanner';
import { SecurityAlertToast } from './components/features/security/SecurityAlertToast';
import { initAntiInspect, setAntiInspectUser } from './lib/security/antiInspect';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { RecedeCard } from './components/common/RecedeCard';
import { GuestBanner } from './components/common/GuestBanner';
import { isJobPoster, canUserPostAndInteract } from './lib/utils/roleUtils';
import { JobCategoriesCard } from './components/features/missions/JobCategoriesCard';
import { HomeServicesSection } from './components/features/services/HomeServicesSection';
import { getJobCategory, isJobInCategory } from './lib/utils/jobCategoryUtils';
import { useMobileBackButton } from './lib/hooks/useMobileBackButton';

declare global {
  interface Window {
    pendingPeerCall: any;
    onCallClosed?: () => void;
    quickShareJob?: (job: Job) => void;
    viewJobDetails?: (jobId: string) => void;
    refreshApplications?: () => void;
  }
}

import { MessagingView } from './components/features/MessagingView';

// ðŸš€ Lazy-loaded heavy feature views (integrated with preloadTab)
const MissionsView    = lazy(() => loadMissionsView().then(m => ({ default: m.MissionsView })));
const NetworkView     = lazy(() => loadNetworkView().then(m => ({ default: m.NetworkView })));
const NewsView        = lazy(() => loadNewsView().then(m => ({ default: m.NewsView })));
const GroupsView      = lazy(() => loadGroupsView().then(m => ({ default: m.GroupsView })));
const AdminDashboard  = lazy(() => loadAdminDashboard().then(m => ({ default: m.AdminDashboard })));
const ERPView         = lazy(() => loadERPView().then(m => ({ default: m.ERPView })));
const AboutPage       = lazy(() => loadAboutPage().then(m => ({ default: m.AboutPage })));
const ProfilePage     = lazy(() => loadProfilePage().then(m => ({ default: m.ProfilePage })) as any);
const ServicesView    = lazy(() => loadServicesView().then(m => ({ default: m.ServicesView })));
const SettingsPage    = lazy(() => loadSettingsPage().then(m => ({ default: m.SettingsPage })));

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
    handleAcceptConnection, handleRejectConnection,
    handleLike, handleDislike, handleAddComment, handleEchoPost, handleRelocateToUser, toggleProRank,
    setNotifications, readNotifIds, setReadNotifIds, setAllUsers, setMessages,
    authEmail, setAuthEmail, authPhone, setAuthPhone, authName, setAuthName, authPassword, setAuthPassword,
    myGroups, fetchMyGroups, allGroups, fetchGroups,
    isPublishingArticle,
    theme, toggleTheme, refreshData,
    isGuestMode, enterGuestMode, exitGuestMode,
  } = useAppContext();

  // âš¡ Keep-alive visited tabs tracker for instant navigation and scroll preservation
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>({ [activeTab || 'home']: true });

  useEffect(() => {
    if (activeTab && !visitedTabs[activeTab]) {
      setVisitedTabs(prev => ({ ...prev, [activeTab]: true }));
    }
  }, [activeTab, visitedTabs]);

  useEffect(() => {
    fetchGroups();
    initAntiInspect(appUser);
  }, []);

  useEffect(() => {
    setAntiInspectUser(appUser);
  }, [appUser]);

  // â”€â”€ Ø®Ø±ÙˆØ¬ ÙˆØ¶Ø¹ Ø§Ù„Ø²Ø§Ø¦Ø± ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ø¹Ù†Ø¯ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ â”€â”€
  useEffect(() => {
    if (user && isGuestMode) {
      exitGuestMode();
    }
  }, [user, isGuestMode, exitGuestMode]);

  // â”€â”€ requireAuth: ÙŠØ¬Ø¨ Ø£Ù† ÙŠÙƒÙˆÙ† Ù‡Ù†Ø§ (Ù‚Ø¨Ù„ Ø£ÙŠ early return) Ù„Ø§Ø­ØªØ±Ø§Ù… Rules of Hooks â”€â”€
  const requireAuth = useCallback((message?: string) => {
    if (!appUser) {
      addToast(message || 'Ø³Ø¬Ù‘Ù„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ù„Ù„ØªÙØ§Ø¹Ù„ Ù…Ø¹ Ø§Ù„Ù…Ø­ØªÙˆÙ‰ ðŸ”’', 'error');
      return false;
    }
    return true;
  }, [appUser, addToast]);

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
  const [editingFeedJob, setEditingFeedJob] = useState<Job | null>(null);
  const [editingFeedPost, setEditingFeedPost] = useState<Post | null>(null);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
  const [detailFeed, setDetailFeed] = useState<{
    type: 'job' | 'news' | 'post';
    items: any[];
    initialIndex: number;
  } | null>(null);

  const [activeCall, setActiveCall] = useState<{
    id?: string;
    user: any;
    type: 'incoming' | 'outgoing' | 'active';
    show: boolean;
    isExpanded: boolean;
    callMode: 'voice' | 'video';
  } | null>(null);

  // ðŸ’¼ Page View state for posting a job
  const [pageJobFormData, setPageJobFormData] = useState({
    title: '', company: appUser?.companyName || '', description: '', requirements: '',
    location: '', salary: '', jobType: 'Ø¯ÙˆØ§Ù… ÙƒØ§Ù…Ù„', category: '', working_hours: '', imageUrl: '', is_active: true
  });
  const [isPostingJobPage, setIsPostingJobPage] = useState(false);
  const [selectedJobCategory, setSelectedJobCategory] = useState<string>('Ø§Ù„ÙƒÙ„');

  // âš¡ ØªØºØ°ÙŠØ© Ù…Ø¯Ù…Ø¬Ø© ÙˆÙ…ÙÙ„ØªØ±Ø© ÙˆÙ…Ø®Ø²Ù†Ø© Ù…Ø¤Ù‚ØªØ§Ù‹ Ø¹Ø¨Ø± useMemo Ù„Ù…Ù†Ø­ Ø³Ø±Ø¹Ø© ÙØ§Ø¦Ù‚Ø© 60FPS Ø¹Ù†Ø¯ Ø§Ù„ØªÙ†Ù‚Ù„ Ø¨ÙŠÙ† Ø£Ù‚Ø³Ø§Ù… Ø§Ù„ÙˆØ¸Ø§Ø¦Ù
  const memoizedCombinedFeed = useMemo(() => {
    const filteredFeedJobs = selectedJobCategory === 'Ø§Ù„ÙƒÙ„'
      ? jobs
      : jobs.filter(j => isJobInCategory(j, selectedJobCategory));

    const feedPosts = selectedJobCategory === 'Ø§Ù„ÙƒÙ„'
      ? posts
      : (selectedJobCategory === 'Ø£Ø®Ø¨Ø§Ø±' ? posts : []);

    return [
      ...feedPosts.map(p => ({ ...p, feedType: 'post' as const })),
      ...filteredFeedJobs.map(j => ({ ...j, feedType: 'job' as const, timestamp: j.postedAt }))
    ].sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date();
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date();
      return dateB.getTime() - dateA.getTime();
    });
  }, [jobs, posts, selectedJobCategory]);

  const handlePostJobFromPage = async () => {
    if (!appUser) return;
    if (!isJobPoster(appUser)) {
      addToast('Ù†Ø´Ø± Ø§Ù„ÙˆØ¸Ø§Ø¦Ù Ù…Ø®ØµØµ Ù„Ø£ØµØ­Ø§Ø¨ Ø§Ù„Ø¹Ù…Ù„ ÙˆØ§Ù„Ù…Ø¤Ø³Ø³Ø§Øª ÙÙ‚Ø· ðŸš«', 'error');
      return;
    }
    if (appUser.isActive === false) {
      addToast('Ø­Ø³Ø§Ø¨Ùƒ Ù…Ø­Ø¸ÙˆØ± ÙˆÙ„Ø§ ÙŠÙ…ÙƒÙ†Ùƒ Ù†Ø´Ø± ÙˆØ¸Ø§Ø¦Ù ðŸš«', 'error');
      return;
    }
    if (!pageJobFormData.title.trim()) { addToast('ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„Ù…Ø³Ù…Ù‰ Ø§Ù„ÙˆØ¸ÙŠÙÙŠ', 'error'); return; }
    if (!pageJobFormData.category?.trim()) {
      addToast('ÙŠØ±Ø¬Ù‰ ØªØ­Ø¯ÙŠØ¯ Ù‚Ø³Ù… Ø§Ù„ÙˆØ¸ÙŠÙØ© (Ø­Ù‚Ù„ Ø¥Ø¬Ø¨Ø§Ø±ÙŠ) âš ï¸', 'error');
      return;
    }

    setIsPostingJobPage(true);
    try {
      const postData = {
        title: pageJobFormData.title,
        company: pageJobFormData.company || appUser.companyName || 'Ù…Ø¤Ø³Ø³Ø© ØºÙŠØ± Ù…Ø¹Ø±ÙØ©',
        description: pageJobFormData.description,
        requirements: pageJobFormData.requirements,
        location: pageJobFormData.location || appUser.location || 'Ø¹Ù† Ø¨ÙØ¹Ø¯',
        salary: pageJobFormData.salary,
        jobType: pageJobFormData.jobType,
        category: pageJobFormData.category,
        working_hours: pageJobFormData.working_hours,
        imageUrl: appUser.avatar || '',
        employer_id: appUser.id,
        is_active: true,
      };

      const { error } = await jobService.postJob(postData);
      if (error) throw error;

      addToast('ðŸš€ ØªÙ… Ù†Ø´Ø± Ø§Ù„ÙˆØ¸ÙŠÙØ© Ø¨Ù†Ø¬Ø§Ø­!');
      setPageJobFormData({
        title: '', company: appUser?.companyName || '', description: '', requirements: '',
        location: '', salary: '', jobType: 'Ø¯ÙˆØ§Ù… ÙƒØ§Ù…Ù„', category: '', working_hours: '', imageUrl: '', is_active: true
      });
      setActiveTab('home');
    } catch (e: any) {
      addToast('ÙØ´Ù„ Ø§Ù„Ù†Ø´Ø±: ' + e.message, 'error');
    } finally {
      setIsPostingJobPage(false);
    }
  };

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [selectedPostDetail, setSelectedPostDetail] = useState<Post | null>(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState<Job | null>(null);
  const [returnToJob, setReturnToJob] = useState<Job | null>(null);
  const [returnToDetailFeed, setReturnToDetailFeed] = useState<{
    type: 'job' | 'news' | 'post';
    items: any[];
    initialIndex: number;
  } | null>(null);
  const [returnToSearch, setReturnToSearch] = useState<string | null>(null);
  const [initialJobForMissions, setInitialJobForMissions] = useState<Job | null>(null);
  const webRTCServiceRef = useRef<WebRTCService | null>(null);
  
  // ðŸ’“ Presence Heartbeat: Update 'last_seen_at' every 60 seconds
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

  // ðŸ“± Detect mobile vs desktop/iPad screen size
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // On all devices (Mobile, iPad, Desktop): opening a profile switches activeTab to 'profile' (page mode)
  useEffect(() => {
    if (selectedProfile) {
      // Remember search context so back button returns to search results
      if (searchQuery && searchQuery.trim().length > 0) {
        setReturnToSearch(searchQuery);
      }
      setActiveTab('profile');
    }
  }, [selectedProfile]);

  // ðŸ”— viewUserProfile event â€” dispatched by components to open a profile
  useEffect(() => {
    const handler = (e: Event) => {
      const userId = (e as CustomEvent).detail;
      const found = allUsers.find(u => u.id === userId);
      if (found) {
        setSelectedProfile(found);
        setActiveTab('profile');
      }
    };
    window.addEventListener('viewUserProfile', handler);
    return () => window.removeEventListener('viewUserProfile', handler);
  }, [allUsers, setSelectedProfile, setActiveTab]);



  const callTimeoutRef = useRef<any>(null);

  // â”€â”€ Global Scroll to Top on Tab Change & Overflow Safety â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    try {
      document.body.style.overflow = '';
    } catch (_) {}
  }, [activeTab]);

  // Handle global tab change events (e.g. from Admin Panel)
  useEffect(() => {
    const handleSetTab = (e: any) => {
      if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener('setTab', handleSetTab);
    return () => window.removeEventListener('setTab', handleSetTab);
  }, [setActiveTab]);

  // Handle guest mode exit from anywhere in the app (e.g. mobile drawer)
  useEffect(() => {
    const handleExit = () => exitGuestMode();
    window.addEventListener('prolink:exitGuestMode', handleExit);
    return () => window.removeEventListener('prolink:exitGuestMode', handleExit);
  }, [exitGuestMode]);

  // â”€â”€ Call Timeout Logic (WhatsApp Style) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (activeCall?.type === 'outgoing' && activeCall.show) {
      // Set 45 second timeout
      callTimeoutRef.current = setTimeout(() => {
        if (activeCall.type === 'outgoing') {
          addToast('Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø±Ø¯ Ù…Ù† Ø§Ù„Ø·Ø±Ù Ø§Ù„Ø¢Ø®Ø±', 'error');
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
    
    // Initialize WebRTC safely
    try {
      webRTCServiceRef.current = new WebRTCService(appUser.id);
      
      // Listen for incoming PeerJS calls (The media part)
      webRTCServiceRef.current.onIncomingCall((peerCall) => {
        window.pendingPeerCall = peerCall;
      });
    } catch (err) {
      console.warn('[WebRTC] Initialization bypassed:', err);
    }

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
    
    // ðŸš€ Optimistic UI: Clear local state immediately for instant feedback
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    activeCallRef.current = null;

    console.log("DEBUG: fail-safe endCall initiated");
    try {
      if (callToClose?.id) {
        // If it was ringing and ended by caller, it's a missed call
        if (callToClose.type === 'outgoing' && !remoteStream) {
          await callService.notifyMissedCall(appUser?.id || '', callToClose.user.id, appUser?.name || 'Ù…Ø³ØªØ®Ø¯Ù…', callToClose.callMode);
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
      addToast('ØªÙ… Ø¥Ù†Ù‡Ø§Ø¡ Ø§Ù„Ù…ÙƒØ§Ù„Ù…Ø©', 'success');
    }
  };

  // ðŸ“± Universal Android Hardware Back Button & Mobile Popstate Controller
  useMobileBackButton({
    activeCall,
    endCall,
    detailFeed,
    setDetailFeed,
    selectedPostDetail,
    setSelectedPostDetail,
    selectedJobDetail,
    setSelectedJobDetail,
    applyingJob,
    setApplyingJob,
    editingFeedJob,
    setEditingFeedJob,
    editingFeedPost,
    setEditingFeedPost,
    showPostFormGlobal,
    setShowPostFormGlobal,
    relocatingPost,
    setRelocatingPost,
    sharingJob,
    setSharingJob,
    showMobileMenu,
    setShowMobileMenu,
    showNotifications,
    setShowNotifications,
    showAdmin,
    setShowAdmin,
    selectedChat,
    setSelectedChat,
    selectedProfile,
    setSelectedProfile,
    isEditingProfile,
    setIsEditingProfile,
    activeTab,
    setActiveTab,
    addToast,
  });


  // Global hook for PeerJS closing
  React.useEffect(() => {
    window.onCallClosed = () => {
      console.log("DEBUG: window.onCallClosed triggered");
      endCall();
    };
    return () => { delete window.onCallClosed; };
  }, []);

  // Close notifications modal when navigating between tabs
  useEffect(() => {
    setShowNotifications(false);
  }, [activeTab]);

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

        addToast('ðŸ“ž Ù…ÙƒØ§Ù„Ù…Ø© Ù…Ù‡Ù†ÙŠØ© ÙˆØ§Ø±Ø¯Ø©...', 'success');
        setActiveCall({ 
          id: incomingCall.id, 
          user: { name: 'Ù…Ø³ØªØ®Ø¯Ù… ProLink', avatar: null },
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
          addToast('ØªÙ… Ù‚Ø¨ÙˆÙ„ Ø§Ù„Ù…ÙƒØ§Ù„Ù…Ø©', 'success');

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

    return () => { channel.unsubscribe(); };
  }, [appUser?.id]);

  // â”€â”€ Call Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startCall = async (u: any, mode: 'voice' | 'video' = 'voice') => {
    if (!appUser) return;

    // ðŸ”’ Ø®Ø§ØµÙŠØ© Ø§Ù„Ù…ÙƒØ§Ù„Ù…Ø§Øª Ù…Ø®ØµØµØ© Ù„Ù„Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø¹Ù„ÙŠØ§ ÙÙ‚Ø·
    if (!appUser.isAdmin) {
      addToast('Ø®Ø§ØµÙŠØ© Ø§Ù„Ù…ÙƒØ§Ù„Ù…Ø§Øª Ø§Ù„ØµÙˆØªÙŠØ© ÙˆØ§Ù„Ù…Ø±Ø¦ÙŠØ© Ù…Ø®ØµØµØ© Ù„Ù„Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø¹Ù„ÙŠØ§ ÙÙ‚Ø· ðŸ”’', 'error');
      return;
    }

    setActiveCall({ user: u, type: 'outgoing', show: true, isExpanded: true, callMode: mode });
    
    try {
      const { data } = await callService.initiateCall(appUser.id, u.id, mode);
      if (data) {
        setActiveCall(prev => prev ? { ...prev, id: (data as any).id } : null);
      }
    } catch (e) {
      addToast('ÙØ´Ù„ Ø¨Ø¯Ø¡ Ø§Ù„Ø§ØªØµØ§Ù„', 'error');
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


  // â”€â”€ Onboarding â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { showOnboarding, setShowOnboarding } = useOnboarding(appUser);

  React.useEffect(() => {
    window.quickShareJob = (job: Job) => {
      if (!appUser) {
        addToast('ÙŠØ±Ø¬Ù‰ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø£ÙˆÙ„Ø§Ù‹', 'error');
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
      const jobMsg = `[JOB_CARD:${job.id}|${job.title}|${job.company}|${job.location || 'Ø¹Ù† Ø¨ÙØ¹Ø¯'}|${job.salary || 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯'}|${job.image_url || ''}]`;
      const { error } = await (supabase as any).from('messages').insert([{ 
        sender_id: appUser.id, 
        receiver_id: targetUser.id, 
        content: jobMsg 
      }]);
      
      if (error) throw error;
      
      addToast(`ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ÙˆØ¸ÙŠÙØ© Ø¥Ù„Ù‰ ${targetUser.name} âœ…`);
      setSharingJob(null);
      setSelectedChat(targetUser);
      setActiveTab('messages');
    } catch (e) {
      addToast('ÙØ´Ù„ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ÙˆØ¸ÙŠÙØ©', 'error');
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

  // Live database lookup when searching to guarantee all users & freelancers are found from database
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return;
    const term = searchQuery.trim();
    const timeout = setTimeout(async () => {
      try {
        const { data } = await (supabase.from('profiles') as any)
          .select('id, name, avatar_url, role, is_pro, title, display_title, specialty, company_name, location, is_available, bio')
          .or(`name.ilike.%${term}%,title.ilike.%${term}%,specialty.ilike.%${term}%,display_title.ilike.%${term}%,location.ilike.%${term}%,company_name.ilike.%${term}%`)
          .limit(30);

        if (data && data.length > 0) {
          const mapped: AppUser[] = data.map((p: any) => ({
            id: p.id,
            name: p.name || 'Ù…Ø¬Ù‡ÙˆÙ„',
            email: p.email || '',
            avatar: p.avatar_url || '',
            role: p.role || 'job_seeker',
            isPro: p.is_pro || false,
            is_pro: p.is_pro || false,
            title: p.title || '',
            displayTitle: p.display_title || p.title || p.specialty || '',
            specialty: p.specialty || '',
            companyName: p.company_name || '',
            location: p.location || '',
            isAvailable: p.is_available ?? true,
            bio: p.bio || '',
          }));
          setAllUsers(prev => {
            const existingIds = new Set(prev.map(u => u.id));
            const newUsers = mapped.filter((m: AppUser) => !existingIds.has(m.id));
            return newUsers.length > 0 ? [...prev, ...newUsers] : prev;
          });
        }
      } catch (e) {
        // quiet error handle
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, setAllUsers]);

  const filteredUsers = allUsers.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.companyName && u.companyName.toLowerCase().includes(q)) ||
      (u.title && u.title.toLowerCase().includes(q)) ||
      (u.specialty && u.specialty.toLowerCase().includes(q)) ||
      (u.displayTitle && u.displayTitle.toLowerCase().includes(q)) ||
      (u.location && u.location.toLowerCase().includes(q)) ||
      (u.bio && u.bio.toLowerCase().includes(q))
    );
  });

  const filteredGroups = allGroups.filter(g =>
    (g.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || (user && !appUser && !needsRole)) return (
    <div className="min-h-screen bg-[#f0f4f8] dark:bg-[#090d16] flex flex-col items-center justify-center relative overflow-hidden" dir="rtl">
      <IcyBackground />
      <div className="z-10 flex flex-col items-center">
        <div className="relative group">
          <div className="w-24 h-24 border-4 border-blue-600/20 rounded-[2.5rem]" />
          <div className="absolute top-0 w-24 h-24 border-4 border-blue-600 border-t-transparent rounded-[2.5rem] animate-spin" />
          <div className="absolute inset-0 m-auto w-16 h-16 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/40 bg-gradient-to-br from-[#0a2463] via-[#1e4fd9] to-[#002d5b] flex items-center justify-center">
            <img 
              src={`${import.meta.env.BASE_URL}logo.png`} 
              className="w-full h-full object-cover" 
              alt="Ù…Ù†ØµØ© Ø¹Ù…Ù„" 
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.style.display = 'none';
                const fb = el.parentElement?.querySelector('.logo-splash-fb') as HTMLElement;
                if (fb) fb.style.display = 'flex';
              }}
            />
            <div className="logo-splash-fb absolute inset-0 hidden items-center justify-center text-white font-black text-2xl">
              Ø¹
            </div>
          </div>
        </div>
        <div className="mt-8 text-center">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-2">Ù…Ù†ØµØ© Ø¹Ù…Ù„</h2>
          <p className="font-bold text-slate-400 uppercase tracking-[0.3em] text-[10px] animate-pulse">
            Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù…ÙŠÙ„ ÙÙŠ Ù…Ù†ØµØ© Ø¹Ù…Ù„...
          </p>
        </div>
      </div>
    </div>
  );

  // â”€â”€ Email Verification Screen (shown right after sign-up) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // requireAuth ØªÙ… Ù†Ù‚Ù„Ù‡ Ø¥Ù„Ù‰ Ø§Ù„Ø£Ø¹Ù„Ù‰ (Ù‚Ø¨Ù„ early returns) Ù„Ø¥ØµÙ„Ø§Ø­ React Error #300

  // â”€â”€ Guard: show auth screen if not logged in AND not in guest mode â”€â”€
  if (!user && !isGuestMode) {
    return (
      <AuthView
        authMode={authMode} setAuthMode={setAuthMode}
        handleGoogleLogin={handleGoogleLogin} handleEmailLogin={handleEmailLogin}
        handleEmailSignUp={handleEmailSignUp} handlePhoneAuth={handlePhoneAuth}
        authLoading={authLoading} authEmail={authEmail} setAuthEmail={setAuthEmail}
        authPhone={authPhone} setAuthPhone={setAuthPhone}
        authName={authName} setAuthName={setAuthName}
        authPassword={authPassword} setAuthPassword={setAuthPassword}
        onGuestMode={enterGuestMode}
      />
    );
  }

  if ((needsRole || isSelectingRole) && !isGuestMode) {
    return <RoleSelectionView selectRole={selectRole} appUser={appUser} />;
  }

  // ðŸš« Banned user screen
  if (appUser && appUser.isActive === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="max-w-sm w-full text-center">
          <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">ðŸš«</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-3">ØªÙ… ØªØ¹Ù„ÙŠÙ‚ Ø­Ø³Ø§Ø¨Ùƒ</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">ØªÙ… Ø­Ø¸Ø± Ø­Ø³Ø§Ø¨Ùƒ Ø¨ÙˆØ§Ø³Ø·Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©. Ø¥Ø°Ø§ ÙƒÙ†Øª ØªØ¹ØªÙ‚Ø¯ Ø£Ù† Ù‡Ø°Ø§ Ø®Ø·Ø£ØŒ ÙŠØ±Ø¬Ù‰ Ø§Ù„ØªÙˆØ§ØµÙ„ Ù…Ø¹ Ø§Ù„Ø¯Ø¹Ù… Ø§Ù„ÙÙ†ÙŠ.</p>
          <button
            onClick={logout}
            className="w-full py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-all active:scale-95"
          >
            ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f2ef] dark:bg-[#0d1117] text-slate-800 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900 font-sans transition-colors duration-500" dir="rtl">
      <IcyBackground />

      {!showAdmin && (
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
      )}

      {!showAdmin && !applyingJob && !detailFeed && !isPublishingArticle && !showPostFormGlobal && !editingFeedPost && !editingFeedJob && activeTab !== 'post-job' && (
        <MobileNav
          activeTab={activeTab} setActiveTab={setActiveTab}
          showMobileMenu={showMobileMenu} setShowMobileMenu={setShowMobileMenu}
          setShowPostFormGlobal={setShowPostFormGlobal}
          appUser={appUser} setSelectedProfile={setSelectedProfile}
          notifications={notifications}
          toggleProRank={toggleProRank} logout={logout}
          setShowAdmin={setShowAdmin}
          theme={theme} toggleTheme={toggleTheme}
        />
      )}

      {/* â”€â”€ Ø´Ø±ÙŠØ· ØªÙ†Ø¨ÙŠÙ‡ Ø§Ù„Ø²Ø§Ø¦Ø± â”€â”€ */}
      {isGuestMode && !user && (
        <GuestBanner
          onLogin={() => exitGuestMode()}
        />
      )}

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
                     Ù…ÙƒØ§Ù„Ù…Ø© {activeCall.callMode === 'video' ? 'ÙÙŠØ¯ÙŠÙˆ' : 'ØµÙˆØªÙŠØ©'} ÙˆØ§Ø±Ø¯Ø©...
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

      {/* â”€â”€ Cyber Security Alert Banner (Ø¥Ø´Ø¹Ø§Ø± Ù‚Ø³Ù… Ø§Ù„Ø³Ø§ÙŠØ¨Ø± Ø³ÙŠÙƒÙŠÙˆØ±ØªÙŠ Ù„Ù„Ø£Ø¯Ù…Ù† ÙÙ‚Ø·) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AlertBanner appUser={appUser} onNavigateToSecurity={() => setShowAdmin(true)} />

      {/* â”€â”€ Admin Dashboard full page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatePresence mode="wait">
        {showAdmin && (appUser?.isAdmin || appUser?.hasSupportAccess) && (
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col items-center justify-center text-white" dir="rtl">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/30 text-blue-400 flex items-center justify-center border border-blue-500/30 animate-pulse mb-3">
                  <Shield size={24} />
                </div>
                <p className="text-xs font-black">Ø¬Ø§Ø±ÙŠ ÙØªØ­ Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ… Ø§Ù„Ø¹Ù„ÙŠØ§...</p>
              </div>
            }
            key="admin-dashboard"
          >
            <AdminDashboard reports={reports} onClose={() => setShowAdmin(false)} addToast={addToast} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* --- Main Feed --- */}
      {!showAdmin && (
      <main
        className={`relative z-10 ${activeTab === 'messages' ? 'max-w-7xl' : 'max-w-6xl'} mx-auto px-3 sm:px-4 md:px-6 ${activeTab === 'messages' ? 'h-[100dvh] overflow-hidden' : 'pt-2 md:pt-4 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'}`}
        style={activeTab !== 'messages' ? {
          paddingBottom: 'calc(max(7.5rem, env(safe-area-inset-bottom, 0px) + 7.5rem))'
        } : undefined}
      >
        
        <GlobalPostModal
          showPostFormGlobal={showPostFormGlobal} setShowPostFormGlobal={setShowPostFormGlobal}
          appUser={appUser} setActiveTab={setActiveTab} addToast={addToast}
        />

        {/* ApplyJobModal moved outside main to avoid z-index conflict with MobileNav */}

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
          <HomeSidebar appUser={appUser} setSelectedProfile={setSelectedProfile} setActiveTab={setActiveTab} />
        )}

        {/* Center: Feed Transmission */}
        <div className={`${activeTab === 'messages' ? 'lg:col-span-12' : 'lg:col-span-6'} space-y-4`}>
          {searchQuery ? (
            <SearchView
              searchQuery={searchQuery} filteredUsers={filteredUsers}
              filteredJobs={filteredJobs} filteredPosts={filteredPosts}
              setSelectedProfile={setSelectedProfile} setActiveTab={setActiveTab}
              setSearchQuery={setSearchQuery} user={user} allUsers={allUsers}
              handleEchoPost={handleEchoPost} setRelocatingPost={setRelocatingPost}
              addToast={addToast} handleLike={handleLike} handleAddComment={handleAddComment}
              onDeletePost={(id) => setPosts(prev => prev.filter(p => p.id !== id))}
              setSelectedPostDetail={setSelectedPostDetail}
              onJobClick={(job) => {
                const jobIdx = Math.max(0, filteredJobs.findIndex(j => j.id === job.id));
                setDetailFeed({
                  type: 'job',
                  items: filteredJobs.length > 0 ? filteredJobs : [job],
                  initialIndex: jobIdx
                });
              }}
              onPublisherClick={(emp) => {
                setSelectedProfile(emp);
              }}
            />
          ) : (
            <>
              {/* âš¡ Keep-Alive: Home Feed */}
              <div
                key="keepalive-tab-home"
                className={activeTab === 'home' ? 'space-y-4' : 'hidden'}
                aria-hidden={activeTab !== 'home'}
              >
                <>
                  <NewsCarousel
                    appUser={appUser}
                    onViewAll={() => setActiveTab('news')}
                    onViewNews={(newsItem, list) => {
                      const newsList = list && list.length > 0 ? list : [newsItem];
                      const idx = Math.max(0, newsList.findIndex((n: any) => n.id === newsItem.id));
                      setDetailFeed({
                        type: 'news',
                        items: newsList,
                        initialIndex: idx,
                      });
                    }}
                  />

                  {/* ðŸ’¼ Job Categories Card (Ø£Ø³ÙÙ„ Ø§Ù„ÙƒØ§Ø±ÙˆØ³ÙŠÙ„ Ù…Ø¨Ø§Ø´Ø±Ø© ÙˆÙÙ‚ Ù…ØªØ·Ù„Ø¨Ø§Øª Ø§Ù„ØªØµÙ…ÙŠÙ…) */}
                  <JobCategoriesCard
                    selectedCategory={selectedJobCategory}
                    onSelectCategory={setSelectedJobCategory}
                    jobs={jobs}
                  />

                  {/* ðŸ”§ Ø³ÙˆÙ‚ Ø§Ù„Ø®Ø¯Ù…Ø§Øª Ø¶Ù…Ù† Ø£Ù‚Ø³Ø§Ù… ÙˆØªØµÙ†ÙŠÙØ§Øª Ø§Ù„ÙˆØ¸Ø§Ø¦Ù ÙÙŠ Ø§Ù„ØµÙØ­Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© */}
                  {selectedJobCategory === 'services' ? (
                    <div className="mt-2 space-y-4">
                      <Suspense fallback={<TabSkeleton />}>
                        <ServicesView
                          appUser={appUser}
                          onUserClick={(u) => {
                            setSelectedProfile(u);
                            setActiveTab('profile');
                          }}
                          onRequireAuth={requireAuth}
                        />
                      </Suspense>
                    </div>
                  ) : (
                    <>

                  {/* Smart Job Banner â€” only for seekers with profile data */}
                  <SmartJobBanner
                    jobs={jobs}
                    appUser={appUser}
                    onJobClick={(job) => {
                      const idx = Math.max(0, jobs.findIndex(j => j.id === job.id));
                      setDetailFeed({ type: 'job', items: jobs.length > 0 ? jobs : [job], initialIndex: idx });
                    }}
                  />
                  {canUserPostAndInteract(appUser) && (
                    <PostBox avatar={appUser?.avatar} appUser={appUser} addToast={addToast} />
                  )}

                  {/* â”€â”€ Feed Control & Refresh Bar â”€â”€ */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                        Ø§Ù„ØªØºØ°ÙŠØ© Ø§Ù„Ù…Ø¨Ø§Ø´Ø±Ø©
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        {selectedJobCategory === 'Ø§Ù„ÙƒÙ„' 
                          ? `(${posts.length + jobs.length} Ø¹Ù†ØµØ±)` 
                          : `(${selectedJobCategory}: ${(selectedJobCategory === 'Ø£Ø®Ø¨Ø§Ø±' ? posts.length : 0) + jobs.filter(j => isJobInCategory(j, selectedJobCategory)).length} Ø¹Ù†ØµØ±)`}
                      </span>
                    </div>

                    <button
                      onClick={async () => {
                        setIsRefreshingFeed(true);
                        try {
                          if (refreshData) await refreshData();
                          addToast('ØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ù„ØµÙØ­Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© Ø¨Ù†Ø¬Ø§Ø­ ðŸ”„');
                        } finally {
                          setIsRefreshingFeed(false);
                        }
                      }}
                      disabled={isRefreshingFeed}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white text-xs font-black transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      title="ØªØ­Ø¯ÙŠØ« Ø§Ù„ØªØºØ°ÙŠØ© Ø§Ù„ÙÙˆØ±ÙŠØ©"
                    >
                      <RefreshCw size={13} className={isRefreshingFeed ? 'animate-spin' : ''} />
                      <span>ØªØ­Ø¯ÙŠØ« Ø§Ù„ØªØºØ°ÙŠØ©</span>
                    </button>
                  </div>

                  <div className="space-y-4 pb-36 md:pb-12">
                    {memoizedCombinedFeed.length === 0 ? (
                      <div className="text-center py-12 px-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm" dir="rtl">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <Briefcase size={28} />
                        </div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1">
                          Ù„Ø§ ØªÙˆØ¬Ø¯ ÙˆØ¸Ø§Ø¦Ù Ù…Ø¹Ø±ÙˆØ¶Ø© Ø­Ø§Ù„ÙŠØ§Ù‹ ÙÙŠ Ù‚Ø³Ù… Â«{selectedJobCategory}Â»
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                          ÙŠÙ…ÙƒÙ†Ùƒ ØªØµÙØ­ Ø¨Ø§Ù‚ÙŠ Ø§Ù„Ø£Ù‚Ø³Ø§Ù… Ø£Ùˆ Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† Ø§Ù„ÙÙ„ØªØ± Ù„Ø¹Ø±Ø¶ Ø¬Ù…ÙŠØ¹ Ø§Ù„ÙˆØ¸Ø§Ø¦Ù
                        </p>
                        <button
                          onClick={() => setSelectedJobCategory('Ø§Ù„ÙƒÙ„')}
                          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black shadow-md hover:bg-blue-700 active:scale-95 transition-all"
                        >
                          Ø¹Ø±Ø¶ Ø¬Ù…ÙŠØ¹ Ø§Ù„ÙˆØ¸Ø§Ø¦Ù
                        </button>
                      </div>
                    ) : (
                      memoizedCombinedFeed.map((item: any, idx) => (
                        <RecedeCard key={item.id}>
                          {item.feedType === 'post' ? (
                            <PostNewsCard
                              post={item}
                              delay={Math.min(idx * 0.03, 0.3)}
                              onClick={() => {
                                const isItemArticle = (item as any).post_type === 'article' || (item as any).type === 'article' || item.content?.startsWith('# ');
                                const feedPosts = memoizedCombinedFeed.filter((it: any) => it.feedType === 'post');
                                const relevantItems = isItemArticle 
                                  ? feedPosts.filter((p: any) => p.post_type === 'article' || p.type === 'article' || p.content?.startsWith('# '))
                                  : feedPosts;
                                const targetList = relevantItems.length > 0 ? relevantItems : feedPosts;
                                const postIdx = Math.max(0, targetList.findIndex((p: any) => p.id === item.id));
                                setDetailFeed({
                                  type: 'post',
                                  items: targetList,
                                  initialIndex: postIdx
                                });
                              }}
                              onAuthorClick={() => {
                                const found = allUsers.find(au => au.id === item.authorId);
                                if (found) setSelectedProfile(found);
                              }}
                              allUsers={allUsers}
                              onEditPost={(p) => setEditingFeedPost(p)}
                            />
                          ) : (
                            <div className="px-1">
                              <JobCard 
                                job={item} 
                                onClick={() => {
                                  const feedJobs = memoizedCombinedFeed.filter((it: any) => it.feedType !== 'post');
                                  const jobIdx = Math.max(0, feedJobs.findIndex((j: any) => j.id === item.id));
                                  setDetailFeed({
                                    type: 'job',
                                    items: feedJobs,
                                    initialIndex: jobIdx
                                  });
                                }}
                                delay={Math.min(idx * 0.03, 0.3)}
                                onEditJob={(job) => setEditingFeedJob(job)}
                                onPublisherClick={(emp) => {
                                  setSelectedProfile(emp);
                                  setActiveTab('profile');
                                }}
                                onDeleteJob={async (jobId) => {
                                  if (!window.confirm('Ù‡Ù„ Ø£Ù†Øª Ù…ØªØ£ÙƒØ¯ Ù…Ù† Ø­Ø°Ù Ù‡Ø°Ù‡ Ø§Ù„ÙˆØ¸ÙŠÙØ©ØŸ')) return;
                                  await (supabase as any).from('jobs').delete().eq('id', jobId);
                                }}
                              />
                            </div>
                          )}
                        </RecedeCard>
                      ))
                    )}
                  </div>
                    </>
                  )}
                </>
              </div>

              {/* âš¡ Keep-Alive: Jobs View */}
              {visitedTabs.jobs && (
                <div
                  key="keepalive-tab-jobs"
                  className={activeTab === 'jobs' ? 'pb-safe-bottom px-1 md:px-0 animate-in fade-in duration-150' : 'hidden'}
                  aria-hidden={activeTab !== 'jobs'}
                >
                  <Suspense fallback={<TabSkeleton />}>
                    <MissionsView 
                      jobs={jobs} 
                      appUser={appUser} 
                      allUsers={allUsers}
                      addToast={addToast} 
                      messages={messages} 
                      setActiveTab={setActiveTab}
                      initialSelectedJob={initialJobForMissions}
                      onClearInitialJob={() => setInitialJobForMissions(null)}
                      onViewJob={(job, list) => {
                        const jobsList = list && list.length > 0 ? list : jobs;
                        const idx = Math.max(0, jobsList.findIndex((j: any) => j.id === job.id));
                        setDetailFeed({
                          type: 'job',
                          items: jobsList,
                          initialIndex: idx,
                        });
                      }}
                      onPublisherClick={(user, job) => {
                        setSelectedProfile(user);
                        if (job) setReturnToJob(job);
                        setActiveTab('profile');
                      }}
                      onApplyJob={(job) => {
                        if (!appUser || isGuestMode) {
                          addToast('ÙŠØ¬Ø¨ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø£Ùˆ Ø¥Ù†Ø´Ø§Ø¡ Ø­Ø³Ø§Ø¨ Ù„Ù„ØªÙ‚Ø¯ÙŠÙ… Ø¹Ù„Ù‰ Ù‡Ø°Ù‡ Ø§Ù„ÙˆØ¸ÙŠÙØ© ðŸ’¼', 'info' as any);
                          exitGuestMode();
                          return;
                        }
                        const isPublisher = !appUser.isAdmin && (appUser.id === job.employer_id || appUser.id === (job as any).employerId);
                        if (isPublisher) {
                          addToast('Ø£Ù†Øª Ù†Ø§Ø´Ø± Ù‡Ø°Ù‡ Ø§Ù„ÙˆØ¸ÙŠÙØ©ØŒ Ù„Ø§ ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„ØªÙ‚Ø¯ÙŠÙ… Ø¹Ù„ÙŠÙ‡Ø§ ðŸ¢', 'error' as any);
                          return;
                        }
                        if (appUser.role === 'employer' && !appUser.isAdmin) {
                          addToast('Ø£ØµØ­Ø§Ø¨ Ø§Ù„Ø¹Ù…Ù„ Ù„Ø§ ÙŠÙ…ÙƒÙ†Ù‡Ù… Ø§Ù„ØªÙ‚Ø¯ÙŠÙ… Ø¹Ù„Ù‰ Ø§Ù„ÙˆØ¸Ø§Ø¦Ù. ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„ØªÙ‚Ø¯ÙŠÙ… ÙÙ‚Ø· Ø¨Ø¹Ø¯ ØªØ­ÙˆÙŠÙ„ Ø­Ø³Ø§Ø¨Ùƒ Ø¥Ù„Ù‰ Ø¨Ø§Ø­Ø« Ø¹Ù† Ø¹Ù…Ù„ ðŸ‘¤', 'error' as any);
                          return;
                        }
                        setApplyingJob(job);
                        setIsApplying(false);
                      }} 
                    />
                  </Suspense>
                </div>
              )}
              {activeTab === 'post-job' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  {!isJobPoster(appUser) ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 my-8 max-w-lg mx-auto shadow-xl" dir="rtl">
                      <div className="w-14 h-14 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Briefcase size={28} />
                      </div>
                      <h3 className="text-base font-black text-slate-800 dark:text-white">Ù†Ø´Ø± Ø§Ù„ÙˆØ¸Ø§Ø¦Ù Ù…Ø®ØµØµ Ù„Ø£ØµØ­Ø§Ø¨ Ø§Ù„Ø¹Ù…Ù„ ÙˆØ§Ù„Ù…Ø¤Ø³Ø³Ø§Øª ÙÙ‚Ø· ðŸ’¼</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-2 leading-relaxed">Ø­Ø³Ø§Ø¨Ùƒ Ù…Ø³Ø¬Ù„ ÙƒÙ€ (Ø¨Ø§Ø­Ø« Ø¹Ù† Ø¹Ù…Ù„). ÙŠÙ…ÙƒÙ† Ù„Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„ÙØ±Ø¯ÙŠØ© Ø§Ù„ØªØµÙØ­ ÙˆØ§Ù„ØªÙ‚Ø¯ÙŠÙ… Ø¹Ù„Ù‰ Ø§Ù„ÙØ±Øµ Ø¨Ø¯Ù„Ø§Ù‹ Ù…Ù† Ù†Ø´Ø±Ù‡Ø§.</p>
                      <button onClick={() => setActiveTab('home')} className="mt-5 px-6 py-3 bg-blue-600 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all">Ø§Ù„Ø±Ø¬ÙˆØ¹ Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</button>
                    </div>
                  ) : (
                    <div className="pb-safe-bottom px-1 md:px-0">
                      <JobPostForm
                        show={true}
                        asPage={true}
                        formData={pageJobFormData}
                        setFormData={setPageJobFormData}
                        onSubmit={handlePostJobFromPage}
                        isPosting={isPostingJobPage}
                        onClose={() => setActiveTab('home')}
                        appUser={appUser}
                      />
                    </div>
                  )}
                </motion.div>
              )}

              {/* âš¡ Keep-Alive: Network View */}
              {visitedTabs.network && (
                <div
                  key="keepalive-tab-network"
                  className={activeTab === 'network' ? 'pb-safe-bottom px-1 md:px-0 animate-in fade-in duration-150' : 'hidden'}
                  aria-hidden={activeTab !== 'network'}
                >
                  <Suspense fallback={<TabSkeleton />}>
                    <NetworkView 
                      users={allUsers} 
                      appUser={appUser} 
                      connections={connections} 
                      onUserClick={setSelectedProfile} 
                      onSyncSignal={handleSyncSignal} 
                      onAcceptConnection={handleAcceptConnection}
                      onRejectConnection={handleRejectConnection}
                      currentId={appUser?.id || ''} 
                      onMessageClick={(id) => { const u = allUsers.find(x => x.id === id); if (u) { setSelectedChat(u); setActiveTab('messages'); } }} 
                    />
                  </Suspense>
                </div>
              )}

              {activeTab === 'calls' && appUser?.isAdmin && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="pb-safe-bottom px-1 md:px-0"
                >
                  <Suspense fallback={<TabSkeleton />}>
                    <CallsView 
                      appUser={appUser} 
                      allUsers={allUsers} 
                      onStartCall={startCall}
                      onSelectChat={(u) => { setSelectedChat(u); setActiveTab('messages'); }}
                    />
                  </Suspense>
                </motion.div>
              )}
              {/* âš¡ Keep-Alive: Messages View */}
              {visitedTabs.messages && (
                !appUser ? (
                  activeTab === 'messages' && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 my-8 max-w-md mx-auto shadow-xl"
                      dir="rtl"
                    >
                      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <MessageSquare size={30} />
                      </div>
                      <h3 className="text-base font-black text-slate-800 dark:text-white">Ø§Ù„Ø±Ø³Ø§Ø¦Ù„ ÙˆØ§Ù„Ù…Ø­Ø§Ø¯Ø«Ø§Øª Ù…Ù‚ÙÙ„Ø© ðŸ”’</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-2 leading-relaxed">
                        Ø£Ù†Øª ØªØªØµÙØ­ ÙƒØ²Ø§Ø¦Ø±. ÙŠØ±Ø¬Ù‰ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ù„Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø§Øª ÙˆØ§Ù„Ø±Ø³Ø§Ø¦Ù„ Ø§Ù„Ù…Ø¨Ø§Ø´Ø±Ø©.
                      </p>
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('prolink:exitGuestMode'))}
                        className="mt-5 w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <span>ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø§Ù„Ø¢Ù†</span>
                      </button>
                    </motion.div>
                  )
                ) : (
                  <div
                    key="keepalive-tab-messages"
                    className={activeTab === 'messages' ? 'pb-safe-bottom md:pb-0 h-full' : 'hidden'}
                    aria-hidden={activeTab !== 'messages'}
                  >
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
                  </div>
                )
              )}

              {activeTab === 'groups' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.13, ease: 'easeOut' }}
                  className="pb-safe-bottom px-1 md:px-0"
                >
                  <Suspense fallback={<TabSkeleton />}>
                    <GroupsView
                      appUser={appUser}
                      addToast={addToast}
                      onSelectGroup={(g) => {
                        setSelectedChat(null);
                        setSelectedGroup(g);
                        setActiveTab('messages');
                      }}
                    />
                  </Suspense>
                </motion.div>
              )}

              {/* âš¡ Keep-Alive: News View */}
              {visitedTabs.news && (
                <div
                  key="keepalive-tab-news"
                  className={activeTab === 'news' ? 'pb-safe-bottom px-1 md:px-0 animate-in fade-in duration-150' : 'hidden'}
                  aria-hidden={activeTab !== 'news'}
                >
                  <Suspense fallback={<TabSkeleton />}>
                    <NewsView
                      appUser={appUser}
                      onViewNews={(newsItem, list) => {
                        const newsList = list && list.length > 0 ? list : [newsItem];
                        const idx = Math.max(0, newsList.findIndex((n: any) => n.id === newsItem.id));
                        setDetailFeed({
                          type: 'news',
                          items: newsList,
                          initialIndex: idx,
                        });
                      }}
                    />
                  </Suspense>
                </div>
              )}

              {activeTab === 'services' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.13, ease: 'easeOut' }}
                  className="pb-safe-bottom px-1 md:px-0"
                >
                  <Suspense fallback={<TabSkeleton />}>
                    <ServicesView
                      appUser={appUser}
                      onUserClick={(u) => {
                        setSelectedProfile(u);
                        setActiveTab('profile');
                      }}
                      onRequireAuth={requireAuth}
                    />
                  </Suspense>
                </motion.div>
              )}

              {activeTab === 'erp' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.13, ease: 'easeOut' }}
                  className="pb-safe-bottom px-1 md:px-0"
                >
                  {appUser?.isAdmin ? (
                    <Suspense fallback={<TabSkeleton />}>
                      <ERPView appUser={appUser} addToast={addToast} />
                    </Suspense>
                  ) : (
                    // ðŸš« Ù…Ù†Ø¹ ÙˆØµÙˆÙ„ ØºÙŠØ± Ø§Ù„Ø£Ø¯Ù…Ù† Ù„Ù„Ù€ ERP Ø¨Ø´ÙƒÙ„ ØµØ±ÙŠØ­ â€” Ø§Ù„Ø­Ù…Ø§ÙŠØ© Ø¹Ù„Ù‰ Ù…Ø³ØªÙˆÙ‰ UI
                    <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 my-8 max-w-lg mx-auto shadow-xl" dir="rtl">
                      <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Briefcase size={28} />
                      </div>
                      <h3 className="text-base font-black text-slate-800 dark:text-white">Ù†Ø¸Ø§Ù… Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ Ø§Ù„Ø¨Ø´Ø±ÙŠØ© (ERP) â€” Ù…Ø®ØµØµ Ù„Ù„Ø¥Ø¯Ø§Ø±Ø© ÙÙ‚Ø· ðŸ”’</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-2 leading-relaxed">Ø­Ø³Ø§Ø¨Ùƒ Ø§Ù„Ø­Ø§Ù„ÙŠ Ù„ÙŠØ³ Ù„Ø¯ÙŠÙ‡ ØµÙ„Ø§Ø­ÙŠØ© Ø§Ù„ÙˆØµÙˆÙ„ Ù„Ù‡Ø°Ø§ Ø§Ù„Ù†Ø¸Ø§Ù…. Ù‡Ø°Ø§ Ø§Ù„Ù†Ø¸Ø§Ù… Ù…Ø®ØµØµ ÙÙ‚Ø· Ù„Ù„Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø¹Ù„ÙŠØ§.</p>
                      <button onClick={() => setActiveTab('home')} className="mt-5 px-6 py-3 bg-blue-600 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all">Ø§Ù„Ø±Ø¬ÙˆØ¹ Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</button>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'about' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="pb-safe-bottom px-1 md:px-0"
                >
                  <Suspense fallback={<TabSkeleton />}>
                    <AboutPage 
                      onBack={() => setActiveTab('home')} 
                      appUser={appUser}
                      onOpenChat={(supportUser: any) => {
                        setSelectedChat(supportUser);
                        setActiveTab('messages');
                      }}
                    />
                  </Suspense>
                </motion.div>
              )}

              {activeTab === 'profile' && (selectedProfile || appUser) && (
                <motion.div
                  initial={{ opacity: 0, x: -32, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 32, scale: 0.98 }}
                  transition={{
                    x: { type: 'spring', stiffness: 440, damping: 38, mass: 0.7 },
                    opacity: { duration: 0.15 },
                    scale: { duration: 0.15 },
                  }}
                  className="pb-safe-bottom px-1 md:px-0 will-change-transform transform-gpu"
                >
                  <Suspense fallback={<TabSkeleton />}>
                    <ProfilePage
                      profile={selectedProfile || appUser!}
                      isMe={(selectedProfile?.id || appUser?.id) === appUser?.id}
                      isEditing={isEditingProfile}
                      user={user || appUser}
                      returnToJob={returnToJob}
                      onReturnToJob={(job: any) => {
                        setSelectedProfile(null);
                        setActiveTab('jobs');
                        setInitialJobForMissions(job);
                        setReturnToJob(null);
                      }}
                      onBack={() => {
                        if (returnToDetailFeed) {
                          setSelectedProfile(null);
                          setDetailFeed(returnToDetailFeed);
                          setReturnToDetailFeed(null);
                        } else if (returnToJob) {
                          setSelectedProfile(null);
                          setActiveTab('jobs');
                          setInitialJobForMissions(returnToJob);
                          setReturnToJob(null);
                        } else if (returnToSearch) {
                          // Return to search results with the previous query preserved
                          setSelectedProfile(null);
                          setActiveTab('home');
                          setSearchQuery(returnToSearch);
                          setReturnToSearch(null);
                        } else {
                          setSelectedProfile(null);
                          setActiveTab('home');
                        }
                      }}
                      isConnected={connections.some(c =>
                        c.status === 'accepted' &&
                        ((c.requesterId === appUser?.id && c.recipientId === (selectedProfile || appUser)?.id) ||
                          (c.requesterId === (selectedProfile || appUser)?.id && c.recipientId === appUser?.id))
                      )}
                      onSyncSignal={() => handleSyncSignal(selectedProfile || appUser!)}
                      handleRelocatePost={handleEchoPost}
                      setRelocatingPost={setRelocatingPost}
                      addToast={addToast}
                      onLike={handleLike}
                      onDislike={handleDislike}
                      onAddComment={handleAddComment}
                      setAppUser={(updated: any) => {
                        setAppUser(updated as any);
                        setSelectedProfile(updated as any);
                      }}
                      onMessageClick={() => {
                        setSelectedChat(selectedProfile || appUser);
                        setActiveTab('messages');
                        setSelectedProfile(null);
                      }}
                      onCallClick={startCall}
                      onGoToSettings={() => setActiveTab('settings')}
                      onSave={async (updates: any) => {
                        if (appUser) {
                          const merged = { ...appUser, ...updates };
                          setAppUser(merged as any);
                          setSelectedProfile(merged as any);
                        }
                      }}
                    />
                  </Suspense>
                </motion.div>
              )}

              {/* â”€â”€â”€ Settings Page â”€â”€â”€ */}
              {activeTab === 'settings' && appUser && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="pb-safe-bottom px-1 md:px-0"
                >
                  <Suspense fallback={<TabSkeleton />}>
                    <SettingsPage
                      user={user || appUser}
                      appUser={appUser}
                      addToast={addToast}
                      setAppUser={(updated) => { setAppUser(updated as any); }}
                      onBack={() => setActiveTab('home')}
                    />
                  </Suspense>
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* Right Column: Task Manager Card (Desktop & Tablet - Former Strategic Center position) */}
        {activeTab !== 'messages' && (
          <IntelligenceCenter 
            addToast={addToast} 
            setShowAdmin={setShowAdmin} 
            appUser={appUser} 
            setSelectedProfile={setSelectedProfile} 
          />
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

        {/* DetailFeedPage moved outside main to avoid z-index conflict with MobileNav */}

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
      )}

      {/* â”€â”€ Full-screen overlays: rendered OUTSIDE <main> at root level to be above MobileNav â”€â”€ */}
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
            allUsers={allUsers}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {detailFeed && (
          <DetailFeedPage
            key="detail-feed-page"
            type={detailFeed.type}
            items={detailFeed.items}
            initialIndex={detailFeed.initialIndex}
            onClose={() => setDetailFeed(null)}
            onNavigateHome={() => {
              setDetailFeed(null);
              setActiveTab('home');
            }}
            onNavigateTab={(tab) => {
              setDetailFeed(null);
              setActiveTab(tab);
            }}
            onApplyJob={(job) => {
              if (!appUser || isGuestMode) {
                addToast('ÙŠØ¬Ø¨ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø£Ùˆ Ø¥Ù†Ø´Ø§Ø¡ Ø­Ø³Ø§Ø¨ Ù„Ù„ØªÙ‚Ø¯ÙŠÙ… Ø¹Ù„Ù‰ Ù‡Ø°Ù‡ Ø§Ù„ÙˆØ¸ÙŠÙØ© ðŸ’¼', 'info' as any);
                exitGuestMode();
                return;
              }
              const isPublisher = !appUser.isAdmin && (appUser.id === job.employer_id || appUser.id === (job as any).employerId);
              if (isPublisher) {
                addToast('Ø£Ù†Øª Ù†Ø§Ø´Ø± Ù‡Ø°Ù‡ Ø§Ù„ÙˆØ¸ÙŠÙØ©ØŒ Ù„Ø§ ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„ØªÙ‚Ø¯ÙŠÙ… Ø¹Ù„ÙŠÙ‡Ø§ ðŸ¢', 'error' as any);
                return;
              }
              if (appUser.role === 'employer' && !appUser.isAdmin) {
                addToast('Ø£ØµØ­Ø§Ø¨ Ø§Ù„Ø¹Ù…Ù„ Ù„Ø§ ÙŠÙ…ÙƒÙ†Ù‡Ù… Ø§Ù„ØªÙ‚Ø¯ÙŠÙ… Ø¹Ù„Ù‰ Ø§Ù„ÙˆØ¸Ø§Ø¦Ù. ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„ØªÙ‚Ø¯ÙŠÙ… ÙÙ‚Ø· Ø¨Ø¹Ø¯ ØªØ­ÙˆÙŠÙ„ Ø­Ø³Ø§Ø¨Ùƒ Ø¥Ù„Ù‰ Ø¨Ø§Ø­Ø« Ø¹Ù† Ø¹Ù…Ù„ ðŸ‘¤', 'error' as any);
                return;
              }
              setDetailFeed(null);
              setApplyingJob(job);
              setIsApplying(false);
            }}
            appUser={appUser}
            onLike={handleLike}
            onDislike={handleDislike}
            onAddComment={handleAddComment}
            allUsers={allUsers}
            onPublisherClick={(user: any, item?: any, itemIndex?: number) => {
              if (detailFeed) {
                setReturnToDetailFeed({
                  type: detailFeed.type,
                  items: detailFeed.items,
                  initialIndex: typeof itemIndex === 'number' ? itemIndex : detailFeed.initialIndex
                });
              }
              setDetailFeed(null);
              setSelectedProfile(user);
              if (item && detailFeed?.type === 'job') setReturnToJob(item);
              setActiveTab('profile');
            }}
          />
        )}
      </AnimatePresence>

      {/* Security Alert Toast for instant real-time cybersecurity threats */}
      <SecurityAlertToast onOpenAdmin={() => setShowAdmin(true)} />

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
               addToast('ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ù…Ù†Ø´ÙˆØ± Ù„Ù„Ù…Ø´Ø§Ø±ÙƒØ© ÙÙŠ Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹Ø§Øª ðŸŒ'); 
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

      {/* â”€â”€ Edit Job Modal (from feed) â”€â”€ */}
      {editingFeedJob && (
        <EditJobModal
          job={editingFeedJob}
          onClose={() => setEditingFeedJob(null)}
          onSuccess={() => setEditingFeedJob(null)}
        />
      )}

      {/* â”€â”€ Edit Post Modal (Full Editor for articles/posts/images) â”€â”€ */}
      {editingFeedPost && (
        <EditPostModal
          post={editingFeedPost}
          onClose={() => setEditingFeedPost(null)}
          onSuccess={() => setEditingFeedPost(null)}
        />
      )}
    </div>
  );
}

const AppRoot: React.FC = () => (
  <ErrorBoundary>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </ErrorBoundary>
);

export default AppRoot;
