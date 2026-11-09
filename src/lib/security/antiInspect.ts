/**
 * 🛡️ Anti-Inspect & Anti-Tampering Security Shield
 * Protects ProLink web and mobile app from DevTools, Inspect Element,
 * Debugger traps, View Source shortcuts, and Console Code Injection.
 * 
 * ✅ ADMIN EXEMPTION:
 * Administrators (isAdmin / is_admin / nhdtcc100@gmail.com) have full unrestricted
 * access to Inspect Element, DevTools, Console, and shortcuts for debugging and development.
 * All regular users and visitors remain strictly blocked and monitored.
 */

import { threatEngine } from './threatEngine';
import { AppUser } from '../../types';

let isShieldActive = false;
let lastAlertTimestamp = 0;
const ALERT_COOLDOWN_MS = 20000; // 20s cooldown between spam alerts
let currentUser: AppUser | null = null;

/** Checks if the current user is an authorized Administrator */
export function isUserAdmin(user: AppUser | null = currentUser): boolean {
  if (!user) return false;
  return Boolean(
    user.isAdmin === true ||
    (user as any).is_admin === true ||
    (user.email && user.email.toLowerCase().includes('nhdtcc100@gmail.com'))
  );
}

export function setAntiInspectUser(user: AppUser | null) {
  currentUser = user;
}

/** Broadcasts an immediate security alert to the dashboard and threat engine */
function reportInspectIncident(
  attackType: 'DEVTOOLS_INSPECT' | 'DEBUGGER_TAMPERING' | 'SOURCE_INSPECTION' | 'CONSOLE_TAMPERING',
  method: string,
  severity: 'HIGH' | 'CRITICAL' = 'HIGH'
) {
  // ✅ Never report or block administrators
  if (isUserAdmin(currentUser)) {
    return;
  }

  const now = Date.now();
  if (now - lastAlertTimestamp < ALERT_COOLDOWN_MS) {
    return; // Rate limit logging
  }
  lastAlertTimestamp = now;

  const currentPath = typeof window !== 'undefined' ? window.location.pathname + window.location.hash : '/app';

  threatEngine.logThreat({
    attack_type: attackType,
    severity,
    endpoint: currentPath,
    target_node: 'Client DOM & Runtime Shield',
    next_predicted_vector: 'DevTools Reverse Engineering & DOM Tampering',
    payload_sample: `رصد محاولة فحص الكود أو فتح أدوات المطورين: [${method}]`,
    ip_address: '127.0.0.1 (Client Device)',
    user_id: currentUser?.id,
    user_name: currentUser?.name || 'مستخدم غير موثق',
    user_email: currentUser?.email,
    status: 'blocked',
    target_port: 443
  });
}

/** Initialize Anti-Inspect Defenses */
export function initAntiInspect(user?: AppUser | null) {
  if (user) currentUser = user;
  if (typeof window === 'undefined' || isShieldActive) return;
  isShieldActive = true;

  // 1. Block Context Menu (Right Click Inspect) for regular users only
  document.addEventListener('contextmenu', (e) => {
    // ✅ Allow admins full right-click / inspect access
    if (isUserAdmin(currentUser)) {
      return;
    }

    // Allow contextmenu on input/textarea for copy/paste convenience
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    e.preventDefault();
    reportInspectIncident('DEVTOOLS_INSPECT', 'الضغط بالزر الأيمن (Context Menu Inspect)');
  });

  // 2. Block Keyboard DevTools & Source Shortcuts for regular users only
  document.addEventListener('keydown', (e) => {
    // ✅ Allow admins full keyboard shortcut access (F12, DevTools, View Source)
    if (isUserAdmin(currentUser)) {
      return;
    }

    const key = e.key ? e.key.toUpperCase() : '';
    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    // F12 (DevTools)
    if (key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      reportInspectIncident('DEVTOOLS_INSPECT', 'الضغط على مفتاح F12 لفتح أدوات المطورين');
      return;
    }

    // Ctrl+Shift+I / J / C (DevTools Inspect & Console)
    if (ctrlOrMeta && e.shiftKey && ['I', 'J', 'C'].includes(key)) {
      e.preventDefault();
      e.stopPropagation();
      reportInspectIncident('DEVTOOLS_INSPECT', `مفتاح الاختصار [Ctrl+Shift+${key}] لفحص العناصر`);
      return;
    }

    // Ctrl+U (View Page Source)
    if (ctrlOrMeta && key === 'U') {
      e.preventDefault();
      e.stopPropagation();
      reportInspectIncident('SOURCE_INSPECTION', 'مفتاح الاختصار [Ctrl+U] لمحاولة سحب الكود المصدري');
      return;
    }

    // Ctrl+S (Save Webpage HTML)
    if (ctrlOrMeta && key === 'S') {
      e.preventDefault();
      e.stopPropagation();
      reportInspectIncident('SOURCE_INSPECTION', 'مفتاح الاختصار [Ctrl+S] لحفظ صفحة الويب محلياً');
      return;
    }
  });

  // 3. DevTools Open Detection via Screen & Viewport Dimensions
  let devToolsOpen = false;
  const checkDimensions = () => {
    // ✅ Skip check for administrators
    if (isUserAdmin(currentUser)) return;

    // ✅ Skip on mobile devices: virtual keyboards shrink innerHeight by 200-400px causing false alarms
    const isMobileDevice = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
    if (isMobileDevice) return;

    const widthThreshold = window.outerWidth - window.innerWidth > 160;
    const heightThreshold = window.outerHeight - window.innerHeight > 160;

    if (widthThreshold || heightThreshold) {
      if (!devToolsOpen) {
        devToolsOpen = true;
        reportInspectIncident('DEVTOOLS_INSPECT', 'تم فتح لوحة أدوات المطورين (DevTools Docked Window)', 'HIGH');
      }
    } else {
      devToolsOpen = false;
    }
  };

  window.addEventListener('resize', checkDimensions);
  setInterval(checkDimensions, 3000);

  // 4. Debugger Trap & Console Tamper Detection (Production Safe)
  if (process.env.NODE_ENV === 'production') {
    // Debugger execution delay detector
    setInterval(() => {
      // ✅ Skip debugger trap for administrators
      if (isUserAdmin(currentUser)) return;

      const start = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const duration = performance.now() - start;
      if (duration > 150) {
        reportInspectIncident('DEBUGGER_TAMPERING', 'تتبع الكود عبر الـ Debugger وتجميد التنفيذ', 'CRITICAL');
        try {
          console.clear();
        } catch { }
      }
    }, 4000);
  }

  // 5. Console Protection & Warning Banner
  try {
    const warningTitle = 'color: #ef4444; font-size: 24px; font-weight: bold; text-shadow: 1px 1px 2px black;';
    const warningBody = 'color: #f59e0b; font-size: 14px; font-weight: bold;';
    console.log('%c⚠️ تحذير أمني صارم!', warningTitle);
    console.log('%cهذه المنطقة مخصصة لمطوري نظام ProLink فقط. أي محاولة لحقن كود أو تعديل الواجهة مراقبة ومسجلة في مركز الأمان.', warningBody);
  } catch { }
}

