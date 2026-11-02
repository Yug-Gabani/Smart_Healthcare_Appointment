import React from 'react';
import { ShieldCheck, Lock, FileCheck2, Database, EyeOff } from 'lucide-react';

export const SafetyDisclaimer: React.FC = () => {
  return (
    <div style={{ maxWidth: '1000px', margin: '48px auto', padding: '0 24px' }}>
      <div style={{ marginBottom: '36px' }}>
        <span className="badge-ai-warm" style={{ marginBottom: '16px' }}>
          <ShieldCheck size={14} />
          Compliance & Safety Gates
        </span>
        <h1 style={{ fontSize: '32px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
          Clinical Safety Principles & Audit Framework
        </h1>
        <p className="text-body" style={{ color: 'var(--muted)' }}>
          PulseCare incorporates strict architectural boundaries to ensure artificial intelligence assists clinicians rather than making autonomous diagnoses.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '20px' }}>
        {/* Principle 1 */}
        <div className="card" style={{ padding: '28px', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <Database size={24} color="var(--primary)" />
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>
              1. AI Output is Strictly Advisory (DR-15)
            </h2>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6' }}>
            AI urgency scores and history summaries are stored in dedicated database columns completely separate from clinician-confirmed medical data. AI outputs are advisory only and never represent a formal clinical diagnosis.
          </p>
        </div>

        {/* Principle 2 */}
        <div className="card" style={{ padding: '28px', borderLeft: '4px solid var(--accent-warm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <FileCheck2 size={24} color="var(--accent-warm)" />
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>
              2. Mandatory Doctor Overrides Tracking (DR-16)
            </h2>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6' }}>
            Attending physicians possess absolute authority to adjudicate urgency categories. When a doctor modifies an AI classification, the original score is preserved untouched and the doctor's override reason is recorded for clinical auditing.
          </p>
        </div>

        {/* Principle 3 */}
        <div className="card" style={{ padding: '28px', borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <Lock size={24} color="var(--success)" />
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>
              3. Immutable Audit Trails on All Mutations (DR-11)
            </h2>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6' }}>
            Every triage intake, clinical confirmation, status update, and AI transaction writes an append-only, tamper-resistant audit row linked to user identities and timestamps.
          </p>
        </div>

        {/* Principle 4 */}
        <div className="card" style={{ padding: '28px', borderLeft: '4px solid var(--ink)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <EyeOff size={24} color="var(--ink)" />
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>
              4. Patient Consent & Telehealth Recording Safeguards (DR-09)
            </h2>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6' }}>
            Video telehealth sessions (via Daily.co) and speech-to-text transcriptions require explicit, affirmative dual consent from both clinician and patient before recording or processing.
          </p>
        </div>
      </div>
    </div>
  );
};
