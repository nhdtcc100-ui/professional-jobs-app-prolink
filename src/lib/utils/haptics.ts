/**
 * Safe Haptics Utility
 * Wraps navigator.vibrate to respect browser intervention policies (requires user activation)
 */
export function safeVibrate(pattern: number | number[] = 10): void {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    
    // Check if the user has activated/tapped the document frame first (prevents Chrome Intervention warning)
    const userActivation = (navigator as any).userActivation;
    if (userActivation && !userActivation.hasBeenActive) {
      return;
    }

    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch (_) {
    // Ignore any vibration errors or blocked policies silently
  }
}
