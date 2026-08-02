import React from 'react';
import { Zap, BookOpen, Pencil } from 'lucide-react';

interface ProfileTabsProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isMe: boolean;
}

export const ProfileTabs: React.FC<ProfileTabsProps> = ({ activeTab, setActiveTab, isMe }) => {
  const tabs = [
    { id: 'posts',    label: 'المنشورات', icon: Zap },
    { id: 'activity', label: 'الخبرة والمهارات', icon: BookOpen },
    ...(isMe ? [{ id: 'edit', label: 'تعديل الملف', icon: Pencil }] : [])
  ];

  return (
    <div className="px-4 border-t border-slate-100 flex overflow-x-auto no-scrollbar bg-white sticky top-0 z-20 shadow-sm">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as any)}
          className={`
            flex-1 py-4 text-[10px] font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap border-b-2
            ${activeTab === tab.id
              ? 'border-[#0a66c2] text-[#0a66c2]'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
            }
          `}
        >
          <tab.icon size={13} />
          {tab.label}
        </button>
      ))}
    </div>
  );
};
