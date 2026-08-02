import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, 
  Video, Calendar, Clock, Trash2, Search, MoreVertical,
  MessageSquare, User
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AppUser } from '../../types';
import { GlassCard } from '../ui';

interface CallLog {
  id: string;
  caller_id: string;
  receiver_id: string;
  type: 'voice' | 'video';
  status: 'active' | 'ended' | 'ringing';
  created_at: string;
  started_at?: string;
  ended_at?: string;
  // Join data
  caller?: any;
  receiver?: any;
}

interface CallsViewProps {
  appUser: AppUser | null;
  allUsers: AppUser[];
  onStartCall: (targetUser: AppUser, mode: 'voice' | 'video') => void;
  onSelectChat: (targetUser: AppUser) => void;
}

export function CallsView({ appUser, allUsers, onStartCall, onSelectChat }: CallsViewProps) {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCallHistory = async (isInitial = true) => {
    if (!appUser?.id) return;
    if (isInitial) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .or(`caller_id.eq.${appUser.id},receiver_id.eq.${appUser.id}`)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      if (data) setCalls(data as any);
    } catch (e) {
      console.error("Error fetching calls:", e);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallHistory(true);

    const channel = supabase.channel('calls-history')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'calls' 
      }, (payload) => {
        // Surgical updates for speed
        if (payload.eventType === 'INSERT') {
          setCalls(prev => [payload.new as any, ...prev].slice(0, 30));
        } else if (payload.eventType === 'UPDATE') {
          setCalls(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c));
        } else {
          fetchCallHistory(false);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [appUser?.id]);

  const deleteCall = async (id: string) => {
    try {
      if (!appUser?.id) return;
      // Security Audit: Prevent IDOR by ensuring only the caller or receiver can delete their log
      await supabase.from('calls').delete()
        .eq('id', id)
        .or(`caller_id.eq.${appUser.id},receiver_id.eq.${appUser.id}`);
        
      setCalls(prev => prev.filter(c => c.id !== id));
    } catch (e) { console.error(e); }
  };

  const filteredCalls = calls.filter(call => {
    const isMissed = call.status === 'ringing' || (call.status === 'ended' && !call.started_at);
    if (filter === 'missed' && !isMissed) return false;
    
    const otherId = call.caller_id === appUser?.id ? call.receiver_id : call.caller_id;
    const otherUser = allUsers.find(u => u.id === otherId);
    const nameMatch = otherUser?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch;
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Area */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white dark:border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">سجل المكالمات</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">تاريخ تواصلك مع المبدعين</p>
          </div>
          
          <div className="flex gap-2">
            {['all', 'missed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
                  filter === f 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {f === 'all' ? 'الكل' : 'الفائتة'}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          <input 
            type="text" 
            placeholder="ابحث في السجل..."
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3.5 pr-12 pl-4 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-3 pb-20">
        <AnimatePresence mode="popLayout">
          {loading ? (
             <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>
          ) : filteredCalls.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center bg-white/50 dark:bg-slate-800/50 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-700">
               <Phone className="mx-auto text-slate-200 mb-4" size={48} />
               <p className="text-sm font-bold text-slate-400">لا يوجد سجل مكالمات حالياً</p>
            </motion.div>
          ) : filteredCalls.map((call, i) => {
            const isOutgoing = call.caller_id === appUser?.id;
            const isMissed = (call.status === 'ringing' || (call.status === 'ended' && !call.started_at)) && !isOutgoing;
            const otherId = isOutgoing ? call.receiver_id : call.caller_id;
            const otherUser = allUsers.find(u => u.id === otherId);
            
            return (
              <motion.div
                key={call.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                layout
              >
                <GlassCard className="p-4 rounded-[2rem] border border-white dark:border-slate-700 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                       <img 
                        src={otherUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name || 'U')}&background=0a66c2&color=fff`} 
                        className="w-14 h-14 rounded-2xl object-cover shadow-sm"
                        alt=""
                      />
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center ${
                        isMissed ? 'bg-red-500' : isOutgoing ? 'bg-blue-500' : 'bg-emerald-500'
                      }`}>
                        {isMissed ? <PhoneMissed size={10} className="text-white" /> :
                         isOutgoing ? <PhoneOutgoing size={10} className="text-white" /> :
                         <PhoneIncoming size={10} className="text-white" />}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col justify-center">
                          <h3 className="text-lg font-black text-slate-800 dark:text-white truncate mb-1">
                            {otherUser?.name || 'مستخدم غير معروف'}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isMissed ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                              {isMissed ? 'مكالمة فائتة' : isOutgoing ? 'مكالمة صادرة' : 'مكالمة واردة'}
                            </span>
                            <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                              <Calendar size={12} className="text-blue-500" /> {new Date(call.created_at).toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                              <Clock size={12} className="text-emerald-500" /> {new Date(call.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                           <button 
                            onClick={() => otherUser && onStartCall(otherUser, call.type)}
                            className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                            title="إعادة الاتصال"
                           >
                             {call.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
                           </button>
                           <button 
                            onClick={() => otherUser && onSelectChat(otherUser)}
                            className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"
                            title="إرسال رسالة"
                           >
                             <MessageSquare size={18} />
                           </button>
                           <button 
                            onClick={() => deleteCall(call.id)}
                            className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                           >
                             <Trash2 size={18} />
                           </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
