import React from 'react';
import { motion } from 'motion/react';
import { 
  Briefcase, 
  GraduationCap, 
  Star, 
  Globe, 
  Phone, 
  MapPin, 
  Link2, 
  User, 
  Award,
  Calendar,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { GlassCard } from '../../ui';

interface ProfileActivityViewProps {
  profile: any;
}

const hasContent = (val: any) => {
  if (!val) return false;
  if (typeof val === 'string' && (val.trim() === '' || val.trim() === '[]')) return false;
  if (Array.isArray(val) && val.length === 0) return false;
  return true;
};

export const ProfileActivityView: React.FC<ProfileActivityViewProps> = ({ profile }) => {
  return (
    <motion.div
      key="activity"
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8 w-full pb-20"
    >
      {/* ─── Professional Summary Section ─────────────────────────────────────────── */}
      <GlassCard className="p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group profile-card-section">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-[5rem] -z-10 transition-transform group-hover:scale-110" />
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 shadow-sm">
            <User size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">الملخص المهني</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Professional Summary</p>
          </div>
        </div>
        
        <div className="relative">
          <p className="text-sm text-slate-600 leading-loose whitespace-pre-wrap font-medium">
            {profile.bio || "لم يتم إضافة نبذة مهنية بعد. الملفات الشخصية المكتملة تحصل على فرص عمل أكثر بنسبة 40%."}
          </p>
        </div>

        {/* Contact Strip */}
        <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-slate-50">
          {profile.location && (
            <span className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-bold text-slate-500 border border-slate-100">
              <MapPin size={12} className="text-slate-300" /> {profile.location}
            </span>
          )}
          {profile.phone && (
            <span className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-bold text-slate-500 border border-slate-100">
              <Phone size={12} className="text-slate-300" /> {profile.phone}
            </span>
          )}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl text-[10px] font-bold text-blue-600 border border-blue-100 hover:bg-blue-100 transition-all">
              <Globe size={12} /> {profile.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ─── Left Column: Experience & Education ──────────────── */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Experience Section */}
          <GlassCard className="p-8 rounded-[3rem] border border-slate-100 shadow-sm profile-card-section">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Briefcase size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">الخبرة المهنية</h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Work Experience</p>
              </div>
            </div>

            {hasContent(profile.experience) ? (
              <div className="space-y-8 relative before:absolute before:right-[23px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-50">
                <div className="relative pr-10">
                  <div className="absolute right-0 top-1 w-[46px] h-[46px] -mr-[23px] bg-white border-4 border-slate-50 rounded-full flex items-center justify-center z-10">
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-sm shadow-blue-200" />
                  </div>
                  <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 group hover:border-blue-200 transition-all">
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                      {profile.experience}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 px-6 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                <p className="text-xs text-slate-400 font-bold">لا توجد خبرات مهنية مضافة.</p>
              </div>
            )}
          </GlassCard>

          {/* Education Section */}
          <GlassCard className="p-8 rounded-[3rem] border border-slate-100 shadow-sm profile-card-section">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <GraduationCap size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">التعليم والمؤهلات</h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Academic Background</p>
              </div>
            </div>

            {hasContent(profile.education) ? (
              <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                <p className="text-sm text-slate-600 leading-loose whitespace-pre-wrap font-medium">
                  {profile.education}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 font-medium italic text-center">لم يتم إضافة بيانات تعليمية.</p>
            )}
          </GlassCard>
        </div>

        {/* ─── Right Column: Skills & Badges ────────────────── */}
        <div className="space-y-8">
          
          {/* Skills Section */}
          <GlassCard className="p-8 rounded-[3rem] border border-slate-100 shadow-sm bg-gradient-to-br from-white to-slate-50/30 profile-card-section">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Star size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">المهارات</h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Key Skills</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {(profile.skills || []).length > 0 ? profile.skills.map((s: string) => (
                <span key={s} className="px-4 py-2 bg-white text-slate-700 rounded-xl text-[10px] font-black border border-slate-100 shadow-sm hover:border-emerald-200 hover:text-emerald-600 transition-all cursor-default skill-tag">
                  {s}
                </span>
              )) : (
                <p className="text-xs text-slate-400 font-medium italic">لم يتم تحديد مهارات.</p>
              )}
            </div>
          </GlassCard>

          {/* Certifications / Accomplishments */}
          <GlassCard className="p-8 rounded-[3rem] border border-slate-100 shadow-sm profile-card-section">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Award size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">الإنجازات</h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Accomplishments</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-700">عضو موثق في Elevate عراق</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Identity Verified</p>
                </div>
              </div>
              {profile.is_pro && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <Star size={14} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-700">عضوية Pro المميزة</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Premium Professional</p>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

        </div>
      </div>
    </motion.div>
  );
};
