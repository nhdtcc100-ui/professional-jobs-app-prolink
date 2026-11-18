/**
 * 🛡️ Real-Time Security Threat Engine
 * Stores ONLY real detected threat logs from active user operations.
 * Auto-purges security logs older than 60 minutes (1-hour sliding inspection window).
 */

export type AttackType = 
  | 'BRUTE_FORCE' 
  | 'XSS_ATTACK' 
  | 'SQL_INJECTION' 
  | 'NOSQL_INJECTION' 
  | 'CODE_INJECTION' 
  | 'RATE_LIMIT_EXCEEDED' 
  | 'HEADER_TAMPERING'
  | 'DEVTOOLS_INSPECT'
  | 'DEBUGGER_TAMPERING'
  | 'SOURCE_INSPECTION'
  | 'CONSOLE_TAMPERING';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ThreatStatus = 'active' | 'blocked' | 'dismissed';

export interface ThreatLog {
  id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  ip_address: string;
  attack_type: AttackType;
  severity: Severity;
  endpoint: string;
  payload_sample: string;
  created_at: string;
  status: ThreatStatus;
  target_node: string;            // e.g. "Auth Gateway", "Search Engine", "Profile System", "Core Database"
  next_predicted_vector: string;  // e.g. "Database Exfiltration", "Session Hijack", "DoS Attack"
  target_port: number;           // 443, 5432, 6379, 80
}

const STORAGE_KEY = 'security_threat_logs_v2';
const BLOCKED_IPS_KEY = 'security_blocked_ips_v1';
const UNREAD_ALERTS_KEY = 'security_unread_alerts_v1';
const READ_ALERT_IDS_KEY = 'security_read_alert_ids_v1';
const MAX_LOGS = 500;
const RETENTION_24H_MS = 24 * 60 * 60 * 1000; // 24 Hours (1 Day retention)

export function getReadAlertIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_ALERT_IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function markAlertIdAsRead(id: string): void {
  try {
    const read = getReadAlertIds();
    if (!read.includes(id)) {
      read.push(id);
      localStorage.setItem(READ_ALERT_IDS_KEY, JSON.stringify(read.slice(-500)));
    }
  } catch {}
}

