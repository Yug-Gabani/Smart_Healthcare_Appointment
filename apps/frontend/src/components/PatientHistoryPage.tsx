import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  Calendar,
  FileText,
  Stethoscope,
  AlertCircle,
  Pill,
  Video,
  MapPin,
  CalendarClock,
  ChevronRight,
  Download,
  Receipt,
  ShoppingBag,
} from 'lucide-react';
import { PageTransition } from '../motion/PageTransition';
import type { Appointment, Prescription } from '../types';
import { appointmentsApi, prescriptionsApi, paymentsApi } from '../services/api';
import { addPrescriptionToCart, downloadPdfBlob } from '../utils/pharmacyCartUtils';

/**
 * Consolidated patient history timeline.
 *
 * Fetches once on mount, groups prescriptions by appointmentId client-side so
 * each visit row knows what came out of it, and sorts chronologically with the
 * most recent at the top. Everything reuses existing endpoints — no new
 * backend aggregation is required.
 */

function formatSlot(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function statusChipColors(status: Appointment['status']): { bg: string; fg: string; border: string } {
  switch (status) {
    case 'COMPLETED': return { bg: '#ecfdf5', fg: '#065f46', border: '#a7f3d0' };
    case 'BOOKED':
    case 'CONFIRMED': return { bg: '#eff6ff', fg: '#1e3a8a', border: '#bfdbfe' };
    case 'CANCELLED': return { bg: '#fef2f2', fg: '#991b1b', border: '#fecaca' };
    case 'NO_SHOW':
    case 'EXPIRED':   return { bg: '#f1f5f9', fg: '#334155', border: '#cbd5e1' };
  }
}

function statusLabel(status: Appointment['status']): string {
  switch (status) {
    case 'COMPLETED': return 'Completed';
    case 'BOOKED':    return 'Upcoming';
    case 'CONFIRMED': return 'Confirmed';
    case 'CANCELLED': return 'Cancelled';
    case 'NO_SHOW':   return 'Missed';
    case 'EXPIRED':   return 'Expired';
  }
}

export const PatientHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const handleDownloadRx = async (rxId: string) => {
    try {
      setBusyActionId(`rx-${rxId}`);
      await downloadPdfBlob(prescriptionsApi.pdfUrl(rxId), `prescription-${rxId}.pdf`);
    } catch {
      alert('Prescription download failed. Please try again.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDownloadInvoice = async (apptId: string) => {
    try {
      setBusyActionId(`inv-${apptId}`);
      await downloadPdfBlob(paymentsApi.appointmentReceiptPdfUrl(apptId), `PulseCare_Invoice_${apptId}.pdf`);
    } catch {
      alert('Invoice download failed. Please try again.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleOrderFromRx = async (rx: Prescription) => {
    try {
      setBusyActionId(`order-${rx.id}`);
      await addPrescriptionToCart(rx);
      navigate('/pharmacy/cart');
    } catch {
      alert('Could not add medicines to cart.');
    } finally {
      setBusyActionId(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      appointmentsApi.mine(),
      prescriptionsApi.mine().catch(() => [] as Prescription[]),
    ])
      .then(([a, p]) => {
        setAppointments(a);
        setPrescriptions(p);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load history'))
      .finally(() => setLoading(false));
  }, []);

  const rxByAppointment = useMemo(() => {
    const m = new Map<string, Prescription[]>();
    for (const rx of prescriptions) {
      (m.get(rx.appointmentId) ?? m.set(rx.appointmentId, []).get(rx.appointmentId)!).push(rx);
    }
    return m;
  }, [prescriptions]);

  // Chronological, most recent first. Use slotAt when present, fall back to createdAt.
  const timeline = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const ta = new Date(a.slotAt ?? a.createdAt).getTime();
      const tb = new Date(b.slotAt ?? b.createdAt).getTime();
      return tb - ta;
    });
  }, [appointments]);

  const stats = useMemo(() => {
    const total = appointments.length;
    const completed = appointments.filter(a => a.status === 'COMPLETED').length;
    const upcoming = appointments.filter(a => a.status === 'BOOKED' || a.status === 'CONFIRMED').length;
    const doctors = new Set(appointments.map(a => a.doctorId));
    return { total, completed, upcoming, uniqueDoctors: doctors.size };
  }, [appointments]);

  return (
    <PageTransition style={{ maxWidth: 920, margin: '24px auto 40px', padding: '0 20px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: '#0b3f3a', margin: '0 0 6px' }}>
          Your care history
        </h1>
        <p style={{ fontSize: 14, color: '#4c6360', margin: 0 }}>
          Every consultation, prescription and triage, together in one timeline.
        </p>
      </div>

      {loading && (
        <div style={{ padding: '48px', textAlign: 'center', color: '#52736d' }}>
          <Loader2 size={20} className="animate-spin" style={{ display: 'inline', marginRight: 8 }} />
          Loading…
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 14px', background: '#fef2f2', color: '#991b1b',
          border: '1px solid #fecaca', borderRadius: 10, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary tiles */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}>
            {[
              { label: 'Total visits', value: stats.total, icon: Calendar },
              { label: 'Completed', value: stats.completed, icon: Stethoscope },
              { label: 'Upcoming', value: stats.upcoming, icon: CalendarClock },
              { label: 'Unique doctors', value: stats.uniqueDoctors, icon: Stethoscope },
            ].map(tile => (
              <div
                key={tile.label}
                style={{
                  padding: '14px 16px',
                  background: '#ffffff',
                  border: '1px solid #e3eceb',
                  borderRadius: 14,
                }}
              >
                <div style={{
                  fontSize: 12, fontWeight: 500, color: '#8aa39d',
                  marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <tile.icon size={13} /> {tile.label}
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 600, color: '#0b3f3a',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {tile.value}
                </div>
              </div>
            ))}
          </div>

          {timeline.length === 0 && (
            <div style={{
              padding: '32px 24px', textAlign: 'center', color: '#8aa39d',
              background: '#ffffff', border: '1px dashed #e3eceb', borderRadius: 14,
            }}>
              Your care history will show up here once you have your first consultation.
            </div>
          )}

          {/* Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {timeline.map(appt => {
              const rxList = rxByAppointment.get(appt.id) ?? [];
              const signedRx = rxList.filter(r => r.status === 'SIGNED' || r.status === 'VOIDED');
              const colors = statusChipColors(appt.status);

              return (
                <div
                  key={appt.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e3eceb',
                    borderRadius: 14,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, color: '#8aa39d', fontWeight: 500,
                        marginBottom: 2, fontVariantNumeric: 'tabular-nums',
                      }}>
                        {formatSlot(appt.slotAt)}
                      </div>
                      <div style={{
                        fontSize: 15, fontWeight: 600, color: '#0b3f3a',
                        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                      }}>
                        {appt.doctorName ?? 'Doctor'}
                        <span style={{
                          fontSize: 12, fontWeight: 500, color: '#4c6360',
                        }}>
                          · {appt.doctorSpecialty ?? 'General'}
                        </span>
                        {appt.parentAppointmentId && (
                          <span style={{
                            fontSize: 11, fontWeight: 500,
                            padding: '2px 8px', borderRadius: 999,
                            background: '#ecfdf5', color: '#047857',
                            border: '1px solid #a7f3d0',
                          }}>
                            Follow-up
                          </span>
                        )}
                      </div>
                      {appt.chiefComplaint && (
                        <div style={{ fontSize: 13, color: '#4c6360', marginTop: 2 }}>
                          {appt.chiefComplaint}
                        </div>
                      )}
                    </div>

                    <span style={{
                      padding: '4px 10px', borderRadius: 999,
                      fontSize: 11, fontWeight: 500,
                      background: colors.bg, color: colors.fg,
                      border: '1px solid ' + colors.border,
                      flexShrink: 0,
                    }}>
                      {statusLabel(appt.status)}
                    </span>
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                    fontSize: 12, color: '#4c6360',
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {appt.consultationType === 'VIDEO'
                        ? <><Video size={12} /> Video consult</>
                        : <><MapPin size={12} /> In-person</>}
                    </span>
                    {signedRx.length > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Pill size={12} />
                        {signedRx.length}
                        {signedRx.length === 1 ? ' prescription' : ' prescriptions'}
                      </span>
                    )}
                    {appt.rescheduleCount != null && appt.rescheduleCount > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CalendarClock size={12} />
                        Rescheduled {appt.rescheduleCount}×
                      </span>
                    )}
                  </div>

                  {/* Prescriptions summary inside the visit row */}
                  {signedRx.length > 0 && (
                    <div style={{
                      background: '#f6fbf9', border: '1px solid #d9ece7',
                      borderRadius: 10, padding: '10px 12px',
                    }}>
                      {signedRx.map(rx => (
                        <div
                          key={rx.id}
                          style={{
                            fontSize: 12, color: '#0b3f3a', lineHeight: 1.6,
                            paddingTop: 2,
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>
                            {rx.items.length}
                            {rx.items.length === 1 ? ' medication' : ' medications'}
                          </span>
                          {rx.items.slice(0, 2).map(it => (
                            <span key={it.drugName} style={{ color: '#4c6360' }}>
                              {' · '}{it.drugName} {it.dose}
                            </span>
                          ))}
                          {rx.items.length > 2 && (
                            <span style={{ color: '#8aa39d' }}> and {rx.items.length - 2} more</span>
                          )}
                          {rx.followUpAfterDays && (
                            <span style={{ color: '#047857', fontWeight: 500 }}>
                              {' · follow-up in ' + rx.followUpAfterDays + 'd'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => navigate('/appointments/' + appt.id)}
                      style={{
                        padding: '6px 12px',
                        background: '#ffffff',
                        color: '#0f766e',
                        border: '1px solid #d9ece7',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      Open visit <ChevronRight size={12} />
                    </button>

                    {/* 1-Click Invoice Download */}
                    {appt.status === 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(appt.id)}
                        disabled={busyActionId === `inv-${appt.id}`}
                        style={{
                          padding: '6px 12px',
                          background: '#ffffff',
                          color: '#0f766e',
                          border: '1px solid #d9ece7',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: busyActionId === `inv-${appt.id}` ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {busyActionId === `inv-${appt.id}` ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Receipt size={12} />
                        )}
                        Invoice (PDF)
                      </button>
                    )}

                    {/* 1-Click Prescription Actions */}
                    {signedRx.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDownloadRx(signedRx[0].id)}
                          disabled={busyActionId === `rx-${signedRx[0].id}`}
                          style={{
                            padding: '6px 12px',
                            background: '#0f766e',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: busyActionId === `rx-${signedRx[0].id}` ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {busyActionId === `rx-${signedRx[0].id}` ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Download size={12} />
                          )}
                          Download Rx (PDF)
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOrderFromRx(signedRx[0])}
                          disabled={busyActionId === `order-${signedRx[0].id}`}
                          style={{
                            padding: '6px 12px',
                            background: '#f0fdf4',
                            color: '#166534',
                            border: '1px solid #bbf7d0',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: busyActionId === `order-${signedRx[0].id}` ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {busyActionId === `order-${signedRx[0].id}` ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <ShoppingBag size={12} />
                          )}
                          Order Medicines
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </PageTransition>
  );
};

export default PatientHistoryPage;
