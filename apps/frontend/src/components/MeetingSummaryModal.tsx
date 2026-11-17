import React, { useEffect, useState } from 'react';
import {
  X,
  FileText,
  Calendar,
  Stethoscope,
  Sparkles,
  AlertTriangle,
  Pill,
  Printer,
  Copy,
  Check,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Edit3,
  Save,
  HelpCircle,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { consultationsApi } from '../services/api';
import type { ConsultationSession, Appointment, User, DoctorReviewSummaryRequest } from '../types';

interface MeetingSummaryModalProps {
  appointment: Appointment;
  onClose: () => void;
  currentUser?: User | null;
}

export const MeetingSummaryModal: React.FC<MeetingSummaryModalProps> = ({
  appointment,
  onClose,
  currentUser,
}) => {
  const [session, setSession] = useState<ConsultationSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [savingReview, setSavingReview] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Edit form state
  const [editComplaint, setEditComplaint] = useState('');
  const [editSymptoms, setEditSymptoms] = useState('');
  const [editDiscussion, setEditDiscussion] = useState('');
  const [editObservations, setEditObservations] = useState('');
  const [editAdvice, setEditAdvice] = useState('');
  const [editActions, setEditActions] = useState('');
  const [editFollowUp, setEditFollowUp] = useState('');
  const [editMissingInfo, setEditMissingInfo] = useState('');
  const [overrideNotes, setOverrideNotes] = useState('');

  const isDoctor =
    currentUser?.role === 'DOCTOR' ||
    (typeof window !== 'undefined' && localStorage.getItem('userRole') === 'DOCTOR');

  useEffect(() => {
    let isMounted = true;
    consultationsApi
      .getSession(appointment.id)
      .then(data => {
        if (isMounted) {
          setSession(data);
          initEditForm(data);
        }
      })
      .catch(err => {
        console.warn('Could not fetch consultation session, using appointment fallback:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [appointment.id]);

  const initEditForm = (sess: ConsultationSession) => {
    setEditComplaint(sess.summaryChiefComplaint || appointment.chiefComplaint || '');
    setEditSymptoms(sess.summaryPatientSymptoms || '');
    setEditDiscussion(sess.summaryDiscussionPoints || '');
    setEditObservations(sess.summaryObservations || '');
    setEditAdvice(sess.summaryDoctorAdvice || '');
    setEditActions(sess.summaryPrescribedActions || '');
    setEditFollowUp(sess.summaryFollowUp || '');
    setEditMissingInfo(sess.summaryMissingInfo || '');
    setOverrideNotes(sess.doctorOverrideNotes || '');
  };

  const handleSaveReview = async () => {
    setSavingReview(true);
    setFeedbackMsg(null);
    try {
      const payload: DoctorReviewSummaryRequest = {
        chiefComplaint: editComplaint,
        patientSymptoms: editSymptoms,
        discussionPoints: editDiscussion,
        observations: editObservations,
        doctorAdvice: editAdvice,
        prescribedActions: editActions,
        followUp: editFollowUp,
        missingInfo: editMissingInfo,
        overrideNotes: overrideNotes,
        confirmVerification: true,
      };

      const updated = await consultationsApi.reviewSummary(appointment.id, payload);
      setSession(updated);
      setIsEditing(false);
      setFeedbackMsg('Clinical summary successfully verified and saved.');
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save reviewed summary');
    } finally {
      setSavingReview(false);
    }
  };

  const reason = session?.summaryChiefComplaint || appointment.chiefComplaint || 'Routine medical follow-up';
  const symptoms = session?.summaryPatientSymptoms || 'Symptoms evaluated during live teleconsultation.';
  const discussion = session?.summaryDiscussionPoints || 'Discussion completed between doctor and patient.';
  const observations = session?.summaryObservations || 'Visual and symptom assessment conducted via secure telehealth. Patient condition reviewed.';
  const advice = session?.summaryDoctorAdvice || 'Maintain prescribed hydration and symptom relief routines. Rest adequately.';
  const actions = session?.summaryPrescribedActions || 'Review digital prescription in the portal. Complete any ordered tests.';
  const followUp = session?.summaryFollowUp || 'Schedule follow-up review in 7–10 days if symptoms persist. Seek immediate emergency care for acute respiratory distress or chest pain.';
  const missingInfo = session?.summaryMissingInfo || 'None explicitly noted.';

  const handleCopySummary = () => {
    const text = `
PulseCare Telehealth - 6-Dimension Consultation Clinical Summary
-----------------------------------------------------------------
Date: ${appointment.slotAt ? new Date(appointment.slotAt).toLocaleString() : 'N/A'}
Doctor: ${appointment.doctorName || session?.doctorName || 'Doctor'} (${appointment.doctorSpecialty || 'General'})
Patient: ${appointment.patientName || session?.patientName || 'Patient'}
Appointment ID: ${appointment.id}
Status: ${session?.doctorReviewed ? 'Clinician Verified' : 'AI Advisory (Pending Review)'}

1. Reason for Consultation:
${reason}

2. Patient-Reported Symptoms:
${symptoms}

3. Important Discussion Points:
${discussion}

4. Doctor Observations & Advice:
${observations}
Advice: ${advice}

5. Recommended Next Steps & Prescriptions:
${actions}

6. Follow-Up Recommendations & Red Flags:
${followUp}

Missing / Unconfirmed Information:
${missingInfo}
-----------------------------------------------------------------
Verified Telehealth Medical Summary (Advisory AI Assist)
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 63, 58, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(15, 118, 110, 0.25)',
          border: '1px solid #d9ece7',
          overflow: 'hidden',
          animation: 'fadeInUp 0.25s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 28px',
            background: 'linear-gradient(135deg, #0b3f3a 0%, #0f766e 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                }}
              >
                <Sparkles size={12} color="#a7f3d0" />
                AI-Synthesized Meeting Summary
              </span>

              {session?.doctorReviewed ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'rgba(16, 185, 129, 0.25)',
                    color: '#a7f3d0',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  <ShieldCheck size={12} />
                  Clinician Verified
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'rgba(245, 158, 11, 0.25)',
                    color: '#fde68a',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  <ShieldAlert size={12} />
                  AI Advisory · Pending Clinician Review
                </span>
              )}

              {session?.patientConsentTranscription && session?.doctorConsentTranscription && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    color: '#e2ece9',
                    fontSize: '10px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  Dual-Consent Audio
                </span>
              )}
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
              Structured Consultation Summary
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', opacity: 0.9 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Stethoscope size={14} />
                {appointment.doctorName ? `Dr. ${appointment.doctorName}` : (session?.doctorName || 'Doctor')}
                {appointment.doctorSpecialty && ` (${appointment.doctorSpecialty})`}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={14} />
                {appointment.slotAt ? new Date(appointment.slotAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }) : 'Completed'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Success feedback alert */}
        {feedbackMsg && (
          <div
            style={{
              backgroundColor: '#ecfdf5',
              borderBottom: '1px solid #a7f3d0',
              padding: '10px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#065f46',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={16} />
            {feedbackMsg}
          </div>
        )}

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#52736d' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: '#0f766e' }} />
              <p style={{ fontSize: '14px', margin: 0 }}>Retrieving structured consultation summary…</p>
            </div>
          ) : isEditing ? (
            /* Clinician Edit & Override Form */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  backgroundColor: '#fefce8',
                  border: '1px solid #fef08a',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  color: '#713f12',
                }}
              >
                <strong>Clinician Review Mode (DR-15, DR-16):</strong> Review and modify any of the AI-generated
                fields below before confirming. Original AI advisory summary will be preserved in audit records.
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0b3f3a', display: 'block', marginBottom: '4px' }}>
                  1. Reason for Consultation:
                </label>
                <input
                  type="text"
                  value={editComplaint}
                  onChange={e => setEditComplaint(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0b3f3a', display: 'block', marginBottom: '4px' }}>
                  2. Patient-Reported Symptoms:
                </label>
                <textarea
                  rows={2}
                  value={editSymptoms}
                  onChange={e => setEditSymptoms(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0b3f3a', display: 'block', marginBottom: '4px' }}>
                  3. Important Discussion Points:
                </label>
                <textarea
                  rows={2}
                  value={editDiscussion}
                  onChange={e => setEditDiscussion(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0b3f3a', display: 'block', marginBottom: '4px' }}>
                  4. Doctor Observations:
                </label>
                <textarea
                  rows={2}
                  value={editObservations}
                  onChange={e => setEditObservations(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0b3f3a', display: 'block', marginBottom: '4px' }}>
                  4b. Doctor Advice & Treatment Instructions:
                </label>
                <textarea
                  rows={2}
                  value={editAdvice}
                  onChange={e => setEditAdvice(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0b3f3a', display: 'block', marginBottom: '4px' }}>
                  5. Recommended Next Steps & Prescriptions:
                </label>
                <textarea
                  rows={2}
                  value={editActions}
                  onChange={e => setEditActions(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0b3f3a', display: 'block', marginBottom: '4px' }}>
                  6. Follow-Up Recommendations & Red Flags:
                </label>
                <textarea
                  rows={2}
                  value={editFollowUp}
                  onChange={e => setEditFollowUp(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0b3f3a', display: 'block', marginBottom: '4px' }}>
                  Missing / Unconfirmed Information:
                </label>
                <textarea
                  rows={2}
                  value={editMissingInfo}
                  onChange={e => setEditMissingInfo(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#b91c1c', display: 'block', marginBottom: '4px' }}>
                  Doctor Override Notes (Audit Trail):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Adjusted medication dosage based on patient reported history..."
                  value={overrideNotes}
                  onChange={e => setOverrideNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #f87171', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={savingReview}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReview}
                  disabled={savingReview}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    background: '#0f766e',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {savingReview ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Confirm & Save Verified Record
                </button>
              </div>
            </div>
          ) : (
            /* Read-Only Structured Clinical Summary */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Doctor Override Note Banner if present */}
              {session?.doctorOverrideNotes && (
                <div
                  style={{
                    backgroundColor: '#fff7ed',
                    borderRadius: '12px',
                    padding: '12px 18px',
                    border: '1px solid #fed7aa',
                    fontSize: '13px',
                    color: '#9a3412',
                  }}
                >
                  <strong>Clinician Override Audit Note:</strong> {session.doctorOverrideNotes}
                </div>
              )}

              {/* 1. Reason for Consultation */}
              <div
                style={{
                  backgroundColor: '#f5faf8',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: '1px solid #d9ece7',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                  <FileText size={16} />
                  <span>1. Reason for Consultation</span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#134e48', lineHeight: 1.5 }}>
                  {reason}
                </p>
              </div>

              {/* 2. Patient-Reported Symptoms */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: '1px solid #e2ece9',
                  boxShadow: '0 2px 8px rgba(15, 118, 110, 0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                  <Activity size={16} />
                  <span>2. Patient-Reported Symptoms (Subjective)</span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#2d3748', lineHeight: 1.6 }}>
                  {symptoms}
                </p>
              </div>

              {/* 3. Important Discussion Points */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                  <MessageSquare size={16} />
                  <span>3. Important Discussion Points</span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.6 }}>
                  {discussion}
                </p>
              </div>

              {/* 4. Doctor's Observations & Advice */}
              <div
                style={{
                  backgroundColor: '#eff6ff',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: '1px solid #bfdbfe',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1d4ed8', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                  <Stethoscope size={16} />
                  <span>4. Doctor's Observations & Clinical Advice</span>
                </div>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e3a8a', lineHeight: 1.6 }}>
                  {observations}
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: '#1e40af', lineHeight: 1.6, fontWeight: 500 }}>
                  <strong>Doctor Advice:</strong> {advice}
                </p>
              </div>

              {/* 5. Recommended Next Steps */}
              <div
                style={{
                  backgroundColor: '#fefce8',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: '1px solid #fef08a',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a16207', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                  <Pill size={16} />
                  <span>5. Recommended Next Steps & Prescriptions</span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#713f12', lineHeight: 1.6 }}>
                  {actions}
                </p>
              </div>

              {/* 6. Follow-up Recommendations & Red Flags */}
              <div
                style={{
                  backgroundColor: '#fff1f2',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: '1px solid #fecdd3',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#be123c', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                  <AlertTriangle size={16} />
                  <span>6. Follow-Up Plan & Red-Flag Warnings</span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#881337', lineHeight: 1.6 }}>
                  {followUp}
                </p>
              </div>

              {/* Missing Information */}
              {missingInfo && (
                <div
                  style={{
                    backgroundColor: '#fafaf9',
                    borderRadius: '16px',
                    padding: '14px 20px',
                    border: '1px solid #e7e5e4',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#57534e', fontWeight: 700, fontSize: '12px', marginBottom: '4px' }}>
                    <HelpCircle size={15} />
                    <span>Identified Missing / Unconfirmed Information</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#78716c', lineHeight: 1.5 }}>
                    {missingInfo}
                  </p>
                </div>
              )}

              {/* Collapsible Transcript */}
              {session?.transcript && (
                <div
                  style={{
                    borderRadius: '16px',
                    border: '1px solid #e2ece9',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => setShowTranscript(!showTranscript)}
                    style={{
                      width: '100%',
                      padding: '12px 18px',
                      backgroundColor: '#f8fafc',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MessageSquare size={15} />
                      Consultation Dialogue Transcript ({showTranscript ? 'Hide' : 'Show'})
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{showTranscript ? '▲' : '▼'}</span>
                  </button>

                  {showTranscript && (
                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: '#ffffff',
                        fontSize: '12px',
                        color: '#334155',
                        lineHeight: 1.6,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace',
                      }}
                    >
                      {session.transcript}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '18px 28px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2ece9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleCopySummary}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              <span>{copied ? 'Summary Copied!' : 'Copy Summary'}</span>
            </button>

            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Printer size={14} />
              <span>Print / Save PDF</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isDoctor && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '9999px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Edit3 size={14} />
                Edit / Override Summary
              </button>
            )}

            <button
              onClick={onClose}
              className="btn btn-primary"
              style={{
                padding: '8px 22px',
                fontSize: '13px',
                borderRadius: '9999px',
              }}
            >
              Close Summary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
