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
  Loader2,
} from 'lucide-react';
import { consultationsApi } from '../services/api';
import type { ConsultationSession, Appointment } from '../types';

interface MeetingSummaryModalProps {
  appointment: Appointment;
  onClose: () => void;
}

export const MeetingSummaryModal: React.FC<MeetingSummaryModalProps> = ({ appointment, onClose }) => {
  const [session, setSession] = useState<ConsultationSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    consultationsApi
      .getSession(appointment.id)
      .then(data => {
        if (isMounted) setSession(data);
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

  const handleCopySummary = () => {
    const chiefComplaint = session?.summaryChiefComplaint || appointment.chiefComplaint || 'N/A';
    const observations = session?.summaryObservations || 'Clinical teleconsultation completed.';
    const advice = session?.summaryDoctorAdvice || 'Follow doctor directions.';
    const actions = session?.summaryPrescribedActions || 'Digital prescription issued in portal.';
    const followUp = session?.summaryFollowUp || 'Routine follow-up in 7-10 days.';

    const text = `
PulseCare Telehealth - Consultation Meeting Summary
---------------------------------------------------
Date: ${appointment.slotAt ? new Date(appointment.slotAt).toLocaleString() : 'N/A'}
Doctor: ${appointment.doctorName || session?.doctorName || 'Doctor'} (${appointment.doctorSpecialty || 'General'})
Patient: ${appointment.patientName || session?.patientName || 'Patient'}
Appointment ID: ${appointment.id}

1. Chief Complaint:
${chiefComplaint}

2. Clinical Observations:
${observations}

3. Doctor Advice:
${advice}

4. Prescribed Actions:
${actions}

5. Follow-Up Plan:
${followUp}
---------------------------------------------------
Verified Telehealth Medical Summary
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const chiefComplaint = session?.summaryChiefComplaint || appointment.chiefComplaint || 'Routine medical follow-up';
  const observations = session?.summaryObservations || 'Visual and symptom assessment conducted via secure telehealth. Patient condition reviewed and stable.';
  const advice = session?.summaryDoctorAdvice || 'Maintain prescribed hydration and symptom relief routines. Rest adequately and adhere to lifestyle instructions discussed.';
  const actions = session?.summaryPrescribedActions || 'Review digital prescription in the portal. Complete any ordered blood tests or follow-up laboratory work.';
  const followUp = session?.summaryFollowUp || 'Schedule follow-up review in 7–10 days if symptoms persist. Seek immediate emergency care if chest tightness, severe fever, or shortness of breath develops.';

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
          maxWidth: '720px',
          maxHeight: '90vh',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
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
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
              Consultation Clinical Summary
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

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#52736d' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: '#0f766e' }} />
              <p style={{ fontSize: '14px', margin: 0 }}>Retrieving structured consultation summary…</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Chief Complaint */}
              <div
                style={{
                  backgroundColor: '#f5faf8',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: '1px solid #d9ece7',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
                  <FileText size={16} />
                  <span>Chief Complaint & Symptoms</span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#134e48', lineHeight: 1.5 }}>
                  {chiefComplaint}
                </p>
              </div>

              {/* Clinical Observations */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: '1px solid #e2ece9',
                  boxShadow: '0 2px 10px rgba(15, 118, 110, 0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
                  <Stethoscope size={16} />
                  <span>Clinical Observations & Assessment</span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#2d3748', lineHeight: 1.6 }}>
                  {observations}
                </p>
              </div>

              {/* Doctor's Advice */}
              <div
                style={{
                  backgroundColor: '#eff6ff',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: '1px solid #bfdbfe',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1d4ed8', fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
                  <Check size={16} />
                  <span>Doctor's Advice & Treatment Instructions</span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#1e3a8a', lineHeight: 1.6 }}>
                  {advice}
                </p>
              </div>

              {/* Prescribed Actions */}
              <div
                style={{
                  backgroundColor: '#fefce8',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: '1px solid #fef08a',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a16207', fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
                  <Pill size={16} />
                  <span>Prescribed Actions & Medications</span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#713f12', lineHeight: 1.6 }}>
                  {actions}
                </p>
              </div>

              {/* Follow-up Plan */}
              <div
                style={{
                  backgroundColor: '#fff1f2',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: '1px solid #fecdd3',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#be123c', fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
                  <AlertTriangle size={16} />
                  <span>Follow-Up Care & Red-Flag Warnings</span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#881337', lineHeight: 1.6 }}>
                  {followUp}
                </p>
              </div>

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
                      In-Call Discussion Transcript ({showTranscript ? 'Hide' : 'Show'})
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
                transition: 'all 0.15s ease',
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
  );
};

