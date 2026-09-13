import { motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { motionTokens } from '../../constants/animations.js';

export default function ContentTransition({ as = 'div', children, ...props }) {
  const present = useIsPresent();
  const reduced = useReducedMotion();
  const Element = motion[as];
  return <Element {...props} inert={!present ? true : undefined}
    initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: reduced ? 0 : present ? motionTokens.duration.fast : motionTokens.duration.quick,
      ease: motionTokens.ease.smoothOut }}>
    {children}
  </Element>;
}
