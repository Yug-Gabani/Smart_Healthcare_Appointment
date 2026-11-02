import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageTransition } from '../motion/PageTransition';
import { ArrowLeft, Calendar, Clock, Loader2, MapPin, Video, XCircle, FileText } from 'lucide-react';
import type { Appointment } from '../types';
import { appointmentsApi } from '../services/api';

function formatSlot(iso?: string): string {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
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

export const AppointmentDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    appointmentsApi
      .get(id)
      .then(setAppt)
      .catch(err => setError(err.message || 'Could not load appointment'))
      .finally(() => setLoading(false));
  }, [id]);

  const canCancel =
    appt &&
    appt.status !== 'CANCELLED' &&
    appt.status !== 'COMPLETED' &&
    appt.status !== 'NO_SHOW';

  const handleCancel = async () => {
    if (!appt) return;
    if (!confirm('Cancel this appointment? The slot will be released.')) return;
    setCancelling(true);
    try {
      const updated = await appointmentsApi.cancel(appt.id);
      setAppt(updated);
    } catch (err: any) {
      alert(err.message || 'Could not cancel this appointment.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <PageTransition style={{ maxWidth: '720px', margin: '20px auto 28px', padding: '0 20px' }}>
      <button
        onClick={() => navigate(-1)}
        className="hover-lift"
        style={{
          background: 'transparent', border: 'none', color: '#0f766e',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          padding: '4px 0', marginBottom: '12px',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
        }}
      >
        <ArrowLeft size={16} /> Back
      </button>

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

      {appt && (
        <div className="card card-hover" style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
            {appt.doctorAvatarUrl ? (
              <img
                src={appt.doctorAvatarUrl}
                alt={appt.doctorName ?? ''}
                style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                backgroundColor: '#eaf6f2', color: '#0f766e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '20px',
              }}>
                {(appt.doctorName ?? 'Dr').split(' ').map(s => s[0]).join('').slice(0, 2)}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0b3f3a', margin: 0 }}>
                {appt.doctorName}
              </h1>
              <div style={{ color: '#52736d', fontSize: '14px' }}>
                {appt.doctorSpecialty} · {appt.doctorHospital}
              </div>
            </div>
            <span
              className="badge-morph"
              style={{
                padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
                color: urgencyColor(appt.urgency), backgroundColor: urgencyBg(appt.urgency),
              }}
            >{appt.urgency}</span>
          </div>

          <div style={{
            display: 'grid', gap: '10px',
            backgroundColor: '#eaf6f2', borderRadius: '14px',
            padding: '14px 18px', border: '1px solid #d9ece7',
            fontSize: '14px', marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={16} color="#0f766e" />
              <span><strong>Date:</strong> {formatSlot(appt.slotAt)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {appt.consultationType === 'VIDEO' ? (
                <Video size={16} color="#0f766e" />
              ) : (
                <MapPin size={16} color="#0f766e" />
              )}
              <span><strong>Mode:</strong> {appt.consultationType === 'VIDEO' ? 'Encrypted video consult' : 'In-person at hospital'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={16} color="#0f766e" />
              <span><strong>Status:</strong> {appt.status}</span>
            </div>
          </div>

          {appt.chiefComplaint && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#52736d', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                Reported concern
              </div>
              <div style={{ fontSize: '14px', color: '#0b3f3a', lineHeight: 1.5 }}>{appt.chiefComplaint}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {appt.consultationType === 'VIDEO' && appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
              <button
                onClick={() => navigate(`/consultation/${appt.id}`)}
                className="btn btn-primary hover-lift"
                style={{
                  backgroundColor: '#10b981', borderColor: '#10b981',
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                }}
              >
                <Video size={16} /> Enter Video Consultation
              </button>
            )}
            {appt.consultationType === 'VIDEO' && appt.status === 'COMPLETED' && (
              <button
                onClick={() => navigate(`/consultation/${appt.id}`)}
                className="btn btn-primary hover-lift"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <FileText size={16} /> View Consultation Summary
              </button>
            )}
            <button
              onClick={() => navigate('/prescriptions')}
              className="btn btn-secondary hover-lift"
            >
              View prescriptions
            </button>
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="btn btn-secondary hover-lift"
                style={{ color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }}
              >
                {cancelling ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Cancelling…
                  </>
                ) : (
                  <>
                    <XCircle size={14} /> Cancel appointment
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </PageTransition>
  );
};
