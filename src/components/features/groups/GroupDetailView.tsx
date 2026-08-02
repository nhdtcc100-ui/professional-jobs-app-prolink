import React, { useState, useEffect, useRef } from 'react';
import { Plus, Send, Image as ImageIcon, Camera, Users, MoreHorizontal, Loader2, ArrowRight, Smile, X, Video, User, Bell, Trash2, Shield, Edit2, ShieldAlert, UserMinus, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { imageService } from '../../../lib/services/imageService';
import { groupService } from '../../../lib/services/groupService';

interface GroupDetailViewProps {
  group: any;
  appUser: any;
  addToast: (m: string, t?: any) => void;
  onBack: () => void;
  pendingRequests?: any[];
  connections?: any[];
  allUsers?: any[];
  onApprove?: (id: any, acc: any) => Promise<void>;
  onInvite?: (g: any, u: any) => Promise<void>;
  fetchPending?: (groupId: string) => Promise<void>;
  sharedPost?: any;
  onClearSharedPost?: () => void;
}

export const GroupDetailView: React.FC<GroupDetailViewProps> = ({
  group,
  appUser,
  addToast,
  onBack
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [membersCount, setMembersCount] = useState(group.member_count || 0);
  const [memberAvatars, setMemberAvatars] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState<'none' | 'pending' | 'accepted' | 'owner' | 'suspended'>('none');
  const [authorsMap, setAuthorsMap] = useState<Record<string, any>>({});
  const [isJoining, setIsJoining] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [editContent, setEditContent] = useState('');
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const emojis = ['👍','❤️','🔥','😂','💯','🚀','💼','🤝','✅','✨','🎯','💡','👏','🙌','🤔','😎','🙏','🎉','💻','📊','📈','🏆'];

  useEffect(() => {
    fetchMessages();
    fetchMemberCount();
    checkMembership();
    
    // Realtime subscription
    const channel = supabase.channel(`group-chat-${group.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'group_posts', 
        filter: `group_id=eq.${group.id}` 
      }, () => fetchMessages())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `group_id=eq.${group.id}`
      }, () => {
        fetchMemberCount();
        checkMembership();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [group.id, appUser?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Defensive logging for state changes
  useEffect(() => {
    console.log(`DEBUG: [GroupDetailView] Messages state updated. Count: ${messages.length}`, messages);
  }, [messages]);

  const fetchMessages = async () => {
    try {
      console.log(`DEBUG: [GroupDetailView] Fetching messages for group: ${group.id}`);
      const { data: posts, error } = await supabase
        .from('group_posts')
        .select('*')
        .eq('group_id', group.id)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error("DEBUG: fetchMessages error:", error);
        return;
      }
      
      if (posts) {
        setMessages(prev => {
          const optimistic = prev.filter(m => String(m.id).startsWith('temp-'));
          
          // Filter out optimistic messages that now exist in the database
          const remainingOptimistic = optimistic.filter(opt => 
            !posts.some(p => (p.content === opt.content && p.author_id === opt.author_id) || p.id === opt.id)
          );

          // Merge and deduplicate
          const combined = [...posts, ...remainingOptimistic];
          const uniqueMap = new Map();
          combined.forEach(m => {
            if (!uniqueMap.has(m.id)) uniqueMap.set(m.id, m);
          });
          
          return Array.from(uniqueMap.values()).sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateA - dateB;
          });
        });

        const authorIds = Array.from(new Set(posts.map(p => p.author_id)));
        if (authorIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', authorIds);
          if (profiles) {
            const map: Record<string, any> = {};
            profiles.forEach(p => { map[p.id] = p; });
            setAuthorsMap(prev => ({ ...prev, ...map }));
          }
        }
      }
    } catch (err) {
      console.error("DEBUG: fetchMessages exception:", err);
    }
    setLoading(false);
  };

  const fetchMemberCount = async () => {
    try {
      const { data: members, count, error: membersErr } = await supabase
        .from('group_members')
        .select('user_id', { count: 'exact' })
        .eq('group_id', group.id)
        .eq('status', 'accepted')
        .limit(5);
      
      if (membersErr) throw membersErr;
      if (count !== null) setMembersCount(count);

      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id);
        const { data: profiles, error: profilesErr } = await supabase
          .from('profiles')
          .select('avatar_url')
          .in('id', userIds);
        
        if (!profilesErr && profiles) {
          setMemberAvatars(profiles.map(p => p.avatar_url).filter(Boolean));
        }
      }
    } catch (err) {
      console.error("Error fetching members:", err);
    }
  };

  const checkMembership = async () => {
    if (!appUser?.id) return;
    const { data, error } = await supabase
      .from('group_members')
      .select('status, role')
      .eq('group_id', group.id)
      .eq('user_id', appUser.id)
      .single();
    
    if (data) {
      setMembershipStatus(data.status as any);
      setIsAdmin(data.role === 'owner' || data.role === 'admin');
    } else {
      setMembershipStatus('none');
      setIsAdmin(false);
    }
  };

  const fetchAllGroupMembers = async () => {
    if (!isAdmin) return;
    try {
      const { data: members, error } = await supabase
        .from('group_members')
        .select('user_id, role, status')
        .eq('group_id', group.id);
      
      if (error) throw error;
      
      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', userIds);
        
        if (profiles) {
          const profileMap = new Map(profiles.map(p => [p.id, p]));
          const enriched = members.map(m => ({
            ...m,
            profiles: profileMap.get(m.user_id)
          }));
          setAllMembers(enriched);
        }
      }
    } catch (e) {
      console.error("Error fetching all members:", e);
    }
  };

  useEffect(() => {
    if (showManageMembers) fetchAllGroupMembers();
  }, [showManageMembers]);

  const handleJoin = async () => {
    if (!appUser?.id) return;
    setIsJoining(true);
    try {
      const isPriv = group.is_private === true;
      const status = isPriv ? 'pending' : 'accepted';
      
      const { error } = await supabase.from('group_members').insert([{
        group_id: group.id,
        user_id: appUser.id,
        role: 'member',
        status: status
      }]);

      if (error) throw error;
      
      if (isPriv) {
        addToast('تم إرسال طلب الانضمام للمالك ⏳');
        // Notify owner
        await supabase.from('notifications').insert([{
          user_id: group.created_by,
          type: 'group_request',
          from_id: appUser.id,
          from_name: appUser.name,
          from_avatar: appUser.avatar,
          target_id: group.id,
          read: false
        }]);
      } else {
        addToast('تم الانضمام للمجموعة بنجاح ✅');
        // Notify owner about new member
        await supabase.from('notifications').insert([{
          user_id: group.created_by,
          type: 'group_join',
          from_id: appUser.id,
          from_name: appUser.name,
          from_avatar: appUser.avatar,
          target_id: group.id,
          read: false
        }]);
      }
      checkMembership();
    } catch (e) {
      addToast('خطأ في الانضمام', 'error');
    } finally {
      setIsJoining(false);
    }
  };

  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  const handleGroupAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !group.id) return;
    
    setIsUpdatingAvatar(true);
    addToast('جاري رفع صورة المجموعة... ⏳');
    
    try {
      const url = await imageService.processAndUpload(file, group.id, 'profiles');
      const { error } = await groupService.updateGroup(group.id, { avatar_url: url });
      
      if (error) throw error;
      
      addToast('تم تحديث صورة المجموعة بنجاح ✨');
      // Update local group state
      group.avatar_url = url; 
    } catch (err: any) {
      console.error('Group avatar upload failed:', err);
      addToast(`فشل تحديث الصورة: ${err.message}`, 'error');
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      if (file.type.startsWith('video/')) {
        setPendingPreview('video:' + file.name);
      } else {
        const reader = new FileReader();
        reader.onloadend = () => setPendingPreview(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const cancelPendingFile = () => {
    setPendingFile(null);
    setPendingPreview(null);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && !pendingFile) return;
    if (isSending) return;

    setIsSending(true);
    const text = newMessage;
    const file = pendingFile;
    
    // Clear UI immediately for fast feel
    setNewMessage('');
    cancelPendingFile();
    setShowEmojis(false);

    try {
      let attachmentUrl = '';

      if (file) {
        const isVideo = file.type.startsWith('video/');
        if (isVideo) {
          attachmentUrl = await imageService.uploadVideo(file, appUser.id) || '';
        } else {
          attachmentUrl = await imageService.processAndUpload(file, appUser.id, 'images');
        }
      }

      const tempId = 'temp-' + Date.now();
      const optimisticMsg = {
        id: tempId,
        group_id: group.id,
        author_id: appUser.id,
        author_name: appUser.name,
        author_avatar: appUser.avatar,
        content: text,
        image_url: attachmentUrl,
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, optimisticMsg]);

      const { error } = await groupService.sendGroupMessage(
        group.id, 
        appUser.id,
        text,
        attachmentUrl
      );

      if (error) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        console.error("DEBUG: sendMessage error:", error);
        addToast(`خطأ في الحفظ: ${error.message}`, 'error');
        throw error;
      }
      
      // We don't call fetchMessages() here manually anymore 
      // because the real-time listener will handle it, 
      // and our fetchMessages now preserves optimistic state.
    } catch (e: any) {
      console.error("DEBUG: sendMessage exception:", e);
      if (!e.message?.includes('خطأ في الحفظ')) {
        addToast('فشل إرسال الرسالة، تأكد من اتصالك بالقاعدة', 'error');
      }
      setNewMessage(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !editContent.trim()) return;
    try {
      const { error } = await groupService.editMessage(editingMessage.id, editContent);
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, content: editContent, is_edited: true } : m));
      setEditingMessage(null);
      addToast('تم تعديل الرسالة');
    } catch (e) {
      addToast('فشل التعديل', 'error');
    }
  };

  const handleDeleteMessage = async (postId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) return;
    try {
      const { error } = await groupService.deleteMessage(postId);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== postId));
      addToast('تم حذف الرسالة');
    } catch (e) {
      addToast('فشل الحذف', 'error');
    }
  };

  const handleUpdateMember = async (userId: string, status: any) => {
    try {
      const { error } = await groupService.updateMemberStatus(group.id, userId, status);
      if (error) throw error;
      fetchAllGroupMembers();
      addToast('تم تحديث حالة العضو');
    } catch (e) {
      addToast('فشل التحديث', 'error');
    }
  };

  const handleKickMember = async (userId: string) => {
    if (!window.confirm('هل أنت متأكد من إخراج هذا العضو؟')) return;
    try {
      const { error } = await groupService.removeMember(group.id, userId);
      if (error) throw error;
      fetchAllGroupMembers();
      addToast('تم إخراج العضو');
    } catch (e) {
      addToast('فشل الإجراء', 'error');
    }
  };

  const renderMessageContent = (msg: any) => {
    if (msg.image_url) {
      const isVideo = msg.image_url.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/) || msg.image_url.includes('video-');
      if (isVideo) {
        return (
          <div className="space-y-2">
            <video src={msg.image_url} controls className="max-w-full rounded-xl shadow-sm" />
            {msg.content && <p className="text-inherit">{msg.content}</p>}
          </div>
        );
      }
      return (
        <div className="space-y-2">
          <img src={msg.image_url} className="max-w-full rounded-xl shadow-sm" alt="" />
          {msg.content && <p className="text-inherit">{msg.content}</p>}
        </div>
      );
    }
    return <p className="whitespace-pre-wrap text-inherit">{msg.content}</p>;
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] relative overflow-hidden" dir="rtl">
      {/* Telegram Style Header */}
      <div className="shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center gap-3 z-50 shadow-sm">
        <button onClick={onBack} className="md:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-all">
          <ArrowRight size={22} />
        </button>
        <div className="relative shrink-0">
          {group.avatar_url ? (
            <img src={group.avatar_url} className="w-10 h-10 rounded-full object-cover border border-slate-100 shadow-sm" alt="" />
          ) : (
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black text-lg shadow-sm">
              {group.name[0]}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-sm text-slate-800 truncate">{group.name}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex -space-x-2 space-x-reverse overflow-hidden">
              {memberAvatars.map((url, i) => (
                <img key={i} src={url} className="inline-block h-4 w-4 rounded-full ring-2 ring-white object-cover" alt="" />
              ))}
              {membersCount > 5 && (
                <div className="inline-block h-4 w-4 rounded-full bg-slate-100 ring-2 ring-white flex items-center justify-center text-[6px] font-black text-slate-400">
                  +{membersCount - 5}
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-bold">{membersCount} عضو</p>
          </div>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl transition-all ${showSettings ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <MoreHorizontal size={20} />
          </button>
          
          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute left-0 mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-[60] overflow-hidden"
              >
                {group.owner_id === appUser.id && (
                  <button 
                    onClick={() => groupAvatarInputRef.current?.click()}
                    disabled={isUpdatingAvatar}
                    className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all border-b border-slate-50"
                  >
                    <ImageIcon size={16} className="text-indigo-500" />
                    {isUpdatingAvatar ? 'جاري الرفع...' : 'تغيير صورة المجموعة'}
                  </button>
                )}

                <button 
                  onClick={() => { setShowManageMembers(true); setShowSettings(false); }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all"
                >
                  <Users size={16} className="text-indigo-500" /> أعضاء المجموعة
                </button>
                {isAdmin && (
                  <button className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all">
                    <Shield size={16} className="text-blue-500" /> إعدادات المجموعة
                  </button>
                )}
                <button className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all">
                  <Bell size={16} className="text-amber-500" /> كتم الإشعارات
                </button>
                <div className="h-px bg-slate-50 my-1 mx-4" />
                <button className="w-full px-4 py-2.5 flex items-center gap-3 text-xs font-black text-red-600 hover:bg-red-50 transition-all">
                  <Trash2 size={16} /> مغادرة المجموعة
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-chat-scroll relative z-10" style={{ minHeight: '300px' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30">
            <Users size={64} className="mb-4" />
            <p className="font-black text-sm">لا توجد رسائل بعد.. ابدأ الدردشة!</p>
          </div>
        ) : messages.map((m, idx) => {
          console.log(`DEBUG: [GroupDetailView] Rendering message index ${idx}, id: ${m.id}`);
          const isMine = m.author_id === appUser.id;
          const showAvatar = idx === 0 || messages[idx-1].author_id !== m.author_id;
          
          return (
            <div key={m.id || `msg-${idx}`} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
              {!isMine && (
                <div className="w-8 h-8 shrink-0">
                  {showAvatar && (
                    <img 
                      src={authorsMap[m.author_id]?.avatar_url || m.author_avatar || `https://ui-avatars.com/api/?name=${authorsMap[m.author_id]?.name || m.author_name || 'User'}`} 
                      className="w-full h-full rounded-full border border-white shadow-sm" 
                      alt="" 
                    />
                  )}
                </div>
              )}
              <div className={`max-w-[85%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                {showAvatar && !isMine && (
                  <span className="text-[9px] font-black text-indigo-600 mb-1 mr-1">
                    {authorsMap[m.author_id]?.name || m.author_name || 'مستخدم'}
                  </span>
                )}
                <div className={`px-4 py-2 text-sm relative group/msg shadow-sm ${isMine 
                  ? 'bg-blue-600 text-white rounded-2xl rounded-bl-sm shadow-blue-100/50' 
                  : 'bg-white text-slate-800 border border-slate-100 rounded-2xl rounded-br-sm shadow-slate-100/50'}`}>
                  
                  {editingMessage?.id === m.id ? (
                    <div className="min-w-[150px] space-y-2 py-1">
                      <textarea 
                        className="w-full bg-indigo-700/50 text-white border-none rounded-lg p-2 text-xs focus:ring-1 focus:ring-white/30 outline-none"
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingMessage(null)} className="px-2 py-1 text-[10px] font-black hover:bg-white/10 rounded">إلغاء</button>
                        <button onClick={handleEditMessage} className="px-3 py-1 bg-white text-indigo-600 text-[10px] font-black rounded shadow-sm">حفظ</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {renderMessageContent(m)}
                      {m.is_edited && <span className="text-[7px] opacity-50 mr-1">(معدل)</span>}
                      
                      {/* Action Menu (Hidden by default, shown on hover) */}
                      <div className={`absolute top-0 ${isMine ? 'right-full mr-2' : 'left-full ml-2'} opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 bg-white border border-slate-100 p-1 rounded-lg shadow-xl z-10`}>
                        {isMine && (
                          <button onClick={() => { setEditingMessage(m); setEditContent(m.content); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-md transition-all">
                            <Edit2 size={12} />
                          </button>
                        )}
                        {(isMine || isAdmin) && (
                          <button onClick={() => handleDeleteMessage(m.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <span className="text-[8px] text-slate-400 font-bold mt-1 px-1">
                  {new Date(m.created_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        
        {(membershipStatus === 'none' || membershipStatus === 'pending' || membershipStatus === 'suspended') && (
          <div className="absolute inset-x-0 bottom-0 top-[64px] bg-white/60 backdrop-blur-md z-[40] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-100 text-center max-w-sm"
            >
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${membershipStatus === 'suspended' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                {membershipStatus === 'suspended' ? <ShieldAlert size={40} /> : <Users size={40} />}
              </div>
              <h4 className="text-lg font-black text-slate-800 mb-2">
                {membershipStatus === 'pending' ? 'بانتظار الموافقة' : membershipStatus === 'suspended' ? 'حسابك معلق' : 'انضم للمجموعة'}
              </h4>
              <p className="text-xs text-slate-400 font-bold mb-8 leading-relaxed">
                {membershipStatus === 'pending' 
                  ? 'لقد تم إرسال طلبك لمالك المجموعة، سيتم إخطارك بمجرد قبول الطلب' 
                  : membershipStatus === 'suspended'
                    ? 'لقد تم تعليق عضويتك في هذه المجموعة من قبل الإدارة'
                    : group.is_private 
                      ? 'هذه المجموعة خاصة، يجب أن يوافق المالك على طلب انضمامك'
                      : 'هذه مجموعة عامة، يمكنك الانضمام الآن والمشاركة في الحوار'}
              </p>
              {membershipStatus === 'none' && (
                <button 
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isJoining ? <Loader2 size={20} className="animate-spin" /> : group.is_private ? 'إرسال طلب انضمام' : 'انضم للمجموعة الآن'}
                </button>
              )}
            </motion.div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Hidden file input for group avatar */}
      <input 
        type="file"
        ref={groupAvatarInputRef}
        onChange={handleGroupAvatarChange}
        className="hidden"
        accept="image/*"
      />

      {/* Input Area */}
      <div className={`shrink-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-100 z-10 space-y-2 ${(membershipStatus === 'none' || membershipStatus === 'pending' || membershipStatus === 'suspended') ? 'opacity-20 pointer-events-none' : ''}`}>
        <div className="max-w-4xl mx-auto space-y-2">
          
          {/* Emoji Panel */}
          <AnimatePresence>
            {showEmojis && (
              <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex gap-2 flex-wrap no-scrollbar overflow-x-auto max-h-28">
                {emojis.map(e => <button key={e} onClick={() => setNewMessage(p => p + e)} className="text-xl hover:scale-125 transition-transform">{e}</button>)}
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
                <p className="flex-1 text-[10px] text-slate-400 font-bold uppercase">
                  {pendingFile ? (pendingFile.size > 1024*1024 ? `${(pendingFile.size/1024/1024).toFixed(1)} MB` : `${(pendingFile.size/1024).toFixed(0)} KB`) : ''}
                </p>
                <button onClick={cancelPendingFile} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors shrink-0">
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-1.5 focus-within:bg-white focus-within:border-blue-300 border border-transparent transition-all">
            <input type="file" ref={mediaInputRef} className="hidden" accept="image/*,video/*" onChange={handleAttachment} />
            <button onClick={() => mediaInputRef.current?.click()} className={`p-2 rounded-xl transition-all shrink-0 ${pendingFile ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600'}`}>
              <ImageIcon size={18} />
            </button>
            <button onClick={() => setShowEmojis(!showEmojis)} className={`p-2 rounded-xl transition-all shrink-0 ${showEmojis ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}>
              <Smile size={18} />
            </button>
            <textarea 
              className="flex-1 bg-white border-none outline-none text-sm font-bold text-slate-900 placeholder:text-slate-400 px-2 py-1.5 resize-none min-h-[36px] max-h-32 no-scrollbar leading-relaxed rounded-xl"
              placeholder={pendingFile ? "أضف وصفاً للمرفق... (اختياري)" : "اكتب رسالة للمجموعة..."}
              rows={1}
              value={newMessage}
              onChange={e => {
                setNewMessage(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <motion.button 
              whileTap={{ scale: 0.9 }} 
              onClick={sendMessage} 
              disabled={isSending || (!newMessage.trim() && !pendingFile)}
              className={`p-2.5 rounded-xl transition-all shrink-0 ${ (newMessage.trim() || pendingFile) ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            >
              {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="rotate-180" />}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showManageMembers && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowManageMembers(false)} 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <Users size={20} className="text-indigo-600" /> أعضاء المجموعة
                </h3>
                <button onClick={() => setShowManageMembers(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {allMembers.map((m: any) => (
                  <div key={m.user_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100/50">
                    <img src={m.profiles?.avatar_url || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-xl object-cover border border-white" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{m.profiles?.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        {m.role === 'owner' ? 'المالك' : 'عضو'} • {m.status === 'accepted' ? 'نشط' : m.status === 'suspended' ? 'معلق' : 'بانتظار الموافقة'}
                      </p>
                    </div>
                    
                    {isAdmin && m.user_id !== appUser.id && (
                      <div className="flex items-center gap-1">
                        {m.status === 'accepted' ? (
                          <button onClick={() => handleUpdateMember(m.user_id, 'suspended')} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="تعليق">
                            <ShieldAlert size={16} />
                          </button>
                        ) : (
                          <button onClick={() => handleUpdateMember(m.user_id, 'accepted')} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all" title="تفعيل">
                            <UserPlus size={16} />
                          </button>
                        )}
                        <button onClick={() => handleKickMember(m.user_id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all" title="طرد">
                          <UserMinus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
