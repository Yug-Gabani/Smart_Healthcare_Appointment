import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  Baby,
  Bone,
  Brain,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Ear,
  Eye,
  HeartPulse,
  Hospital as HospitalIcon,
  Loader2,
  RotateCcw,
  Search,
  Smile,
  Star,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react';
import { PageTransition } from '../motion/PageTransition';
import { fadeInUp } from '../motion/presets';
import { doctorsApi, hospitalsApi } from '../services/api';
import type { Doctor, Hospital, Slot } from '../types';

interface SpecialtyMeta {
  name: string;
  tagline: string;
  icon: React.ReactNode;
  accent: string;
}

const SPECIALTY_META: SpecialtyMeta[] = [
  { name: 'General Medicine', tagline: 'Fever, cold, everyday care', icon: <Stethoscope size={22} />, accent: '#eaf6f2' },
  { name: 'Cardiology', tagline: 'Heart & chest concerns', icon: <HeartPulse size={22} />, accent: '#fee2e2' },
  { name: 'Dermatology', tagline: 'Skin, hair & allergies', icon: <Smile size={22} />, accent: '#fef3c7' },
  { name: 'Pediatrics', tagline: 'Care for children', icon: <Baby size={22} />, accent: '#e0f2fe' },
  { name: 'Orthopedics', tagline: 'Bones, joints & injuries', icon: <Bone size={22} />, accent: '#f3e8ff' },
  { name: 'Neurology', tagline: 'Headache & nerve issues', icon: <Brain size={22} />, accent: '#fce7f3' },
  { name: 'Gynecology', tagline: "Women's health", icon: <UserRound size={22} />, accent: '#fdf2f8' },
  { name: 'ENT', tagline: 'Ear, nose & throat', icon: <Ear size={22} />, accent: '#ecfeff' },
  { name: 'Ophthalmology', tagline: 'Eye care', icon: <Eye size={22} />, accent: '#ecfccb' },
  { name: 'Psychiatry', tagline: 'Mental wellbeing', icon: <Activity size={22} />, accent: '#ede9fe' },
];

