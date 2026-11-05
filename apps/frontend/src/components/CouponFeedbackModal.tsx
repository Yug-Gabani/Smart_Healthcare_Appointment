import React, { useEffect, useRef } from 'react';
import {
  Sparkles,
  AlertTriangle,
  X,
  Tag,
  Ticket,
  ArrowRight,
} from 'lucide-react';
import type { DiscountCoupon } from './PatientTriageBooking';
import { TEST_COUPONS } from './PatientTriageBooking';

export interface CouponSuccessData {
  coupon: DiscountCoupon;
  discountPaise: number;
  payablePaise: number;
}

export interface CouponErrorData {
  attemptedCode: string;
  message: string;
}

interface CouponFeedbackModalProps {
  successData: CouponSuccessData | null;
  errorData: CouponErrorData | null;
  onClose: () => void;
  onSelectCoupon: (code: string) => void;
}

// Micro celebration confetti canvas
const MicroConfetti: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const width = (canvas.width = canvas.parentElement?.clientWidth || 460);
    const height = (canvas.height = canvas.parentElement?.clientHeight || 420);

    const colors = ['#0f766e', '#10b981', '#34d399', '#f59e0b', '#38bdf8', '#ec4899', '#8b5cf6'];
    const particles = Array.from({ length: 45 }).map(() => ({
      x: width * 0.5 + (Math.random() - 0.5) * 60,
      y: height * 0.25,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -7 - 3,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      opacity: 1,
    }));

    const start = Date.now();

    const loop = () => {
      const elapsed = Date.now() - start;
      if (elapsed > 2400) {
        ctx.clearRect(0, 0, width, height);
        return;
      }
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22;
        p.vx *= 0.98;
        p.rotation += p.vRot;
        if (elapsed > 1200) {
          p.opacity = Math.max(0, 1 - (elapsed - 1200) / 1200);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      animId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
        borderRadius: '24px',
      }}
    />
  );
};

export const CouponFeedbackModal: React.FC<CouponFeedbackModalProps> = ({
  successData,
  errorData,
  onClose,
  onSelectCoupon,
}) => {
  const isOpen = Boolean(successData || errorData);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 63, 58, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '470px',
          boxShadow: '0 25px 50px -12px rgba(15, 118, 110, 0.25), 0 0 0 1px rgba(15, 118, 110, 0.08)',
          overflow: 'hidden',
          animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* ================================================================= */}
        {/* SUCCESS POPUP STATE                                               */}
        {/* ================================================================= */}
        {successData && (
          <>
            <MicroConfetti />

            {/* Header banner */}
            <div
              style={{
                padding: '24px 24px 20px',
                background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
                color: '#ffffff',
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <Sparkles size={24} color="#34d399" />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 700,
                      color: '#a7f3d0',
                    }}
                  >
                    Coupon Verified
                  </div>
                  <h3 style={{ margin: '2px 0 0', fontSize: '19px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                    Discount Applied! 🎉
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s ease',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              {/* Ticket Voucher Card */}
              <div
                style={{
                  padding: '18px',
                  borderRadius: '16px',
                  backgroundColor: '#f0fdf4',
                  border: '1.5px dashed #86efac',
                  position: 'relative',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Ticket size={18} color="#15803d" />
                    <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 800, color: '#166534', letterSpacing: '0.04em' }}>
                      {successData.coupon.code}
                    </span>
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#15803d',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {successData.coupon.badge}
                  </span>
                </div>

                <div style={{ fontSize: '13px', color: '#166534', marginBottom: '14px', fontWeight: 500 }}>
                  {successData.coupon.description}
                </div>

                {/* Price Breakdown */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Standard Consultation Fee</span>
                    <span style={{ textDecoration: 'line-through' }}>₹500.00</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Tag size={13} />
                      Instant Savings
                    </span>
                    <span>-₹{(successData.discountPaise / 100).toFixed(2)}</span>
                  </div>
                  <div
                    style={{
                      borderTop: '1px dashed #cbd5e1',
                      paddingTop: '8px',
                      marginTop: '2px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>New Amount Payable</span>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: '#0f766e' }}>
                      {successData.payablePaise === 0 ? 'FREE (₹0.00)' : `₹${(successData.payablePaise / 100).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Call to action button */}
              <button
                type="button"
                onClick={onClose}
                className="btn btn-primary hover-lift"
                style={{
                  width: '100%',
                  padding: '13px 20px',
                  fontSize: '14px',
                  fontWeight: 700,
                  borderRadius: '14px',
                  backgroundColor: '#0f766e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(15, 118, 110, 0.3)',
                }}
              >
                <span>Continue with Discount</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* ERROR POPUP STATE                                                 */}
        {/* ================================================================= */}
        {errorData && !successData && (
          <>
            {/* Header banner */}
            <div
              style={{
                padding: '24px 24px 20px',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: '#ffffff',
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <AlertTriangle size={24} color="#fecaca" />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 700,
                      color: '#fecaca',
                    }}
                  >
                    Coupon Not Recognized
                  </div>
                  <h3 style={{ margin: '2px 0 0', fontSize: '19px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                    Invalid Coupon Code
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  marginBottom: '18px',
                }}
              >
                {errorData.attemptedCode ? (
                  <>
                    The coupon code <strong style={{ fontFamily: 'monospace', backgroundColor: '#fee2e2', padding: '1px 6px', borderRadius: '4px' }}>'{errorData.attemptedCode}'</strong> is invalid, expired, or has typo errors.
                  </>
                ) : (
                  errorData.message
                )}
              </div>

              {/* Recommendation Shelf */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  💡 Try One of These Active Test Coupons:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {TEST_COUPONS.map((coupon) => (
                    <button
                      key={coupon.code}
                      type="button"
                      onClick={() => onSelectCoupon(coupon.code)}
                      className="hover-lift"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#0f766e';
                        e.currentTarget.style.backgroundColor = '#f0fdf9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Tag size={14} color="#0f766e" />
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '13px', color: '#0f766e' }}>
                          {coupon.code}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          — {coupon.description}
                        </span>
                      </div>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                          fontWeight: 700,
                          fontSize: '11px',
                        }}
                      >
                        {coupon.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action row */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  Close &amp; Re-type
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
