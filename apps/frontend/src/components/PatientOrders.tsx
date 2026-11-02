import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Clock, Loader2, Package, Pill, X,
} from 'lucide-react';
import { PageTransition } from '../motion/PageTransition';
import { fadeInUp } from '../motion/presets';
import { patientOrdersApi } from '../services/api';
import { describePrescriptionItem, type PharmacyOrder } from '../types';
import { StatusPill } from './PharmacyDashboard';

export const PatientOrders: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);  // orderId we're cancelling
  const [acting, setActing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const reload = () => {
    setLoading(true); setError(null);
    patientOrdersApi.listMine()
      .then(setOrders)
      .catch(e => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const flashBanner = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 2500);
  };

  const cancel = async (orderId: string) => {
    setActing(true); setError(null);
    try {
      await patientOrdersApi.cancel(orderId);
      setCancelling(null);
      flashBanner('Order cancelled');
      reload();
    } catch (e: any) {
      setError(e?.message || 'Could not cancel');
    } finally { setActing(false); }
  };

  return (
    <PageTransition style={{ maxWidth: '820px', margin: '48px auto', padding: '0 24px 64px' }}>
      <button
        onClick={() => navigate(-1)}
        className="hover-lift"
        style={{
          background: 'transparent', border: 'none', color: '#0f766e',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          padding: '6px 0', marginBottom: 16,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <motion.h1 {...fadeInUp} style={{ fontSize: 28, fontWeight: 700, color: '#0b3f3a', margin: 0, letterSpacing: '-0.02em' }}>
        Medicine orders
      </motion.h1>
      <p style={{ color: '#5e7b76', margin: '6px 0 24px 0', fontSize: 14 }}>
        Orders you've sent to PulseCare pharmacy. You can also take any prescription to an outside pharmacy — this is optional.
      </p>

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
      ) : orders.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center', color: '#6b7280',
          border: '1px dashed #d7e8e5', borderRadius: 16, background: '#f3faf8', fontSize: 14,
        }}>
          <Package size={32} color="#b8d4ce" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0b3f3a' }}>No pharmacy orders yet</div>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            When you have a signed prescription, you can send it to our pharmacy from the prescription detail page.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {orders.map(o => (
            <motion.div
              key={o.id}
              {...fadeInUp}
              style={{
                background: '#fff', border: '1px solid #d7e8e5', borderRadius: 16,
                padding: '20px 22px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0b3f3a' }}>
                    Order from {o.doctorName || 'Doctor'}
                  </div>
                  <div style={{ fontSize: 12, color: '#8aa39d', marginTop: 2 }}>
                    {o.doctorSpecialty} · placed {new Date(o.createdAt).toLocaleString()}
                  </div>
                </div>
                <StatusPill status={o.status} />
              </div>

              {/* Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#5e7b76', marginBottom: 10 }}>
                {o.dispensedAt && (
                  <div><Clock size={11} style={{ display: 'inline', marginRight: 6, color: '#0f766e' }} />
                    Dispensed {new Date(o.dispensedAt).toLocaleString()}</div>
                )}
                {o.pickedUpAt && (
                  <div><CheckCircle2 size={11} style={{ display: 'inline', marginRight: 6, color: '#16a34a' }} />
                    Picked up {new Date(o.pickedUpAt).toLocaleString()}</div>
                )}
                {o.cancelledAt && (
                  <div style={{ color: '#b91c1c' }}>
                    <X size={11} style={{ display: 'inline', marginRight: 6 }} />
                    Cancelled {new Date(o.cancelledAt).toLocaleString()}
                    {o.cancelledReason && <span style={{ fontStyle: 'italic', color: '#8aa39d' }}> — "{o.cancelledReason}"</span>}
                  </div>
                )}
              </div>

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px dashed #ecf5f3', paddingTop: 12 }}>
                {o.items.map((it, idx) => (
                  <div key={it.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                    <Pill size={13} color="#0f766e" style={{ marginTop: 3 }} />
                    <div>
                      <span style={{ fontWeight: 600, color: '#0b3f3a' }}>{it.drugName}</span>{' '}
                      <span style={{ color: '#5e7b76' }}>· {describePrescriptionItem(it)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              {o.status === 'NEW' && (
                cancelling === o.id ? (
                  <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => cancel(o.id)}
                      disabled={acting}
                      style={{
                        background: '#b91c1c', color: '#fff', border: 'none',
                        padding: '8px 16px', borderRadius: 9999, fontSize: 12, fontWeight: 600,
                        cursor: acting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {acting ? 'Cancelling…' : 'Confirm cancel'}
                    </button>
                    <button
                      onClick={() => setCancelling(null)}
                      style={{
                        background: 'transparent', color: '#5e7b76', border: '1px solid #d7e8e5',
                        padding: '8px 16px', borderRadius: 9999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >Keep order</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCancelling(o.id)}
                    style={{
                      marginTop: 14, background: 'transparent', color: '#b91c1c',
                      border: '1px solid #fecaca', padding: '7px 14px', borderRadius: 9999,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <AlertTriangle size={12} /> Cancel this order
                  </button>
                )
              )}
            </motion.div>
          ))}
        </div>
      )}
    </PageTransition>
  );
};

export default PatientOrders;
