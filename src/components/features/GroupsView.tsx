import React, { useState, useEffect } from 'react';
import { Users, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { GroupCard, GroupDetailView, GroupCreateForm } from './groups';
import { AppUser } from '../../types';

const Skeleton = () => (
  <div className="bg-white p-4 rounded-3xl border border-slate-100 animate-pulse">
    <div className="w-full h-32 bg-slate-100 rounded-2xl mb-4" />
    <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
    <div className="h-3 bg-slate-100 rounded w-1/2" />
  </div>
);

const DEMO_GROUPS = [
  { id: 'dg-1', name: 'مجتمع مطوري الذكاء الاصطناعي', description: 'تجمع نخبة المطورين في مجالات AI & ML وتقنيات البيانات الضخمة والتعلم العميق', category: 'برمجة', member_count: 1240, is_private: false, cover_url: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&h=200&fit=crop&auto=format' },
  { id: 'dg-2', name: 'رواد الأعمال والشركات الناشئة', description: 'نقاشات حول الاستثمار، الإدارة وتطوير المشاريع الريادية في العراق والوطن العربي', category: 'ريادة أعمال', member_count: 856, is_private: false, cover_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&h=200&fit=crop&auto=format' },
  { id: 'dg-3', name: 'مهندسو البرمجيات العراق', description: 'مجتمع للمهندسين البرمجيين العراقيين لتبادل الخبرات والفرص الوظيفية والمعرفة التقنية', category: 'برمجة', member_count: 2341, is_private: false, cover_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=200&fit=crop&auto=format' },
  { id: 'dg-4', name: 'قادة التسويق الرقمي', description: 'منتدى حصري لمتخصصي التسويق الرقمي وصناع المحتوى وخبراء SEO وSocial Media', category: 'تسويق', member_count: 634, is_private: true, cover_url: 'https://images.unsplash.com/photo-1611926653458-09294b3142bf?w=600&h=200&fit=crop&auto=format' },
  { id: 'dg-5', name: 'نساء في التقنية — عراق', description: 'مجتمع داعم لتمكين المرأة في قطاع التكنولوجيا والابتكار والريادة التقنية', category: 'عام', member_count: 445, is_private: false, cover_url: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=600&h=200&fit=crop&auto=format' },
  { id: 'dg-6', name: 'مصممو الجرافيك والهوية البصرية', description: 'فضاء إبداعي لمصممي الجرافيك والهوية البصرية لعرض أعمالهم وتبادل الإلهام والموارد', category: 'تصميم', member_count: 389, is_private: false, cover_url: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&h=200&fit=crop&auto=format' },
];

export interface GroupsViewProps {
  addToast: (m: string, t?: any) => void;
  appUser: any;
  sharedPost?: any;
  onClearSharedPost?: () => void;
  onSelectGroup?: (group: any) => void;
}

export function GroupsView({ addToast, appUser, sharedPost, onClearSharedPost, onSelectGroup }: GroupsViewProps) {
  const [activeTab, setActiveTab] = useState<'discover' | 'my' | 'create'>('discover');
  const [groups, setGroups] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [createForm, setCreateForm] = useState({ name: '', description: '', category: 'عام', is_private: false });
  const [creating, setCreating] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const categories = ['عام', 'برمجة', 'تصميم', 'تسويق', 'ريادة أعمال', 'هندسة', 'طب', 'قانون', 'تعليم'];

  useEffect(() => {
    fetchGroups();
    if (appUser) {
      fetchMyGroups();
      fetchConnections();
    }
  }, [appUser]);

  const fetchGroups = async () => {
    setLoading(true);
    const { data } = await supabase.from('groups').select('*').eq('is_private', false).order('created_at', { ascending: false });
    if (data && data.length > 0) setGroups(data);
    else setGroups(DEMO_GROUPS);
    setLoading(false);
  };

  const fetchMyGroups = async () => {
    const { data } = await supabase.from('group_members').select('*, groups(*)').eq('user_id', appUser.id).eq('status', 'accepted');
    if (data) setMyGroups(data.map((d: any) => d.groups).filter(Boolean));
  };

  const fetchConnections = async () => {
    const { data: conns } = await supabase.from('connections').select('*').or(`requester_id.eq.${appUser.id},recipient_id.eq.${appUser.id}`).eq('status', 'accepted');
    if (conns) setConnections(conns);
    const { data: users } = await supabase.from('profiles').select('id, name, avatar_url, role, title, company_name');
    if (users) setAllUsers(users);
  };

  const fetchPendingRequests = async (groupId: string) => {
    const { data: members } = await supabase.from('group_members').select('*').eq('group_id', groupId).eq('status', 'pending');
    if (members) {
      const joined = members.map(m => ({
        ...m,
        profiles: allUsers.find(p => p.id === m.user_id) || null
      }));
      setPendingRequests(joined);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) { addToast('أدخل اسم المجموعة', 'error'); return; }
    if (!appUser) return;
    setCreating(true);
    try {
      const { data: group, error } = await supabase.from('groups').insert([{ ...createForm, created_by: appUser.id }]).select().single();
      if (error) throw error;
      await supabase.from('group_members').insert([{ group_id: group.id, user_id: appUser.id, role: 'owner', status: 'accepted' }]);
      addToast('تم إنشاء المجموعة بنجاح! 🎉');
      setCreateForm({ name: '', description: '', category: 'عام', is_private: false });
      setActiveTab('my');
      fetchGroups();
      fetchMyGroups();
    } catch (e: any) { addToast('خطأ: ' + e.message, 'error'); }
    setCreating(false);
  };

  const handleJoinRequest = async (group: any) => {
    if (!appUser) return;
    const { data: existing } = await supabase.from('group_members').select('id,status').eq('group_id', group.id).eq('user_id', appUser.id).maybeSingle();
    if (existing) { addToast(existing.status === 'pending' ? 'طلبك قيد الانتظار' : 'أنت عضو بالفعل', 'error'); return; }
    await supabase.from('group_members').insert([{ group_id: group.id, user_id: appUser.id, role: 'member', status: group.is_private ? 'pending' : 'accepted' }]);
    if (!group.is_private) {
      const { data: countData } = await supabase.from('group_members').select('id', { count: 'exact' }).eq('group_id', group.id).eq('status', 'accepted');
      if (countData !== null) await supabase.from('groups').update({ member_count: countData }).eq('id', group.id);
    }
    addToast(group.is_private ? 'تم إرسال طلب الانضمام ✅' : 'تم الانضمام للمجموعة! 🎉');
    fetchGroups(); fetchMyGroups();
  };

  const handleApprove = async (memberId: string, approve: boolean) => {
    await supabase.from('group_members').update({ status: approve ? 'accepted' : 'rejected' }).eq('id', memberId);
    if (approve && selectedGroup) {
      const { data: countData } = await supabase.from('group_members').select('id', { count: 'exact' }).eq('group_id', selectedGroup.id).eq('status', 'accepted');
      if (countData !== null) await supabase.from('groups').update({ member_count: countData }).eq('id', selectedGroup.id);
    }
    addToast(approve ? 'تم قبول الطلب ✅' : 'تم رفض الطلب');
    if (selectedGroup) fetchPendingRequests(selectedGroup.id);
  };

  const inviteConnectedUser = async (group: any, userId: string) => {
    const { data: existing } = await supabase.from('group_members').select('id').eq('group_id', group.id).eq('user_id', userId).maybeSingle();
    if (existing) { addToast('هذا المستخدم مُضاف بالفعل', 'error'); return; }
    await supabase.from('group_members').insert([{ group_id: group.id, user_id: userId, role: 'member', status: 'accepted' }]);
    addToast('تمت الدعوة بنجاح ✅');
  };
  if (selectedGroup) return (
    <GroupDetailView 
      group={selectedGroup} 
      appUser={appUser} 
      addToast={addToast} 
      onBack={() => {
        if (onSelectGroup) onSelectGroup(null);
        setSelectedGroup(null);
      }}
      pendingRequests={pendingRequests}
      connections={connections}
      allUsers={allUsers}
      onApprove={async (id, acc) => {
        await supabase.from('group_members').update({ status: acc ? 'accepted' : 'rejected' }).eq('id', id);
        fetchPendingRequests(selectedGroup.id);
        fetchMyGroups();
      }}
      onInvite={async (g, u) => {
        await supabase.from('group_members').insert([{ group_id: g.id, user_id: u, status: 'pending', role: 'member' }]);
        addToast('تم إرسال الدعوة بنجاح ✅');
      }}
      fetchPending={fetchPendingRequests}
      sharedPost={sharedPost} 
      onClearSharedPost={onClearSharedPost} 
    />
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex gap-2">
          {(['discover', 'my', 'create'] as const).map((key) => (
            <button 
              key={key} 
              onClick={() => setActiveTab(key)} 
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === key ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {key === 'discover' ? 'اكتشاف' : key === 'my' ? 'مجموعاتي' : '+ إنشاء'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'create' && (
        <GroupCreateForm 
          createForm={createForm} 
          setCreateForm={setCreateForm} 
          categories={categories} 
          handleCreate={handleCreate} 
          creating={creating} 
        />
      )}

      {activeTab === 'my' && (
        <div className="grid grid-cols-1 gap-4">
          {myGroups.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-slate-100 shadow-inner">
              <Users size={64} className="mx-auto text-slate-100 mb-6 animate-bounce" />
              <p className="text-slate-400 font-black text-lg uppercase tracking-widest">لم تنضم لأي مجتمع مهني بعد</p>
              <button onClick={() => setActiveTab('discover')} className="mt-4 bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl shadow-blue-100 hover:scale-105 transition-all">اكتشف الفرص الآن</button>
            </div>
          ) : myGroups.map(g => (
            <GroupCard key={g.id} group={g} variant="my" onClick={() => { setSelectedGroup(g); fetchPendingRequests(g.id); }} />
          ))}
        </div>
      )}

      {activeTab === 'discover' && (
        <div className="grid grid-cols-1 gap-3">
          {loading ? (
            <>
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </>
          ) : groups.map(g => (
            <GroupCard key={g.id} group={g} variant="discover" onClick={() => { setSelectedGroup(g); fetchPendingRequests(g.id); }} onJoin={() => handleJoinRequest(g)} />
          ))}
        </div>
      )}
    </div>
  );
}
