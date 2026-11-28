import React from 'react';
import { Check, Circle } from 'lucide-react';
import { getPasswordStrength, type PasswordStrengthLevel } from '../utils/passwordValidator';

interface PasswordStrengthMeterProps {
  password: string;
}

const LEVEL_COLORS: Record<PasswordStrengthLevel, string> = {
  empty: '#cbd5e1',
  weak: '#ef4444',
  fair: '#f59e0b',
  good: '#0d9488',
  strong: '#10b981',
};

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  const { score, maxScore, level, label, requirements } = getPasswordStrength(password);
  const activeColor = LEVEL_COLORS[level];
  const progressPct = password.length === 0 ? 0 : Math.round((score / maxScore) * 100);

  return (
    <div
      style={{
        marginTop: '8px',
        marginBottom: '6px',
        padding: '10px 12px',
        borderRadius: '12px',
        backgroundColor: '#f6faf9',
        border: '1px solid #d9ebe7',
      }}
      aria-live="polite"
    >
      {/* Strength Bar Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        <span style={{ color: '#4c6360' }}>Password strength</span>
        {label ? (
          <span style={{ color: activeColor }}>{label}</span>
        ) : (
          <span style={{ color: '#8aa39d', fontWeight: 500 }}>Required</span>
        )}
      </div>

      {/* Progress Track */}
      <div
        style={{
          width: '100%',
          height: '6px',
          borderRadius: '999px',
          backgroundColor: '#e2ecea',
          overflow: 'hidden',
          marginBottom: '10px',
        }}
      >
        <div
          style={{
            width: `${progressPct}%`,
            height: '100%',
            backgroundColor: activeColor,
            borderRadius: '999px',
            transition: 'width 0.25s ease, background-color 0.25s ease',
          }}
        />
      </div>

      {/* Requirement Checklist Pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        {requirements.map(req => {
          const isUnmetTyped = password.length > 0 && !req.met;
          return (
            <span
              key={req.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '999px',
                backgroundColor: req.met ? '#dcfce7' : isUnmetTyped ? '#fef2f2' : '#ffffff',
                color: req.met ? '#15803d' : isUnmetTyped ? '#b91c1c' : '#64748b',
                border: `1px solid ${
                  req.met ? '#bbf7d0' : isUnmetTyped ? '#fecaca' : '#e2e8f0'
                }`,
                transition: 'all 0.2s ease',
              }}
            >
              {req.met ? (
                <Check size={12} strokeWidth={2.75} />
              ) : (
                <Circle size={10} strokeWidth={2} />
              )}
              {req.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

