import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  Baby,
  Bone,
  Brain,
  Ear,
  Eye,
  HeartPulse,
  Smile,
  Stethoscope,
  UserRound,
} from 'lucide-react';

/**
 * Practo-style "Book an appointment for an in-clinic consultation" grid.
 *
 * <p>Each card is a fast lane for patients who already know what kind of doctor they need: it
 * jumps straight into the booking flow with the specialty pre-locked, skipping the symptom
 * questionnaire. The booking page reads {@code ?specialty=} and lands the visitor on step 3
 * (pick a doctor & time) with a short required "why are you here" intake above the doctor cards.
 * If the visitor isn't signed in, ProtectedRoute will redirect them to login with a `next=` back
 * to the same shortcut URL.
 */

interface SpecialtyEntry {
  name: string;          // display label, also the query param value
  tagline: string;       // one-line description shown below the title
  icon: React.ReactNode;
  accent: string;        // circular icon background
}

const SPECIALTIES: SpecialtyEntry[] = [
  { name: 'General Medicine', tagline: 'Fever, cold, everyday care', icon: <Stethoscope size={22} />,  accent: '#eaf6f2' },
  { name: 'Cardiology',       tagline: 'Heart & chest concerns',     icon: <HeartPulse size={22} />,   accent: '#fee2e2' },
  { name: 'Dermatology',      tagline: 'Skin, hair & allergies',     icon: <Smile size={22} />,         accent: '#fef3c7' },
  { name: 'Pediatrics',       tagline: 'Care for children',          icon: <Baby size={22} />,          accent: '#e0f2fe' },
  { name: 'Orthopedics',      tagline: 'Bones, joints & injuries',   icon: <Bone size={22} />,          accent: '#f3e8ff' },
  { name: 'Neurology',        tagline: 'Headache & nerve issues',    icon: <Brain size={22} />,         accent: '#fce7f3' },
  { name: 'Gynecology',       tagline: "Women's health",             icon: <UserRound size={22} />,     accent: '#fdf2f8' },
  { name: 'ENT',              tagline: 'Ear, nose & throat',         icon: <Ear size={22} />,           accent: '#ecfeff' },
  { name: 'Ophthalmology',    tagline: 'Eye care',                   icon: <Eye size={22} />,           accent: '#ecfccb' },
  { name: 'Psychiatry',       tagline: 'Mental wellbeing',           icon: <Activity size={22} />,      accent: '#ede9fe' },
];

export const SpecialtyGrid: React.FC = () => {
  const navigate = useNavigate();

  const go = (specialty: string) => {
    navigate(`/book?specialty=${encodeURIComponent(specialty)}`);
  };

  return (
    <section
      style={{
        maxWidth: '1120px',
        margin: '0 auto 72px auto',
        padding: '0 24px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div
          style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#0f766e',
            backgroundColor: '#eaf6f2',
            padding: '4px 12px',
            borderRadius: '9999px',
            marginBottom: '14px',
          }}
        >
          In-clinic specialists
        </div>
        <h2
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#0b3f3a',
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          Pick a specialty to find care
        </h2>
        <p style={{ color: '#52736d', margin: '8px 0 0 0', fontSize: '14px' }}>
          Browse hospitals and doctors by specialty — tap a card to see who's near you.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: '16px',
        }}
      >
        {SPECIALTIES.map((s, idx) => (
          <motion.button
            key={s.name}
            type="button"
            onClick={() => go(s.name)}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, delay: idx * 0.04, ease: [0.2, 0.65, 0.3, 0.9] }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            style={{
              background: '#ffffff',
              border: '1px solid #d9ece7',
              borderRadius: '16px',
              padding: '20px 18px',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: '#0b3f3a',
              boxShadow: '0 2px 8px rgba(11, 63, 58, 0.04)',
              transition: 'border-color 180ms ease, box-shadow 220ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#0f766e';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(15, 118, 110, 0.10)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#d9ece7';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(11, 63, 58, 0.04)';
            }}
            aria-label={`Find a ${s.name} specialist`}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: s.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0f766e',
                marginBottom: '12px',
              }}
            >
              {s.icon}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1.3 }}>{s.name}</div>
            <div style={{ fontSize: '12px', color: '#52736d', marginTop: '4px', lineHeight: 1.4 }}>
              {s.tagline}
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
};

export default SpecialtyGrid;
