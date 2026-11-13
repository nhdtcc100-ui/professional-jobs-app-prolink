import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SkeletonConversationItem } from '../ui';
import { sanitizeInput } from '../../lib/utils/sanitize';
import { validateField } from '../../lib/security/inputValidator';
import { 
  Users, 
  MoreHorizontal, 
  MessageSquare, 
  Send, 
  Image as ImageIcon, 
  Smile,
  Briefcase,
  MapPin,
  DollarSign,
  X,
  Loader2,
  Video,
  Plus,
  Compass,
  Settings,
  Shield,
  Trash2,
  User,
  LogOut,
  Bell,
  Menu,
  Search,
  ArrowRight,
  Zap,
  Edit2,
  Copy,
  Check,
  CheckCheck,
  Phone,
  Group,
  Filter,
  Clock,
  Volume2,
  Smartphone,
  Type,
  Palette,
  Eye
} from 'lucide-react';
import { GroupDetailView, CreateGroupPage } from './groups';
import { supabase } from '../../lib/supabase';
import { imageService } from '../../lib/services/imageService';
import { AppUser, AppConnection } from '../../types';
import { useAppContext } from '../../contexts/AppContext';

interface MessagingViewProps {
  messages: any[];
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  currentUser: AppUser | null;
  allUsers: AppUser[];
  connections: AppConnection[];
  notifications: any[];
  selectedChat: AppUser | null;
  onSelectChat: (u: AppUser) => void;
  selectedGroup: any | null;
  setSelectedGroup: (g: any | null) => void;
  myGroups?: any[];
  addToast?: (m: string, t?: any) => void;
  fetchMyGroups: () => Promise<void>;
  setSelectedProfile: (p: any) => void;
  onStartCall: (user: any, type?: 'voice' | 'video') => void;
}

export interface ChatSettings {
  fontSize: 'small' | 'normal' | 'large' | 'huge';
  sendOnEnter: boolean;
  messageSounds: boolean;
  hapticFeedback: boolean;
  readReceipts: boolean;
  autoDownloadMedia: boolean;
  showOnlineStatus: boolean;
  bubbleStyle: 'modern' | 'classic' | 'minimal';
  chatWallpaper: 'default' | 'subtle-blue' | 'slate' | 'dots';
}

const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  fontSize: 'normal',
  sendOnEnter: true,
  messageSounds: true,
  hapticFeedback: true,
  readReceipts: true,
  autoDownloadMedia: true,
  showOnlineStatus: true,
  bubbleStyle: 'modern',
  chatWallpaper: 'default',
};

const FONT_SIZE_CLASSES: Record<ChatSettings['fontSize'], string> = {
  small: 'text-xs',
  normal: 'text-sm',
  large: 'text-base',
  huge: 'text-lg',
};

const BUBBLE_ROUNDED: Record<ChatSettings['bubbleStyle'], { mine: string; others: string }> = {
  modern: { mine: 'rounded-2xl rounded-bl-sm', others: 'rounded-2xl rounded-br-sm' },
  classic: { mine: 'rounded-xl rounded-tr-none', others: 'rounded-xl rounded-tl-none' },
  minimal: { mine: 'rounded-3xl', others: 'rounded-3xl' },
};

const WALLPAPERS: Record<ChatSettings['chatWallpaper'], string> = {
  default: '',
  'subtle-blue': 'bg-blue-50/50 dark:bg-slate-900/60',
  slate: 'bg-slate-100/70 dark:bg-slate-900/90',
  dots: 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]',
};

const playSendSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (_) {}
};

const triggerHaptic = () => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  } catch (_) {}
};

