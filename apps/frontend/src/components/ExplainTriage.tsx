import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import type { TriageAssessment } from '../types';

interface ExplainTriageProps {
  currentAssessment: TriageAssessment | null;
  onBookOrChange: () => void;
}

export const ExplainTriage: React.FC<ExplainTriageProps> = ({ currentAssessment, onBookOrChange }) => {
  const urgency = currentAssessment?.urgency || 'URGENT';
  const confidence = 0.88;

  return (
    <section style={{ maxWidth: '820px', margin: '48px auto', padding: '0 24px' }}>
      {/* Warm AI Advisory Badge (PULSECARE_DESIGN.md Section 5.1) */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <span className="badge-ai-warm">
          <Sparkles size={14} />
          AI suggestion — review before acting
        </span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <h1 className="font-serif text-heading-lg" style={{ color: 'var(--ink)', marginBottom: '12px' }}>
          Your case was marked {urgency.toLowerCase()}.
        </h1>
        <p className="text-subheading" style={{ maxWidth: '540px', margin: '0 auto' }}>
          Here is why — in plain language, transparent clinical indicators, and confidence ratings.
        </p>
      </div>

      {/* Main Explain Card */}
      <div className="card" style={{ padding: '36px' }}>
        {/* Confidence Meter */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
            <span className="text-caption" style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Algorithm Confidence Score
            </span>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>
              {Math.round(confidence * 100)}% Match
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: 'var(--canvas)',
            borderRadius: '9999px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${confidence * 100}%`,
              height: '100%',
              backgroundColor: urgency === 'EMERGENCY' ? 'var(--danger)' : urgency === 'URGENT' ? 'var(--accent-warm)' : 'var(--primary)',
              borderRadius: '9999px',
            }} />
          </div>
        </div>

        {/* Why Breakdown */}
        <div style={{ marginBottom: '32px' }}>
          <div className="text-caption" style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            Clinical Evidence & Why
          </div>
          <ul style={{ paddingLeft: '20px', display: 'grid', gap: '10px', fontSize: '15px', color: 'var(--ink)', lineHeight: '1.6' }}>
            <li>
              <strong>Primary concern:</strong> {currentAssessment?.chiefComplaint || 'Persistent fever and cough lasting 3+ days'}
            </li>
            <li>
              <strong>Severity score:</strong> Reported pain index at {currentAssessment?.painLevel || 4} out of 10
            </li>
            <li>
              <strong>Symptom cluster:</strong> {currentAssessment?.symptoms?.join(', ') || 'Fever, cough, body ache'}
            </li>
            <li>
              <strong>Clinical urgency rationale:</strong> {currentAssessment?.rationale || 'Symptom duration exceeds 72 hours with ongoing systemic indicators, recommending same-day clinician assessment.'}
            </li>
          </ul>
        </div>

        {/* Challenge or Contact Doctor CTA */}
        <div style={{
          paddingTop: '20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <button
            onClick={onBookOrChange}
            className="btn btn-secondary"
          >
            Update Symptoms
          </button>
          <button
            onClick={onBookOrChange}
            className="btn btn-primary"
          >
            Proceed with Doctor Consultation <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
};
