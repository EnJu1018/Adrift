import { animate, createScope } from 'animejs';
import { useLayoutEffect, useRef } from 'react';
import { motionMs } from '../../lib/motion/tokens.js';

export default function AnimatedNumber({ value, digits = 4, variant = 'fade' }) {
  const text = String(value ?? '—');
  const root = useRef(null);
  const previous = useRef(text);

  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = text;
    if (old === text) return;
    const scope = createScope({ root: root.current, mediaQueries: { reduce: '(prefers-reduced-motion: reduce)' } });
    scope.add(({ matches }) => {
      if (matches.reduce) return;
      animate(root.current.firstElementChild, {
        opacity: [0.55, 1],
        ...(variant === 'reaction' ? { translateY: [2, 0] } : {}),
        ...(variant === 'badge' ? { scale: [0.94, 1] } : {}),
        duration: motionMs.quick, ease: 'out(3)',
        onComplete: animation => animation.revert()
      });
    });
    return () => scope.revert();
  }, [text, variant]);

  return <bdi ref={root} className="motion-number" style={{ minInlineSize: `${digits}ch` }}>
    <bdi className="motion-number-value">{text}</bdi>
  </bdi>;
}
