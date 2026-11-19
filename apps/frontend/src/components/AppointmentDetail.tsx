import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageTransition } from '../motion/PageTransition';
import { ArrowLeft, Calendar, Clock, Loader2, MapPin, Video, XCircle, FileText, RotateCcw, AlertCircle, CalendarClock, Download, Receipt, ShoppingBag } from 'lucide-react';
import type { Appointment, Prescription } from '../types';
import { appointmentsApi, prescriptionsApi, paymentsApi } from '../services/api';
import { CancelRefundModal } from './CancelRefundModal';
import { SlotPickerModal } from './SlotPickerModal';
import { getAppointmentStatusDetails, formatAppointmentSlot } from '../utils/appointmentStatus';
import { addPrescriptionToCart, downloadPdfBlob } from '../utils/pharmacyCartUtils';

function formatSlot(iso?: string): string {
  return formatAppointmentSlot(iso);
}

function urgencyColor(u: Appointment['urgency']): string {
  if (u === 'EMERGENCY') return '#dc2626';
  if (u === 'URGENT') return '#d97706';
  return '#059669';
}

function urgencyBg(u: Appointment['urgency']): string {
  if (u === 'EMERGENCY') return 'rgba(220, 38, 38, 0.08)';
  if (u === 'URGENT') return 'rgba(217, 119, 6, 0.1)';
  return 'rgba(5, 150, 105, 0.08)';
}