export function MessagingView({ 
  messages, 
  setMessages,
  currentUser, 
  allUsers, 
  connections, 
  notifications,
  selectedChat, 
  onSelectChat,
  selectedGroup,
  setSelectedGroup,
  myGroups,
  addToast,
  fetchMyGroups,
  setSelectedProfile,
  onStartCall
}: MessagingViewProps) {
  const [content, setContent] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [isSendingFile, setIsSendingFile] = useState(false); // Only locks during file upload
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMessagingSettings, setShowMessagingSettings] = useState(false);
  const [chatSettings, setChatSettings] = useState<ChatSettings>(() => {
    try {
      const saved = localStorage.getItem('prolink_chat_settings');
      return saved ? { ...DEFAULT_CHAT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_CHAT_SETTINGS;
    } catch {
      return DEFAULT_CHAT_SETTINGS;
    }
  });

  const updateChatSetting = <K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) => {
    setChatSettings(prev => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem('prolink_chat_settings', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupCategory, setGroupCategory] = useState('عام');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [searchFilter, setSearchFilter] = useState<'all' | 'people' | 'jobs' | 'groups'>('all');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerData, setOfferData] = useState({ title: '', salary: '' });
  const [canSendOffer, setCanSendOffer] = useState(false);
  const emojis = ['👍','❤️','🔥','😂','💯','🚀','💼','🤝','✅','✨','🎯','💡','👏','🙌','🤔','😎','🙏','🎉','💻','📊','📈','🏆'];
  const [isMuted, setIsMuted] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  // isSending is only used for file uploads now (text messages never block UI)
  const isSending = isSendingFile;
  
  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (currentUser?.role !== 'employer' || !selectedChat) {
        setCanSendOffer(false);
        return;
      }
      try {
        // Direct query: Check if selectedChat has an 'approved' application for this employer
        const { data, error } = await (supabase.from('job_applications') as any)
          .select('id, status')
          .eq('applicant_id', selectedChat.id)
          .eq('employer_id', currentUser.id)
          .eq('status', 'approved')
          .limit(1);
        
        setCanSendOffer(!error && data && data.length > 0);
      } catch (e) {
        console.error('Error checking approval status', e);
        setCanSendOffer(false);
      }
    };
    checkApprovalStatus();
  }, [selectedChat, currentUser]);

  const { markChatMessagesAsRead, readMessageIds, readChatSenders } = useAppContext();

  // 👁️ Auto-mark messages as read when user is viewing this chat
  useEffect(() => {
    if (selectedChat?.id && currentUser?.id) {
      markChatMessagesAsRead(selectedChat.id);
    }
  }, [selectedChat?.id, currentUser?.id, markChatMessagesAsRead]);

  // ⚡ One-shot fetch when opening a conversation (hydrate messages for this chat pair only).
  // Polling is intentionally removed here — AppContext.catchUpMissedMessages handles background sync
  // every 3s, and Realtime pushes new messages instantly. Having a 3rd polling loop here was
  // causing a Race Condition (3 concurrent setMessages calls) that froze the UI after the
  // first reply from the other party.
  useEffect(() => {
    if (!selectedChat?.id || !currentUser?.id) return;
    let isMounted = true;

    const hydrateChatMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error || !isMounted || !data) return;

        const myId = String(currentUser.id || '').toLowerCase().trim();
        const chatId = String(selectedChat.id || '').toLowerCase().trim();

        const conversationData = (data as any[]).filter(m => {
          const sId = String(m?.sender_id || m?.senderId || '').toLowerCase().trim();
          const rId = String(m?.receiver_id || m?.receiverId || '').toLowerCase().trim();
          return (sId === chatId && rId === myId) || (sId === myId && rId === chatId);
        });

        setMessages(prev => {
          const existingIds = new Set(prev.map(m => String(m.id)));
          const newItems = conversationData
            .reverse()
            .filter(m => !existingIds.has(String(m.id)))
            .map(m => ({
              ...m,
              senderId: m.sender_id,
              receiverId: m.receiver_id,
              read: m.read || (m.sender_id === selectedChat.id),
              timestamp: { toDate: () => new Date(m.created_at) }
            }));

          if (newItems.length === 0) return prev;
          return [...prev, ...newItems];
        });
      } catch (_) {}
    };

    // One-shot hydration when chat is opened
    hydrateChatMessages();

    return () => { isMounted = false; };
  }, [selectedChat?.id, currentUser?.id, setMessages]);

  const getTimestampMs = (m: any): number => {
    if (!m) return 0;
    try {
      const val = m.created_at || m.timestamp || m.createdAt || m;
      if (typeof val === 'number') return val;
      if (typeof val?.toDate === 'function') return val.toDate().getTime();
      if (val instanceof Date) return val.getTime();
      if (typeof val === 'string') {
        const d = new Date(val).getTime();
        if (!isNaN(d)) return d;
      }
    } catch (_) {}
    return 0;
  };

  const formatTime = (ts: any) => {
    if (!ts) return '';
    try {
      let d: Date;
      if (typeof ts?.toDate === 'function') {
        d = ts.toDate();
      } else if (ts instanceof Date) {
        d = ts;
      } else {
        d = new Date(ts);
      }
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  };

  // 📜 Chronologically sorted messages (oldest to newest, so latest is at bottom)
  const chatMessages = (messages || [])
    .filter(m => {
      const sId = String(m?.senderId || m?.sender_id || '').toLowerCase().trim();
      const rId = String(m?.receiverId || m?.receiver_id || '').toLowerCase().trim();
      const myId = String(currentUser?.id || '').toLowerCase().trim();
      const chatId = String(selectedChat?.id || '').toLowerCase().trim();

      if (!myId || !chatId) return false;

      return (
        (sId === myId && rId === chatId) ||
        (sId === chatId && rId === myId)
      );
    })
    .sort((a, b) => {
      const timeA = getTimestampMs(a);
      const timeB = getTimestampMs(b);
      return timeA - timeB;
    });

  // 📜 Luxurious smooth auto-scroll to bottom when new messages arrive or chat opens
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages.length, selectedChat?.id]);

  const isSupportUser = (u: any) => {
    if (!u) return false;
    const supportPhones = ['07724053743', '07724053748'];
    return (
      u.hasSupportAccess === true ||
      u.has_support_access === true ||
      u.isAdmin === true ||
      u.is_admin === true ||
      (u.phone && supportPhones.includes(u.phone)) ||
      (u.id && String(u.id).includes('support-admin'))
    );
  };

  // ✅ Include any user who is connected OR with whom there is message history (guaranteed never to disappear)
  const messagePartnerIds = new Set<string>();
  const myCurrentId = String(currentUser?.id || '').toLowerCase().trim();

  (messages || []).forEach(m => {
    const sId = String(m?.senderId || m?.sender_id || '').toLowerCase().trim();
    const rId = String(m?.receiverId || m?.receiver_id || '').toLowerCase().trim();
    if (sId === myCurrentId && rId && rId !== myCurrentId) messagePartnerIds.add(rId);
    if (rId === myCurrentId && sId && sId !== myCurrentId) messagePartnerIds.add(sId);
  });

  const syncedUsers: AppUser[] = [];
  const processedUserIds = new Set<string>();

  // 1. Add all known users who match connection or message history
  (allUsers || []).forEach(u => {
    if (!u || !u.id) return;
    const uId = String(u.id).toLowerCase().trim();
    if (uId === myCurrentId || processedUserIds.has(uId)) return;
    if (isSupportUser(u)) return;

    const isConnected = (connections || []).some(c => {
      if (!c || c.status !== 'accepted') return false;
      const reqId = String(c.requesterId || (c as any).requester_id || '').toLowerCase().trim();
      const recId = String(c.recipientId || (c as any).recipient_id || '').toLowerCase().trim();
      return (reqId === myCurrentId && recId === uId) || (reqId === uId && recId === myCurrentId);
    });

    const hasMessages = messagePartnerIds.has(uId);

    if (isConnected || hasMessages) {
      syncedUsers.push(u);
      processedUserIds.add(uId);
    }
  });

  // 2. Fallback: Add any message partner who might not be in allUsers yet so chat NEVER disappears
  messagePartnerIds.forEach(partnerId => {
    if (!processedUserIds.has(partnerId)) {
      const fallbackUser: AppUser = {
        id: partnerId,
        name: 'مستخدم محادثة',
        email: '',
        role: 'seeker',
        isPro: false,
        isAdmin: false,
        isActive: true,
        avatar: `https://ui-avatars.com/api/?name=User&background=random`
      };
      syncedUsers.push(fallbackUser);
      processedUserIds.add(partnerId);
    }
  });

  const chatUsers = syncedUsers;

  const isOnline = (lastSeenAt?: string | null) => {
    if (!lastSeenAt) return false;
    const lastSeen = new Date(lastSeenAt).getTime();
    const now = new Date().getTime();
    return (now - lastSeen) < 180000; // 3 minutes
  };

  const unifiedConversations = [
    ...chatUsers.map(u => {
      const uId = String(u.id || '').toLowerCase().trim();
      const myId = String(currentUser?.id || '').toLowerCase().trim();

      const lastMsg = (messages || []).filter(m => {
        const sId = String(m?.senderId || m?.sender_id || '').toLowerCase().trim();
        const rId = String(m?.receiverId || m?.receiver_id || '').toLowerCase().trim();
        return (
          (sId === myId && rId === uId) ||
          (sId === uId && rId === myId)
        );
      }).slice(-1)[0];
      const contentStr = lastMsg?.content ? String(lastMsg.content) : '';
      return {
        id: u.id, 
        name: u.name || 'مستخدم', 
        avatar: u.avatar || '', 
        type: 'chat' as const, 
        original: u,
        lastMsg,
        lastSeenAt: u.last_seen_at,
        isOnline: isOnline(u.last_seen_at),
        timestamp: lastMsg ? getTimestampMs(lastMsg.created_at || lastMsg.timestamp) : 0,
        time: lastMsg ? formatTime(lastMsg.created_at || lastMsg.timestamp) : '',
        lastMessage: contentStr ? contentStr.replace(/\[MEDIA:[^\]]+\][^\n]*/, '📎 مرفق') : ''
      };
    }),
    ...(myGroups || []).map(g => ({ 
      id: g?.id || '', 
      name: g?.name || 'مجموعة', 
      avatar: g?.avatar_url || '', 
      type: 'group' as const, 
      original: g,
      lastMsg: null,
      lastSeenAt: null,
      isOnline: false,
      timestamp: g?.created_at ? getTimestampMs(g.created_at) : 0,
      time: g?.created_at ? formatTime(g.created_at) : '',
      lastMessage: 'مجموعة مهنية'
    }))
  ].sort((a, b) => {
    const timeA = Number(a.timestamp) || 0;
    const timeB = Number(b.timestamp) || 0;
    return timeB - timeA;
  }).filter(c => {
    const nameStr = c.name ? String(c.name).toLowerCase() : '';
    const qStr = searchQuery ? searchQuery.toLowerCase() : '';
    const matchesSearch = nameStr.includes(qStr);
    if (!matchesSearch) return false;
    if (searchFilter === 'people') return c.type === 'chat';
    if (searchFilter === 'groups') return c.type === 'group';
    return true;
  });

  const getLastMessage = (userId: string) => messages.filter(m =>
    (m.senderId === currentUser?.id && m.receiverId === userId) ||
    (m.senderId === userId && m.receiverId === currentUser?.id)
  ).slice(-1)[0];

  const getUnreadCount = (convId: string, type: 'chat' | 'group') => {
    if (type === 'chat') {
      return messages.filter(m => {
        const sender = m.senderId || m.sender_id;
        const receiver = m.receiverId || m.receiver_id;
        if (sender !== convId || receiver !== currentUser?.id) return false;
        if (m.read === true) return false;
        if (readMessageIds?.has(m.id)) return false;
        const lastReadAt = readChatSenders?.[sender];
        if (lastReadAt) {
          const msgTime = new Date(m.created_at || (m.timestamp?.toDate ? m.timestamp.toDate() : 0)).getTime();
          if (msgTime <= lastReadAt) return false;
        }
        return true;
      }).length;
    }
    return notifications.filter(n => 
      n.read === false && (n.targetId === convId && n.type === 'group_message')
    ).length;
  };
  
  const [msgError, setMsgError] = useState<string | null>(null);

  const handleContentChange = (val: string) => {
    setContent(val);
    if (!val.trim()) { setMsgError(null); return; }
    const check = validateField(val, 'نص الرسالة', currentUser ? { id: currentUser.id, name: currentUser.name, email: currentUser.email } : undefined, '/chat/message');
    setMsgError(check.valid ? null : (check.error ?? null));
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !selectedChat) return;
    
    const isVideo = file.type.startsWith('video/');
    if (isVideo) {
      setPendingPreview('video:' + URL.createObjectURL(file));
    } else {
      const reader = new FileReader();
      reader.onload = () => setPendingPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
    setPendingFile(file);
    e.target.value = '';
  };

  const cancelPendingFile = () => {
    setPendingFile(null);
    setPendingPreview(null);
  };

  // Mark a temp message as failed and show retry button
  const markMsgFailed = (tempId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === tempId ? { ...m, status: 'failed' } : m
    ));
  };

  // Retry sending a failed message
  const retryMessage = async (msg: any) => {
    if (!currentUser || !selectedChat) return;
    // Reset to 'sending'
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sending' } : m));
    try {
      const { data, error } = await supabase.from('messages').insert([{
        sender_id: currentUser.id,
        receiver_id: selectedChat.id,
        content: msg.content
      }]).select();

      if (error) throw error;

      if (data && data.length > 0) {
        const realMsg = data[0] as any;
        setMessages(prev => prev.map(m => m.id === msg.id ? {
          ...m,
          id: realMsg.id,
          created_at: realMsg.created_at,
          status: undefined
        } : m));
      }
    } catch (err: any) {
      console.error('Retry failed:', err);
      markMsgFailed(msg.id);
      addToast?.(err?.message || 'فشل إعادة الإرسال', 'error');
    }
  };

  const sendMessage = async () => {
    if (!currentUser) return;
    if ((!content.trim() && !pendingFile) || !selectedChat) return;
    if (msgError) return;
    // For file messages, lock UI during upload only
    if (pendingFile && isSendingFile) return;

    // 🔒 Sanitize text before sending
    const msgText = sanitizeInput(content.trim(), {
      id: currentUser?.id,
      name: currentUser?.name,
      email: currentUser?.email
    });
    const fileToSend = pendingFile;

    // ⚡ Clear input IMMEDIATELY — never block the user
    setContent('');
    setMsgError(null);
    setPendingFile(null);
    setPendingPreview(null);
    setShowEmojis(false);
    if (chatSettings.messageSounds) playSendSound();
    if (chatSettings.hapticFeedback) triggerHaptic();

    if (fileToSend) {
      // File uploads show a spinner during upload
      setIsSendingFile(true);
      const tempId = 'temp-' + Date.now();
      try {
        const isVideo = fileToSend.type.startsWith('video/');
        let finalUrl = '';
        if (isVideo) {
          finalUrl = await imageService.uploadVideo(fileToSend, currentUser.id) || '';
        } else {
          finalUrl = await imageService.processAndUpload(fileToSend, currentUser.id, 'images');
        }
        const prefix = isVideo ? '[MEDIA:video]' : '[MEDIA:photo]';
        const mediaContent = msgText ? `${prefix}${finalUrl}\n${msgText}` : `${prefix}${finalUrl}`;

        const optimisticMsg = {
          id: tempId, sender_id: currentUser.id, senderId: currentUser.id,
          receiver_id: selectedChat.id, receiverId: selectedChat.id,
          content: mediaContent, status: 'sending',
          timestamp: { toDate: () => new Date() }, created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);

        const { data, error } = await supabase.from('messages').insert([{
          sender_id: currentUser.id, receiver_id: selectedChat.id, content: mediaContent
        }]).select();

        if (error) throw error;

        if (data && data.length > 0) {
          const realMsg = data[0] as any;
          setMessages(prev => prev.map(m => m.id === tempId ? {
            ...m,
            id: realMsg.id,
            created_at: realMsg.created_at,
            status: undefined
          } : m));
        }
      } catch (err: any) {
        console.error('File send failed:', err);
        markMsgFailed(tempId);
        addToast?.(err?.message || 'فشل إرسال الملف — اضغط لإعادة المحاولة ❌', 'error');
      } finally {
        setIsSendingFile(false);
      }
    } else if (msgText) {
      // ⚡ Direct, Clean, Independent Database Insertion:
      // Every message is sent directly to PostgreSQL with zero temporary ID overhead,
      // guaranteeing message 1, message 2, and message 100 all execute with the exact same reliability.
      try {
        const { data, error } = await supabase
          .from('messages')
          .insert([{
            sender_id: currentUser.id,
            receiver_id: selectedChat.id,
            content: msgText
          }])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const real = data as any;
          const newMsg = {
            ...real,
            id: real.id,
            senderId: real.sender_id,
            receiverId: real.receiver_id,
            created_at: real.created_at,
            timestamp: { toDate: () => new Date(real.created_at) }
          };
          setMessages(prev => {
            const exists = prev.some(m => String(m.id) === String(newMsg.id));
            return exists ? prev : [...prev, newMsg];
          });
        }
      } catch (err: any) {
        console.error('[MessagingView] Send error:', err);
        addToast?.(err?.message || 'فشل إرسال الرسالة — حاول مرة أخرى ❌', 'error');
      }
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!currentUser) return;
    if (!window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) return;
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', msgId)
        .eq('sender_id', currentUser.id); // 🔒 Ownership guard: only sender can delete
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== msgId));
      addToast?.('تم حذف الرسالة بنجاح');
    } catch (err) {
      console.error('Delete failed:', err);
      addToast?.('فشل حذف الرسالة', 'error');
    }
  };

  const renderMessageContent = (text: string) => {
    if (text.startsWith('[MEDIA:photo]') || text.startsWith('[MEDIA:video]')) {
      const isVideo = text.startsWith('[MEDIA:video]');
      const rest = text.replace(isVideo ? '[MEDIA:video]' : '[MEDIA:photo]', '');
      const newlineIdx = rest.indexOf('\n');
      const url = newlineIdx !== -1 ? rest.slice(0, newlineIdx) : rest;
      const caption = newlineIdx !== -1 ? rest.slice(newlineIdx + 1) : '';

      return (
        <div className="space-y-1.5">
          {isVideo
            ? <video src={url} controls className="rounded-2xl w-full max-w-[280px] md:max-w-[400px] mt-1 shadow-md border border-white/20" />
            : <img src={url} className="rounded-2xl w-full max-w-[280px] md:max-w-[400px] object-cover mt-1 shadow-md border border-white/20" alt="" />
          }
          {caption && <p className="text-sm leading-relaxed whitespace-pre-wrap">{caption}</p>}
        </div>
      );
    }

    if (text.startsWith('📄 **طلب تقديم')) {
      const parts = text.split('[MEDIA:photo]');
      return (
        <div className="bg-slate-800/90 text-white rounded-2xl p-4 text-xs leading-relaxed border border-white/10 shadow-xl">
          <div className="flex items-center gap-2 mb-2 font-black text-blue-300 border-b border-white/10 pb-2"><Briefcase size={15} /> طلب تقديم وظيفة</div>
          <pre className="whitespace-pre-wrap text-[10px] opacity-90 font-medium mb-2 leading-relaxed">{parts[0].replace('📄 **طلب تقديم وظيفة (Elevate عراق)**\n━━━━━━━━━━━━━━━━━━━━━━\n', '')}</pre>
          {parts[1] && <div className="mt-1 rounded-xl overflow-hidden border border-white/20"><img src={parts[1]} className="w-full h-auto max-h-48 object-contain" alt="" /></div>}
        </div>
      );
    }

    if (text.startsWith('[OFFER_CARD:')) {
      try {
        const inner = text.slice('[OFFER_CARD:'.length, text.lastIndexOf(']'));
        const [title, salary] = inner.split('|');
        return (
          <div className="bg-white rounded-[2rem] overflow-hidden border border-amber-100 shadow-2xl shadow-amber-600/10 min-w-[260px] max-w-[320px] mb-2">
            <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 p-5 relative overflow-hidden">
               <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-2xl" />
               <div className="flex justify-between items-start relative z-10">
                 <div className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center border-2 border-amber-100/50">
                    <Briefcase size={24} className="text-amber-500" />
                 </div>
                 <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/40">
                    <span className="text-[10px] font-black text-white flex items-center gap-1"><Zap size={10} className="fill-white" /> عرض عمل مبدئي</span>
                 </div>
               </div>
            </div>
            <div className="p-5">
               <h4 className="font-black text-slate-800 text-lg mb-1 leading-tight">{title}</h4>
               <div className="flex items-center gap-1.5 mb-5 text-emerald-600 bg-emerald-50 w-fit px-3 py-1.5 rounded-xl border border-emerald-100">
                  <DollarSign size={14} />
                  <span className="text-xs font-black">{salary || 'يُحدد لاحقاً'}</span>
               </div>
               
               {currentUser?.role !== 'employer' ? (
                 <div className="flex gap-2">
                    <button onClick={() => alert('تم القبول ✅ (إصدار تجريبي)')} className="flex-1 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">قبول العرض</button>
                    <button onClick={() => alert('تم الرفض ❌')} className="px-4 py-3 bg-red-50 text-red-600 rounded-2xl text-xs font-black hover:bg-red-100 transition-colors">رفض</button>
                 </div>
               ) : (
                 <div className="text-center py-2 text-[10px] font-bold text-slate-400 bg-slate-50 rounded-xl">
                   في انتظار رد الموظف...
                 </div>
               )}
            </div>
          </div>
        );
      } catch (e) { return <span>{text}</span>; }
    }

    if (text.startsWith('[JOB_CARD:')) {
      try {
        const inner = text.slice('[JOB_CARD:'.length, text.lastIndexOf(']'));
        const [id, title, company, location, salary, avatar] = inner.split('|');
        return (
          <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-xl min-w-[240px] max-w-[280px]">
            <div className="h-16 bg-gradient-to-br from-blue-600 to-indigo-700 relative">
               <div className="absolute -bottom-6 right-4 w-12 h-12 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-white">
                  <img src={avatar || `https://ui-avatars.com/api/?name=${company}&background=random`} className="w-full h-full object-cover" alt="" />
               </div>
            </div>
            <div className="p-4 pt-8">
               <h4 className="font-black text-slate-800 text-sm mb-1 truncate">{title}</h4>
               <p className="text-[10px] text-blue-600 font-bold mb-3">{company}</p>
               <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-2 py-1 bg-slate-50 rounded-lg text-[9px] font-black text-slate-500 border border-slate-100 flex items-center gap-1">
                    <MapPin size={10} className="text-blue-500" /> {location || 'عن بُعد'}
                  </span>
                  <span className="px-2 py-1 bg-emerald-50 rounded-lg text-[9px] font-black text-emerald-600 border border-emerald-100 flex items-center gap-1">
                    <DollarSign size={10} /> {salary || 'غير محدد'}
                  </span>
               </div>
               <button 
                 onClick={() => (window as any).viewJobDetails?.(id)}
                 className="w-full py-2 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black hover:bg-blue-100 transition-all"
               >
                 عرض تفاصيل الوظيفة
               </button>
            </div>
          </div>
        );
      } catch (e) { return <span>{text}</span>; }
    }

    return <span className="whitespace-pre-wrap leading-relaxed">{text}</span>;
  };

  const handleClearHistory = async () => {
    if (!selectedChat || !currentUser) return;
    try {
      const { error } = await supabase.from('messages')
        .delete()
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedChat.id}),and(sender_id.eq.${selectedChat.id},receiver_id.eq.${currentUser.id})`);
      
      if (error) throw error;
      
      setMessages(prev => prev.filter(m => 
        !((m.sender_id === currentUser.id && m.receiver_id === selectedChat.id) || 
          (m.sender_id === selectedChat.id && m.receiver_id === currentUser.id))
      ));
      
      addToast?.('تم مسح السجل بنجاح ✅');
      setShowSettings(false);
      setShowClearConfirm(false);
    } catch (e) {
      console.error(e);
      addToast?.('فشل مسح السجل', 'error');
    }
  };

  const handleBlockUser = async () => {
    if (!selectedChat || !currentUser) return;
    try {
      const { error } = await supabase.from('connections')
        .delete()
        .or(`and(requester_id.eq.${currentUser.id},recipient_id.eq.${selectedChat.id}),and(requester_id.eq.${selectedChat.id},recipient_id.eq.${currentUser.id})`);
      
      if (error) throw error;
      
      addToast?.(`تم حظر ${selectedChat.name} وإزالة المزامنة.`);
      onSelectChat(null as any);
      setShowSettings(false);
    } catch (e) {
      addToast?.('فشل تنفيذ الإجراء', 'error');
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || !currentUser) return;
    setIsCreatingGroup(true);
    try {
      const { data: newGroup, error: groupErr } = await supabase.from('groups').insert([{
        name: groupName,
        description: groupDescription,
        category: groupCategory,
        created_by: currentUser.id,
        is_private: isPrivate
      }]).select().single();
      
      if (groupErr) throw groupErr;
      if (newGroup) {
        const createdGroupId = (newGroup as any).id;
        const membersToInsert = [
          { group_id: createdGroupId, user_id: currentUser.id, role: 'owner', status: 'accepted' },
          ...selectedGroupMembers.map(uid => ({
            group_id: createdGroupId,
            user_id: uid,
            role: 'member',
            status: 'accepted'
          }))
        ];

        const { error: memErr } = await supabase.from('group_members').insert(membersToInsert);
        if (memErr) throw memErr;
        
        await fetchMyGroups?.();
        
        addToast?.('تم إنشاء المجموعة وإضافة الأعضاء بنجاح ✅');
        setShowCreateGroup(false);
        setGroupName('');
        setGroupDescription('');
        setSelectedGroupMembers([]);
        setSelectedGroup(newGroup);
      }
    } catch (e) {
      console.error(e);
      addToast?.('خطأ في إنشاء المجموعة', 'error');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const startEditMessage = (id: string, text: string) => {
    setEditingMessageId(id);
    setContent(text);
    setActiveMessageMenu(null);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setContent('');
  };

  const handleEditMessage = async () => {
    if (!editingMessageId || !content.trim() || !currentUser) return;
    // 🔒 Sanitize edited content
    const sanitizedContent = sanitizeInput(content.trim());
    if (!sanitizedContent) return;
    setIsSendingFile(true);
    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: sanitizedContent })
        .eq('id', editingMessageId)
        .eq('sender_id', currentUser.id); // 🔒 Ownership guard: only sender can edit
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content: sanitizedContent } : m));
      setEditingMessageId(null);
      setContent('');
      addToast?.('تم تعديل الرسالة بنجاح ✅');
    } catch (e) {
      addToast?.('فشل التعديل', 'error');
    } finally {
      setIsSendingFile(false);
    }
  };

  const handleSendOffer = async () => {
    if (!offerData.title || !selectedChat || !currentUser) return;
    
    const offerContent = `[OFFER_CARD:${offerData.title}|${offerData.salary || 'يُحدد لاحقاً'}]`;
    setIsSendingFile(true);
    
    const tempId = 'temp-' + Date.now();
    const optimisticMsg = {
      id: tempId, sender_id: currentUser.id, senderId: currentUser.id,
      receiver_id: selectedChat.id, receiverId: selectedChat.id,
      content: offerContent, status: 'sending',
      timestamp: { toDate: () => new Date() }, created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    const { error } = await supabase.from('messages').insert([{
      sender_id: currentUser.id,
      receiver_id: selectedChat.id,
      content: offerContent
    }]);

    setIsSendingFile(false);
    if (!error) {
      addToast?.('تم إرسال العرض بنجاح! 📝');
      setShowOfferModal(false);
      setOfferData({ title: '', salary: '' });
    } else {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      addToast?.('فشل إرسال العرض', 'error');
    }
  };

  // canSend: text is always allowed; file upload locks only during upload
  const canSend = !(pendingFile && isSendingFile) && (!!content.trim() || !!pendingFile) && !msgError;


  if (showCreateGroup) {
    return (
      <div className="fixed inset-0 top-[60px] md:top-[68px] bottom-[80px] md:bottom-0 left-0 right-0 z-40 overflow-y-auto bg-slate-50 dark:bg-slate-950 px-2 sm:px-4 py-4 overscroll-contain">
        <CreateGroupPage
          currentUser={currentUser}
          syncedUsers={syncedUsers}
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={(newGroup) => {
            setShowCreateGroup(false);
            onSelectChat(null as any);
            setSelectedGroup(null);
            setTimeout(() => {
              setSelectedGroup(newGroup);
            }, 50);
          }}
          addToast={addToast}
          fetchMyGroups={fetchMyGroups}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row md:rounded-t-[3rem] overflow-hidden shadow-2xl border-x border-t border-white/80 bg-white fixed md:relative top-[85px] bottom-[105px] left-3 right-3 md:top-0 md:bottom-0 md:left-0 md:right-0 md:h-[calc(100vh-75px)] md:mt-0 md:mx-auto anti-gravity-card rounded-[2.5rem] md:rounded-none" dir="rtl">

      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="font-black text-slate-800 text-lg mb-2">مسح سجل الدردشة؟</h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">سيتم حذف جميع الرسائل بينك وبين {selectedChat?.name} نهائياً. لا يمكن التراجع عن هذا الإجراء.</p>
              <div className="flex gap-3">
                <button onClick={handleClearHistory} className="flex-1 py-3 bg-red-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-red-200">نعم، امسح الكل</button>
                <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl text-xs font-black">إلغاء</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .chat-pattern { background-image: radial-gradient(#0a66c2 0.5px, transparent 0.5px); background-size: 24px 24px; opacity: 0.025; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-chat-scroll::-webkit-scrollbar { width: 4px; }
        .custom-chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-chat-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-chat-scroll { 
          -webkit-overflow-scrolling: touch; 
          overscroll-behavior-y: contain;
          touch-action: pan-y;
        }
      `}</style>

      {/* ===== Sidebar (Chat List) ===== */}
      <div className={`w-full md:w-80 flex flex-col bg-slate-50 border-l border-slate-100 z-30 h-full ${ (selectedChat || selectedGroup) ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 bg-white border-b border-slate-50 space-y-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setShowSidebarMenu(!showSidebarMenu)}
                className={`p-2.5 rounded-2xl transition-all ${showSidebarMenu ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
              >
                <Menu size={20} />
              </button>
              
              <AnimatePresence>
                {showSidebarMenu && (
                  <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSidebarMenu(false)} className="fixed inset-0 z-40 bg-black/5 md:absolute md:inset-[-100px] md:z-40" />
                    <motion.div initial={{ opacity: 0, scale: 0.9, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 20 }} className="absolute right-0 mt-2 w-56 bg-white rounded-3xl shadow-2xl border border-slate-100 py-2 z-50 overflow-hidden">
                      <button onClick={() => { setShowCreateGroup(true); setShowSidebarMenu(false); }} className="w-full px-4 py-3 flex items-center gap-3 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all">
                        <Plus size={18} className="text-blue-500" /> إنشاء مجموعة جديدة
                      </button>
                      <button onClick={() => { setShowMessagingSettings(true); setShowSidebarMenu(false); }} className="w-full px-4 py-3 flex items-center gap-3 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all">
                        <Settings size={18} className="text-blue-500" /> إعدادات المراسلة
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="البحث..."
                className="w-full bg-slate-100 border-none rounded-full py-2 pr-10 pl-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 py-4 px-3">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'people', label: 'أشخاص' },
              { id: 'groups', label: 'مجموعات' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setSearchFilter(filter.id as any)}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${
                  searchFilter === filter.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 scale-105' 
                    : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-400 hover:bg-slate-50 border border-slate-100 dark:border-slate-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-chat-scroll py-2 relative" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
          <div className="px-1 pb-20 md:pb-4">
            {unifiedConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 opacity-30">
              <MessageSquare size={32} />
              <p className="text-[10px] font-black mt-2">لا يوجد نتائج</p>
            </div>
          ) : unifiedConversations.map((conv, idx) => {
            const isSelected = conv.type === 'chat' ? selectedChat?.id === conv.id : selectedGroup?.id === conv.id;
            const unread = getUnreadCount(conv.id, conv.type as any);
            
            return (
              <motion.div 
                key={conv.id + conv.type}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => {
                  if (conv.type === 'chat') {
                    onSelectChat(conv.original);
                    markChatMessagesAsRead(conv.id);
                    setSelectedGroup(null);
                  } else {
                    setSelectedGroup(null);
                    setTimeout(() => {
                      setSelectedGroup(conv.original);
                      onSelectChat(null as any);
                    }, 10);
                  }
                }}
                className={`mx-2 mb-1 p-3 flex items-center gap-3 cursor-pointer rounded-2xl transition-all ${isSelected ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'hover:bg-white'}`}
              >
                  <div className={`w-12 h-12 rounded-full overflow-hidden border border-slate-100 shadow-sm relative`}>
                    {conv.avatar ? (
                      <img src={conv.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center text-white font-black text-lg ${conv.type === 'group' ? 'bg-indigo-500' : 'bg-blue-500'}`}>
                        {(conv.name || 'م')[0]}
                      </div>
                    )}
                    {conv.type === 'chat' && conv.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm ring-2 ring-green-500/20" />
                    )}
                  </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h4 className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>{conv.name}</h4>
                    <span className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{conv.time}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1 min-w-0 max-w-[180px]">
                      {conv.type === 'chat' && conv.lastMsg && (conv.lastMsg.senderId === currentUser?.id || conv.lastMsg.sender_id === currentUser?.id) && (
                        conv.lastMsg.read ? (
                          <CheckCheck size={13} className="text-blue-500 shrink-0" />
                        ) : (
                          <Check size={13} className="text-slate-400 shrink-0" />
                        )
                      )}
                      <p className={`text-[11px] truncate ${
                        unread > 0 
                          ? 'font-black text-slate-900 dark:text-white' 
                          : isSelected 
                            ? 'text-blue-100' 
                            : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {conv.lastMessage || (conv.type === 'group' ? 'مجموعة مهنية' : 'ابدأ المحادثة...')}
                      </p>
                    </div>
                    {unread > 0 && (
                      <span className={`min-w-[18px] h-[18px] px-1.5 flex items-center justify-center rounded-full text-[10px] font-black ${
                        isSelected 
                          ? 'bg-white text-blue-600 shadow-md' 
                          : 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 animate-pulse'
                      }`}>
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          </div>
        </div>
      </div>

      {/* ===== Chat Area ===== */}
      <div className={`flex-1 flex flex-col bg-white overflow-hidden relative min-h-0 ${(!selectedChat && !selectedGroup) ? 'hidden md:flex' : 'flex'}`}>

        {selectedGroup ? (
          <GroupDetailView 
            group={selectedGroup}
            appUser={currentUser}
            addToast={addToast || (() => {})}
            onBack={() => setSelectedGroup(null)}
          />
        ) : selectedChat ? (
          <div className="flex-1 flex flex-col relative z-10 bg-white/95 overflow-hidden">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-3 px-4 bg-white/80 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-50 dark:border-slate-800 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => onSelectChat(null as any)} className="md:hidden p-2 -ml-1 text-slate-400 hover:text-blue-600 dark:text-slate-600 transition-colors">
                  <ArrowRight size={22} />
                </button>
                
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => selectedChat && setSelectedProfile(selectedChat)}>
                  <div className="relative">
                    <img src={selectedChat.avatar || `https://ui-avatars.com/api/?name=${selectedChat.name}&background=random`} className="w-10 h-10 rounded-full border border-slate-100 shadow-sm object-cover" alt="" />
                    {isOnline(selectedChat.last_seen_at) && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white ring-2 ring-green-500/20" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 dark:text-white text-sm leading-tight">{selectedChat.name}</h4>
                    {isOnline(selectedChat.last_seen_at) ? (
                      <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        متصل الآن
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 font-bold">غير متصل</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 relative">
                <div className="flex items-center">
                  {currentUser?.isAdmin && (
                    <>
                      <button 
                        onClick={() => onStartCall(selectedChat)}
                        className="p-2.5 ml-1.5 bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-500 rounded-xl hover:bg-emerald-50 transition-all shadow-sm border border-slate-200 dark:border-slate-700"
                        title="اتصال مهني"
                      >
                        <Phone size={18} />
                      </button>
                      <button 
                        onClick={() => onStartCall(selectedChat, 'video')} 
                        className="p-2.5 ml-1.5 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-500 rounded-xl hover:bg-blue-50 transition-all shadow-sm border border-slate-200 dark:border-slate-700"
                        title="مكالمة فيديو"
                      >
                        <Video size={18} />
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-2.5 rounded-xl transition-all ${showSettings ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </div>

                {currentUser?.role === 'employer' && canSendOffer && (
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setShowOfferModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 w-full justify-center mt-2 border border-amber-400"
                  >
                    <Zap size={12} className="fill-white animate-pulse" />
                    تقديم عرض سريع ⚡
                  </motion.button>
                )}

                <AnimatePresence>
                  {showSettings && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute top-12 left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-[60] overflow-hidden"
                    >
                      <button onClick={() => selectedChat && setSelectedProfile(selectedChat)} className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all">
                        <User size={16} className="text-blue-500" /> عرض الملف الشخصي
                      </button>
                      <button onClick={() => { setIsMuted(!isMuted); addToast?.(isMuted ? 'تم تفعيل الإشعارات' : 'تم كتم الإشعارات'); }} className={`w-full px-4 py-2.5 flex items-center gap-3 text-xs font-black transition-all ${isMuted ? 'text-blue-600 bg-blue-50' : 'text-slate-700 hover:bg-slate-50'}`}>
                        <Bell size={16} className={isMuted ? 'text-blue-600' : 'text-amber-500'} /> {isMuted ? 'إلغاء الكتم' : 'كتم الإشعارات'}
                      </button>
                      <button onClick={() => { setShowMessagingSettings(true); setShowSettings(false); }} className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all">
                        <Settings size={16} className="text-blue-500" /> إعدادات المراسلة
                      </button>
                      <div className="h-px bg-slate-50 my-1 mx-4" />
                      <button onClick={() => setShowClearConfirm(true)} className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all">
                        <Trash2 size={16} className="text-red-400" /> مسح سجل الدردشة
                      </button>
                      <button onClick={handleBlockUser} className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-black text-red-600 hover:bg-red-50 transition-all">
                        <Shield size={16} /> حظر المستخدم
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Messages Area */}
            <div className={`flex-1 min-h-0 overflow-y-auto custom-chat-scroll p-4 space-y-3 relative z-0 ${WALLPAPERS[chatSettings.chatWallpaper]}`}>
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
                  <div className="w-20 h-20 bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center"><MessageSquare size={36} className="text-blue-100" /></div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">ابدأ محادثتك الأولى</p>
                </div>
              ) : chatMessages.map((m) => {
                const sId = String(m?.senderId || m?.sender_id || '').toLowerCase().trim();
                const myId = String(currentUser?.id || '').toLowerCase().trim();
                const isMine = sId === myId;
                const isMenuOpen = activeMessageMenu === m.id;
                
                return (
                  <div key={m.id} className={`flex items-end gap-2 relative ${isMine ? 'flex-row-reverse' : ''}`}>
                    <div 
                      className={`max-w-[80%] flex flex-col group cursor-pointer ${isMine ? 'items-end' : 'items-start'}`}
                      onClick={() => {
                        if (m.status === 'failed') { retryMessage(m); return; }
                        setActiveMessageMenu(isMenuOpen ? null : m.id);
                      }}
                    >
                      <div className={`px-4 py-2 ${FONT_SIZE_CLASSES[chatSettings.fontSize]} relative transition-all active:scale-[0.98] ${
                        isMine ? BUBBLE_ROUNDED[chatSettings.bubbleStyle].mine : BUBBLE_ROUNDED[chatSettings.bubbleStyle].others
                      } ${isMine
                        ? m.status === 'failed'
                          ? 'bg-red-100 text-red-700 shadow-md border-2 border-red-300'
                          : m.status === 'sending'
                          ? 'bg-[#0a66c2]/70 text-white/80 shadow-md'
                          : 'bg-[#0a66c2] text-white shadow-md'
                        : 'bg-slate-100 text-slate-800 border border-slate-200 shadow-sm'}`}>
                        
                        {renderMessageContent(m.content)}
                        
                        {/* Failed overlay */}
                        {m.status === 'failed' && isMine && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] font-black text-red-500">
                            <span>⚠ فشل الإرسال — اضغط لإعادة المحاولة</span>
                          </div>
                        )}

                        {/* Message Context Menu (Telegram style) */}
                        <AnimatePresence>
                          {isMenuOpen && m.status !== 'failed' && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveMessageMenu(null); }} />
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9, y: isMine ? -10 : 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: isMine ? -10 : 10 }}
                                className={`absolute z-50 min-w-[120px] bg-white rounded-2xl shadow-2xl border border-slate-100 py-1.5 overflow-hidden ${isMine ? 'left-0 bottom-full mb-2' : 'right-0 top-full mt-2'}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button 
                                  onClick={() => { navigator.clipboard.writeText(m.content); setActiveMessageMenu(null); addToast?.('تم النسخ'); }}
                                  className="w-full px-4 py-2 flex items-center gap-2.5 text-[11px] font-black text-slate-700 hover:bg-slate-50 transition-all"
                                >
                                  <Copy size={14} className="text-slate-400" /> نسخ النص
                                </button>
                                {isMine && (
                                  <>
                                    <button 
                                      onClick={() => startEditMessage(m.id, m.content)}
                                      className="w-full px-4 py-2 flex items-center gap-2.5 text-[11px] font-black text-slate-700 hover:bg-slate-50 transition-all"
                                    >
                                      <Edit2 size={14} className="text-blue-500" /> تعديل الرسالة
                                    </button>
                                    <button 
                                      onClick={() => { handleDeleteMessage(m.id); setActiveMessageMenu(null); }}
                                      className="w-full px-4 py-2 flex items-center gap-2.5 text-[11px] font-black text-red-600 hover:bg-red-50 transition-all"
                                    >
                                      <Trash2 size={14} /> حذف الرسالة
                                    </button>
                                  </>
                                )}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
                        {m.is_edited && <span className="text-[8px] text-slate-300 font-bold">تم التعديل</span>}
                        <span className="text-[9px] text-slate-400 font-bold">{formatTime(m.created_at || m.timestamp)}</span>
                        {isMine && (
                          <span className="flex items-center ml-0.5" title={m.read ? 'تمت الرؤية ✓✓' : 'تم الإرسال ✓'}>
                            {m.status === 'failed' ? (
                              <span className="text-[9px] text-red-500 font-black">✕</span>
                            ) : m.status === 'sending' ? (
                              <Loader2 size={11} className="text-slate-300 animate-spin" />
                            ) : m.read ? (
                              <CheckCheck size={14} className="text-blue-500" />
                            ) : (
                              <Check size={14} className="text-slate-400" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }) }
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white/95 backdrop-blur-md border-t border-slate-100 z-10 shrink-0 space-y-2">
              {/* Emoji Panel */}
              <AnimatePresence>
                {showEmojis && (
                  <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex gap-2 flex-wrap custom-chat-scroll overflow-x-auto max-h-28">
                    {emojis.map(e => <button key={e} onClick={() => setContent(p => p + e)} className="text-xl hover:scale-125 transition-transform">{e}</button>)}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Pending file preview */}
              <AnimatePresence>
                {pendingPreview && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="relative bg-slate-50 rounded-2xl p-2 border border-slate-200 flex items-center gap-3">
                    {pendingPreview.startsWith('video:') ? (
                      <div className="flex items-center gap-2 px-2">
                        <Video size={24} className="text-blue-500" />
                        <span className="text-xs font-black text-slate-600 truncate max-w-[180px]">{pendingFile?.name}</span>
                      </div>
                    ) : (
                      <img src={pendingPreview} className="h-16 w-16 rounded-xl object-cover border border-slate-200 shrink-0" alt="preview" />
                    )}
                    <p className="flex-1 text-[10px] text-slate-400 font-bold">
                      {pendingFile ? (pendingFile.size > 1024*1024 ? `${(pendingFile.size/1024/1024).toFixed(1)} MB` : `${(pendingFile.size/1024).toFixed(0)} KB`) : ''}
                    </p>
                    <button onClick={cancelPendingFile} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main input row */}
              <div className={`flex items-center gap-2 bg-slate-100 rounded-2xl p-1.5 transition-all border ${msgError ? 'border-red-400 bg-red-50/20' : 'border-transparent focus-within:bg-white focus-within:border-blue-300'}`}>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleAttachment} />
                <button onClick={() => fileInputRef.current?.click()} className={`p-2 rounded-xl transition-all shrink-0 ${pendingFile ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600'}`}>
                  <ImageIcon size={18} />
                </button>
                <button onClick={() => setShowEmojis(!showEmojis)} className={`p-2 rounded-xl transition-all shrink-0 ${showEmojis ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}>
                  <Smile size={18} />
                </button>
                <input 
                  className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-900 placeholder:text-slate-400 px-3 py-2 rounded-xl"
                  placeholder={pendingFile ? "أضف وصفاً للمرفق... (اختياري)" : "اكتب رسالة..."}
                  value={content} 
                  onChange={e => handleContentChange(e.target.value)}
                  onKeyDown={e => {
                    if ((chatSettings.sendOnEnter ?? true) ? (e.key === 'Enter' && !e.shiftKey) : false) {
                      e.preventDefault();
                      if (canSend) {
                        if (editingMessageId) handleEditMessage();
                        else sendMessage();
                      }
                    }
                  }} 
                />
                <motion.button 
                  whileTap={{ scale: 0.9 }} 
                  onClick={editingMessageId ? handleEditMessage : sendMessage} 
                  disabled={!canSend}
                  className={`p-2.5 rounded-xl transition-all shrink-0 ${canSend ? (editingMessageId ? 'bg-emerald-600' : 'bg-blue-600') + ' text-white hover:opacity-90 shadow-md shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                  {isSendingFile ? <Loader2 size={16} className="animate-spin" /> : (editingMessageId ? <Check size={16} /> : <Send size={16} className="rotate-180" />)}
                </motion.button>
              </div>
              {msgError && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[11px] font-semibold">
                  <X size={13} className="shrink-0 text-red-500" />
                  <span>{msgError}</span>
                </div>
              )}
              {editingMessageId && (
                <div className="flex items-center justify-between px-3 py-1 bg-blue-50/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Edit2 size={12} className="text-blue-500" />
                    <span className="text-[10px] font-black text-blue-600">تعديل الرسالة</span>
                  </div>
                  <button onClick={cancelEdit} className="text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors">إلغاء</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 relative z-10 p-8">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div className="w-28 h-28 bg-white rounded-[3rem] shadow-2xl shadow-blue-600/10 flex items-center justify-center border border-white"><MessageSquare size={44} className="text-[#0a66c2]/20" /></div>
            </motion.div>
            <div className="text-center">
              <h3 className="font-black text-slate-800 text-lg mb-2">اختر محادثة</h3>
              <p className="text-xs text-slate-400 font-bold max-w-[200px] leading-relaxed">{syncedUsers.length > 0 ? 'اختر شخصاً من القائمة للبدء' : 'تزامن مع أشخاص أولاً لإرسال الرسائل'}</p>
            </div>
            <div className="flex gap-4">
              <div className="text-center px-5 py-3 bg-white/80 rounded-2xl border border-white shadow-sm">
                <p className="font-black text-blue-600 text-lg">{syncedUsers.length}</p>
                <p className="text-[9px] text-slate-400 font-black uppercase">متاحون</p>
              </div>
              <div className="text-center px-5 py-3 bg-white/80 rounded-2xl border border-white shadow-sm">
                <p className="font-black text-[#0a66c2] text-lg">{messages.length}</p>
                <p className="text-[9px] text-slate-400 font-black uppercase">رسائل</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Offer Modal */}
      <AnimatePresence>
        {showOfferModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl"
              dir="rtl"
            >
              <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 relative">
                 <div className="absolute top-4 left-4 p-1.5 bg-white/20 rounded-full cursor-pointer hover:bg-white/30" onClick={() => setShowOfferModal(false)}>
                    <X size={14} className="text-white" />
                 </div>
                 <div className="w-14 h-14 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-3">
                    <Briefcase size={28} className="text-amber-500" />
                 </div>
                 <h3 className="text-xl font-black text-white leading-tight">إرسال عرض عمل</h3>
                 <p className="text-xs text-amber-50 font-bold mt-1">دعوة رسمية سريعة داخل المحادثة</p>
              </div>
              <div className="p-6 space-y-4">
                 <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 ml-1">المسمى الوظيفي المتاح</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50"
                      placeholder="مثال: مطور تطبيقات واجهات أمامية"
                      value={offerData.title}
                      onChange={e => setOfferData({ ...offerData, title: e.target.value })}
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 ml-1">الراتب المتوقع (اختياري)</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50"
                      placeholder="مثال: $1,200 شهرياً"
                      value={offerData.salary}
                      onChange={e => setOfferData({ ...offerData, salary: e.target.value })}
                    />
                 </div>
                 <button 
                   onClick={handleSendOffer}
                   disabled={!offerData.title || isSending}
                   className="w-full py-3.5 mt-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-sm font-black shadow-lg shadow-slate-200 dark:shadow-none hover:bg-slate-800 transition-colors disabled:opacity-50"
                 >
                   {isSending ? 'جاري الإرسال...' : 'إرسال العرض'}
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Telegram-Style Messaging Settings Modal ── */}
      <AnimatePresence>
        {showMessagingSettings && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[550] flex items-center justify-center p-3 sm:p-4" dir="rtl">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              {/* Header with Telegram styling */}
              <div className="bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 p-5 sm:p-6 text-white relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMessagingSettings(false)}
                  className="absolute top-5 left-5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} className="text-white" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg">
                    <Settings size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white leading-tight">إعدادات المراسلة والدردشة</h3>
                    <p className="text-xs text-blue-100 font-bold mt-0.5">تخصيص كامل للمظهر والخطوط والسلوك كالتليجرام</p>
                  </div>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto custom-chat-scroll p-5 space-y-4 text-slate-800 dark:text-slate-100">
                {/* 1. حجم خط المحادثة والفقاعات */}
                <div className="space-y-3">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    🎨 مظهر الرسائل والخطوط
                  </span>
                  
                  {/* Font Size */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Type size={16} className="text-blue-600" />
                        حجم خط نصوص المحادثة
                      </span>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/40">
                        {chatSettings.fontSize === 'small' ? 'صغير (12px)' : chatSettings.fontSize === 'normal' ? 'قياسي (14px)' : chatSettings.fontSize === 'large' ? 'كبير (16px)' : 'كبير جداً (18px)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'small', label: 'صغير' },
                        { id: 'normal', label: 'قياسي' },
                        { id: 'large', label: 'كبير' },
                        { id: 'huge', label: 'ضخم' },
                      ].map(sz => (
                        <button
                          key={sz.id}
                          type="button"
                          onClick={() => updateChatSetting('fontSize', sz.id as any)}
                          className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${chatSettings.fontSize === sz.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50'}`}
                        >
                          {sz.label}
                        </button>
                      ))}
                    </div>
                    {/* Live Preview */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex justify-end">
                      <div className={`px-4 py-2 rounded-2xl rounded-bl-sm bg-[#0a66c2] text-white shadow-sm ${FONT_SIZE_CLASSES[chatSettings.fontSize]}`}>
                        معاينة: مرحباً! كيف يمكنني مساعدتك؟ ✨
                      </div>
                    </div>
                  </div>

                  {/* Bubble Style */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2.5">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <MessageSquare size={16} className="text-blue-600" />
                      شكل فقاعات الرسائل
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'modern', label: 'عصري منحني' },
                        { id: 'classic', label: 'كلاسيكي' },
                        { id: 'minimal', label: 'دائري ناعم' },
                      ].map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => updateChatSetting('bubbleStyle', b.id as any)}
                          className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${chatSettings.bubbleStyle === b.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Wallpaper */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2.5">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <Palette size={16} className="text-blue-600" />
                      خلفية الشات
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'default', label: 'افتراضي' },
                        { id: 'subtle-blue', label: 'أزرق هادئ' },
                        { id: 'slate', label: 'رمادي دافئ' },
                        { id: 'dots', label: 'نقاط' },
                      ].map(wp => (
                        <button
                          key={wp.id}
                          type="button"
                          onClick={() => updateChatSetting('chatWallpaper', wp.id as any)}
                          className={`py-2 rounded-xl text-[11px] font-black transition-all cursor-pointer ${chatSettings.chatWallpaper === wp.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}
                        >
                          {wp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. الإدخال والإرسال */}
                <div className="space-y-2.5 pt-2">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    ⌨️ الإدخال والإرسال
                  </span>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-white">الإرسال بمفتاح Enter</h4>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                        إرسال الرسالة مباشرة بالضغط على Enter (و Shift+Enter لسطر جديد)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateChatSetting('sendOnEnter', !chatSettings.sendOnEnter)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${chatSettings.sendOnEnter ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'}`}
                    >
                      <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-md" />
                    </button>
                  </div>
                </div>

                {/* 3. الأصوات والاهتزاز */}
                <div className="space-y-2.5 pt-2">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    🔔 الأصوات والاهتزاز
                  </span>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0"><Volume2 size={16} /></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-slate-800 dark:text-white">صوت إرسال الرسائل</h4>
                          <button
                            type="button"
                            onClick={() => playSendSound()}
                            className="text-[9px] font-bold text-blue-600 hover:underline px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 rounded-md"
                          >
                            ▶ استمع
                          </button>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">تشغيل نغمة لطيفة عند إرسال واستقبال الرسائل</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateChatSetting('messageSounds', !chatSettings.messageSounds)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${chatSettings.messageSounds ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'}`}
                    >
                      <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-md" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0"><Smartphone size={16} /></div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white">الاهتزاز اللمسي (Haptic Feedback)</h4>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">اهتزاز خفيف للهاتف عند إرسال الرسائل والتفاعل</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !chatSettings.hapticFeedback;
                        updateChatSetting('hapticFeedback', next);
                        if (next) triggerHaptic();
                      }}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${chatSettings.hapticFeedback ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'}`}
                    >
                      <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-md" />
                    </button>
                  </div>
                </div>

                {/* 4. الخصوصية ومؤشرات القراءة */}
                <div className="space-y-2.5 pt-2">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    🔒 الخصوصية ومؤشرات القراءة
                  </span>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0"><CheckCheck size={16} /></div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white">مؤشرات قراءة الرسائل (✓✓)</h4>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">إظهار علامتي الصح الزرقاء عند رؤية الطرف الآخر للرسالة</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateChatSetting('readReceipts', !chatSettings.readReceipts)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${chatSettings.readReceipts ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'}`}
                    >
                      <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-md" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shrink-0"><Eye size={16} /></div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white">إظهار حالة الاتصال</h4>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">عرض نقطة الاتصال الخضراء "متصل الآن" للآخرين</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateChatSetting('showOnlineStatus', !chatSettings.showOnlineStatus)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${chatSettings.showOnlineStatus ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'}`}
                    >
                      <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-md" />
                    </button>
                  </div>
                </div>

                {/* 5. الوسائط والبيانات */}
                <div className="space-y-2.5 pt-2">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    🖼️ البيانات والوسائط
                  </span>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-white">التحميل التلقائي للصور</h4>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">عرض الصور ومقاطع الفيديو فور استلامها مباشرة</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateChatSetting('autoDownloadMedia', !chatSettings.autoDownloadMedia)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${chatSettings.autoDownloadMedia ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'}`}
                    >
                      <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-md" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setChatSettings(DEFAULT_CHAT_SETTINGS);
                    try { localStorage.setItem('prolink_chat_settings', JSON.stringify(DEFAULT_CHAT_SETTINGS)); } catch (_) {}
                    addToast?.('تمت استعادة الإعدادات الافتراضية');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
                >
                  استعادة الافتراضي
                </button>
                <button
                  type="button"
                  onClick={() => setShowMessagingSettings(false)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  تم، حفظ التفضيلات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
