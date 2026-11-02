import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PageTransition } from '../motion/PageTransition';
import { listItem } from '../motion/presets';
import { Download, FileText, Loader2, Package, Pill, ShoppingBag } from 'lucide-react';
import type { PharmacyOrder, PharmacyOrderStatus, Prescription } from '../types';
import { describePrescriptionItem } from '../types';
import { patientOrdersApi, prescriptionsApi } from '../services/api';

function orderStatusLabel(s: PharmacyOrderStatus): string {
  switch (s) {
    case 'NEW':       return 'Received';
    case 'DISPENSED': return 'Ready to pick up';
    case 'PICKED_UP': return 'Picked up';
    case 'CANCELLED': return 'Cancelled';
  }
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export const MyPrescriptions: React.FC = () => {
  const navigate = useNavigate();
  const [rxList, setRxList] = useState<Prescription[]>([]);
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ordering, setOrdering] = useState<string | null>(null);  // prescriptionId being ordered

  const loadAll = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      prescriptionsApi.mine(),
      patientOrdersApi.listMine().catch(() => [] as PharmacyOrder[]),
    ])
      .then(([rx, o]) => { setRxList(rx); setOrders(o); })
      .catch(e => setError(e?.message || 'Failed to load prescriptions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  // Map prescriptionId → latest ACTIVE order status (non-CANCELLED). If multiple orders exist for a
  // prescription, pick the most recent non-CANCELLED one so the button hides correctly.
  const activeOrderByRx = React.useMemo(() => {
    const m = new Map<string, PharmacyOrder>();
    for (const o of orders) {
      if (o.status === 'CANCELLED') continue;
      const prev = m.get(o.prescriptionId);
      if (!prev || new Date(o.createdAt).getTime() > new Date(prev.createdAt).getTime()) {
        m.set(o.prescriptionId, o);
      }
    }
    return m;
  }, [orders]);

  const placeOrder = async (prescriptionId: string) => {
    setOrdering(prescriptionId); setError(null);
    try {
      await patientOrdersApi.create(prescriptionId);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'Could not place order');
    } finally { setOrdering(null); }
  };

  const downloadPdf = (id: string) => {
    const token = localStorage.getItem('pulsecare_token');
    fetch(prescriptionsApi.pdfUrl(id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prescription-${id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert('Download failed'));
  };

  return (
    <PageTransition style={{ maxWidth: '960px', margin: '48px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0b3f3a', margin: 0, letterSpacing: '-0.02em' }}>
        My prescriptions
      </h1>
      <p style={{ color: '#52736d', margin: '6px 0 24px 0' }}>
        Prescriptions issued by your doctors. Download the PDF to show at the pharmacy.
      </p>

      {loading && (
        <div style={{ padding: '48px', textAlign: 'center', color: '#52736d' }}>
          <Loader2 size={24} className="animate-spin" style={{ display: 'inline', marginRight: 8 }} />
          Loading…
        </div>
      )}

      {error && (
        <div style={{
          padding: '14px 18px', borderRadius: '12px',
          backgroundColor: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.25)',
          color: '#dc2626', fontSize: '14px',
        }}>{error}</div>
      )}

      {!loading && !error && rxList.length === 0 && (
        <div className="card card-hover" style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            backgroundColor: '#eaf6f2', color: '#0f766e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Pill size={26} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0b3f3a', margin: '0 0 8px 0' }}>
            No prescriptions yet
          </h2>
          <p style={{ color: '#52736d', marginBottom: '24px' }}>
            After your doctor completes a consultation and issues a prescription, it will appear here.
          </p>
          <button onClick={() => navigate('/appointments')} className="btn btn-primary hover-lift">
            View my appointments
          </button>
        </div>
      )}

      {!loading && !error && rxList.length > 0 && (
        <div style={{ display: 'grid', gap: '14px' }}>
          <AnimatePresence>
            {rxList.map(rx => {
              const voided = rx.status === 'VOIDED';
              const supersededVoid = !voided
                ? rxList
                    .filter(r =>
                      r.appointmentId === rx.appointmentId &&
                      r.status === 'VOIDED' &&
                      new Date(r.createdAt).getTime() < new Date(rx.createdAt).getTime(),
                    )
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
                : null;
              const isSupersededSigned = !voided && rxList.some(r =>
                r.status === 'VOIDED' && r.voidOf === rx.id,
              );
              return (
                <motion.div
                  key={rx.id}
                  layout
                  variants={listItem}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="card card-hover"
                  style={{ padding: '20px' }}
                >
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: '12px', flexWrap: 'wrap', gap: '10px',
                  }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#0b3f3a' }}>
                        {rx.doctorName ?? 'Doctor'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#52736d' }}>
                        {rx.doctorSpecialty} · {rx.doctorHospital}
                      </div>
                    </div>
                    <span
                      className="badge-morph"
                      style={{
                        padding: '3px 12px', borderRadius: '9999px',
                        fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
                        color: voided || isSupersededSigned ? '#991b1b' : '#065f46',
                        backgroundColor: voided || isSupersededSigned ? '#fee2e2' : '#d1fae5',
                      }}
                    >{isSupersededSigned ? 'SUPERSEDED' : rx.status}</span>
                  </div>

                  {/* Primary "signed by / on" / "voided on" line */}
                  <div style={{ fontSize: '13px', color: '#52736d', marginBottom: '6px' }}>
                    {voided
                      ? `Voided on ${formatDate(rx.createdAt)}`
                      : <>Signed by <strong style={{ color: '#0b3f3a' }}>{rx.doctorName ?? 'Attending physician'}</strong> on {formatDate(rx.signedAt ?? rx.createdAt)}</>}
                    {voided && rx.voidReason ? ` · ${rx.voidReason}` : ''}
                  </div>

                  {/* "Replaces voided prescription from…" annotation */}
                  {supersededVoid && (
                    <div
                      className="badge-morph"
                      style={{
                        fontSize: '12px', color: '#92400e',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        padding: '6px 10px', borderRadius: '8px',
                        marginBottom: '12px',
                      }}
                    >
                      This replaces a voided prescription from {formatDate(supersededVoid.createdAt)}
                      {supersededVoid.voidReason ? ` — ${supersededVoid.voidReason}` : ''}.
                    </div>
                  )}

                  {/* SUPERSEDED banner on the earlier SIGNED copy */}
                  {isSupersededSigned && (
                    <div
                      className="badge-morph"
                      style={{
                        fontSize: '12px', color: '#991b1b',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        padding: '6px 10px', borderRadius: '8px',
                        marginBottom: '12px',
                      }}
                    >
                      This prescription was voided and replaced by a newer one. Do not act on it.
                    </div>
                  )}

                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#0b3f3a', lineHeight: 1.7 }}>
                    {rx.items.map(it => (
                      <li key={it.id ?? it.drugName} style={{ marginBottom: '6px' }}>
                        <strong>{it.drugName}</strong> — {describePrescriptionItem(it)}
                        {it.instructions ? (
                          <div style={{ fontSize: '12px', color: '#52736d', marginTop: '2px' }}>
                            Notes: {it.instructions}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  {rx.notes && (
                    <div style={{
                      marginTop: '10px', padding: '10px 12px', borderRadius: '10px',
                      backgroundColor: '#eaf6f2', border: '1px solid #d9ece7',
                      fontSize: '13px', color: '#0b3f3a',
                    }}>
                      <strong>Notes:</strong> {rx.notes}
                    </div>
                  )}

                  <div style={{ marginTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => downloadPdf(rx.id)} className="btn btn-secondary hover-lift">
                      <Download size={14} /> PDF
                    </button>
                    <button onClick={() => navigate(`/appointments/${rx.appointmentId}`)} className="btn btn-secondary hover-lift">
                      <FileText size={14} /> View appointment
                    </button>

                    {/* Order via pharmacy — only on SIGNED non-superseded prescriptions */}
                    {!voided && !isSupersededSigned && (() => {
                      const activeOrder = activeOrderByRx.get(rx.id);
                      if (activeOrder) {
                        return (
                          <button
                            onClick={() => navigate('/orders')}
                            className="btn hover-lift"
                            style={{
                              background: '#f3faf8', color: '#0f766e',
                              border: '1px solid #d7e8e5', fontSize: 13, fontWeight: 600,
                              padding: '8px 14px', borderRadius: 9999, cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                            }}
                          >
                            <Package size={14} /> Order placed · {orderStatusLabel(activeOrder.status)}
                          </button>
                        );
                      }
                      return (
                        <button
                          onClick={() => placeOrder(rx.id)}
                          disabled={ordering === rx.id}
                          className="hover-lift"
                          style={{
                            background: 'transparent', color: '#0f766e',
                            border: '1px solid #0f766e', fontSize: 13, fontWeight: 600,
                            padding: '8px 14px', borderRadius: 9999,
                            cursor: ordering === rx.id ? 'not-allowed' : 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          {ordering === rx.id
                            ? <><Loader2 size={14} className="animate-spin" /> Placing…</>
                            : <><ShoppingBag size={14} /> Order through PulseCare pharmacy</>}
                        </button>
                      );
                    })()}
                  </div>
                  {!voided && !isSupersededSigned && !activeOrderByRx.get(rx.id) && (
                    <div style={{ fontSize: 11, color: '#8aa39d', marginTop: 8 }}>
                      Optional — you can also take this prescription to any pharmacy.
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </PageTransition>
  );
};
