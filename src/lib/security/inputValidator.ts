import { threatEngine, AttackType, Severity } from './threatEngine';

export type IdentifierType = "email" | "phone" | "unknown";

export const detectIdentifierType = (input: string): IdentifierType => {
  if (!input || !input.trim()) return "unknown";
  const clean = input.trim();
  if (clean.includes("@")) return "email";
  if (/^[\d\+\-\s\(\)]+$/.test(clean) && clean.replace(/\D/g, "").length >= 7) return "phone";
  return "unknown";
};

export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return digits;
  if (digits.startsWith("964")) return "0" + digits.slice(3);
  return digits;
};

export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  if (!email || !email.trim()) return { valid: false, error: "البريد الإلكتروني مطلوب" };
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: "صيغة البريد الإلكتروني غير صحيحة" };
  }
  if (email.length > 255) return { valid: false, error: "البريد الإلكتروني طويل جداً" };
  return { valid: true };
};

export const validatePhone = (phone: string): { valid: boolean; error?: string } => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return { valid: false, error: "رقم الهاتف يجب أن يتكون من 10 إلى 15 رقم" };
  }
  return { valid: true };
};

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  hints: string[];
}



export const checkPasswordStrength = (pass: string): PasswordStrength => {
  const hints: string[] = [];
  let score = 0;
  if (pass.length >= 8) score++; else hints.push("8 أحرف على الأقل");
  if (/[A-Z]/.test(pass)) score++; else hints.push("حرف كبير واحد على الأقل");
  if (/[0-9]/.test(pass)) score++; else hints.push("رقم واحد على الأقل");
  if (/[^A-Za-z0-9]/.test(pass)) score++; else hints.push("رمز خاص (!@#$...)");
  const labels = ["ضعيف جداً", "ضعيف", "متوسط", "قوي", "قوي جداً"];
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];
  return { score: score as PasswordStrength["score"], label: labels[score], color: colors[score], hints };
};

export const validatePassword = (pass: string): { valid: boolean; error?: string } => {
  if (!pass || pass.length < 8) {
    return { valid: false, error: "كلمة السر يجب أن تكون 8 أحرف على الأقل" };
  }
  return { valid: true };
};

export const sanitizeInput = (
  input: string, 
  maxLengthOrUser?: number | { id?: string; name?: string; email?: string },
  userObj?: { id?: string; name?: string; email?: string }
): string => {
  if (!input) return "";

  const maxLength = typeof maxLengthOrUser === 'number' ? maxLengthOrUser : 500;
  const user = typeof maxLengthOrUser === 'object' ? maxLengthOrUser : userObj;

  // Perform WAF threat scanning on raw input
  const xssRes = threatEngine.scanForXSS(input);
  if (xssRes.detected) {
    threatEngine.logThreat({
      user_id: user?.id,
      user_name: user?.name || 'مستخدم النظام',
      user_email: user?.email,
      attack_type: 'XSS_ATTACK',
      severity: 'HIGH',
      endpoint: typeof window !== 'undefined' ? window.location.pathname : '/app/input',
      payload_sample: input.slice(0, 150),
    });
  }

  const sqliRes = threatEngine.scanForSQLi(input);
  if (sqliRes.detected) {
    threatEngine.logThreat({
      user_id: user?.id,
      user_name: user?.name || 'مستخدم النظام',
      user_email: user?.email,
      attack_type: 'SQL_INJECTION',
      severity: 'CRITICAL',
      endpoint: typeof window !== 'undefined' ? window.location.pathname : '/app/input',
      payload_sample: input.slice(0, 150),
    });
  }

  return input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .slice(0, maxLength);
};

export const sanitizeComment = (
  text: string, 
  user?: { id?: string; name?: string; email?: string }
): string => {
  if (!text) return "";
  const xssRes = threatEngine.scanForXSS(text);
  if (xssRes.detected) {
    threatEngine.logThreat({
      user_id: user?.id,
      user_name: user?.name || 'مستخدم النظام',
      user_email: user?.email,
      attack_type: 'XSS_ATTACK',
      severity: 'HIGH',
      endpoint: '/api/comments',
      payload_sample: text.slice(0, 150),
    });
  }
  return text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>/g, "").trim().slice(0, 2000);
};

// ─────────────────────────────────────────────────────────────────────────────
// validateName — فحص أمني متكامل لحقل الاسم
// يكشف أنماط HTML/JS/PHP/Python/SQL/Shell الخبيثة ويبلغ عنها
// ─────────────────────────────────────────────────────────────────────────────

export interface NameValidationResult {
  valid: boolean;
  error?: string;       // رسالة عربية للمستخدم
  threat?: string;      // وصف الهجمة للـ Dashboard
  attackType?: AttackType;
  severity?: Severity;
}

