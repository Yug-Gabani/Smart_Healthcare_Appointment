/**
 * MyPrescriptions.tsx
 *
 * Patient-facing prescription list. Allows patients to:
 *   - View all prescriptions issued by their doctors
 *   - Download PDF copies for external pharmacies
 *   - Book a follow-up appointment directly from a prescription card
 *   - Order prescribed medicines directly from the PulseCare pharmacy cart
 *
 * Prescription → Pharmacy Cart flow
 * ----------------------------------
 * PrescriptionItem only stores `drugName` (free text written by the doctor).
 * There is no direct FK to the pharmacy Medicine table. We therefore search
 * the pharmacy catalogue by name and add the first exact/fuzzy match with
 * quantity = 1 to the cart. Items that cannot be matched or are out of stock
 * are shown in a per-card warning banner instead of silently dropped.
 *
 * @module MyPrescriptions
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PageTransition } from '../motion/PageTransition';
import { listItem } from '../motion/presets';
import {
  AlertTriangle,
  CalendarClock,
  Download,
  FileText,
  Loader2,
  Package,
  Pill,
  ShoppingBag,
} from 'lucide-react';
import type { PharmacyOrder, PharmacyOrderStatus, Prescription } from '../types';
import { describePrescriptionItem } from '../types';
import {
  appointmentsApi,
  patientOrdersApi,
  pharmacyCommerceApi,
  prescriptionsApi,
} from '../services/api';
import { SlotPickerModal } from './SlotPickerModal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MyPrescriptions: React.FC = () => {
  const navigate = useNavigate();

  const [rxList, setRxList] = useState<Prescription[]>([]);
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Tracks which prescription is currently being added to the pharmacy cart.
   * Null when no add-to-cart operation is in progress.
   */
  const [cartAdding, setCartAdding] = useState<string | null>(null);

  /**
   * Tracks which prescription is being sent to the legacy pharmacy-order flow.
   * Null when idle.
   */
  const [ordering, setOrdering] = useState<string | null>(null);

  /**
   * Per-prescription warnings produced by addPrescriptionToCart.
   * Key = prescription ID, value = list of warning strings (out-of-stock / not-found items).
   */
  const [cartWarnings, setCartWarnings] = useState<Record<string, string[]>>({});

  // Follow-up booking modal state
  const [followUpFor, setFollowUpFor] = useState<Prescription | null>(null);
  const [followUpBooked, setFollowUpBooked] = useState<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

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

  /**
   * Map prescriptionId → latest ACTIVE order (non-CANCELLED).
   * Used to decide whether to show "place order" vs "view order" button.
   */
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

  // ---------------------------------------------------------------------------
  // Legacy pharmacy-order flow (creates a PharmacyOrder record, NOT cart)
  // ---------------------------------------------------------------------------

  const placeOrder = async (prescriptionId: string) => {
    setOrdering(prescriptionId);
    setError(null);
    try {
      await patientOrdersApi.create(prescriptionId);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'Could not place order');
    } finally {
      setOrdering(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Prescription → pharmacy cart flow
  // ---------------------------------------------------------------------------

  /**
   * Attempts to add every item in a prescription to the pharmacy cart.
   *
   * Strategy:
   *   1. For each prescription item, search the medicine catalogue by drug name.
   *   2. If no match is found → record a "not found" warning.
   *   3. If the matched medicine is out of stock (stockQuantity < 1) → record
   *      an "out of stock" warning.
   *   4. Otherwise call addToCart with quantity = 1 (prescriptions store dosage
   *      text, not numeric quantities, so we default to 1 unit per medicine).
   *
   * Returns an array of warning strings for items that could not be added.
   * On success (all items added) the array is empty.
   *
   * @param rx - The prescription whose items should be added to the cart.
   */
  const addPrescriptionToCart = async (rx: Prescription): Promise<string[]> => {
    const warnings: string[] = [];

    for (const item of rx.items) {
      try {
        // Search catalogue by drug name (case-insensitive, partial match via backend ILIKE)
        const result = await pharmacyCommerceApi.getMedicines({
          search: item.drugName,
          size: 5,
        });

        // Pick the best match: prefer an exact name match, fall back to first result
        const match =
          result.content.find(
            m => m.name.toLowerCase() === item.drugName.toLowerCase(),
          ) ?? result.content[0];

        if (!match) {
          warnings.push(`"${item.drugName}" — not found in pharmacy catalogue`);
          continue;
        }

        if (match.stockQuantity < 1) {
          warnings.push(`"${match.name}" — currently out of stock`);
          continue;
        }

        // Add with quantity = 1 (default; doctor's dosage is in the instructions, not a cart qty)
        await pharmacyCommerceApi.addToCart(match.id, 1);
      } catch (err: any) {
        // Catch per-item errors so one failed item does not block the rest
        warnings.push(`"${item.drugName}" — could not be added (${err?.message ?? 'unknown error'})`);
      }
    }

    return warnings;
  };

  /**
   * Click handler for the "Order Prescribed Medicines" button.
   * Runs the cart-add flow, stores any warnings, then navigates to /pharmacy/cart.
   */
  const handleOrderFromPrescription = async (rx: Prescription) => {
    setCartAdding(rx.id);
    // Clear previous warnings for this prescription
    setCartWarnings(prev => ({ ...prev, [rx.id]: [] }));

    const warnings = await addPrescriptionToCart(rx);

    setCartWarnings(prev => ({ ...prev, [rx.id]: warnings }));
    setCartAdding(null);

    // Navigate to cart even if some items failed — patient can manually add missing ones
    navigate('/pharmacy/cart');
  };

  // ---------------------------------------------------------------------------
  // PDF download
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PageTransition style={{ width: '100%', maxWidth: '1440px', margin: '48px auto', padding: '0 24px', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0b3f3a', margin: 0, letterSpacing: '-0.02em' }}>
        My prescriptions
      </h1>
      <p style={{ color: '#52736d', margin: '6px 0 24px 0' }}>
        Prescriptions issued by your doctors. Download the PDF to show at any pharmacy, or order directly through PulseCare.
      </p>

      {/* Global loading indicator */}
      {loading && (
        <div style={{ padding: '48px', textAlign: 'center', color: '#52736d' }}>
          <Loader2 size={24} className="animate-spin" style={{ display: 'inline', marginRight: 8 }} />
          Loading…
        </div>
      )}

      {/* Global error banner */}
      {error && (
        <div style={{
          padding: '14px 18px', borderRadius: '12px',
          backgroundColor: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.25)',
          color: '#dc2626', fontSize: '14px', marginBottom: '16px',
        }}>{error}</div>
      )}

      {/* Empty state */}
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

      {/* Prescription grid */}
      {!loading && !error && rxList.length > 0 && (
        <div style={{
          display: 'grid',
          gap: '20px',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          width: '100%',
        }}>
          <AnimatePresence>
            {rxList.map(rx => {
              const voided = rx.status === 'VOIDED';

              // A prescription is superseded when another prescription for the same appointment
              // was later VOIDED and that voided prescription's voidOf === rx.id
              const isSupersededSigned = !voided && rxList.some(r =>
                r.status === 'VOIDED' && r.voidOf === rx.id,
              );

              // The earlier VOIDED prescription that this one replaces (shown as annotation)
              const supersededVoid = !voided
                ? rxList
                    .filter(r =>
                      r.appointmentId === rx.appointmentId &&
                      r.status === 'VOIDED' &&
                      new Date(r.createdAt).getTime() < new Date(rx.createdAt).getTime(),
                    )
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
                : null;

              // Whether this prescription's items can be ordered through PulseCare pharmacy
              const canOrderFromPharmacy = !voided && !isSupersededSigned && rx.items.length > 0;

              // Per-card cart warnings (populated after a failed/partial add-to-cart)
              const warnings = cartWarnings[rx.id] ?? [];

              return (
                <motion.div
                  key={rx.id}
                  layout
                  variants={listItem}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="card card-hover"
                  style={{
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* ---- Card body ---- */}
                  <div>
                    {/* Doctor name + status badge */}
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

                    {/* Signed / voided timestamp line */}
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

                    {/* Superseded banner on the earlier SIGNED copy */}
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

                    {/* Medicine list */}
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

                    {/* Doctor notes */}
                    {rx.notes && (
                      <div style={{
                        marginTop: '10px', padding: '10px 12px', borderRadius: '10px',
                        backgroundColor: '#eaf6f2', border: '1px solid #d9ece7',
                        fontSize: '13px', color: '#0b3f3a',
                      }}>
                        <strong>Notes:</strong> {rx.notes}
                      </div>
                    )}

                    {/* Out-of-stock / not-found warnings from last cart-add attempt */}
                    {warnings.length > 0 && (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(220, 38, 38, 0.06)',
                          border: '1px solid rgba(220, 38, 38, 0.2)',
                        }}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          fontSize: '12px', fontWeight: 700, color: '#b91c1c', marginBottom: '6px',
                        }}>
                          <AlertTriangle size={13} />
                          Some items could not be added to cart:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#b91c1c' }}>
                          {warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Doctor-recommended follow-up — shown only on SIGNED, non-voided prescriptions */}
                    {!voided && !isSupersededSigned && rx.followUpAfterDays && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '12px 14px',
                          borderRadius: 12,
                          backgroundColor: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 220 }}>
                          <CalendarClock size={18} color="#065f46" style={{ flexShrink: 0 }} />
                          <div style={{ fontSize: 13, color: '#065f46', lineHeight: 1.5 }}>
                            <div style={{ fontWeight: 500 }}>
                              Follow-up recommended in {rx.followUpAfterDays}
                              {rx.followUpAfterDays === 1 ? ' day' : ' days'}
                            </div>
                            {rx.followUpNotes && (
                              <div style={{ fontSize: 12, marginTop: 2, color: '#047857' }}>
                                {rx.followUpNotes}
                              </div>
                            )}
                          </div>
                        </div>
                        {followUpBooked.has(rx.id) ? (
                          <span style={{
                            fontSize: 12, fontWeight: 500, color: '#065f46',
                            padding: '6px 12px', background: '#ffffff',
                            border: '1px solid #a7f3d0', borderRadius: 10,
                          }}>
                            Follow-up booked
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setFollowUpFor(rx)}
                            style={{
                              padding: '8px 14px',
                              background: '#0f766e',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: 10,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            Book follow-up
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ---- Card footer: action buttons ---- */}
                  <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                    {/* Row 1: PDF + View appointment */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button onClick={() => downloadPdf(rx.id)} className="btn btn-secondary hover-lift">
                        <Download size={14} /> PDF
                      </button>
                      <button onClick={() => navigate(`/appointments/${rx.appointmentId}`)} className="btn btn-secondary hover-lift">
                        <FileText size={14} /> View appointment
                      </button>
                    </div>

                    {/* Row 2: Pharmacy actions — only on SIGNED, non-superseded, non-empty prescriptions */}
                    {canOrderFromPharmacy && (() => {
                      const activeOrder = activeOrderByRx.get(rx.id);

                      // Already has a pending pharmacy order → show status link
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

                      // No existing order → show both cart-add and legacy-order buttons
                      return (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>

                          {/*
                           * "Order Prescribed Medicines" — adds each prescribed drug to the
                           * pharmacy cart (searched by name) then redirects to /pharmacy/cart.
                           * Quantity is set to 1 per item (prescriptions store dosage text, not qty).
                           */}
                          <button
                            onClick={() => handleOrderFromPrescription(rx)}
                            disabled={cartAdding === rx.id}
                            className="hover-lift"
                            style={{
                              background: '#0f766e', color: '#ffffff',
                              border: 'none', fontSize: 13, fontWeight: 600,
                              padding: '8px 16px', borderRadius: 9999,
                              cursor: cartAdding === rx.id ? 'not-allowed' : 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              opacity: cartAdding === rx.id ? 0.7 : 1,
                            }}
                          >
                            {cartAdding === rx.id
                              ? <><Loader2 size={14} className="animate-spin" /> Adding to cart…</>
                              : <><ShoppingBag size={14} /> Order Prescribed Medicines</>}
                          </button>

                          {/* Legacy flow: creates a PharmacyOrder directly without going through the cart */}
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
                              : <>Order through PulseCare pharmacy</>}
                          </button>
                        </div>
                      );
                    })()}

                    {/* Hint text — only when patient has an actionable prescription with no active order */}
                    {canOrderFromPharmacy && !activeOrderByRx.get(rx.id) && (
                      <div style={{ fontSize: 11, color: '#8aa39d' }}>
                        You can also take this prescription to any external pharmacy.
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Follow-up booking modal */}
      {followUpFor && (
        <SlotPickerModal
          isOpen={!!followUpFor}
          doctorId={followUpFor.doctorId}
          doctorName={followUpFor.doctorName}
          title="Book follow-up"
          confirmLabel="Book follow-up"
          showConsultationTypeToggle
          defaultConsultationType="VIDEO"
          onClose={() => setFollowUpFor(null)}
          onConfirm={async (slotId, consultationType) => {
            await appointmentsApi.bookFollowUp({
              originalAppointmentId: followUpFor.appointmentId,
              slotId,
              consultationType,
            });
            setFollowUpBooked(prev => {
              const next = new Set(prev);
              next.add(followUpFor.id);
              return next;
            });
          }}
        />
      )}
    </PageTransition>
  );
};
