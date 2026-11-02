import { gsap } from 'gsap';

export function initAnimations() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Click feedback: <button data-click="shake|bounce|breathe"> */
  document.querySelectorAll<HTMLElement>('[data-click]').forEach((el) => {
    const clickType = el.dataset.click as 'shake' | 'bounce' | 'breathe';
    const cls = { shake: 'is-shaking', bounce: 'is-bouncing', breathe: 'is-breathing' }[clickType];
    if (!cls) return;

    const handler = () => {
      el.classList.remove(cls);
      void el.offsetWidth; // trigger reflow
      el.classList.add(cls);
    };

    el.removeEventListener('click', handler);
    el.addEventListener('click', handler);
    el.addEventListener('animationend', () => el.classList.remove(cls));
  });

  /* Simple reveal when an element reaches 80% of the viewport */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -15% 0px' });

  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

  if (reduce) return;

  // Staggered badge & card entrance animation helper
  gsap.fromTo('.stagger-card',
    { opacity: 0, y: 15 },
    { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' }
  );
}
