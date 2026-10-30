import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, ArrowLeft, Calendar, CheckCircle2, Clock, Loader2, Plus,
  Save, Send, Shield, Trash2, UserCircle2,
} from 'lucide-react';
import { PageTransition } from '../motion/PageTransition';
import { fadeInUp } from '../motion/presets';
import { CustomSelect } from './CustomSelect';
import { WaveInput } from './WaveInput';
import { doctorProfileApi } from '../services/api';
import { COMMON_SPECIALTIES, DAY_LABELS, type DoctorMe, type ScheduleTemplate } from '../types';

type Draft = {
  fullName: string;
  specialty: string;
  hospitalName: string;
  registrationNumber: string;
  yearsExperience: string;
  consultationFee: string;
  languages: string;
  bio: string;
};

const specialtyOptions = COMMON_SPECIALTIES.map(s => ({ value: s, label: s }));

function toDraft(m: DoctorMe): Draft {
  return {
    fullName: m.fullName ?? '',
    specialty: m.specialty ?? '',
    hospitalName: m.hospital ?? '',
    registrationNumber: m.registrationNumber ?? '',
    yearsExperience: m.yearsExperience != null ? String(m.yearsExperience) : '',
    consultationFee: m.consultationFee != null ? String(m.consultationFee) : '',
    languages: m.languages ?? '',
    bio: m.bio ?? '',
  };
}

