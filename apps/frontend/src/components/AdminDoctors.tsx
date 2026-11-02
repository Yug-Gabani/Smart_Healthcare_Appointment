import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, Clock, FileText, Loader2, Mail, Shield, X,
} from 'lucide-react';
import { PageTransition } from '../motion/PageTransition';
import { fadeInUp } from '../motion/presets';
import { adminDoctorsApi } from '../services/api';
import type { DoctorMe, DoctorStatus } from '../types';

const TABS: { value: DoctorStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'PENDING',  label: 'Pending',  icon: <Clock size={14} /> },
  { value: 'APPROVED', label: 'Approved', icon: <Shield size={14} /> },
  { value: 'REJECTED', label: 'Rejected', icon: <AlertTriangle size={14} /> },
];

export const AdminDoctors: React.FC = () => {
  const [tab, setTab] = useState<DoctorStatus>('PENDING');
  const [rows, setRows] = useState<DoctorMe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DoctorMe | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);

  const reload = (status: DoctorStatus) => {
    setLoading(true); setError(null);
    adminDoctorsApi.list(status)
      .then(setRows)
      .catch(e => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(tab); }, [tab]);

  const approve = async (id: string) => {
    setActing(true); setError(null);
    try {
      await adminDoctorsApi.approve(id);
      setSelected(null);
      reload(tab);
    } catch (e: any) {
      setError(e?.message || 'Could not approve');
    } finally { setActing(false); }
  };

  const reject = async () => {
    if (!selected || !rejectReason.trim()) return;
    setActing(true); setError(null);
    try {
      await adminDoctorsApi.reject(selected.id, rejectReason.trim());
      setRejecting(false);
      setRejectReason('');
      setSelected(null);
      reload(tab);
    } catch (e: any) {
      setError(e?.message || 'Could not reject');
    } finally { setActing(false); }
  };

  return (
    <PageTransition style={{ maxWidth: '1100px', margin: '48px auto', padding: '0 24px' }}>
      <motion.h1 {...fadeInUp} style={{ fontSize: '28px', fontWeight: 700, color: '#0b3f3a', margin: 0, letterSpacing: '-0.02em' }}>
        Doctor verification
      </motion.h1>
      <p style={{ color: '#5e7b76', margin: '6px 0 20px 0', fontSize: '14px' }}>
        Approve new doctors so they appear in patient-facing search, or reject with a reason so they can edit and resubmit.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className="hover-lift"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 9999,
              border: tab === t.value ? '1px solid #0f766e' : '1px solid #d7e8e5',
              background: tab === t.value ? '#0f766e' : '#fff',
              color: tab === t.value ? '#fff' : '#5e7b76',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
          padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16,
        }}>{error}</div>
      )}

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
          <Loader2 size={18} className="animate-spin" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center', color: '#6b7280',
          border: '1px dashed #d7e8e5', borderRadius: 16, background: '#f3faf8', fontSize: 14,
        }}>
          Nothing in <strong>{tab.toLowerCase()}</strong>.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {rows.map(d => (
            <motion.div
              key={d.id}
              {...fadeInUp}
              onClick={() => setSelected(d)}
              className="hover-lift"
              style={{
                background: '#fff', border: '1px solid #d7e8e5', borderRadius: 16,
                padding: '18px 20px', cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0b3f3a' }}>{d.fullName}</div>
              <div style={{ fontSize: 13, color: '#0f766e', margin: '2px 0 10px 0' }}>{d.specialty}</div>
              <Row label="Hospital" value={d.hospital || '—'} />
              <Row label="Reg #" value={d.registrationNumber || '—'} mono />
              {d.yearsExperience != null && <Row label="Experience" value={`${d.yearsExperience} yrs`} />}
              {d.submittedAt && <Row label="Submitted" value={new Date(d.submittedAt).toLocaleDateString()} />}
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setSelected(null); setRejecting(false); setRejectReason(''); }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(11, 63, 58, 0.4)',
              zIndex: 1000, display: 'flex', justifyContent: 'flex-end',
            }}
          >
            <motion.aside
              initial={{ x: 480 }} animate={{ x: 0 }} exit={{ x: 480 }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: 'min(480px, 100%)', background: '#fff', height: '100%',
                padding: '28px 28px 24px', overflowY: 'auto',
                boxShadow: '-16px 0 40px rgba(11, 63, 58, 0.15)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#0b3f3a' }}>{selected.fullName}</div>
                  <div style={{ fontSize: 13, color: '#0f766e', marginTop: 2 }}>{selected.specialty}</div>
                </div>
                <button
                  onClick={() => { setSelected(null); setRejecting(false); setRejectReason(''); }}
                  aria-label="Close"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                ><X size={18} /></button>
              </div>

              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <DetailRow icon={<Mail size={14} />} label="User ID" value={selected.userId} mono />
                <DetailRow icon={<FileText size={14} />} label="Registration #" value={selected.registrationNumber || '—'} mono />
                <DetailRow label="Hospital" value={selected.hospital || '—'} />
                {selected.yearsExperience != null && <DetailRow label="Experience" value={`${selected.yearsExperience} years`} />}
                {selected.consultationFee != null && <DetailRow label="Consultation fee" value={`₹ ${selected.consultationFee}`} />}
                {selected.languages && <DetailRow label="Languages" value={selected.languages} />}
                {selected.bio && <DetailRow label="Bio" value={selected.bio} />}
                {selected.submittedAt && <DetailRow label="Submitted" value={new Date(selected.submittedAt).toLocaleString()} />}
                {selected.rejectionReason && selected.status === 'REJECTED' && (
                  <DetailRow label="Previous rejection" value={selected.rejectionReason} />
                )}
              </div>

              {!rejecting ? (
                <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
                  {selected.status !== 'APPROVED' && (
                    <button
                      onClick={() => approve(selected.id)}
                      disabled={acting}
                      style={{
                        flex: 1, background: '#0f766e', color: '#fff', border: 'none',
                        borderRadius: 9999, padding: '12px', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Approve
                    </button>
                  )}
                  {selected.status !== 'REJECTED' && (
                    <button
                      onClick={() => setRejecting(true)}
                      disabled={acting}
                      style={{
                        flex: 1, background: '#fff', color: '#b91c1c', border: '1px solid #fecaca',
                        borderRadius: 9999, padding: '12px', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <AlertTriangle size={14} /> Reject
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 24 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5e7b76', marginBottom: 6 }}>
                    Reason (shown to the doctor)
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Please upload a clearer registration certificate…"
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 12,
                      border: '1px solid #d7e8e5', fontSize: 14, lineHeight: 1.5,
                      fontFamily: 'inherit', color: '#0b3f3a', boxSizing: 'border-box',
                      resize: 'vertical', outline: 'none',
                    }}
                  />
                  <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                    <button
                      onClick={reject}
                      disabled={!rejectReason.trim() || acting}
                      style={{
                        flex: 1, background: '#b91c1c', color: '#fff', border: 'none',
                        borderRadius: 9999, padding: '12px', fontSize: 13, fontWeight: 600,
                        cursor: !rejectReason.trim() || acting ? 'not-allowed' : 'pointer',
                        opacity: !rejectReason.trim() || acting ? 0.5 : 1,
                      }}
                    >Confirm reject</button>
                    <button
                      onClick={() => { setRejecting(false); setRejectReason(''); }}
                      style={{
                        flex: 1, background: '#fff', color: '#6b7280', border: '1px solid #d7e8e5',
                        borderRadius: 9999, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#5e7b76', marginBottom: 4 }}>
    <span>{label}</span>
    <span style={{ color: '#0b3f3a', fontWeight: 500, fontFamily: mono ? 'ui-monospace, SF Mono, monospace' : 'inherit' }}>
      {value}
    </span>
  </div>
);

const DetailRow: React.FC<{ label: string; value: string; icon?: React.ReactNode; mono?: boolean }> = ({ label, value, icon, mono }) => (
  <div style={{ borderBottom: '1px solid #ecf5f3', paddingBottom: 10 }}>
    <div style={{ fontSize: 11, color: '#5e7b76', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {icon} {label}
    </div>
    <div style={{
      marginTop: 4, color: '#0b3f3a', fontSize: 14, lineHeight: 1.5,
      fontFamily: mono ? 'ui-monospace, SF Mono, monospace' : 'inherit',
      wordBreak: 'break-word',
    }}>{value}</div>
  </div>
);

export default AdminDoctors;
