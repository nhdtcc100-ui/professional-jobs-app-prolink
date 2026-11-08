import React from 'react';
import { ModernProfileView } from '../profile/ModernProfileView';
import { AppUser } from '../../../types';

interface SettingsPageProps {
  user: any;
  appUser: AppUser | null;
  addToast: (m: string, t?: any) => void;
  setAppUser?: (user: any) => void;
  onBack?: () => void;
}

export function SettingsPage({
  user,
  appUser,
  addToast,
  setAppUser,
  onBack,
}: SettingsPageProps) {
  if (!appUser) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" dir="rtl">
        <p className="text-slate-400 font-black text-sm">يجب تسجيل الدخول للوصول للإعدادات</p>
      </div>
    );
  }

  return (
    <ModernProfileView
      profile={appUser}
      isMe={true}
      user={user || appUser}
      onBack={onBack}
      addToast={addToast}
      setAppUser={setAppUser}
    />
  );
}

export default SettingsPage;
