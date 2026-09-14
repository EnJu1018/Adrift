import { animate, createScope } from 'animejs';
import { useLayoutEffect, useRef } from 'react';
import { motionMs } from '../../lib/motion/tokens.js';

export default function AnimatedNumber({ value, digits = 4 }) {
  const text = String(value ?? 0);
  const root = useRef(null);
  const previous = useRef(text);
  const cells = text.padStart(Math.max(digits, text.length), ' ');

  useLayoutEffect(() => {
    const old = previous.current.padStart(cells.length, ' ');
    previous.current = text;
    if (old === cells) return;
    const scope = createScope({ root: root.current, mediaQueries: { reduce: '(prefers-reduced-motion: reduce)' } });
    scope.add(({ matches }) => {
      if (matches.reduce) return;
      const changed = [...root.current.querySelectorAll(':scope > i')].filter((_, index) => old[index] !== cells[index]);
      animate(changed, { opacity: [0.35, 1], translateY: [4, 0], duration: motionMs.fast, ease: 'out(3)' });
    });
    return () => scope.revert();
  }, [text, cells]);

  return <bdi ref={root} className="motion-number">
    <span className="visually-hidden">{text}</span>
    {[...cells].map((character, place) => <i key={cells.length - place} aria-hidden="true">{character === ' ' ? '\u00a0' : character}</i>)}
  </bdi>;
}
