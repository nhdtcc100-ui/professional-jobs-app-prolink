/**
 * useFilePermission
 * ─────────────────────────────────────────────────────────────────
 * Handles OS-level file / camera / photo-library permission requests
 * for Android (Capacitor / Chrome WebView) and iPhone/iOS (WKWebView / Safari).
 *
 * Works WITHOUT @capacitor/camera being installed — uses window.Capacitor
 * global API that is injected by the native shell at runtime.
 *
 * Flow:
 *  1. User taps "Change Photo" or "Upload CV"
 *  2. Hook checks platform & permission state
 *  3. If not granted → show native prompt or guide to Settings
 *  4. On grant → caller opens the file picker
 */

import { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────
export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'limited' | 'unknown';
export type PermissionType   = 'camera' | 'photos' | 'storage';

export interface UseFilePermissionReturn {
  status: PermissionStatus;
  requestPermission: (type?: PermissionType) => Promise<boolean>;
  isNative: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

// ─── Platform Detection (evaluated once at module load) ───────────
const ua          = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const IS_CAPACITOR = typeof (window as any)?.Capacitor !== 'undefined';
const IS_IOS =
  /iPad|iPhone|iPod/.test(ua) ||
  (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_ANDROID  = /Android/.test(ua);
const IS_NATIVE   = IS_CAPACITOR && (IS_IOS || IS_ANDROID);

// ─── Capacitor Camera bridge (no npm import needed) ──────────────
// window.Capacitor.Plugins.Camera is injected by the native app shell.
const getCapCamera = (): any | null => {
  try {
    const cam = (window as any)?.Capacitor?.Plugins?.Camera;
    return cam ?? null;
  } catch {
    return null;
  }
};

// ─── Hook ────────────────────────────────────────────────────────
export function useFilePermission(): UseFilePermissionReturn {
  const [status, setStatus] = useState<PermissionStatus>('unknown');

  const requestPermission = useCallback(
    async (type: PermissionType = 'photos'): Promise<boolean> => {

      // ── 1. Capacitor Native (Android + iOS) ─────────────────────
      if (IS_NATIVE) {
        const Camera = getCapCamera();
        if (Camera) {
          try {
            // Check current state first to avoid redundant system prompts
            const current = await Camera.checkPermissions();
            const camState   = current?.camera;
            const photoState = current?.photos;

            if (
              (type === 'camera'  && camState   === 'granted') ||
              (type === 'photos'  && photoState === 'granted') ||
              (type === 'storage' && photoState === 'granted')
            ) {
              setStatus('granted');
              return true;
            }

            // iOS: 'limited' = user chose a subset of photos — still usable
            if (IS_IOS && photoState === 'limited') {
              setStatus('limited');
              return true;
            }

            // Request the permission from the OS
            const result = await Camera.requestPermissions({
              permissions: type === 'camera' ? ['camera'] : ['photos'],
            });

            const granted = result?.camera === 'granted' || result?.photos === 'granted';
            const limited  = IS_IOS && result?.photos === 'limited';

            if (granted || limited) {
              setStatus(limited ? 'limited' : 'granted');
              return true;
            }

            setStatus('denied');
            return false;
          } catch (err) {
            // Camera plugin unavailable in this build — fall through
            console.warn('[useFilePermission] Capacitor Camera bridge error:', err);
          }
        }
      }

      // ── 2. Mobile Web (Safari iOS / Chrome Android) ─────────────
      // <input type="file"> already triggers the native photo/file picker,
      // which includes implicit permission handling. We only query the
      // Permissions API as a best-effort check (not all browsers support it).
      if (typeof navigator?.permissions?.query === 'function') {
        try {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (result.state === 'granted') { setStatus('granted'); return true; }
          if (result.state === 'prompt')  { setStatus('prompt');  return true; }
          if (result.state === 'denied')  { setStatus('denied');  return false; }
        } catch {
          // Browser doesn't support querying 'camera' — that's fine
        }
      }

      // ── 3. Default: <input type="file"> handles everything implicitly ─
      // Works on: Desktop Chrome/Firefox/Safari, iOS Safari, Android Chrome
      setStatus('granted');
      return true;
    },
    []
  );

  return { status, requestPermission, isNative: IS_NATIVE, isIOS: IS_IOS, isAndroid: IS_ANDROID };
}
