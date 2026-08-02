import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  UserCheck, 
  Search, 
  MessageCircle,
  MoreHorizontal, 
  Zap,
  Sparkles,
  Clock
} from 'lucide-react';
import { GlassCard } from '../ui';
import { AppUser, AppConnection } from '../../types';

interface NetworkViewProps {
  users: AppUser[];
  connections: AppConnection[];
  onUserClick: (u: AppUser) => void;
  onSyncSignal: (u: AppUser) => void;
  onMessageClick?: (id: string) => void;
  currentId: string;
}

type NetworkTab = 'discover' | 'connections' | 'requests' | 'radar';

export function NetworkView({ users, connections, onUserClick, onSyncSignal, onMessageClick, currentId }: NetworkViewProps) {
  const [activeTab, setActiveTab] = useState<NetworkTab>('discover');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Logic ---
  const myConnections = useMemo(() => connections.filter(c => c.status === 'accepted'), [connections]);
  const pendingRequests = useMemo(() => connections.filter(c => c.status === 'pending' && c.recipientId === currentId), [connections, currentId]);

  const getStatus = (targetId: string) => {
    const conn = connections.find(c =>
      (c.requesterId === currentId && c.recipientId === targetId) ||
      (c.requesterId === targetId && c.recipientId === currentId)
    );
    return conn ? conn.status : null;
  };

  const getIsOutgoing = (targetId: string) => {
    return connections.some(c => c.requesterId === currentId && c.recipientId === targetId && c.status === 'pending');
  };

  const filteredUsers = useMemo(() => {
    let list = users.filter(u => u.id !== currentId);
    if (activeTab === 'connections') list = list.filter(u => getStatus(u.id) === 'accepted');
    else if (activeTab === 'requests') list = list.filter(u => getStatus(u.id) === 'pending' && !getIsOutgoing(u.id));
    else list = list.filter(u => getStatus(u.id) !== 'accepted');

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.companyName?.toLowerCase().includes(q));
    }
    return list;
  }, [users, activeTab, searchQuery, connections, currentId]);

  return (
    <div className="max-w-4xl mx-auto px-4 space-y-6 pb-32 pt-0 md:pt-4" dir="rtl">
      
      {/* ── Structured Control Bar (Sticky) ── */}
      <div className="sticky top-16 z-[40] -mx-4 px-4 pb-3 pt-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-2xl border-b border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.02)] transition-all duration-300">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Row 1: Professional Tab Switcher */}
          <div className="flex justify-center">
            <div className="flex items-center p-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-xl w-full">
              {[
                { id: 'discover', label: 'اكتشاف', icon: Users },
                { id: 'radar', label: 'الرادار', icon: Sparkles },
                { id: 'connections', label: 'شبكتي', icon: UserCheck },
                { id: 'requests', label: 'الطلبات', icon: Zap, count: pendingRequests.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as NetworkTab)}
                  className={`relative flex-1 flex items-center justify-center gap-1 md:gap-2 py-2.5 md:py-3 rounded-xl transition-all duration-500 group ${
                    activeTab === tab.id 
                      ? 'text-white' 
                      : 'text-slate-900 dark:text-slate-500 hover:text-blue-600 dark:hover:text-white'
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="network_tab_active"
                      className="absolute inset-0 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20"
                    />
                  )}
                  <tab.icon size={13} className={`relative z-10 ${activeTab === tab.id ? 'animate-pulse' : 'group-hover:rotate-12 transition-transform'}`} />
                  <span className="relative z-10 text-[9px] md:text-[11px] font-black tracking-tighter md:tracking-tight">{tab.label}</span>
                  {tab.count ? (
                    <span className={`relative z-10 px-1.5 py-0.5 rounded-md text-[8px] font-black ${
                      activeTab === tab.id ? 'bg-white/20' : 'bg-red-500 text-white shadow-sm'
                    }`}>
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Networking Radar View ── */}
      {activeTab === 'radar' && (
        <NetworkingRadar users={users.filter(u => u.id !== currentId)} onUserClick={onUserClick} />
      )}

      {/* ── Large 2-Column Grid ── */}
      {activeTab !== 'radar' && (
      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        <AnimatePresence mode="popLayout">
          {filteredUsers.map((u, idx) => {
            const status = getStatus(u.id);
            const userIsOnline = u.last_seen_at && (new Date().getTime() - new Date(u.last_seen_at).getTime()) < 180000;

            return (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: idx * 0.03 }}
                className="h-full"
              >
                <div
                  onClick={() => onUserClick(u)}
                  className="group relative flex flex-col bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden h-full cursor-pointer"
                >
                  {/* Cover Section */}
                  <div className="h-20 w-full relative overflow-hidden bg-slate-200 dark:bg-slate-700">
                    <img 
                      src={u.coverUrl || `https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=400`} 
                      className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700"
                      alt=""
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-800 to-transparent" />
                  </div>

                  {/* Profile Info */}
                  <div className="px-4 pb-5 flex flex-col items-center text-center -mt-10 relative">
                    <div className="relative mb-3">
                      <div className="w-20 h-20 rounded-2xl p-1 bg-white dark:bg-slate-800 shadow-xl border border-slate-50 dark:border-slate-700 overflow-hidden">
                        <img 
                          src={u.avatar} 
                          className="w-full h-full object-cover rounded-xl" 
                          alt="" 
                          onError={(e: any) => e.target.src = 'https://i.pravatar.cc/150?u=' + u.id}
                        />
                      </div>
                      {userIsOnline && (
                        <span className="absolute bottom-1 left-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full shadow-lg animate-pulse" />
                      )}
                      {u.isPro && (
                        <div className="absolute -top-2 -right-2 p-1.5 bg-amber-400 text-white rounded-lg shadow-lg rotate-12">
                          <Sparkles size={10} />
                        </div>
                      )}
                    </div>

                    <h4 className="font-black text-slate-800 dark:text-white text-sm line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {u.name}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight line-clamp-1 mb-4">
                      {u.role === 'employer' ? (u.companyName || 'مدير توظيف') : 'باحث مهني'}
                    </p>

                    {/* Compact Actions */}
                    <div className="w-full space-y-2 mt-auto pt-2 border-t border-slate-50 dark:border-slate-700/50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!status) onSyncSignal(u);
                        }}
                        disabled={!!status && status !== 'pending'}
                        className={`w-full py-2.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 transition-all ${
                          status === 'accepted' 
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                            : status === 'pending'
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                              : 'bg-slate-900 dark:bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-slate-100 dark:shadow-none'
                        }`}
                      >
                        {status === 'accepted' ? <UserCheck size={12} /> : 
                         status === 'pending' ? <Clock size={12} /> : 
                         <UserPlus size={12} />}
                        <span>{status === 'accepted' ? 'متصل بك' : status === 'pending' ? 'بانتظار الرد' : 'طلب مزامنة'}</span>
                      </button>

                      {status === 'accepted' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onMessageClick) onMessageClick(u.id);
                          }}
                          className="w-full py-2 bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          <MessageCircle size={12} /> مراسلة
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      )}

      {/* ── Professional Empty State ── */}
      {activeTab !== 'radar' && filteredUsers.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-32 text-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800"
        >
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
             <Users size={24} className="text-slate-300" />
          </div>
          <h3 className="text-slate-800 dark:text-white font-black text-lg">لا يوجد أعضاء متاحون</h3>
          <p className="text-slate-400 font-bold text-sm mt-1">حاول تعديل معايير البحث أو استكشف الرادار</p>
        </motion.div>
      )}
    </div>
  );
}

// ── Networking Radar Component ────────────────────────────────────────────────────────
function NetworkingRadar({ users, onUserClick }: { users: AppUser[], onUserClick: (u: AppUser) => void }) {
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  // Take up to 8 random users to avoid clutter
  const radarUsers = useMemo(() => {
    return [...users].sort(() => 0.5 - Math.random()).slice(0, 8).map(u => {
      // Assign random position (angle and radius)
      const angle = Math.random() * Math.PI * 2;
      const radius = 30 + Math.random() * 45; // 30% to 75% from center
      return { ...u, angle, radius };
    });
  }, [users]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-full aspect-square md:aspect-video max-h-[60vh] bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center mt-4"
      dir="ltr"
    >
      {/* Radar Circles */}
      {[1, 2, 3].map(i => (
        <div key={i} className="absolute rounded-full border border-blue-500/20" style={{ width: `${i * 33}%`, height: `${i * 33}%` }} />
      ))}
      
      {/* Center Node (Me) */}
      <div className="absolute w-4 h-4 bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.8)] z-10" />
      <div className="absolute w-12 h-12 bg-blue-500/20 rounded-full animate-ping z-0" />

      {/* Sweeping Radar Line */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="absolute w-1/2 h-1/2 origin-bottom-right bottom-1/2 right-1/2 z-0"
        style={{
          background: 'conic-gradient(from 180deg at 100% 100%, transparent 0deg, transparent 80deg, rgba(59, 130, 246, 0.4) 90deg)',
          borderRight: '1px solid rgba(59,130,246,0.5)'
        }}
      />

      {/* Users */}
      {radarUsers.map((u, i) => {
        const x = `calc(50% + ${u.radius * Math.cos(u.angle)}%)`;
        const y = `calc(50% + ${u.radius * Math.sin(u.angle)}%)`;
        
        return (
          <motion.div
            key={u.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.2 }}
            style={{ left: x, top: y }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
            onClick={() => setSelectedUser(u)}
          >
            <div className="relative">
              <motion.div whileHover={{ scale: 1.2 }} className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-slate-700 overflow-hidden shadow-lg group-hover:border-blue-400 transition-colors">
                <img src={u.avatar} className="w-full h-full object-cover" alt="avatar" onError={(e: any) => e.target.src = 'https://i.pravatar.cc/150'} />
              </motion.div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-slate-800/90 backdrop-blur-sm text-white text-[9px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {u.name}
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* Coffee Invite Modal Overlay */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-30 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-xs text-center relative"
              dir="rtl"
            >
              <button onClick={() => setSelectedUser(null)} className="absolute top-4 left-4 p-1.5 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100">
                 <MoreHorizontal size={14} />
              </button>
              
              <img src={selectedUser.avatar} className="w-20 h-20 rounded-full mx-auto border-4 border-white shadow-lg -mt-12 bg-slate-100" />
              <h3 className="text-lg font-black text-slate-800 mt-3">{selectedUser.name}</h3>
              <p className="text-xs text-slate-500 font-bold mb-4">{selectedUser.title || 'محترف'}</p>
              
              <div className="flex gap-2">
                 <button onClick={() => { onUserClick(selectedUser); setSelectedUser(null); }} className="flex-1 py-3 bg-slate-50 text-slate-600 rounded-2xl text-xs font-black hover:bg-slate-100 transition-colors">
                   فتح الملف
                 </button>
                 <button onClick={() => { alert('تم إرسال دعوة القهوة! ☕'); setSelectedUser(null); }} className="flex-1 py-3 bg-[#0a66c2] text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors">
                   دعوة لقهوة ☕
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
