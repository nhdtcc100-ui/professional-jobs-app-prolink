import fs from 'fs';

const file = 'src/components/features/MessagingView.tsx';
let content = fs.readFileSync(file, 'utf8');
let lines = content.split('\n');

const missingCode = `  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [searchFilter, setSearchFilter] = useState<'all' | 'people' | 'jobs' | 'groups'>('all');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerData, setOfferData] = useState({ title: '', salary: '' });
  const [canSendOffer, setCanSendOffer] = useState(false);
  const emojis = ['👍','❤️','🔥','😂','💯','🚀','💼','🤝','✅','✨','🎯','💡','👏','🙌','🤔','😎','🙏','🎉','💻','📊','📈','🏆'];
  
  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (currentUser?.role !== 'employer' || !selectedChat) {
        setCanSendOffer(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('job_applications')
          .select('id, status, job_id')
          .eq('applicant_id', selectedChat.id)
          .eq('status', 'approved')
          .limit(1);
        
        if (!error && data && data.length > 0) {
           setCanSendOffer(true);
        } else {
           setCanSendOffer(false);
        }
      } catch (e) {
        console.error('Error checking approval status', e);
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
        timestamp: lastMsg?.timestamp || 0,
        time: lastMsg ? formatTime(lastMsg.timestamp) : '',
        lastMessage: lastMsg ? lastMsg.content.replace(/\\[MEDIA:[^\\]]+\\][^\\n]*/, '📎 مرفق') : ''
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
    const msgText = content.trim();
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
        const mediaContent = msgText ? \`\${prefix}\${finalUrl}\\n\${msgText}\` : \`\${prefix}\${finalUrl}\`;

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
    if (!window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) return;
    try {
      const { error } = await supabase.from('messages').delete().eq('id', msgId);
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
      const newlineIdx = rest.indexOf('\\n');
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
          <pre className="whitespace-pre-wrap text-[10px] opacity-90 font-medium mb-2 leading-relaxed">{parts[0].replace('📄 **طلب تقديم وظيفة (برو لينك)**\\n━━━━━━━━━━━━━━━━━━━━━━\\n', '')}</pre>
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
                  <img src={avatar || \`https://ui-avatars.com/api/?name=\${company}&background=random\`} className="w-full h-full object-cover" alt="" />
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

  const ContactItem = ({ u, horizontal = false }: { u: AppUser, horizontal?: boolean, key?: any }) => {
    const isSelected = selectedChat?.id === u.id;
    const lastMsg = getLastMessage(u.id);
    const unread = getUnreadCount(u.id, 'chat');
    if (horizontal) {
      return (
        <div onClick={() => onSelectChat(u)} className={\`flex flex-col items-center gap-1 cursor-pointer px-2 py-1 rounded-xl transition-all shrink-0 \${isSelected ? 'bg-blue-100' : 'hover:bg-slate-100'}\`}>
          <div className="relative">
            <img src={u.avatar || \`https://ui-avatars.com/api/?name=\${u.name}&background=random\`} className="w-10 h-10 rounded-xl border-2 border-white shadow" alt="" />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
            {unread > 0 && !isSelected && <div className="absolute -top-1 -left-1 bg-red-500 text-white text-[8px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">{unread}</div>}
          </div>
          <p className={\`text-[9px] font-black truncate max-w-[56px] \${isSelected ? 'text-blue-700' : 'text-slate-600'}\`}>{u.name}</p>
        </div>
      );
    }
    return (
      <div onClick={() => onSelectChat(u)} className={\`p-3 flex items-center gap-3 cursor-pointer transition-all border-b border-slate-50 \${isSelected ? 'bg-blue-50 border-r-4 border-r-blue-600' : 'hover:bg-slate-50'}\`}>
        <div className="relative shrink-0">
          <img src={u.avatar || \`https://ui-avatars.com/api/?name=\${u.name}&background=random\`} className="w-11 h-11 rounded-2xl border border-slate-100 shadow-sm" alt="" />
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-0.5">
            <h5 className={\`font-black text-xs truncate \${isSelected ? 'text-blue-700' : 'text-slate-800'}\`}>{u.name}</h5>
            {lastMsg && <span className="text-[9px] text-slate-400 font-bold shrink-0">{formatTime(lastMsg.timestamp)}</span>}
          </div>
          <p className="text-[10px] text-slate-400 truncate">{lastMsg ? lastMsg.content.replace(/\\[MEDIA:[^\\]]+\\][^\\n]*/, '📎 مرفق').replace('📄 **طلب تقديم وظيفة (برو لينك)**', '📄 طلب توظيف').replace(/\\[JOB_CARD:[^\\]]+\\]/, '💼 وظيفة مشتركة') : 'ابدأ محادثة...'}</p>
        </div>
        {unread > 0 && !isSelected && <div className="bg-blue-600 text-white text-[9px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 shrink-0">{unread}</div>}
      </div>
    );
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

  const handleSendOffer = async () => {
    if (!offerData.title || !selectedChat || !currentUser) return;
    
    const offerContent = \`[OFFER_CARD:\${offerData.title}|\${offerData.salary || 'يُحدد لاحقاً'}]\`;
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

  return (
    <div className="flex flex-col md:flex-row md:rounded-t-[3rem] overflow-hidden shadow-2xl border-x border-t border-white/80 bg-white fixed md:relative top-[85px] bottom-[105px] left-3 right-3 md:top-0 md:bottom-0 md:left-0 md:right-0 md:h-[calc(100vh-75px)] md:mt-0 md:mx-auto anti-gravity-card rounded-[2.5rem] md:rounded-none" dir="rtl">

      <style>{\`
        .chat-pattern { background-image: radial-gradient(#0a66c2 0.5px, transparent 0.5px); background-size: 24px 24px; opacity: 0.025; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-chat-scroll::-webkit-scrollbar { width: 4px; }
        .custom-chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-chat-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      \`}</style>

      {/* ===== Sidebar (Chat List) ===== */}
      <div className={\`w-full md:w-80 flex flex-col bg-slate-50 border-l border-slate-100 z-30 \${ (selectedChat || selectedGroup) ? 'hidden md:flex' : 'flex'}\`}>
        <div className="p-4 bg-white border-b border-slate-50 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setShowSidebarMenu(!showSidebarMenu)}
                className={\`p-2.5 rounded-2xl transition-all \${showSidebarMenu ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}\`}
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

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'people', label: 'أشخاص' },
              { id: 'groups', label: 'مجموعات' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setSearchFilter(filter.id as any)}
                className={\`px-4 py-1.5 rounded-full text-[10px] font-black whitespace-nowrap transition-all \${searchFilter === filter.id ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}\`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar py-2 relative">
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
                className={\`mx-2 mb-1 p-3 flex items-center gap-3 cursor-pointer rounded-2xl transition-all \${isSelected ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'hover:bg-white'}\`}
              >
                  <div className={\`w-12 h-12 rounded-full overflow-hidden border border-slate-100 shadow-sm\`}>
                    {conv.avatar ? (
                      <img src={conv.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className={\`w-full h-full flex items-center justify-center text-white font-black text-lg \${conv.type === 'group' ? 'bg-indigo-500' : 'bg-blue-500'}\`}>
                        {conv.name[0]}
                      </div>
                    )}
                  </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h4 className={\`text-sm font-bold truncate \${isSelected ? 'text-white' : 'text-slate-800'}\`}>{conv.name}</h4>
                    <span className={\`text-[10px] \${isSelected ? 'text-blue-100' : 'text-slate-400'}\`}>{conv.time}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className={\`text-[11px] truncate max-w-[180px] \${isSelected ? 'text-blue-500' : 'text-slate-500'}\`}>{conv.lastMessage || (conv.type === 'group' ? 'مجموعة مهنية' : 'ابدأ المحادثة...')}</p>
                    {unread > 0 && (
                      <span className={\`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold \${isSelected ? 'bg-white text-blue-600' : 'bg-blue-600 text-white shadow-sm'}\`}>
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

      {/* ===== Chat Area ===== */}
      <div className={\`flex-1 flex flex-col bg-white overflow-hidden relative min-h-0 \${(!selectedChat && !selectedGroup) ? 'hidden md:flex' : 'flex'}\`}>

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
            <div className="p-3 px-4 bg-white/80 backdrop-blur-md border-b border-slate-50 flex items-center gap-3 z-20 shrink-0">
              <button onClick={() => onSelectChat(null as any)} className="md:hidden p-2 -ml-1 text-slate-400 hover:text-blue-600 transition-colors">
                <ArrowRight size={22} />
              </button>
              
              <div className="flex flex-1 items-center gap-3 cursor-pointer" onClick={() => selectedChat && setSelectedProfile(selectedChat)}>
                <div className="relative">
                  <img src={selectedChat.avatar || \`https://ui-avatars.com/api/?name=\${selectedChat.name}&background=random\`} className="w-10 h-10 rounded-full border border-slate-100 shadow-sm object-cover" alt="" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-slate-800 text-sm leading-tight">{selectedChat.name}</h4>
                  <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    متصل الآن
                  </p>
                </div>
              </div>

              <div className="relative flex items-center">
                {currentUser?.role === 'employer' && canSendOffer && (
                  <button 
                    onClick={() => setShowOfferModal(true)}
                    className="p-2 md:px-4 bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-xl shadow-lg shadow-amber-200 transition-all font-black text-[10px] md:text-xs flex items-center gap-1.5 ml-2 border border-amber-300"
                  >
                    <Briefcase size={14} className="md:inline hidden" /> عرض سريع ⚡
                  </button>
                )}
                <button 
                  onClick={() => setShowSettings(!showSettings)}`;

// We need to inject `missingCode` into the file right after `  const [groupCategory, setGroupCategory] = useState('عام');`
// But wait, the file currently has:
//   const [groupCategory, setGroupCategory] = useState('عام');
//   const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
//                 <button 
//                   onClick={() => setShowSettings(!showSettings)}

const idx1 = lines.findIndex(l => l.includes("const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);"));
if (idx1 !== -1) {
    const idx2 = lines.findIndex((l, i) => i > idx1 && l.includes("onClick={() => setShowSettings(!showSettings)}"));
    if (idx2 !== -1) {
        // We need to keep up to idx1, insert missingCode, then keep from the button part
        // Wait, missingCode already includes `onClick={() => setShowSettings(!showSettings)}` at the very end
        // Let's just find where to replace.
        const before = content.substring(0, content.indexOf("const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);") + "const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);".length);
        const after = content.substring(content.indexOf("                  className={`p-2 rounded-xl transition-all ${showSettings ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}"));
        
        fs.writeFileSync(file, before + '\n' + missingCode + '\n' + after);
    }
}
