import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { ProfileInfoCard } from './ProfileInfoCard';
import { AppUser, Post } from '../../../types';

interface ProfilePageProps {
  profile: AppUser;
  isMe: boolean;
  isEditing?: boolean;
  user?: any;
  onBack?: () => void;
  onSave?: (updates: any) => Promise<void>;
  onSyncSignal?: () => void;
  isConnected?: boolean;
  handleRelocatePost?: (p: Post) => void;
  setRelocatingPost?: (p: Post) => void;
  addToast?: (m: string, t?: any) => void;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onAddComment?: (id: string, c: string) => void;
  setAppUser?: (user: any) => void;
  onMessageClick?: () => void;
  onCallClick?: (u: any) => void;
  onGoToSettings?: () => void;
  [key: string]: any;
}

export function ProfilePage({
  profile,
  isMe,
  user,
  onBack,
  onMessageClick,
  onCallClick,
  onGoToSettings,
}: ProfilePageProps) {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 pb-28 pt-0 md:pt-4" dir="rtl">
      
      {/* Back button header */}
      {onBack && (
        <div className="flex items-center justify-between px-2 py-1">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black hover:bg-slate-50 transition-all border border-slate-100 dark:border-slate-700 shadow-sm"
          >
            <ArrowRight size={14} />
            العودة للرئيسية
          </button>
          <p className="text-xs font-black text-slate-400">الملف الشخصي</p>
        </div>
      )}

      {/* Single profile info card */}
      <ProfileInfoCard
        profile={profile}
        isMe={isMe}
        onMessageClick={onMessageClick}
        onCallClick={() => onCallClick?.(profile)}
        showCallButton={!isMe}
        onGoToSettings={onGoToSettings}
      />
    </div>
  );
}

export default ProfilePage;
