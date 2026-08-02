import React, { useState } from 'react';
import { Search, Users, Briefcase, MessageSquare, ArrowLeft, Globe, Lock, ShieldCheck, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PostTransmissionCard, PostNewsCard } from './index';
import { AppUser, Post, Job } from '../../types';

interface SearchViewProps {
  searchQuery: string;
  filteredUsers: AppUser[];
  filteredJobs: Job[];
  filteredPosts: Post[];
  filteredGroups: any[];
  setSelectedProfile: (user: AppUser) => void;
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  user: any;
  allUsers: AppUser[];
  handleEchoPost: (post: Post) => Promise<void>;
  setRelocatingPost: (post: Post) => void;
  addToast: (msg: string, type?: 'success' | 'error') => void;
  handleLike: (postId: string) => Promise<void>;
  handleAddComment: (postId: string, content: string) => Promise<void>;
  onDeletePost?: (id: string) => void;
  onSelectGroup?: (group: any) => void;
  setSelectedPostDetail?: (post: Post) => void;
}

type FilterTab = 'all' | 'people' | 'jobs' | 'groups';

export const SearchView: React.FC<SearchViewProps> = ({
  searchQuery,
  filteredUsers,
  filteredJobs,
  filteredPosts,
  filteredGroups,
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
  onSelectGroup,
  setSelectedPostDetail
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const tabs: { id: FilterTab, label: string, icon: any, count: number }[] = [
    { id: 'all', label: 'الكل', icon: Search, count: filteredUsers.length + filteredJobs.length + filteredGroups.length },
    { id: 'people', label: 'أشخاص', icon: Users, count: filteredUsers.length },
    { id: 'jobs', label: 'وظائف', icon: Briefcase, count: filteredJobs.length },
    { id: 'groups', label: 'مجموعات', icon: MessageSquare, count: filteredGroups.length },
  ];

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto px-4 md:px-0">
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

          {/* Groups Section */}
          {(activeFilter === 'all' || activeFilter === 'groups') && filteredGroups.length > 0 && (
            <section className="bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6 px-2">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <MessageSquare size={14} /> المجموعات
                </h4>
                {activeFilter === 'all' && filteredGroups.length > 3 && (
                  <button onClick={() => setActiveFilter('groups')} className="text-[10px] font-bold text-blue-600">عرض الكل</button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3">
                {(activeFilter === 'all' ? filteredGroups.slice(0, 3) : filteredGroups).map(g => (
                  <div key={g.id} onClick={() => onSelectGroup?.(g)} className="group flex items-start gap-4 hover:bg-indigo-50/30 p-4 rounded-3xl cursor-pointer transition-all border border-slate-50 hover:border-indigo-100 active:scale-[0.98]">
                    <div className="w-14 h-14 shrink-0 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl overflow-hidden shadow-sm ring-2 ring-white">
                      {g.avatar_url ? <img src={g.avatar_url} className="w-full h-full object-cover" alt="" /> : g.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{g.name}</p>
                        {g.is_private ? <Lock size={10} className="text-slate-400" /> : <Globe size={10} className="text-emerald-500" />}
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold mt-1 line-clamp-1">{g.description || 'لا يوجد وصف للمجموعة'}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[8px] font-black bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-lg">{g.member_count || 0} عضو</span>
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">{g.category || 'عام'}</span>
                      </div>
                    </div>
                    <button className="self-center p-2 bg-white text-indigo-600 rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-sm"><ArrowLeft size={16} /></button>
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
                  <div key={j.id} onClick={() => { setActiveTab('jobs'); setSearchQuery(''); }} className="group flex items-center gap-4 hover:bg-slate-50 p-4 rounded-3xl cursor-pointer border border-slate-50 hover:border-slate-100 transition-all active:scale-[0.98]">
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

