import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  MapPin,
  ArrowRight,
  Star,
  Check,
  Building2,
  Loader2,
  X,
  LogIn,
  UserPlus,
  Stethoscope,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Hospital, DoctorReview } from '../types';
import { publicHospitalsApi, reviewsApi } from '../services/api';
import { CustomSelect } from './CustomSelect';
import { PageTransition } from '../motion/PageTransition';
import { EASE_ENTER } from '../motion/presets';
import BodyMapHero from './BodyMapHero';
import SpecialtyGrid from './SpecialtyGrid';

interface LandingPageProps {
  onSelectDoctor?: (doctorName: string) => void;
  onBookSpecialty?: (specialtyOrTarget: string) => void;
  onGetCare?: (targetUrl?: string) => void;
  onSignIn?: () => void;
}

/* =========================================================
 * Design direction (see unslop audit):
 *   Product: triage-first healthcare booking for Indian patients
 *   Character: calm, exact, a little warm
 *   World: paper charts, exam-room light, filled prescription on wood
 *   Moments: (1) body-map section = how triage starts,
 *            (2) hero-right preview card = what triage produces
 *   Signature: live urgency chip (coloured dot + two words), used
 *              ONLY where a real verdict is shown — never decoration.
 * =======================================================*/

const FONT = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";

