import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  MapPin,
  ArrowRight,
  Star,
  Check,
  ClipboardList,
  Video,
  Building2,
  Loader2,
  X,
  LogIn,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Hospital, DoctorReview } from '../types';
import { publicHospitalsApi, reviewsApi } from '../services/api';
import { CustomSelect } from './CustomSelect';
import { PageTransition } from '../motion/PageTransition';
import { listItem, staggerContainer, EASE_ENTER } from '../motion/presets';
import BodyMapHero from './BodyMapHero';

interface LandingPageProps {
  onSelectDoctor?: (doctorName: string) => void;
  onBookSpecialty?: (specialtyOrTarget: string) => void;
  onGetCare?: (targetUrl?: string) => void;
  onSignIn?: () => void;
}

// Wireframe placeholder box with diagonal lines and centered text
const WireframeImagePlaceholder: React.FC<{ text: string; height?: number }> = ({
  text,
  height = 180,
}) => (
  <div style={{
    position: 'relative',
    width: '100%',
    height: `${height}px`,
    backgroundColor: '#eaf6f2',
    borderRadius: '14px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      <line x1="0" y1="0" x2="100%" y2="100%" stroke="#d9ece7" strokeWidth="1.2" />
      <line x1="100%" y1="0" x2="0" y2="100%" stroke="#d9ece7" strokeWidth="1.2" />
    </svg>
    <span style={{
      position: 'relative',
      fontSize: '11px',
      color: '#52736d',
      fontWeight: 500,
      backgroundColor: '#ffffff',
      border: '1px solid #d9ece7',
      padding: '3px 8px',
      borderRadius: '4px',
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      {text}
    </span>
  </div>
);

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectDoctor,
  onBookSpecialty,
  onGetCare,
}) => {
  const navigate = useNavigate();
  const [city, setCity] = useState('Ahmedabad');
  const [searchQuery, setSearchQuery] = useState('');

  // Live hospital search (public endpoint — works for unauthenticated visitors).
  const [results, setResults] = useState<Hospital[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState<Hospital | null>(null);
  const [reviews, setReviews] = useState<DoctorReview[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    reviewsApi.landing(6)
      .then((data) => {
        if (data && data.length > 0) setReviews(data);
      })
      .catch(() => {});
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchQuery.trim();
    // Only query and suggest when the user actually types a name
    if (!q) {
      setResults([]);
      setShowResults(false);
      setSearching(false);
      return;
    }

    const cityParam = city && city !== 'All India' ? city : undefined;
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      publicHospitalsApi.search({ q, city: cityParam, limit: 8 })
        .then(list => {
          setResults(list);
          setShowResults(true);
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, city]);

  const goToAuth = (mode: 'login' | 'signup', nextPath?: string) => {
    const nextParam = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
    navigate(`/${mode}${nextParam}`);
  };

  return (
    <PageTransition style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px 24px 80px 24px',
      color: '#0b3f3a',
      fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
    }}>
      {/* HERO SECTION */}
      <section style={{
        textAlign: 'center',
        maxWidth: '860px',
        margin: '0 auto 64px auto',
        padding: '48px 24px 44px 24px',
        borderRadius: '16px',
        background: 'linear-gradient(180deg, #eaf6f2 0%, #def0eb 60%, #eaf6f2 100%)',
      }}>
        {/* Verified by doctors Pill Badge - Coral uppercase eyebrow */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#ffffff',
          color: '#ff6b5b',
          fontSize: '12px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          padding: '6px 16px',
          borderRadius: '9999px',
          marginBottom: '24px',
          border: '1px solid #d9ece7',
          boxShadow: '0 2px 8px rgba(20, 60, 55, 0.04)',
        }}>
          <Check size={13} strokeWidth={2.5} color="#ff6b5b" />
          <span>VERIFIED BY DOCTORS</span>
        </div>

        {/* Hero Headline (Space Grotesk 700, deep teal) */}
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '56px',
          lineHeight: '1.05',
          fontWeight: 700,
          color: '#0b3f3a',
          margin: '0 0 20px 0',
          letterSpacing: '-0.03em',
        }}>
          Care that starts before<br />the appointment.
        </h1>

        {/* Subtitle (Space Grotesk 400-500, ink body) */}
        <p style={{
          fontSize: '18px',
          lineHeight: '1.55',
          color: '#52736d',
          margin: '0 auto 40px auto',
          maxWidth: '560px',
          fontWeight: 400,
        }}>
          Book a doctor, upload what's bothering you, and<br />
          get seen faster when it matters.
        </p>

        {/* Search Band Card - white pill container with 6px inner padding + teal button inside */}
        <div id="for-hospitals" ref={searchContainerRef} style={{ position: 'relative', maxWidth: '740px', margin: '0 auto' }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '9999px',
          padding: '6px 8px 6px 20px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
          border: '1px solid #d9ece7',
          gap: '12px',
        }}>
          {/* Location Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#0b3f3a',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            paddingRight: '14px',
            borderRight: '1px solid #d9ece7',
            cursor: 'pointer',
          }}>
            <MapPin size={16} color="#0f766e" />
            <CustomSelect
              value={city}
              options={[
                'All India',
                'Ahmedabad',
                'Gandhinagar',
                'Mumbai',
                'Delhi',
                'Bengaluru Urban',
                'Pune',
                'Chennai',
              ]}
              onChange={setCity}
              searchable={true}
              searchPlaceholder="Search city…"
              variant="borderless"
            />
          </div>

          {/* Search Input */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <Search size={16} color="#0f766e" />
            <input
              type="text"
              placeholder="Search hospitals by name (e.g. Apollo, Lilavati)"
              value={searchQuery}
              onChange={e => {
                const val = e.target.value;
                setSearchQuery(val);
                if (!val.trim()) {
                  setShowResults(false);
                  setResults([]);
                }
              }}
              onFocus={() => { if (searchQuery.trim() && results.length) setShowResults(true); }}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                fontSize: '14px',
                color: '#0b3f3a',
                background: 'transparent',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            />
            {searching && <Loader2 size={14} className="animate-spin" color="#0f766e" />}
          </div>

          {/* Solid Teal Search Button */}
          <button
            onClick={() => onGetCare?.()}
            className="hover-lift"
            style={{
              backgroundColor: '#0f766e',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.15s ease',
              whiteSpace: 'nowrap',
              fontFamily: "'Space Grotesk', sans-serif",
              boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0d655e')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0f766e')}
          >
            <span>Search</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Live-results dropdown */}
        <AnimatePresence>
          {showResults && searchQuery.trim() && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18, ease: EASE_ENTER }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0, right: 0,
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #d9ece7',
                boxShadow: '0 10px 24px rgba(20, 60, 55, 0.10)',
                maxHeight: '360px', overflowY: 'auto',
                zIndex: 20, textAlign: 'left',
              }}
            >
              {results.map(h => (
                <button
                  key={h.id}
                  onClick={() => { setPreview(h); setShowResults(false); }}
                  className="card-hover"
                  style={{
                    display: 'block', width: '100%',
                    padding: '12px 16px',
                    border: 'none', borderBottom: '1px solid #d9ece7',
                    backgroundColor: 'transparent',
                    textAlign: 'left', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#eaf6f2')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0b3f3a' }}>
                    {h.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#52736d', marginTop: '2px' }}>
                    <MapPin size={11} color="#0f766e" style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    {[h.city, h.state].filter(Boolean).join(', ') || 'Location unknown'}
                    {h.specialties.length > 0 && (
                      <span> · {h.specialties.length} specialt{h.specialties.length === 1 ? 'y' : 'ies'}</span>
                    )}
                  </div>
                </button>
              ))}
              <button
                onClick={() => { setShowResults(false); }}
                style={{
                  display: 'block', width: '100%', padding: '8px',
                  background: 'transparent', border: 'none',
                  fontSize: '11px', color: '#8aa39d', cursor: 'pointer',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Close results
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {showResults && !searching && results.length === 0 && searchQuery.trim() && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)',
            left: 0, right: 0,
            backgroundColor: '#ffffff', borderRadius: '16px',
            border: '1px solid #d9ece7', padding: '18px',
            fontSize: '13px', color: '#52736d', textAlign: 'left', zIndex: 20,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            No hospitals match "{searchQuery}" in {city}.
          </div>
        )}
        </div>
      </section>

      {/* Hospital preview modal */}
      <AnimatePresence mode="wait">
        {preview && (
          <HospitalPreviewModal
            key={preview.id}
            hospital={preview}
            onClose={() => setPreview(null)}
            onLogin={() => goToAuth('login', `/hospitals/${preview.id}`)}
            onSignup={() => goToAuth('signup', `/hospitals/${preview.id}`)}
          />
        )}
      </AnimatePresence>

      {/* SECTION B: 4 CATEGORY TILES */}
      <motion.section
        id="find-care"
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: '-20px' }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '24px',
          marginBottom: '72px',
        }}
      >
        {[
          {
            image: '/video-consult.jpg',
            title: 'Video Consult',
            subtitle: 'Connect in 60s',
          },
          {
            image: '/find-doctors.jpg',
            title: 'Find Doctors Near You',
            subtitle: '27k+ hospitals',
          },
          {
            image: '/my-records.jpg',
            title: 'My Records',
            subtitle: 'Visits + meds',
          },
          {
            image: '/order-medicine.jpg',
            title: 'Order Medicine',
            subtitle: 'Fast delivery',
          },
        ].map((tile, idx) => (
          <motion.div
            key={idx}
            variants={listItem}
            id={idx === 0 ? 'video-consult' : idx === 1 ? 'find-doctors' : undefined}
            onClick={() => onGetCare?.()}
            className="card-hover"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '16px',
              border: '1px solid #d9ece7',
              boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: '100%',
              height: '180px',
              borderRadius: '10px',
              overflow: 'hidden',
              backgroundColor: '#eaf6f2',
            }}>
              <img
                src={tile.image}
                alt={tile.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  transition: 'transform 0.3s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              />
            </div>
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0b3f3a', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}>
                {tile.title}
              </div>
              <div style={{ fontSize: '13px', color: '#52736d', marginTop: '4px' }}>
                {tile.subtitle}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.section>

      {/* SECTION C: BODY MAP HERO */}
      <BodyMapHero
        onStartTriage={(hotspotId) => {
          const target = `/book?hotspot=${encodeURIComponent(hotspotId)}`;
          try {
            sessionStorage.setItem('pulsecare_pending_hotspot', hotspotId);
          } catch {}
          if (onBookSpecialty) {
            onBookSpecialty(target);
          } else if (onGetCare) {
            onGetCare(target);
          } else {
            navigate(target);
          }
        }}
        onCustomTriage={(cause) => {
          const target = cause ? `/book?complaint=${encodeURIComponent(cause)}` : '/book';
          try {
            if (cause) sessionStorage.setItem('pulsecare_pending_complaint', cause);
          } catch {}
          if (onGetCare) {
            onGetCare(target);
          } else {
            navigate(target);
          }
        }}
      />

      {/* SECTION D: HOW PULSECARE WORKS */}
      <section
        id="how-it-works"
        style={{
        textAlign: 'center',
        margin: '0 auto 72px auto',
        maxWidth: '860px',
      }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#0b3f3a',
          marginBottom: '36px',
          letterSpacing: '-0.02em',
          lineHeight: '1.05',
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          How PulseCare works
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '24px',
        }}>
          {[
            {
              num: '01',
              icon: <Search size={18} color="#0f766e" />,
              title: 'Find your doctor',
            },
            {
              num: '02',
              icon: <ClipboardList size={18} color="#0f766e" />,
              title: 'Fill a quick questionnaire',
            },
            {
              num: '03',
              icon: <Video size={18} color="#0f766e" />,
              title: 'See the doctor in person or video',
            },
          ].map((step, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                backgroundColor: '#ffffff',
                border: '1px solid #d9ece7',
                boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '2px',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#ff6b5b', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {step.num}
                </span>
                {step.icon}
              </div>
              <div style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#0b3f3a',
                maxWidth: '200px',
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                {step.title}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* STATS STRIP: Space Grotesk 700 big numerals with one accent stat in coral */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '20px',
        margin: '0 auto 72px auto',
        padding: '36px 28px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #d9ece7',
        boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
        textAlign: 'center',
      }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '40px', fontWeight: 700, color: '#0b3f3a', lineHeight: '1.05', letterSpacing: '-0.03em' }}>
            27,000+
          </div>
          <div style={{ fontSize: '14px', color: '#52736d', marginTop: '8px', fontWeight: 500 }}>
            Hospitals covered
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '40px', fontWeight: 700, color: '#ff6b5b', lineHeight: '1.05', letterSpacing: '-0.03em' }}>
            &lt; 60s
          </div>
          <div style={{ fontSize: '14px', color: '#52736d', marginTop: '8px', fontWeight: 500 }}>
            Average triage time
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '40px', fontWeight: 700, color: '#0b3f3a', lineHeight: '1.05', letterSpacing: '-0.03em' }}>
            10,000+
          </div>
          <div style={{ fontSize: '14px', color: '#52736d', marginTop: '8px', fontWeight: 500 }}>
            Verified doctors
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '40px', fontWeight: 700, color: '#0b3f3a', lineHeight: '1.05', letterSpacing: '-0.03em' }}>
            99.4%
          </div>
          <div style={{ fontSize: '14px', color: '#52736d', marginTop: '8px', fontWeight: 500 }}>
            Patient satisfaction
          </div>
        </div>
      </section>

      {/* SECTION E: BOOK AN IN-CLINIC APPOINTMENT (4 Doctor Cards) */}
      <section style={{ marginBottom: '72px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
        }}>
          <h2 style={{
            fontSize: '26px',
            fontWeight: 700,
            color: '#0b3f3a',
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: '1.05',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Book an in-clinic appointment
          </h2>
          <a
            href="#all-doctors"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#0f766e',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            See all doctors →
          </a>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '24px',
        }}>
          {[
            {
              name: 'Dr. Shah',
              specialty: 'Cardiology · Apollo',
              rating: '4.8',
              slot: 'Next 2pm',
              fee: '₹600',
            },
            {
              name: 'Dr. Mehta',
              specialty: 'Pediatrics · Civil',
              rating: '4.9',
              slot: 'Next 5pm',
              fee: '₹500',
            },
            {
              name: 'Dr. Rao',
              specialty: 'Dermatology · KD',
              rating: '4.7',
              slot: 'Tomorrow',
              fee: '₹400',
            },
            {
              name: 'Dr. Iyer',
              specialty: 'General Medicine · Zydus',
              rating: '4.6',
              slot: 'Today',
              fee: '₹300',
            },
          ].map((doc, idx) => (
            <div
              key={idx}
              className="card-hover"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                padding: '16px',
                border: '1px solid #d9ece7',
                boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <WireframeImagePlaceholder text="Doctor photo" height={160} />
                <div style={{ marginTop: '14px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0b3f3a', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {doc.name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#52736d', marginTop: '2px' }}>
                    {doc.specialty}
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '12px',
                    fontSize: '13px',
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600,
                      color: '#0b3f3a',
                    }}>
                      <Star size={13} fill="#ff6b5b" color="#ff6b5b" />
                      {doc.rating}
                    </span>
                    <span style={{ color: '#52736d', fontSize: '12px' }}>{doc.slot}</span>
                  </div>

                  <div style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#0b3f3a',
                    marginTop: '8px',
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    {doc.fee}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <button
                  onClick={() => onSelectDoctor?.(doc.name)}
                  className="hover-lift"
                  style={{
                    width: '100%',
                    backgroundColor: '#0f766e',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '10px 0',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    fontFamily: "'Space Grotesk', sans-serif",
                    boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0d655e')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0f766e')}
                >
                  Book
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION F: BROWSE BY SPECIALTY (12 tiles with Full Names) */}
      <section
        id="specialties"
        style={{
        textAlign: 'center',
        marginBottom: '64px',
      }}>
        <h2 style={{
          fontSize: '26px',
          fontWeight: 700,
          color: '#0b3f3a',
          marginBottom: '28px',
          letterSpacing: '-0.02em',
          lineHeight: '1.05',
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          Browse by specialty
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
          gap: '14px',
        }}>
          {[
            { name: 'Cardiology', count: '142 doctors' },
            { name: 'Dermatology', count: '76 doctors' },
            { name: 'ENT Specialist', count: '51 doctors' },
            { name: 'General Medicine', count: '203 doctors' },
            { name: 'Gynecology', count: '98 doctors' },
            { name: 'Neurology', count: '44 doctors' },
            { name: 'Orthopedics', count: '118 doctors' },
            { name: 'Pediatrics', count: '89 doctors' },
            { name: 'Psychiatry', count: '22 doctors' },
            { name: 'Pulmonology', count: '29 doctors' },
            { name: 'Urology', count: '47 doctors' },
            { name: 'Ophthalmology', count: '61 doctors' },
          ].map((spec, idx) => (
            <div
              key={idx}
              onClick={() => onBookSpecialty?.(spec.name)}
              className="card-hover"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                padding: '16px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                border: '1px solid #d9ece7',
                boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
              }}
            >
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#0b3f3a', fontFamily: "'Space Grotesk', sans-serif" }}>
                {spec.name}
              </div>
              <div style={{ fontSize: '12px', color: '#52736d', marginTop: '2px' }}>
                {spec.count}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION: VERIFIED PATIENT REVIEWS & RATINGS */}
      <section style={{ marginBottom: '72px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#eaf6f2',
            color: '#0f766e',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '4px 12px',
            borderRadius: '9999px',
            marginBottom: '10px',
          }}>
            <ShieldCheck size={14} /> Verified Patient Reviews
          </span>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#0b3f3a',
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Trusted care, rated by real patients
          </h2>
          <p style={{ fontSize: '14px', color: '#52736d', margin: 0, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
            Every review is submitted by a verified patient following a completed video or hospital consultation.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
        }}>
          {(reviews.length > 0
            ? reviews
            : [
                {
                  id: 'default-1',
                  appointmentId: 'apt-1',
                  doctorId: 'doc-1',
                  doctorName: 'Dr. Aarav Patel',
                  doctorSpecialty: 'Cardiologist',
                  patientName: 'Rohan M.',
                  rating: 5,
                  comment: 'Dr. Patel took the time to review my ECG thoroughly and explained each step of my treatment plan. I felt genuinely heard and well taken care of.',
                  tags: 'Thorough & Attentive, Clear Explanations',
                  isAnonymous: false,
                  createdAt: '2 days ago',
                },
                {
                  id: 'default-2',
                  appointmentId: 'apt-2',
                  doctorId: 'doc-2',
                  doctorName: 'Dr. Priya Sharma',
                  doctorSpecialty: 'Dermatologist',
                  patientName: 'Ananya S.',
                  rating: 5,
                  comment: 'The video consultation was seamless. I uploaded my rash photo during triage, and Dr. Priya had diagnosed the reaction before the call even started!',
                  tags: 'Punctual, Accurate Treatment',
                  isAnonymous: false,
                  createdAt: '4 days ago',
                },
                {
                  id: 'default-3',
                  appointmentId: 'apt-3',
                  doctorId: 'doc-3',
                  doctorName: 'Dr. Vikram Desai',
                  doctorSpecialty: 'General Physician',
                  patientName: 'Meera K.',
                  rating: 5,
                  comment: 'Very polite, patient, and knowledgeable. The digital prescription and follow-up guidelines were sent right to my account instantly.',
                  tags: 'Empathetic & Kind, Great Follow-up',
                  isAnonymous: false,
                  createdAt: '1 week ago',
                },
              ]
          ).map((rev) => (
            <div
              key={rev.id}
              className="card-hover"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #d9ece7',
                padding: '22px',
                boxShadow: '0 2px 12px rgba(11, 63, 58, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                {/* Doctor Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0b3f3a', fontFamily: "'Space Grotesk', sans-serif" }}>
                      {rev.doctorName ?? 'Consulting Physician'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#52736d' }}>
                      {rev.doctorSpecialty ?? 'Specialist'}
                    </div>
                  </div>
                  {/* Stars */}
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={15}
                        color={i < rev.rating ? '#f59e0b' : '#d1d5db'}
                        fill={i < rev.rating ? '#f59e0b' : 'transparent'}
                      />
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <p style={{
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: '#2d4b45',
                  margin: '0 0 14px 0',
                  fontStyle: rev.comment ? 'normal' : 'italic',
                }}>
                  {rev.comment ? `“${rev.comment}”` : '“Exceptional and prompt clinical consultation.”'}
                </p>

                {/* Tags */}
                {rev.tags && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {rev.tags.split(',').map((t, tidx) => (
                      <span
                        key={tidx}
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: '#eaf6f2',
                          color: '#0f766e',
                          padding: '2px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        {t.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Patient Footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: '1px solid #eaf6f2',
                fontSize: '11px',
                color: '#52736d',
              }}>
                <span style={{ fontWeight: 600, color: '#0b3f3a' }}>
                  {rev.isAnonymous ? 'Verified Patient' : (rev.patientName || 'Verified Patient')}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0f766e' }}>
                  <ShieldCheck size={12} /> Verified Visit
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION G: TRUST STRIP */}
      <section style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '40px',
        padding: '24px 0',
        marginBottom: '64px',
        borderTop: '1px solid #d9ece7',
        borderBottom: '1px solid #d9ece7',
        fontSize: '13px',
        fontWeight: 500,
        color: '#52736d',
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={14} color="#0f766e" strokeWidth={2.5} />
          <span>Verified doctors</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={14} color="#0f766e" strokeWidth={2.5} />
          <span>Encrypted records</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={14} color="#0f766e" strokeWidth={2.5} />
          <span>No data sold</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={14} color="#0f766e" strokeWidth={2.5} />
          <span>24/7 availability</span>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        fontSize: '13px',
        color: '#52736d',
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '36px',
          marginBottom: '40px',
        }}>
          <div>
            <div style={{
              fontWeight: 700,
              color: '#0b3f3a',
              marginBottom: '10px',
              fontSize: '18px',
              letterSpacing: '-0.02em',
            }}>
              pulsecare
            </div>
            <div style={{ lineHeight: '1.9', color: '#52736d' }}>Group 6<br />IT314<br />DA-IICT</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#0b3f3a', marginBottom: '10px' }}>For Patients</div>
            <div style={{ lineHeight: '1.9', color: '#52736d' }}>
              <div>Find doctors</div>
              <div>Book appt</div>
              <div>My account</div>
              <div>Download app</div>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#0b3f3a', marginBottom: '10px' }}>For Providers</div>
            <div style={{ lineHeight: '1.9', color: '#52736d' }}>
              <div>For doctors</div>
              <div>For hospitals</div>
              <div>For pharmacies</div>
              <div>Partner with us</div>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#0b3f3a', marginBottom: '10px' }}>Legal</div>
            <div style={{ lineHeight: '1.9', color: '#52736d' }}>
              <div>Privacy</div>
              <div>Terms</div>
              <div>Help</div>
              <div>Contact</div>
            </div>
          </div>
        </div>

        <div style={{
          paddingTop: '24px',
          borderTop: '1px solid #d9ece7',
          fontSize: '12px',
          color: '#8aa39d',
        }}>
          © 2026 pulsecare – Group 6 – IT314 – DA-IICT
        </div>
      </footer>
    </PageTransition>
  );
};

/** Preview panel shown when an unauthenticated visitor clicks a hospital search result. */
const HospitalPreviewModal: React.FC<{
  hospital: Hospital;
  onClose: () => void;
  onLogin: () => void;
  onSignup: () => void;
}> = ({ hospital, onClose, onLogin, onSignup }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.18, ease: EASE_ENTER }}
    style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      backgroundColor: 'rgba(11, 63, 58, 0.45)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Space Grotesk', sans-serif",
    }}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      transition={{ duration: 0.22, ease: EASE_ENTER }}
      style={{
        backgroundColor: '#ffffff', borderRadius: '16px',
        maxWidth: '600px', width: '100%', maxHeight: '88vh', overflow: 'auto',
        boxShadow: '0 10px 24px rgba(20, 60, 55, 0.10)',
        border: '1px solid #d9ece7',
        padding: '28px',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '10px',
            backgroundColor: '#eaf6f2', color: '#0f766e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building2 size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0b3f3a', letterSpacing: '-0.02em' }}>
              {hospital.name}
            </h2>
            <div style={{ fontSize: '13px', color: '#52736d', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} color="#0f766e" />
              {[hospital.city, hospital.state].filter(Boolean).join(', ') || 'Location unknown'}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="icon-pop"
          style={{ background: 'transparent', border: 'none', color: '#52736d', cursor: 'pointer', padding: '4px' }}
        >
          <X size={20} />
        </button>
      </div>

      {hospital.address && (
        <div style={{ fontSize: '13px', color: '#52736d', marginBottom: '14px' }}>
          {hospital.address}
          {hospital.pincode ? ` — ${hospital.pincode}` : ''}
        </div>
      )}

      <div style={{
        fontSize: '11px', fontWeight: 700, color: '#0f766e',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px',
      }}>
        Available specialties ({hospital.specialties.length})
      </div>
      {hospital.specialties.length === 0 ? (
        <div style={{
          padding: '14px', borderRadius: '10px',
          backgroundColor: '#eaf6f2', border: '1px solid #d9ece7',
          fontSize: '13px', color: '#52736d',
          marginBottom: '18px',
        }}>
          Specialty details are not published for this hospital in the government directory.
          You can still find a doctor via symptom triage after signing in.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '18px' }}>
          {hospital.specialties.map(s => (
            <span key={s} className="chip" style={{
              padding: '4px 12px', borderRadius: '9999px',
              fontSize: '12px', color: '#0b3f3a',
              backgroundColor: '#eaf6f2', border: '1px solid #d9ece7',
              fontFamily: "'Space Grotesk', sans-serif",
            }}>{s}</span>
          ))}
        </div>
      )}

      {/* Auth CTA panel */}
      <div style={{
        padding: '18px 20px', borderRadius: '14px',
        backgroundColor: '#eaf6f2',
        border: '1px solid #d9ece7',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0b3f3a', marginBottom: '4px' }}>
          Sign in to book an appointment
        </div>
        <div style={{ fontSize: '13px', color: '#52736d', marginBottom: '14px' }}>
          You need an account to run symptom triage and book a slot with a doctor at this hospital.
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={onLogin}
            className="hover-lift"
            style={{
              backgroundColor: '#ff6b5b', color: '#ffffff', border: 'none',
              borderRadius: '14px', padding: '10px 20px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          ><LogIn size={14} /> Log in</button>
          <button
            onClick={onSignup}
            className="hover-lift"
            style={{
              backgroundColor: '#0f766e', color: '#ffffff',
              border: 'none',
              borderRadius: '14px', padding: '10px 20px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          ><UserPlus size={14} /> Sign up</button>
        </div>
      </div>
    </motion.div>
  </motion.div>
);
