import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Lock,
  Mail,
  Phone,
  Stethoscope,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { COMMON_SPECIALTIES, type Role, type User } from '../types';
import { PageTransition } from '../motion/PageTransition';
import { WaveInput } from './WaveInput';
import { CustomSelect } from './CustomSelect';

interface AuthPageProps {
  onLoginSuccess: (user: User, token: string) => void;
  currentUser: User | null;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess, currentUser }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine mode from route: /signup vs /login
  const isSignupRoute = location.pathname.includes('/signup');
  const [isLogin, setIsLogin] = useState<boolean>(!isSignupRoute);

  // Sync state if route changes
  useEffect(() => {
    setIsLogin(!location.pathname.includes('/signup'));
  }, [location.pathname]);

  // Where to land after successful auth.
  const nextParam = new URLSearchParams(location.search).get('next');
  const landingFor = (role: Role) =>
    nextParam ? nextParam
      : role === 'ADMIN'      ? '/admin/doctors'
      : role === 'PHARMACIST' ? '/pharmacy'
      : role === 'DOCTOR'     ? '/doctor'
                              : '/patient';

  // If already logged in, redirect to appropriate landing
  useEffect(() => {
    if (currentUser) {
      navigate(landingFor(currentUser.role));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, navigate]);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('PATIENT');
  const [showPassword, setShowPassword] = useState(false);

  // Doctor-only sign-up fields
  const [specialty, setSpecialty] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');

  // Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const switchMode = (loginMode: boolean) => {
    setIsLogin(loginMode);
    setError(null);
    setSuccessMsg(null);
    navigate(loginMode ? '/login' : '/signup', { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isLogin) {
        // --- REAL BACKEND LOGIN ---
        const normalizedEmail = email.trim().toLowerCase();
        const data = await authApi.login(normalizedEmail, password);
        authApi.saveAuth(data);
        setSuccessMsg('Authentication successful! Redirecting...');
        setTimeout(() => {
          onLoginSuccess(data.user, data.accessToken);
          navigate(landingFor(data.user.role));
        }, 400);
      } else {
        // --- REAL BACKEND REGISTRATION ---
        if (!fullName.trim()) {
          throw new Error('Please provide your full legal name');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }

        if (role === 'DOCTOR') {
          if (!specialty.trim()) throw new Error('Please pick a specialty');
          if (!registrationNumber.trim()) throw new Error('Medical registration number is required');
        }

        const normalizedEmail = email.trim().toLowerCase();
        const data = await authApi.register({
          email: normalizedEmail,
          password,
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          role,
          specialty: role === 'DOCTOR' ? specialty.trim() : undefined,
          hospitalName: role === 'DOCTOR' ? (hospitalName.trim() || undefined) : undefined,
          registrationNumber: role === 'DOCTOR' ? registrationNumber.trim() : undefined,
        });

        authApi.saveAuth(data);
        setSuccessMsg('Account created successfully! Redirecting to dashboard...');
        setTimeout(() => {
          onLoginSuccess(data.user, data.accessToken);
          navigate(landingFor(data.user.role));
        }, 500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Quick Demo Login (Uses registered test users)
  const handleQuickDemo = async (demoRole: 'PATIENT' | 'DOCTOR') => {
    setError(null);
    setLoading(true);
    const demoEmail = demoRole === 'DOCTOR' ? 'doctor.shah@pulsecare.com' : 'patient.test@pulsecare.com';
    const demoPass = 'Password123!';

    try {
      const data = await authApi.login(demoEmail, demoPass);
      authApi.saveAuth(data);
      setSuccessMsg(`Welcome, ${data.user.fullName}! Entering demo mode...`);
      setTimeout(() => {
        onLoginSuccess(data.user, data.accessToken);
        navigate(landingFor(demoRole));
      }, 350);
    } catch {
      // Fallback demo user if backend is rebooting
      const fallbackUser: User = {
        id: demoRole === 'DOCTOR' ? 'demo-doctor-uuid' : 'demo-patient-uuid',
        email: demoEmail,
        fullName: demoRole === 'DOCTOR' ? 'Dr. Kavita Shah' : 'Sarah Jenkins',
        role: demoRole,
      };
      onLoginSuccess(fallbackUser, 'mock-jwt-token');
      navigate(landingFor(demoRole));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div
        style={{
          minHeight: '100vh',
          maxHeight: isLogin ? '100vh' : undefined,
          overflowY: 'auto',
          backgroundColor: '#eaf6f2',
          display: 'flex',
          flexDirection: 'column',
          color: '#0b3f3a',
          fontFamily: "'Space Grotesk', system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top mini-bar with Back to Home only */}
        <div
          style={{
            padding: '14px 24px 0 24px',
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            maxWidth: '1200px',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <Link
            to="/"
            className="hover-lift"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#0f766e',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: '#ffffff',
              border: '1px solid #d9ece7',
              boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#def0eb';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>

        {/* Main Container - Centered Single Form Card */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isLogin ? '8px 16px 14px 16px' : '20px 20px 48px 20px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              maxWidth: '460px',
              width: '100%',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 10px 24px rgba(20, 60, 55, 0.10)',
              border: '1px solid #d9ece7',
              padding: isLogin ? '26px 32px 20px 32px' : '36px 32px',
              boxSizing: 'border-box',
            }}
          >
            {/* Logo & Header */}
            <div style={{ textAlign: 'center', marginBottom: isLogin ? '18px' : '24px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#0f766e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(15, 118, 110, 0.24)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12h4l3-7 4 14 3-7h6" />
                  </svg>
                </div>
                <span style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: '#0b3f3a' }}>
                  pulsecare
                </span>
              </div>

              <h1
                style={{
                  fontSize: '26px',
                  fontWeight: 700,
                  color: '#0b3f3a',
                  margin: '0 0 6px 0',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                {isLogin ? 'Sign In to pulsecare' : 'Create an Account'}
              </h1>
              <p style={{ fontSize: '14px', color: '#52736d', margin: 0, lineHeight: 1.5 }}>
                {isLogin
                  ? 'Enter your credentials to access your health portal'
                  : 'Get started with smart healthcare triage & consultations'}
              </p>
            </div>

            {/* Toggle Switch */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#eaf6f2',
                borderRadius: '12px',
                padding: '4px',
                marginBottom: '26px',
              }}
            >
              <button
                type="button"
                onClick={() => switchMode(true)}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '9px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: isLogin ? '#ffffff' : 'transparent',
                  color: isLogin ? '#0b3f3a' : '#52736d',
                  boxShadow: isLogin ? '0 2px 8px rgba(20, 60, 55, 0.08)' : 'none',
                  transition: 'all 0.2s ease',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode(false)}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '9px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: !isLogin ? '#ffffff' : 'transparent',
                  color: !isLogin ? '#0b3f3a' : '#52736d',
                  boxShadow: !isLogin ? '0 2px 8px rgba(20, 60, 55, 0.08)' : 'none',
                  transition: 'all 0.2s ease',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Create Account
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#dc2626',
                  fontSize: '13px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div
                style={{
                  backgroundColor: '#eaf6f2',
                  border: '1px solid #d9ece7',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#0f766e',
                  fontSize: '13px',
                }}
              >
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Role Selection (Only shown when Creating Account) */}
              {!isLogin && (
                <div style={{ marginBottom: '20px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#0b3f3a',
                      marginBottom: '8px',
                    }}
                  >
                    I am registering as:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div
                      onClick={() => setRole('PATIENT')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '14px',
                        border: `2px solid ${role === 'PATIENT' ? '#0f766e' : '#d9ece7'}`,
                        backgroundColor: role === 'PATIENT' ? '#eaf6f2' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <UserIcon size={16} color={role === 'PATIENT' ? '#0f766e' : '#8aa39d'} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0b3f3a' }}>Patient</div>
                        <div style={{ fontSize: '11px', color: '#52736d' }}>Seek medical care</div>
                      </div>
                    </div>

                    <div
                      onClick={() => setRole('DOCTOR')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '14px',
                        border: `2px solid ${role === 'DOCTOR' ? '#0f766e' : '#d9ece7'}`,
                        backgroundColor: role === 'DOCTOR' ? '#eaf6f2' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Stethoscope size={16} color={role === 'DOCTOR' ? '#0f766e' : '#8aa39d'} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0b3f3a' }}>Doctor</div>
                        <div style={{ fontSize: '11px', color: '#52736d' }}>Clinical provider</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Name Field (Registration only) */}
              {!isLogin && (
                <WaveInput
                  id="fullName"
                  label="Full Legal Name"
                  type="text"
                  required
                  value={fullName}
                  onChange={setFullName}
                  icon={<UserIcon size={17} color="#0f766e" />}
                />
              )}

              {/* Email Field */}
              <WaveInput
                id="email"
                label="Email Address"
                type="email"
                required
                value={email}
                onChange={setEmail}
                icon={<Mail size={17} color="#0f766e" />}
              />

              {/* Phone Field (Optional, Registration only) */}
              {!isLogin && (
                <WaveInput
                  id="phone"
                  label="Phone Number (Optional)"
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  icon={<Phone size={17} color="#0f766e" />}
                />
              )}

              {/* Doctor-specific fields (Registration + role=DOCTOR) */}
              {!isLogin && role === 'DOCTOR' && (
                <div style={{
                  padding: '14px 14px 2px', borderRadius: 14,
                  border: '1px solid #d9ece7', background: '#f3faf8',
                  marginBottom: 16,
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: '#0f766e',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    marginBottom: 10,
                  }}>
                    Clinical details
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5e7b76', marginBottom: 6 }}>
                      Specialty
                    </label>
                    <CustomSelect
                      value={specialty}
                      onChange={setSpecialty}
                      options={COMMON_SPECIALTIES.map(s => ({ value: s, label: s }))}
                      placeholder="Select your specialty"
                      variant="input"
                    />
                  </div>

                  <WaveInput
                    id="hospital"
                    label="Hospital / clinic name (optional)"
                    type="text"
                    value={hospitalName}
                    onChange={setHospitalName}
                    icon={<Building2 size={17} color="#0f766e" />}
                  />

                  <WaveInput
                    id="registration"
                    label="Medical registration number"
                    type="text"
                    required
                    value={registrationNumber}
                    onChange={setRegistrationNumber}
                    icon={<FileText size={17} color="#0f766e" />}
                  />

                  <div style={{
                    marginTop: 2, padding: '8px 10px',
                    background: '#fff', border: '1px solid #d9ece7',
                    borderRadius: 10, fontSize: 11, color: '#5e7b76', lineHeight: 1.4,
                  }}>
                    Doctor accounts are reviewed by an admin before they appear in patient search.
                    You can log in right after signing up to track your verification status.
                  </div>
                </div>
              )}

              {/* Password Field */}
              <div style={{ marginBottom: '8px' }}>
                {isLogin && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-6px' }}>
                    <a
                      href="#forgot"
                      onClick={e => {
                        e.preventDefault();
                        alert('Password reset instructions will be sent to your registered email.');
                      }}
                      style={{ fontSize: '12px', color: '#0f766e', textDecoration: 'none', fontWeight: 600 }}
                    >
                      Forgot password?
                    </a>
                  </div>
                )}
                <WaveInput
                  id="password"
                  label={isLogin ? 'Password' : 'Password (min 8 characters)'}
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={setPassword}
                  icon={<Lock size={17} color="#0f766e" />}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#8aa39d',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="hover-lift"
                style={{
                  width: '100%',
                  backgroundColor: '#0f766e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '13px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
                  fontFamily: "'Space Grotesk', sans-serif",
                  transition: 'background-color 0.15s ease',
                  marginTop: '12px',
                }}
                onMouseEnter={e => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#0d655e';
                }}
                onMouseLeave={e => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#0f766e';
                }}
              >
                {loading
                  ? 'Processing...'
                  : isLogin
                  ? 'Sign In to pulsecare'
                  : 'Create pulsecare Account'}
              </button>

              {/* Alternate switch text */}
              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#52736d' }}>
                {isLogin ? (
                  <>
                    Don&apos;t have an account yet?{' '}
                    <span
                      onClick={() => switchMode(false)}
                      style={{ color: '#ff6b5b', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Register now
                    </span>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <span
                      onClick={() => switchMode(true)}
                      style={{ color: '#ff6b5b', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Sign in here
                    </span>
                  </>
                )}
              </div>

              {/* Subtle Demo Logins */}
              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '18px',
                  borderTop: '1px solid #d9ece7',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#8aa39d', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Quick 1-Click Demo
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleQuickDemo('PATIENT')}
                    disabled={loading}
                    className="hover-lift"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      backgroundColor: '#eaf6f2',
                      border: '1px solid #d9ece7',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#0b3f3a',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    <UserIcon size={13} color="#0f766e" />
                    Patient Demo
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDemo('DOCTOR')}
                    disabled={loading}
                    className="hover-lift"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      backgroundColor: '#eaf6f2',
                      border: '1px solid #d9ece7',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#0b3f3a',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    <Stethoscope size={13} color="#0f766e" />
                    Doctor Demo
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};
