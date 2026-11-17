import React, { useState } from 'react';
import { ArrowLeft, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { PageTransition } from '../motion/PageTransition';
import { WaveInput } from './WaveInput';

/**
 * Password-reset step 1: patient enters their email, backend sends the reset
 * link if the account exists. The response is deliberately the same regardless
 * of whether the email is registered (anti-enumeration), so the success screen
 * says "if that email is on file" rather than confirming it.
 */
export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setError(null);
    try {
      await authApi.requestPasswordReset(email.trim());
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    }
  };

  return (
    <PageTransition>
      <div
        style={{
          minHeight: 'calc(100vh - 80px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 440,
            background: '#ffffff',
            border: '1px solid #e3eceb',
            borderRadius: 16,
            padding: '36px 32px',
            boxShadow: '0 1px 2px rgba(15, 42, 40, 0.04)',
          }}
        >
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 500,
              color: '#8aa39d',
              textDecoration: 'none',
              marginBottom: 24,
            }}
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>

          {status === 'sent' ? (
            <div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: '#ecfdf5',
                  color: '#047857',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 12px', color: '#0b3f3a' }}>
                Check your inbox
              </h1>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#4c6360', margin: '0 0 24px' }}>
                If an account exists for <strong style={{ color: '#0b3f3a' }}>{email}</strong>, we have sent a
                password reset link. The link is good for the next 60 minutes. Check your spam folder if you
                don&rsquo;t see it within a few minutes.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#0f766e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Return to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px', color: '#0b3f3a' }}>
                Forgot your password?
              </h1>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#4c6360', margin: '0 0 24px' }}>
                Enter the email you signed up with. If an account exists, we&rsquo;ll send a link to reset your
                password.
              </p>

              <div style={{ marginBottom: 20 }}>
                <WaveInput
                  id="forgot-email"
                  label="Email address"
                  type="email"
                  required
                  value={email}
                  onChange={setEmail}
                  icon={<Mail size={17} color="#0f766e" />}
                  disabled={status === 'loading'}
                />
              </div>

              {status === 'error' && error && (
                <div
                  role="alert"
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    background: '#fef2f2',
                    color: '#991b1b',
                    border: '1px solid #fecaca',
                    borderRadius: 10,
                    fontSize: 13,
                    lineHeight: 1.5,
                    marginBottom: 16,
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading' || !email.trim()}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: status === 'loading' || !email.trim() ? '#a7d4cd' : '#0f766e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: status === 'loading' || !email.trim() ? 'default' : 'pointer',
                }}
              >
                {status === 'loading' ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default ForgotPasswordPage;
