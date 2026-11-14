// src/lib/motion/transitions.ts
// Standardized high-performance motion library for ProLink platform (60-120FPS hardware accelerated)
import type { Variants } from 'motion/react';

/**
 * 1. Page-to-Page / Tab Crossfade
 * Soft directionless fade for main tabs (Home, Jobs, News, Services, Network).
 * 130ms duration gives immediate responsiveness without spatial disorientation.
 */
export const pageTransition: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.13, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: 'easeIn' } },
};

export const fade = pageTransition;

/**
 * 2. Hierarchical Drill-Down / Depth Push (التنقل للداخل)
 * Kinetic Depth Push for entering deeper details:
 * - Opening Job details
 * - Entering chat / communication with a user
 * - Reading full news articles
 * - Opening user profiles
 * 
 * Enters from RTL forward axis with subtle depth scale (0.98 -> 1)
 * Exits with ultra-fast Fluid Pop (140ms) with pointer-events-none to prevent lag/hanging.
 */
export const drillDownTransition: Variants = {
  enter: (dir: number = 1) => ({
    x: dir > 0 ? -40 : 40,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: 'spring' as const, stiffness: 420, damping: 36, mass: 0.75 },
      opacity: { duration: 0.16 },
      scale: { duration: 0.16 },
    },
  },
  exit: (dir: number = 1) => ({
    x: dir > 0 ? 40 : -40,
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.14,
      ease: [0.32, 0.72, 0, 1],
    },
  }),
};

/**
 * 3. Modal Sheet Transition (Slide Up / Drag-to-Dismiss)
 * Used for bottom sheets (Application Form, CV Preview, Filters, Quick Actions).
 */
export const sheetTransition: Variants = {
  initial: { y: '100%', opacity: 0.7 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 400, damping: 36, mass: 0.8 },
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: { duration: 0.16, ease: [0.32, 0.72, 0, 1] },
  },
};

export const sheet = sheetTransition;

/**
 * 4. Card Deck Switcher Variants (horizontal swipe between jobs/news items)
 */
export const cardDeckVariants: Variants = {
  enter: (dir: number = 1) => ({
    x: dir > 0 ? -120 : 120,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.7 },
      opacity: { duration: 0.15 },
      scale: { duration: 0.15 },
    },
  },
  exit: (dir: number = 1) => ({
    x: dir > 0 ? 120 : -120,
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.15,
      ease: 'easeOut',
    },
  }),
};

export const cardStack = {
  initial: { scale: 0.94, y: 24, opacity: 0 },
  animate: { scale: 1, y: 0, opacity: 1 },
  exit: { scale: 0.94, y: 24, opacity: 0 },
  transition: { type: 'spring' as const, stiffness: 380, damping: 34 },
};

/**
 * 5. Circle reveal transition for Theme toggling (Dark/Light mode).
 * Launches an expanding circular wave from the click coordinate (x, y).
 */
export function revealTheme(x: number, y: number, apply: () => void) {
  const d = typeof document !== 'undefined' ? (document as any) : null;
  if (
    !d ||
    !d.startViewTransition ||
    (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  ) {
    return apply();
  }

  const r = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  try {
    const transition = d.startViewTransition(apply);
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 400, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {
      apply();
    });
  } catch {
    apply();
  }
}
