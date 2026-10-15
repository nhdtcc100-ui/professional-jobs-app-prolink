/**
 * useFilePermission
 * ─────────────────────────────────────────────────────────────────
 * Handles camera / photo-library permission requests for:
 *  - Capacitor Android (via @capacitor/camera)
 *  - Capacitor iOS     (via @capacitor/camera)
 *  - Mobile Web        (implicit via <input type="file">)
 *  - Desktop           (no permission needed)
 *
 * ⚠️ Critical iOS rule: Never call input.click() after an `await`.
 *    iOS Safari invalidates the user-gesture token on any async boundary.
 *    Strategy: call checkPermission() eagerly (on mount / before render),
 *    cache the result, then on user tap – if granted, the <label>/<input>
 *    pair fires directly; if denied, show the guidance modal.
 */

import { useState, useCallback, useEffect } from 'react';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'limited' | 'unknown';
export type PermissionType   = 'camera' | 'photos';

export interface UseFilePermissionReturn {
  /** Cached status (updated on mount + after each request) */
  status: PermissionStatus;
  /**
   * Call this on component mount to pre-warm the status.
   * Returns true if the file picker can be opened right now.
   */
  checkPermission: (type?: PermissionType) => Promise<PermissionStatus>;
  /**
   * Triggers the OS permission prompt (Capacitor only).
   * On web, always returns 'granted' — file picker handles it natively.
   * ⚠️ Do NOT call this inside the file-picker click handler on iOS.
   *    Call it separately (e.g., on a "grant permission" button press).
   */
  requestPermission: (type?: PermissionType) => Promise<PermissionStatus>;
  isNative: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

// ─── Platform detection (module-level, evaluated once) ────────────
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const IS_IOS =
  /iPad|iPhone|iPod/.test(ua) ||
  (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const IS_ANDROID = /Android/.test(ua);
const IS_CAPACITOR = typeof (window as any)?.Capacitor !== 'undefined';
export const IS_NATIVE = IS_CAPACITOR && (IS_IOS || IS_ANDROID);

// ─── Lazy import of @capacitor/camera (only in native builds) ─────
let _CameraPlugin: any = null;
async function getCameraPlugin(): Promise<any | null> {
  if (_CameraPlugin) return _CameraPlugin;
  if (!IS_NATIVE) return null;
  try {
    const mod = await import('@capacitor/camera');
    _CameraPlugin = mod.Camera;
    return _CameraPlugin;
  } catch {
    // Plugin not installed — fall back to web behaviour
    return null;
  }
}

// ─── Hook ────────────────────────────────────────────────────────
export function useFilePermission(autoCheck = true): UseFilePermissionReturn {
  const [status, setStatus] = useState<PermissionStatus>('unknown');

  // ── Check (non-prompting) ──────────────────────────────────────
  const checkPermission = useCallback(
    async (type: PermissionType = 'photos'): Promise<PermissionStatus> => {
      const Camera = await getCameraPlugin();

      if (Camera) {
        try {
          const result = await Camera.checkPermissions();
          const state: string =
            type === 'camera' ? result.camera : result.photos;

          const mapped: PermissionStatus =
            state === 'granted' ? 'granted' :
            state === 'limited' ? 'limited' :
            state === 'denied'  ? 'denied'  :
            'prompt';

          setStatus(mapped);
          return mapped;
        } catch (e) {
          console.warn('[useFilePermission] checkPermissions error:', e);
        }
      }

      // Web: <input type="file"> is always implicitly available
      setStatus('granted');
      return 'granted';
    },
    []
  );

  // ── Request (shows OS prompt) ──────────────────────────────────
  const requestPermission = useCallback(
    async (type: PermissionType = 'photos'): Promise<PermissionStatus> => {
      const Camera = await getCameraPlugin();

      if (Camera) {
        try {
          const result = await Camera.requestPermissions({
            permissions: type === 'camera' ? ['camera'] : ['photos'],
          });

          const state: string =
            type === 'camera' ? result.camera : result.photos;

          const mapped: PermissionStatus =
            state === 'granted' ? 'granted' :
            state === 'limited' ? 'limited' :
            state === 'denied'  ? 'denied'  :
            'prompt';

          setStatus(mapped);
          return mapped;
        } catch (e) {
          console.warn('[useFilePermission] requestPermissions error:', e);
        }
      }

      // Web fallback
      setStatus('granted');
      return 'granted';
    },
    []
  );

  // ── Auto-check on mount (so UI knows state before user taps) ───
  useEffect(() => {
    if (autoCheck) {
      checkPermission('photos').catch(() => {});
    }
  }, [autoCheck, checkPermission]);

  return { status, checkPermission, requestPermission, isNative: IS_NATIVE, isIOS: IS_IOS, isAndroid: IS_ANDROID };
}
