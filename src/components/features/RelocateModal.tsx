import React from 'react';
import { motion } from 'motion/react';
import { Plus, Users, Send } from 'lucide-react';
import { AppUser, AppConnection, Post } from '../../types';

interface RelocateModalProps {
  post: Post;
  connections: AppConnection[];
  allUsers: AppUser[];
  currentId: string;
  onClose: () => void;
  onRelocate: (u: AppUser) => void;
}

export function RelocateModal({ post, connections, allUsers, currentId, onClose, onRelocate }: RelocateModalProps) {
  const connectedUserIds = connections
    .filter(c => c.status === 'accepted')
    .map(c => c.requesterId === currentId ? c.recipientId : c.requesterId);

  const connectedUsers = allUsers.filter(u => connectedUserIds.includes(u.id));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-slate-800 text-lg tracking-tighter">ترحيل الإشارة إلى الموالين</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><Plus size={20} className="rotate-45 text-slate-400" /></button>
        </div>

        <div className="p-4 bg-slate-50/50">
          <div className="bg-white p-3 rounded-xl border border-slate-100 text-[11px] text-slate-500 italic line-clamp-2">
            "{post.content}"
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {connectedUsers.length === 0 ? (
            <div className="text-center py-10">
              <Users size={40} className="mx-auto text-slate-200 mb-4" />
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">لا يوجد موالين متزامنين حالياً</p>
            </div>
          ) : (
            connectedUsers.map(u => (
              <div
                key={u.id}
                onClick={() => onRelocate(u)}
                className="flex items-center gap-3 p-3 hover:bg-blue-50 rounded-2xl cursor-pointer transition-all group"
              >
                <img src={u.avatar} className="w-10 h-10 rounded-full border border-slate-100" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{u.name}</h4>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">{u.companyName || 'عميل نخبة'}</p>
                </div>
                <Send size={16} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-medium">سيتم إرسال هذا التوجيه كرسالة خاصة للمستلم.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
