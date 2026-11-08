import React from 'react';
import { ModernProfileView } from './ModernProfileView';
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
  addToast,
  setAppUser,
  onMessageClick,
  onCallClick,
}: ProfilePageProps) {
  return (
    <ModernProfileView
      profile={profile}
      isMe={isMe}
      user={user}
      onBack={onBack}
      addToast={addToast || (() => {})}
      setAppUser={setAppUser}
      onMessageClick={onMessageClick}
      onCallClick={() => onCallClick?.(profile)}
      showCallButton={!isMe}
    />
  );
}

export default ProfilePage;
