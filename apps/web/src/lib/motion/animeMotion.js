import { animate, createDrawable, createMotionPath, stagger } from 'animejs';

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function stopAnimation(animation) {
  if (!animation) return;

  if (typeof animation.pause === 'function') {
    animation.pause();
  }

  if (typeof animation.cancel === 'function') {
    animation.cancel();
  }
}

function readNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function createPresentationMapMotion(root) {
  if (!root || prefersReducedMotion()) {
    return () => {};
  }

  const animations = [];
  const drawnLines = [...root.querySelectorAll('[data-map-draw]')];
  const driftPaths = [...root.querySelectorAll('[data-memory-path]')];
  const driftDots = [...root.querySelectorAll('[data-drift-dot]')];
  const nodeHalos = [...root.querySelectorAll('[data-node-halo]')];
  const dotHalos = [...root.querySelectorAll('[data-drift-dot] .drifting-memory-dot-halo')];
  const dotCores = [...root.querySelectorAll('[data-drift-dot] .drifting-memory-dot-core')];

  if (drawnLines.length > 0) {
    const drawableLines = createDrawable(drawnLines, 0, 0);

    animations.push(
      animate(drawableLines, {
        draw: '0 1',
        duration: 1650,
        delay: stagger(70),
        ease: 'out(3)'
      })
    );
  }

  driftPaths.forEach((path, index) => {
    animations.push(
      animate(path, {
        strokeDashoffset: [0, index === 0 ? -92 : -64],
        duration: readNumber(path.dataset.flowDuration, index === 0 ? 12000 : 14000),
        loop: true,
        ease: 'linear'
      })
    );
  });

  driftDots.forEach((dot, index) => {
    const path = root.querySelector(`#${dot.dataset.pathId}`);
    const motionPath = path ? createMotionPath(path, readNumber(dot.dataset.pathOffset, 0)) : null;

    if (!motionPath) return;

    animations.push(
      animate(dot, {
        translateX: motionPath.translateX,
        translateY: motionPath.translateY,
        duration: readNumber(dot.dataset.duration, 24000),
        delay: readNumber(dot.dataset.delay, 0),
        loop: true,
        ease: 'linear'
      })
    );

    animations.push(
      animate(dot, {
        opacity: readNumber(dot.dataset.opacity, 0.82),
        duration: 900,
        delay: 180 + index * 180,
        ease: 'out(2)'
      })
    );
  });

  if (nodeHalos.length > 0) {
    animations.push(
      animate(nodeHalos, {
        opacity: [0.12, 0.3],
        scale: [0.84, 1.12],
        duration: 5800,
        delay: stagger(360),
        alternate: true,
        loop: true,
        ease: 'inOutSine'
      })
    );
  }

  if (dotHalos.length > 0) {
    animations.push(
      animate(dotHalos, {
        opacity: [0.12, 0.26],
        scale: [0.82, 1.14],
        duration: 5200,
        delay: stagger(420),
        alternate: true,
        loop: true,
        ease: 'inOutSine'
      })
    );
  }

  if (dotCores.length > 0) {
    animations.push(
      animate(dotCores, {
        opacity: [0.72, 1],
        scale: [0.94, 1.08],
        duration: 4800,
        delay: stagger(460),
        alternate: true,
        loop: true,
        ease: 'inOutSine'
      })
    );
  }

  animations.push(
    animate(root, {
      translateY: [0, -6],
      duration: 12000,
      alternate: true,
      loop: true,
      ease: 'inOutSine'
    })
  );

  return () => {
    animations.forEach(stopAnimation);
  };
}