export const DoctorProfile: React.FC = () => {
  const navigate = useNavigate();
  const [me, setMe] = useState<DoctorMe | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [schedule, setSchedule] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const readOnly = me?.status === 'PENDING';

  useEffect(() => {
    setLoading(true);
    doctorProfileApi.me()
      .then(d => {
        setMe(d);
        setDraft(toDraft(d));
        setSchedule(d.scheduleTemplate ?? []);
      })
      .catch(e => setError(e?.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const setField = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft(d => (d ? { ...d, [k]: v } : d));

  const handleSaveProfile = async () => {
    if (!draft) return;
    setSaving(true); setError(null);
    try {
      const saved = await doctorProfileApi.update({
        fullName: draft.fullName.trim() || undefined,
        specialty: draft.specialty.trim() || undefined,
        hospitalName: draft.hospitalName.trim() || undefined,
        registrationNumber: draft.registrationNumber.trim() || undefined,
        yearsExperience: draft.yearsExperience ? Number(draft.yearsExperience) : undefined,
        consultationFee: draft.consultationFee ? Number(draft.consultationFee) : undefined,
        languages: draft.languages.trim() || undefined,
        bio: draft.bio.trim() || undefined,
      });
      setMe(saved);
      setDraft(toDraft(saved));
      flashBanner('Profile saved');
    } catch (e: any) {
      setError(e?.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleResubmit = async () => {
    setSaving(true); setError(null);
    try {
      const saved = await doctorProfileApi.resubmit();
      setMe(saved);
      flashBanner('Submitted for admin review');
    } catch (e: any) {
      setError(e?.message || 'Could not re-submit');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true); setError(null);
    try {
      const payload = schedule.map(r => ({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        slotDurationMinutes: r.slotDurationMinutes,
      }));
      const saved = await doctorProfileApi.replaceSchedule(payload);
      setMe(saved);
      setSchedule(saved.scheduleTemplate ?? []);
      flashBanner('Schedule saved — slots regenerated for the next 28 days');
    } catch (e: any) {
      setError(e?.message || 'Could not save schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const flashBanner = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 3000);
  };

  const addRow = () =>
    setSchedule(rows => [...rows, { dayOfWeek: 1, startTime: '09:00:00', endTime: '12:00:00', slotDurationMinutes: 30 }]);
  const removeRow = (i: number) => setSchedule(rows => rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<ScheduleTemplate>) =>
    setSchedule(rows => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  if (loading) {
    return (
      <PageTransition style={{ maxWidth: '880px', margin: '48px auto', padding: '0 24px' }}>
        <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
          <Loader2 size={20} className="animate-spin" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
          Loading your profile…
        </div>
      </PageTransition>
    );
  }

  if (!me || !draft) {
    return (
      <PageTransition style={{ maxWidth: '880px', margin: '48px auto', padding: '0 24px' }}>
        <div style={{ padding: '32px', color: '#dc2626', textAlign: 'center' }}>
          {error || 'Profile not found'}
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition style={{ maxWidth: '880px', margin: '48px auto', padding: '0 24px' }}>
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

      <motion.h1 {...fadeInUp} style={{ fontSize: '28px', fontWeight: 700, color: '#0b3f3a', margin: 0, letterSpacing: '-0.02em' }}>
        Doctor profile
      </motion.h1>
      <p style={{ color: '#5e7b76', margin: '6px 0 24px 0', fontSize: '14px' }}>
        Your details, verification status and weekly schedule.
      </p>

      <StatusCard me={me} onResubmit={handleResubmit} saving={saving} />

      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              background: '#dcfce7', border: '1px solid #86efac', color: '#166534',
              padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <CheckCircle2 size={14} /> {banner}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
          padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16,
        }}>{error}</div>
      )}

      <SectionCard title="About you" icon={<UserCircle2 size={16} />}>
        <TwoCol>
          <WaveInput label="Full name" value={draft.fullName} onChange={v => setField('fullName', v)} disabled={readOnly} />
          <WaveInput label="Medical registration number" value={draft.registrationNumber} onChange={v => setField('registrationNumber', v)} disabled={readOnly} />
        </TwoCol>
        <TwoCol>
          <div>
            <label style={subLabel}>Specialty</label>
            <CustomSelect
              value={draft.specialty}
              onChange={(v) => setField('specialty', v)}
              options={specialtyOptions}
              disabled={readOnly}
              placeholder="Select specialty"
            />
          </div>
          <WaveInput label="Hospital / clinic name" value={draft.hospitalName} onChange={v => setField('hospitalName', v)} disabled={readOnly} />
        </TwoCol>
        <TwoCol>
          <WaveInput label="Years of experience" type="number" value={draft.yearsExperience} onChange={v => setField('yearsExperience', v)} disabled={readOnly} />
          <WaveInput label="Consultation fee (₹)" type="number" value={draft.consultationFee} onChange={v => setField('consultationFee', v)} disabled={readOnly} />
        </TwoCol>
        <WaveInput label="Languages spoken (comma separated)" value={draft.languages} onChange={v => setField('languages', v)} disabled={readOnly} />
        <div style={{ marginTop: 16 }}>
          <label style={subLabel}>Short bio</label>
          <textarea
            value={draft.bio}
            onChange={e => setField('bio', e.target.value)}
            rows={4}
            disabled={readOnly}
            placeholder="A paragraph about your training, interests and approach to care."
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12,
              border: '1px solid #d7e8e5', fontSize: 14, lineHeight: 1.5,
              fontFamily: 'inherit', color: '#0b3f3a', background: readOnly ? '#f3faf8' : '#fff',
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSaveProfile}
            disabled={saving || readOnly}
            className="hover-lift"
            style={primaryButton(saving || readOnly)}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save profile
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Weekly availability" icon={<Calendar size={16} />}>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px 0' }}>
          Add one row per block of time you see patients. The system generates concrete slots for the next 28 days when you save.
        </p>
        {schedule.length === 0 && (
          <div style={{
            padding: '20px', border: '1px dashed #d7e8e5', borderRadius: 12,
            color: '#6b7280', fontSize: 13, textAlign: 'center', background: '#f3faf8',
          }}>
            No weekly blocks yet. Add one below.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {schedule.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 110px 110px 130px 40px',
                gap: 10, alignItems: 'center',
                padding: '10px 12px', border: '1px solid #d7e8e5', borderRadius: 12,
                background: '#fff',
              }}
            >
              <CustomSelect
                value={String(row.dayOfWeek)}
                onChange={(v) => updateRow(i, { dayOfWeek: Number(v) })}
                options={DAY_LABELS.map((d, idx) => ({ value: String(idx + 1), label: d }))}
                disabled={readOnly}
              />
              <input type="time" value={row.startTime.slice(0, 5)} disabled={readOnly}
                onChange={e => updateRow(i, { startTime: e.target.value + ':00' })} style={inputStyle(readOnly)} />
              <input type="time" value={row.endTime.slice(0, 5)} disabled={readOnly}
                onChange={e => updateRow(i, { endTime: e.target.value + ':00' })} style={inputStyle(readOnly)} />
              <CustomSelect
                value={String(row.slotDurationMinutes)}
                onChange={(v) => updateRow(i, { slotDurationMinutes: Number(v) })}
                options={[15, 20, 30, 45, 60].map(n => ({ value: String(n), label: `${n} min` }))}
                disabled={readOnly}
              />
              <button
                onClick={() => removeRow(i)}
                disabled={readOnly}
                aria-label="Remove"
                style={{
                  background: 'transparent', border: '1px solid #fecaca',
                  color: '#dc2626', borderRadius: 8, width: 36, height: 36,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  cursor: readOnly ? 'not-allowed' : 'pointer', opacity: readOnly ? 0.4 : 1,
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={addRow}
            disabled={readOnly}
            style={{
              background: 'transparent', border: '1px dashed #0f766e', color: '#0f766e',
              padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: readOnly ? 'not-allowed' : 'pointer', opacity: readOnly ? 0.4 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={14} /> Add weekly block
          </button>
          <button
            onClick={handleSaveSchedule}
            disabled={savingSchedule || readOnly}
            className="hover-lift"
            style={primaryButton(savingSchedule || readOnly)}
          >
            {savingSchedule ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save schedule
          </button>
        </div>
      </SectionCard>
    </PageTransition>
  );
};

// ---------- sub components ----------

const StatusCard: React.FC<{ me: DoctorMe; onResubmit: () => void; saving: boolean }> = ({ me, onResubmit, saving }) => {
  const palette = useMemo(() => {
    switch (me.status) {
      case 'PENDING':  return { bg: '#fef3c7', border: '#fde68a', ink: '#92400e', icon: <Clock size={18} /> };
      case 'APPROVED': return { bg: '#dcfce7', border: '#86efac', ink: '#166534', icon: <Shield size={18} /> };
      case 'REJECTED': return { bg: '#fee2e2', border: '#fecaca', ink: '#991b1b', icon: <AlertTriangle size={18} /> };
    }
  }, [me.status]);

  const label = {
    PENDING:  'Pending admin review',
    APPROVED: 'Verified — visible to patients',
    REJECTED: 'Changes requested by admin',
  }[me.status];

  const body = {
    PENDING:  'Your profile is being reviewed. You cannot edit anything until review is complete.',
    APPROVED: 'Your profile is live. You can edit at any time; changes do not require re-review.',
    REJECTED: me.rejectionReason || 'The admin asked for changes. Edit your profile and resubmit.',
  }[me.status];

  return (
    <div style={{
      background: palette.bg, border: `1px solid ${palette.border}`,
      borderRadius: 16, padding: '16px 18px', marginBottom: 20,
      display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      <div style={{ color: palette.ink, marginTop: 2 }}>{palette.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: palette.ink, fontSize: 14, marginBottom: 4 }}>{label}</div>
        <div style={{ color: palette.ink, fontSize: 13, lineHeight: 1.5 }}>{body}</div>
        {me.status === 'REJECTED' && (
          <button
            onClick={onResubmit}
            disabled={saving}
            style={{
              marginTop: 12, background: palette.ink, color: '#fff',
              border: 'none', borderRadius: 9999, padding: '8px 18px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Submit for review
          </button>
        )}
      </div>
    </div>
  );
};

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <motion.section
    {...fadeInUp}
    style={{
      background: '#ffffff', border: '1px solid #d7e8e5', borderRadius: 16,
      padding: '20px 22px', marginBottom: 20,
    }}
  >
    <h2 style={{
      display: 'flex', alignItems: 'center', gap: 8, color: '#0b3f3a',
      fontSize: 15, fontWeight: 700, margin: '0 0 14px 0', letterSpacing: '-0.01em',
    }}>
      <span style={{ color: '#0f766e' }}>{icon}</span> {title}
    </h2>
    {children}
  </motion.section>
);

const TwoCol: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 14, marginBottom: 14,
  }}>{children}</div>
);

const subLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#5e7b76',
  marginBottom: 6, letterSpacing: '0.02em',
};

const inputStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '8px 10px', borderRadius: 8, border: '1px solid #d7e8e5',
  fontSize: 13, outline: 'none', background: disabled ? '#f3faf8' : '#fff',
  color: '#0b3f3a', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
});

const primaryButton = (disabled: boolean): React.CSSProperties => ({
  background: '#0f766e', color: '#fff', border: 'none',
  padding: '10px 18px', borderRadius: 9999, fontSize: 13, fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
  display: 'inline-flex', alignItems: 'center', gap: 6,
});

export default DoctorProfile;
