import React from 'react';
import { motion } from 'motion/react';
import { Plus, Users, Send, Briefcase } from 'lucide-react';
import { AppUser, AppConnection, Job } from '../../types';

interface QuickShareJobModalProps {
  job: Job;
  connections: AppConnection[];
  allUsers: AppUser[];
  currentId: string;
  onClose: () => void;
  onShare: (u: AppUser) => void;
}

export function QuickShareJobModal({ job, connections, allUsers, currentId, onClose, onShare }: QuickShareJobModalProps) {
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
        dir="rtl"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Briefcase size={20} />
            </div>
            <h3 className="font-black text-slate-800 text-lg tracking-tighter">مشاركة الوظيفة</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><Plus size={20} className="rotate-45 text-slate-400" /></button>
        </div>

        <div className="p-4 bg-blue-50/30">
          <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm flex items-center gap-3">
             <img src={job.image_url || `https://ui-avatars.com/api/?name=${job.company}&background=random`} className="w-12 h-12 rounded-xl object-cover border border-slate-100" />
             <div>
               <h4 className="font-black text-slate-800 text-xs">{job.title}</h4>
               <p className="text-[10px] text-blue-600 font-bold">{job.company}</p>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">اختر شخصاً للإرسال إليه</p>
          {connectedUsers.length === 0 ? (
            <div className="text-center py-10">
              <Users size={40} className="mx-auto text-slate-200 mb-4" />
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">لا يوجد جهات اتصال متزامنة</p>
            </div>
          ) : (
            connectedUsers.map(u => (
              <div
                key={u.id}
                onClick={() => onShare(u)}
                className="flex items-center gap-3 p-3 hover:bg-blue-50 rounded-2xl cursor-pointer transition-all group border border-transparent hover:border-blue-100"
              >
                <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}&background=random`} className="w-10 h-10 rounded-xl border border-slate-100" />
                <div className="flex-1">
                  <h4 className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors">{u.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold">{u.industry || 'باحث عن عمل'}</p>
                </div>
                <div className="p-2 bg-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-blue-50 shadow-sm">
                  <Send size={14} className="text-blue-600 rotate-180" />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-bold">سيتم إرسال الوظيفة كبطاقة احترافية داخل الرسائل.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
