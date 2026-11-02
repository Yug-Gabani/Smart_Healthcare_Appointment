import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion, LayoutGroup, useScroll, useSpring } from 'framer-motion';
import {
  Bell,
  ChevronDown,
  User as UserIcon,
  LogOut,
} from 'lucide-react';
import type { User } from '../types';

interface HeaderProps {
  currentUser: User | null;
  onOpenAuth: () => void;
  onOpenRegister?: () => void;
  onLogout: () => void;
  onGetCare: () => void;
  onGoHome: () => void;
}

const EASE_HEADER = [0.2, 0.65, 0.3, 0.9] as const;
const CUBIC_BEZIER_STR = 'cubic-bezier(0.2, 0.65, 0.3, 0.9)';

function getInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenAuth,
  onOpenRegister,
  onLogout,
  onGetCare,
  onGoHome,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();

  const isDoctor = currentUser?.role === 'DOCTOR';
  const isPatient = currentUser?.role === 'PATIENT';

  // Smooth scroll tracking via Framer Motion
  const { scrollY, scrollYProgress } = useScroll();
  const smoothScaleX = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    mass: 0.25,
    restDelta: 0.0001,
  });

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    return scrollY.on('change', (latest) => {
      setIsScrolled(latest > 24);
    });
  }, [scrollY]);

  // Logo hover bounce & line redraw trigger
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [hoverRedrawKey, setHoverRedrawKey] = useState(0);

  // Mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 860 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 860);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // User dropdown menu state
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userDropdownOpen]);

  useEffect(() => {
    if (!userDropdownOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserDropdownOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [userDropdownOpen]);

  // Section-anchor active state tracking (Scroll Spy for Guest Landing)
  const [activeSection, setActiveSection] = useState<'home' | 'find-care' | 'specialties' | 'how-it-works' | 'for-hospitals'>('home');

  useEffect(() => {
    if (currentUser || (location.pathname !== '/' && location.pathname !== '')) {
      return;
    }

    const checkActiveSection = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const offset = 140; // Offset for header + margin

      const findCareEl = document.getElementById('find-care') || document.getElementById('find-doctors');
      const howItWorksEl = document.getElementById('how-it-works');
      const specialtiesEl = document.getElementById('specialties');
      const forHospitalsEl = document.getElementById('for-hospitals');

      const findCareTop = findCareEl ? findCareEl.offsetTop - offset : 400;
      const howItWorksTop = howItWorksEl ? howItWorksEl.offsetTop - offset : 1100;
      const specialtiesTop = specialtiesEl ? specialtiesEl.offsetTop - offset : 1800;
      const forHospitalsTop = forHospitalsEl ? forHospitalsEl.offsetTop - offset : 2400;

      if (scrollY >= forHospitalsTop) {
        setActiveSection('for-hospitals');
      } else if (scrollY >= specialtiesTop) {
        setActiveSection('specialties');
      } else if (scrollY >= howItWorksTop) {
        setActiveSection('how-it-works');
      } else if (scrollY >= findCareTop) {
        setActiveSection('find-care');
      } else {
        setActiveSection('home');
      }
    };

    window.addEventListener('scroll', checkActiveSection, { passive: true });
    checkActiveSection();
    return () => window.removeEventListener('scroll', checkActiveSection);
  }, [currentUser, location.pathname]);

  // Active tab detection for Patient
  const isPatientDashboard = isPatient && (location.pathname === '/patient' || location.pathname === '/');
  const isBookVisit = isPatient && location.pathname === '/book';
  const isMyAppointments = isPatient && location.pathname.startsWith('/appointments');
  const isPrescriptions  = isPatient && location.pathname.startsWith('/prescriptions');
  const isHospitals      = isPatient && location.pathname.startsWith('/hospitals');

  // Active tab detection for Doctor
  const doctorHash = location.hash;
  const isDoctorQueue = isDoctor && location.pathname.startsWith('/doctor') && (!doctorHash || doctorHash === '#my-queue' || doctorHash === '#queue');
  const isDoctorAvailability = isDoctor && location.pathname.startsWith('/doctor') && doctorHash === '#availability';
  const isDoctorPatients = isDoctor && location.pathname.startsWith('/doctor') && doctorHash === '#patients';
  const isDoctorPrescriptions = isDoctor && ((location.pathname.startsWith('/doctor') && doctorHash === '#prescriptions') || location.pathname.startsWith('/prescriptions'));
  const isDoctorTranscripts = isDoctor && location.pathname.startsWith('/doctor') && doctorHash === '#transcripts';

  const wordmarkChars = ['p', 'u', 'l', 's', 'e', 'c', 'a', 'r', 'e'];

  const guestNavItems = [
    {
      id: 'home',
      label: 'Home',
      href: '/',
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        navigate('/');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setActiveSection('home');
      },
      isActive: activeSection === 'home' && (!location.hash || location.hash === '#home' || location.hash === ''),
    },
    {
      id: 'find-care',
      label: 'Find care',
      href: '#find-care',
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        const el = document.getElementById('find-care') || document.getElementById('find-doctors');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        else onGetCare();
        setActiveSection('find-care');
      },
      isActive: activeSection === 'find-care',
    },
    {
      id: 'specialties',
      label: 'Specialties',
      href: '#specialties',
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        const el = document.getElementById('specialties');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        else onGetCare();
        setActiveSection('specialties');
      },
      isActive: activeSection === 'specialties',
    },
    {
      id: 'how-it-works',
      label: 'How it works',
      href: '#how-it-works',
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        const el = document.getElementById('how-it-works');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        setActiveSection('how-it-works');
      },
      isActive: activeSection === 'how-it-works',
    },
    {
      id: 'for-hospitals',
      label: 'For Hospitals',
      href: '#for-hospitals',
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        const el = document.getElementById('for-hospitals');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        else onGetCare();
        setActiveSection('for-hospitals');
      },
      isActive: activeSection === 'for-hospitals',
    },
  ];

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          width: '100%',
          backgroundColor: isScrolled ? 'rgba(255, 255, 255, 0.92)' : '#eaf6f2',
          backdropFilter: isScrolled ? 'blur(10px) saturate(1.4)' : 'none',
          WebkitBackdropFilter: isScrolled ? 'blur(10px) saturate(1.4)' : 'none',
          borderBottom: isScrolled ? '1px solid #d9ece7' : '1px solid transparent',
          boxShadow: isScrolled ? '0 2px 10px rgba(20, 60, 55, 0.06)' : 'none',
          height: isScrolled ? '56px' : '72px',
          transition: `height 220ms ${CUBIC_BEZIER_STR}, background-color 220ms ${CUBIC_BEZIER_STR}, border-color 220ms ${CUBIC_BEZIER_STR}, box-shadow 220ms ${CUBIC_BEZIER_STR}`,
        }}
      >
        {/* Main Header Inner Content */}
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 24px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'nowrap',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          {/* LEFT: Logo mark (disc + ECG line) & wordmark ("pulsecare") */}
          <div
            onClick={onGoHome}
            onMouseEnter={() => {
              if (!reduced) {
                setIsLogoHovered(true);
                setHoverRedrawKey(k => k + 1);
              }
            }}
            onMouseLeave={() => setIsLogoHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isScrolled ? '8px' : '10px',
              cursor: 'pointer',
              flexShrink: 0,
              userSelect: 'none',
              transform: isScrolled ? 'translateX(-2px)' : 'translateX(0)',
              transition: `transform 220ms ${CUBIC_BEZIER_STR}, gap 220ms ${CUBIC_BEZIER_STR}`,
            }}
            title="pulsecare Home"
          >
            {/* Logo Mark: scale 0.8->1, opacity 0->1, 400ms */}
            <motion.div
              initial={reduced ? false : { scale: 0.8, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                rotate: isLogoHovered ? [0, -3, 1, 0] : 0,
              }}
              transition={{
                scale: { duration: 0.4, ease: 'easeOut' },
                opacity: { duration: 0.4, ease: 'easeOut' },
                rotate: { duration: 0.38, ease: [0.34, 1.56, 0.64, 1] },
              }}
              style={{
                width: isScrolled ? '24px' : '30px',
                height: isScrolled ? '24px' : '30px',
                borderRadius: '50%',
                backgroundColor: '#0f766e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                position: 'relative',
                boxShadow: '0 2px 8px rgba(15, 118, 110, 0.24)',
                transition: `width 220ms ${CUBIC_BEZIER_STR}, height 220ms ${CUBIC_BEZIER_STR}`,
              }}
            >
              {/* Primary ECG line SVG with load draw-in and hover redraw */}
              <svg
                width={isScrolled ? 14 : 17}
                height={isScrolled ? 14 : 17}
                viewBox="0 0 24 24"
                fill="none"
                style={{
                  transition: `width 220ms ${CUBIC_BEZIER_STR}, height 220ms ${CUBIC_BEZIER_STR}`,
                  overflow: 'visible',
                }}
              >
                {/* Main ECG Path (draws stroke-dashoffset: pathLength -> 0 in 700ms, 100ms after mark lands) */}
                <motion.path
                  key={`ecg-${hoverRedrawKey}`}
                  d="M2 12h4l3-7 4 14 3-7h6"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reduced ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    duration: hoverRedrawKey > 0 ? 0.3 : 0.7,
                    delay: hoverRedrawKey > 0 ? 0 : (reduced ? 0 : 0.5),
                    ease: 'easeOut',
                  }}
                />

                {/* Idle Traveling Highlight: soft white glow sliding left->right across trace every 6s */}
                {!reduced && (
                  <path
                    d="M2 12h4l3-7 4 14 3-7h6"
                    stroke="#ffffff"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ecg-travel-highlight"
                    style={{
                      fill: 'none',
                      strokeDasharray: '8 36',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </svg>
            </motion.div>

            {/* Wordmark: letters fade/rise in, 20ms stagger per character */}
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: isScrolled ? '17px' : '20px',
                fontWeight: 700,
                color: '#0b3f3a',
                letterSpacing: '-0.02em',
                lineHeight: 1,
                display: 'inline-flex',
                transition: `font-size 220ms ${CUBIC_BEZIER_STR}`,
              }}
            >
              {wordmarkChars.map((char, idx) => (
                <motion.span
                  key={idx}
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.32,
                    delay: reduced ? 0 : 0.15 + idx * 0.02,
                    ease: 'easeOut',
                  }}
                  style={{ display: 'inline-block' }}
                >
                  {char}
                </motion.span>
              ))}
            </div>
          </div>

          {/* MIDDLE: Desktop Navigation Links with sliding coral 2px underline */}
          {!isMobile && (
            <LayoutGroup id="headerNavUnderline">
              <nav
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isScrolled ? '24px' : '28px',
                  height: '100%',
                  transition: `gap 220ms ${CUBIC_BEZIER_STR}`,
                }}
              >
                {!currentUser && guestNavItems.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={reduced ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: reduced ? 0 : 0.25 + idx * 0.04,
                      ease: 'easeOut',
                    }}
                    style={{ height: '100%', display: 'flex', alignItems: 'center' }}
                  >
                    <a
                      href={item.href}
                      onClick={item.onClick}
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: '100%',
                        padding: '0 4px',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        fontSize: isScrolled ? '13px' : '14px',
                        fontWeight: item.isActive ? 600 : 500,
                        color: item.isActive ? '#0b3f3a' : '#52736d',
                        fontFamily: "'Space Grotesk', sans-serif",
                        transition: `color 150ms ease, font-size 220ms ${CUBIC_BEZIER_STR}`,
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => {
                        if (!item.isActive) e.currentTarget.style.color = '#0b3f3a';
                      }}
                      onMouseLeave={e => {
                        if (!item.isActive) e.currentTarget.style.color = '#52736d';
                      }}
                    >
                      {item.label}

                      {/* Sliding coral 2px continuous underline */}
                      {item.isActive && (
                        <motion.span
                          layoutId="navActiveUnderline"
                          transition={{
                            type: 'spring',
                            stiffness: 280,
                            damping: 28,
                          }}
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '2px',
                            backgroundColor: '#ff6b5b',
                            borderRadius: '2px',
                          }}
                        />
                      )}
                    </a>
                  </motion.div>
                ))}

                {/* Patient Navigation */}
                {isPatient && [
                  { id: 'dashboard', label: 'Dashboard', href: '/patient', active: isPatientDashboard, onClick: () => navigate('/patient') },
                  { id: 'book', label: 'Book Visit', href: '/book', active: isBookVisit, onClick: () => navigate('/book') },
                  { id: 'appointments', label: 'My Appointments', href: '/appointments', active: isMyAppointments, onClick: () => navigate('/appointments') },
                  { id: 'prescriptions', label: 'Prescriptions', href: '/prescriptions', active: isPrescriptions, onClick: () => navigate('/prescriptions') },
                  { id: 'hospitals', label: 'Hospitals', href: '/hospitals', active: isHospitals, onClick: () => navigate('/hospitals') },
                ].map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={reduced ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: reduced ? 0 : 0.25 + idx * 0.04,
                      ease: 'easeOut',
                    }}
                    style={{ height: '100%', display: 'flex', alignItems: 'center' }}
                  >
                    <a
                      href={item.href}
                      onClick={e => { e.preventDefault(); item.onClick(); }}
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: '100%',
                        padding: '0 4px',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        fontSize: isScrolled ? '13px' : '14px',
                        fontWeight: item.active ? 600 : 500,
                        color: item.active ? '#0b3f3a' : '#52736d',
                        fontFamily: "'Space Grotesk', sans-serif",
                        transition: `color 150ms ease, font-size 220ms ${CUBIC_BEZIER_STR}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                      {item.active && (
                        <motion.span
                          layoutId="navActiveUnderline"
                          transition={{
                            type: 'spring',
                            stiffness: 280,
                            damping: 28,
                          }}
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '2px',
                            backgroundColor: '#ff6b5b',
                            borderRadius: '2px',
                          }}
                        />
                      )}
                    </a>
                  </motion.div>
                ))}

                {/* Doctor Navigation */}
                {isDoctor && [
                  { id: 'queue', label: 'My Queue', href: '/doctor#my-queue', active: isDoctorQueue, onClick: () => navigate('/doctor#my-queue') },
                  { id: 'avail', label: 'Availability', href: '/doctor#availability', active: isDoctorAvailability, onClick: () => navigate('/doctor#availability') },
                  { id: 'patients', label: 'Patients', href: '/doctor#patients', active: isDoctorPatients, onClick: () => navigate('/doctor#patients') },
                  { id: 'prescriptions', label: 'Prescriptions', href: '/doctor#prescriptions', active: isDoctorPrescriptions, onClick: () => navigate('/doctor#prescriptions') },
                  { id: 'transcripts', label: 'Transcripts', href: '/doctor#transcripts', active: isDoctorTranscripts, onClick: () => navigate('/doctor#transcripts') },
                ].map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={reduced ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: reduced ? 0 : 0.25 + idx * 0.04,
                      ease: 'easeOut',
                    }}
                    style={{ height: '100%', display: 'flex', alignItems: 'center' }}
                  >
                    <a
                      href={item.href}
                      onClick={e => { e.preventDefault(); item.onClick(); }}
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: '100%',
                        padding: '0 4px',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        fontSize: isScrolled ? '13px' : '14px',
                        fontWeight: item.active ? 600 : 500,
                        color: item.active ? '#0b3f3a' : '#52736d',
                        fontFamily: "'Space Grotesk', sans-serif",
                        transition: `color 150ms ease, font-size 220ms ${CUBIC_BEZIER_STR}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                      {item.active && (
                        <motion.span
                          layoutId="navActiveUnderline"
                          transition={{
                            type: 'spring',
                            stiffness: 280,
                            damping: 28,
                          }}
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '2px',
                            backgroundColor: '#ff6b5b',
                            borderRadius: '2px',
                          }}
                        />
                      )}
                    </a>
                  </motion.div>
                ))}
              </nav>
            </LayoutGroup>
          )}

          {/* RIGHT: Action Buttons (Sign in / Sign up / "Book now" CTA) & Profile */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isScrolled ? '14px' : '18px',
              transition: `gap 220ms ${CUBIC_BEZIER_STR}`,
            }}
          >
            {!currentUser && (
              <>
                {!isMobile && (
                  <>
                    <button
                      onClick={onOpenAuth}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: isScrolled ? '13px' : '14px',
                        fontWeight: 500,
                        color: '#52736d',
                        cursor: 'pointer',
                        padding: '6px 10px',
                        fontFamily: "'Space Grotesk', sans-serif",
                        transition: `color 150ms ease, font-size 220ms ${CUBIC_BEZIER_STR}`,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#0b3f3a')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#52736d')}
                    >
                      Sign in
                    </button>
                    <button
                      onClick={onOpenRegister || onOpenAuth}
                      className="hover-lift"
                      style={{
                        backgroundColor: '#0f766e',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '14px',
                        padding: isScrolled ? '6px 14px' : '8px 18px',
                        fontSize: isScrolled ? '13px' : '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: "'Space Grotesk', sans-serif",
                        transition: `background-color 150ms ease, padding 220ms ${CUBIC_BEZIER_STR}, font-size 220ms ${CUBIC_BEZIER_STR}`,
                        boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0d655e')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0f766e')}
                    >
                      Sign up
                    </button>
                  </>
                )}

                {/* Coral "Book now" CTA: fade + scale 0.95->1, 200ms delay + 4s breathing shadow + shrink compression */}
                <motion.button
                  onClick={onGetCare}
                  className="coral-book-btn"
                  initial={reduced ? false : { opacity: 0, scale: 0.95 }}
                  animate={{
                    opacity: 1,
                    scale: isScrolled ? 0.96 : 1,
                  }}
                  transition={{
                    opacity: { duration: 0.35, delay: reduced ? 0 : 0.5, ease: 'easeOut' },
                    scale: { duration: 0.22, ease: EASE_HEADER },
                  }}
                  style={{
                    backgroundColor: '#ff6b5b',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: isScrolled ? '10px' : '14px',
                    padding: isScrolled ? '7px 16px' : '10px 22px',
                    fontSize: isScrolled ? '13px' : '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: "'Space Grotesk', sans-serif",
                    transition: `background-color 150ms ease, border-radius 220ms ${CUBIC_BEZIER_STR}, padding 220ms ${CUBIC_BEZIER_STR}`,
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e85949')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#ff6b5b')}
                >
                  Book now
                </motion.button>
              </>
            )}

            {currentUser && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {/* Notification Bell */}
                <div
                  className="icon-pop"
                  onClick={() => {
                    if (isDoctor) navigate('/doctor#my-queue');
                    else if (isPatient) navigate('/appointments');
                  }}
                  style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Notifications"
                >
                  <Bell size={isScrolled ? 17 : 19} color="#0b3f3a" style={{ transition: `all 220ms ${CUBIC_BEZIER_STR}` }} />
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-6px',
                    backgroundColor: '#ff6b5b',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 700,
                    width: '15px',
                    height: '15px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {isDoctor ? 1 : 2}
                  </span>
                </div>

                {/* User Dropdown Trigger */}
                <div ref={userDropdownRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen(prev => !prev)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: isScrolled ? '4px 8px' : '5px 10px',
                      borderRadius: '12px',
                      border: userDropdownOpen ? '1px solid #0f766e' : '1px solid transparent',
                      backgroundColor: userDropdownOpen ? '#eaf6f2' : 'transparent',
                      cursor: 'pointer',
                      fontFamily: "'Space Grotesk', sans-serif",
                      transition: 'all 150ms ease',
                      outline: 'none',
                    }}
                    onMouseEnter={e => {
                      if (!userDropdownOpen) e.currentTarget.style.backgroundColor = '#f0f9f6';
                    }}
                    onMouseLeave={e => {
                      if (!userDropdownOpen) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title="User account menu"
                    aria-expanded={userDropdownOpen}
                  >
                    {/* User Avatar Circle */}
                    <div style={{
                      width: isScrolled ? '26px' : '28px',
                      height: isScrolled ? '26px' : '28px',
                      borderRadius: '50%',
                      backgroundColor: '#0f766e',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {getInitials(currentUser.fullName)}
                    </div>
                    <span style={{
                      fontSize: isScrolled ? '13px' : '14px',
                      fontWeight: 600,
                      color: '#0b3f3a',
                      maxWidth: '160px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {currentUser.fullName || (isDoctor ? 'Doctor' : 'Patient')}
                    </span>
                    <motion.div
                      animate={{ rotate: userDropdownOpen ? 180 : 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      style={{ display: 'flex', alignItems: 'center' }}
                    >
                      <ChevronDown size={14} color="#0f766e" />
                    </motion.div>
                  </button>

                  {/* Dropdown Menu ("down scroll") */}
                  <AnimatePresence>
                    {userDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.16, ease: [0.2, 0.65, 0.3, 0.9] }}
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          right: 0,
                          minWidth: '220px',
                          backgroundColor: '#ffffff',
                          borderRadius: '16px',
                          border: '1px solid #d9ece7',
                          boxShadow: '0 12px 32px rgba(11, 63, 58, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)',
                          padding: '8px',
                          zIndex: 1000,
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >
                        {/* User Header Details */}
                        <div style={{
                          padding: '8px 10px 10px',
                          borderBottom: '1px solid #eef5f3',
                          marginBottom: '6px',
                        }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: '#0b3f3a' }}>
                            {currentUser.fullName}
                          </div>
                          {currentUser.email && (
                            <div style={{ fontSize: '12px', color: '#52736d', marginTop: '2px', wordBreak: 'break-all' }}>
                              {currentUser.email}
                            </div>
                          )}
                          <div style={{ marginTop: '6px' }}>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              backgroundColor: isDoctor ? '#dcfce7' : '#eaf6f2',
                              color: isDoctor ? '#15803d' : '#0f766e',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              display: 'inline-block',
                            }}>
                              {currentUser.role || 'PATIENT'}
                            </span>
                          </div>
                        </div>

                        {/* Profile Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            navigate(isDoctor ? '/doctor/profile' : '/profile');
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: '#0b3f3a',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontFamily: "'Space Grotesk', sans-serif",
                            textAlign: 'left',
                            transition: 'background-color 140ms ease, color 140ms ease',
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#eaf6f2'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <UserIcon size={15} color="#0f766e" />
                          <span>Profile</span>
                        </button>

                        {/* Divider */}
                        <div style={{ height: '1px', backgroundColor: '#eef5f3', margin: '6px 4px' }} />

                        {/* Sign Out Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            onLogout();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: '#dc2626',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: "'Space Grotesk', sans-serif",
                            textAlign: 'left',
                            transition: 'background-color 140ms ease, color 140ms ease',
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.08)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <LogOut size={15} color="#dc2626" />
                          <span>Sign out</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Mobile Hamburger / Morphing X Button */}
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle Navigation Menu"
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0b3f3a" strokeWidth="2.3" strokeLinecap="round">
                  <motion.line
                    animate={mobileMenuOpen ? { x1: 5, y1: 5, x2: 19, y2: 19 } : { x1: 4, y1: 7, x2: 20, y2: 7 }}
                    transition={{ duration: 0.24, ease: EASE_HEADER }}
                  />
                  <motion.line
                    animate={mobileMenuOpen ? { opacity: 0, x: -8 } : { opacity: 1, x: 0 }}
                    x1="4" y1="12" x2="20" y2="12"
                    transition={{ duration: 0.18 }}
                  />
                  <motion.line
                    animate={mobileMenuOpen ? { x1: 5, y1: 19, x2: 19, y2: 5 } : { x1: 4, y1: 17, x2: 20, y2: 17 }}
                    transition={{ duration: 0.24, ease: EASE_HEADER }}
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 2px Teal Reading Progress Bar at the bottom edge - silky smooth continuous spring transition */}
        <motion.div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            backgroundColor: '#0f766e',
            scaleX: reduced ? scrollYProgress : smoothScaleX,
            transformOrigin: '0%',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />
      </header>

      {/* Mobile Slide-Down Panel with Stagger Reveal */}
      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE_HEADER }}
            style={{
              position: 'fixed',
              top: isScrolled ? '56px' : '72px',
              left: 0,
              right: 0,
              zIndex: 49,
              backgroundColor: '#ffffff',
              borderBottom: '1px solid #d9ece7',
              boxShadow: '0 10px 24px rgba(20, 60, 55, 0.10)',
              overflow: 'hidden',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <div style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!currentUser && guestNavItems.map((item, idx) => (
                <motion.a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => {
                    item.onClick(e);
                    setMobileMenuOpen(false);
                  }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                  style={{
                    fontSize: '16px',
                    fontWeight: item.isActive ? 700 : 500,
                    color: item.isActive ? '#0f766e' : '#0b3f3a',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{item.label}</span>
                  {item.isActive && (
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ff6b5b' }} />
                  )}
                </motion.a>
              ))}

              {currentUser && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid #d9ece7' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#0f766e',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '13px',
                    }}>
                      {getInitials(currentUser.fullName)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#0b3f3a' }}>
                        {currentUser.fullName || (isDoctor ? 'Doctor' : 'Patient')}
                      </div>
                      <div style={{ fontSize: '12px', color: '#52796f' }}>
                        {currentUser.email}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (isDoctor) navigate('/doctor/profile');
                      else navigate('/profile');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #d9ece7',
                      backgroundColor: '#ffffff',
                      color: '#0b3f3a',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    <UserIcon size={16} color="#0f766e" />
                    <span>My Profile</span>
                  </button>


                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      backgroundColor: 'rgba(220, 38, 38, 0.04)',
                      color: '#dc2626',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontFamily: "'Space Grotesk', sans-serif",
                      marginTop: '6px',
                    }}
                  >
                    <LogOut size={16} color="#dc2626" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}

              {!currentUser && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px', paddingTop: '16px', borderTop: '1px solid #d9ece7' }}>
                  <button
                    onClick={() => { onOpenAuth(); setMobileMenuOpen(false); }}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      border: '1px solid #d9ece7',
                      borderRadius: '10px',
                      backgroundColor: 'transparent',
                      color: '#0b3f3a',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => { (onOpenRegister || onOpenAuth)(); setMobileMenuOpen(false); }}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      border: 'none',
                      borderRadius: '10px',
                      backgroundColor: '#0f766e',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    Sign up
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Component-scoped Micro-motion Animations & Accessibility Rules */}
      <style>{`
        /* Coral "Book now" CTA 4s subtle breathing shadow */
        @keyframes ctaBreathe {
          0%, 100% {
            box-shadow: 0 2px 8px rgba(255, 107, 91, 0.15);
          }
          50% {
            box-shadow: 0 4px 14px rgba(255, 107, 91, 0.35);
          }
        }

        .coral-book-btn {
          animation: ctaBreathe 4s ease-in-out infinite;
        }

        /* 6s traveling highlight loop across the ECG trace */
        @keyframes ecgTravelGlow {
          0% {
            stroke-dashoffset: 40;
            opacity: 0;
          }
          5% {
            opacity: 0.95;
          }
          32% {
            stroke-dashoffset: -40;
            opacity: 0.95;
          }
          40%, 100% {
            stroke-dashoffset: -40;
            opacity: 0;
          }
        }

        .ecg-travel-highlight {
          animation: ecgTravelGlow 6s ease-in-out infinite;
        }

        /* Accessibility: Prefers Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          .coral-book-btn {
            animation: none !important;
            box-shadow: 0 2px 10px rgba(20, 60, 55, 0.08) !important;
          }
          .ecg-travel-highlight {
            animation: none !important;
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};
