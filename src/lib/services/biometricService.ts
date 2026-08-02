import { supabase } from '../supabase';

// ─── Device Fingerprint (identifies the current browser/device uniquely) ──────
function generateDeviceFingerprint(): string {
  const nav = window.navigator;
  const screen = window.screen;
  const raw = [
    nav.userAgent,
    nav.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    nav.hardwareConcurrency || '',
    (nav as any).deviceMemory || '',
  ].join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export const biometricService = {
  async checkBiometricSupport(): Promise<{ supported: boolean; error: string | null }> {
    const isNativeApp = 
      window.location.protocol === 'capacitor:' || 
      window.location.protocol === 'app:' ||
      window.location.protocol === 'http:' && window.location.hostname === 'localhost';
    
    // 1. Diagnostic: Check if we are in an In-App Browser (common issue)
    const ua = navigator.userAgent || '';
    const isInAppBrowser = /FBAN|FBAV|Instagram|LinkedIn|Twitter|Messenger/.test(ua);
    if (isInAppBrowser) {
      return { supported: false, error: '⚠️ أنت تستخدم متصفحاً داخلياً (مثل فيسبوك). يرجى فتح التطبيق في Chrome أو Safari لتفعيل البصمة.' };
    }

    // 2. Check for Secure Context
    if (!window.isSecureContext && !isNativeApp) {
      return { supported: false, error: '❌ نظام البصمة يتطلب اتصالاً آمناً (HTTPS). يرجى التأكد من الرابط.' };
    }

    // 3. Check for API support (Outdated WebView/OS)
    if (!window.PublicKeyCredential) {
      const platform = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : 'Android';
      return { 
        supported: false, 
        error: `⚠️ نظام ${platform} لديك لا يدعم تقنية البصمة الحديثة داخل التطبيقات. يرجى تحديث ${platform === 'Android' ? 'Android System WebView' : 'نظام التشغيل'} من المتجر.` 
      };
    }

    // 4. Check for Hardware availability
    try {
      const isHardwareAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!isHardwareAvailable && !isNativeApp) {
        return { supported: false, error: '❌ لم نجد حساس بصمة مفعل في هذا الجهاز. يرجى تفعيل (قفل الشاشة بالبصمة) في إعدادات الموبايل أولاً.' };
      }
      return { supported: true, error: null };
    } catch (e) {
      if (isNativeApp) return { supported: true, error: null };
      return { supported: false, error: 'فشل فحص الحساس في هذا الجهاز.' };
    }
  },

  getDeviceFingerprint(): string {
    return generateDeviceFingerprint();
  },

  // ─── Register Kiosk Device ──────────────────────────────────────────────────
  async registerKioskDevice(employerId: string, deviceName: string, lat?: number, lng?: number) {
    const fingerprint = generateDeviceFingerprint();
    try {
      const { data, error } = await supabase
        .from('kiosk_devices')
        .upsert({
          employer_id: employerId,
          device_name: deviceName,
          device_fingerprint: fingerprint,
          location_lat: lat,
          location_lng: lng,
          is_active: true,
          last_used_at: new Date().toISOString(),
        }, { onConflict: 'device_fingerprint' })
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
          // Table missing – store locally so app still works
          localStorage.setItem('prolink_kiosk_device', JSON.stringify({
            id: fingerprint,
            employer_id: employerId,
            device_name: deviceName,
            device_fingerprint: fingerprint,
            location_lat: lat,
            location_lng: lng,
            is_active: true,
          }));
          return { data: { id: fingerprint, device_fingerprint: fingerprint }, error: null };
        }
        throw error;
      }
      localStorage.setItem('prolink_kiosk_device', JSON.stringify(data));
      return { data, error: null };
    } catch (e: any) {
      return { error: e, data: null };
    }
  },

  // ─── Check if this device is a registered Kiosk ────────────────────────────
  async isRegisteredKiosk(employerId?: string): Promise<{ isKiosk: boolean; kioskData: any }> {
    const fingerprint = generateDeviceFingerprint();
    
    // Check local storage first for offline/table-missing support
    const local = localStorage.getItem('prolink_kiosk_device');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (parsed.device_fingerprint === fingerprint && (!employerId || parsed.employer_id === employerId) && parsed.is_active) {
          return { isKiosk: true, kioskData: parsed };
        }
      } catch {}
    }

    // Check from Supabase
    try {
      const query = supabase.from('kiosk_devices').select('*').eq('device_fingerprint', fingerprint).eq('is_active', true);
      if (employerId) query.eq('employer_id', employerId);
      const { data, error } = await query.single();
      if (data && !error) return { isKiosk: true, kioskData: data };
    } catch {}

    return { isKiosk: false, kioskData: null };
  },

  // ─── Get all registered kiosk devices for an employer ────────────────────────
  async getKioskDevices(employerId: string) {
    try {
      const { data, error } = await supabase
        .from('kiosk_devices')
        .select('*')
        .eq('employer_id', employerId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') return { data: [], error: null };
        throw error;
      }
      return { data, error: null };
    } catch (e: any) {
      return { error: e, data: [] };
    }
  },

  // ─── Deactivate a kiosk device ────────────────────────────────────────────
  async deactivateDevice(deviceId: string) {
    try {
      const { error } = await supabase.from('kiosk_devices').update({ is_active: false }).eq('id', deviceId);
      if (error) throw error;
      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  },

  // ─── WebAuthn Biometric Registration ─────────────────────────────────────
  async registerUserBiometric(employeeId: string, employeeName: string): Promise<{ credentialId: string | null; error: any }> {
    const support = await this.checkBiometricSupport();
    if (!support.supported) return { credentialId: null, error: support.error };

    const hostname = window.location.hostname;
    const rpId = (hostname === 'localhost' || hostname.includes('192.168.')) ? hostname : hostname;

    const registrationOptions: any = {
      publicKey: {
        rp: { 
          name: "ProLink ERP", 
          id: rpId 
        },
        user: {
          id: Uint8Array.from(crypto.getRandomValues(new Uint8Array(16))),
          name: employeeName,
          displayName: employeeName,
        },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" }
        ],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "required",
          requireResidentKey: true
        },
        attestation: "none",
      }
    };

    try {
      const credential = await navigator.credentials.create(registrationOptions) as any;
      if (!credential) throw new Error("لم يتم استلام بيانات البصمة من الجهاز");
      
      const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        
      const { error: updateError } = await supabase
        .from('employees')
        .update({ biometric_id: credentialId })
        .eq('id', employeeId);

      if (updateError) {
        console.error('Supabase Update Error (406?):', updateError);
        if (updateError.code === 'PGRST106' || updateError.message?.includes('column')) {
          return { credentialId: null, error: '⚠️ قاعدة البيانات بحاجة لتحديث. يرجى تشغيل كود SQL الخاص بعمود biometric_id.' };
        }
        throw updateError;
      }

      return { credentialId, error: null };
    } catch (e: any) {
      console.error('Biometric Registration Error:', e);
      let errorMsg = 'فشل في تسجيل البصمة';
      if (e.name === 'NotAllowedError') errorMsg = 'تم إلغاء العملية أو انتهت المهلة. تأكد من تفعيل قفل الشاشة في جهازك.';
      else if (e.name === 'SecurityError') errorMsg = 'يجب استخدام اتصال آمن (HTTPS) أو نظام الموبايل المعتمد.';
      else if (e.name === 'NotSupportedError') errorMsg = 'هذا الجهاز لا يدعم البصمة داخل التطبيق حالياً.';
      else if (e.message) errorMsg = `خطأ: ${e.message}`;
      
      return { credentialId: null, error: errorMsg };
    }
  },

  // ─── WebAuthn Biometric Verification ─────────────────────────────────────
  async verifyUserBiometric(allowedCredentialIds: string[]): Promise<{ credentialId: string | null; error: any }> {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: allowedCredentialIds.map(id => ({
            id: Uint8Array.from(atob(id), c => c.charCodeAt(0)),
            type: 'public-key'
          })),
          userVerification: 'required',
          timeout: 60000
        }
      }) as any;

      if (credential) {
        const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        return { credentialId, error: null };
      }
      return { credentialId: null, error: 'No credential returned' };
    } catch (e: any) {
      console.error('Biometric Verification Error:', e);
      let errorMsg = 'فشل في التحقق من البصمة';
      if (e.name === 'NotAllowedError') errorMsg = 'تم إلغاء عملية التحقق أو انتهت المهلة';
      else if (e.name === 'NotSupportedError') errorMsg = 'الجهاز لا يدعم مفاتيح الأمان العامة';
      else if (e.message) errorMsg = `خطأ: ${e.message}`;
      
      return { credentialId: null, error: errorMsg };
    }
  },

  // ─── Calculate distance between two GPS coordinates (Haversine formula) ────
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              // Fix potential bug: use lng1/lng2
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
};