/** قائمة الأنماط المحظورة لكافة مدخلات المنصة (XSS, Code, SQL, MongoDB) */
const GLOBAL_THREAT_PATTERNS: Array<{
  regex: RegExp;
  label: string;
  attackType: AttackType;
  severity: Severity;
}> = [
  // ── MongoDB / NoSQL Injection ──────────────────────────────────────────
  { regex: /\$(where|expr|gt|gte|lt|lte|ne|nin|regex|text|mod|all|elemMatch|exists)\b/i, label: 'MongoDB NoSQL Operator Injection', attackType: 'NOSQL_INJECTION', severity: 'CRITICAL' },
  { regex: /db\s*\.\s*[a-zA-Z_0-9$]+/i,                                                   label: 'MongoDB DB Collection/Command Access', attackType: 'NOSQL_INJECTION', severity: 'CRITICAL' },
  { regex: /ObjectId\s*\(/i,                                                              label: 'MongoDB ObjectId Injection',   attackType: 'NOSQL_INJECTION', severity: 'HIGH' },

  // ── XSS / HTML Tag & Script Injection ─────────────────────────────────────
  { regex: /<script[^>]*>/i,          label: '<script> Tag Injection',     attackType: 'XSS_ATTACK',      severity: 'CRITICAL' },
  { regex: /<\/script>/i,             label: '</script> Closing Tag',      attackType: 'XSS_ATTACK',      severity: 'CRITICAL' },
  { regex: /<[a-z1-6][^>]*>/i,        label: 'HTML Element Tag (<tag>)',   attackType: 'XSS_ATTACK',      severity: 'HIGH' },
  { regex: /<\/[a-z1-6]+>/i,          label: 'HTML Closing Tag (</tag>)',  attackType: 'XSS_ATTACK',      severity: 'HIGH' },
  { regex: /javascript\s*:/i,         label: 'javascript: Protocol',       attackType: 'XSS_ATTACK',      severity: 'CRITICAL' },
  { regex: /vbscript\s*:/i,           label: 'vbscript: Protocol',         attackType: 'XSS_ATTACK',      severity: 'CRITICAL' },
  { regex: /data\s*:\s*text\/html/i,  label: 'data:text/html URI',         attackType: 'XSS_ATTACK',      severity: 'CRITICAL' },
  { regex: /on\w+\s*=/i,              label: 'DOM Event Handler (onerror/onload...)', attackType: 'XSS_ATTACK', severity: 'CRITICAL' },
  { regex: /expression\s*\(/i,        label: 'CSS Expression Injection',   attackType: 'XSS_ATTACK',      severity: 'HIGH' },

  // ── JavaScript / Node.js Code Execution ─────────────────────────────────
  { regex: /eval\s*\(/i,              label: 'eval() Call',                attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },
  { regex: /Function\s*\(/i,          label: 'Function() Constructor',     attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },
  { regex: /document\s*\.\s*(cookie|location|domain|write)/i, label: 'document.* Access', attackType: 'XSS_ATTACK', severity: 'CRITICAL' },
  { regex: /window\s*\.\s*(location|open|eval)/i,             label: 'window.* Access',   attackType: 'XSS_ATTACK', severity: 'HIGH' },
  { regex: /process\s*\.\s*env/i,     label: 'process.env Access',         attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },
  { regex: /__proto__/i,              label: 'Prototype Pollution',        attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },
  { regex: /require\s*\(/i,           label: 'require() Call',             attackType: 'CODE_INJECTION',  severity: 'HIGH' },

  // ── PHP Injection ─────────────────────────────────────────────────────────
  { regex: /<\?php/i,                 label: 'PHP Open Tag (<?php)',       attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },
  { regex: /<\?=/i,                   label: 'PHP Short Echo Tag (<?=)',   attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },
  { regex: /system\s*\(/i,            label: 'PHP system() Call',          attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },
  { regex: /shell_exec/i,             label: 'PHP shell_exec()',           attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },
  { regex: /passthru/i,               label: 'PHP passthru()',             attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },
  { regex: /exec\s*\(/i,              label: 'exec() Call',                attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },

  // ── Python / Shell Injection ─────────────────────────────────────────────
  { regex: /import\s+[a-zA-Z_]\w*/i, label: 'Python import Statement',    attackType: 'CODE_INJECTION',  severity: 'HIGH' },
  { regex: /__import__/i,             label: 'Python __import__()',        attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },
  { regex: /subprocess/i,             label: 'Python subprocess Module',   attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },
  { regex: /os\s*\.\s*(system|popen|execv)/i, label: 'Python os.system/popen', attackType: 'CODE_INJECTION', severity: 'CRITICAL' },
  { regex: /\$\(/,                    label: 'Shell Command Substitution', attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },
  { regex: /`[\s\S]*?`/,             label: 'Backtick Shell Execution',   attackType: 'CODE_INJECTION',  severity: 'CRITICAL' },

  // ── SQL Injection ─────────────────────────────────────────────────────────
  { regex: /union\s+(all\s+)?select/i,     label: 'UNION SELECT Attack',   attackType: 'SQL_INJECTION',   severity: 'CRITICAL' },
  { regex: /drop\s+(table|database)/i,     label: 'DROP TABLE/DATABASE',   attackType: 'SQL_INJECTION',   severity: 'CRITICAL' },
  { regex: /truncate\s+table/i,            label: 'TRUNCATE TABLE',        attackType: 'SQL_INJECTION',   severity: 'CRITICAL' },
  { regex: /select\s+[\s\S]+\s+from/i,     label: 'SELECT ... FROM Statement', attackType: 'SQL_INJECTION', severity: 'HIGH' },
  { regex: /insert\s+into/i,               label: 'INSERT INTO Statement', attackType: 'SQL_INJECTION',   severity: 'HIGH' },
  { regex: /delete\s+from/i,               label: 'DELETE FROM Statement', attackType: 'SQL_INJECTION',   severity: 'CRITICAL' },
  { regex: /'?\s*or\s+'?1'?\s*=\s*'?1/i,  label: "OR '1'='1' Bypass",     attackType: 'SQL_INJECTION',   severity: 'CRITICAL' },
  { regex: /;\s*--/,                       label: 'SQL Comment Injection',  attackType: 'SQL_INJECTION',   severity: 'HIGH' },
  { regex: /xp_cmdshell/i,                label: 'xp_cmdshell RCE',        attackType: 'SQL_INJECTION',   severity: 'CRITICAL' },
  { regex: /sleep\s*\(\s*\d+/i,           label: 'SQL Blind Time Attack',  attackType: 'SQL_INJECTION',   severity: 'HIGH' },
];

/**
 * validateName — التحقق من سلامة الاسم المدخل
 */
export const validateName = (
  name: string,
  user?: { id?: string; name?: string; email?: string },
  endpoint = '/app/name-field'
): NameValidationResult => {
  if (!name || !name.trim()) {
    return { valid: false, error: 'الاسم مطلوب' };
  }

  if (name.trim().length < 2) {
    return { valid: false, error: 'الاسم يجب أن يكون حرفين على الأقل' };
  }

  if (name.trim().length > 100) {
    return { valid: false, error: 'الاسم طويل جداً (الحد الأقصى 100 حرف)' };
  }

  for (const { regex, label, attackType, severity } of GLOBAL_THREAT_PATTERNS) {
    if (regex.test(name)) {
      threatEngine.logThreat({
        user_id:       user?.id,
        user_name:     user?.name || name.slice(0, 50),
        user_email:    user?.email,
        attack_type:   attackType,
        severity:      severity,
        endpoint:      endpoint,
        payload_sample: `[NAME FIELD] ${name.slice(0, 150)}  →  Pattern: ${label}`,
      });

      return {
        valid: false,
        error: '🚨 يحتوي الاسم على رموز أو كلمات محظورة. يُرجى إدخال اسمك الحقيقي فقط.',
        threat: label,
        attackType,
        severity,
      };
    }
  }

  return { valid: true };
};

export interface FieldValidationResult {
  valid: boolean;
  error?: string;
  threat?: string;
  attackType?: AttackType;
  severity?: Severity;
}

/**
 * validateField — كاشف موحد شامل لكافة مدخلات التطبيق
 * (الرسائل، البحث، الملف الشخصي، الوظائف، المنشورات والتعليقات)
 */
export const validateField = (
  value: string,
  fieldLabel: string,
  user?: { id?: string; name?: string; email?: string },
  endpoint = '/app/field'
): FieldValidationResult => {
  if (!value || !value.trim()) {
    return { valid: true };
  }

  // 🔒 For chat messages, only block actual malicious script tags / javascript protocols, never block conversational text
  if (endpoint.includes('/chat') || fieldLabel.includes('رسالة')) {
    if (/<script[^>]*>/i.test(value) || /javascript\s*:/i.test(value)) {
      return {
        valid: false,
        error: `🚨 يحتوي حقل "${fieldLabel}" على كود محظور.`
      };
    }
    return { valid: true };
  }

  for (const { regex, label, attackType, severity } of GLOBAL_THREAT_PATTERNS) {
    if (regex.test(value)) {
      threatEngine.logThreat({
        user_id:       user?.id,
        user_name:     user?.name || 'مستخدم النظام',
        user_email:    user?.email,
        attack_type:   attackType,
        severity:      severity,
        endpoint:      `${endpoint} [${fieldLabel}]`,
        payload_sample: `[${fieldLabel}] ${value.slice(0, 150)}  →  Pattern: ${label}`,
      });

      return {
        valid: false,
        error: `🚨 يحتوي حقل "${fieldLabel}" على رموز أو كودات محظورة (${label}).`,
        threat: label,
        attackType,
        severity,
      };
    }
  }

  return { valid: true };
};

