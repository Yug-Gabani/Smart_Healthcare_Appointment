import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PageTransition } from '../motion/PageTransition';
import { listItem } from '../motion/presets';
import { Calendar, Clock, Loader2, MapPin, Video, FileText, XCircle, Star } from 'lucide-react';
import type { Appointment, AppointmentStatus } from '../types';
import { appointmentsApi } from '../services/api';
import { DoctorReviewModal } from './DoctorReviewModal';

type Tab = 'upcoming' | 'past' | 'cancelled';

function isUpcoming(a: Appointment): boolean {
  if (a.status === 'CANCELLED' || a.status === 'NO_SHOW') return false;
  if (a.status === 'COMPLETED') return false;
  return true;
}

function tabFor(a: Appointment): Tab {
  if (a.status === 'CANCELLED' || a.status === 'NO_SHOW') return 'cancelled';
  if (a.status === 'COMPLETED') return 'past';
  return 'upcoming';
}

function formatSlot(iso?: string): string {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function urgencyColor(u: Appointment['urgency']): string {
  if (u === 'EMERGENCY') return '#dc2626';
  if (u === 'URGENT') return '#d97706';
  return '#059669';
}

function urgencyBg(u: Appointment['urgency']): string {
  if (u === 'EMERGENCY') return 'rgba(220, 38, 38, 0.08)';
  if (u === 'URGENT') return 'rgba(217, 119, 6, 0.1)';
  return 'rgba(5, 150, 105, 0.08)';
}

function statusLabel(s: AppointmentStatus): string {
  if (s === 'BOOKED') return 'Booked';
  if (s === 'CONFIRMED') return 'Confirmed';
  if (s === 'COMPLETED') return 'Completed';
  if (s === 'CANCELLED') return 'Cancelled';
  return 'No show';
}

export const MyAppointments: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reviewingAppt, setReviewingAppt] = useState<Appointment | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    appointmentsApi
      .mine()
      .then(setAppointments)
      .catch(err => setError(err.message || 'Failed to load appointments'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this appointment? The slot will be released.')) return;
    setCancellingId(id);
    try {
      const updated = await appointmentsApi.cancel(id);
      setAppointments(prev => prev.map(a => (a.id === id ? updated : a)));
    } catch (err: any) {
      alert(err.message || 'Could not cancel this appointment.');
    } finally {
      setCancellingId(null);
    }
  };

  const filtered = appointments.filter(a => tabFor(a) === tab);
  const counts = {
    upcoming: appointments.filter(a => tabFor(a) === 'upcoming').length,
    past: appointments.filter(a => tabFor(a) === 'past').length,
    cancelled: appointments.filter(a => tabFor(a) === 'cancelled').length,
  };

  return (
    <PageTransition style={{ maxWidth: '1000px', margin: '48px auto', padding: '0 24px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '20px', marginBottom: '28px',
      }}>
        <div>
          <h1 style={{ fontSize: '30px', fontWeight: 700, color: '#0b3f3a', letterSpacing: '-0.02em', margin: 0 }}>
            My Consultations
          </h1>
          <p style={{ color: '#52736d', margin: '6px 0 0 0' }}>
            Track your booked, past, and cancelled visits.
          </p>
        </div>
        <button onClick={() => navigate('/book')} className="btn btn-primary hover-lift">
          <Calendar size={16} /> Book New Consultation
        </button>
      </div>

      <div style={{
        display: 'flex', gap: '8px', marginBottom: '24px',
        borderBottom: '1px solid #d9ece7', paddingBottom: '2px',
      }}>
        {([
          { k: 'upcoming', label: `Upcoming (${counts.upcoming})` },
          { k: 'past', label: `Past (${counts.past})` },
          { k: 'cancelled', label: `Cancelled (${counts.cancelled})` },
        ] as const).map(t => {
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                padding: '10px 18px', fontSize: '14px',
                fontWeight: active ? 700 : 500,
                color: active ? '#0b3f3a' : '#52736d',
                background: 'transparent', border: 'none',
                borderBottom: active ? '2px solid #0f766e' : '2px solid transparent',
                cursor: 'pointer', marginBottom: '-2px',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ padding: '48px', textAlign: 'center', color: '#52736d' }}>
          <Loader2 size={24} className="animate-spin" style={{ display: 'inline', marginRight: 8 }} />
          Loading…
        </div>
      )}

      {error && (
        <div style={{
          padding: '14px 18px', borderRadius: '12px',
          backgroundColor: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.25)',
          color: '#dc2626', fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="card card-hover" style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            backgroundColor: '#eaf6f2', color: '#0f766e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Calendar size={26} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0b3f3a', marginBottom: '8px' }}>
            Nothing in {tab}
          </h2>
          <p style={{ color: '#52736d', marginBottom: '24px' }}>
            {tab === 'upcoming'
              ? 'Book a consultation to populate this list.'
              : 'Your history will appear here as you use PulseCare.'}
          </p>
          {tab === 'upcoming' && (
            <button onClick={() => navigate('/book')} className="btn btn-primary hover-lift">
              Start Triage & Booking
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: 'grid', gap: '16px' }}>
          <AnimatePresence>
            {filtered.map(appt => {
              const canCancel = isUpcoming(appt);
              return (
                <motion.div
                  key={appt.id}
                  layout
                  variants={listItem}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="card card-hover"
                  style={{ padding: '24px' }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: '12px',
                    borderBottom: '1px solid #d9ece7',
                    paddingBottom: '16px', marginBottom: '16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {appt.doctorAvatarUrl ? (
                        <img
                          src={appt.doctorAvatarUrl}
                          alt={appt.doctorName ?? ''}
                          style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: '48px', height: '48px', borderRadius: '50%',
                          backgroundColor: '#eaf6f2', color: '#0f766e',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700,
                        }}>
                          {(appt.doctorName ?? 'Dr').split(' ').map(s => s[0]).join('').slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0b3f3a', margin: 0 }}>
                          {appt.doctorName ?? 'Attending physician'}
                        </h2>
                        <div style={{ fontSize: '13px', color: '#52736d' }}>
                          {appt.doctorSpecialty}{appt.doctorHospital ? ` · ${appt.doctorHospital}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        className="badge-morph"
                        style={{
                          padding: '3px 10px', borderRadius: '9999px',
                          fontSize: '12px', fontWeight: 700,
                          color: urgencyColor(appt.urgency), backgroundColor: urgencyBg(appt.urgency),
                        }}
                      >{appt.urgency}</span>
                      <span
                        className="badge-morph"
                        style={{
                          padding: '3px 10px', borderRadius: '9999px',
                          fontSize: '12px', fontWeight: 600,
                          color: '#0b3f3a', backgroundColor: '#eaf6f2',
                        }}
                      >{statusLabel(appt.status)}</span>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '14px',
                    backgroundColor: '#eaf6f2',
                    padding: '14px 18px', borderRadius: '12px',
                    marginBottom: '14px', fontSize: '13px',
                    border: '1px solid #d9ece7',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={16} color="#0f766e" />
                      <span><strong>Slot:</strong> {formatSlot(appt.slotAt)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {appt.consultationType === 'VIDEO' ? (
                        <Video size={16} color="#0f766e" />
                      ) : (
                        <MapPin size={16} color="#0f766e" />
                      )}
                      <span><strong>Mode:</strong> {appt.consultationType === 'VIDEO' ? 'Telehealth' : 'In-Person'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} color="#0f766e" />
                      <span><strong>Ref:</strong> {appt.id.slice(0, 8)}</span>
                    </div>
                  </div>

                  {appt.chiefComplaint && (
                    <div style={{ fontSize: '14px', marginBottom: '12px', color: '#0b3f3a' }}>
                      <strong>Reported concern:</strong> {appt.chiefComplaint}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {appt.consultationType === 'VIDEO' && appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                      <button
                        onClick={() => navigate(`/consultation/${appt.id}`)}
                        className="btn btn-primary hover-lift"
                        style={{
                          backgroundColor: '#10b981', borderColor: '#10b981',
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        <Video size={14} /> Join Video
                      </button>
                    )}
                    {appt.consultationType === 'VIDEO' && appt.status === 'COMPLETED' && (
                      <button
                        onClick={() => navigate(`/consultation/${appt.id}`)}
                        className="btn btn-secondary hover-lift"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <FileText size={14} /> Visit Summary
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/appointments/${appt.id}`)}
                      className="btn btn-secondary hover-lift"
                    >
                      View details
                    </button>
                    {appt.status === 'COMPLETED' && (
                      <button
                        onClick={() => setReviewingAppt(appt)}
                        className="btn btn-secondary hover-lift"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#b45309',
                          borderColor: 'rgba(217, 119, 6, 0.35)',
                          backgroundColor: 'rgba(254, 243, 199, 0.4)',
                        }}
                      >
                        <Star size={14} fill="#f59e0b" color="#d97706" /> Rate Doctor
                      </button>
                    )}
                    {canCancel && (
                      <button
                        onClick={() => handleCancel(appt.id)}
                        disabled={cancellingId === appt.id}
                        className="btn btn-secondary hover-lift"
                        style={{ color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }}
                      >
                        {cancellingId === appt.id ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Cancelling…
                          </>
                        ) : (
                          <>
                            <XCircle size={14} /> Cancel
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Post-appointment Review Modal */}
      {reviewingAppt && (
        <DoctorReviewModal
          isOpen={!!reviewingAppt}
          onClose={() => setReviewingAppt(null)}
          appointmentId={reviewingAppt.id}
          doctorId={reviewingAppt.doctorId}
          doctorName={reviewingAppt.doctorName}
          doctorSpecialty={reviewingAppt.doctorSpecialty}
          doctorAvatarUrl={reviewingAppt.doctorAvatarUrl}
          onSuccess={() => reload()}
        />
      )}
    </PageTransition>
  );
};
