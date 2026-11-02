import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition } from '../motion/PageTransition';
import { fadeInUp, listItem, staggerContainer } from '../motion/presets';
import { CustomSelect } from './CustomSelect';
import { Building2, Loader2, MapPin, Search } from 'lucide-react';
import type { Hospital } from '../types';
import { hospitalsApi } from '../services/api';

/**
 * Live-list hospital search. The query runs ~300 ms after the user stops typing
 * (or whenever a filter changes). Keeps the request volume sane against a 30K-row index.
 */
export const Hospitals: React.FC = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [specialty, setSpecialty] = useState('');

  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  const [results, setResults] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initial, setInitial] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load state list once.
  useEffect(() => {
    hospitalsApi.states().then(setStates).catch(() => {});
  }, []);

  // Reload cities when state changes; clear picked city if it's no longer valid.
  useEffect(() => {
    hospitalsApi.cities(state || undefined).then(list => {
      setCities(list);
      if (city && !list.includes(city)) setCity('');
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Debounced search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true); setError(null); setInitial(false);
      hospitalsApi.search({ q, state, city, specialty, limit: 25 })
        .then(setResults)
        .catch(e => setError(e?.message || 'Search failed'))
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, state, city, specialty]);

  const hasFilters = useMemo(
    () => Boolean(q || state || city || specialty),
    [q, state, city, specialty]
  );

  return (
    <PageTransition style={{ maxWidth: '1100px', margin: '48px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0b3f3a', margin: 0, letterSpacing: '-0.02em' }}>
        Browse hospitals
      </h1>
      <p style={{ color: '#52736d', margin: '6px 0 24px 0' }}>
        Search across 30,000+ hospitals from the government PMJAY directory.
      </p>

      {/* Search bar */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 2fr) 1fr 1fr 1fr',
          gap: '10px', marginBottom: '20px',
        }}
      >
        <div style={{ position: 'relative' }}>
          <Search size={16} color="#0f766e" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Hospital name (e.g. Apollo, Lilavati)"
            style={{
              width: '100%', padding: '10px 12px 10px 36px',
              borderRadius: '10px', border: '1px solid #d9ece7',
              fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              backgroundColor: '#ffffff',
            }}
          />
        </div>
        <CustomSelect
          value={state}
          options={[{ value: '', label: 'All states' }, ...states.map(s => ({ value: s, label: s }))]}
          onChange={setState}
          searchable={true}
          searchPlaceholder="Type state (e.g. Gujarat)…"
          placeholder="All states"
          variant="input"
        />
        <CustomSelect
          value={city}
          options={[{ value: '', label: 'All cities' }, ...cities.map(c => ({ value: c, label: c }))]}
          onChange={setCity}
          disabled={!cities.length}
          searchable={true}
          searchPlaceholder="Type city (e.g. Ahmedabad)…"
          placeholder={cities.length ? 'All cities' : 'Pick a state first'}
          variant="input"
        />
        <input
          type="text"
          value={specialty}
          onChange={e => setSpecialty(e.target.value)}
          placeholder="Specialty (e.g. Cardiology)"
          style={{
            padding: '10px 12px', borderRadius: '10px',
            border: '1px solid #d9ece7', fontSize: '14px', outline: 'none',
            boxSizing: 'border-box', backgroundColor: '#ffffff',
          }}
        />
      </motion.div>

      {error && (
        <div style={{
          padding: '14px 18px', borderRadius: '12px',
          backgroundColor: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.25)',
          color: '#dc2626', fontSize: '14px', marginBottom: '16px',
        }}>{error}</div>
      )}

      {loading && (
        <div style={{ color: '#52736d', fontSize: '13px', marginBottom: '12px' }}>
          <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Searching…
        </div>
      )}

      {!loading && !initial && results.length === 0 && (
        <div className="card card-hover" style={{ padding: '48px', textAlign: 'center' }}>
          <Building2 size={28} color="#8aa39d" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#0b3f3a' }}>No hospitals match these filters</div>
          <div style={{ fontSize: '13px', color: '#52736d', marginTop: 6 }}>
            Try a different name, loosen the state/city, or clear the specialty filter.
          </div>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div style={{ color: '#52736d', fontSize: '13px', marginBottom: '12px' }}>
            Showing {results.length}{hasFilters ? ' matching' : ''} hospital{results.length === 1 ? '' : 's'}
          </div>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            style={{
              display: 'grid',
              gap: '16px',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            }}
          >
            {results.map(h => (
              <motion.div
                key={h.id}
                variants={listItem}
                className="card-hover"
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #d9ece7',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 2px 8px rgba(20, 60, 55, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* Top Information Section */}
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#0b3f3a',
                    margin: '0 0 6px 0',
                    lineHeight: '1.35',
                    letterSpacing: '-0.01em',
                  }}>
                    {h.name}
                  </h3>
                  <div style={{
                    fontSize: '13px',
                    color: '#52736d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    lineHeight: '1.4',
                  }}>
                    <MapPin size={14} color="#0f766e" style={{ flexShrink: 0 }} />
                    <span>{[h.city, h.state].filter(Boolean).join(', ') || 'Location unknown'}</span>
                  </div>

                  {h.specialties.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                      {h.specialties.slice(0, 4).map(s => (
                        <span
                          key={s}
                          className="chip"
                          style={{
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 500,
                            color: '#0b3f3a',
                            backgroundColor: '#eaf6f2',
                            border: '1px solid #d9ece7',
                          }}
                        >
                          {s}
                        </span>
                      ))}
                      {h.specialties.length > 4 && (
                        <span style={{ fontSize: '11px', color: '#8aa39d', padding: '3px 4px' }}>
                          +{h.specialties.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Footer Section with Aligned Action */}
                <div style={{
                  paddingTop: '14px',
                  borderTop: '1px solid #d9ece7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'auto',
                }}>
                  <span style={{ fontSize: '12px', color: '#8aa39d', fontWeight: 500 }}>
                    PMJAY Empanelled
                  </span>
                  <button
                    onClick={() => navigate(`/hospitals/${h.id}`)}
                    className="hover-lift"
                    style={{
                      backgroundColor: 'transparent',
                      color: '#0f766e',
                      border: '1px solid #0f766e',
                      borderRadius: '9999px',
                      padding: '7px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>View doctors</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </>
      )}
    </PageTransition>
  );
};
