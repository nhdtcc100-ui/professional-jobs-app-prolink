import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp, Users, CheckCircle, XCircle, Clock,
  Briefcase, Star, BarChart2, Award, Target
} from 'lucide-react';
import { SkeletonStatCard } from '../../ui';

interface AnalyticsDashboardProps {
  incomingApplications: any[];
  myPostedJobs: any[];
  loading?: boolean;
}

// Simple bar chart using pure CSS
function MiniBarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(d.value / max) * 100}%` }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 200 }}
            className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg min-h-[4px] relative group"
          >
            {d.value > 0 && (
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-black text-blue-700 dark:text-blue-300 opacity-0 group-hover:opacity-100 transition-all bg-white dark:bg-slate-800 px-1 rounded-md shadow-sm">
                {d.value}
              </span>
            )}
          </motion.div>
          <span className="text-[8px] font-bold text-slate-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// Donut-style stat pill
function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</span>
      </div>
      <span className="text-xs font-black text-slate-800 dark:text-white">{value}</span>
    </div>
  );
}

export function AnalyticsDashboard({ incomingApplications, myPostedJobs, loading }: AnalyticsDashboardProps) {
  const stats = useMemo(() => {
    const total = incomingApplications.length;
    const approved = incomingApplications.filter(a => a.status === 'approved').length;
    const rejected = incomingApplications.filter(a => a.status === 'rejected').length;
    const pending = incomingApplications.filter(a => a.status === 'pending').length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    // Applications per job
    const perJob = myPostedJobs.map(job => ({
      label: job.title.length > 8 ? job.title.slice(0, 8) + '…' : job.title,
      fullLabel: job.title,
      value: incomingApplications.filter(a => a.job_id === job.id).length,
    })).sort((a, b) => b.value - a.value);

    // Weekly trend (last 7 days)
    const days = ['أحد', 'اثن', 'ثلا', 'أرب', 'خمس', 'جمع', 'سبت'];
    const weeklyData = days.map((label, i) => {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - (6 - i));
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const value = incomingApplications.filter(a => {
        const d = new Date(a.created_at);
        return d >= dayStart && d <= dayEnd;
      }).length;
      return { label, value };
    });

    // Avg experience (from applicant_data)
    const expValues = incomingApplications
      .map(a => parseInt(a.applicant_data?.experience) || 0)
      .filter(v => v > 0);
    const avgExp = expValues.length > 0 ? (expValues.reduce((s, v) => s + v, 0) / expValues.length).toFixed(1) : '—';

    return { total, approved, rejected, pending, approvalRate, perJob, weeklyData, avgExp };
  }, [incomingApplications, myPostedJobs]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
    );
  }

  const kpiCards = [
    {
      icon: Users,
      label: 'إجمالي الطلبات',
      value: stats.total,
      sub: 'طلب تقديم وارد',
      color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
      valueBg: 'text-blue-700 dark:text-blue-300',
    },
    {
      icon: Target,
      label: 'معدل القبول',
      value: `${stats.approvalRate}%`,
      sub: `${stats.approved} مقبول من ${stats.total}`,
      color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
      valueBg: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      icon: Briefcase,
      label: 'الوظائف المنشورة',
      value: myPostedJobs.length,
      sub: 'وظيفة نشطة',
      color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600',
      valueBg: 'text-violet-700 dark:text-violet-300',
    },
    {
      icon: Award,
      label: 'متوسط الخبرة',
      value: stats.avgExp === '—' ? '—' : `${stats.avgExp}س`,
      sub: 'سنوات لدى المتقدمين',
      color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
      valueBg: 'text-amber-700 dark:text-amber-300',
    },
  ];

  return (
    <div className="space-y-5 pb-4" dir="rtl">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="bg-white dark:bg-slate-800 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-700 space-y-3"
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${card.color}`}>
                <Icon size={18} />
              </div>
              <div>
                <p className={`text-2xl font-black ${card.valueBg}`}>{card.value}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{card.label}</p>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">{card.sub}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weekly Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp size={15} className="text-blue-600" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-700 dark:text-white">الطلبات الأسبوعية</h4>
              <p className="text-[9px] text-slate-400 font-bold">آخر 7 أيام</p>
            </div>
          </div>
          <MiniBarChart data={stats.weeklyData} />
        </motion.div>

        {/* Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-violet-50 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
              <BarChart2 size={15} className="text-violet-600" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-700 dark:text-white">توزيع الحالات</h4>
              <p className="text-[9px] text-slate-400 font-bold">{stats.total} طلب إجمالي</p>
            </div>
          </div>

          {stats.total === 0 ? (
            <div className="py-8 text-center opacity-40">
              <BarChart2 size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-bold text-slate-400">لا توجد بيانات بعد</p>
            </div>
          ) : (
            <div className="space-y-1">
              <StatPill label="مقبول" value={stats.approved} color="bg-emerald-500" />
              <StatPill label="قيد المراجعة" value={stats.pending} color="bg-amber-400" />
              <StatPill label="مرفوض" value={stats.rejected} color="bg-red-400" />
              {/* Visual bar */}
              <div className="mt-5 h-4 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex shadow-inner border border-slate-50 dark:border-slate-800">
                {stats.approved > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.approved / stats.total) * 100}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 relative group"
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                )}
                {stats.pending > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.pending / stats.total) * 100}%` }}
                    transition={{ duration: 1, delay: 0.1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-amber-300 to-amber-500 relative group"
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                )}
                {stats.rejected > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.rejected / stats.total) * 100}%` }}
                    transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-rose-400 to-rose-600 relative group"
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Top Jobs */}
      {stats.perJob.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              <Star size={15} className="text-amber-500" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-700 dark:text-white">أكثر الوظائف طلباً</h4>
              <p className="text-[9px] text-slate-400 font-bold">مرتبة حسب عدد التقديمات</p>
            </div>
          </div>
          <div className="space-y-3">
            {stats.perJob.slice(0, 5).map((job, i) => {
              const maxVal = stats.perJob[0]?.value || 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                    i === 0 ? 'bg-amber-500 text-white' :
                    i === 1 ? 'bg-slate-300 text-white' :
                    i === 2 ? 'bg-orange-400 text-white' :
                    'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{job.fullLabel}</p>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(job.value / maxVal) * 100}%` }}
                      transition={{ delay: 0.4 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                      className="h-1 bg-blue-400 dark:bg-blue-500 rounded-full mt-1 min-w-[4px]"
                    />
                  </div>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 shrink-0">{job.value}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
