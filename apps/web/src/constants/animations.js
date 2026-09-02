const smoothOut = [0.22, 1, 0.36, 1];
const softOut = [0.16, 1, 0.3, 1];

export const motionMs = {
  stagger: 40,
  micro: 80,
  quick: 150,
  fast: 250,
  medium: 350,
  slow: 400,
  verySlow: 500
};

export const motionTokens = {
  duration: {
    stagger: motionMs.stagger / 1000,
    micro: motionMs.micro / 1000,
    quick: motionMs.quick / 1000,
    fast: motionMs.fast / 1000,
    medium: motionMs.medium / 1000,
    slow: motionMs.slow / 1000,
    verySlow: motionMs.verySlow / 1000
  },
  distance: {
    nudge: 1,
    micro: 4,
    small: 6,
    base: 8,
    medium: 12,
    large: 30
  },
  scale: {
    large: 0.96,
    medium: 0.97,
    small: 0.98,
    tiny: 0.99
  },
  ease: {
    smoothOut,
    softOut,
    linear: 'linear',
    inOut: 'easeInOut'
  }
};

export const pageTransition = { duration: motionTokens.duration.fast, ease: smoothOut };
export const panelTransition = { duration: motionTokens.duration.slow, ease: smoothOut };
export const modalTransition = { duration: motionTokens.duration.fast, ease: smoothOut };
export const dropdownTransition = { duration: motionTokens.duration.fast, ease: smoothOut };
export const toastTransition = { duration: motionTokens.duration.medium, ease: smoothOut };
export const listItemTransition = { duration: motionTokens.duration.verySlow, ease: smoothOut };
export const accordionTransition = { duration: motionTokens.duration.slow, ease: smoothOut };

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
  transition: { duration: motionTokens.duration.quick, ease: smoothOut }
};

export const modalPopMotion = {
  initial: { opacity: 0, y: motionTokens.distance.base, scale: motionTokens.scale.large },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: motionTokens.distance.base, scale: motionTokens.scale.small },
  transition: modalTransition
};

export function dropdownMotion(openUp = false) {
  return {
    initial: { opacity: 0, y: openUp ? motionTokens.distance.micro : -motionTokens.distance.micro, scale: motionTokens.scale.medium },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: openUp ? motionTokens.distance.micro : -motionTokens.distance.micro, scale: motionTokens.scale.tiny },
    transition: dropdownTransition
  };
}

export const toastMotion = {
  initial: { opacity: 0, y: -motionTokens.distance.base, scale: motionTokens.scale.medium },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -motionTokens.distance.base, scale: motionTokens.scale.small },
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
  return {
    initial: { opacity: 0, y: motionTokens.distance.small },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: motionTokens.distance.micro },
    transition: {
      ...listItemTransition,
      delay: lowPerformance ? 0 : Math.min(index, 12) * motionTokens.duration.stagger
    }
  };
}

export function staggeredRevealMotion(index = 0, lowPerformance = false) {
  return {
    ...revealOnViewMotion,
    transition: {
      ...listItemTransition,
      delay: lowPerformance ? 0 : Math.min(index, 6) * motionTokens.duration.stagger
    }
  };
}
