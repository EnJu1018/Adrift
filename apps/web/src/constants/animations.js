import { motionMs, motionTokens, motionExit } from '../lib/motion/tokens.js';
export { motionMs, motionTokens };
const softOut = motionTokens.ease.softOut;

export const pageTransition = { duration: motionTokens.duration.fast, ease: softOut };
export const panelTransition = { duration: motionTokens.duration.slow, ease: softOut };
export const modalTransition = { duration: motionTokens.duration.fast, ease: softOut };
export const dropdownTransition = { duration: motionTokens.duration.fast, ease: softOut };
export const toastTransition = { duration: motionTokens.duration.medium, ease: softOut };
export const listItemTransition = { duration: motionTokens.duration.verySlow, ease: softOut };
export const accordionTransition = { duration: motionTokens.duration.slow, ease: softOut };

export const pageFadeUp = {
  initial: { opacity: 0, y: motionTokens.distance.base },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -motionTokens.distance.base },
  transition: pageTransition
};

export const panelSlideLeft = {
  initial: { opacity: 0, x: -motionTokens.distance.medium },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -motionTokens.distance.medium },
  transition: panelTransition
};

export const panelSlideRight = {
  initial: { opacity: 0, x: motionTokens.distance.medium },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: motionTokens.distance.medium },
  transition: panelTransition
};

export const modalBackdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: motionTokens.duration.quick, ease: softOut }
};

export const modalPopMotion = {
  initial: { opacity: 0, y: 0, scale: motionTokens.scale.small },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 0, scale: motionTokens.scale.small, transition: motionExit },
  transition: modalTransition
};

export function dropdownMotion(openUp = false) {
  return {
    initial: { opacity: 0, y: openUp ? motionTokens.distance.micro : -motionTokens.distance.micro, scale: motionTokens.scale.medium },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: openUp ? motionTokens.distance.micro : -motionTokens.distance.micro, scale: motionTokens.scale.tiny, transition: motionExit },
    transition: dropdownTransition
  };
}

export const toastMotion = {
  initial: { opacity: 0, y: -motionTokens.distance.small, scale: motionTokens.scale.medium },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -motionTokens.distance.small, scale: motionTokens.scale.small,
    transition: { duration: motionTokens.duration.fast, ease: softOut, delay: 0 } },
  transition: toastTransition
};

export const fadeUpMotion = {
  initial: { opacity: 0, y: motionTokens.distance.small },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -motionTokens.distance.small },
  transition: listItemTransition
};

export const revealOnViewMotion = {
  initial: { opacity: 0, y: motionTokens.distance.medium },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: listItemTransition
};

export function listItemMotion(index = 0, lowPerformance = false) {
  const reduced = lowPerformance || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  return {
    initial: reduced ? false : { opacity: 0, y: motionTokens.distance.small },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reduced ? 0 : motionTokens.distance.micro, transition: reduced ? { duration: 0, delay: 0 } : motionExit },
    transition: {
      ...listItemTransition,
      duration: reduced ? 0 : listItemTransition.duration,
      delay: reduced ? 0 : Math.max(0, Math.min(index, 6)) * motionTokens.duration.stagger
    }
  };
}

export function staggeredRevealMotion(index = 0, lowPerformance = false) {
  const reduced = lowPerformance || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  return {
    ...revealOnViewMotion,
    initial: reduced ? false : revealOnViewMotion.initial,
    transition: {
      ...listItemTransition,
      duration: reduced ? 0 : listItemTransition.duration,
      delay: reduced ? 0 : Math.max(0, Math.min(index, 6)) * motionTokens.duration.stagger
    }
  };
}
