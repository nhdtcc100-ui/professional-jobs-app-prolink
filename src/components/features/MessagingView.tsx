import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SkeletonConversationItem } from '../ui';
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
  Phone,
  Group,
  Filter,
  Clock
} from 'lucide-react';
import { GroupDetailView } from './groups';
import { supabase } from '../../lib/supabase';
import { imageService } from '../../lib/services/imageService';
import { AppUser, AppConnection } from '../../types';
import { sanitizeInput } from '../../lib/security/inputValidator';

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
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
  
  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (currentUser?.role !== 'employer' || !selectedChat) {
        setCanSendOffer(false);
        return;
      }
      try {
        // Precise query: Check if selectedChat has an 'approved' application for ANY job owned by currentUser
        const { data, error } = await supabase
          .from('job_applications')
          .select(`
            id, 
            status, 
            jobs!inner (user_id)
          `)
          .eq('applicant_id', selectedChat.id)
          .eq('status', 'approved')
          .eq('jobs.user_id', currentUser.id)
          .limit(1);
        
        setCanSendOffer(!error && data && data.length > 0);
      } catch (e) {
        console.error('Error checking approval status', e);
        setCanSendOffer(false);
      }
    };
    checkApprovalStatus();
  }, [selectedChat, currentUser]);

  const formatTime = (ts: any) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
  };

  const chatMessages = messages.filter(m =>
    (m.senderId === currentUser?.id && m.receiverId === selectedChat?.id) ||
    (m.senderId === selectedChat?.id && m.receiverId === currentUser?.id)
  );

  const syncedUsers = allUsers.filter(u => {
    if (u.id === currentUser?.id) return false;
    return connections.some(c =>
      c.status === 'accepted' &&
      ((c.requesterId === currentUser?.id && c.recipientId === u.id) ||
        (c.requesterId === u.id && c.recipientId === currentUser?.id))
    );
  });

  const isOnline = (lastSeenAt: string | null) => {
    if (!lastSeenAt) return false;
    const lastSeen = new Date(lastSeenAt).getTime();
    const now = new Date().getTime();
    return (now - lastSeen) < 180000; // 3 minutes
  };

  const unifiedConversations = [
    ...syncedUsers.map(u => {
      const lastMsg = messages.filter(m => (m.senderId === currentUser?.id && m.receiverId === u.id) || (m.senderId === u.id && m.receiverId === currentUser?.id)).slice(-1)[0];
      return {
        id: u.id, 
        name: u.name, 
        avatar: u.avatar, 
        type: 'chat', 
        original: u,
        lastMsg,
        lastSeenAt: u.last_seen_at,
        isOnline: isOnline(u.last_seen_at),
        timestamp: lastMsg?.timestamp || 0,
        time: lastMsg ? formatTime(lastMsg.timestamp) : '',
        lastMessage: lastMsg ? lastMsg.content.replace(/\[MEDIA:[^\]]+\][^\n]*/, '📎 مرفق') : ''
      };
    }),
    ...(myGroups || []).map(g => ({ 
      id: g.id, 
      name: g.name, 
      avatar: g.avatar_url, 
      type: 'group', 
      original: g,
      lastMsg: null,
      timestamp: g.created_at || 0,
      time: g.created_at ? formatTime(g.created_at) : '',
      lastMessage: 'مجموعة مهنية'
    }))
  ].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  }).filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
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
    return notifications.filter(n => 
      n.read === false && 
      (type === 'chat' ? (n.fromId === convId && n.type === 'message') : (n.targetId === convId && n.type === 'group_message'))
    ).length;
  };
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

  const sendMessage = async () => {
    if (!currentUser) return;
    if ((!content.trim() && !pendingFile) || !selectedChat) return;
    if (isSending) return;

    setIsSending(true);
    // 🔒 Sanitize text before sending
    const msgText = sanitizeInput(content.trim());
    const fileToSend = pendingFile;
    
    setContent('');
    setPendingFile(null);
    setPendingPreview(null);
    setShowEmojis(false);

    try {
      if (fileToSend) {
        const isVideo = fileToSend.type.startsWith('video/');
        let finalUrl = '';

        if (isVideo) {
          finalUrl = await imageService.uploadVideo(fileToSend, currentUser.id) || '';
        } else {
          finalUrl = await imageService.processAndUpload(fileToSend, currentUser.id, 'images');
        }

        const prefix = isVideo ? '[MEDIA:video]' : '[MEDIA:photo]';
        const mediaContent = msgText ? `${prefix}${finalUrl}\n${msgText}` : `${prefix}${finalUrl}`;

        const tempId = 'temp-' + Date.now();
        const optimisticMsg = {
          id: tempId,
          sender_id: currentUser.id,
          senderId: currentUser.id,
          receiver_id: selectedChat.id,
          receiverId: selectedChat.id,
          content: mediaContent,
          timestamp: { toDate: () => new Date() },
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);

        const { error } = await supabase.from('messages').insert([{
          sender_id: currentUser.id,
          receiver_id: selectedChat.id,
          content: mediaContent
        }]);

        if (error) {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          throw error;
        }
      } else if (msgText) {
        const tempId = 'temp-' + Date.now();
        const newMessage = {
          id: tempId,
          sender_id: currentUser.id,
          senderId: currentUser.id,
          receiver_id: selectedChat.id,
          receiverId: selectedChat.id,
          content: msgText,
          timestamp: { toDate: () => new Date() },
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, newMessage]);

        const { error } = await supabase.from('messages').insert([{ 
          sender_id: currentUser.id, 
          receiver_id: selectedChat.id, 
          content: msgText 
        }]);

        if (error) {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          throw error;
        }
      }
    } catch (err) {
      console.error('Send failed:', err);
      addToast?.('فشل إرسال الرسالة، يرجى المحاولة مرة أخرى', 'error');
    } finally {
      setIsSending(false);
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
        const membersToInsert = [
          { group_id: newGroup.id, user_id: currentUser.id, role: 'owner', status: 'accepted' },
          ...selectedGroupMembers.map(uid => ({
            group_id: newGroup.id,
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
    setIsSending(true);
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
      setIsSending(false);
    }
  };

  const handleSendOffer = async () => {
    if (!offerData.title || !selectedChat || !currentUser) return;
    
    const offerContent = `[OFFER_CARD:${offerData.title}|${offerData.salary || 'يُحدد لاحقاً'}]`;
    setIsSending(true);
    
    const tempId = 'temp-' + Date.now();
    const optimisticMsg = {
      id: tempId,
      sender_id: currentUser.id,
      senderId: currentUser.id,
      receiver_id: selectedChat.id,
      receiverId: selectedChat.id,
      content: offerContent,
      timestamp: { toDate: () => new Date() },
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    const { error } = await supabase.from('messages').insert([{
      sender_id: currentUser.id,
      receiver_id: selectedChat.id,
      content: offerContent
    }]);

    setIsSending(false);
    if (!error) {
      addToast?.('تم إرسال العرض بنجاح! 📝');
      setShowOfferModal(false);
      setOfferData({ title: '', salary: '' });
    } else {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      addToast?.('فشل إرسال العرض', 'error');
    }
  };

  const canSend = !isSending && (!!content.trim() || !!pendingFile);

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
      <div className={`w-full md:w-80 flex flex-col bg-slate-50 border-l border-slate-100 z-30 ${ (selectedChat || selectedGroup) ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 bg-white border-b border-slate-50 space-y-3">
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
                      <button className="w-full px-4 py-3 flex items-center gap-3 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all">
                        <Settings size={18} className="text-slate-400" /> إعدادات المراسلة
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

        <div className="flex-1 overflow-y-auto custom-chat-scroll py-2 relative no-scrollbar md:scrollbar-thin" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
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
                        {conv.name[0]}
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
                    <p className={`text-[11px] truncate max-w-[180px] ${isSelected ? 'text-blue-500' : 'text-slate-500'}`}>{conv.lastMessage || (conv.type === 'group' ? 'مجموعة مهنية' : 'ابدأ المحادثة...')}</p>
                    {unread > 0 && (
                      <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold ${isSelected ? 'bg-white text-blue-600' : 'bg-blue-600 text-white shadow-sm'}`}>
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
            <div className="flex-1 min-h-0 overflow-y-auto custom-chat-scroll p-4 space-y-3 relative z-0">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
                  <div className="w-20 h-20 bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center"><MessageSquare size={36} className="text-blue-100" /></div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">ابدأ محادثتك الأولى</p>
                </div>
              ) : chatMessages.map((m) => {
                const isMine = m.senderId === currentUser?.id;
                const isMenuOpen = activeMessageMenu === m.id;
                
                return (
                  <div key={m.id} className={`flex items-end gap-2 relative ${isMine ? 'flex-row-reverse' : ''}`}>
                    <div 
                      className={`max-w-[80%] flex flex-col group cursor-pointer ${isMine ? 'items-end' : 'items-start'}`}
                      onClick={() => setActiveMessageMenu(isMenuOpen ? null : m.id)}
                    >
                      <div className={`px-4 py-2 text-sm relative transition-all active:scale-[0.98] ${isMine
                        ? 'bg-[#0a66c2] text-white rounded-2xl rounded-bl-sm shadow-md'
                        : 'bg-slate-100 text-slate-800 rounded-2xl rounded-br-sm border border-slate-200 shadow-sm'}`}>
                        
                        {renderMessageContent(m.content)}
                        
                        {/* Message Context Menu (Telegram style) */}
                        <AnimatePresence>
                          {isMenuOpen && (
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
                        <span className="text-[9px] text-slate-400 font-bold">{formatTime(m.timestamp)}</span>
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
              <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-1.5 focus-within:bg-white focus-within:border-blue-300 border border-transparent transition-all">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleAttachment} />
                <button onClick={() => fileInputRef.current?.click()} className={`p-2 rounded-xl transition-all shrink-0 ${pendingFile ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600'}`}>
                  <ImageIcon size={18} />
                </button>
                <button onClick={() => setShowEmojis(!showEmojis)} className={`p-2 rounded-xl transition-all shrink-0 ${showEmojis ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}>
                  <Smile size={18} />
                </button>
                <input 
                  className="flex-1 bg-white border-none outline-none text-sm font-bold text-slate-900 placeholder:text-slate-400 px-3 py-2 rounded-xl"
                  placeholder={pendingFile ? "أضف وصفاً للمرفق... (اختياري)" : "اكتب رسالة..."}
                  value={content} 
                  onChange={e => setContent(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} 
                />
                <motion.button 
                  whileTap={{ scale: 0.9 }} 
                  onClick={editingMessageId ? handleEditMessage : sendMessage} 
                  disabled={!canSend}
                  className={`p-2.5 rounded-xl transition-all shrink-0 ${canSend ? (editingMessageId ? 'bg-emerald-600' : 'bg-blue-600') + ' text-white hover:opacity-90 shadow-md shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : (editingMessageId ? <Check size={16} /> : <Send size={16} className="rotate-180" />)}
                </motion.button>
              </div>
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

      {/* New Group Modal */}
      <AnimatePresence>
        {showCreateGroup && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowCreateGroup(false)} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 50 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 50 }} 
              className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] mb-12 md:mb-0"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <Plus size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 leading-none">إنشاء مجموعة</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">ابدأ مجتمعاً مهنياً جديداً</p>
                  </div>
                </div>
                <button onClick={() => setShowCreateGroup(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-chat-scroll">
                {/* Privacy Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isPrivate ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                      {isPrivate ? <Shield size={18} /> : <Compass size={18} />}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">{isPrivate ? 'مجموعة خاصة' : 'مجموعة عامة'}</p>
                      <p className="text-[9px] text-slate-400 font-bold">{isPrivate ? 'تحتاج لموافقة المالك للانضمام' : 'يمكن للجميع الانضمام والرد'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={`w-12 h-6 rounded-full relative transition-all ${isPrivate ? 'bg-amber-500' : 'bg-green-500'}`}
                  >
                    <motion.div 
                      animate={{ x: isPrivate ? -24 : -2 }}
                      className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                    />
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mr-1 mb-2 block">اسم المجموعة</label>
                      <input 
                        type="text" 
                        placeholder="أدخل اسم المجموعة..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mr-1 mb-2 block">التصنيف</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                        value={groupCategory}
                        onChange={(e) => setGroupCategory(e.target.value)}
                      >
                        <option value="عام">عام</option>
                        <option value="تقني">تقني</option>
                        <option value="وظائف">وظائف</option>
                        <option value="تجارة">تجارة</option>
                        <option value="هندسة">هندسة</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mr-1 mb-2 block">نبذة عن المجموعة</label>
                    <textarea 
                      placeholder="ما هو هدف هذه المجموعة؟"
                      className="w-full h-[115px] bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all resize-none"
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                    />
                  </div>
                </div>

                {/* Horizontal Member Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase mr-1">إضافة أعضاء ({selectedGroupMembers.length})</label>
                    <div className="relative w-40">
                      <Search size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="بحث..." 
                        className="w-full bg-slate-50 border-none rounded-full py-1.5 pr-8 pl-3 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-4 overflow-x-auto pb-4 custom-chat-scroll -mx-2 px-2 scroll-smooth">
                    {syncedUsers.filter(u => u.name.toLowerCase().includes(memberSearchQuery.toLowerCase())).length === 0 ? (
                      <div className="w-full py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-[10px] text-slate-400 font-black">لا يوجد نتائج للبحث</p>
                      </div>
                    ) : syncedUsers.filter(u => u.name.toLowerCase().includes(memberSearchQuery.toLowerCase())).map(user => {
                      const isSelected = selectedGroupMembers.includes(user.id);
                      return (
                        <button 
                          key={user.id}
                          onClick={() => {
                            if (isSelected) setSelectedGroupMembers(p => p.filter(id => id !== user.id));
                            else setSelectedGroupMembers(p => [...p, user.id]);
                          }}
                          className="flex flex-col items-center gap-2 shrink-0 group"
                        >
                          <div className="relative">
                            <img 
                              src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} 
                              className={`w-16 h-16 rounded-[1.5rem] border-2 transition-all shadow-sm object-cover ${isSelected ? 'border-blue-600 scale-105' : 'border-white group-hover:border-slate-100'}`} 
                              alt="" 
                            />
                            {isSelected && (
                              <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                                <Plus size={14} className="rotate-45" />
                              </div>
                            )}
                          </div>
                          <p className={`text-[10px] font-black truncate w-20 text-center ${isSelected ? 'text-blue-600' : 'text-slate-600'}`}>{user.name}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
                <button 
                  onClick={() => setShowCreateGroup(false)}
                  className="flex-1 py-4 text-slate-500 font-black text-xs hover:bg-slate-100 rounded-2xl transition-all"
                >
                  إلغاء الأمر
                </button>
                <button 
                  onClick={createGroup}
                  disabled={isCreatingGroup || !groupName.trim()}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-blue-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isCreatingGroup ? <Loader2 size={18} className="animate-spin" /> : 'تأكيد وإنشاء المجموعة'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
    </div>
  );
}
