/**
 * JobCandidatesPanel.tsx
 * ─────────────────────────────────────────────────────────────────
 * يعرض قائمة المرشحين المطابقين لوظيفة معينة عبر البحث في الملفات الشخصية:
 *   1. المسمى الوظيفي  (Job Title Matching)
 *   2. الموقع الجغرافي (Location Matching)
 *
 * بدون استخدام أي ذكاء اصطناعي، فقط المطابقين الفعليين لكلا الشرطين.
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, MapPin, Briefcase, ChevronDown, ChevronUp,
  Loader2, RefreshCw, UserX, Star, Shield, ArrowLeft, CheckCircle2
} from 'lucide-react';
import { profileService, type CandidateRow } from '../../../lib/services/profileService';
import { useAppContext } from '../../../contexts/AppContext';
import type { Job } from '../../../types';

interface JobCandidatesPanelProps {
  job: Job;
  employerId: string;
  onUserClick: (userId: string) => void;
  onStartChat?: (user: any) => void;
}

// ── بطاقة مرشح واحد ─────────────────────────────────────────────
const CandidateCard: React.FC<{
  candidate: CandidateRow;
  index: number;
  onClick: (id: string) => void;
  onStartChat?: (user: any) => void;
}> = ({ candidate, index, onClick, onStartChat }) => {
  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.name)}&background=0a66c2&color=fff&size=80`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      whileHover={{ y: -2, scale: 1.005 }}
      className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-lg transition-all group"
    >
      {/* الصورة */}
      <div 
        className="relative shrink-0 cursor-pointer"
        onClick={() => onClick(candidate.id)}
      >
        <img
          src={candidate.avatar_url || avatarFallback}
          alt={candidate.name}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = avatarFallback; }}
          className="w-12 h-12 rounded-2xl object-cover border-2 border-white dark:border-slate-700 shadow-sm group-hover:border-blue-500 transition-colors"
        />
        {candidate.is_pro && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
            <Star size={9} className="text-white fill-white" />
          </div>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 shadow-sm ${
            candidate.is_available ?? candidate.isAvailable ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
          title={candidate.is_available ?? candidate.isAvailable ? 'متاح للعمل الآن' : 'غير متاح حالياً'}
        />
      </div>

      {/* المعلومات */}
      <div 
        className="min-w-0 flex-1 cursor-pointer"
        onClick={() => onClick(candidate.id)}
      >
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-black text-slate-800 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {candidate.name}
          </p>
          <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200/50 dark:border-emerald-800/30 shrink-0">
            <CheckCircle2 size={10} className="text-emerald-500" />
            <span>مطابق للمسمى والموقع</span>
          </span>
          {(candidate.is_available ?? candidate.isAvailable) ? (
            <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
              🟢 متاح للعمل
            </span>
          ) : (
            <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700/30 shrink-0">
              ⚪ غير متاح
            </span>
          )}
        </div>

        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 truncate flex items-center gap-1 mt-0.5">
          <Briefcase size={10} className="shrink-0" />
          {candidate.title || 'باحث عن عمل'}
        </p>

        {candidate.location && (
          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 truncate flex items-center gap-1 mt-0.5">
            <MapPin size={9} className="shrink-0 text-blue-400" />
            {candidate.location}
          </p>
        )}
      </div>

      {/* أزرار الإجراءات */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick(candidate.id);
          }}
          className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-700/60 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-600 dark:text-slate-200 hover:text-blue-600 text-[10px] font-black transition-all flex items-center gap-1"
          title="عرض الملف الشخصي"
        >
          <span>الملف</span>
          <ArrowLeft size={10} />
        </button>
      </div>
    </motion.div>
  );
};

