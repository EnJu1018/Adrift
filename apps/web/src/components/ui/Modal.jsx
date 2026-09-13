import { motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { modalBackdropMotion, modalPopMotion } from '../../constants/animations.js';

export default function Modal({ children, label, onClose, busy = false, error = '', as = 'div', className, backdropClassName = 'modal-backdrop', ...props }) {
  const ref = useRef(null);
  const present = useIsPresent();
  const reduced = useReducedMotion();
  const Panel = motion[as];

  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return createPortal(
    <motion.dialog ref={ref} className={`ui-modal ${backdropClassName}`} aria-label={label}
      aria-modal="true" aria-busy={busy || undefined}
      onCancel={event => { event.preventDefault(); if (present && !busy) onClose?.(); }}
      {...modalBackdropMotion} transition={reduced ? { duration: 0 } : modalBackdropMotion.transition}
      exit={{ opacity: 0, transition: { duration: reduced ? 0 : modalBackdropMotion.transition.duration } }}>
      <Panel {...props} className={className} inert={!present ? true : undefined}
        {...modalPopMotion} initial={reduced ? false : modalPopMotion.initial}
        exit={reduced ? { opacity: 0, transition: { duration: 0 } } : modalPopMotion.exit}>
        {children}
        {error && <p className="form-error" role="alert">{error}</p>}
      </Panel>
    </motion.dialog>, document.body
  );
}
