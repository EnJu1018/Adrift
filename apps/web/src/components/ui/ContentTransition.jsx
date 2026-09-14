import { motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { motionTokens } from '../../constants/animations.js';

export default function ContentTransition({ as = 'div', children, collapse = false, ...props }) {
  const present = useIsPresent();
  const reduced = useReducedMotion();
  const Element = motion[as];
  return <Element {...props} inert={!present ? true : undefined}
    className={`${props.className || ''}${collapse ? ' motion-collapse' : ''}`}
    data-collapsed={collapse && !present || undefined}
    initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: reduced ? 0 : present ? motionTokens.duration.fast : motionTokens.duration.quick,
      ease: motionTokens.ease.smoothOut }}>
    {collapse ? <div className="motion-collapse-inner">{children}</div> : children}
  </Element>;
}
