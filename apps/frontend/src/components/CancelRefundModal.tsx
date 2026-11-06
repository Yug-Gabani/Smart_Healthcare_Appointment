import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  FlaskConical,
} from 'lucide-react';
import {
  paymentsApi,
  type RefundPreviewResponse,
  type CancelAndRefundResponse,
  type RefundTier,
} from '../services/api';

interface CancelRefundModalProps {
  isOpen: boolean;
  appointmentId: string;
  doctorName?: string;
  slotTimeStr?: string;
  onClose: () => void;
  onSuccess?: (result: CancelAndRefundResponse) => void;
}

export const CancelRefundModal: React.FC<CancelRefundModalProps> = ({
  isOpen,
  appointmentId,
  doctorName,
  slotTimeStr,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<RefundPreviewResponse | null>(null);
  const [result, setResult] = useState<CancelAndRefundResponse | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Simulation mode for easy testing of all 4 policy tiers
  const [simulatedHours, setSimulatedHours] = useState<number | undefined>(undefined);

  const fetchPreview = async (hours?: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await paymentsApi.getRefundPreview(appointmentId, hours);
      setPreview(res);
    } catch (err: any) {
      setError(err.message || 'Could not fetch refund preview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && appointmentId) {
      setResult(null);
      setReason('');
      setSimulatedHours(undefined);
      fetchPreview();
    }
  }, [isOpen, appointmentId]);

  const handleSimulateChange = (hours: number | undefined) => {
    setSimulatedHours(hours);
    fetchPreview(hours);
  };

  const handleConfirmCancel = async () => {
    try {
      setCancelling(true);
      setError(null);
      const res = await paymentsApi.cancelAndRefund(appointmentId, {
        reason: reason.trim() || undefined,
        simulatedHoursRemaining: simulatedHours,
      });
      setResult(res);
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process cancellation and refund.');
    } finally {
      setCancelling(false);
    }
  };

  const copyRefundId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (!isOpen) return null;

  const originalPaise = preview?.originalAmountPaise ?? 0;
  const refundPaise = preview?.refundAmountPaise ?? 0;
  const retentionPaise = preview?.retentionAmountPaise ?? 0;
  const currentTier = preview?.tier ?? 'FULL_100';

  const tierColors: Record<RefundTier, { bg: string; border: string; text: string; badge: string }> = {
    FULL_100: { bg: '#ecfdf5', border: '#10b981', text: '#065f46', badge: '#d1fae5' },
    PARTIAL_50: { bg: '#fefce8', border: '#eab308', text: '#854d0e', badge: '#fef08a' },
    PARTIAL_25: { bg: '#fff7ed', border: '#f97316', text: '#9a3412', badge: '#ffedd5' },
    NO_REFUND_0: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', badge: '#fee2e2' },
    FREE_CONSULTATION: { bg: '#f0fdfa', border: '#14b8a6', text: '#115e59', badge: '#ccfbf1' },
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !cancelling) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          animation: 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: result ? '#ecfdf5' : '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: result ? '#10b981' : '#dc2626',
              }}
            >
              {result ? <CheckCircle2 size={20} /> : <RotateCcw size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                {result ? 'Cancellation & Refund Summary' : 'Cancel Appointment & Refund'}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Tiered cancellation policy with automatic Razorpay refund processing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={cancelling}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px' }}>
          {error && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '12px 16px',
                color: '#dc2626',
                fontSize: '13px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{error}</div>
            </div>
          )}

          {/* Success State View */}
          {result ? (
            <div>
              <div
                style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '16px',
                  padding: '20px',
                  textAlign: 'center',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <CheckCircle2 size={28} />
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: '#065f46' }}>
                  Appointment Cancelled
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#047857' }}>
                  Doctor slot has been freed and your refund transaction is confirmed.
                </p>
              </div>

              {/* Refund Transaction Details */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Refund Status:</span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#065f46',
                      backgroundColor: '#d1fae5',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {result.refundStatus}
                  </span>
                </div>

                {result.refundId && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Razorpay Refund ID:</span>
                    <button
                      onClick={() => copyRefundId(result.refundId!)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        color: '#0f766e',
                        background: '#f0fdfa',
                        border: '1px solid #ccfbf1',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      {result.refundId}
                      {copiedId ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Policy Applied:</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                    {result.refundPercentage}% Refund ({result.tier})
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px dashed #cbd5e1',
                    fontSize: '15px',
                    fontWeight: 700,
                  }}
                >
                  <span style={{ color: '#0f172a' }}>Amount Refunded:</span>
                  <span style={{ color: '#0f766e' }}>₹{(result.refundAmountPaise / 100).toFixed(2)}</span>
                </div>
              </div>

              {/* Policy explanation notice */}
              <div
                style={{
                  backgroundColor: '#f1f5f9',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '12px',
                  color: '#475569',
                  marginBottom: '20px',
                  lineHeight: 1.5,
                }}
              >
                <strong>Note:</strong> {result.policyMessage}
                <div style={{ marginTop: '4px', color: '#64748b' }}>
                  In Razorpay Test Mode, this refund is registered on your merchant test ledger with instant simulation.
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: '#0f766e',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Close & Return
              </button>
            </div>
          ) : (
            /* Confirmation Form */
            <div>
              {loading ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  <Loader2 size={24} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
                  Calculating refund policy tier…
                </div>
              ) : (
                <div>
                  {/* Appointment info bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      marginBottom: '16px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                        {doctorName || preview?.doctorName || 'Doctor Appointment'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {slotTimeStr || (preview?.slotAt ? new Date(preview.slotAt).toLocaleString() : 'Scheduled Visit')}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        color: '#0f766e',
                        backgroundColor: '#f0fdfa',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontWeight: 600,
                      }}
                    >
                      <Clock size={14} />
                      {preview?.hoursRemaining !== undefined
                        ? `${preview.hoursRemaining.toFixed(1)} hrs left`
                        : 'Upcoming'}
                    </div>
                  </div>

                  {/* 🧪 Test Mode Simulation Switcher */}
                  <div
                    style={{
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: '14px',
                      padding: '12px 14px',
                      marginBottom: '18px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#0369a1',
                        marginBottom: '8px',
                      }}
                    >
                      <FlaskConical size={14} />
                      🧪 Test Mode: Simulate Cancellation Windows
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {[
                        { label: 'Real Slot Time', hours: undefined },
                        { label: '1 Day Before (>24h → 100%)', hours: 30 },
                        { label: '18h Before (12-24h → 50%)', hours: 18 },
                        { label: '8h Before (6-12h → 25%)', hours: 8 },
                        { label: '2h Before (<6h → 0%)', hours: 2 },
                      ].map((item, idx) => {
                        const isSelected = simulatedHours === item.hours;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSimulateChange(item.hours)}
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '5px 10px',
                              borderRadius: '8px',
                              border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                              backgroundColor: isSelected ? '#0284c7' : '#ffffff',
                              color: isSelected ? '#ffffff' : '#475569',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Visual Policy Meter (4 Tiers) */}
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                      Clinic Cancellation Refund Policy:
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '6px',
                      }}
                    >
                      {[
                        { label: '>24 Hours', pct: '100%', sub: 'Full Refund', tier: 'FULL_100', color: '#10b981' },
                        { label: '12-24 Hrs', pct: '50%', sub: 'Half Refund', tier: 'PARTIAL_50', color: '#eab308' },
                        { label: '6-12 Hrs', pct: '25%', sub: 'Quarter Refund', tier: 'PARTIAL_25', color: '#f97316' },
                        { label: '<6 Hours', pct: '0%', sub: 'No Refund', tier: 'NO_REFUND_0', color: '#ef4444' },
                      ].map((t) => {
                        const isCurrent = currentTier === t.tier;
                        return (
                          <div
                            key={t.tier}
                            style={{
                              border: isCurrent ? `2px solid ${t.color}` : '1px solid #e2e8f0',
                              backgroundColor: isCurrent ? '#ffffff' : '#f8fafc',
                              borderRadius: '10px',
                              padding: '10px 8px',
                              textAlign: 'center',
                              boxShadow: isCurrent ? `0 4px 12px -2px ${t.color}33` : 'none',
                              position: 'relative',
                            }}
                          >
                            {isCurrent && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '-8px',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  backgroundColor: t.color,
                                  color: '#fff',
                                  fontSize: '9px',
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: '9999px',
                                  letterSpacing: '0.04em',
                                  textTransform: 'uppercase',
                                }}
                              >
                                Your Tier
                              </div>
                            )}
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{t.label}</div>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: t.color, margin: '2px 0' }}>
                              {t.pct}
                            </div>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{t.sub}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dynamic Tier Highlight Card */}
                  <div
                    style={{
                      backgroundColor: tierColors[currentTier]?.bg || '#f8fafc',
                      border: `1.5px solid ${tierColors[currentTier]?.border || '#cbd5e1'}`,
                      borderRadius: '14px',
                      padding: '14px 18px',
                      marginBottom: '18px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      {currentTier === 'NO_REFUND_0' ? (
                        <ShieldAlert size={18} color="#ef4444" />
                      ) : (
                        <CheckCircle2 size={18} color={tierColors[currentTier]?.border || '#10b981'} />
                      )}
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: tierColors[currentTier]?.text || '#0f172a',
                        }}
                      >
                        {preview?.tier === 'FULL_100' && '🟢 100% Full Refund Eligible'}
                        {preview?.tier === 'PARTIAL_50' && '🟡 50% Partial Refund Eligible'}
                        {preview?.tier === 'PARTIAL_25' && '🟠 25% Partial Refund Eligible'}
                        {preview?.tier === 'NO_REFUND_0' && '🔴 Non-Refundable (0% Refund)'}
                        {preview?.tier === 'FREE_CONSULTATION' && '⚪ Complimentary Consultation (₹0 Paid)'}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: tierColors[currentTier]?.text || '#475569',
                        lineHeight: 1.5,
                      }}
                    >
                      {preview?.policyMessage}
                    </div>
                  </div>

                  {/* Financial Calculation Breakdown */}
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '14px 18px',
                      backgroundColor: '#f8fafc',
                      marginBottom: '18px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                        color: '#64748b',
                        marginBottom: '8px',
                      }}
                    >
                      <span>Original Paid Fee:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        ₹{(originalPaise / 100).toFixed(2)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                        color: '#64748b',
                        marginBottom: '8px',
                      }}
                    >
                      <span>Clinic Retention / Fee:</span>
                      <span style={{ fontWeight: 600, color: retentionPaise > 0 ? '#dc2626' : '#64748b' }}>
                        -₹{(retentionPaise / 100).toFixed(2)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        paddingTop: '10px',
                        borderTop: '1px dashed #cbd5e1',
                        fontSize: '15px',
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ color: '#0f172a' }}>Total Credit Back:</span>
                      <span style={{ color: refundPaise > 0 ? '#0f766e' : '#64748b' }}>
                        ₹{(refundPaise / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Reason Input */}
                  <div style={{ marginBottom: '20px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#475569',
                        marginBottom: '6px',
                      }}
                    >
                      Cancellation Reason (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Personal schedule change, resolved symptoms"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={cancelling}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '12px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#475569',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      Keep Appointment
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmCancel}
                      disabled={cancelling || !preview?.canCancel}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '12px',
                        backgroundColor: '#dc2626',
                        border: 'none',
                        color: '#ffffff',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: cancelling ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      {cancelling ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Processing Refund…
                        </>
                      ) : (
                        <>Confirm & Process Refund</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
