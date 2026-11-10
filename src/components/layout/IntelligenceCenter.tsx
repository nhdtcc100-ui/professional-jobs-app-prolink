import React from 'react';
import { Shield, Rocket, Activity, Briefcase, Eye } from 'lucide-react';
import { GlassCard } from '../ui';
import { AppUser } from '../../types';
import { useAppContext } from '../../contexts/AppContext';

interface IntelligenceCenterProps {
  addToast: (msg: string, type?: 'success' | 'error') => void;
  setShowAdmin?: (show: boolean) => void;
  appUser?: AppUser | null;
  setSelectedProfile?: (user: AppUser | null) => void;
}

export const IntelligenceCenter: React.FC<IntelligenceCenterProps> = ({ 
  addToast, 
  setShowAdmin,
  appUser: propUser,
  setSelectedProfile
}) => {
  const { appUser: contextUser, posts, connections, userTotalPostsCount } = useAppContext();
  const appUser = propUser || contextUser;

  const isEmployer = appUser?.role === 'employer';

  // 📊 Dynamic stats calculation
  const userPosts = posts.filter(p => p.authorId === appUser?.id || (p as any).author_id === appUser?.id);
  const myPostsCount = Math.max(userTotalPostsCount || 0, userPosts.length);
  const totalLikes = userPosts.reduce((acc, p) => acc + (p.likesCount || 0), 0);
  const viewsCount = myPostsCount * 28 + totalLikes * 4;
  const totalInteractions = totalLikes + userPosts.length;
  const userConnectionsCount = connections.filter(c => 
    c.status === 'accepted' && (c.requesterId === appUser?.id || c.recipientId === appUser?.id)
  ).length;

  const isFreelancer = appUser?.role === 'freelancer';

  // Role label
  const roleLabel = isEmployer ? 'صاحب عمل' : isFreelancer ? 'عمل حر ⚡' : 'باحث عن عمل';

  return (
    <div className="lg:col-span-3 space-y-4 mb-10 md:mb-0 hidden md:block">
      <div className="sticky top-20 space-y-4">
        {/* ── Profile Stats Card ── */}
        <GlassCard className="card-3d rounded-[2.5rem] p-6 border-none shadow-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl group border border-white/20 dark:border-slate-800">
          <div className="space-y-5">
            {/* Profile Quick Summary */}
            <div 
              onClick={() => appUser && setSelectedProfile?.(appUser)}
              className="flex items-center gap-3.5 p-3.5 bg-slate-50/70 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800 transition-all group/prof"
            >
              <img 
                src={appUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(appUser?.name || 'User')}&background=random`}
                className="w-11 h-11 rounded-2xl border-2 border-white dark:border-slate-700 shadow-md object-cover"
                alt=""
              />
              <div className="min-w-0 flex-1">
                <p className="font-black text-xs text-slate-800 dark:text-white truncate group-hover/prof:text-blue-600 transition-colors">{appUser?.name}</p>
                <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  isEmployer 
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
                    : isFreelancer
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {roleLabel}
                </span>
              </div>
            </div>

            {/* Live Stats — Visible to employers only: Total Posts & Views */}
            {isEmployer && (
              <div className="space-y-2">
                <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100/40 dark:border-blue-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Activity size={14} />
                    </div>
                    <span className="text-xs font-black">عدد المنشورات</span>
                  </div>
                  <span className="text-base font-black text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-blue-100 dark:border-slate-700">
                    {myPostsCount}
                  </span>
                </div>

                <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/40 dark:border-indigo-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Eye size={14} />
                    </div>
                    <span className="text-xs font-black">عدد المشاهدات</span>
                  </div>
                  <span className="text-base font-black text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-indigo-100 dark:border-slate-700">
                    {viewsCount}
                  </span>
                </div>
              </div>
            )}

            {/* ── Super Admin Button (ONLY FOR ADMINS -> Opens Admin Dashboard) ── */}
            {appUser?.isAdmin && (
              <button 
                onClick={() => setShowAdmin?.(true)}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white rounded-2xl shadow-xl shadow-blue-600/25 hover:scale-[1.02] active:scale-95 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                    <Shield size={18} className="text-white" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black uppercase tracking-tight">لوحة التحكم العليا</p>
                    <p className="text-[9px] font-bold text-blue-100 opacity-90">الانتقال للـ Dashboard الرئيسي</p>
                  </div>
                </div>
                <Rocket size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </button>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 text-center">
              <p className="text-[9px] text-slate-400 font-black tracking-widest uppercase">منصة عمل • 2026</p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
