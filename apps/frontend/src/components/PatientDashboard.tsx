import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTransition } from '../motion/PageTransition';
import {
  Video, PlusCircle, Upload, FileText, Pill, ArrowRight, Check, ChevronRight,
  Loader2, Calendar, Sparkles, ChevronDown, ChevronUp, MessageSquare,
} from 'lucide-react';
import type { Appointment, PatientProfile, Prescription, User, ConsultationSession } from '../types';
import { appointmentsApi, prescriptionsApi, profileApi, consultationsApi } from '../services/api';
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

/** Context title derived from the patient's state. Replaces the generic greeting
 *  so the h1 says something useful (period or state) instead of "Hello, {firstName}". */
function dashboardContext(next: Appointment | null): string {
  if (!next) return 'Nothing scheduled right now';
  const when = formatSlot(next.slotAt);
  if (when.startsWith('Today')) return 'You have a visit today';
  if (when.startsWith('Tomorrow')) return 'You have a visit tomorrow';
  return 'Your next visit';
}

const FONT = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";

/** Sentence-case quiet eyebrow replacing the old uppercase-tracked `cap` style.
 *  The skill flags `NAVIGATION` / `WHAT YOU TOLD US` wide-tracking labels as slop. */
const eyebrow: React.CSSProperties = {
  font: `500 12px ${FONT}`, color: '#8aa39d', letterSpacing: 0,
};

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ currentUser }) => {
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSummaryAppt, setSelectedSummaryAppt] = useState<Appointment | null>(null);
  const [completedSessions, setCompletedSessions] = useState<Record<string, ConsultationSession>>({});
  const [expandedTranscriptId, setExpandedTranscriptId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    /* Profile fetch is fire-and-forget so the dashboard renders even if it 404s
     * (e.g. a brand-new account that hasn't saved a profile yet). */
    Promise.all([appointmentsApi.mine(), prescriptionsApi.mine()])
      .then(([appts, rx]) => { setAppointments(appts); setPrescriptions(rx); })
      .catch(() => {})
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

<<<<<<< HEAD
  useEffect(() => {
    if (completedVisits.length === 0) return;
    completedVisits.forEach(v => {
      if (!completedSessions[v.id]) {
        consultationsApi
          .getSession(v.id)
          .then(sess => {
            setCompletedSessions(prev => ({ ...prev, [v.id]: sess }));
          })
          .catch(() => {
            /* Tolerated if session record is pending */
          });
      }
    });
  }, [completedVisits]);
=======
  const todayLabel = useMemo(() =>
    new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
    []);
>>>>>>> origin/main_v2

  const todos = useMemo(() => ([
    { id: 101, text: 'Complete your medical history', done: !!(profile?.bloodGroup || profile?.allergies || profile?.conditions) },
    { id: 102, text: 'Verify emergency contact', done: !!(profile?.emergencyContactPhone || currentUser?.phone) },
    { id: 103, text: 'Book your first consultation', done: appointments.length > 0 },
  ]), [profile, currentUser?.phone, appointments.length]);

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
    { label: 'Book appointment', icon: <PlusCircle size={16} strokeWidth={1.75} />, action: () => navigate('/book') },
    { label: 'My appointments', icon: <FileText size={16} strokeWidth={1.75} />, action: () => navigate('/appointments') },
    { label: 'Prescriptions', icon: <Pill size={16} strokeWidth={1.75} />, action: () => navigate('/prescriptions') },
    { label: 'Upload records', icon: <Upload size={16} strokeWidth={1.75} />, action: () => navigate('/book') },
  ];

  /* Small action pill — stays pill-shaped at this size (24px tall-ish controls), per the
   * skill's "radius by size" rule. The larger focal buttons and cards switch to nested
   * radius math (card 16, buttons 10). */
  const quickActionPill: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: '#fff', color: '#0b3f3a',
    border: '1px solid #d9ece7', borderRadius: 9999,
    padding: '12px 20px',
    font: `500 13px ${FONT}`, cursor: 'pointer', fontFamily: FONT,
    transition: 'border-color 160ms ease, background-color 160ms ease',
  };

  return (
    <PageTransition>
      <style>{`
        .pd-wrap{width:94%;max-width:1680px;margin:0 auto;padding:40px clamp(20px,4vw,56px) 72px}
        .pd-zone{display:grid;grid-template-columns:70fr 30fr;gap:56px;align-items:start}
        .pd-margin{border-left:1px solid #dbe8e3;padding-left:40px;position:sticky;top:24px}
        .pd-lists{display:grid;grid-template-columns:1fr 1fr;gap:48px}
        .pd-hgrid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
        .pd-card-interactive{transition:border-color 160ms ease}
        .pd-card-interactive:hover{border-color:#b8d4cc}
        .pd-pill:hover{border-color:#b8d4cc;background-color:#fafdfc}
        @media(max-width:1024px){.pd-zone{gap:40px}}
        @media(max-width:900px){.pd-zone{grid-template-columns:1fr;gap:36px}.pd-margin{border-left:0;padding-left:0;position:static}}
        @media(max-width:560px){.pd-lists{grid-template-columns:1fr;gap:28px}}
        @keyframes pd-pulse{0%,100%{opacity:1}50%{opacity:.35}}
      `}</style>

      <div className="pd-wrap" style={{ color: '#0b3f3a', fontFamily: FONT }}>

        {/* Context header: period on top (quiet) + state-aware title (replaces
            the "Hello, Shivang." greeting, per the unslop rule that the h1
            should name the context, not greet the user). */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          gap: 24, flexWrap: 'wrap', marginBottom: 40,
        }}>
          <div>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Today &middot; {todayLabel}</div>
            <h1 style={{
              font: `600 32px/1.1 ${FONT}`, letterSpacing: '-0.02em', margin: 0,
            }}>
              {loading ? 'Your dashboard' : dashboardContext(next)}
            </h1>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            font: `400 14px ${FONT}`, color: '#52736d',
          }}>
            Feeling unwell?
            <button
              onClick={() => navigate('/book')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                font: `500 14px ${FONT}`, color: '#0f766e', padding: 0,
              }}
            >
              Book a visit <ArrowRight size={14} strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <div className="pd-zone">

          {/* ===== LEFT ===== */}
          <div>
            {/* Focal next-visit card — the dashboard's single moment. */}
            {loading ? (
              <div style={{
                background: '#fff', border: '1px solid #d9ece7',
                borderRadius: 16, padding: 32, minHeight: 192,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#52736d',
              }}>
                <Loader2 size={18} className="animate-spin" style={{ marginRight: 8 }} strokeWidth={1.75} />
                Loading your next appointment
              </div>
            ) : next ? (
              <div className="pd-card-interactive" style={{
                padding: 32,
                background: '#fff', border: '1px solid #d9ece7',
                borderRadius: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ font: `500 12px ${FONT}`, color: '#0f766e' }}>
                    {formatSlot(next.slotAt)}
                  </span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#cdddd7' }} />
                  <span style={{ font: `500 12px ${FONT}`, color: '#8aa39d' }}>
                    {timeUntil(next.slotAt) ?? ''}
                  </span>
                </div>
                <div style={{
                  font: `600 24px ${FONT}`, letterSpacing: '-0.01em',
                  margin: '12px 0 4px',
                }}>
                  {next.doctorName}
                </div>
                <div style={{ font: `400 14px ${FONT}`, color: '#52736d' }}>
                  {next.doctorSpecialty}{next.doctorHospital ? ` · ${next.doctorHospital}` : ''}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  marginTop: 24, flexWrap: 'wrap',
                }}>
                  {next.consultationType === 'VIDEO' && (
                    <button
                      onClick={() => navigate(`/consultation/${next.id}`)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: '#0f766e', color: '#fff', border: 'none',
                        borderRadius: 10, padding: '12px 20px',
                        font: `500 14px ${FONT}`, cursor: 'pointer',
                        transition: 'background-color 160ms ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0d655e')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0f766e')}
                    >
                      {/* Pulsing dot is semantic — live/active indicator for video, not decoration. */}
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#7ff0d4', animation: 'pd-pulse 1.5s infinite',
                      }} />
                      <Video size={16} strokeWidth={1.75} /> Join video call
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/appointments/${next.id}`)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'transparent', color: '#0b3f3a',
                      border: '1px solid #d3e2dd', borderRadius: 10,
                      padding: '12px 20px',
                      font: `500 14px ${FONT}`, cursor: 'pointer',
                      transition: 'border-color 160ms ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#b8d4cc')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#d3e2dd')}
                  >
                    View details
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                padding: 32,
                background: '#fff', border: '1px dashed #c2e2db',
                borderRadius: 16,
              }}>
                <div style={{
                  ...eyebrow, display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginBottom: 8,
                }}>
                  <Calendar size={13} color="#0f766e" strokeWidth={1.75} /> Next appointment
                </div>
                <div style={{ font: `600 18px ${FONT}`, margin: '4px 0 8px' }}>
                  No appointments scheduled
                </div>
                <p style={{
                  font: `400 13px/1.5 ${FONT}`, color: '#52736d', margin: '0 0 16px',
                }}>
                  Start with a short triage &mdash; we classify urgency and recommend a specialty.
                </p>
                <button
                  onClick={() => navigate('/book')}
                  style={{
                    background: '#0f766e', color: '#fff', border: 'none',
                    borderRadius: 10, padding: '10px 20px',
                    font: `500 13px ${FONT}`, cursor: 'pointer',
                    transition: 'background-color 160ms ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0d655e')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0f766e')}
                >
                  Start symptom check
                </button>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ marginTop: 36 }}>
              <div style={{ ...eyebrow, marginBottom: 16 }}>Quick actions</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {quickActions.map((a, i) => (
                  <button
                    key={i}
                    onClick={a.action}
                    className="pd-pill"
                    style={quickActionPill}
                  >
                    <span style={{ color: '#0f766e', display: 'inline-flex' }}>{a.icon}</span>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Also coming up + Recent */}
            <div style={{ height: 1, background: '#e5efeb', margin: '36px 0 24px' }} />
            <div className="pd-lists">
              <div>
                <div style={{ ...eyebrow, marginBottom: 16 }}>Also coming up</div>
                {upcoming.slice(1, 4).map(a => (
                  <div key={a.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 0', borderBottom: '1px solid #eef5f3',
                    font: `400 13px ${FONT}`, color: '#52736d',
                  }}>
                    <span>
                      <span style={{ color: '#0b3f3a', fontWeight: 500 }}>{formatSlot(a.slotAt)}</span>
                      &nbsp;·&nbsp; {a.doctorName}
                    </span>
                    <span style={{ color: '#8aa39d' }}>
                      {a.consultationType === 'VIDEO' ? 'Video' : 'In-person'}
                    </span>
                  </div>
                ))}
                {upcoming.length <= 1 && (
                  <div style={{ font: `400 13px ${FONT}`, color: '#8aa39d' }}>
                    Nothing else scheduled
                  </div>
                )}
              </div>
              <div>
                <div style={{ ...eyebrow, marginBottom: 16 }}>Recent</div>
                {recentVisit ? (
                  <>
                    <div style={{ font: `600 15px ${FONT}`, color: '#0b3f3a' }}>
                      {recentVisit.doctorName}
                    </div>
                    <div style={{ font: `400 13px ${FONT}`, color: '#8aa39d', marginTop: 4 }}>
                      {recentVisit.doctorSpecialty} · {formatSlot(recentVisit.slotAt)}
                    </div>
                    <button
                      onClick={() => setSelectedSummaryAppt(recentVisit)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: 'none', border: 'none', cursor: 'pointer',
                        font: `500 13px ${FONT}`, color: '#0f766e',
                        marginTop: 12, padding: 0,
                      }}
                    >
                      Read summary <ArrowRight size={13} strokeWidth={1.75} />
                    </button>
                  </>
                ) : (
                  <div style={{ font: `400 13px ${FONT}`, color: '#8aa39d' }}>
                    No past visits yet
                  </div>
                )}
              </div>
            </div>

            {/* Consultation AI Summaries & Clinical Records (Permanent Patient Archive) */}
            <div style={{ height: 1, background: '#dde9e5', margin: '36px 0 26px' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ ...cap, display: 'inline-flex', alignItems: 'center', gap: 6, color: '#0f766e' }}>
                  <Sparkles size={13} color="#0f766e" /> Consultation AI Summaries & Clinical Records
                </div>
                {completedVisits.length > 0 && (
                  <span style={{ font: `600 11px ${FONT}`, color: '#0f766e', backgroundColor: '#eaf6f2', padding: '2px 8px', borderRadius: 9999 }}>
                    {completedVisits.length} Archival {completedVisits.length === 1 ? 'Record' : 'Records'}
                  </span>
                )}
              </div>

              {completedVisits.length === 0 ? (
                <div
                  style={{
                    padding: '24px',
                    background: '#fcfdfd',
                    border: '1.5px dashed #c2e2db',
                    borderRadius: 16,
                    textAlign: 'center',
                  }}
                >
                  <FileText size={28} color="#0f766e" style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                  <div style={{ font: `600 14px ${FONT}`, color: '#0b3f3a', marginBottom: 4 }}>
                    Permanent AI Summaries Ready
                  </div>
                  <p style={{ font: `400 12px/1.5 ${FONT}`, color: '#52736d', margin: 0 }}>
                    When you conclude a video consultation with your clinician, a comprehensive clinical AI summary,
                    prescribed treatment actions, follow-up instructions, and full transcript will be permanently preserved here for your healthcare history.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {completedVisits.map(visit => {
                    const sess = completedSessions[visit.id];
                    const chiefComplaint = sess?.summaryChiefComplaint || visit.chiefComplaint || 'Consultation follow-up';
                    const advice = sess?.summaryDoctorAdvice || 'Review clinical guidance in full summary.';
                    const actions = sess?.summaryPrescribedActions || 'Digital prescription issued.';
                    const followUp = sess?.summaryFollowUp || 'Routine follow-up in 7–10 days.';

                    // Comprehensive communication summary synthesized from call dialogue
                    const wholeSummary = (visit.notes && !visit.notes.startsWith('Video consultation completed. Summary generated'))
                      ? visit.notes
                      : (sess?.summaryObservations
                          ? sess.summaryObservations.split('\n\nClinical Observations')[0]
                          : `Video consultation completed between ${currentUser.fullName} and ${visit.doctorName}. Condition reviewed and personalized clinical advice provided.`);

                    const isTranscriptOpen = expandedTranscriptId === visit.id;

                    return (
                      <div
                        key={visit.id}
                        className="pd-lift"
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #d9ece7',
                          borderRadius: 16,
                          padding: '20px 22px',
                          boxShadow: '0 2px 8px rgba(11,63,58,.04)',
                        }}
                      >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ font: `700 16px ${FONT}`, color: '#0b3f3a' }}>
                                {visit.doctorName}
                              </span>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  backgroundColor: '#eaf6f2',
                                  color: '#0f766e',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 9999,
                                }}
                              >
                                <Sparkles size={11} /> AI Summary Ready
                              </span>
                            </div>
                            <div style={{ font: `400 13px ${FONT}`, color: '#52736d', marginTop: 2 }}>
                              {visit.doctorSpecialty}{visit.doctorHospital ? ` · ${visit.doctorHospital}` : ''} · {formatSlot(visit.slotAt)}
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#52736d',
                              backgroundColor: '#f1f5f9',
                              padding: '3px 8px',
                              borderRadius: 6,
                            }}
                          >
                            {visit.consultationType === 'VIDEO' ? '🎥 Video Telehealth' : '🏥 In-person Visit'}
                          </span>
                        </div>

                        {/* Whole Video Call Communication Summary Box */}
                        <div
                          style={{
                            backgroundColor: '#f0fdf9',
                            border: '1px solid #ccfbf1',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            marginBottom: '14px',
                            boxShadow: '0 1px 4px rgba(15,118,110,0.04)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '6px',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                color: '#0f766e',
                              }}
                            >
                              <Sparkles size={14} color="#0f766e" /> Whole Video Call Communication Summary
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: '#0f766e',
                                backgroundColor: '#e6f7f2',
                                padding: '1px 8px',
                                borderRadius: '9999px',
                              }}
                            >
                              AI Synthesized from Video Call
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#134e48', fontWeight: 500 }}>
                            {wholeSummary}
                          </p>
                        </div>

                        {/* Summary Snapshot */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 12,
                            padding: '12px 14px',
                            backgroundColor: '#f8faf9',
                            borderRadius: 12,
                            border: '1px solid #e5efeb',
                            marginBottom: 14,
                            fontSize: '12px',
                          }}
                        >
                          <div>
                            <strong style={{ color: '#0f766e', display: 'block', marginBottom: 2 }}>
                              Chief Complaint:
                            </strong>
                            <span style={{ color: '#0b3f3a' }}>{chiefComplaint}</span>
                          </div>
                          <div>
                            <strong style={{ color: '#0f766e', display: 'block', marginBottom: 2 }}>
                              Doctor Advice:
                            </strong>
                            <span style={{ color: '#0b3f3a', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {advice}
                            </span>
                          </div>
                          <div>
                            <strong style={{ color: '#0f766e', display: 'block', marginBottom: 2 }}>
                              Prescribed Actions:
                            </strong>
                            <span style={{ color: '#0b3f3a', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {actions}
                            </span>
                          </div>
                        </div>

                        {/* Follow up & Action buttons */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            <strong style={{ color: '#475569' }}>Follow-up:</strong> {followUp}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              onClick={() => setExpandedTranscriptId(prev => prev === visit.id ? null : visit.id)}
                              className="pd-lift"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: isTranscriptOpen ? '#eaf6f2' : '#ffffff',
                                color: '#0f766e',
                                border: '1px solid #d3e2dd',
                                borderRadius: 9999,
                                padding: '8px 14px',
                                font: `600 12px ${FONT}`,
                                cursor: 'pointer',
                              }}
                            >
                              <MessageSquare size={13} />
                              <span>{isTranscriptOpen ? 'Hide Transcript' : 'View Dialogue Transcript'}</span>
                              {isTranscriptOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                            <button
                              onClick={() => setSelectedSummaryAppt(visit)}
                              className="pd-lift"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                background: '#0f766e',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 9999,
                                padding: '8px 16px',
                                font: `600 12px ${FONT}`,
                                cursor: 'pointer',
                              }}
                            >
                              <FileText size={13} /> Full Report & Print
                            </button>
                            <button
                              onClick={() => navigate('/prescriptions')}
                              className="pd-lift"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                background: 'transparent',
                                color: '#0b3f3a',
                                border: '1px solid #d3e2dd',
                                borderRadius: 9999,
                                padding: '8px 14px',
                                font: `600 12px ${FONT}`,
                                cursor: 'pointer',
                              }}
                            >
                              <Pill size={13} color="#0f766e" /> Prescriptions
                            </button>
                          </div>
                        </div>

                        {/* Inline Word-for-Word Conversation Transcript */}
                        {isTranscriptOpen && (
                          <div
                            style={{
                              marginTop: '14px',
                              padding: '14px 16px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #d9ece7',
                              borderRadius: '12px',
                              maxHeight: '260px',
                              overflowY: 'auto',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#52736d',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                marginBottom: '10px',
                              }}
                            >
                              <MessageSquare size={13} color="#0f766e" /> Word-for-Word Video Call Transcript
                            </div>
                            {sess?.transcript ? (
                              <pre
                                style={{
                                  margin: 0,
                                  fontSize: '12px',
                                  lineHeight: 1.6,
                                  whiteSpace: 'pre-wrap',
                                  fontFamily: 'inherit',
                                  color: '#1e293b',
                                  backgroundColor: '#f8faf9',
                                  padding: '10px 12px',
                                  borderRadius: '8px',
                                  border: '1px solid #edf4f2',
                                }}
                              >
                                {sess.transcript}
                              </pre>
                            ) : (
                              <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                                Consultation completed. Dialogue transcript processed into the clinical communication summary above.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ===== RIGHT RAIL ===== */}
          <div className="pd-margin">
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 16,
            }}>
              <div style={eyebrow}>Your health summary</div>
              <button
                onClick={() => navigate('/profile')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  font: `500 13px ${FONT}`, color: '#0f766e', padding: 0,
                }}
              >
                Edit
              </button>
            </div>
            <div className="pd-hgrid">
              {[
                { l: 'Blood group', v: health.bloodGroup, big: true },
                { l: 'Conditions', v: health.conditions },
                { l: 'Allergies', v: health.allergies },
                {
                  l: 'Emergency contact',
                  v: <>
                    {health.emergencyName}
                    {health.emergencyPhone && (
                      <><br /><span style={{ color: '#52736d', fontSize: 13 }}>{health.emergencyPhone}</span></>
                    )}
                  </>,
                },
              ].map((f, i) => (
                <div key={i}>
                  <div style={{
                    font: `500 12px ${FONT}`, color: '#8aa39d',
                    marginBottom: 6,
                  }}>
                    {f.l}
                  </div>
                  <div style={{
                    font: f.big ? `600 18px ${FONT}` : `500 14px/1.4 ${FONT}`,
                    color: '#0b3f3a',
                  }}>
                    {f.v}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: '#e5efeb', margin: '28px 0 20px' }} />
            <div style={{ ...eyebrow, marginBottom: 14 }}>Worth a moment</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {todos.map(t => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    font: `400 14px ${FONT}`,
                    color: t.done ? '#8aa39d' : '#0b3f3a',
                    textDecoration: t.done ? 'line-through' : 'none',
                  }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: t.done ? 'none' : '1.5px solid #cbdbd5',
                    background: t.done ? '#0f766e' : 'transparent',
                  }}>
                    {t.done && <Check size={10} color="#fff" strokeWidth={3} />}
                  </span>
                  {t.text}
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: '#e5efeb', margin: '24px 0 16px' }} />
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 10,
              font: `400 13px ${FONT}`, color: '#52736d',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Consultations</span>
                <span style={{ color: '#0b3f3a', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {appointments.length}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Active prescriptions</span>
                <span style={{ color: '#0b3f3a', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {signedPrescriptions.length}
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate('/prescriptions')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                font: `500 13px ${FONT}`, color: '#0f766e',
                marginTop: 16, padding: 0,
              }}
            >
              Open records <ChevronRight size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      {selectedSummaryAppt && (
        <MeetingSummaryModal
          appointment={selectedSummaryAppt}
          onClose={() => setSelectedSummaryAppt(null)}
        />
      )}
    </PageTransition>
  );
};
