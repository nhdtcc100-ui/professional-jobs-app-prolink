import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Settings,
  Sparkles,
  Type,
  MessageSquare,
  Palette,
  CornerDownLeft,
  Volume2,
  Smartphone,
  CheckCheck,
  Activity,
  Download,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import {
  ChatSettings,
  FONT_SIZE_CLASSES,
  BUBBLE_ROUNDED,
  WALLPAPERS,
} from './MessagingView';

interface MessagingSettingsPageProps {
  settings: ChatSettings;
  onUpdate: <K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) => void;
  onReset: () => void;
  onBack: () => void;
  addToast?: (m: string, t?: any) => void;
}

const playMessageSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (_) {}
};

const triggerHaptic = () => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  } catch (_) {}
};

export const MessagingSettingsPage: React.FC<MessagingSettingsPageProps> = ({
  settings,
  onUpdate,
  onReset,
  onBack,
  addToast,
}) => {
  const cardClass = 'bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[32px] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-[0_6px_30px_rgba(10,102,194,0.08)] dark:shadow-[0_10px_45px_rgba(0,0,0,0.5)] p-6 sm:p-8 space-y-6';
  const iconBadge = 'w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0a66c2] to-[#004182] flex items-center justify-center text-white shadow-lg shadow-[#0a66c2]/30 shrink-0';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="max-w-4xl mx-auto space-y-6 pb-36 px-2 sm:px-4 md:px-6"
      dir="rtl"
    >
      {/* ─── Top Breadcrumb & Navigation Bar ─── */}
      <div className="flex items-center justify-between pt-1 pb-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl text-xs sm:text-sm font-black hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border border-slate-200/80 dark:border-slate-700 shadow-sm cursor-pointer active:scale-95"
        >
          <ArrowRight size={17} />
          <span>العودة للمراسلة</span>
        </button>

        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-bold">
          <Sparkles size={14} className="text-amber-500" />
          <span>تخصيص تجربة المحادثة</span>
        </div>
      </div>

      {/* ─── Hero Gradient Banner (Matches Profile / Job Post Pages) ─── */}
      <div className="rounded-[2.5rem] overflow-hidden bg-gradient-to-bl from-[#0a66c2] via-[#0d5ca8] to-[#003d7a] text-white p-6 sm:p-8 relative shadow-xl border border-white/10">
        <div className="absolute -top-10 -left-10 w-44 h-44 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-60 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 sm:gap-5 relative z-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/15 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-xl shrink-0">
            <Settings size={30} className="text-white" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[10px] font-black uppercase tracking-wider mb-1.5 border border-white/20">
              <Sparkles size={11} className="text-amber-300" />
              تخصيص كامل كالتليجرام
            </div>
            <h1 className="text-xl sm:text-2xl font-black leading-tight">إعدادات المراسلة والدردشة</h1>
            <p className="text-xs sm:text-sm text-blue-100 font-bold mt-1">
              تحكم كامل في مظهر المحادثات، الخطوط، الأصوات، الخصوصية وسلوك الإرسال
            </p>
          </div>
        </div>
      </div>

      {/* ─── CARD 1: مظهر الرسائل والخطوط ─── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={cardClass}
      >
        <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className={iconBadge}><Palette size={22} /></div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
              مظهر الرسائل والخطوط
            </h2>
            <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
              تعديل حجم النصوص وشكل الفقاعات وخلفية الشات
            </p>
          </div>
        </div>

        {/* 1.1 Font Size */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Type size={18} className="text-[#0a66c2]" />
              حجم خط نصوص المحادثة
            </span>
            <span className="text-xs font-black text-[#0a66c2] bg-blue-50 dark:bg-blue-950/50 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800/40">
              {settings.fontSize === 'small' ? 'صغير (12px)' : settings.fontSize === 'normal' ? 'قياسي (14px)' : settings.fontSize === 'large' ? 'كبير (16px)' : 'ضخم (18px)'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'small', label: 'صغير' },
              { id: 'normal', label: 'قياسي' },
              { id: 'large', label: 'كبير' },
              { id: 'huge', label: 'ضخم' },
            ].map(sz => (
              <button
                key={sz.id}
                type="button"
                onClick={() => onUpdate('fontSize', sz.id as any)}
                className={`py-3 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                  settings.fontSize === sz.id
                    ? 'bg-[#0a66c2] text-white shadow-lg shadow-[#0a66c2]/30 scale-[1.02]'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                }`}
              >
                {sz.label}
              </button>
            ))}
          </div>

          {/* Live Preview Box */}
          <div className="pt-2">
            <span className="text-xs font-bold text-slate-400 mb-1.5 block">معاينة مباشرة لشكل وحجم الرسالة:</span>
            <div className={`p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 ${WALLPAPERS[settings.chatWallpaper] || 'bg-slate-100/60 dark:bg-slate-900/60'}`}>
              <div className="flex justify-start">
                <div className={`max-w-[85%] px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700 ${BUBBLE_ROUNDED[settings.bubbleStyle].others} ${FONT_SIZE_CLASSES[settings.fontSize]}`}>
                  أهلاً بك! هذه معاينة حية لشكل رسائل المحادثة. 👋
                </div>
              </div>
              <div className="flex justify-end">
                <div className={`max-w-[85%] px-4 py-2.5 bg-gradient-to-l from-[#0a66c2] to-[#004182] text-white shadow-md ${BUBBLE_ROUNDED[settings.bubbleStyle].mine} ${FONT_SIZE_CLASSES[settings.fontSize]}`}>
                  تبدو رائعة جداً ومريحة للقراءة! ✨
                  {settings.readReceipts && (
                    <span className="inline-flex mr-2 text-blue-200"><CheckCheck size={14} /></span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 1.2 Bubble Style */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3.5">
          <span className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
            <MessageSquare size={18} className="text-[#0a66c2]" />
            نمط وشكل فقاعات الرسائل
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { id: 'modern', label: 'عصري منحني', desc: 'انحناء تليجرام العصري' },
              { id: 'classic', label: 'كلاسيكي', desc: 'حواف مستقيمة وتقليدية' },
              { id: 'minimal', label: 'دائري ناعم', desc: 'دائري بالكامل من الأطراف' },
            ].map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => onUpdate('bubbleStyle', b.id as any)}
                className={`p-3.5 rounded-2xl text-right transition-all cursor-pointer flex flex-col gap-1 ${
                  settings.bubbleStyle === b.id
                    ? 'bg-[#0a66c2] text-white shadow-lg shadow-[#0a66c2]/30 scale-[1.02]'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs sm:text-sm font-black">{b.label}</span>
                <span className={`text-[10px] ${settings.bubbleStyle === b.id ? 'text-blue-100' : 'text-slate-400'}`}>
                  {b.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 1.3 Wallpaper */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3.5">
          <span className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Palette size={18} className="text-[#0a66c2]" />
            خلفية المحادثة
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'default', label: 'افتراضي' },
              { id: 'subtle-blue', label: 'أزرق هادئ' },
              { id: 'slate', label: 'رمادي دافئ' },
              { id: 'dots', label: 'نقاط هندسية' },
            ].map(wp => (
              <button
                key={wp.id}
                type="button"
                onClick={() => onUpdate('chatWallpaper', wp.id as any)}
                className={`py-3 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                  settings.chatWallpaper === wp.id
                    ? 'bg-[#0a66c2] text-white shadow-lg shadow-[#0a66c2]/30 scale-[1.02]'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                }`}
              >
                {wp.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ─── CARD 2: الإدخال والإرسال ─── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cardClass}
      >
        <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className={iconBadge}><CornerDownLeft size={22} /></div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
              الإدخال والإرسال
            </h2>
            <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
              التحكم في طريقة إرسال الرسائل عبر لوحة المفاتيح
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 gap-4">
          <div>
            <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white block">
              إرسال الرسالة بمفتاح Enter
            </span>
            <p className="text-xs text-slate-400 font-bold mt-1 leading-relaxed">
              عند التفعيل: الضغط على Enter يُرسل الرسالة، والضغط على Shift + Enter ينشئ سطراً جديداً.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUpdate('sendOnEnter', !settings.sendOnEnter)}
            className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
              settings.sendOnEnter ? 'bg-[#0a66c2] justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
            }`}
          >
            <motion.div layout className="w-6 h-6 rounded-full bg-white shadow-md" />
          </button>
        </div>
      </motion.div>

      {/* ─── CARD 3: التنبيهات والأصوات والاهتزاز ─── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={cardClass}
      >
        <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className={iconBadge}><Volume2 size={22} /></div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
              التنبيهات والأصوات والاهتزاز
            </h2>
            <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
              المؤثرات الصوتية واللمسية أثناء إرسال واستلام الرسائل
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Sounds Toggle */}
          <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white">
                  أصوات الرسائل في المحادثة
                </span>
                <button
                  type="button"
                  onClick={playMessageSound}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#0a66c2] dark:text-blue-300 text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800"
                >
                  🔊 تجربة الصوت
                </button>
              </div>
              <p className="text-xs text-slate-400 font-bold mt-1">تشغيل نغمة لطيفة عند إرسال أو استلام رسالة جديدة</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdate('messageSounds', !settings.messageSounds)}
              className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                settings.messageSounds ? 'bg-[#0a66c2] justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
              }`}
            >
              <motion.div layout className="w-6 h-6 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* Haptics Toggle */}
          <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-[#0a66c2]" />
                <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white">
                  الاهتزاز التفاعلي (Haptic)
                </span>
                <button
                  type="button"
                  onClick={triggerHaptic}
                  className="px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  📳 تجربة
                </button>
              </div>
              <p className="text-xs text-slate-400 font-bold mt-1">اهتزاز خفيف للهاتف عند إرسال الرسائل والتفاعل</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdate('hapticFeedback', !settings.hapticFeedback)}
              className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                settings.hapticFeedback ? 'bg-[#0a66c2] justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
              }`}
            >
              <motion.div layout className="w-6 h-6 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ─── CARD 4: الخصوصية والحالة ─── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={cardClass}
      >
        <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className={iconBadge}><CheckCheck size={22} /></div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
              الخصوصية ومؤشرات القراءة
            </h2>
            <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
              التحكم في ظهور علامات القراءة وحالة الاتصال
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Read Receipts */}
          <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 gap-4">
            <div>
              <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white block">
                مؤشرات قراءة الرسائل (✓✓)
              </span>
              <p className="text-xs text-slate-400 font-bold mt-1">إشعار الطرف الآخر بقراءة رسائله وظهور علامتي الصح الزرقاوين</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdate('readReceipts', !settings.readReceipts)}
              className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                settings.readReceipts ? 'bg-[#0a66c2] justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
              }`}
            >
              <motion.div layout className="w-6 h-6 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* Online Status */}
          <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 gap-4">
            <div>
              <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white block">
                إظهار حالة الاتصال (متصل الآن)
              </span>
              <p className="text-xs text-slate-400 font-bold mt-1">السماح لجهات الاتصال بمعرفة تواجدك ونشاطك على التطبيق</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdate('showOnlineStatus', !settings.showOnlineStatus)}
              className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                settings.showOnlineStatus ? 'bg-[#0a66c2] justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
              }`}
            >
              <motion.div layout className="w-6 h-6 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ─── CARD 5: تخزين الوسائط واستعادة الافتراضي ─── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className={cardClass}
      >
        <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className={iconBadge}><Download size={22} /></div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
              الوسائط والبيانات
            </h2>
            <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
              خيارات تنزيل المرفقات وإعادة ضبط الإعدادات
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 gap-4">
          <div>
            <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white block">
              التحميل التلقائي للصور والملفات
            </span>
            <p className="text-xs text-slate-400 font-bold mt-1">تحميل صور ومرفقات المحادثات تلقائياً عند فتح الشات</p>
          </div>
          <button
            type="button"
            onClick={() => onUpdate('autoDownloadMedia', !settings.autoDownloadMedia)}
            className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
              settings.autoDownloadMedia ? 'bg-[#0a66c2] justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
            }`}
          >
            <motion.div layout className="w-6 h-6 rounded-full bg-white shadow-md" />
          </button>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={onReset}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <RotateCcw size={16} />
            <span>استعادة الإعدادات الافتراضية</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-l from-[#0a66c2] to-[#004182] hover:from-[#004182] hover:to-[#0a66c2] text-white text-sm font-black flex items-center justify-center gap-2 shadow-xl shadow-[#0a66c2]/30 active:scale-95 transition-all cursor-pointer"
          >
            <CheckCircle2 size={18} />
            <span>حفظ والعودة للمراسلة</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MessagingSettingsPage;
