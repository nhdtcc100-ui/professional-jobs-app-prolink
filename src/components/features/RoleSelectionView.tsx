import React from 'react';
import { Users, Briefcase } from 'lucide-react';
import { GlassButton } from '../ui';
import { IcyBackground, RoleOption } from '../layout';
import { supabase } from '../../lib/supabase';

interface RoleSelectionViewProps {
  selectRole: (role: 'seeker' | 'employer') => void;
}

export const RoleSelectionView: React.FC<RoleSelectionViewProps> = ({ selectRole }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
      <IcyBackground />
      <div className="z-10 w-full max-w-2xl bg-white/60 backdrop-blur-2xl p-10 rounded-[3rem] border border-white shadow-2xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-800 mb-3">إعداد ملفك الشخصي</h2>
          <p className="text-slate-500">اختر الطريقة التي تود بها التفاعل مع شبكة Elevate عراق.</p>
        </div>
        <div className="space-y-6">
          <RoleOption
            title="باحث عن عمل"
            description="ابحث عن فرص مهنية واعرض مهاراتك التقنية للعالم."
            icon={Users}
            onClick={() => selectRole('seeker')}
          />
          <RoleOption
            title="قائد مهمة (صاحب عمل)"
            description="انشر توجيهات مهمة جديدة واستقطب النخبة من المحترفين."
            icon={Briefcase}
            onClick={() => selectRole('employer')}
          />
          <div className="pt-6 border-t border-slate-200 mt-6 flex justify-center">
            <GlassButton 
              variant="danger" 
              onClick={async () => {
                localStorage.clear();
                await supabase.auth.signOut();
                window.location.reload();
              }}
            >
              تسجيل خروج / تهيئة المتصفح
            </GlassButton>
          </div>
        </div>
      </div>
    </div>
  );
};
