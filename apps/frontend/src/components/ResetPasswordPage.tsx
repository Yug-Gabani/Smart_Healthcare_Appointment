import React, { useState, useMemo } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { PageTransition } from '../motion/PageTransition';
import { WaveInput } from './WaveInput';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { validateStrongPassword } from '../utils/passwordValidator';

/**
 * Password-reset step 2: user arrives from the email link carrying ?token=... in
 * the URL, types a new password twice, and we hand both to the backend. On
 * success we log the user back out (the backend already revoked their refresh
 * tokens) and send them to /login.
 */
export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const tokenMissing = !token;

  const validation = useMemo(() => {
    if (!password) return { ok: false, message: '' };
    const passCheck = validateStrongPassword(password);
    if (!passCheck.isValid) return { ok: false, message: passCheck.message };
    if (confirmPassword && password !== confirmPassword) {
      return { ok: false, message: 'Passwords do not match.' };
    }
    return { ok: true, message: '' };
  }, [password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.ok || !confirmPassword) return;
    setStatus('loading');
    setError(null);
    try {
      await authApi.confirmPasswordReset(token, password);
      // Clear any stale session; the backend already revoked refresh tokens.
      await authApi.logout();
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'That link is no longer valid. Request a new one.');
    }
  };

  if (tokenMissing) {
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
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#fef2f2',
                color: '#991b1b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <AlertCircle size={24} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 12px', color: '#0b3f3a' }}>
              Reset link missing
            </h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#4c6360', margin: '0 0 24px' }}>
              The reset link is incomplete. Request a new one from the sign-in page.
            </p>
            <Link
              to="/auth/forgot-password"
              style={{
                display: 'inline-block',
                padding: '12px 16px',
                background: '#0f766e',
                color: '#ffffff',
                textDecoration: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Request a new link
            </Link>
          </div>
        </div>
      </PageTransition>
    );
  }

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

          {status === 'done' ? (
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
                Password updated
              </h1>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#4c6360', margin: '0 0 24px' }}>
                You can now sign in with your new password. Any other devices that were signed in have been
                logged out.
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
                Go to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px', color: '#0b3f3a' }}>
                Choose a new password
              </h1>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#4c6360', margin: '0 0 24px' }}>
                Pick something at least 8 characters long. You&rsquo;ll be signed in with it right after.
              </p>

              <div style={{ marginBottom: 16 }}>
                <WaveInput
                  id="new-password"
                  label="New password (min 8 chars, A-Z, a-z, 0-9, symbol)"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={setPassword}
                  icon={<Lock size={17} color="#0f766e" />}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#8aa39d',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  }
                  disabled={status === 'loading'}
                />
                <PasswordStrengthMeter password={password} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <WaveInput
                  id="confirm-password"
                  label="Confirm new password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  icon={<Lock size={17} color="#0f766e" />}
                  disabled={status === 'loading'}
                />
              </div>

              {!validation.ok && validation.message && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#b45309',
                    marginBottom: 16,
                    marginTop: -8,
                  }}
                >
                  {validation.message}
                </div>
              )}

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
                disabled={status === 'loading' || !validation.ok || !confirmPassword}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: status === 'loading' || !validation.ok || !confirmPassword ? '#a7d4cd' : '#0f766e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: status === 'loading' || !validation.ok || !confirmPassword ? 'default' : 'pointer',
                }}
              >
                {status === 'loading' ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default ResetPasswordPage;
