import React from 'react';
import { Users } from 'lucide-react';
import { GlassCard, GlassButton } from '../../ui';

interface GroupCardProps {
  group: any;
  onClick: () => void;
  variant?: 'discover' | 'my';
  onJoin?: () => void;
}

export const GroupCard: React.FC<GroupCardProps> = ({ group, onClick, variant = 'discover', onJoin }) => {
  if (variant === 'my') {
    return (
      <GlassCard className="rounded-3xl overflow-hidden cursor-pointer hover:shadow-2xl transition-all border border-slate-100 group" onClick={onClick}>
        <div className="h-24 relative">
          <img 
            src={group.cover_url || `https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=200&fit=crop&auto=format`} 
            className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-500" 
            alt={group.name}
          />
          <div className="absolute inset-0 bg-blue-900/20 group-hover:bg-transparent transition-colors" />
        </div>
        <div className="p-5">
          <div className="flex items-center gap-4 -mt-10 relative z-10 mb-3">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 font-black text-xl shadow-xl border-4 border-white">
              {group.name[0]}
            </div>
            <div className="pt-6">
              <h4 className="font-black text-slate-800 text-sm truncate w-32 md:w-40">{group.name}</h4>
              <p className="text-[10px] text-blue-500 font-black uppercase tracking-tighter">{group.category}</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-slate-50">
             <div className="flex -space-x-2 rtl:space-x-reverse">
                {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400 overflow-hidden"><img src={`https://i.pravatar.cc/100?u=${group.id}${i}`} alt="Member" /></div>)}
                <div className="w-6 h-6 rounded-full border-2 border-white bg-blue-50 flex items-center justify-center text-[8px] font-black text-blue-600">+{group.member_count || '0'}</div>
             </div>
             <span className="text-[10px] font-black text-slate-400 uppercase">نشط الآن</span>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="rounded-[2.5rem] overflow-hidden group hover:shadow-2xl transition-all flex flex-col h-full border border-slate-100 shadow-sm bg-white">
      <div className="h-40 relative overflow-hidden shrink-0">
        <img 
          src={group.cover_url || `https://images.unsplash.com/photo-1522071823991-b99c223a7097?w=600&h=200&fit=crop&auto=format`} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          alt={group.name}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
        <div className="absolute top-4 left-4">
           <span className="bg-white/20 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-full border border-white/20 uppercase tracking-widest">{group.category}</span>
        </div>
        <div className="absolute bottom-4 right-5 left-5">
           <h4 className="font-black text-lg text-white mb-1 drop-shadow-lg truncate">{group.name}</h4>
           <p className="text-[10px] text-blue-100 font-bold flex items-center gap-1.5 drop-shadow-md">
             <Users size={12} /> {group.member_count || 0} عضو مهني نشط
           </p>
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <p className="text-[13px] text-slate-500 line-clamp-2 mb-6 flex-1 leading-relaxed font-medium">
          {group.description || 'مساحة احترافية مخصصة لتبادل الخبرات وتطوير المهارات في هذا المجال التقني.'}
        </p>
        <div className="flex gap-3">
          <GlassButton onClick={onClick} variant="outline" className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50">التفاصيل</GlassButton>
          <GlassButton onClick={onJoin} className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest shadow-blue-200">
            {group.is_private ? 'طلب انضمام' : 'انضمام فوري'}
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  );
};
