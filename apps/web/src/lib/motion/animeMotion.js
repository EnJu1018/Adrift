import { animate, createDrawable, createMotionPath, createScope, stagger } from 'animejs';
import { motionMs, motionTokens } from './tokens.js';

export function createInsightReveal(root) {
  if (!root || typeof window === 'undefined') return () => {};
  const scope = createScope({ root, mediaQueries: { reduce: '(prefers-reduced-motion: reduce)' } });
  scope.add(({ matches }) => {
    if (matches.reduce) return;
    animate(root.querySelectorAll('[data-insight-reveal]'), {
      opacity: [0, 1], translateY: [motionTokens.distance.small, 0],
      duration: motionMs.slow, delay: stagger(motionMs.stagger), ease: 'out(3)'
    });
  });
  return () => scope.revert();
}

export function prefersReducedMotion() {
  return typeof window === 'undefined' ||
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export function createMapVisualMotion(root) {
  if (!root || typeof window === 'undefined') return () => {};

  const scope = createScope({ root, mediaQueries: { reduce: '(prefers-reduced-motion: reduce)' } });
  scope.add(({ matches }) => {
    if (matches.reduce) return;

    const lines = [...root.querySelectorAll('[data-map-draw]')];
    if (lines.length) {
      animate(createDrawable(lines, 0, 0), {
        draw: '0 1', duration: 1650, delay: stagger(50), ease: 'out(3)'
      });
    }

    root.querySelectorAll('[data-memory-path]').forEach((path, index) => {
      animate(path, {
        strokeDashoffset: [0, Number(path.dataset.flowDistance) || (index === 0 ? -92 : -64)],
        duration: Number(path.dataset.flowDuration) || 12000,
        loop: true, ease: 'linear'
      });
    });

    root.querySelectorAll('[data-drift-dot]').forEach(dot => {
      const path = root.querySelector(`#${dot.dataset.pathId}`);
      if (!path) return;
      const { translateX, translateY } = createMotionPath(path, Number(dot.dataset.pathOffset) || 0);
      animate(dot, {
        translateX, translateY,
        duration: Number(dot.dataset.duration) || 24000,
        loop: true, ease: 'linear'
      });
      animate(dot, { opacity: Number(dot.dataset.opacity) || 0.8, duration: 900, ease: 'out(2)' });
    });
  });

  // Restore styles and release media listeners, including on StrictMode remounts.
  return () => scope.revert();
}

export { createMapVisualMotion as createPresentationMapMotion };
