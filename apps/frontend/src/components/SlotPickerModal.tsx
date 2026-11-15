import React, { useEffect, useMemo, useState } from 'react';
import { X, Calendar, Clock, Loader2, AlertCircle, Video, MapPin } from 'lucide-react';
import { doctorsApi } from '../services/api';
import type { Slot, ConsultationType } from '../types';

/**
 * Reusable slot-picker. Used by both Reschedule (same doctor, new time) and
 * Follow-up (same doctor from prescription, new consult). Caller controls what
 * happens on confirm via `onConfirm`.
 *
 * - Fetches open slots for the doctor on mount, groups them by date.
 * - Lets the caller optionally hide the consultation-type toggle (reschedule
 *   keeps the original mode; follow-up asks the patient to pick).
 */
interface Props {
  isOpen: boolean;
  doctorId: string;
  doctorName?: string;
  title: string;
  confirmLabel: string;
  excludeSlotId?: string;
  showConsultationTypeToggle?: boolean;
  defaultConsultationType?: ConsultationType;
  onClose: () => void;
  onConfirm: (slotId: string, consultationType: ConsultationType) => Promise<void>;
}

function formatDateHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export const SlotPickerModal: React.FC<Props> = ({
  isOpen,
  doctorId,
  doctorName,
  title,
  confirmLabel,
  excludeSlotId,
  showConsultationTypeToggle = false,
  defaultConsultationType = 'VIDEO',
  onClose,
  onConfirm,
}) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [consultationType, setConsultationType] = useState<ConsultationType>(defaultConsultationType);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    setSelectedSlotId(null);
    doctorsApi
      .slots(doctorId)
      .then(fetched => {
        const future = fetched.filter(s => !s.booked && s.id !== excludeSlotId);
        setSlots(future);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load slots'))
      .finally(() => setLoading(false));
  }, [isOpen, doctorId, excludeSlotId]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Slot[]> = {};
    for (const s of slots) {
      if (!s.slotAt) continue;
      const dateKey = new Date(s.slotAt).toISOString().slice(0, 10);
      (groups[dateKey] = groups[dateKey] || []).push(s);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const handleConfirm = async () => {
    if (!selectedSlotId) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(selectedSlotId, consultationType);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete the request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(11, 63, 58, 0.45)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff', width: '100%', maxWidth: 520,
          maxHeight: '85vh', overflowY: 'auto',
          borderRadius: 16, border: '1px solid #e3eceb',
          boxShadow: '0 10px 40px rgba(11, 63, 58, 0.2)',
        }}
      >
        <div style={{
          position: 'sticky', top: 0, background: '#ffffff', zIndex: 2,
          padding: '20px 24px 16px', borderBottom: '1px solid #e3eceb',
          display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0b3f3a', margin: '0 0 2px' }}>
              {title}
            </h2>
            {doctorName && (
              <div style={{ fontSize: 13, color: '#8aa39d' }}>with {doctorName}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8aa39d', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {showConsultationTypeToggle && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['VIDEO', 'IN_PERSON'] as ConsultationType[]).map(ct => {
                const active = consultationType === ct;
                return (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setConsultationType(ct)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: active ? '1px solid #0f766e' : '1px solid #e3eceb',
                      background: active ? '#ecfdf5' : '#ffffff',
                      color: active ? '#0f766e' : '#4c6360',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {ct === 'VIDEO' ? <Video size={14} /> : <MapPin size={14} />}
                    {ct === 'VIDEO' ? 'Video consult' : 'In-person'}
                  </button>
                );
              })}
            </div>
          )}

          {loading && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#8aa39d' }}>
              <Loader2 size={20} className="animate-spin" style={{ display: 'inline', marginRight: 8 }} />
              Loading available slots…
            </div>
          )}

          {!loading && !error && slots.length === 0 && (
            <div style={{
              padding: 20, border: '1px dashed #e3eceb', borderRadius: 12,
              color: '#8aa39d', fontSize: 13, textAlign: 'center',
            }}>
              No open slots are currently available for this doctor.
            </div>
          )}

          {!loading && groupedByDate.map(([dateKey, daySlots]) => (
            <div key={dateKey} style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 500, color: '#8aa39d',
                marginBottom: 8, textTransform: 'none',
              }}>
                <Calendar size={13} />
                {formatDateHeading(dateKey)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {daySlots.map(s => {
                  const selected = s.id === selectedSlotId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSlotId(s.id)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: selected ? '1px solid #0f766e' : '1px solid #e3eceb',
                        background: selected ? '#0f766e' : '#ffffff',
                        color: selected ? '#ffffff' : '#0b3f3a',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <Clock size={12} />
                      {formatTime(s.slotAt)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {error && (
            <div
              role="alert"
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '10px 12px', background: '#fef2f2', color: '#991b1b',
                border: '1px solid #fecaca', borderRadius: 10,
                fontSize: 13, lineHeight: 1.5, marginTop: 12,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div style={{
          position: 'sticky', bottom: 0, background: '#ffffff', zIndex: 2,
          padding: '14px 24px', borderTop: '1px solid #e3eceb',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '10px 16px', borderRadius: 10,
              background: '#ffffff', color: '#4c6360',
              border: '1px solid #e3eceb',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedSlotId || submitting}
            style={{
              padding: '10px 18px', borderRadius: 10,
              background: !selectedSlotId || submitting ? '#a7d4cd' : '#0f766e',
              color: '#ffffff', border: 'none',
              fontSize: 13, fontWeight: 600,
              cursor: !selectedSlotId || submitting ? 'default' : 'pointer',
            }}
          >
            {submitting ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SlotPickerModal;
