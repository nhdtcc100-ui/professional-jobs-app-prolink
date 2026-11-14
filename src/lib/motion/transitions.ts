// src/lib/motion/transitions.ts
// Reusable motion patterns based on specialized transitions system

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15, ease: 'easeOut' },
};

export const slide = {
  initial: { x: '-8%', opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: '8%', opacity: 0 },
  transition: { type: 'spring', stiffness: 420, damping: 38 },
};

export const sheet = {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%' },
  transition: { type: 'spring', stiffness: 380, damping: 38 },
};

export const cardStack = {
  initial: { scale: 0.92, y: 30, opacity: 0 },
  animate: { scale: 1, y: 0, opacity: 1 },
  exit: { scale: 0.92, y: 30, opacity: 0 },
  transition: { type: 'spring', stiffness: 360, damping: 32 },
};

/**
 * Circle reveal transition for Theme toggling (Dark/Light mode).
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
        { duration: 420, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {
      apply();
    });
  } catch {
    apply();
  }
}

