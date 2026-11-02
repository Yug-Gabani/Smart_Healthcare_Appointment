import type { Variants, Transition } from 'framer-motion';

export const EASE_ENTER = [0.22, 1, 0.36, 1] as const; // ease-out-quint, gentle landing
export const EASE_EXIT = [0.4, 0, 0.2, 1] as const;   // ease-in-out

export const transitionEnter: Transition = {
  duration: 0.24,
  ease: EASE_ENTER,
};

export const transitionExit: Transition = {
  duration: 0.2,
  ease: EASE_EXIT,
};

export const fadeInUp: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.24,
      ease: EASE_ENTER,
    },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: {
      duration: 0.2,
      ease: EASE_EXIT,
    },
  },
};

export const fadeIn: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.18,
      ease: EASE_ENTER,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: EASE_EXIT,
    },
  },
};

export const scaleIn: Variants = {
  initial: {
    opacity: 0,
    scale: 0.96,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.22,
      ease: EASE_ENTER,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: {
      duration: 0.18,
      ease: EASE_EXIT,
    },
  },
};

export const slideInRight: Variants = {
  initial: {
    x: 24,
    opacity: 0,
  },
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.26,
      ease: EASE_ENTER,
    },
  },
  exit: {
    x: 24,
    opacity: 0,
    transition: {
      duration: 0.22,
      ease: EASE_EXIT,
    },
  },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

export const listItem: Variants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: EASE_ENTER,
    },
  },
  exit: {
    opacity: 0,
    y: 6,
    transition: {
      duration: 0.16,
      ease: EASE_EXIT,
    },
  },
};