export const AppointmentDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [refundSummary, setRefundSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      appointmentsApi.get(id),
      prescriptionsApi.listForAppointment(id).catch(() => [] as Prescription[]),
    ])
      .then(([a, p]) => {
        setAppt(a);
        setPrescriptions(p);
      })
      .catch(err => setError(err.message || 'Could not load appointment'))
      .finally(() => setLoading(false));
  }, [id]);

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

  const handleOrderMedicines = async (rx: Prescription) => {
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

  const details = appt ? getAppointmentStatusDetails(appt) : null;
  const canCancel = details ? details.canCancel : false;
  const canReschedule = canCancel; // same window: active, before the slot has started

  return (
    <PageTransition style={{ maxWidth: '720px', margin: '20px auto 28px', padding: '0 20px' }}>
      <button
        onClick={() => navigate(-1)}
        className="hover-lift"
        style={{
          background: 'transparent', border: 'none', color: '#0f766e',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          padding: '4px 0', marginBottom: '12px',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
        }}
      >
        <ArrowLeft size={16} /> Back
      </button>

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
        }}>
          {error}
        </div>
      )}

      {appt && (
        <div className="card card-hover" style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
            {appt.doctorAvatarUrl ? (
              <img
                src={appt.doctorAvatarUrl}
                alt={appt.doctorName ?? ''}
                style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                backgroundColor: '#eaf6f2', color: '#0f766e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '20px',
              }}>
                {(appt.doctorName ?? 'Dr').split(' ').map(s => s[0]).join('').slice(0, 2)}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0b3f3a', margin: 0 }}>
                {appt.doctorName}
              </h1>
              <div style={{ color: '#52736d', fontSize: '14px' }}>
                {appt.doctorSpecialty} · {appt.doctorHospital}
              </div>
            </div>
            <span
              className="badge-morph"
              style={{
                padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
                color: urgencyColor(appt.urgency), backgroundColor: urgencyBg(appt.urgency),
              }}
            >{appt.urgency}</span>
          </div>

          <div style={{
            display: 'grid', gap: '10px',
            backgroundColor: '#eaf6f2', borderRadius: '14px',
            padding: '14px 18px', border: '1px solid #d9ece7',
            fontSize: '14px', marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={16} color="#0f766e" />
              <span><strong>Date:</strong> {formatSlot(appt.slotAt)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {appt.consultationType === 'VIDEO' ? (
                <Video size={16} color="#0f766e" />
              ) : (
                <MapPin size={16} color="#0f766e" />
              )}
              <span><strong>Mode:</strong> {appt.consultationType === 'VIDEO' ? 'Encrypted video consult' : 'In-person at hospital'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={16} color="#0f766e" />
              <span><strong>Status:</strong> {details?.label || appt.status}</span>
            </div>
          </div>

          {/* Expired / Missed Notice */}
          {details?.key === 'EXPIRED' && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <AlertCircle size={18} color="#dc2626" />
              <div style={{ fontSize: '13px', color: '#991b1b' }}>
                <strong>Appointment Expired:</strong> Scheduled slot ({formatSlot(appt.slotAt)}) has passed without attendance. Consultation room is closed.
              </div>
            </div>
          )}

          {/* Refund Status Notice if cancelled */}
          {(appt.status === 'CANCELLED' || refundSummary) && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <RotateCcw size={18} color="#dc2626" />
              <div style={{ fontSize: '13px', color: '#991b1b' }}>
                <strong>Appointment Cancelled.</strong> {refundSummary || 'Slot has been released.'}
              </div>
            </div>
          )}

          {appt.chiefComplaint && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#52736d', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                Reported concern
              </div>
              <div style={{ fontSize: '14px', color: '#0b3f3a', lineHeight: 1.5 }}>{appt.chiefComplaint}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {details?.canJoinCall && appt.consultationType === 'VIDEO' && (
              <button
                onClick={() => navigate(`/consultation/${appt.id}`)}
                className="btn btn-primary hover-lift"
                style={{
                  backgroundColor: '#10b981', borderColor: '#10b981',
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                }}
              >
                <Video size={16} /> Enter Video Consultation
              </button>
            )}
            {appt.consultationType === 'VIDEO' && appt.status === 'COMPLETED' && (
              <button
                onClick={() => navigate(`/consultation/${appt.id}`)}
                className="btn btn-primary hover-lift"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <FileText size={16} /> View Consultation Summary
              </button>
            )}
            {(details?.key === 'EXPIRED' || details?.key === 'CANCELLED') && (
              <button
                onClick={() => navigate('/book')}
                className="btn btn-primary hover-lift"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Calendar size={16} /> Book New Consultation
              </button>
            )}

            {/* 1-Click Invoice Download for Completed Consultations */}
            {appt.status === 'COMPLETED' && (
              <button
                onClick={() => handleDownloadInvoice(appt.id)}
                disabled={busyActionId === `inv-${appt.id}`}
                className="btn btn-secondary hover-lift"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                {busyActionId === `inv-${appt.id}` ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />}
                Download Invoice (PDF)
              </button>
            )}

            {/* 1-Click Download Prescription PDF & Order Medicines */}
            {prescriptions.filter(p => p.status === 'SIGNED').map(rx => (
              <React.Fragment key={rx.id}>
                <button
                  onClick={() => handleDownloadRx(rx.id)}
                  disabled={busyActionId === `rx-${rx.id}`}
                  className="btn btn-primary hover-lift"
                  style={{
                    backgroundColor: '#0f766e', borderColor: '#0f766e',
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                  }}
                >
                  {busyActionId === `rx-${rx.id}` ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Download Prescription (PDF)
                </button>

                {rx.items && rx.items.length > 0 && (
                  <button
                    onClick={() => handleOrderMedicines(rx)}
                    disabled={busyActionId === `order-${rx.id}`}
                    className="btn hover-lift"
                    style={{
                      background: '#f0fdf4', color: '#166534',
                      border: '1px solid #bbf7d0',
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      fontWeight: 600,
                    }}
                  >
                    {busyActionId === `order-${rx.id}` ? <Loader2 size={16} className="animate-spin" /> : <ShoppingBag size={16} />}
                    Order Prescribed Medicines
                  </button>
                )}
              </React.Fragment>
            ))}

            <button
              onClick={() => navigate('/prescriptions')}
              className="btn btn-secondary hover-lift"
            >
              View all prescriptions
            </button>
            {canReschedule && (
              <button
                onClick={() => setIsRescheduleModalOpen(true)}
                className="btn btn-secondary hover-lift"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CalendarClock size={14} /> Reschedule
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="btn btn-secondary hover-lift"
                style={{
                  color: '#dc2626',
                  borderColor: 'rgba(220,38,38,0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <XCircle size={14} /> Cancel & Refund Policy
              </button>
            )}
          </div>

          {appt.rescheduleCount != null && appt.rescheduleCount > 0 && (
            <div style={{
              marginTop: 14, fontSize: 12, color: '#8aa39d',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <CalendarClock size={12} />
              Rescheduled {appt.rescheduleCount}
              {appt.rescheduleCount === 1 ? ' time' : ' times'}
              {appt.lastRescheduledAt && ` · last change ${new Date(appt.lastRescheduledAt).toLocaleDateString()}`}
            </div>
          )}
        </div>
      )}

      {/* Cancellation & Tiered Refund Modal */}
      {appt && (
        <CancelRefundModal
          isOpen={isCancelModalOpen}
          appointmentId={appt.id}
          doctorName={appt.doctorName}
          slotTimeStr={formatSlot(appt.slotAt)}
          onClose={() => setIsCancelModalOpen(false)}
          onSuccess={(res) => {
            setAppt(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
            setRefundSummary(`Refund processed: ₹${(res.refundAmountPaise / 100).toFixed(2)} (${res.refundPercentage}% refund under tier ${res.tier}).`);
          }}
        />
      )}

      {/* Reschedule modal — pick a new slot on the same doctor */}
      {appt && isRescheduleModalOpen && (
        <SlotPickerModal
          isOpen={isRescheduleModalOpen}
          doctorId={appt.doctorId}
          doctorName={appt.doctorName}
          title="Reschedule appointment"
          confirmLabel="Confirm new time"
          excludeSlotId={appt.slotId}
          onClose={() => setIsRescheduleModalOpen(false)}
          onConfirm={async (newSlotId) => {
            const updated = await appointmentsApi.reschedule(appt.id, newSlotId);
            setAppt(updated);
          }}
        />
      )}
    </PageTransition>
  );
};
