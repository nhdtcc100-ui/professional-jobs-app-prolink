import React, { useState } from 'react';
import { Search, Users, Briefcase, MessageSquare, ArrowLeft, Globe, Lock, ShieldCheck, ChevronRight, AlertCircle, X } from 'lucide-react';
import { validateField } from '../../lib/security/inputValidator';
import { motion, AnimatePresence } from 'motion/react';
import { PostTransmissionCard, PostNewsCard } from './index';
import { AppUser, Post, Job } from '../../types';

interface SearchViewProps {
  searchQuery: string;
  filteredUsers: AppUser[];
  filteredJobs: Job[];
  filteredPosts: Post[];
  setSelectedProfile: (user: AppUser) => void;
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  user: any;
  allUsers: AppUser[];
  handleEchoPost: (post: Post) => Promise<void>;
  setRelocatingPost: (post: Post) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  handleLike: (postId: string) => Promise<void>;
  handleAddComment: (postId: string, content: string) => Promise<void>;
  onDeletePost?: (id: string) => void;
  setSelectedPostDetail?: (post: Post) => void;
  onJobClick?: (job: Job) => void;
}

type FilterTab = 'all' | 'people' | 'jobs';

export const SearchView: React.FC<SearchViewProps> = ({
  searchQuery,
  filteredUsers,
  filteredJobs,
  filteredPosts,
  setSelectedProfile,
  setActiveTab,
  setSearchQuery,
  user,
  allUsers,
  handleEchoPost,
  setRelocatingPost,
  addToast,
  handleLike,
  handleAddComment,
  onDeletePost,
  setSelectedPostDetail,
  onJobClick
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleInputChange = (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) { setSearchError(null); return; }
    const check = validateField(val, 'حقل البحث', user ? { id: user.id, name: user.name, email: user.email } : undefined, '/search');
    setSearchError(check.valid ? null : (check.error ?? null));
  };

  const tabs: { id: FilterTab, label: string, icon: any, count: number }[] = [
    { id: 'all', label: 'الكل', icon: Search, count: filteredUsers.length + filteredJobs.length },
    { id: 'people', label: 'أشخاص', icon: Users, count: filteredUsers.length },
    { id: 'jobs', label: 'وظائف', icon: Briefcase, count: filteredJobs.length },
  ];

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto px-4 md:px-0">
      {/* 🔍 Search Input Bar with Real-time Threat Guard */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-2">
        <div className={`relative flex items-center bg-slate-50 rounded-2xl px-4 py-3 border transition-all ${searchError ? 'border-red-400 bg-red-50/20' : 'border-slate-200 focus-within:border-blue-500 focus-within:bg-white'}`}>
          <Search size={18} className={`shrink-0 ${searchError ? 'text-red-500' : 'text-slate-400'}`} />
          <input
            type="text"
            className="w-full bg-transparent border-none outline-none text-xs font-bold text-slate-900 placeholder:text-slate-400 pr-3"
            placeholder="ابحث عن أشخاص، وظائف، مجموعات أو منشورات..."
            value={searchQuery}
            onChange={e => handleInputChange(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => handleInputChange('')} className="p-1 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
        {searchError && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[11px] font-semibold">
            <AlertCircle size={13} className="shrink-0 text-red-500" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* Header & Filters */}
      <div className="bg-white/80 backdrop-blur-md sticky top-[64px] z-30 p-2 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black transition-all ${
                activeFilter === tab.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${activeFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeFilter}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-6"
        >
          {/* People Section */}
          {(activeFilter === 'all' || activeFilter === 'people') && filteredUsers.length > 0 && (
            <section className="bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6 px-2">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <Users size={14} /> الأشخاص
                </h4>
                {activeFilter === 'all' && filteredUsers.length > 3 && (
                  <button onClick={() => setActiveFilter('people')} className="text-[10px] font-bold text-blue-600">عرض الكل</button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {(activeFilter === 'all' ? filteredUsers.slice(0, 3) : filteredUsers).map(u => (
                  <div key={u.id} onClick={() => setSelectedProfile(u)} className="group flex items-center gap-4 hover:bg-slate-50 p-4 rounded-3xl cursor-pointer transition-all border border-transparent hover:border-slate-100 active:scale-[0.98]">
                    <div className="relative">
                      <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}&background=random`} className="w-14 h-14 rounded-2xl object-cover shadow-sm ring-2 ring-white" alt="" />
                      {u.isPro && <div className="absolute -top-1 -right-1 bg-amber-400 text-white p-0.5 rounded-lg border-2 border-white"><ShieldCheck size={10} /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{u.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate">{u.companyName || u.bio || 'مستخدم Elevate عراق'}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-200 group-hover:text-blue-400 transition-colors" />
                  </div>
                ))}
              </div>
            </section>
          )}

          

          {/* Jobs Section */}
          {(activeFilter === 'all' || activeFilter === 'jobs') && filteredJobs.length > 0 && (
            <section className="bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6 px-2">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <Briefcase size={14} /> الوظائف
                </h4>
                {activeFilter === 'all' && filteredJobs.length > 3 && (
                  <button onClick={() => setActiveFilter('jobs')} className="text-[10px] font-bold text-blue-600">عرض الكل</button>
                )}
              </div>
              <div className="space-y-3">
                {(activeFilter === 'all' ? filteredJobs.slice(0, 3) : filteredJobs).map(j => (
                  <div key={j.id} onClick={() => { if (onJobClick) { onJobClick(j); } else { setActiveTab('jobs'); } }} className="group flex items-center gap-4 hover:bg-slate-50 p-4 rounded-3xl cursor-pointer border border-slate-50 hover:border-slate-100 transition-all active:scale-[0.98]">
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm ring-2 ring-white"><Briefcase size={22} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-sm group-hover:text-emerald-600 transition-colors">{j.title}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{j.company} • {j.location || 'عن بُعد'}</p>
                      {j.salary && <p className="text-[9px] text-emerald-500 font-black mt-1">راتب متوقع: {j.salary}</p>}
                    </div>
                    <button className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black group-hover:bg-emerald-600 group-hover:text-white transition-all">تفاصيل</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Posts Section (Only if All or Posts) */}
          {(activeFilter === 'all') && filteredPosts.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-400 px-6 tracking-widest flex items-center gap-2">
                <Globe size={14} /> المنشورات
              </h4>
              {filteredPosts.map((post, idx) => (
                <PostNewsCard
                  key={post.id}
                  post={post}
                  delay={idx * 0.05}
                  onClick={() => setSelectedPostDetail?.(post)}
                  onAuthorClick={() => {
                    const found = allUsers.find(au => au.id === post.authorId);
                    if (found) setSelectedProfile(found);
                  }}
                  allUsers={allUsers}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {tabs.find(t => t.id === activeFilter)?.count === 0 && (
            <div className="text-center py-24 bg-white/40 border-4 border-dashed border-slate-100 rounded-[4rem]">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-100 border border-slate-50">
                <Search size={40} className="text-slate-200" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">لا توجد نتائج</h3>
              <p className="text-slate-400 font-bold text-sm">لم نجد أي تطابق لـ "{searchQuery}" في قسم {tabs.find(t => t.id === activeFilter)?.label}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