export const LandingPage: React.FC<LandingPageProps> = ({
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
      .then(data => { if (data && data.length) setReviews(data); })
      .catch(() => {});
  }, []);

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
    if (!q) { setResults([]); setShowResults(false); setSearching(false); return; }
    const cityParam = city && city !== 'All India' ? city : undefined;
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      publicHospitalsApi.search({ q, city: cityParam, limit: 8 })
        .then(list => { setResults(list); setShowResults(true); })
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
      maxWidth: 1440,
      margin: '0 auto',
      padding: '48px clamp(20px, 4vw, 56px) 96px',
      color: '#0b3f3a',
      fontFamily: FONT,
    }}>
      <style>{`
        .lp-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,520px);gap:64px;align-items:center;margin-bottom:96px}
        .lp-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        @media(max-width:1024px){.lp-hero{grid-template-columns:1fr;gap:48px}}
        @media(max-width:768px){.lp-tiles{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:480px){.lp-tiles{grid-template-columns:1fr}}
      `}</style>

      {/* ============ HERO ============ */}
      <section className="lp-hero">

        {/* Left: text + search */}
        <div>
          <h1 style={{
            font: `600 56px/1.05 ${FONT}`,
            letterSpacing: '-0.025em',
            color: '#0b3f3a',
            margin: '0 0 20px',
            maxWidth: 560,
          }}>
            See a doctor before your symptom gets worse
          </h1>
          <p style={{
            font: `400 17px/1.5 ${FONT}`,
            color: '#52736d',
            margin: '0 0 36px',
            maxWidth: 460,
          }}>
            Describe what&rsquo;s bothering you. We classify urgency, suggest
            the right specialty, and book a slot at a hospital near you.
          </p>

          {/* Primary + secondary action */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 40, flexWrap: 'wrap' }}>
            <button
              onClick={() => onGetCare?.('/book')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#0f766e', color: '#fff', border: 'none',
                borderRadius: 10, padding: '14px 24px',
                font: `500 15px ${FONT}`, cursor: 'pointer',
                transition: 'background-color 160ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0d655e')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0f766e')}
            >
              Start symptom check <ArrowRight size={16} strokeWidth={1.75} />
            </button>
            <button
              onClick={() => { document.getElementById('specialties')?.scrollIntoView({ behavior: 'smooth' }); }}
              style={{
                background: 'transparent', color: '#0b3f3a',
                border: '1px solid #d3e2dd', borderRadius: 10,
                padding: '14px 24px', font: `500 15px ${FONT}`, cursor: 'pointer',
              }}
            >
              Browse specialties
            </button>
          </div>

          {/* Search a hospital by name — secondary entry */}
          <div ref={searchContainerRef} style={{ position: 'relative', maxWidth: 560 }}>
            <div style={{
              font: `500 12px ${FONT}`, color: '#8aa39d', marginBottom: 8,
            }}>
              Or look up a specific hospital
            </div>
            <div style={{
              background: '#fff', border: '1px solid #d9ece7', borderRadius: 10,
              display: 'flex', alignItems: 'stretch',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '0 12px', borderRight: '1px solid #e5efeb',
              }}>
                <MapPin size={14} color="#0f766e" strokeWidth={1.75} />
                <CustomSelect
                  value={city}
                  options={['All India', 'Ahmedabad', 'Gandhinagar', 'Mumbai', 'Delhi', 'Bengaluru Urban', 'Pune', 'Chennai']}
                  onChange={setCity}
                  searchable={true}
                  searchPlaceholder="Search city"
                  variant="borderless"
                />
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px' }}>
                <Search size={14} color="#8aa39d" strokeWidth={1.75} />
                <input
                  type="text"
                  placeholder="Apollo, Lilavati, Kokilaben..."
                  value={searchQuery}
                  onChange={e => {
                    const v = e.target.value;
                    setSearchQuery(v);
                    if (!v.trim()) { setShowResults(false); setResults([]); }
                  }}
                  onFocus={() => { if (searchQuery.trim() && results.length) setShowResults(true); }}
                  style={{
                    width: '100%', border: 'none', outline: 'none',
                    padding: '12px 0', font: `400 14px ${FONT}`,
                    color: '#0b3f3a', background: 'transparent',
                  }}
                />
                {searching && <Loader2 size={14} className="animate-spin" color="#0f766e" strokeWidth={1.75} />}
              </div>
            </div>

            {/* Live-results dropdown */}
            <AnimatePresence>
              {showResults && searchQuery.trim() && results.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.16, ease: EASE_ENTER }}
                  style={{
                    position: 'absolute', top: 'calc(100% + 8px)',
                    left: 0, right: 0,
                    background: '#fff', borderRadius: 12,
                    border: '1px solid #d9ece7',
                    boxShadow: '0 8px 24px rgba(11, 63, 58, 0.08)',
                    maxHeight: 360, overflowY: 'auto', zIndex: 20,
                  }}
                >
                  {results.map(h => (
                    <button
                      key={h.id}
                      onClick={() => { setPreview(h); setShowResults(false); }}
                      style={{
                        display: 'block', width: '100%',
                        padding: '12px 16px', border: 'none',
                        borderBottom: '1px solid #eef5f3',
                        background: 'transparent', textAlign: 'left',
                        cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'background-color 120ms ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f4faf8')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ font: `500 14px ${FONT}`, color: '#0b3f3a' }}>
                        {h.name}
                      </div>
                      <div style={{ font: `400 12px ${FONT}`, color: '#52736d', marginTop: 2 }}>
                        {[h.city, h.state].filter(Boolean).join(', ') || 'Location unknown'}
                        {h.specialties.length > 0 && (
                          <> &middot; {h.specialties.length} specialt{h.specialties.length === 1 ? 'y' : 'ies'}</>
                        )}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {showResults && !searching && results.length === 0 && searchQuery.trim() && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                background: '#fff', borderRadius: 12,
                border: '1px solid #d9ece7', padding: 16,
                font: `400 13px ${FONT}`, color: '#52736d',
                boxShadow: '0 8px 24px rgba(11, 63, 58, 0.08)', zIndex: 20,
              }}>
                No hospitals match &ldquo;{searchQuery}&rdquo; in {city}.
              </div>
            )}
          </div>
        </div>

        {/* Right: triage-result preview card (the signature moment).
            Shows what the app PRODUCES — not a stock photo of a doctor.
            Rendered entirely in code so it stays crisp on every density. */}
        <TriageResultPreview />
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

      {/* ============ 4 ENTRY POINTS (tiles) ============ */}
      <section id="find-care" style={{ marginBottom: 96 }}>
        <div style={{ font: `500 13px ${FONT}`, color: '#8aa39d', marginBottom: 20 }}>
          Ways to start
        </div>
        <div className="lp-tiles">
          {[
            { image: '/video-consult.jpg',  title: 'Video consult',      sub: 'Private call with a doctor',       href: '/book' },
            { image: '/find-doctors.jpg',    title: 'Find doctors',       sub: 'By city or specialty',             href: '/hospitals' },
            { image: '/my-records.jpg',      title: 'Your records',       sub: 'Visits and prescriptions',         href: '/appointments' },
            { image: '/order-medicine.jpg',  title: 'Order medicine',     sub: 'Delivered to you',                 href: '/prescriptions' },
          ].map(tile => (
            <button
              key={tile.title}
              onClick={() => onGetCare?.(tile.href)}
              style={{
                background: '#fff', border: '1px solid #d9ece7',
                borderRadius: 16, padding: 16, cursor: 'pointer',
                textAlign: 'left', fontFamily: FONT,
                transition: 'border-color 160ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#b8d4cc')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#d9ece7')}
            >
              <div style={{
                width: '100%', height: 148, borderRadius: 10,
                overflow: 'hidden', background: '#eaf6f2', marginBottom: 16,
              }}>
                <img
                  src={tile.image}
                  alt={tile.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
              <div style={{ font: `600 16px ${FONT}`, color: '#0b3f3a' }}>{tile.title}</div>
              <div style={{ font: `400 13px ${FONT}`, color: '#52736d', marginTop: 4 }}>{tile.sub}</div>
            </button>
          ))}
        </div>
      </section>

      {/* ============ SYMPTOM-FIRST BODY MAP ============ */}
      <section style={{ marginBottom: 96 }}>
        <div style={{ font: `500 13px ${FONT}`, color: '#8aa39d', marginBottom: 12 }}>
          Start from your symptom
        </div>
        <h2 style={{
          font: `600 28px/1.2 ${FONT}`,
          letterSpacing: '-0.02em',
          color: '#0b3f3a', margin: '0 0 24px', maxWidth: 560,
        }}>
          Tell us where it hurts &mdash; we route you from there
        </h2>
        <BodyMapHero
          onStartTriage={(hotspotId) => {
            const target = `/book?hotspot=${encodeURIComponent(hotspotId)}`;
            try { sessionStorage.setItem('pulsecare_pending_hotspot', hotspotId); } catch {}
            if (onBookSpecialty) onBookSpecialty(target);
            else if (onGetCare) onGetCare(target);
            else navigate(target);
          }}
          onCustomTriage={(cause) => {
            const target = cause ? `/book?complaint=${encodeURIComponent(cause)}` : '/book';
            try { if (cause) sessionStorage.setItem('pulsecare_pending_complaint', cause); } catch {}
            if (onGetCare) onGetCare(target);
            else navigate(target);
          }}
        />
      </section>

      {/* ============ SPECIALTY GRID ============ */}
      <section id="specialties" style={{ marginBottom: 96 }}>
        <div style={{ font: `500 13px ${FONT}`, color: '#8aa39d', marginBottom: 12 }}>
          Or pick a specialty
        </div>
        <SpecialtyGrid />
      </section>

      {/* ============ WHAT PATIENTS SAID ============ */}
      {(reviews.length > 0) && (
      <section style={{ marginBottom: 96 }}>
        <div style={{ font: `500 13px ${FONT}`, color: '#8aa39d', marginBottom: 12 }}>
          What patients said
        </div>
        <h2 style={{
          font: `600 28px/1.2 ${FONT}`, letterSpacing: '-0.02em',
          color: '#0b3f3a', margin: '0 0 24px', maxWidth: 560,
        }}>
          Reviews from completed visits
        </h2>
        <div style={{
          display: 'grid', gap: 16,
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        }}>
          {reviews.map(rev => (
            <div key={rev.id} style={{
              background: '#fff', border: '1px solid #d9ece7',
              borderRadius: 16, padding: 20,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ font: `600 15px ${FONT}`, color: '#0b3f3a' }}>
                    {rev.doctorName ?? 'Consulting physician'}
                  </div>
                  <div style={{ font: `400 12px ${FONT}`, color: '#8aa39d', marginTop: 2 }}>
                    {rev.doctorSpecialty ?? 'Specialist'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      strokeWidth={1.5}
                      color={i < rev.rating ? '#d97706' : '#cfdbd6'}
                      fill={i < rev.rating ? '#d97706' : 'transparent'}
                    />
                  ))}
                </div>
              </div>
              {rev.comment && (
                <p style={{
                  font: `400 14px/1.55 ${FONT}`, color: '#2d4b45',
                  margin: 0,
                }}>
                  {rev.comment}
                </p>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingTop: 12, marginTop: 'auto',
                borderTop: '1px solid #eef5f3',
                font: `400 12px ${FONT}`, color: '#8aa39d',
              }}>
                <span>
                  {rev.isAnonymous ? 'Verified patient' : (rev.patientName || 'Verified patient')}
                </span>
                <span>{rev.createdAt}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* ============ TRUST STRIP ============ */}
      <section style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        flexWrap: 'wrap', gap: 40,
        padding: '24px 0', marginBottom: 72,
        borderTop: '1px solid #d9ece7',
        borderBottom: '1px solid #d9ece7',
        font: `400 13px ${FONT}`, color: '#52736d',
      }}>
        {[
          'Verified doctors',
          'Encrypted records',
          'No data sold',
          '24/7 availability',
        ].map(label => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={14} color="#0f766e" strokeWidth={1.75} />
            <span>{label}</span>
          </div>
        ))}
      </section>

      {/* ============ FOOTER ============ */}
      <footer style={{
        font: `400 13px ${FONT}`, color: '#52736d',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 36, marginBottom: 32,
        }}>
          <div>
            <div style={{
              font: `600 18px ${FONT}`, color: '#0b3f3a',
              marginBottom: 12, letterSpacing: '-0.02em',
            }}>
              pulsecare
            </div>
            <div style={{ lineHeight: 1.8 }}>Group 6<br />IT314<br />DA-IICT</div>
          </div>
          {[
            { h: 'For patients',  items: ['Find doctors', 'Book appointment', 'My account', 'Download app'] },
            { h: 'For providers', items: ['For doctors', 'For hospitals', 'For pharmacies', 'Partner with us'] },
            { h: 'Legal',         items: ['Privacy', 'Terms', 'Help', 'Contact'] },
          ].map(col => (
            <div key={col.h}>
              <div style={{ font: `600 13px ${FONT}`, color: '#0b3f3a', marginBottom: 12 }}>{col.h}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {col.items.map(it => <div key={it}>{it}</div>)}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          paddingTop: 20, borderTop: '1px solid #d9ece7',
          font: `400 12px ${FONT}`, color: '#8aa39d',
        }}>
          &copy; 2026 pulsecare &middot; Group 6 &middot; IT314 &middot; DA-IICT
        </div>
      </footer>
    </PageTransition>
  );
};

