export const motionMs = Object.freeze({
  stagger: 40, micro: 80, quick: 150, fast: 250,
  medium: 350, slow: 400, verySlow: 500
});

export const motionTokens = {
  duration: Object.fromEntries(Object.entries(motionMs).map(([key, ms]) => [key, ms / 1000])),
  distance: { nudge: 1, micro: 4, small: 6, base: 8, medium: 12, large: 16 },
  scale: { large: 0.96, medium: 0.97, small: 0.98, tiny: 0.99 },
  ease: {
    smoothOut: [0.22, 1, 0.36, 1],
    softOut: [0.22, 1, 0.36, 1],
    exitEase: [0.4, 0, 1, 1],
    linear: 'linear', inOut: 'easeInOut'
  }
};

export const motionExit = { duration: motionTokens.duration.quick, ease: motionTokens.ease.exitEase, delay: 0 };

// Emit the same scale into CSS at build time; no runtime style injection.
export const motionCss = `:root {
${Object.entries(motionMs).map(([key, value]) => `--duration-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}: ${value}ms;`).join('\n')}
${Object.entries(motionTokens.distance).map(([key, value]) => `--distance-${key}: ${value}px;`).join('\n')}
${Object.entries(motionTokens.scale).map(([key, value]) => `--scale-${key}: ${value};`).join('\n')}
--ease-smooth-out: cubic-bezier(${motionTokens.ease.smoothOut.join(', ')});
--ease-enter: var(--ease-smooth-out);
--ease-exit: cubic-bezier(${motionTokens.ease.exitEase.join(', ')});
--ease-standard: var(--ease-smooth-out);
--ease-soft: var(--ease-smooth-out);
--ease-drift: var(--ease-smooth-out);
--ease-in-out: ease-in-out;
--ease-out: ease-out;
--ease-linear: linear;
--motion-fast: var(--duration-quick);
--motion-normal: var(--duration-fast);
--motion-slow: var(--duration-slow);
--motion-drift: 720ms;
--motion-breathe: 4.8s;
--motion-breathe-quick: 3.6s;
--motion-breathe-slow: 5.8s;
--motion-float: 12s;
--motion-float-slow: 13s;
--motion-path: 12s;
--motion-path-slow: 14s;
--motion-line-draw: 1.65s;
}`;
