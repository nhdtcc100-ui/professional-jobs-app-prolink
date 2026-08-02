import React from 'react';
import { Rocket, ShieldCheck, FileText, Settings, Info, HeartHandshake } from 'lucide-react';
import { GlassCard, GlassButton } from '../ui';
import { biometricService } from '../../lib/services/biometricService';
import { AboutPlatformModal } from './AboutPlatformModal';

async function checkBiometricSupport(): Promise<{ supported: boolean; error: string | null }> {
  // 1. Check for Secure Context (HTTPS/Localhost)
  if (!window.isSecureContext) {
    return { supported: false, error: '❌ تفعيل البصمة يتطلب اتصالاً آمناً (HTTPS) أو العمل على localhost لضمان خصوصية البيانات الحيوية.' };
  }

  // 2. Check if WebAuthn API exists
  if (!window.PublicKeyCredential) {
    return { supported: false, error: '⚠️ هذا المتصفح لا يدعم تقنية تسجيل البصمة. يرجى استخدام متصفح حديث مثل Chrome أو Safari.' };
  }

  // 3. Check for Hardware Support
  try {
    const isHardwareAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!isHardwareAvailable) {
      return { supported: false, error: '❌ هذا الجهاز لا يدعم تقنية البصمة الحيوية (مثل مستشعر البصمة أو الوجه) أو لم يتم إعدادها في نظام التشغيل.' };
    }
    return { supported: true, error: null };
  } catch (e) {
    return { supported: false, error: 'فشل فحص دعم البصمة في هذا الجهاز.' };
  }
}

interface IntelligenceCenterProps {
  addToast: (msg: string, type?: 'success' | 'error') => void;
}

export const IntelligenceCenter: React.FC<IntelligenceCenterProps> = ({ addToast }) => {
  const [showAbout, setShowAbout] = React.useState(false);

  return (
    <div className="lg:col-span-3 space-y-4 mb-10 md:mb-0">
      <div className="sticky top-20 space-y-4">
        <GlassCard className="card-3d rounded-[2rem] p-6 border-none shadow-xl bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm group">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-2 mb-2">الدعم والمركز الاستراتيجي</h4>
            
            {/* Row 1: Side by Side */}
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => addToast("يمكنك مراسلتنا عبر: support@prolink.com", "success")}
                className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-0.5 transition-all group"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 mb-2">
                  <HeartHandshake size={16} />
                </div>
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">تواصل معنا</span>
              </button>

              <a href="#" className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all group">
                <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-900/30 flex items-center justify-center text-slate-400 mb-2">
                  <FileText size={16} />
                </div>
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">قانوني</span>
              </a>
            </div>

            {/* Row 2: Full Width Cards */}
            <div className="space-y-2">
              <button 
                onClick={() => setShowAbout(true)}
                className="w-full flex items-center justify-between p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Info size={16} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider">عن منصة ProLink</span>
                </div>
                <Rocket size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </button>

              <button 
                onClick={async () => {
                  const result = await checkBiometricSupport();
                  if (!result.supported) addToast(result.error || 'خطأ غير معروف', 'error');
                  else addToast("الجهاز يدعم التحقق الحيوي بنجاح! ✅", "success");
                }}
                className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-900/30 flex items-center justify-center text-slate-400">
                    <ShieldCheck size={16} />
                  </div>
                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">فحص البصمة</span>
                </div>
                <Settings size={14} className="text-slate-300 group-hover:rotate-90 transition-transform" />
              </button>
            </div>

            <div className="pt-4 border-t border-slate-50 dark:border-slate-800 text-center">
              <p className="text-[9px] text-slate-400 font-black tracking-widest uppercase">Elevate عراق HQ • 2026</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <AboutPlatformModal show={showAbout} onClose={() => setShowAbout(false)} />
    </div>
  );
};
