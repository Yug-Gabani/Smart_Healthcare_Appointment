import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTransition } from '../motion/PageTransition';
import {
  Video, PlusCircle, Upload, FileText, Pill, ArrowRight, Check, ChevronRight,
  Loader2, Calendar,
} from 'lucide-react';
import type { Appointment, PatientProfile, Prescription, User } from '../types';
import { appointmentsApi, prescriptionsApi, profileApi } from '../services/api';
import { MeetingSummaryModal } from './MeetingSummaryModal';

interface PatientDashboardProps {
  currentUser: User;
}

function formatSlot(iso?: string): string {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}
function timeUntil(iso?: string): string | null {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return 'starts now';
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

const FONT = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const cap: React.CSSProperties = { font: `700 10px ${FONT}`, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9bb0aa' };

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const firstName = currentUser?.fullName ? currentUser.fullName.split(' ')[0] : 'there';

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSummaryAppt, setSelectedSummaryAppt] = useState<Appointment | null>(null);

  useEffect(() => {
    setLoading(true);
    /* Profile fetch is fire-and-forget so the dashboard renders even if it 404s
     * (e.g. a brand-new account that hasn't saved a profile yet). */
    Promise.all([appointmentsApi.mine(), prescriptionsApi.mine()])
      .then(([appts, rx]) => { setAppointments(appts); setPrescriptions(rx); })
      .catch(() => { /* keep existing fallback demo data here if desired */ })
      .finally(() => setLoading(false));
    profileApi.get().then(setProfile).catch(() => setProfile(null));
  }, [currentUser]);

  const signedPrescriptions = useMemo(() => prescriptions.filter(r => r.status === 'SIGNED'), [prescriptions]);
  const upcoming = useMemo(
    () => appointments.filter(a => a.status === 'BOOKED' || a.status === 'CONFIRMED')
      .sort((a, b) => (a.slotAt && b.slotAt ? a.slotAt.localeCompare(b.slotAt) : 0)),
    [appointments]);
  const completedVisits = useMemo(
    () => appointments.filter(a => a.status === 'COMPLETED')
      .sort((a, b) => (a.slotAt && b.slotAt ? b.slotAt.localeCompare(a.slotAt) : 0)),
    [appointments]);
  const next = upcoming[0] ?? null;
  const recentVisit = completedVisits[0] ?? null;

  const todos = useMemo(() => ([
    { id: 101, text: 'Complete your medical history', done: false },
    { id: 102, text: 'Verify emergency contact', done: !!currentUser?.phone },
    { id: 103, text: 'Book your first consultation', done: appointments.length > 0 },
  ]), [currentUser?.phone, appointments.length]);

  /* Health summary — reads from the patient profile fetched above. Each field falls back
   * to an em-dash when the patient hasn't saved it yet; clicking "Edit" jumps to /profile
   * where the full form lives. */
  const health = {
    bloodGroup: profile?.bloodGroup || '—',
    allergies: profile?.allergies || '—',
    conditions: profile?.conditions || '—',
    emergencyName: profile?.emergencyContactName || '—',
    emergencyPhone: profile?.emergencyContactPhone || currentUser?.phone || '',
  };

  /* Quick-action tiles point at routes that actually exist today. "Upload records" and
   * "View medical records" from the design brief would hit /records, which isn't built
   * yet — re-mapped to the booking flow (which accepts attachments) and the appointments
   * history (which is the closest thing to a records view). Swap these back in a future
   * PR when a dedicated /records page ships. */
  const quickActions = [
    { label: 'Book appointment', icon: <PlusCircle size={16} />, action: () => navigate('/book') },
    { label: 'My appointments', icon: <FileText size={16} />, action: () => navigate('/appointments') },
    { label: 'Prescriptions', icon: <Pill size={16} />, action: () => navigate('/prescriptions') },
    { label: 'Upload records', icon: <Upload size={16} />, action: () => navigate('/book') },
  ];

  const pill: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 9, background: '#fff', color: '#0b3f3a',
    border: '1px solid #d9ece7', borderRadius: 9999, padding: '11px 18px',
    font: `600 13px ${FONT}`, cursor: 'pointer',
  };

  return (
    <PageTransition>
      <style>{`
        .pd-wrap{width:94%;max-width:1680px;margin:0 auto;padding:40px clamp(20px,4vw,56px) 72px}
        .pd-zone{display:grid;grid-template-columns:70fr 30fr;gap:56px;align-items:start}
        .pd-margin{border-left:1px solid #dbe8e3;padding-left:40px;position:sticky;top:24px}
        .pd-lists{display:grid;grid-template-columns:1fr 1fr;gap:48px}
        .pd-hgrid{display:grid;grid-template-columns:1fr 1fr;gap:20px 18px}
        .pd-lift{transition:transform .2s cubic-bezier(.2,.65,.3,.9),box-shadow .2s,border-color .2s}
        .pd-lift:hover{transform:translateY(-2px)}
        @media(max-width:1024px){.pd-zone{gap:40px}}
        @media(max-width:900px){.pd-zone{grid-template-columns:1fr;gap:36px}.pd-margin{border-left:0;padding-left:0;position:static}}
        @media(max-width:560px){.pd-lists{grid-template-columns:1fr;gap:28px}}
        @keyframes pd-pulse{0%,100%{opacity:1}50%{opacity:.3}}
      `}</style>

      <div className="pd-wrap" style={{ color: '#0b3f3a', fontFamily: FONT }}>

        {/* greeting */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', marginBottom: 40 }}>
          <div>
            <h1 style={{ font: `700 34px/1.08 ${FONT}`, letterSpacing: '-.03em', margin: 0 }}>Hello, {firstName}.</h1>
            <p style={{ font: `400 16px/1.5 ${FONT}`, color: '#52736d', margin: '12px 0 0' }}>
              {next ? 'You have one appointment coming up. Nothing else needs you right now.' : 'Nothing scheduled yet — start whenever you’re ready.'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: `500 14px ${FONT}`, color: '#52736d' }}>
            Feeling unwell?
            <button onClick={() => navigate('/book')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, font: `600 14px ${FONT}`, color: '#0f766e' }}>
              Book a visit <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="pd-zone">

          {/* ===== LEFT ===== */}
          <div>
            {/* focal next visit */}
            {loading ? (
              <div style={{ background: '#fff', border: '1px solid #d9ece7', borderRadius: 18, padding: 30, minHeight: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52736d' }}>
                <Loader2 size={18} className="animate-spin" style={{ marginRight: 8 }} /> Loading your next appointment…
              </div>
            ) : next ? (
              <div className="pd-lift" style={{ padding: '30px 32px', background: '#fff', border: '1px solid #d9ece7', borderRadius: 18, boxShadow: '0 2px 10px rgba(11,63,58,.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ font: `700 11px ${FONT}`, letterSpacing: '.1em', color: '#0f766e' }}>{formatSlot(next.slotAt).toUpperCase()}</span>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cdddd7' }} />
                  <span style={{ font: `600 11px ${FONT}`, color: '#8aa39d' }}>{timeUntil(next.slotAt) ?? ''}</span>
                </div>
                <div style={{ font: `700 25px ${FONT}`, letterSpacing: '-.01em', margin: '14px 0 4px' }}>{next.doctorName}</div>
                <div style={{ font: `400 14px ${FONT}`, color: '#52736d' }}>{next.doctorSpecialty}{next.doctorHospital ? ` · ${next.doctorHospital}` : ''}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
                  {next.consultationType === 'VIDEO' && (
                    <button onClick={() => navigate(`/consultation/${next.id}`)} className="pd-lift"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#0f766e', color: '#fff', border: 'none', borderRadius: 9999, padding: '12px 24px', font: `600 14px ${FONT}`, cursor: 'pointer', boxShadow: '0 5px 16px rgba(15,118,110,.26)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7ff0d4', animation: 'pd-pulse 1.5s infinite' }} />
                      <Video size={16} /> Join video call
                    </button>
                  )}
                  <button onClick={() => navigate(`/appointments/${next.id}`)} className="pd-lift"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', color: '#0b3f3a', border: '1px solid #d3e2dd', borderRadius: 9999, padding: '12px 22px', font: `600 14px ${FONT}`, cursor: 'pointer' }}>
                    View details
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '30px 32px', background: '#fff', border: '1.5px dashed #c2e2db', borderRadius: 18 }}>
                <div style={{ ...cap, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Calendar size={13} color="#0f766e" /> Next appointment</div>
                <div style={{ font: `700 18px ${FONT}`, margin: '10px 0 6px' }}>No appointments scheduled</div>
                <p style={{ font: `400 13px/1.5 ${FONT}`, color: '#52736d', margin: '0 0 18px' }}>Start with a short triage — we classify urgency and recommend a specialty.</p>
                <button onClick={() => navigate('/book')} style={{ background: '#0f766e', color: '#fff', border: 'none', borderRadius: 9999, padding: '10px 20px', font: `600 13px ${FONT}`, cursor: 'pointer' }}>Start triage & book</button>
              </div>
            )}

            {/* quick actions */}
            <div style={{ marginTop: 34 }}>
              <div style={{ ...cap, marginBottom: 14 }}>Quick actions</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {quickActions.map((a, i) => (
                  <button key={i} onClick={a.action} className="pd-lift" style={pill}>
                    <span style={{ color: '#0f766e', display: 'inline-flex' }}>{a.icon}</span>{a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* also coming up + recent */}
            <div style={{ height: 1, background: '#dde9e5', margin: '36px 0 26px' }} />
            <div className="pd-lists">
              <div>
                <div style={{ ...cap, marginBottom: 16 }}>Also coming up</div>
                {upcoming.slice(1, 4).map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #edf3f1', font: `500 13px ${FONT}`, color: '#52736d' }}>
                    <span><b style={{ color: '#0b3f3a', fontWeight: 600 }}>{formatSlot(a.slotAt)}</b> &nbsp; {a.doctorName}</span>
                    <span style={{ color: '#8aa39d' }}>{a.consultationType === 'VIDEO' ? 'Video' : 'In-person'}</span>
                  </div>
                ))}
                {upcoming.length <= 1 && <div style={{ font: `400 13px ${FONT}`, color: '#8aa39d' }}>Nothing else scheduled.</div>}
              </div>
              <div>
                <div style={{ ...cap, marginBottom: 16 }}>Recent</div>
                {recentVisit ? (
                  <>
                    <div style={{ font: `600 15px ${FONT}`, color: '#0b3f3a' }}>{recentVisit.doctorName}</div>
                    <div style={{ font: `400 13px ${FONT}`, color: '#8aa39d', marginTop: 2 }}>{recentVisit.doctorSpecialty} · {formatSlot(recentVisit.slotAt)}</div>
                    <button onClick={() => setSelectedSummaryAppt(recentVisit)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', font: `600 13px ${FONT}`, color: '#0f766e', marginTop: 10, padding: 0 }}>
                      Read summary <ArrowRight size={13} />
                    </button>
                  </>
                ) : <div style={{ font: `400 13px ${FONT}`, color: '#8aa39d' }}>No past visits yet.</div>}
              </div>
            </div>
          </div>

          {/* ===== RIGHT MARGIN ===== */}
          <div className="pd-margin">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
              <div style={cap}>Your health summary</div>
              <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', font: `600 13px ${FONT}`, color: '#0f766e', padding: 0 }}>Edit</button>
            </div>
            <div className="pd-hgrid">
              {[
                { l: 'Blood group', v: health.bloodGroup, big: true },
                { l: 'Conditions', v: health.conditions },
                { l: 'Allergies', v: health.allergies },
                { l: 'Emergency contact', v: <>{health.emergencyName}{health.emergencyPhone ? <><br /><span style={{ color: '#52736d', fontSize: 13 }}>{health.emergencyPhone}</span></> : null}</> },
              ].map((f, i) => (
                <div key={i}>
                  <div style={{ font: `600 11px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: '#9bb0aa', marginBottom: 5 }}>{f.l}</div>
                  <div style={{ font: f.big ? `700 18px ${FONT}` : `500 14px/1.4 ${FONT}`, color: '#0b3f3a' }}>{f.v}</div>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: '#dde9e5', margin: '28px 0 20px' }} />
            <div style={{ ...cap, marginBottom: 14 }}>Worth a moment</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {todos.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 11, font: `400 14px ${FONT}`, color: t.done ? '#8aa39d' : '#0b3f3a', textDecoration: t.done ? 'line-through' : 'none' }}>
                  <span style={{ width: 17, height: 17, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: t.done ? 'none' : '1.5px solid #cbdbd5', background: t.done ? '#0f766e' : 'transparent' }}>
                    {t.done && <Check size={10} color="#fff" strokeWidth={3.5} />}
                  </span>{t.text}
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: '#dde9e5', margin: '22px 0 18px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, font: `500 13px ${FONT}`, color: '#52736d' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Consultations</span><b style={{ color: '#0b3f3a', fontWeight: 700 }}>{appointments.length}</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active prescriptions</span><b style={{ color: '#0b3f3a', fontWeight: 700 }}>{signedPrescriptions.length}</b></div>
            </div>
            <button onClick={() => navigate('/prescriptions')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', font: `600 13px ${FONT}`, color: '#0f766e', marginTop: 16, padding: 0 }}>
              Open records <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {selectedSummaryAppt && (
        <MeetingSummaryModal appointment={selectedSummaryAppt} onClose={() => setSelectedSummaryAppt(null)} />
      )}
    </PageTransition>
  );
};
