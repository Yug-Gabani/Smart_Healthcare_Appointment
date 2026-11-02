import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, Check, CheckCircle2, Clock, Loader2, Package, Pill, Stethoscope, X,
} from 'lucide-react';
import { PageTransition } from '../motion/PageTransition';
import { fadeInUp } from '../motion/presets';
import { pharmacyApi } from '../services/api';
import { describePrescriptionItem, type PharmacyOrder, type PharmacyOrderStatus } from '../types';

const TABS: { value: PharmacyOrderStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'NEW',       label: 'New',        icon: <Package size={14} /> },
  { value: 'DISPENSED', label: 'Dispensed',  icon: <Check size={14} /> },
  { value: 'PICKED_UP', label: 'Picked up',  icon: <CheckCircle2 size={14} /> },
  { value: 'CANCELLED', label: 'Cancelled',  icon: <X size={14} /> },
];

export const PharmacyDashboard: React.FC = () => {
  const [tab, setTab] = useState<PharmacyOrderStatus>('NEW');
  const [rows, setRows] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PharmacyOrder | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [acting, setActing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const reload = (status: PharmacyOrderStatus) => {
    setLoading(true); setError(null);
    pharmacyApi.listByStatus(status)
      .then(setRows)
      .catch(e => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(tab); }, [tab]);

  const flashBanner = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 2500);
  };

  const dispense = async (id: string) => {
    setActing(true); setError(null);
    try {
      await pharmacyApi.dispense(id);
      setSelected(null);
      flashBanner('Marked dispensed');
      reload(tab);
    } catch (e: any) {
      setError(e?.message || 'Could not dispense');
    } finally { setActing(false); }
  };

  const pickup = async (id: string) => {
    setActing(true); setError(null);
    try {
      await pharmacyApi.pickup(id);
      setSelected(null);
      flashBanner('Marked picked up');
      reload(tab);
    } catch (e: any) {
      setError(e?.message || 'Could not mark picked up');
    } finally { setActing(false); }
  };

  const confirmCancel = async () => {
    if (!selected) return;
    setActing(true); setError(null);
    try {
      await pharmacyApi.cancel(selected.id, cancelReason.trim() || undefined);
      setSelected(null); setCancelling(false); setCancelReason('');
      flashBanner('Order cancelled');
      reload(tab);
    } catch (e: any) {
      setError(e?.message || 'Could not cancel');
    } finally { setActing(false); }
  };

  const kpiCount = (s: PharmacyOrderStatus) => (tab === s ? rows.length : null);

  return (
    <PageTransition style={{ maxWidth: '1200px', margin: '36px auto', padding: '0 24px 64px' }}>
      <motion.h1 {...fadeInUp} style={{ fontSize: 28, fontWeight: 700, color: '#0b3f3a', margin: 0, letterSpacing: '-0.02em' }}>
        Pharmacy desk
      </motion.h1>
      <p style={{ color: '#5e7b76', margin: '6px 0 20px 0', fontSize: 14 }}>
        Orders patients have sent to PulseCare pharmacy. Dispense the medicines, then mark them picked up when the patient collects.
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
            {kpiCount(t.value) != null && (
              <span style={{
                marginLeft: 4, padding: '1px 7px', borderRadius: 9999,
                background: tab === t.value ? 'rgba(255,255,255,0.2)' : '#f3faf8',
                fontSize: 11, fontWeight: 700,
              }}>{kpiCount(t.value)}</span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
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

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
          <Loader2 size={18} className="animate-spin" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center', color: '#6b7280',
          border: '1px dashed #d7e8e5', borderRadius: 16, background: '#f3faf8', fontSize: 14,
        }}>
          No orders in <strong>{tab.replace('_', ' ').toLowerCase()}</strong>.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {rows.map(o => (
            <motion.div
              key={o.id}
              {...fadeInUp}
              onClick={() => setSelected(o)}
              className="hover-lift"
              style={{
                background: '#fff', border: '1px solid #d7e8e5', borderRadius: 16,
                padding: '18px 20px', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0b3f3a' }}>
                  {o.patientName || 'Patient'}
                </div>
                <StatusPill status={o.status} />
              </div>
              <div style={{ fontSize: 13, color: '#5e7b76', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Stethoscope size={13} color="#0f766e" /> {o.doctorName || 'Doctor'} · {o.doctorSpecialty || ''}
              </div>
              <div style={{ fontSize: 12, color: '#8aa39d', borderTop: '1px dashed #ecf5f3', paddingTop: 10 }}>
                {o.items.length} medicine{o.items.length === 1 ? '' : 's'} · placed {new Date(o.createdAt).toLocaleString()}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setSelected(null); setCancelling(false); setCancelReason(''); }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(11, 63, 58, 0.4)', zIndex: 1000,
              display: 'flex', justifyContent: 'flex-end',
            }}
          >
            <motion.aside
              initial={{ x: 480 }} animate={{ x: 0 }} exit={{ x: 480 }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: 'min(520px, 100%)', background: '#fff', height: '100%',
                padding: '28px 28px 24px', overflowY: 'auto',
                boxShadow: '-16px 0 40px rgba(11, 63, 58, 0.15)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#0b3f3a' }}>
                    {selected.patientName || 'Patient'}
                  </div>
                  <div style={{ fontSize: 13, color: '#5e7b76', marginTop: 4 }}>
                    From {selected.doctorName || 'Doctor'} · {selected.doctorSpecialty || ''}
                  </div>
                </div>
                <button
                  onClick={() => { setSelected(null); setCancelling(false); setCancelReason(''); }}
                  aria-label="Close"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                ><X size={18} /></button>
              </div>

              <div style={{ marginTop: 16 }}>
                <StatusPill status={selected.status} />
              </div>

              <h3 style={sectionTitle}><Pill size={14} /> Medicines</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selected.items.map((it, idx) => (
                  <div key={it.id || idx} style={itemCard}>
                    <div style={{ fontWeight: 700, color: '#0b3f3a', fontSize: 14 }}>{it.drugName}</div>
                    <div style={{ fontSize: 13, color: '#5e7b76', marginTop: 4 }}>
                      {describePrescriptionItem(it)}
                    </div>
                    {it.instructions && (
                      <div style={{ fontSize: 12, color: '#8aa39d', marginTop: 6, fontStyle: 'italic' }}>
                        {it.instructions}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selected.prescriptionNotes && (
                <>
                  <h3 style={sectionTitle}>Doctor's notes</h3>
                  <div style={{ ...itemCard, fontSize: 13, color: '#5e7b76', whiteSpace: 'pre-wrap' }}>
                    {selected.prescriptionNotes}
                  </div>
                </>
              )}

              {/* Lifecycle timestamps */}
              <h3 style={sectionTitle}>Timeline</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <Timeline label="Order placed" at={selected.createdAt} />
                {selected.dispensedAt && <Timeline label="Dispensed" at={selected.dispensedAt} />}
                {selected.pickedUpAt && <Timeline label="Picked up" at={selected.pickedUpAt} />}
                {selected.cancelledAt && (
                  <>
                    <Timeline label="Cancelled" at={selected.cancelledAt} tone="danger" />
                    {selected.cancelledReason && (
                      <div style={{ marginLeft: 20, color: '#b91c1c', fontSize: 12, fontStyle: 'italic' }}>
                        "{selected.cancelledReason}"
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Actions */}
              {!cancelling ? (
                <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {selected.status === 'NEW' && (
                    <button onClick={() => dispense(selected.id)} disabled={acting} style={primaryBtn(acting)}>
                      {acting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Mark dispensed
                    </button>
                  )}
                  {selected.status === 'DISPENSED' && (
                    <button onClick={() => pickup(selected.id)} disabled={acting} style={primaryBtn(acting)}>
                      {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Mark picked up
                    </button>
                  )}
                  {(selected.status === 'NEW' || selected.status === 'DISPENSED') && (
                    <button onClick={() => setCancelling(true)} disabled={acting} style={dangerBtn}>
                      <AlertTriangle size={14} /> Cancel order
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 24 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5e7b76', marginBottom: 6 }}>
                    Reason (optional, shown to the patient)
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Medicine unavailable — please visit another pharmacy"
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 12,
                      border: '1px solid #d7e8e5', fontSize: 14, lineHeight: 1.5,
                      fontFamily: 'inherit', color: '#0b3f3a', boxSizing: 'border-box',
                      resize: 'vertical', outline: 'none',
                    }}
                  />
                  <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                    <button onClick={confirmCancel} disabled={acting} style={{ ...dangerBtn, flex: 1, justifyContent: 'center' }}>
                      Confirm cancel
                    </button>
                    <button
                      onClick={() => { setCancelling(false); setCancelReason(''); }}
                      style={{
                        flex: 1, background: '#fff', color: '#6b7280', border: '1px solid #d7e8e5',
                        borderRadius: 9999, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >Keep order</button>
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

// ---------- shared bits ----------

export const StatusPill: React.FC<{ status: PharmacyOrderStatus }> = ({ status }) => {
  const p = {
    NEW:       { bg: '#eff6ff', ink: '#1d4ed8', label: 'New' },
    DISPENSED: { bg: '#fef3c7', ink: '#92400e', label: 'Dispensed' },
    PICKED_UP: { bg: '#dcfce7', ink: '#166534', label: 'Picked up' },
    CANCELLED: { bg: '#fee2e2', ink: '#991b1b', label: 'Cancelled' },
  }[status];
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 9999,
      background: p.bg, color: p.ink, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.03em', textTransform: 'uppercase',
    }}>{p.label}</span>
  );
};

const Timeline: React.FC<{ label: string; at: string; tone?: 'danger' }> = ({ label, at, tone }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <Clock size={12} color={tone === 'danger' ? '#b91c1c' : '#0f766e'} />
    <span style={{ color: tone === 'danger' ? '#b91c1c' : '#5e7b76', fontWeight: 500 }}>{label}</span>
    <span style={{ color: '#8aa39d' }}>· {new Date(at).toLocaleString()}</span>
  </div>
);

const sectionTitle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, color: '#0b3f3a',
  fontSize: 13, fontWeight: 700, marginTop: 22, marginBottom: 10,
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

const itemCard: React.CSSProperties = {
  background: '#f3faf8', border: '1px solid #d7e8e5',
  borderRadius: 12, padding: '12px 14px',
};

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  flex: 1, minWidth: 160, background: '#0f766e', color: '#fff', border: 'none',
  padding: '12px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
});

const dangerBtn: React.CSSProperties = {
  background: '#fff', color: '#b91c1c', border: '1px solid #fecaca',
  padding: '12px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};

export default PharmacyDashboard;
