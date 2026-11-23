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
  Loader2,
  Activity,
} from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { COMMON_SPECIALTIES, type Role, type User } from '../types';
import { PageTransition } from '../motion/PageTransition';
import { WaveInput } from './WaveInput';
import { CustomSelect } from './CustomSelect';
import { validateStrongPassword } from '../utils/passwordValidator';

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

  const nextParam = new URLSearchParams(location.search).get('next');
  const landingFor = (role: Role) =>
    nextParam
      ? nextParam
      : role === 'ADMIN'
      ? '/admin/doctors'
      : role === 'PHARMACIST'
      ? '/pharmacy'
      : role === 'DOCTOR'
      ? '/doctor'
      : '/';

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
  const [countryCode, setCountryCode] = useState('+91');
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

  const clearError = () => {
    if (error) setError(null);
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
        setSuccessMsg('Authentication successful! Entering portal...');
        setTimeout(() => {
          onLoginSuccess(data.user, data.accessToken);
          navigate(landingFor(data.user.role));
        }, 350);
      } else {
        // --- REAL BACKEND REGISTRATION ---
        if (!fullName.trim()) {
          throw new Error('Please provide your full legal name');
        }
        const passwordValidation = validateStrongPassword(password);
        if (!passwordValidation.isValid) {
          throw new Error(passwordValidation.message);
        }

        if (role === 'DOCTOR') {
          if (!specialty.trim()) throw new Error('Please pick a specialty');
          if (!registrationNumber.trim()) throw new Error('Medical registration number is required');
        }

        const normalizedEmail = email.trim().toLowerCase();
        const formattedPhone = phone.trim() ? `${countryCode} ${phone.trim()}` : undefined;

        const data = await authApi.register({
          email: normalizedEmail,
          password,
          fullName: fullName.trim(),
          phone: formattedPhone,
          role,
          specialty: role === 'DOCTOR' ? specialty.trim() : undefined,
          hospitalName: role === 'DOCTOR' ? (hospitalName.trim() || undefined) : undefined,
          registrationNumber: role === 'DOCTOR' ? registrationNumber.trim() : undefined,
        });

        authApi.saveAuth(data);
        setSuccessMsg('Account created successfully! Redirecting...');
        setTimeout(() => {
          onLoginSuccess(data.user, data.accessToken);
          navigate(landingFor(data.user.role));
        }, 400);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="auth-page-container">
        {/* Navigation Bar */}
        <header
          style={{
            padding: '18px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#334155',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.color = '#334155';
            }}
          >
            <ArrowLeft size={15} />
            Home
          </button>
        </header>

        {/* Main Content: Focused, Unslopped Auth Card */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 20px 48px 20px',
            boxSizing: 'border-box',
          }}
        >
          <div className="auth-card">
            {/* Brand Mark & Header */}
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: '#f0fdfa',
                  border: '1px solid #ccfbf1',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '10px',
                }}
              >
                <Activity size={20} color="#0f766e" />
              </div>
              <h1
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: '0 0 6px 0',
                  letterSpacing: '-0.02em',
                }}
              >
                {isLogin ? 'Sign In to PulseCare' : 'Create an Account'}
              </h1>
              <p
                style={{
                  fontSize: '13px',
                  color: '#64748b',
                  margin: 0,
                  minHeight: '20px',
                  lineHeight: '20px',
                }}
              >
                {isLogin
                  ? 'Access your appointments and consultations'
                  : 'Register as a patient or healthcare provider'}
              </p>
            </div>

            {/* Smooth Sliding Segmented Tab Switch */}
            <div
              style={{
                display: 'flex',
                position: 'relative',
                backgroundColor: '#f1f5f9',
                borderRadius: '10px',
                padding: '3px',
                marginBottom: '14px',
                userSelect: 'none',
              }}
            >
              {/* Sliding Pill Indicator */}
              <div
                style={{
                  position: 'absolute',
                  top: '3px',
                  bottom: '3px',
                  left: '3px',
                  width: 'calc(50% - 3px)',
                  transform: isLogin ? 'translateX(0)' : 'translateX(100%)',
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
                  transition: 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />

              <button
                type="button"
                onClick={() => switchMode(true)}
                style={{
                  position: 'relative',
                  zIndex: 2,
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  fontSize: '13.5px',
                  fontWeight: isLogin ? 600 : 500,
                  color: isLogin ? '#0f172a' : '#64748b',
                  cursor: 'pointer',
                  transition: 'color 180ms ease',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode(false)}
                style={{
                  position: 'relative',
                  zIndex: 2,
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  fontSize: '13.5px',
                  fontWeight: !isLogin ? 600 : 500,
                  color: !isLogin ? '#0f172a' : '#64748b',
                  cursor: 'pointer',
                  transition: 'color 180ms ease',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Create Account
              </button>
            </div>

            {/* Reserved Fixed-Height Error / Status Container (Zero Layout Shifts) */}
            <div
              style={{
                minHeight: '40px',
                height: '40px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                boxSizing: 'border-box',
              }}
            >
              {error ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fee2e2',
                    borderRadius: '8px',
                    padding: '0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#991b1b',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    boxSizing: 'border-box',
                  }}
                >
                  <AlertCircle size={15} color="#dc2626" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {error}
                  </span>
                </div>
              ) : successMsg ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #dcfce7',
                    borderRadius: '8px',
                    padding: '0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#166534',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    boxSizing: 'border-box',
                  }}
                >
                  <CheckCircle2 size={15} color="#16a34a" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {successMsg}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Form Container with Smooth Cross-Transition */}
            <form onSubmit={handleSubmit}>
              <div key={isLogin ? 'signin-pane' : 'signup-pane'} className="auth-form-transition">
                {/* Role Selection (Only shown when Creating Account) */}
                {!isLogin && (
                  <div style={{ marginBottom: '14px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#334155',
                        marginBottom: '6px',
                      }}
                    >
                      I am registering as:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div
                        onClick={() => setRole('PATIENT')}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: `1.5px solid ${role === 'PATIENT' ? '#0f766e' : '#e2e8f0'}`,
                          backgroundColor: role === 'PATIENT' ? '#f0fdf9' : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <UserIcon size={17} color={role === 'PATIENT' ? '#0f766e' : '#64748b'} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: role === 'PATIENT' ? '#0f172a' : '#475569' }}>
                            Patient
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Seek medical care</div>
                        </div>
                      </div>

                      <div
                        onClick={() => setRole('DOCTOR')}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: `1.5px solid ${role === 'DOCTOR' ? '#0f766e' : '#e2e8f0'}`,
                          backgroundColor: role === 'DOCTOR' ? '#f0fdf9' : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Stethoscope size={17} color={role === 'DOCTOR' ? '#0f766e' : '#64748b'} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: role === 'DOCTOR' ? '#0f172a' : '#475569' }}>
                            Doctor
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Clinical provider</div>
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
                    onChange={val => {
                      setFullName(val);
                      clearError();
                    }}
                    variant="boxed"
                    icon={<UserIcon size={16} color="#0f766e" />}
                  />
                )}

                {/* Email Field */}
                <WaveInput
                  id="email"
                  label="Email Address"
                  type="email"
                  required
                  value={email}
                  onChange={val => {
                    setEmail(val);
                    clearError();
                  }}
                  variant="boxed"
                  icon={<Mail size={16} color="#0f766e" />}
                />

                {/* Phone Field with Integrated Country Code & Divider (Registration only) */}
                {!isLogin && (
                  <WaveInput
                    id="phone"
                    label="Phone Number (Optional)"
                    type="tel"
                    placeholder="Enter phone number"
                    value={phone}
                    onChange={val => {
                      setPhone(val);
                      clearError();
                    }}
                    variant="boxed"
                    icon={<Phone size={16} color="#0f766e" />}
                    leftElement={
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <select
                          value={countryCode}
                          onChange={e => setCountryCode(e.target.value)}
                          aria-label="Country Code"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#0f766e',
                            outline: 'none',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            padding: '0 4px 0 0',
                          }}
                        >
                          <option value="+91">+91 (IN)</option>
                          <option value="+1">+1 (US)</option>
                          <option value="+44">+44 (UK)</option>
                          <option value="+61">+61 (AU)</option>
                          <option value="+971">+971 (AE)</option>
                        </select>
                        <div
                          style={{
                            width: '1px',
                            height: '18px',
                            backgroundColor: '#cbd5e1',
                            marginLeft: '6px',
                          }}
                        />
                      </div>
                    }
                  />
                )}

                {/* Doctor-specific fields (Registration + role=DOCTOR) */}
                {!isLogin && role === 'DOCTOR' && (
                  <div
                    style={{
                      padding: '12px 14px 2px',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: '#0f766e',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: 8,
                      }}
                    >
                      Clinical Profile Details
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                        Specialty
                      </label>
                      <CustomSelect
                        value={specialty}
                        onChange={val => {
                          setSpecialty(val);
                          clearError();
                        }}
                        options={COMMON_SPECIALTIES.map(s => ({ value: s, label: s }))}
                        placeholder="Select medical specialty"
                        variant="input"
                      />
                    </div>

                    <WaveInput
                      id="hospital"
                      label="Hospital / Clinic Name (Optional)"
                      type="text"
                      value={hospitalName}
                      onChange={val => {
                        setHospitalName(val);
                        clearError();
                      }}
                      variant="boxed"
                      icon={<Building2 size={16} color="#0f766e" />}
                    />

                    <WaveInput
                      id="registration"
                      label="Medical Registration / License Number"
                      type="text"
                      required
                      value={registrationNumber}
                      onChange={val => {
                        setRegistrationNumber(val);
                        clearError();
                      }}
                      variant="boxed"
                      icon={<FileText size={16} color="#0f766e" />}
                    />
                  </div>
                )}

                {/* Password Field */}
                <div>
                  <WaveInput
                    id="password"
                    label={isLogin ? 'Password' : 'Password (min 8 characters)'}
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={val => {
                      setPassword(val);
                      clearError();
                    }}
                    variant="boxed"
                    icon={<Lock size={16} color="#0f766e" />}
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />

                  {/* Clean Forgot Password link aligned to right */}
                  {isLogin && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-6px', marginBottom: '14px' }}>
                      <Link
                        to="/auth/forgot-password"
                        style={{
                          fontSize: '12px',
                          color: '#0f766e',
                          textDecoration: 'none',
                          fontWeight: 500,
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#0b3f3a')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#0f766e')}
                      >
                        Forgot password?
                      </Link>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    backgroundColor: loading ? '#0d655e' : '#0f766e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    height: '44px',
                    padding: '0 16px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.8 : 1,
                    boxShadow: '0 1px 3px rgba(15, 118, 110, 0.18)',
                    fontFamily: "'Space Grotesk', sans-serif",
                    transition: 'all 0.15s ease',
                    marginTop: isLogin ? '4px' : '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    outline: 'none',
                  }}
                  onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(15, 118, 110, 0.25)')}
                  onBlur={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 118, 110, 0.18)')}
                  onMouseEnter={e => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#0d655e';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#0f766e';
                    }
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : isLogin ? (
                    'Sign In'
                  ) : (
                    'Create Account'
                  )}
                </button>

                {/* Switch link */}
                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
                  {isLogin ? (
                    <>
                      Don&apos;t have an account yet?{' '}
                      <span
                        onClick={() => switchMode(false)}
                        style={{ color: '#0f766e', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Register
                      </span>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <span
                        onClick={() => switchMode(true)}
                        style={{ color: '#0f766e', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Sign in
                      </span>
                    </>
                  )}
                </div>

                {/* Doctor Demo Quick-Fill Bar (Sign In only) */}
                {isLogin && (
                  <div
                    style={{
                      marginTop: '18px',
                      padding: '10px 12px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <Stethoscope size={15} color="#0f766e" style={{ flexShrink: 0 }} />
                      <div style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>Doctor demo: </span>
                        <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: '4px', fontSize: '11px', color: '#0f766e' }}>
                          doctor1@pulse.test
                        </code>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('doctor1@pulse.test');
                        setPassword('Password123!');
                        clearError();
                      }}
                      title="Auto-fill Doctor credentials"
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#0f766e',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#0f766e';
                        e.currentTarget.style.backgroundColor = '#f0fdfa';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.backgroundColor = '#ffffff';
                      }}
                    >
                      Auto-fill
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </main>
      </div>
    </PageTransition>
  );
};
