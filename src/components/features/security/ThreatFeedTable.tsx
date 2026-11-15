import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Ban, Eye, CheckCircle2, Filter } from 'lucide-react';
import { threatEngine, ThreatLog, AttackType, Severity } from '../../../lib/security/threatEngine';

const SEVERITY_CONFIG: Record<Severity, { label: string; className: string; dot: string }> = {
  CRITICAL: { label: 'حرج', className: 'bg-red-500/20 text-red-400 border border-red-500/40', dot: 'bg-red-500' },
  HIGH:     { label: 'عالٍ',  className: 'bg-orange-500/20 text-orange-400 border border-orange-500/40', dot: 'bg-orange-500' },
  MEDIUM:   { label: 'متوسط', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40', dot: 'bg-yellow-500' },
  LOW:      { label: 'منخفض', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/40', dot: 'bg-blue-500' },
};

const ATTACK_LABELS: Record<AttackType, { label: string; emoji: string }> = {
  BRUTE_FORCE:          { label: 'قوة غاشمة',       emoji: '🔨' },
  XSS_ATTACK:           { label: 'حقن XSS',          emoji: '💉' },
  SQL_INJECTION:        { label: 'حقن SQL',           emoji: '🗃️' },
  NOSQL_INJECTION:      { label: 'حقن MongoDB',       emoji: '🍃' },
  CODE_INJECTION:       { label: 'حقن كود برمجي',    emoji: '🐛' },
  RATE_LIMIT_EXCEEDED:  { label: 'تجاوز المعدل',     emoji: '⚡' },
  HEADER_TAMPERING:     { label: 'تلاعب بالترويسة',  emoji: '🧩' },
  DEVTOOLS_INSPECT:     { label: 'فحص DevTools',     emoji: '🔍' },
  DEBUGGER_TAMPERING:   { label: 'تتبع Debugger',    emoji: '🛑' },
  SOURCE_INSPECTION:    { label: 'سحب السورس كود',   emoji: '📜' },
  CONSOLE_TAMPERING:    { label: 'تلاعب بالكونسول',  emoji: '💻' },
};

type FilterType = 'all' | AttackType | 'critical' | 'db_sentinel';

interface ThreatFeedTableProps {
  addToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const ThreatFeedTable: React.FC<ThreatFeedTableProps> = ({ addToast }) => {
  const [logs, setLogs] = useState<ThreatLog[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    const fetched = await threatEngine.fetchLogsFromSupabase();
    setLogs(fetched);
    setTimeout(() => setIsRefreshing(false), 400);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    const handleAlert = () => refresh();
    window.addEventListener('SECURITY_ALERT', handleAlert);
    window.addEventListener('storage', handleAlert);
    return () => {
      clearInterval(interval);
      window.removeEventListener('SECURITY_ALERT', handleAlert);
      window.removeEventListener('storage', handleAlert);
    };
  }, [refresh]);

  const filteredLogs = logs.filter(l => {
    if (filter === 'all') return true;
    if (filter === 'critical') return l.severity === 'CRITICAL';
    if (filter === 'db_sentinel') return l.endpoint?.toLowerCase().includes('sentinel') || l.endpoint?.toLowerCase().includes('postgresql') || l.target_node?.includes('Database');
    return l.attack_type === filter;
  });

  const handleBlockIP = (log: ThreatLog) => {
    threatEngine.blockIP(log.ip_address);
    addToast(`تم حظر IP: ${log.ip_address} 🚫`, 'success');
    refresh();
  };

  const handleDismiss = (log: ThreatLog) => {
    threatEngine.dismissThreat(log.id);
    addToast('تم تجاهل التهديد', 'success');
    refresh();
  };

  const FILTERS: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'critical', label: '🔴 الحرجة' },
    { id: 'db_sentinel', label: '🗃️ تهديدات قاعدة البيانات (PostgreSQL)' },
    { id: 'BRUTE_FORCE', label: '🔨 قوة غاشمة' },
    { id: 'XSS_ATTACK', label: '💉 XSS' },
    { id: 'SQL_INJECTION', label: '🗃️ SQL Injection' },
    { id: 'RATE_LIMIT_EXCEEDED', label: '⚡ Rate Limit' },
  ];

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  };

  const STATUS_COLORS: Record<string, string> = {
    active: 'text-red-400',
    blocked: 'text-orange-400',
    dismissed: 'text-slate-500',
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] shadow-2xl backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-slate-700/50">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">سجل التهديدات الحي من الأنشطة الحقيقية</h3>
            <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              نافذة فحص 60 دقيقة
            </span>
          </div>
          <p className="text-[9px] text-slate-500 mt-0.5 uppercase tracking-widest">
            {filteredLogs.length} تهديد مرصود • تُحذف التهديدات التلقائية كل 60 دقيقة وتُجدّد المراقبة آلياً
          </p>
        </div>
        <button
          onClick={refresh}
          className="p-2.5 rounded-xl bg-slate-700/60 border border-slate-600/50 text-slate-400 hover:text-blue-400 transition-all active:scale-95"
        >
          <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 1-Hour Auto Purge Banner */}
      <div className="px-8 py-2.5 bg-blue-950/30 border-b border-blue-900/40 flex items-center justify-between text-[9px] font-bold text-blue-300">
        <span>⏱️ سياسة الاحتفاظ بالملاحظات الأمنية: يتم مسح السجلات تلقائياً بعد مرور 24 ساعة لبدء دورة فحص جديدة.</span>
        <span className="font-mono text-blue-400">24-Hour Retention Active</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-8 py-4 overflow-x-auto no-scrollbar border-b border-slate-800/60">
        <Filter size={13} className="text-slate-500 flex-shrink-0 mt-1" />
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-[10px] font-black transition-all ${
              filter === f.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800/60">
              {['الوقت', 'المستخدم / الـ IP', 'نوع الهجمة', 'العقدة المستهدفة', 'البورت', 'الخطورة', 'المسار التوقعي التالي', 'الحالة', 'الإجراءات'].map(h => (
                <th key={h} className="px-4 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filteredLogs.slice(0, 20).map((log, i) => {
                const sev = SEVERITY_CONFIG[log.severity];
                const atk = ATTACK_LABELS[log.attack_type] || { label: log.attack_type, emoji: '⚠️' };
                const isBlocked = threatEngine.getBlockedIPs().includes(log.ip_address);
                return (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors ${log.status === 'dismissed' ? 'opacity-40' : ''}`}
                  >
                    {/* Time */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <p className="text-[10px] font-black text-slate-300">{formatTime(log.created_at)}</p>
                      <p className="text-[9px] text-slate-600">{formatDate(log.created_at)}</p>
                    </td>
                    {/* User / IP */}
                    <td className="px-4 py-3.5 text-right">
                      <p className="text-[10px] font-bold text-white truncate max-w-[130px]">{log.user_name || 'مستخدم غير موثق'}</p>
                      <p className="text-[9px] font-mono text-slate-400">{log.ip_address}</p>
                    </td>
                    {/* Attack type */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className="text-[10px] font-black text-slate-300">{atk.emoji} {atk.label}</span>
                    </td>
                    {/* Target Node */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg">
                        {log.target_node}
                      </span>
                    </td>
                    {/* Port */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className="text-[9px] font-mono font-black text-amber-400">
                        PORT {log.target_port || 443}
                      </span>
                    </td>
                    {/* Severity badge */}
                    <td className="px-4 py-3.5 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black ${sev.className}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sev.dot} ${log.severity === 'CRITICAL' ? 'animate-pulse' : ''}`} />
                        {sev.label}
                      </span>
                    </td>
                    {/* Next Predicted Vector */}
                    <td className="px-4 py-3.5 text-right max-w-[150px]">
                      <p className="text-[9px] font-bold text-amber-300 truncate">{log.next_predicted_vector}</p>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className={`text-[9px] font-black uppercase ${STATUS_COLORS[log.status]}`}>
                        {log.status === 'active' ? 'نشط' : log.status === 'blocked' ? 'محظور' : 'مُتجاهل'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      {log.status !== 'dismissed' && (
                        <div className="flex items-center gap-1.5 justify-end">
                          {!isBlocked && (
                            <button
                              onClick={() => handleBlockIP(log)}
                              title="حظر IP"
                              className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 flex items-center justify-center transition-all active:scale-90"
                            >
                              <Ban size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDismiss(log)}
                            title="تجاهل"
                            className="w-7 h-7 rounded-lg bg-slate-700/60 text-slate-400 hover:bg-slate-600/60 flex items-center justify-center transition-all active:scale-90"
                          >
                            <CheckCircle2 size={12} />
                          </button>
                          <button
                            title="عرض عينة الحمولة"
                            onClick={() => addToast(log.payload_sample, 'error')}
                            className="w-7 h-7 rounded-lg bg-slate-700/60 text-slate-400 hover:bg-slate-600/60 flex items-center justify-center transition-all active:scale-90"
                          >
                            <Eye size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>

        {filteredLogs.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">🛡️</p>
            <p className="text-sm font-black text-slate-400">لا توجد محاولات هجوم مرصودة حالياً</p>
            <p className="text-[10px] text-slate-600 mt-1">تتم المراقبة المباشرة من المستخدمين وتحديث الفحص آلياً كل ساعة</p>
          </div>
        )}
      </div>
    </div>
  );
};