// ── المكوّن الرئيسي ──────────────────────────────────────────────
export const JobCandidatesPanel: React.FC<JobCandidatesPanelProps> = ({
  job,
  employerId,
  onUserClick,
  onStartChat,
}) => {
  const { allUsers } = useAppContext();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const PREVIEW = 4;

  const load = useCallback(async () => {
    if (!job?.title) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await profileService.fetchCandidatesForJob(
        job.title,
        job.location || '',
        employerId || '',
        20
      );

      if (data && data.length > 0) {
        setCandidates(data);
      } else if (allUsers && allUsers.length > 0) {
        // مطابقة محلية دقيقة بنفس الشروط (المسمى والموقع فقط)
        const normalizeText = (str: string): string => {
          if (!str) return '';
          return str
            .toLowerCase()
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/[ًٌٍَُِّْـ]/g, '')
            .replace(/[^a-zA-Z0-9\u0621-\u064A\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        };

        const STOP = new Set([
          'مطلوب', 'مطلوبة', 'عاجل', 'شركة', 'وظيفة', 'وظائف', 'عمل', 'موظف', 'موظفة', 'مهنة', 'فرصة',
          'في', 'من', 'على', 'عن', 'مع', 'و', 'او', 'أو', 'ل', 'ب', 'ك', 'لل', 'الي', 'إلى'
        ]);

        const normJobTitle = normalizeText(job.title || '');
        const normJobLocation = normalizeText(job.location || '');

        const titleKeywords = normJobTitle
          .split(' ')
          .map(w => w.trim())
          .filter(w => w.length >= 2 && !STOP.has(w));

        const isRemoteJob = !normJobLocation ||
          normJobLocation.includes('عن بعد') ||
          normJobLocation.includes('remote') ||
          normJobLocation.includes('اونلاين') ||
          normJobLocation.includes('الكل');

        const locTokens = normJobLocation
          .split(' ')
          .map(w => w.trim())
          .filter(w => w.length >= 2 && !STOP.has(w))
          .map(w => w.startsWith('ال') ? w.slice(2) : w);

        const localMatches = allUsers
          .filter(u => u.id !== employerId)
          .filter(u => {
            const uTitle = normalizeText(u.title || '');
            const uBio = normalizeText(u.bio || '');
            const uLoc = normalizeText(u.location || '');
            const uSkills = Array.isArray(u.skills)
              ? u.skills.map((s: string) => normalizeText(s)).join(' ')
              : normalizeText(u.skills || '');

            // 1. تطابق المسمى
            let matchesTitle = false;
            if (uTitle) {
              if (normJobTitle.includes(uTitle) || uTitle.includes(normJobTitle)) {
                matchesTitle = true;
              } else {
                for (const kw of titleKeywords) {
                  const kwClean = kw.startsWith('ال') ? kw.slice(2) : kw;
                  if (uTitle.includes(kw) || uTitle.includes(kwClean)) {
                    matchesTitle = true;
                    break;
                  }
                }
              }
            }
            if (!matchesTitle && (uSkills || uBio)) {
              for (const kw of titleKeywords) {
                if (uSkills.includes(kw) || uBio.includes(kw)) {
                  matchesTitle = true;
                  break;
                }
              }
            }
            if (!matchesTitle) return false;

            // 2. تطابق الموقع
            let matchesLocation = false;
            if (isRemoteJob) {
              matchesLocation = true;
            } else if (!uLoc) {
              matchesLocation = false;
            } else {
              const isRemoteCand = uLoc.includes('عن بعد') || uLoc.includes('remote') || uLoc.includes('اونلاين');
              if (isRemoteCand) {
                matchesLocation = true;
              } else if (normJobLocation.includes(uLoc) || uLoc.includes(normJobLocation)) {
                matchesLocation = true;
              } else {
                for (const token of locTokens) {
                  const uLocClean = uLoc.startsWith('ال') ? uLoc.slice(2) : uLoc;
                  if (uLoc.includes(token) || uLocClean.includes(token)) {
                    matchesLocation = true;
                    break;
                  }
                }
              }
            }

            return matchesLocation;
          })
          .map(u => ({
            id: u.id,
            name: u.name || 'مرشح مهني',
            avatar_url: u.avatar || '',
            title: u.title || job.title,
            location: u.location || job.location || 'غير محدد',
            is_pro: !!(u.isPro || u.is_pro),
            role: u.role
          }));

        setCandidates(localMatches.slice(0, 20));
      } else {
        setCandidates([]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [job?.id, job?.title, job?.location, employerId, allUsers]);

  useEffect(() => { load(); }, [load]);

  const displayed = expanded ? candidates : candidates.slice(0, PREVIEW);
  const hasMore = candidates.length > PREVIEW;

  return (
    <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Users size={14} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider leading-none">
                المرشحون المطابقون للوظيفة
              </p>
              <span className="text-[9px] font-black bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800/30">
                مطابقة المسمى والموقع
              </span>
            </div>
            {!loading && (
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 mt-1 leading-none">
                {candidates.length > 0
                  ? `تم العثور على ${candidates.length} مرشح يطابق المسمى والموقع في ملفه الشخصي`
                  : 'جارٍ البحث عن مرشحين مطابقين...'}
              </p>
            )}
          </div>
        </div>

        {/* Refresh */}
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-40 border border-slate-100 dark:border-slate-700"
          title="إعادة الفحص"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ─── Content ─── */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6">
          <Loader2 size={16} className="text-blue-500 animate-spin" />
          <span className="text-xs font-bold text-slate-400">جارٍ البحث في الملفات الشخصية عن المسمى والموقع...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 py-3 px-3.5 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-800/30">
          <Shield size={14} className="text-red-500 shrink-0" />
          <p className="text-[10px] font-bold text-red-600 dark:text-red-400">{error}</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <UserX size={18} className="text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 text-center">
            لم يتم العثور على باحثين يطابقون المسمى &quot;{job.title}&quot; والموقع &quot;{job.location || 'غير محدد'}&quot; حالياً
          </p>
        </div>
      ) : (
        <>
          <AnimatePresence mode="popLayout">
            <div className="space-y-2.5">
              {displayed.map((c, i) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  index={i}
                  onClick={onUserClick}
                  onStartChat={onStartChat}
                />
              ))}
            </div>
          </AnimatePresence>

          {/* Show more / less */}
          {hasMore && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full mt-3 py-2.5 flex items-center justify-center gap-1.5 text-xs font-black text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30"
            >
              {expanded ? (
                <><ChevronUp size={14} /> عرض أقل</>
              ) : (
                <><ChevronDown size={14} /> عرض بقية المرشحين ({candidates.length})</>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
};