/* -------------------------------------------------------------------
 * TriageResultPreview
 *
 * The hero's right-side moment. Shows the SIGNATURE live urgency chip
 * on a plausible, product-shaped card: patient's complaint at the top,
 * the triage verdict in the middle, the suggested doctor at the bottom
 * with a slot time. Nothing here is interactive — it's a product shot
 * in code, carrying the color so the rest of the chrome can stay quiet.
 * -----------------------------------------------------------------*/
const TriageResultPreview: React.FC = () => (
  <div style={{
    position: 'relative',
    background: '#fff',
    border: '1px solid #d9ece7',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0 1px 2px rgba(11,63,58,.04), 0 12px 32px rgba(11,63,58,.06)',
    fontFamily: FONT,
  }}>
    {/* Window chrome — small cue this is a product view */}
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      font: `500 11px ${FONT}`, color: '#8aa39d', marginBottom: 20,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f4d4cf' }} />
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f0e6c3' }} />
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#cfe3d0' }} />
      <span style={{ marginLeft: 8 }}>pulsecare / your result</span>
    </div>

    {/* What the patient told us */}
    <div style={{
      font: `500 11px ${FONT}`, color: '#8aa39d',
      marginBottom: 8,
    }}>
      You told us
    </div>
    <p style={{
      font: `400 14px/1.5 ${FONT}`, color: '#2d4b45',
      margin: '0 0 24px',
    }}>
      &ldquo;Sharp chest tightness after climbing stairs, started this morning. Short of breath.&rdquo;
    </p>

    {/* Signature: the live urgency chip + verdict */}
    <div style={{
      background: '#fff9f0',
      border: '1px solid #f3d9a4',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#d97706',
        }} />
        <span style={{
          font: `600 12px ${FONT}`, color: '#92400e',
          letterSpacing: 0,
        }}>
          See a doctor today
        </span>
      </div>
      <div style={{ font: `400 13px/1.5 ${FONT}`, color: '#92400e' }}>
        Chest + breathing together can be time-sensitive. Book a same-day slot below.
      </div>
    </div>

    {/* Suggested specialty + doctor */}
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 12,
    }}>
      <div style={{ font: `500 12px ${FONT}`, color: '#8aa39d' }}>
        Suggested specialty
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        font: `500 12px ${FONT}`, color: '#0f766e',
      }}>
        <Stethoscope size={12} strokeWidth={1.75} /> Cardiology
      </div>
    </div>

    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: 12,
      background: '#f4faf8',
      border: '1px solid #e5efeb',
      borderRadius: 10,
    }}>
      {/* Monogram avatar — typographic placeholder, no wireframe box */}
      <div style={{
        width: 40, height: 40, borderRadius: 999,
        background: '#e3f1ed',
        color: '#0f766e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: `600 14px ${FONT}`,
        flexShrink: 0,
      }}>
        RC
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: `600 14px ${FONT}`, color: '#0b3f3a' }}>
          Dr. Robert Chen, FACC
        </div>
        <div style={{ font: `400 12px ${FONT}`, color: '#52736d', marginTop: 2 }}>
          Asian Heart Institute &middot; Mumbai
        </div>
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        font: `500 12px ${FONT}`, color: '#52736d', whiteSpace: 'nowrap',
      }}>
        <Clock size={12} strokeWidth={1.75} /> 2:30 PM
      </div>
    </div>
  </div>
);

