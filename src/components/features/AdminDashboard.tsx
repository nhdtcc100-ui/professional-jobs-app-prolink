import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Plus, Users, FileText, Briefcase, AlertTriangle,
  TrendingUp, Eye, Trash2, CheckCircle, XCircle, Search,
  BarChart3, Activity, Crown, RefreshCw, Building2, Phone
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface AdminDashboardProps {
  reports: any[];
  onClose: () => void;
  addToast: (m: string, t?: any) => void;
}

interface Stats {
  users: number;
  seekers: number;
  employers: number;
  proUsers: number;
  freeUsers: number;
  posts: number;
  jobs: number;
  pendingReports: number;
  weeklyGrowth: number[];
}

type Tab = 'overview' | 'reports' | 'users' | 'posts' | 'resources' | 'settings';

export function AdminDashboard({ reports, onClose, addToast }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats>({ users: 0, seekers: 0, employers: 0, proUsers: 0, freeUsers: 0, posts: 0, jobs: 0, pendingReports: 0, weeklyGrowth: [] });
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [localReports, setLocalReports] = useState(reports);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      // 1. Fetch exact total counts using head:true for efficiency
      const [
        totalUsersRes,
        seekersRes,
        employersRes,
        totalPostsRes,
        totalJobsRes
      ] = await Promise.all([
        db.from('profiles').select('*', { count: 'exact', head: true }),
        db.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'seeker'),
        db.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'employer'),
        db.from('posts').select('*', { count: 'exact', head: true }),
        db.from('jobs').select('*', { count: 'exact', head: true })
      ]);

      // 2. Fetch data for display (limited)
      const [recentUsersRes, recentPostsRes] = await Promise.all([
        db.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
        db.from('posts').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      const totalUsers = totalUsersRes.count || 0;
      const seekers = seekersRes.count || 0;
      const employers = employersRes.count || 0;

      // 3. Fetch Pro vs Free
      const proCountRes = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('is_pro', true);
      const proUsers = proCountRes.count || 0;

      setStats({
        users: totalUsers,
        seekers: seekers,
        employers: employers,
        proUsers: proUsers,
        freeUsers: totalUsers - proUsers,
        posts: totalPostsRes.count || 0,
        jobs: totalJobsRes.count || 0,
        pendingReports: (localReports || reports).filter((r: any) => !r.status || r.status === 'pending').length,
        weeklyGrowth: [10, 25, 45, 30, 60, 75, 90], // Mock growth data for now
      });

      if (recentUsersRes.data) setAllUsers(recentUsersRes.data);
      if (recentPostsRes.data) setAllPosts(recentPostsRes.data);
    } catch (e: any) {
      console.error('Admin stats error:', e);
      addToast('خطأ في جلب البيانات: ' + (e.message || 'خطأ غير معروف'), 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDeletePost = async (postId: string, reportId?: string) => {
    try {
      await db.from('posts').delete().eq('id', postId);
      if (reportId) await db.from('reports').update({ status: 'resolved' }).eq('id', reportId);
      setLocalReports(prev => prev.filter((r: any) => r.id !== reportId));
      setAllPosts(prev => prev.filter((p: any) => p.id !== postId));
      setStats(prev => ({ ...prev, posts: Math.max(0, prev.posts - 1), pendingReports: Math.max(0, prev.pendingReports - 1) }));
      addToast('تم حذف المنشور بنجاح ✅', 'success');
    } catch (e: any) {
      addToast('فشل الحذف: ' + e.message, 'error');
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      await db.from('reports').update({ status: 'dismissed' }).eq('id', reportId);
      setLocalReports(prev => prev.map((r: any) => r.id === reportId ? { ...r, status: 'dismissed' } : r));
      setStats(prev => ({ ...prev, pendingReports: Math.max(0, prev.pendingReports - 1) }));
      addToast('تم تجاهل البلاغ', 'success');
    } catch (e) { console.error(e); }
  };

  const handleToggleAdminUser = async (userId: string, currentAdmin: boolean) => {
    try {
      await db.from('profiles').update({ is_admin: !currentAdmin }).eq('id', userId);
      setAllUsers(prev => prev.map((u: any) => u.id === userId ? { ...u, is_admin: !currentAdmin } : u));
      addToast(!currentAdmin ? 'تم منح صلاحيات الأدمن 🛡️' : 'تم سحب صلاحيات الأدمن', 'success');
    } catch (e: any) { addToast('فشل التحديث: ' + e.message, 'error'); }
  };

  const handleToggleProUser = async (userId: string, currentPro: boolean) => {
    try {
      await db.from('profiles').update({ is_pro: !currentPro }).eq('id', userId);
      setAllUsers(prev => prev.map((u: any) => u.id === userId ? { ...u, is_pro: !currentPro } : u));
      addToast(!currentPro ? 'تم تفعيل PRO للمستخدم ⭐' : 'تم إلغاء PRO', 'success');
    } catch (e: any) { addToast('فشل التحديث: ' + e.message, 'error'); }
  };

  const handleToggleBanUser = async (userId: string, currentActive: boolean) => {
    try {
      await db.from('profiles').update({ is_active: !currentActive }).eq('id', userId);
      setAllUsers(prev => prev.map((u: any) => u.id === userId ? { ...u, is_active: !currentActive } : u));
      addToast(!currentActive ? 'تم فك حظر المستخدم ✅' : 'تم حظر المستخدم 🚫', 'success');
    } catch (e: any) { addToast('فشل العملية: ' + e.message, 'error'); }
  };

  const handleToggleUserAccess = async (userId: string, field: string, currentVal: boolean) => {
    try {
      await db.from('profiles').update({ [field]: !currentVal }).eq('id', userId);
      setAllUsers(prev => prev.map((u: any) => u.id === userId ? { ...u, [field]: !currentVal } : u));
      addToast('تم تحديث الصلاحيات بنجاح', 'success');
    } catch (e: any) { addToast('فشل التحديث: ' + e.message, 'error'); }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview',  label: 'نظرة عامة', icon: <BarChart3 size={16} /> },
    { id: 'reports',   label: 'البلاغات',   icon: <AlertTriangle size={16} />, badge: stats.pendingReports },
    { id: 'users',     label: 'المستخدمون', icon: <Users size={16} />,        badge: stats.users },
    { id: 'posts',     label: 'المنشورات',  icon: <FileText size={16} />,     badge: stats.posts },
    { id: 'resources', label: 'إدارة المصادر', icon: <Building2 size={16} /> },
    { id: 'settings',  label: 'الإعدادات',   icon: <Plus className="rotate-45" size={16} /> },
  ];

  const STAT_CARDS = [
    { label: 'إجمالي المستخدمين', value: stats.users, icon: <Users size={22} />, gradient: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/25', detail: `${stats.seekers} باحث • ${stats.employers} صاحب عمل` },
    { label: 'المنشورات الاحترافية', value: stats.posts, icon: <FileText size={22} />, gradient: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/25' },
    { label: 'فرص العمل', value: stats.jobs, icon: <Briefcase size={22} />, gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/25' },
    { label: 'بلاغات المراجعة', value: stats.pendingReports, icon: <AlertTriangle size={22} />, gradient: 'from-rose-500 to-red-600', shadow: 'shadow-rose-500/25' },
  ];

  const filteredUsers = allUsers.filter(u =>
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPosts = allPosts.filter(p =>
    (p.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.author_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-3 sm:p-6"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-6xl bg-slate-900 border border-slate-700/50 rounded-[3rem] shadow-[0_0_100px_rgba(37,99,235,0.15)] flex flex-col h-[94vh] overflow-hidden relative"
      >
        {/* Mysterious Ambient Lights */}
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 flex items-center justify-between px-10 py-8 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 animate-pulse" />
              <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center shadow-2xl border border-slate-700/50">
                <Shield size={32} className="text-blue-400" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-widest uppercase">Admin Gateway</h2>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="flex gap-1">
                   {[...Array(3)].map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-emerald-500' : 'bg-slate-700'} animate-pulse`} style={{ animationDelay: `${i * 0.2}s` }} />)}
                </div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">Internal Security Protocol 2.8.5</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end mr-4">
               <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">System Online</span>
               <span className="text-[8px] font-medium text-slate-500">Latency: 24ms</span>
            </div>
            <button onClick={fetchStats} disabled={loadingStats} className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-slate-800 transition-all shadow-xl active:scale-95 group">
              <RefreshCw size={20} className={`${loadingStats ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            </button>
            <button onClick={onClose} className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 hover:bg-slate-800 transition-all shadow-xl active:scale-95">
              <Plus size={24} className="rotate-45" />
            </button>
          </div>
        </div>

        <div className="relative z-10 flex gap-2 px-10 pt-6 pb-0 border-b border-slate-800/50 bg-slate-900/30 overflow-x-auto no-scrollbar scroll-smooth">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
              className={`relative flex-1 flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-t-[1.5rem] text-[10px] font-black transition-all min-w-[100px] border-x border-t ${
                activeTab === tab.id 
                  ? 'bg-slate-800 text-blue-400 border-slate-700/50 shadow-[0_-10px_25px_rgba(0,0,0,0.2)]' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border-transparent'
              }`}
            >
              <div className={`${activeTab === tab.id ? 'text-blue-400' : 'text-slate-500'} mb-1`}>
                {React.cloneElement(tab.icon as any, { size: 18 })}
              </div>
              <span className="uppercase tracking-widest">{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`absolute top-3 right-3 text-[9px] font-black px-1.5 py-0.5 rounded-md ${tab.id === 'reports' ? 'bg-rose-500 text-white shadow-lg shadow-rose-900/20' : 'bg-blue-500 text-white shadow-lg shadow-blue-900/20'}`}>
                  {tab.badge}
                </span>
              )}
              {activeTab === tab.id && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 shadow-[0_0_15px_#3b82f6]" />}
            </button>
          ))}
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto p-10 space-y-10 bg-slate-900/40">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-10">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                  {STAT_CARDS.map((card, i) => (
                    <motion.div 
                      key={card.label} 
                      initial={{ opacity: 0, y: 15 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      transition={{ delay: i * 0.07 }} 
                      className="relative bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center group hover:border-blue-500/50 transition-all shadow-2xl backdrop-blur-xl h-56"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity`} />
                      <div className={`w-16 h-16 rounded-[1.5rem] bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white mb-6 shadow-2xl relative z-10 scale-110 group-hover:scale-125 transition-transform duration-500`}>
                        {React.cloneElement(card.icon as any, { size: 28 })}
                        <div className="absolute inset-0 bg-white rounded-[1.5rem] blur-xl opacity-0 group-hover:opacity-20 transition-opacity" />
                      </div>
                      <div className="text-4xl font-black text-white mb-3 tracking-tighter relative z-10">
                        {loadingStats ? <span className="inline-block w-20 h-10 bg-slate-700/50 rounded-xl animate-pulse" /> : card.value.toLocaleString('ar-EG')}
                      </div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] relative z-10 group-hover:text-slate-300 transition-colors">{card.label}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 shadow-xl backdrop-blur-md">
                      <div className="flex items-center justify-between mb-8">
                         <h3 className="text-sm font-black text-white uppercase tracking-widest">توزيع الأدوار</h3>
                         <Activity size={18} className="text-blue-500" />
                      </div>
                      <div className="space-y-8">
                         <div>
                            <div className="flex justify-between text-[11px] font-black mb-3 uppercase">
                               <span className="text-slate-300">باحثين عن عمل ({stats.seekers})</span>
                               <span className="text-blue-400">{stats.users > 0 ? Math.round((stats.seekers / stats.users) * 100) : 0}%</span>
                            </div>
                            <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700/50 p-1">
                               <motion.div initial={{ width: 0 }} animate={{ width: `${stats.users > 0 ? (stats.seekers / stats.users) * 100 : 0}%` }} className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)]" />
                            </div>
                         </div>
                         <div>
                            <div className="flex justify-between text-[11px] font-black mb-3 uppercase">
                               <span className="text-slate-300">أصحاب عمل ({stats.employers})</span>
                               <span className="text-emerald-400">{stats.users > 0 ? Math.round((stats.employers / stats.users) * 100) : 0}%</span>
                            </div>
                            <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700/50 p-1">
                               <motion.div initial={{ width: 0 }} animate={{ width: `${stats.users > 0 ? (stats.employers / stats.users) * 100 : 0}%` }} className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)]" />
                            </div>
                         </div>
                      </div>
                      <div className="mt-10 pt-8 border-t border-slate-700/50 grid grid-cols-2 gap-6">
                         <div className="text-center p-5 bg-slate-900/50 rounded-3xl border border-slate-700/50 shadow-inner">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Weekly Growth</p>
                            <p className="text-2xl font-black text-emerald-400">+12%</p>
                         </div>
                         <div className="text-center p-5 bg-slate-900/50 rounded-3xl border border-slate-700/50 shadow-inner">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">User Engagement</p>
                            <p className="text-2xl font-black text-blue-400">88%</p>
                         </div>
                      </div>
                   </div>

                   <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl backdrop-blur-md lg:col-span-1">
                      <div className="flex items-center justify-between mb-8">
                         <h3 className="text-sm font-black text-white uppercase tracking-widest">تحليل النشاط الثلاثي</h3>
                         <BarChart3 size={18} className="text-blue-500" />
                      </div>
                      <div className="flex items-end justify-between gap-4 h-56 px-4">
                         {[
                           { label: 'المستخدمين', value: stats.users, color: 'from-blue-600 to-indigo-500', icon: <Users size={12} /> },
                           { label: 'المنشورات', value: stats.posts, color: 'from-violet-600 to-purple-500', icon: <FileText size={12} /> },
                           { label: 'فرص العمل', value: stats.jobs, color: 'from-emerald-600 to-teal-500', icon: <Briefcase size={12} /> }
                         ].map((m, i) => {
                            // Normalize height relative to a max (e.g. 100 or total)
                            const max = Math.max(stats.users, stats.posts, stats.jobs, 1);
                            const h = (m.value / max) * 90 + 10; // min 10% for visibility
                            return (
                             <div key={i} className="flex-1 group relative flex flex-col items-center">
                                <motion.div 
                                   initial={{ height: 0 }} 
                                   animate={{ height: `${h}%` }} 
                                   transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}
                                   className={`w-full bg-gradient-to-t ${m.color} rounded-2xl relative transition-all group-hover:brightness-125 shadow-2xl border-t border-white/20`} 
                                />
                                <div className="absolute -top-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-slate-950/90 text-white text-[10px] font-black px-3 py-2 rounded-xl shadow-2xl border border-slate-700 z-20 whitespace-nowrap backdrop-blur-xl">
                                   <div className="flex items-center gap-2 mb-1">
                                      <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${m.color}`} />
                                      {m.label}
                                   </div>
                                   <div className="text-lg text-white">{m.value.toLocaleString('ar-EG')}</div>
                                </div>
                                <div className="mt-4 text-[9px] font-black text-slate-500 uppercase tracking-tighter text-center">
                                   {m.label}
                                </div>
                             </div>
                            );
                         })}
                      </div>
                   </div>

                   <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 shadow-xl backdrop-blur-md">
                      <div className="flex items-center justify-between mb-8">
                         <h3 className="text-sm font-black text-white uppercase tracking-widest">نوع الحسابات</h3>
                         <Crown size={18} className="text-amber-500" />
                      </div>
                      <div className="flex items-center justify-center py-6 gap-10">
                         <div className="w-40 h-40 rounded-full border-[16px] border-slate-700/30 relative shadow-2xl">
                            <motion.div 
                               initial={{ rotate: -90, opacity: 0 }}
                               animate={{ rotate: 0, opacity: 1 }}
                               className="absolute inset-[-16px] rounded-full border-[16px] border-amber-500 border-l-transparent border-b-transparent"
                               style={{ clipPath: `conic-gradient(from 0deg, #f59e0b ${ (stats.proUsers / (stats.users || 1)) * 360 }deg, transparent 0deg)` }}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                               <span className="text-3xl font-black text-white">{Math.round((stats.proUsers / (stats.users || 1)) * 100)}%</span>
                               <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">PRO</span>
                            </div>
                         </div>
                         <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-2xl border border-slate-700/50">
                               <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                               <div>
                                  <p className="text-[11px] font-black text-slate-200">عضوية PRO</p>
                                  <p className="text-[10px] text-slate-500">{stats.proUsers} مستخدم</p>
                               </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-2xl border border-slate-700/50">
                               <div className="w-3 h-3 rounded-full bg-slate-600" />
                               <div>
                                  <p className="text-[11px] font-black text-slate-200">حساب عادي</p>
                                  <p className="text-[10px] text-slate-500">{stats.freeUsers} مستخدم</p>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-500/30 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden lg:col-span-2">
                      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
                      <div className="flex items-center justify-between mb-10 relative z-10">
                         <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">منحنى النمو المتسارع</h3>
                            <p className="text-xs text-indigo-200/60 font-bold italic">Real-time Platform Expansion Metrics</p>
                         </div>
                         <div className="px-5 py-2 bg-white/5 backdrop-blur-xl rounded-2xl text-[11px] font-black text-blue-400 border border-white/10 shadow-2xl">
                            معدل النمو +18%
                         </div>
                      </div>
                      <div className="h-48 flex items-end gap-2 relative z-10 px-4">
                         {stats.weeklyGrowth.map((val, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center group">
                               <motion.div 
                                  initial={{ height: 0 }} 
                                  animate={{ height: `${val}%` }} 
                                  className="w-full bg-gradient-to-t from-blue-600/20 to-blue-400/80 rounded-2xl relative transition-all group-hover:to-blue-300"
                                >
                                  <div className="absolute -top-1 w-3 h-3 bg-white rounded-full left-1/2 -translate-x-1/2 shadow-[0_0_15px_white] scale-0 group-hover:scale-100 transition-transform" />
                               </motion.div>
                               <span className="text-[9px] text-slate-400 font-black mt-3 uppercase tracking-tighter opacity-60 group-hover:opacity-100">{['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i]}</span>
                            </div>
                         ))}
                         <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none">
                            <path 
                               d={`M ${0} ${200 - (stats.weeklyGrowth[0] * 2)} ${stats.weeklyGrowth.map((v, i) => `L ${(i * 100/6) * 6} ${200 - (v * 2)}`).join(' ')}`} 
                               fill="none" 
                               stroke="url(#grad)" 
                               strokeWidth="3" 
                            />
                            <defs>
                               <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                  <stop offset="0%" stopColor="#3b82f6" />
                                  <stop offset="100%" stopColor="#818cf8" />
                               </linearGradient>
                            </defs>
                         </svg>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'reports' && (
              <motion.div key="reports" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {localReports.filter((r: any) => r.status === 'pending').length === 0 ? (
                  <div className="py-32 text-center flex flex-col items-center gap-6">
                    <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <Shield size={48} className="text-emerald-500" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-black text-white">النزاهة الرقمية مكتملة</h3>
                      <p className="text-slate-500 text-sm font-bold max-w-xs mx-auto uppercase tracking-widest">Digital Integrity Verified</p>
                    </div>
                  </div>
                ) : (
                  localReports.filter((r: any) => r.status === 'pending').map((r: any) => (
                    <div key={r.id} className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-7 flex flex-col lg:flex-row gap-6 shadow-2xl hover:border-rose-500/30 transition-all backdrop-blur-xl group relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-rose-500/10 transition-all" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-4">
                           <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                           <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">High Alert: Reported Content</span>
                        </div>
                        {/* Word break and white-space handling for mobile overflow */}
                        <div className="bg-slate-900/40 rounded-2xl p-5 border border-slate-700/30">
                          <p className="text-sm text-slate-200 leading-relaxed font-medium break-words overflow-hidden line-clamp-4 group-hover:line-clamp-none transition-all duration-500">
                            {r.content}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-end lg:self-center shrink-0">
                        <button 
                          onClick={() => {
                            const user = allUsers.find(u => u.id === r.authorId);
                            if (user) handleToggleProUser(r.authorId, user.is_pro);
                          }} 
                          className="px-5 py-3.5 bg-slate-700/50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-600 transition-all border border-slate-600/50 active:scale-95"
                        >
                          تحذير الناشر
                        </button>
                        <button 
                          onClick={() => handleDismissReport(r.id)} 
                          className="px-5 py-3.5 bg-slate-700 uppercase tracking-widest text-slate-300 rounded-2xl text-[10px] font-black hover:bg-slate-600 hover:text-white transition-all border border-slate-600 active:scale-95"
                        >
                          تجاهل
                        </button>
                        <button 
                          onClick={() => handleDeletePost(r.postId, r.id)} 
                          className="px-6 py-3.5 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 transition-all shadow-xl shadow-rose-900/40 border border-rose-500 active:scale-95 animate-pulse hover:animate-none"
                        >
                          حذف نهائي
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="relative group">
                  <Search size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="البحث في سجل المستخدمين..." className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl pr-12 py-4 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-xl transition-all" />
                </div>
                <div className="space-y-4">
                  {filteredUsers.map((u: any) => (
                    <div key={u.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-5 bg-slate-800/40 border border-slate-700/50 rounded-[2rem] hover:border-blue-500/50 hover:bg-slate-800/60 transition-all group relative overflow-hidden backdrop-blur-md shadow-xl">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
                      
                      <div className="flex items-center gap-5 flex-1 min-w-0">
                        <div className="relative flex-shrink-0">
                          <img 
                            src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'U')}`} 
                            className="w-14 h-14 rounded-2xl object-cover ring-2 ring-slate-700 group-hover:ring-blue-500/50 transition-all shadow-2xl" 
                            alt="" 
                          />
                          {u.is_pro && (
                            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-amber-500 rounded-full border-4 border-slate-900 flex items-center justify-center text-[10px] text-white">
                              <Crown size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-3 mb-2">
                             <p className="text-base font-black text-white truncate tracking-tight">{u.name}</p>
                             <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${u.role === 'employer' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                {u.role === 'employer' ? 'صاحب عمل' : 'باحث'}
                             </div>
                             {u.is_admin && <span className="px-3 py-1 bg-white text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">Admin</span>}
                          </div>
                          <p className="text-xs text-slate-400 font-bold truncate opacity-80">{u.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-2xl border border-slate-700/50 self-end lg:self-center shadow-inner">
                        <ActionButton 
                          onClick={() => handleToggleUserAccess(u.id, 'has_calls_access', u.has_calls_access)} 
                          active={u.has_calls_access} 
                          color="indigo" 
                          icon={<Phone size={16} />} 
                        />
                        <ActionButton 
                          onClick={() => handleToggleUserAccess(u.id, 'has_erp_access', u.has_erp_access)} 
                          active={u.has_erp_access} 
                          color="indigo" 
                          icon={<Building2 size={16} />} 
                        />
                        <div className="w-[1px] h-8 bg-slate-700 mx-2" />
                        <ActionButton 
                          onClick={() => handleToggleAdminUser(u.id, u.is_admin)} 
                          active={u.is_admin} 
                          color="blue" 
                          icon={<Shield size={16} />} 
                        />
                        <ActionButton 
                          onClick={() => handleToggleProUser(u.id, u.is_pro)} 
                          active={u.is_pro} 
                          color="blue" 
                          icon={<Crown size={16} />} 
                        />
                        <ActionButton 
                          onClick={() => handleToggleBanUser(u.id, u.is_active !== false)} 
                          active={u.is_active === false} 
                          color="red" 
                          icon={<XCircle size={16} />} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'posts' && (
              <motion.div key="posts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="relative group">
                  <Search size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث في السجل الجنائي للمنشورات..." className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl pr-12 py-4 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-xl transition-all" />
                </div>
                {filteredPosts.map(p => (
                  <div key={p.id} className="p-6 bg-slate-800/40 border border-slate-700/50 rounded-[2rem] flex items-start gap-6 shadow-xl hover:border-blue-500/50 transition-all backdrop-blur-md">
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.15em]">{p.author_name}</p>
                       </div>
                       <p className="text-sm text-slate-200 leading-relaxed font-medium break-words line-clamp-4">{p.content}</p>
                    </div>
                    <button 
                      onClick={() => handleDeletePost(p.id)} 
                      className="p-3.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all flex-shrink-0 shadow-xl border border-rose-500/20 active:scale-95"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}

             {activeTab === 'resources' && (
               <motion.div key="resources" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 shadow-xl hover:shadow-2xl hover:border-blue-500/50 transition-all relative overflow-hidden group backdrop-blur-md">
                       <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform" />
                       <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-6">
                          <Building2 className="text-blue-500" size={32} />
                       </div>
                       <h3 className="text-xl font-black text-white mb-3 tracking-tight">نظام المخطط المكتبي (ERP)</h3>
                       <p className="text-sm text-slate-400 mb-8 leading-relaxed font-medium">نظام مركزي لإدارة الموارد البشرية والعمليات المالية. الوصول مقيد للمستخدمين المفعلين فقط عبر بروتوكول الأمان.</p>
                       <button className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl text-sm font-black shadow-2xl shadow-blue-900/30 hover:scale-[1.02] active:scale-95 transition-all">دخول النظام الآمن</button>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 shadow-xl hover:shadow-2xl hover:border-emerald-500/50 transition-all relative overflow-hidden group backdrop-blur-md">
                       <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform" />
                       <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-6">
                          <Briefcase className="text-emerald-500" size={32} />
                       </div>
                       <h3 className="text-xl font-black text-white mb-3 tracking-tight">محرك الموازنة الذكي</h3>
                       <p className="text-sm text-slate-400 mb-8 leading-relaxed font-medium">تحليل فورس العمل ومعدلات التوظيف باستخدام الذكاء الاصطناعي لتوفير أفضل النتائج السوقية.</p>
                       <div className="flex items-end gap-1.5 h-16 mb-8">
                          {[30, 70, 45, 90, 60, 40, 80, 50].map((h, i) => <div key={i} className="flex-1 bg-emerald-500/20 rounded-full" style={{height: `${h}%`}} />)}
                       </div>
                    </div>
                 </div>
               </motion.div>
             )}
            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8 shadow-xl backdrop-blur-md">
                       <div className="flex items-center gap-4 mb-8">
                          <div className="p-3 bg-blue-600 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)]"><Activity size={20} className="text-white" /></div>
                          <h3 className="text-sm font-black text-white uppercase tracking-widest">تكوين النظام</h3>
                       </div>
                       
                       <div className="space-y-6">
                          <div className="flex items-center justify-between p-5 bg-slate-900/50 rounded-3xl border border-slate-700/50">
                             <div>
                                <p className="text-sm font-black text-white">نشر الفيديو للعامة</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">تقييد رفع المقاطع على المشرفين فقط</p>
                             </div>
                             <div className="w-14 h-7 bg-emerald-500 rounded-full relative shadow-inner">
                                <div className="absolute right-1 top-1 w-5 h-5 bg-white rounded-full shadow-lg" />
                             </div>
                          </div>

                          <div className="flex items-center justify-between p-5 bg-slate-900/50 rounded-3xl border border-slate-700/50 opacity-50">
                             <div>
                                <p className="text-sm font-black text-white">وضع الصيانة</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">إغلاق المنصة للصيانة المجدولة</p>
                             </div>
                             <div className="w-14 h-7 bg-slate-700 rounded-full relative shadow-inner">
                                <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full shadow-lg" />
                             </div>
                          </div>
                       </div>

                       <div className="mt-10 p-5 bg-blue-600/10 border border-blue-500/20 rounded-3xl">
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-relaxed">
                             ملاحظة: كافة التغييرات في هذا القسم يتم تعقبها وتسجيلها في سجل العمليات الأمنية (Audit Logs).
                          </p>
                       </div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-800/40 to-blue-900/20 border border-slate-700/50 rounded-[2.5rem] p-8 shadow-xl backdrop-blur-md">
                        <div className="flex items-center gap-4 mb-8">
                          <div className="p-3 bg-emerald-600 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.4)]"><Shield size={20} className="text-white" /></div>
                          <h3 className="text-sm font-black text-white uppercase tracking-widest">أمن البيانات</h3>
                       </div>
                       <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6">
                          نظام التشفير الحالي يعمل ببروتوكول AES-256. جميع الاتصالات مشفرة بالكامل بين العميل والخادم.
                       </p>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="p-5 bg-slate-900/50 rounded-3xl border border-slate-700/50 text-center">
                             <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">حالة التشفير</p>
                             <p className="text-emerald-400 font-black">نشط وجاهز</p>
                          </div>
                          <div className="p-5 bg-slate-900/50 rounded-3xl border border-slate-700/50 text-center">
                             <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">توزيع المفاتيح</p>
                             <p className="text-blue-400 font-black">مؤمنة 100%</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative z-10 px-8 py-5 border-t border-slate-700/50 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-black tracking-widest uppercase">
            <CheckCircle size={16} className="text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
            <span>Encrypted Connection • V2.8.5 Stable</span>
          </div>
          <div className="text-[11px] text-slate-200 font-black tracking-widest opacity-40">ADMIN_GATEWAY_V94</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ActionButton({ onClick, active, color, icon }: { onClick: () => void, active: boolean, color: string, icon: React.ReactNode }) {
  const styles: any = {
    blue:    active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border-blue-500' 
                   : 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20',
    black:   active ? 'bg-slate-100 text-slate-900 shadow-lg shadow-slate-900/40 border-slate-200' 
                   : 'text-slate-400 bg-slate-400/10 hover:bg-slate-400/20 border-slate-400/20',
    red:     active ? 'bg-red-600 text-white shadow-lg shadow-red-900/40 border-red-500' 
                   : 'text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-500/20',
  };
  
  return (
    <button 
      onClick={onClick} 
      className={`p-3 rounded-2xl transition-all hover:scale-105 active:scale-95 border ${styles[color]}`}
    >
      {React.isValidElement(icon) ? React.cloneElement(icon as any, { size: 18, strokeWidth: 2.5 }) : icon}
    </button>
  );
}

