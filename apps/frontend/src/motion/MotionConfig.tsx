import React, { useEffect, useState } from 'react';
import { MotionConfig as FramerMotionConfig } from 'framer-motion';

export const MotionConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  return (
    <FramerMotionConfig
      reducedMotion={reducedMotion ? 'always' : 'never'}
      transition={reducedMotion ? { duration: 0 } : undefined}
    >
      {children}
    </FramerMotionConfig>
  );
};