export const DoctorListingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query params — preserving state across browser back/forward navigation
  const currentSpecialty = searchParams.get('specialty') || '';
  const currentHospitalId = searchParams.get('hospitalId') || '';
  const currentDoctorId = searchParams.get('doctorId') || '';
  const initialQ = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);

  // Database-connected hospitals offering current specialty
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);

  // Doctor count per specialty for the selection screen
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);

  // Selected doctor for profile inspection drawer
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorSlots, setDoctorSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // 1. Load all doctors once when on specialty selection screen to compute live database counts
  useEffect(() => {
    if (!currentSpecialty) {
      doctorsApi
        .list()
        .then((docs) => setAllDoctors(Array.isArray(docs) ? docs : []))
        .catch(() => {});
    }
  }, [currentSpecialty]);

  // Doctor count map per specialty from actual database rows
  const doctorCountsBySpecialty = useMemo(() => {
    const counts: Record<string, number> = {};
    allDoctors.forEach((doc) => {
      if (doc.specialty) {
        counts[doc.specialty] = (counts[doc.specialty] || 0) + 1;
      }
    });
    return counts;
  }, [allDoctors]);

  // 2. When a specialty is selected, load matching doctors & hospitals directly from DB API
  useEffect(() => {
    if (!currentSpecialty) {
      setDoctors([]);
      setHospitals([]);
      return;
    }

    setLoadingDoctors(true);
    setDoctorsError(null);

    // Fetch doctors from database for this specialty (and optional hospital filter)
    doctorsApi
      .list(currentSpecialty, currentHospitalId || undefined)
      .then((docs) => {
        setDoctors(Array.isArray(docs) ? docs : []);
      })
      .catch((err) => {
        setDoctorsError(err?.message || 'Could not load doctors for this specialty');
      })
      .finally(() => {
        setLoadingDoctors(false);
      });

    // Fetch hospitals offering that specialty directly from database
    setLoadingHospitals(true);
    hospitalsApi
      .search({ specialty: currentSpecialty, limit: 30 })
      .then((hList) => {
        setHospitals(Array.isArray(hList) ? hList : []);
      })
      .catch(() => {})
      .finally(() => {
        setLoadingHospitals(false);
      });
  }, [currentSpecialty, currentHospitalId]);

  // 3. Handle doctor profile drawer (either from doctorId in URL or clicked state)
  useEffect(() => {
    if (currentDoctorId) {
      doctorsApi
        .get(currentDoctorId)
        .then((doc) => {
          setSelectedDoctor(doc);
          loadSlots(doc.id);
        })
        .catch(() => {});
    }
  }, [currentDoctorId]);

  const loadSlots = (docId: string) => {
    setLoadingSlots(true);
    doctorsApi
      .slots(docId)
      .then((slots) => setDoctorSlots(Array.isArray(slots) ? slots : []))
      .catch(() => setDoctorSlots([]))
      .finally(() => setLoadingSlots(false));
  };

  // Synchronize text search into URL so browser Back restores search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    } else {
      params.delete('q');
    }
    setSearchParams(params);
  };

  // Action: Click specialty card -> Navigate to filtered doctor listing
  const handleSelectSpecialty = (specialty: string) => {
    const params = new URLSearchParams();
    params.set('specialty', specialty);
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Action: Click hospital filter -> Show hospitals offering that specialty / filter doctors
  const handleSelectHospital = (hospitalId: string) => {
    const params = new URLSearchParams(searchParams);
    if (hospitalId) {
      params.set('hospitalId', hospitalId);
    } else {
      params.delete('hospitalId');
    }
    setSearchParams(params);
  };

  // Action: Click doctor -> Open doctor profile
  const handleOpenDoctorProfile = (doc: Doctor) => {
    setSelectedDoctor(doc);
    loadSlots(doc.id);
    const params = new URLSearchParams(searchParams);
    params.set('doctorId', doc.id);
    setSearchParams(params);
  };

  const handleCloseDoctorProfile = () => {
    setSelectedDoctor(null);
    setDoctorSlots([]);
    const params = new URLSearchParams(searchParams);
    params.delete('doctorId');
    setSearchParams(params);
  };

  // Action: Click Book Appointment -> Start booking process
  const handleBookAppointment = (doc: Doctor) => {
    navigate(`/book?doctorId=${encodeURIComponent(doc.id)}&specialty=${encodeURIComponent(doc.specialty)}`);
  };

  // Action: Click browser back / Return to specialty selection
  const handleBackToSpecialties = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('specialty');
    params.delete('hospitalId');
    params.delete('doctorId');
    setSearchParams(params);
  };

  // Filtered doctors list based on in-page search query if typed
  const displayedDoctors = useMemo(() => {
    if (!searchQuery.trim()) return doctors;
    const q = searchQuery.toLowerCase().trim();
    return doctors.filter(
      (d) =>
        d.fullName?.toLowerCase().includes(q) ||
        d.hospital?.toLowerCase().includes(q) ||
        d.specialty?.toLowerCase().includes(q)
    );
  }, [doctors, searchQuery]);

  // Combined list of hospitals offering this specialty (from search API + doctors' hospitals)
  const availableHospitals = useMemo(() => {
    const map = new Map<string, { id: string; name: string; city?: string }>();
    hospitals.forEach((h) => {
      if (h.id && h.name) map.set(h.id, { id: h.id, name: h.name, city: h.city });
    });
    doctors.forEach((d) => {
      if (d.hospitalId && d.hospital && !map.has(d.hospitalId)) {
        map.set(d.hospitalId, { id: d.hospitalId, name: d.hospital });
      }
    });
    return Array.from(map.values());
  }, [hospitals, doctors]);

  const selectedHospitalName = useMemo(() => {
    if (!currentHospitalId) return null;
    const found = availableHospitals.find((h) => h.id === currentHospitalId);
    return found ? found.name : 'Selected Hospital';
  }, [availableHospitals, currentHospitalId]);

  return (
    <PageTransition
      style={{
        width: '100%',
        maxWidth: '1440px',
        margin: '36px auto 72px auto',
        padding: '0 24px',
        boxSizing: 'border-box',
        fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* =========================================================================
          VIEW A: SPECIALTY SELECTION (When no specialty is picked in the URL)
          ========================================================================= */}
      {!currentSpecialty ? (
        <div>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div
              style={{
                display: 'inline-block',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#0f766e',
                backgroundColor: '#eaf6f2',
                padding: '4px 14px',
                borderRadius: '9999px',
                marginBottom: '14px',
              }}
            >
              Clinical Discovery
            </div>
            <h1
              style={{
                fontSize: '32px',
                fontWeight: 700,
                color: '#0b3f3a',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Pick a specialty to find verified doctors
            </h1>
            <p style={{ color: '#52736d', margin: '8px auto 0 auto', fontSize: '15px', maxWidth: '640px' }}>
              Connect directly with verified specialists across top hospitals. Select a specialty below to view
              available doctors and hospital facilities.
            </p>

            {/* Quick search input */}
            <form
              onSubmit={handleSearchSubmit}
              style={{
                maxWidth: '520px',
                margin: '24px auto 0 auto',
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <Search
                size={18}
                style={{ position: 'absolute', left: 16, color: '#94a3b8', pointerEvents: 'none' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search specialty, symptom, or doctor name…"
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 46px',
                  borderRadius: 9999,
                  border: '1px solid #d7e8e5',
                  backgroundColor: '#ffffff',
                  fontSize: 14,
                  color: '#0b3f3a',
                  outline: 'none',
                  boxShadow: '0 2px 8px rgba(15, 118, 110, 0.04)',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: 14,
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </form>
          </div>

          {/* Specialty Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '16px',
            }}
          >
            {SPECIALTY_META.filter((s) => !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(
              (s) => {
                const docCount = doctorCountsBySpecialty[s.name] || 0;
                return (
                  <motion.div
                    key={s.name}
                    {...fadeInUp}
                    onClick={() => handleSelectSpecialty(s.name)}
                    className="hover-lift"
                    style={{
                      background: '#ffffff',
                      border: '1px solid #d7e8e5',
                      borderRadius: 16,
                      padding: '24px 20px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.18s ease',
                      boxShadow: '0 2px 8px rgba(15, 118, 110, 0.04)',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          backgroundColor: s.accent,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#0f766e',
                          marginBottom: 16,
                        }}
                      >
                        {s.icon}
                      </div>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0b3f3a', margin: '0 0 6px 0' }}>
                        {s.name}
                      </h3>
                      <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.45 }}>{s.tagline}</p>
                    </div>

                    <div
                      style={{
                        marginTop: 18,
                        paddingTop: 12,
                        borderTop: '1px solid #f1f7f5',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#0f766e',
                      }}
                    >
                      <span>{docCount > 0 ? `${docCount} specialists` : 'Consult specialists'}</span>
                      <span style={{ fontSize: 14 }}>&rarr;</span>
                    </div>
                  </motion.div>
                );
              }
            )}
          </div>
        </div>
      ) : (
        /* =========================================================================
           VIEW B: FILTERED DOCTOR LISTING WITH HOSPITAL FILTER & DOCTOR PROFILES
           ========================================================================= */
        <div>
          {/* Back to specialty selection bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button
              onClick={handleBackToSpecialties}
              className="hover-lift"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#ffffff',
                border: '1px solid #d7e8e5',
                color: '#0f766e',
                fontSize: 13,
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: 9999,
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={15} /> All Specialties
            </button>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>/</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0b3f3a' }}>{currentSpecialty}</span>
          </div>

          {/* Heading + Stats */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  color: '#0b3f3a',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Specialists in {currentSpecialty}
              </h1>
              <p style={{ color: '#52736d', margin: '6px 0 0 0', fontSize: '14px' }}>
                Showing verified practitioners and hospital facilities for {currentSpecialty}.
              </p>
            </div>

            {/* Quick search input within this specialty */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search
                size={15}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search doctors in this specialty…"
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: 9999,
                  border: '1px solid #d7e8e5',
                  backgroundColor: '#fff',
                  fontSize: 13,
                  color: '#0b3f3a',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* =========================================================================
              HOSPITAL FILTER BAR (Dynamic from database)
              ========================================================================= */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #d9ece7',
              borderRadius: 16,
              padding: '16px 20px',
              marginBottom: 28,
              boxShadow: '0 2px 6px rgba(15, 118, 110, 0.03)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#0f766e',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <HospitalIcon size={14} />
                <span>Hospitals Offering {currentSpecialty}</span>
              </div>

              {currentHospitalId && (
                <button
                  onClick={() => handleSelectHospital('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#e11d48',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <RotateCcw size={12} /> Clear hospital filter
                </button>
              )}
            </div>

            {loadingHospitals ? (
              <div style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={13} className="animate-spin" /> Querying hospital directory for {currentSpecialty}…
              </div>
            ) : availableHospitals.length === 0 ? (
              <div style={{ fontSize: 13, color: '#64748b' }}>
                All hospitals in our network support this specialty.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleSelectHospital('')}
                  className="hover-lift"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 9999,
                    border: !currentHospitalId ? '1px solid #0f766e' : '1px solid #d7e8e5',
                    background: !currentHospitalId ? '#0f766e' : '#f8fafc',
                    color: !currentHospitalId ? '#ffffff' : '#475569',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  All Hospitals ({availableHospitals.length})
                </button>

                {availableHospitals.map((h) => {
                  const isSelected = currentHospitalId === h.id;
                  return (
                    <button
                      key={h.id}
                      onClick={() => handleSelectHospital(h.id)}
                      className="hover-lift"
                      style={{
                        padding: '6px 14px',
                        borderRadius: 9999,
                        border: isSelected ? '1px solid #0f766e' : '1px solid #d7e8e5',
                        background: isSelected ? '#0f766e' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#334155',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Building2 size={12} color={isSelected ? '#ffffff' : '#64748b'} />
                      <span>{h.name}</span>
                      {h.city && <span style={{ opacity: 0.7, fontSize: 11 }}>({h.city})</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {currentHospitalId && selectedHospitalName && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: '#0f766e',
                  backgroundColor: '#eaf6f2',
                  padding: '6px 12px',
                  borderRadius: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <CheckCircle2 size={13} />
                <span>
                  Filtering doctors at <strong>{selectedHospitalName}</strong>
                </span>
              </div>
            )}
          </div>

          {/* =========================================================================
              DOCTOR LISTING GRID
              ========================================================================= */}
          {doctorsError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '12px 16px',
                borderRadius: 12,
                fontSize: 13,
                marginBottom: 20,
              }}
            >
              {doctorsError}
            </div>
          )}

          {loadingDoctors ? (
            <div style={{ padding: '64px 24px', textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={24} className="animate-spin" style={{ display: 'inline', color: '#0f766e' }} />
              <div style={{ marginTop: 8, fontSize: 14 }}>Finding {currentSpecialty} doctors…</div>
            </div>
          ) : displayedDoctors.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: '#64748b',
                background: '#ffffff',
                border: '1px dashed #d7e8e5',
                borderRadius: 16,
              }}
            >
              <Stethoscope size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0b3f3a' }}>
                No doctors currently listed for {currentSpecialty}
                {currentHospitalId ? ` at ${selectedHospitalName}` : ''}.
              </div>
              <p style={{ fontSize: 13, margin: '6px 0 16px 0' }}>
                Try clearing the hospital filter or choose another specialty.
              </p>
              {currentHospitalId && (
                <button
                  onClick={() => handleSelectHospital('')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 9999,
                    border: '1px solid #0f766e',
                    backgroundColor: '#0f766e',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Show All Hospitals
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: '20px',
              }}
            >
              {displayedDoctors.map((doc) => (
                <motion.div
                  key={doc.id}
                  {...fadeInUp}
                  className="hover-lift"
                  onClick={() => handleOpenDoctorProfile(doc)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #d7e8e5',
                    borderRadius: 16,
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(15, 118, 110, 0.04)',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <div>
                    {/* Top Identity Row */}
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: '50%',
                          backgroundColor: '#e6f3f0',
                          color: '#0f766e',
                          fontWeight: 700,
                          fontSize: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {doc.avatarUrl ? (
                          <img src={doc.avatarUrl} alt={doc.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          doc.fullName?.charAt(0) || 'D'
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0b3f3a' }}>{doc.fullName}</div>
                        <div style={{ fontSize: 13, color: '#0f766e', fontWeight: 600, marginTop: 2 }}>
                          {doc.specialty}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Building2 size={12} />
                          <span>{doc.hospital}</span>
                        </div>
                      </div>

                      {/* Rating Badge */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          padding: '3px 8px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <Star size={12} fill="#d97706" color="#d97706" />
                        <span>{doc.rating != null ? Number(doc.rating).toFixed(1) : '5.0'}</span>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 8,
                        backgroundColor: '#f8fcfa',
                        border: '1px solid #eaf6f2',
                        borderRadius: 10,
                        padding: '10px 12px',
                        fontSize: 12,
                        marginBottom: 14,
                      }}
                    >
                      <div>
                        <div style={{ color: '#88a39d' }}>Experience</div>
                        <div style={{ fontWeight: 600, color: '#0b3f3a' }}>
                          {doc.yearsExperience != null ? `${doc.yearsExperience} yrs` : '10+ yrs'}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#88a39d' }}>Consultation Fee</div>
                        <div style={{ fontWeight: 600, color: '#0b3f3a' }}>
                          {doc.consultationFee != null ? `₹${Number(doc.consultationFee).toFixed(0)}` : '₹500'}
                        </div>
                      </div>
                    </div>

                    {doc.bio && (
                      <p
                        style={{
                          fontSize: 13,
                          color: '#64748b',
                          margin: '0 0 16px 0',
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {doc.bio}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDoctorProfile(doc);
                      }}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: '1px solid #d7e8e5',
                        backgroundColor: '#ffffff',
                        color: '#0f766e',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBookAppointment(doc);
                      }}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: 'none',
                        backgroundColor: '#0f766e',
                        color: '#ffffff',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Calendar size={13} />
                      Book Visit
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* =========================================================================
              DOCTOR PROFILE INSPECTION DRAWER (Behavior 3 & 4)
              ========================================================================= */}
          <AnimatePresence>
            {selectedDoctor && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCloseDoctorProfile}
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(11, 63, 58, 0.45)',
                  zIndex: 1000,
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <motion.aside
                  initial={{ x: 500 }}
                  animate={{ x: 0 }}
                  exit={{ x: 500 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 'min(500px, 100%)',
                    height: '100%',
                    backgroundColor: '#ffffff',
                    padding: '28px 28px 24px',
                    boxShadow: '-16px 0 40px rgba(11, 63, 58, 0.15)',
                    overflowY: 'auto',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {/* Drawer Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            backgroundColor: '#e6f3f0',
                            color: '#0f766e',
                            fontWeight: 700,
                            fontSize: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {selectedDoctor.avatarUrl ? (
                            <img
                              src={selectedDoctor.avatarUrl}
                              alt={selectedDoctor.fullName}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            selectedDoctor.fullName?.charAt(0) || 'D'
                          )}
                        </div>
                        <div>
                          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0b3f3a', margin: 0 }}>
                            {selectedDoctor.fullName}
                          </h2>
                          <div style={{ fontSize: 14, color: '#0f766e', fontWeight: 600, marginTop: 2 }}>
                            {selectedDoctor.specialty}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleCloseDoctorProfile}
                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Key Attributes */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 10,
                        backgroundColor: '#f8fcfa',
                        border: '1px solid #e1efe9',
                        borderRadius: 12,
                        padding: '12px 14px',
                        marginBottom: 20,
                        textAlign: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, color: '#88a39d', fontWeight: 600 }}>RATING</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0b3f3a', marginTop: 2 }}>
                          ★ {selectedDoctor.rating != null ? Number(selectedDoctor.rating).toFixed(1) : '5.0'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#88a39d', fontWeight: 600 }}>EXPERIENCE</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0b3f3a', marginTop: 2 }}>
                          {selectedDoctor.yearsExperience != null ? `${selectedDoctor.yearsExperience} yrs` : '10+ yrs'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#88a39d', fontWeight: 600 }}>FEE</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f766e', marginTop: 2 }}>
                          ₹{selectedDoctor.consultationFee != null ? Number(selectedDoctor.consultationFee).toFixed(0) : '500'}
                        </div>
                      </div>
                    </div>

                    {/* Details Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#88a39d', textTransform: 'uppercase' }}>
                          HOSPITAL AFFILIATION
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0b3f3a', marginTop: 2 }}>
                          {selectedDoctor.hospital}
                        </div>
                      </div>

                      {selectedDoctor.languages && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#88a39d', textTransform: 'uppercase' }}>
                            LANGUAGES SPOKEN
                          </div>
                          <div style={{ fontSize: 14, color: '#0b3f3a', marginTop: 2 }}>
                            {selectedDoctor.languages}
                          </div>
                        </div>
                      )}

                      {selectedDoctor.bio && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#88a39d', textTransform: 'uppercase' }}>
                            ABOUT THE PRACTITIONER
                          </div>
                          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.55, margin: '4px 0 0 0' }}>
                            {selectedDoctor.bio}
                          </p>
                        </div>
                      )}

                      {/* Next Available Slots Preview */}
                      <div style={{ marginTop: 8 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#88a39d',
                            textTransform: 'uppercase',
                            marginBottom: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Clock size={12} />
                          <span>UPCOMING AVAILABLE SLOTS</span>
                        </div>

                        {loadingSlots ? (
                          <div style={{ fontSize: 13, color: '#64748b' }}>Checking schedule…</div>
                        ) : doctorSlots.length === 0 ? (
                          <div
                            style={{
                              padding: '12px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 10,
                              fontSize: 12,
                              color: '#64748b',
                            }}
                          >
                            No open slots today. Click below to view future dates in booking.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {doctorSlots.slice(0, 6).map((s) => (
                              <span
                                key={s.id}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: 8,
                                  backgroundColor: '#eaf6f2',
                                  color: '#0f766e',
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {new Date(s.slotAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ))}
                            {doctorSlots.length > 6 && (
                              <span style={{ fontSize: 11, color: '#88a39d', alignSelf: 'center' }}>
                                +{doctorSlots.length - 6} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Primary CTA: Book Appointment */}
                  <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid #e1efe9' }}>
                    <button
                      onClick={() => handleBookAppointment(selectedDoctor)}
                      style={{
                        width: '100%',
                        backgroundColor: '#0f766e',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '14px',
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 12px rgba(15, 118, 110, 0.25)',
                      }}
                    >
                      <Calendar size={16} />
                      Book Appointment with Dr. {selectedDoctor.fullName.split(' ')[1] || selectedDoctor.fullName}
                    </button>
                  </div>
                </motion.aside>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </PageTransition>
  );
};

export default DoctorListingPage;
