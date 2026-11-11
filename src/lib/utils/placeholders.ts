import React from 'react';

/**
 * Safe, beautiful inline SVG data-URI placeholder for news and post cards.
 * Requires 0 network requests, never 404s regardless of Vite base URL or offline status.
 */
export const DEFAULT_NEWS_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20220%22%20width%3D%22400%22%20height%3D%22220%22%3E%3Crect%20width%3D%22400%22%20height%3D%22220%22%20fill%3D%22%231e293b%22%2F%3E%3Cpath%20d%3D%22M150%2090h100M150%20115h80M150%20140h60%22%20stroke%3D%22%23475569%22%20stroke-width%3D%224%22%20stroke-linecap%3D%22round%22%2F%3E%3Ccircle%20cx%3D%22120%22%20cy%3D%22115%22%20r%3D%2216%22%20fill%3D%22%233b82f6%22%20opacity%3D%220.8%22%2F%3E%3C%2Fsvg%3E";

/**
 * Safe image error handler that breaks recursive 404 loops.
 * Sets `target.onerror = null` to guarantee no infinite error events occur.
 */
export const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallback: string = DEFAULT_NEWS_PLACEHOLDER
) => {
  const target = e.currentTarget;
  target.onerror = null; // 🛡️ CRITICAL: Break any infinite recursion
  target.src = fallback;
};
