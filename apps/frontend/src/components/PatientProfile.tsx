import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PageTransition } from '../motion/PageTransition';
import { fadeInUp } from '../motion/presets';
import { CustomSelect } from './CustomSelect';
import { WaveInput } from './WaveInput';
import { ArrowLeft, Loader2, Save, UserCircle2, Download, Trash2, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import type { Gender, PatientProfile as PatientProfileT } from '../types';
import { profileApi, complianceApi, authApi } from '../services/api';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

export const PatientProfile: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PatientProfileT | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);

  // Compliance (Export & Delete)
  const [exporting, setExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  useEffect(() => {
    setLoading(true);
    profileApi.get()
      .then(setProfile)
      .catch(e => setError(e?.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof PatientProfileT>(k: K, v: PatientProfileT[K]) =>
    setProfile(p => (p ? { ...p, [k]: v } : p));

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true); setError(null);
    try {
      const saved = await profileApi.update({
        fullName: profile.fullName,
        phone: profile.phone,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        addressStreet: profile.addressStreet,
        addressCity: profile.addressCity,
        addressState: profile.addressState,
        addressPincode: profile.addressPincode,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactPhone: profile.emergencyContactPhone,
      });
      setProfile(saved);
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 2500);
    } catch (e: any) {
      setError(e?.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await complianceApi.exportData();
    } catch (e: any) {
      alert(e?.message || 'Failed to export health records');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation.trim().toUpperCase() !== 'DELETE') return;
    setDeleting(true);
    try {
      await complianceApi.deleteAccount();
      authApi.logout();
      window.location.href = '/';
    } catch (e: any) {
      alert(e?.message || 'Failed to process account deletion');
      setDeleting(false);
    }
  };

  return (
    <PageTransition style={{ maxWidth: '720px', margin: '48px auto', padding: '0 24px' }}>
      <button
        onClick={() => navigate(-1)}
        className="hover-lift"
        style={{
          background: 'transparent', border: 'none', color: '#0f766e',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          padding: '6px 0', marginBottom: '16px',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
        }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0b3f3a', margin: 0, letterSpacing: '-0.02em' }}>
        My profile
      </h1>
      <p style={{ color: '#52736d', margin: '6px 0 24px 0' }}>
        Keeping this up to date helps your doctor provide the best care and lets us reach your emergency contact if needed.
      </p>

      {loading && (
        <div style={{ padding: '48px', textAlign: 'center', color: '#52736d' }}>
          <Loader2 size={22} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} /> Loading…
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          backgroundColor: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.25)',
          color: '#dc2626', fontSize: '13px', marginBottom: '16px',
        }}>{error}</div>
      )}

      <AnimatePresence>
        {savedBanner && (
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
              padding: '10px 14px', borderRadius: '10px',
              backgroundColor: 'rgba(5, 150, 105, 0.08)',
              border: '1px solid rgba(5, 150, 105, 0.25)',
              color: '#065f46', fontSize: '13px', marginBottom: '16px',
            }}
          >
            Profile saved ✓
          </motion.div>
        )}
      </AnimatePresence>

      {profile && (
        <>
          <div className="card card-hover" style={{ padding: '28px' }}>
          {/* Identity */}
          <SectionHeading icon={<UserCircle2 size={18} />} label="Identity" />
          <Row>
            <WaveInput
              label="Full name"
              value={profile.fullName ?? ''}
              onChange={v => set('fullName', v)}
            />
            <WaveInput
              label="Email (read-only)"
              value={profile.email}
              onChange={() => {}}
              disabled
            />
          </Row>
          <Row>
            <WaveInput
              label="Phone number"
              value={profile.phone ?? ''}
              onChange={v => set('phone', v)}
            />
            <WaveInput
              label="Date of birth"
              type="date"
              value={profile.dateOfBirth ?? ''}
              onChange={v => set('dateOfBirth', v || undefined)}
            />
          </Row>
          <Row>
            <Field label="Gender">
              <CustomSelect
                value={profile.gender ?? ''}
                options={[{ value: '', label: 'Select gender' }, ...GENDERS]}
                onChange={val => set('gender', (val || undefined) as Gender | undefined)}
                variant="input"
              />
            </Field>
            <div />
          </Row>

          {/* Address */}
          <SectionHeading label="Address" />
          <WaveInput
            label="Street Address"
            value={profile.addressStreet ?? ''}
            onChange={v => set('addressStreet', v)}
          />
          <Row>
            <WaveInput
              label="City"
              value={profile.addressCity ?? ''}
              onChange={v => set('addressCity', v)}
            />
            <WaveInput
              label="State"
              value={profile.addressState ?? ''}
              onChange={v => set('addressState', v)}
            />
          </Row>
          <Row>
            <WaveInput
              label="Pincode"
              value={profile.addressPincode ?? ''}
              onChange={v => set('addressPincode', v)}
            />
            <div />
          </Row>

          {/* Emergency contact */}
          <SectionHeading label="Emergency contact" />
          <Row>
            <WaveInput
              label="Emergency Contact Name"
              value={profile.emergencyContactName ?? ''}
              onChange={v => set('emergencyContactName', v)}
            />
            <WaveInput
              label="Emergency Contact Phone"
              value={profile.emergencyContactPhone ?? ''}
              onChange={v => set('emergencyContactPhone', v)}
            />
          </Row>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSave} disabled={saving}
              className="hover-lift"
              style={{
                backgroundColor: '#0f766e', color: '#ffffff', border: 'none',
                borderRadius: '9999px', padding: '10px 22px',
                fontSize: '14px', fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '8px',
              }}
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save changes</>}
            </button>
          </div>
        </div>

          {/* Privacy & Health Data Compliance (GDPR / HIPAA) */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #d9ece7',
            padding: '24px 28px',
            boxShadow: '0 4px 16px rgba(11, 63, 58, 0.05)',
            marginBottom: '40px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <ShieldCheck size={20} color="#0f766e" />
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0b3f3a', margin: 0 }}>
                Privacy & Health Data Compliance
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: '#52736d', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Manage your personal data under healthcare compliance (HIPAA / GDPR). You have the right to export your complete medical records bundle or close your online account.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Export Data Tile */}
              <div style={{
                padding: '16px 18px',
                borderRadius: '12px',
                border: '1px solid #d9ece7',
                backgroundColor: '#f5faf8',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0b3f3a', marginBottom: '4px' }}>
                    Export Health Data
                  </div>
                  <div style={{ fontSize: '12px', color: '#52736d', lineHeight: 1.4, marginBottom: '16px' }}>
                    Download a comprehensive JSON package including your consultations, triage notes, prescriptions, uploaded attachments, and profile details.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="hover-lift"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '9px 16px',
                    backgroundColor: '#0f766e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: exporting ? 'wait' : 'pointer',
                    width: '100%',
                  }}
                >
                  {exporting ? (
                    <><Loader2 size={14} className="animate-spin" /> Preparing Export…</>
                  ) : (
                    <><Download size={14} /> Export My Records (JSON)</>
                  )}
                </button>
              </div>

              {/* Delete Account Tile */}
              <div style={{
                padding: '16px 18px',
                borderRadius: '12px',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                backgroundColor: 'rgba(254, 242, 242, 0.6)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
                    Delete Account
                  </div>
                  <div style={{ fontSize: '12px', color: '#7f1d1d', lineHeight: 1.4, marginBottom: '16px' }}>
                    Permanently destroy your login credentials and personal phone/address. Per healthcare laws, past medical records remain securely archived in the hospital ledger.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="hover-lift"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '9px 16px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <Trash2 size={14} /> Delete Account…
                </button>
              </div>
            </div>
          </div>

          {/* Delete Account Modal */}
          <AnimatePresence>
            {showDeleteModal && (
              <div style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(11, 63, 58, 0.55)',
                backdropFilter: 'blur(4px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
              }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    maxWidth: '480px',
                    width: '100%',
                    padding: '24px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                    border: '1px solid #fee2e2',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <AlertTriangle size={22} />
                    </div>
                    <button
                      onClick={() => { setShowDeleteModal(false); setDeleteConfirmation(''); }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#52736d' }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#991b1b', margin: '0 0 10px 0' }}>
                    Confirm Account Closure & Data Scrub
                  </h3>

                  <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                    Are you sure you want to delete your PulseCare user account?
                  </p>

                  <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '12px',
                    color: '#7f1d1d',
                    marginBottom: '16px',
                    lineHeight: 1.5,
                  }}>
                    <strong>Notice on Hospital Medical Records:</strong>
                    <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px' }}>
                      <li>Your login password, sessions, and personal contact PII are permanently erased.</li>
                      <li>Any future or pending appointments are cancelled and time slots released.</li>
                      <li><strong>In the hospital clinical record</strong>, historical consultations, diagnoses, and prescriptions are preserved to satisfy healthcare record retention regulations.</li>
                    </ul>
                  </div>

                  <div style={{ fontSize: '12px', color: '#52736d', marginBottom: '6px' }}>
                    Type <strong>DELETE</strong> below to confirm:
                  </div>

                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="Type DELETE"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      marginBottom: '18px',
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => { setShowDeleteModal(false); setDeleteConfirmation(''); }}
                      disabled={deleting}
                      style={{
                        padding: '9px 16px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleting || deleteConfirmation.trim().toUpperCase() !== 'DELETE'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 18px',
                        backgroundColor: deleteConfirmation.trim().toUpperCase() === 'DELETE' ? '#dc2626' : '#fca5a5',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: deleteConfirmation.trim().toUpperCase() === 'DELETE' && !deleting ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : 'Permanently Delete'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </PageTransition>
  );
};

const SectionHeading: React.FC<{ icon?: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '11px', fontWeight: 700, color: '#8aa39d',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    margin: '20px 0 10px 0', paddingTop: '12px',
    borderTop: '1px solid #d9ece7',
  }}>
    {icon}{label}
  </div>
);

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
    {children}
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div style={{ fontSize: '11px', fontWeight: 700, color: '#8aa39d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
      {label}
    </div>
    {children}
  </div>
);
