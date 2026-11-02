import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface PageTransitionProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className,
  style,
  ...props
}) => {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={{
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.24,
            ease: [0.22, 1, 0.36, 1],
            staggerChildren: 0.04,
            delayChildren: 0.05,
          },
        },
        exit: {
          opacity: 0,
          y: 8,
          transition: {
            duration: 0.2,
            ease: [0.4, 0, 0.2, 1],
          },
        },
      }}
      className={className}
      style={style}
      {...props}
    >
      {children}
    </motion.div>
  );
};
