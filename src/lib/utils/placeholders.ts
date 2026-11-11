import React from 'react';

/**
 * Official logo/image of "عمل" used as the default image for news & articles
 * when no image is provided.
 */
export const AMAL_NEWS_IMAGE = `${import.meta.env.BASE_URL}news-placeholder.png`;

/**
 * Default placeholder for news: uses the official "عمل" logo image.
 */
export const DEFAULT_NEWS_PLACEHOLDER = AMAL_NEWS_IMAGE;

/**
 * Safe image error handler that breaks recursive 404 loops.
 * Sets `target.onerror = null` to guarantee no infinite error events occur,
 * and sets the fallback to the official "عمل" logo image.
 */
export const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallback: string = DEFAULT_NEWS_PLACEHOLDER
) => {
  const target = e.currentTarget;
  target.onerror = null; // 🛡️ Break any infinite recursion
  target.src = fallback;
};