/* -------------------------------------------------------------------
 * HospitalPreviewModal
 *
 * Shown when an unauthenticated visitor clicks a hospital search
 * result. Same quiet palette as the rest of the page, no colored
 * shadows, no decorative chrome.
 * -----------------------------------------------------------------*/
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
    transition={{ duration: 0.16, ease: EASE_ENTER }}
    style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'rgba(11, 63, 58, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: FONT,
    }}
  >
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: EASE_ENTER }}
      style={{
        background: '#fff', borderRadius: 16,
        maxWidth: 560, width: '100%', maxHeight: '88vh', overflow: 'auto',
        border: '1px solid #d9ece7',
        padding: 24,
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 16, gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#eaf6f2', color: '#0f766e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Building2 size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h2 style={{ font: `600 18px ${FONT}`, color: '#0b3f3a', letterSpacing: '-0.015em', margin: 0 }}>
              {hospital.name}
            </h2>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              font: `400 13px ${FONT}`, color: '#52736d', marginTop: 4,
            }}>
              <MapPin size={12} color="#0f766e" strokeWidth={1.75} />
              {[hospital.city, hospital.state].filter(Boolean).join(', ') || 'Location unknown'}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none',
            color: '#52736d', cursor: 'pointer', padding: 4,
          }}
          aria-label="Close"
        >
          <X size={20} strokeWidth={1.75} />
        </button>
      </div>

      {hospital.address && (
        <div style={{ font: `400 13px ${FONT}`, color: '#52736d', marginBottom: 16 }}>
          {hospital.address}
          {hospital.pincode ? ` — ${hospital.pincode}` : ''}
        </div>
      )}

      <div style={{ font: `500 12px ${FONT}`, color: '#8aa39d', marginBottom: 8 }}>
        Available specialties ({hospital.specialties.length})
      </div>
      {hospital.specialties.length === 0 ? (
        <div style={{
          padding: 14, borderRadius: 10,
          background: '#f4faf8', border: '1px solid #e5efeb',
          font: `400 13px ${FONT}`, color: '#52736d',
          marginBottom: 20,
        }}>
          Specialty details are not published for this hospital in the
          government directory. You can still find a doctor via symptom
          triage after signing in.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {hospital.specialties.map(s => (
            <span key={s} style={{
              padding: '4px 10px', borderRadius: 999,
              font: `400 12px ${FONT}`, color: '#0b3f3a',
              background: '#eaf6f2', border: '1px solid #d9ece7',
            }}>{s}</span>
          ))}
        </div>
      )}

      <div style={{
        padding: 20, borderRadius: 12,
        background: '#f4faf8', border: '1px solid #e5efeb',
      }}>
        <div style={{ font: `600 15px ${FONT}`, color: '#0b3f3a', marginBottom: 4 }}>
          Sign in to book an appointment
        </div>
        <div style={{ font: `400 13px ${FONT}`, color: '#52736d', marginBottom: 14 }}>
          You need an account to run symptom triage and book a slot
          with a doctor at this hospital.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={onLogin}
            style={{
              background: 'transparent', color: '#0b3f3a',
              border: '1px solid #d3e2dd', borderRadius: 10,
              padding: '10px 18px',
              font: `500 13px ${FONT}`, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          ><LogIn size={14} strokeWidth={1.75} /> Log in</button>
          <button
            onClick={onSignup}
            style={{
              background: '#0f766e', color: '#fff',
              border: 'none', borderRadius: 10,
              padding: '10px 18px',
              font: `500 13px ${FONT}`, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'background-color 160ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0d655e')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0f766e')}
          ><UserPlus size={14} strokeWidth={1.75} /> Sign up</button>
        </div>
      </div>
    </motion.div>
  </motion.div>
);