/** Helper to escape payload HTML/Scripts so it can NEVER execute as code anywhere */
export function escapeSecurityPayload(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Advanced WAF pattern matchers
const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/i,
  /<script/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /on\w+\s*=/i,                // matches onerror=, onload=, onclick=, onmouseover=, onfocus=, etc.
  /<iframe/i,
  /<svg[^>]*onload/i,
  /<embed/i,
  /<object/i,
  /<base/i,
  /<link[^>]*href/i,
  /<meta[^>]*http-equiv/i,
  /document\.(cookie|location|domain)/i,
  /window\.(location|open)/i,
  /eval\s*\(/i,
  /Function\s*\(/i,
  /setTimeout\s*\([^)]*['"`]/i,
  /setInterval\s*\([^)]*['"`]/i,
  /<img[^>]+src\s*=\s*['"]?javascript/i,
  /expression\s*\(/i
];

const SQLI_PATTERNS = [
  /union\s+select/i,
  /union\s+all\s+select/i,
  /drop\s+table/i,
  /drop\s+database/i,
  /truncate\s+table/i,
  /alter\s+table/i,
  /;\s*--/i,
  /'\s*or\s+'?1'?\s*=\s*'?1/i,
  /"\s*or\s+"?1"?\s*=\s*"?1/i,
  /'\s*or\s+true/i,
  /xp_cmdshell/i,
  /exec\s*\(/i,
  /sleep\(\d+\)/i,
  /benchmark\(\d+/i,
  /pg_sleep/i
];

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function resolveTargetNode(endpoint: string, attackType: AttackType): { node: string; nextVector: string; port: number } {
  const ep = (endpoint || '').toLowerCase();
  if (ep.includes('sentinel') || ep.includes('postgresql') || ep.includes('postgres') || ep.includes('db sentinel') || ep.includes('core database')) {
    return {
      node: 'Core Database Guard (PostgreSQL)',
      nextVector: 'تعديل وتخريب بيانات الجدول مباشرة (Direct DB Payload Injection)',
      port: 5432,
    };
  }
  if (ep.includes('auth') || ep.includes('login') || ep.includes('register') || attackType === 'BRUTE_FORCE') {
    return {
      node: 'Auth Gateway',
      nextVector: 'تجميد الحساب واستغلال بروتوكول المصادقة',
      port: 443,
    };
  }
  if (ep.includes('db') || ep.includes('postgres') || ep.includes('core')) {
    return {
      node: 'Core Database Guard (PostgreSQL)',
      nextVector: 'تعديل وتخريب بيانات الجدول مباشرة (Direct DB Payload Injection)',
      port: 5432,
    };
  }
  if (ep.includes('search') || attackType === 'SQL_INJECTION') {
    return {
      node: 'Search & Data Engine',
      nextVector: 'تسريب قواعد البيانات (Port 5432 Exfiltration)',
      port: 5432,
    };
  }
  if (ep.includes('post') || ep.includes('profile') || attackType === 'XSS_ATTACK') {
    return {
      node: 'Profile & Feed Module',
      nextVector: 'سرقة الجلسات (Session Cookie Hijacking)',
      port: 443,
    };
  }
  if (attackType === 'RATE_LIMIT_EXCEEDED') {
    return {
      node: 'Rate Limiter Cache',
      nextVector: 'حجب الخدمة (DoS Flood Attack)',
      port: 6379,
    };
  }
  return {
    node: 'API Gateway',
    nextVector: 'استكشاف الأخطاء والمسارات الخلفية',
    port: 80,
  };
}

let MEMORY_LOGS: ThreatLog[] = [];
let MEMORY_UNREAD: ThreatLog[] = [];

const SECURITY_BROADCAST_CHANNEL = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('prolink_security_channel')
  : null;

if (SECURITY_BROADCAST_CHANNEL) {
  SECURITY_BROADCAST_CHANNEL.onmessage = (e) => {
    if (e.data && e.data.id) {
      threatEngine.receiveExternalThreat(e.data);
    }
  };
}

export const threatEngine = {
  /** Purge logs older than 24 hours (1 day) */
  purgeHourlyLogs(): void {
    try {
      const logs = this._getRawLogs();
      const cutoff = Date.now() - RETENTION_24H_MS;
      const freshLogs = logs.filter(l => new Date(l.created_at).getTime() >= cutoff);
      if (freshLogs.length !== logs.length) {
        this._saveLogs(freshLogs);
      }
    } catch {}
  },

  _getRawLogs(): ThreatLog[] {
    let storageLogs: ThreatLog[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) storageLogs = JSON.parse(raw);
    } catch {}

    const map = new Map<string, ThreatLog>();
    [...MEMORY_LOGS, ...storageLogs].forEach(l => map.set(l.id, l));
    return Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /** Get active logs within the 1-hour window */
  getLogs(): ThreatLog[] {
    this.purgeHourlyLogs();
    return this._getRawLogs();
  },

  _saveLogs(logs: ThreatLog[]): void {
    MEMORY_LOGS = logs;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)));
    } catch {}
  },

  /** Log a REAL threat event */
  logThreat(threat: {
    user_id?: string;
    user_name?: string;
    user_email?: string;
    ip_address?: string;
    attack_type: AttackType;
    severity: Severity;
    endpoint: string;
    payload_sample: string;
    target_node?: string;
    next_predicted_vector?: string;
    target_port?: number;
    status?: ThreatStatus;
  }): ThreatLog {
    const resolved = resolveTargetNode(threat.endpoint, threat.attack_type);

    const log: ThreatLog = {
      id: generateUUID(),
      user_id: threat.user_id || undefined,
      user_name: threat.user_name || 'مستخدم غير موثق',
      user_email: threat.user_email || undefined,
      ip_address: threat.ip_address || '127.0.0.1 (Client)',
      attack_type: threat.attack_type,
      severity: threat.severity,
      endpoint: threat.endpoint,
      payload_sample: threat.payload_sample,
      created_at: new Date().toISOString(),
      status: threat.status || 'active',
      target_node: threat.target_node || resolved.node,
      next_predicted_vector: threat.next_predicted_vector || resolved.nextVector,
      target_port: threat.target_port || resolved.port,
    };

    MEMORY_LOGS.unshift(log);
    const logs = this.getLogs();
    this._saveLogs(logs);

    // Save to pending unread alerts queue for admin review
    this._addUnreadAlert(log);

    // 1. Broadcast locally to all other tabs/windows instantly
    if (SECURITY_BROADCAST_CHANNEL) {
      try { SECURITY_BROADCAST_CHANNEL.postMessage(log); } catch {}
    }

    // 2. Fire live event in current window for instant UI update & AlertBanner
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('SECURITY_ALERT', { detail: log }));
    }

    this._syncToSupabase(log).catch(() => {});
    return log;
  },

  receiveExternalThreat(log: ThreatLog): void {
    const readIds = getReadAlertIds();
    if (readIds.includes(log.id)) return;

    const existingInMem = MEMORY_LOGS.find(l => l.id === log.id);
    if (!existingInMem) {
      MEMORY_LOGS.unshift(log);
      this._saveLogs(this.getLogs());
    }

    const existingUnread = MEMORY_UNREAD.find(u => u.id === log.id);
    if (!existingUnread) {
      this._addUnreadAlert(log);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('SECURITY_ALERT', { detail: log }));
    }
  },

  /** Fetch real-time security threat logs directly from Supabase DB */
  async fetchLogsFromSupabase(): Promise<ThreatLog[]> {
    try {
      const { supabase } = await import('../supabase');
      const { data, error } = await (supabase as any)
        .from('security_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.warn('⚠️ [Supabase Fetch Threat Logs Alert]: لم يتم العثور على جدول security_logs في Supabase بعد:', error.message);
        return this.getLogs();
      }
      if (!data || data.length === 0) return this.getLogs();

      const remoteLogs: ThreatLog[] = data.map((row: any) => ({
        id: row.id,
        user_id: row.user_id || undefined,
        user_name: row.user_name || 'مستخدم غير موثق',
        user_email: row.user_email || undefined,
        ip_address: row.ip_address || '127.0.0.1 (Client)',
        attack_type: row.attack_type as AttackType,
        severity: row.severity as Severity,
        endpoint: row.endpoint || '/app/field',
        payload_sample: row.payload_sample || '',
        created_at: row.created_at,
        status: row.status || 'active',
        target_node: row.target_node || 'API Gateway',
        next_predicted_vector: row.next_predicted_vector || 'استكشاف الأخطاء',
        target_port: row.target_port || 443,
      }));

      // Detect brand new unread logs coming from Supabase DB that were not in memory before
      const readIds = getReadAlertIds();
      const newFromDb: ThreatLog[] = [];
      remoteLogs.forEach(rLog => {
        if (!MEMORY_LOGS.some(l => l.id === rLog.id) && !readIds.includes(rLog.id)) {
          newFromDb.push(rLog);
        }
      });

      const map = new Map<string, ThreatLog>();
      [...remoteLogs, ...MEMORY_LOGS, ...this._getRawLogs()].forEach(l => map.set(l.id, l));
      const merged = Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      MEMORY_LOGS = merged;
      this._saveLogs(merged);

      // Check for unread remote logs that Admin has not read yet
      const unreadRemote = remoteLogs.filter(l => !readIds.includes(l.id) && l.status === 'active');
      if (unreadRemote.length > 0) {
        unreadRemote.forEach(log => {
          if (!MEMORY_UNREAD.some(u => u.id === log.id)) {
            MEMORY_UNREAD.push(log);
          }
        });
        const unreadMap = new Map<string, ThreatLog>();
        [...MEMORY_UNREAD, ...unreadRemote].forEach(l => unreadMap.set(l.id, l));
        try {
          localStorage.setItem(UNREAD_ALERTS_KEY, JSON.stringify(Array.from(unreadMap.values())));
        } catch {}
      }

      // ⚡ Auto-dispatch SECURITY_ALERT event for any brand-new threat log discovered from DB!
      if (newFromDb.length > 0) {
        newFromDb.forEach(newLog => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('SECURITY_ALERT', { detail: newLog }));
          }
        });
      }

      return merged;
    } catch {
      return this.getLogs();
    }
  },

  _addUnreadAlert(log: ThreatLog): void {
    MEMORY_UNREAD.unshift(log);
    try {
      const unread = this.getUnreadAlerts();
      const map = new Map<string, ThreatLog>();
      [log, ...MEMORY_UNREAD, ...unread].forEach(l => map.set(l.id, l));
      const merged = Array.from(map.values());
      localStorage.setItem(UNREAD_ALERTS_KEY, JSON.stringify(merged.slice(0, 50)));
    } catch {}
  },

  getUnreadAlerts(): ThreatLog[] {
    let storageUnread: ThreatLog[] = [];
    try {
      const raw = localStorage.getItem(UNREAD_ALERTS_KEY);
      if (raw) storageUnread = JSON.parse(raw);
    } catch {}
    const readIds = getReadAlertIds();
    const map = new Map<string, ThreatLog>();
    [...MEMORY_UNREAD, ...storageUnread]
      .filter(l => !readIds.includes(l.id))
      .forEach(l => map.set(l.id, l));
    return Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  markAlertAsRead(id: string): void {
    markAlertIdAsRead(id);
    MEMORY_UNREAD = MEMORY_UNREAD.filter(a => a.id !== id);
    try {
      const unread = this.getUnreadAlerts().filter(a => a.id !== id);
      localStorage.setItem(UNREAD_ALERTS_KEY, JSON.stringify(unread));
    } catch {}
  },

  markAllAlertsAsRead(): void {
    this.getUnreadAlerts().forEach(a => markAlertIdAsRead(a.id));
    MEMORY_UNREAD = [];
    try {
      localStorage.removeItem(UNREAD_ALERTS_KEY);
    } catch {}
  },

  async _syncToSupabase(log: ThreatLog): Promise<void> {
    try {
      const { supabase } = await import('../supabase');
      const db = supabase as any;
      const { error } = await db.from('security_logs').insert([{
        id: log.id,
        user_id: log.user_id || null,
        user_name: log.user_name || 'مستخدم النظام',
        user_email: log.user_email || null,
        ip_address: log.ip_address,
        attack_type: log.attack_type,
        severity: log.severity,
        endpoint: log.endpoint,
        payload_sample: escapeSecurityPayload(log.payload_sample),
        created_at: log.created_at,
        target_node: log.target_node,
        next_predicted_vector: log.next_predicted_vector,
        target_port: log.target_port,
      }]);
      if (error) {
        console.warn('⚠️ [Supabase Security Sync Alert]: فشل الحفظ في Supabase - تأكد من تنفيذ كويري إنشاء جدول security_logs:', error.message);
      }
    } catch (e: any) {
      console.warn('⚠️ [Supabase Security Sync Error]:', e?.message || e);
    }
  },

  scanForXSS(input: string): { detected: boolean; pattern?: string } {
    if (!input) return { detected: false };
    for (const p of XSS_PATTERNS) {
      if (p.test(input)) return { detected: true, pattern: p.toString() };
    }
    return { detected: false };
  },

  scanForSQLi(input: string): { detected: boolean; pattern?: string } {
    if (!input) return { detected: false };
    for (const p of SQLI_PATTERNS) {
      if (p.test(input)) return { detected: true, pattern: p.toString() };
    }
    return { detected: false };
  },

  getBlockedIPs(): string[] {
    try {
      const raw = localStorage.getItem(BLOCKED_IPS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  blockIP(ip: string): void {
    const blocked = this.getBlockedIPs();
    if (!blocked.includes(ip)) {
      blocked.push(ip);
      localStorage.setItem(BLOCKED_IPS_KEY, JSON.stringify(blocked));
    }
    this._saveLogs(
      this.getLogs().map(l => l.ip_address === ip ? { ...l, status: 'blocked' as ThreatStatus } : l)
    );
  },

  unblockIP(ip: string): void {
    localStorage.setItem(BLOCKED_IPS_KEY, JSON.stringify(this.getBlockedIPs().filter(b => b !== ip)));
  },

  dismissThreat(id: string): void {
    this._saveLogs(
      this.getLogs().map(l => l.id === id ? { ...l, status: 'dismissed' as ThreatStatus } : l)
    );
  },

  getTodayCount(): number {
    return this.getLogs().length;
  },

  getCriticalCount(): number {
    return this.getLogs().filter(l => l.severity === 'CRITICAL').length;
  },

  getTopActor(): { identifier: string; count: number } | null {
    const tally: Record<string, number> = {};
    this.getLogs()
      .filter(l => l.status !== 'dismissed')
      .forEach(l => {
        const k = l.user_name || l.user_email || l.ip_address;
        tally[k] = (tally[k] || 0) + 1;
      });
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? { identifier: sorted[0][0], count: sorted[0][1] } : null;
  },

  getHourlyDistribution(): { hour: number; count: number; label: string }[] {
    const now = Date.now();
    const buckets: Record<number, number> = {};
    for (let i = 0; i < 24; i++) buckets[i] = 0;
    this.getLogs()
      .filter(l => now - new Date(l.created_at).getTime() <= RETENTION_24H_MS)
      .forEach(l => { buckets[new Date(l.created_at).getHours()]++; });
    return Object.entries(buckets).map(([h, count]) => ({
      hour: +h,
      count,
      label: h.toString().padStart(2, '0') + ':00',
    }));
  },

  /** Kept as no-op to satisfy backward compatibility */
  seedDemoData(): void {
    // Demo data disabled: Only real user threat events are logged
  },

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};

// ── Cross-Tab & Cross-Device Real-Time Security Sync ─────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const logs: ThreatLog[] = JSON.parse(e.newValue);
        if (logs.length > 0) {
          const latestLog = logs[0];
          window.dispatchEvent(new CustomEvent('SECURITY_ALERT', { detail: latestLog }));
        }
      } catch {}
    }
  });

  // Supabase Real-Time Listener for Multi-User & Multi-Device Threats
  import('../supabase').then(({ supabase }) => {
    supabase
      .channel('public:security_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'security_logs' },
        (payload) => {
          if (payload.new && payload.new.id) {
            const row = payload.new;
            const log: ThreatLog = {
              id: row.id,
              user_id: row.user_id || undefined,
              user_name: row.user_name || 'مستخدم خارجي',
              user_email: row.user_email || undefined,
              ip_address: row.ip_address || 'Remote User',
              attack_type: row.attack_type || 'XSS_ATTACK',
              severity: row.severity || 'HIGH',
              endpoint: row.endpoint || '/app',
              payload_sample: row.payload_sample || '',
              created_at: row.created_at || new Date().toISOString(),
              status: 'active',
              target_node: row.target_node || 'API Gateway',
              next_predicted_vector: row.next_predicted_vector || 'استكشاف الأخطاء',
              target_port: row.target_port || 443,
            };
            threatEngine.receiveExternalThreat(log);
          }
        }
      )
      .subscribe();
  }).catch(() => {});
}

