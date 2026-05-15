export const pageTransition = { duration: 0.26, ease: 'easeOut' };
export const panelTransition = { duration: 0.28, ease: 'easeOut' };
export const modalTransition = { duration: 0.24, ease: 'easeOut' };
export const dropdownTransition = { duration: 0.18, ease: 'easeOut' };
export const toastTransition = { duration: 0.18, ease: 'easeOut' };
export const listItemTransition = { duration: 0.22, ease: 'easeOut' };
export const accordionTransition = { duration: 0.28, ease: 'easeOut' };

export const pageFadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: pageTransition
};

export const panelSlideLeft = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: panelTransition
};

export const panelSlideRight = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 18 },
  transition: panelTransition
};

export const modalBackdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: 'easeOut' }
};

export const modalPopMotion = {
  initial: { opacity: 0, y: 10, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 10, scale: 0.98 },
  transition: modalTransition
};

export function dropdownMotion(openUp = false) {
  return {
    initial: { opacity: 0, y: openUp ? 4 : -4, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: openUp ? 4 : -4, scale: 0.98 },
    transition: dropdownTransition
  };
}

export const toastMotion = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: toastTransition
};

export const fadeUpMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: listItemTransition
};

export function listItemMotion(index = 0, lowPerformance = false) {
  return {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 4 },
    transition: {
      ...listItemTransition,
      delay: lowPerformance ? 0 : Math.min(index, 12) * 0.018
    }
  };
}
