import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CalendarPlus,
  Camera,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Lock,
  Mail,
  MapPin,
  Mic,
  Phone,
  Printer,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Video,
  X,
  Zap,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import type { Appointment, Attachment, Doctor, TriageAssessment, User } from '../types';
import { paymentsApi, type NotificationAuditLog } from '../services/api';
import { PageTransition } from '../motion/PageTransition';
import { PipelineAuditModal } from './PipelineAuditModal';
import { CancelRefundModal } from './CancelRefundModal';

interface PaymentInfo {
  orderId: string;
  paymentId: string;
  amountPaise: number;
  status: string;
  pdfUrl: string;
}

export interface AppliedCouponInfo {
  code: string;
  discountRupees: number;
  discountLabel: string;
}

interface AppointmentConfirmedViewProps {
  confirmed: Appointment;
  paymentInfo: PaymentInfo | null;
  currentUser: User | null;
  patientPhone: string;
  selectedDoctor: Doctor | null;
  assessment: TriageAssessment | null;
  uploadedAttachments: Attachment[];
  appliedCoupon?: AppliedCouponInfo | null;
  onReset: () => void;
}

// ---------------------------------------------------------------------------
// Confetti Animation Canvas (Zero-dependency, lightweight celebration burst)
// ---------------------------------------------------------------------------
const ConfettiBurst: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const colors = ['#0f766e', '#2dd4bf', '#ff6b5b', '#f59e0b', '#38bdf8', '#10b981', '#6366f1'];
    const particles = Array.from({ length: 60 }).map(() => ({
      x: width * 0.5 + (Math.random() - 0.5) * 200,
      y: height * 0.2 + (Math.random() - 0.5) * 100,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -10 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10,
      opacity: 1,
    }));

    const startTime = Date.now();

    const render = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > 3500) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28; // gravity
        p.vx *= 0.98; // air drag
        p.rotation += p.vRot;
        if (elapsed > 2000) {
          p.opacity = Math.max(0, 1 - (elapsed - 2000) / 1500);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Camera & Mic Device Test Modal
// ---------------------------------------------------------------------------
interface DeviceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DeviceTestModal: React.FC<DeviceTestModalProps> = ({ isOpen, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micActive, setMicActive] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
      }
      return;
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        setStream(mediaStream);
        setCameraActive(true);
        setMicActive(true);
        setErrorMsg(null);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => {
        console.warn('Device test error:', err);
        setErrorMsg('Camera or Microphone access was not permitted. Please allow permissions in your browser bar.');
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 63, 58, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(11, 63, 58, 0.25)',
          border: '1px solid #d9ece7',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #d9ece7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f0fdf9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(15, 118, 110, 0.15)',
                color: '#0f766e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Video size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0b3f3a' }}>
                Camera & Audio Pre-Flight Check
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#52736d' }}>
                Verify your hardware before your teleconsultation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#8aa39d',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {errorMsg ? (
            <div
              style={{
                padding: '20px',
                borderRadius: '14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              <strong>Hardware Access Notice:</strong> {errorMsg}
            </div>
          ) : (
            <>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16/9',
                  borderRadius: '14px',
                  backgroundColor: '#0b3f3a',
                  overflow: 'hidden',
                  marginBottom: '18px',
                  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)', // mirror preview
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(0, 0, 0, 0.65)',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 600,
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        boxShadow: '0 0 8px #10b981',
                      }}
                    />
                    Live HD Feed
                  </span>
                </div>
              </div>

              {/* Status Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: cameraActive ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${cameraActive ? '#bbf7d0' : '#fecaca'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Camera size={18} color={cameraActive ? '#16a34a' : '#dc2626'} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: cameraActive ? '#166534' : '#dc2626' }}>
                      Camera Active
                    </div>
                    <div style={{ fontSize: '11px', color: '#52736d' }}>HD 720p / 1080p Ready</div>
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: micActive ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${micActive ? '#bbf7d0' : '#fecaca'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Mic size={18} color={micActive ? '#16a34a' : '#dc2626'} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: micActive ? '#166534' : '#dc2626' }}>
                      Microphone Active
                    </div>
                    <div style={{ fontSize: '11px', color: '#52736d' }}>Echo Cancellation On</div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button onClick={onClose} className="btn btn-primary" style={{ width: '100%' }}>
              <Check size={16} /> Everything Looks &amp; Sounds Great
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers: Google Calendar & iCal Download
// ---------------------------------------------------------------------------
function getGoogleCalendarUrl(appt: Appointment, docName: string, hospital: string): string {
  if (!appt.slotAt) return '#';
  const start = new Date(appt.slotAt);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const toUtc = (d: Date) =>
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z';

  const title = encodeURIComponent(`PulseCare Consultation: ${docName}`);
  const details = encodeURIComponent(
    `PulseCare Medical Consultation with ${docName} (${appt.doctorSpecialty || 'Specialist'}).\n\n` +
      `Mode: ${appt.consultationType === 'VIDEO' ? 'Encrypted Video Telehealth' : 'In-Person Hospital Visit'}\n` +
      `Facility: ${hospital}\nTriage Classification: ${appt.urgency}`
  );
  const loc = encodeURIComponent(
    appt.consultationType === 'VIDEO' ? 'PulseCare Telehealth Virtual Room' : hospital
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${toUtc(start)}/${toUtc(end)}&details=${details}&location=${loc}`;
}

function downloadIcsCalendar(appt: Appointment, docName: string, hospital: string) {
  if (!appt.slotAt) return;
  const start = new Date(appt.slotAt);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const toUtc = (d: Date) =>
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z';

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PulseCare Health//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:pulsecare-${appt.id}@pulsecare.health`,
    `DTSTAMP:${toUtc(new Date())}`,
    `DTSTART:${toUtc(start)}`,
    `DTEND:${toUtc(end)}`,
    `SUMMARY:PulseCare Consultation with ${docName}`,
    `DESCRIPTION:PulseCare Medical Consultation with ${docName} (${appt.doctorSpecialty}). Facility: ${hospital}`,
    `LOCATION:${appt.consultationType === 'VIDEO' ? 'PulseCare Video Telehealth' : hospital}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pulsecare-appointment-${appt.id.slice(0, 8)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDetailDate(iso?: string): { dayName: string; dateStr: string; timeStr: string } {
  if (!iso) return { dayName: 'Upcoming', dateStr: 'Confirmed Slot', timeStr: '10:00 AM' };
  const d = new Date(iso);
  const dayName = d.toLocaleDateString(undefined, { weekday: 'long' });
  const dateStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return { dayName, dateStr, timeStr };
}

// ---------------------------------------------------------------------------
// Main Component: AppointmentConfirmedView
// ---------------------------------------------------------------------------
export const AppointmentConfirmedView: React.FC<AppointmentConfirmedViewProps> = ({
  confirmed,
  paymentInfo,
  currentUser,
  patientPhone,
  selectedDoctor,
  assessment,
  uploadedAttachments,
  appliedCoupon,
  onReset,
}) => {
  const navigate = useNavigate();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testModalOpen, setTestModalOpen] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<NotificationAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [refundResult, setRefundResult] = useState<any>(null);

  const fetchAuditLogs = () => {
    const targetOrderId = paymentInfo?.orderId || confirmed.id;
    if (!targetOrderId) return;
    setAuditLoading(true);
    paymentsApi
      .getNotificationAudit(targetOrderId)
      .then((logs) => setAuditLogs(logs))
      .catch((err) => console.warn('Failed to load audit logs:', err))
      .finally(() => setAuditLoading(false));
  };

  useEffect(() => {
    fetchAuditLogs();
    const interval = setInterval(fetchAuditLogs, 3000);
    return () => clearInterval(interval);
  }, [paymentInfo?.orderId, confirmed.id]);

  const amountRupees = paymentInfo ? (paymentInfo.amountPaise / 100).toFixed(2) : '500.00';
  const isFree = paymentInfo ? paymentInfo.amountPaise === 0 : false;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const docName = confirmed.doctorName || selectedDoctor?.fullName || selectedDoctor?.name || 'Dr. Specialist';
  const specialty = confirmed.doctorSpecialty || selectedDoctor?.specialty || 'General Practitioner';
  const hospital = confirmed.doctorHospital || selectedDoctor?.hospital || 'PulseCare Health Center';
  const avatarUrl =
    confirmed.doctorAvatarUrl ||
    selectedDoctor?.avatarUrl ||
    selectedDoctor?.avatar ||
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80';

  const dateDetails = formatDetailDate(confirmed.slotAt);
  const invoiceId = paymentInfo?.orderId
    ? `INV-${paymentInfo.orderId.replace('order_', '').slice(0, 8).toUpperCase()}`
    : `INV-${confirmed.id.slice(0, 8).toUpperCase()}`;

  const meetingLink = `https://pulsecare.health/room/${confirmed.id.slice(0, 8)}`;

  const urgencyBg = (urgency?: string) => {
    switch (urgency) {
      case 'EMERGENCY':
        return '#fef2f2';
      case 'URGENT':
        return '#fffbeb';
      default:
        return '#f0fdf4';
    }
  };

  const urgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'EMERGENCY':
        return '#dc2626';
      case 'URGENT':
        return '#b45309';
      default:
        return '#15803d';
    }
  };

  return (
    <PageTransition>
      <ConfettiBurst />
      <DeviceTestModal isOpen={testModalOpen} onClose={() => setTestModalOpen(false)} />
      <PipelineAuditModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        orderId={paymentInfo?.orderId || confirmed.id}
        auditLogs={auditLogs}
        loading={auditLoading}
        onRefresh={fetchAuditLogs}
      />
      <CancelRefundModal
        isOpen={cancelModalOpen}
        appointmentId={confirmed.id}
        doctorName={selectedDoctor?.fullName}
        slotTimeStr={confirmed.slotAt ? new Date(confirmed.slotAt).toLocaleString() : 'Today'}
        onClose={() => setCancelModalOpen(false)}
        onSuccess={(res) => {
          setRefundResult(res);
          fetchAuditLogs();
        }}
      />

      <div style={{ maxWidth: '1060px', margin: '40px auto 60px', padding: '0 20px' }}>
        {/* ========================================================================= */}
        {/* Top Celebratory Header & Status Badges */}
        {/* ========================================================================= */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          {/* Glowing Animated Icon */}
          <div
            style={{
              position: 'relative',
              width: '80px',
              height: '80px',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '-10px',
                borderRadius: '50%',
                backgroundColor: 'rgba(15, 118, 110, 0.12)',
                animation: 'pulse 2.5s infinite ease-in-out',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: '-20px',
                borderRadius: '50%',
                backgroundColor: 'rgba(15, 118, 110, 0.05)',
                animation: 'pulse 2.5s infinite 0.5s ease-in-out',
              }}
            />
            <div
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                backgroundColor: '#0f766e',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 28px rgba(15, 118, 110, 0.32)',
                position: 'relative',
                zIndex: 2,
              }}
            >
              <CheckCheck size={42} strokeWidth={2.4} />
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 16px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(15, 118, 110, 0.12)',
              color: '#0f766e',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}
          >
            <Sparkles size={14} /> Official Medical Booking Confirmed
          </div>

          <h1
            className="font-serif text-heading-lg"
            style={{ color: '#0b3f3a', fontSize: '36px', marginBottom: '10px' }}
          >
            You're All Set, {currentUser?.fullName?.split(' ')[0] || 'Patient'}!
          </h1>
          <p
            className="text-body"
            style={{ color: '#52736d', maxWidth: '640px', margin: '0 auto 20px', fontSize: '16px', lineHeight: 1.6 }}
          >
            Your consultation with <strong>{docName}</strong> is fully secured. Your clinical intake, payment
            verification, and diagnostic triage records are synchronized with the hospital system.
          </p>

          {/* Quick Badges Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: '#f0fdf4',
                color: '#166534',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid #bbf7d0',
              }}
            >
              <ShieldCheck size={15} color="#16a34a" /> {isFree ? '100% Free Consultation Verified' : `Razorpay Verified (₹${amountRupees} Paid)`}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: '#eff6ff',
                color: '#1e40af',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid #bfdbfe',
              }}
            >
              <Zap size={15} color="#2563eb" /> Kafka Event Streamed
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: '#faf5ff',
                color: '#7e22ce',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid #e9d5ff',
              }}
            >
              <Lock size={14} color="#9333ea" /> HIPAA 256-Bit Encrypted
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Main Two-Column Concierge Layout */}
        {/* ========================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '24px',
            marginBottom: '32px',
          }}
        >
          {/* --------------------------------------------------------------------- */}
          {/* COLUMN 1: Clinical Consultation Pass & Preparation */}
          {/* --------------------------------------------------------------------- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Doctor & Facility Pass */}
            <div
              className="card card-hover"
              style={{
                padding: '26px',
                borderRadius: '18px',
                backgroundColor: '#ffffff',
                border: '1px solid #d9ece7',
                boxShadow: '0 4px 18px rgba(20, 60, 55, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '20px' }}>
                <div style={{ position: 'relative' }}>
                  <img
                    src={avatarUrl}
                    alt={docName}
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #ccebe3',
                      boxShadow: '0 4px 12px rgba(15, 118, 110, 0.15)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      backgroundColor: '#0f766e',
                      color: '#ffffff',
                      borderRadius: '50%',
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                    }}
                    title="Verified Specialist Consultant"
                  >
                    <Check size={13} strokeWidth={3} />
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: '#0b3f3a' }}>{docName}</h3>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(15, 118, 110, 0.1)',
                        color: '#0f766e',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      ★ {selectedDoctor?.rating || 4.95}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f766e', marginTop: '2px' }}>
                    {specialty} Specialist
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      color: '#52736d',
                      marginTop: '4px',
                    }}
                  >
                    <MapPin size={13} color="#8aa39d" />
                    <span>{hospital}</span>
                  </div>
                </div>
              </div>

              {/* Slot Details Box */}
              <div
                style={{
                  backgroundColor: '#f0fdf9',
                  border: '1px solid #ccebe3',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      backgroundColor: '#0f766e',
                      color: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '13px',
                      lineHeight: 1.1,
                      boxShadow: '0 3px 8px rgba(15, 118, 110, 0.25)',
                    }}
                  >
                    <Calendar size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#52736d' }}>
                      {dateDetails.dayName}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0b3f3a' }}>{dateDetails.dateStr}</div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        color: '#0f766e',
                        fontWeight: 600,
                        marginTop: '2px',
                      }}
                    >
                      <Clock size={12} />
                      <span>{dateDetails.timeStr} IST · 30 min duration</span>
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    color: urgencyColor(confirmed.urgency),
                    backgroundColor: urgencyBg(confirmed.urgency),
                    border: `1px solid ${urgencyColor(confirmed.urgency)}33`,
                  }}
                >
                  {confirmed.urgency || 'ROUTINE'}
                </span>
              </div>

              {/* Add to Calendar Button Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <a
                  href={getGoogleCalendarUrl(confirmed, docName, hospital)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary hover-lift"
                  style={{
                    fontSize: '12px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    borderRadius: '10px',
                    border: '1px solid #ccebe3',
                    backgroundColor: '#ffffff',
                    color: '#0b3f3a',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <CalendarPlus size={14} color="#0f766e" />
                  Google Calendar
                </a>

                <button
                  type="button"
                  onClick={() => downloadIcsCalendar(confirmed, docName, hospital)}
                  className="btn btn-secondary hover-lift"
                  style={{
                    fontSize: '12px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    borderRadius: '10px',
                    border: '1px solid #ccebe3',
                    backgroundColor: '#ffffff',
                    color: '#0b3f3a',
                    fontWeight: 600,
                  }}
                >
                  <Download size={14} color="#0f766e" />
                  Apple / Outlook (.ics)
                </button>
              </div>
            </div>

            {/* Consultation Mode Interactive Box */}
            <div
              className="card card-hover"
              style={{
                padding: '22px 24px',
                borderRadius: '18px',
                backgroundColor: '#ffffff',
                border: '1px solid #d9ece7',
                boxShadow: '0 4px 18px rgba(20, 60, 55, 0.05)',
              }}
            >
              {confirmed.consultationType === 'VIDEO' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(15, 118, 110, 0.12)',
                        color: '#0f766e',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Video size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0b3f3a' }}>
                        Encrypted Video Telehealth Room
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#52736d' }}>
                        Peer-to-peer WebRTC consultation with end-to-end security
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '14px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <Lock size={13} color="#0f766e" />
                      <span
                        style={{
                          color: '#334155',
                          fontFamily: 'monospace',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {meetingLink}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(meetingLink, 'link')}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: copiedKey === 'link' ? '#16a34a' : '#0f766e',
                        fontWeight: 600,
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: copiedKey === 'link' ? '#dcfce7' : '#e0f2fe',
                      }}
                    >
                      {copiedKey === 'link' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedKey === 'link' ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTestModalOpen(true)}
                    className="btn btn-secondary hover-lift"
                    style={{
                      width: '100%',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderColor: '#0f766e',
                      color: '#0f766e',
                    }}
                  >
                    <Camera size={15} /> Test Camera &amp; Microphone Pre-Flight
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(255, 107, 91, 0.12)',
                        color: '#ff6b5b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0b3f3a' }}>
                        In-Person Clinic Visit
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#52736d' }}>
                        Facility: <strong>{hospital}</strong>
                      </p>
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary hover-lift"
                    style={{
                      width: '100%',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <ExternalLink size={15} /> Get Directions in Google Maps
                  </a>
                </>
              )}
            </div>

            {/* Pre-Visit Patient Checklist */}
            <div
              className="card"
              style={{
                padding: '20px 24px',
                borderRadius: '18px',
                backgroundColor: '#ffffff',
                border: '1px solid #d9ece7',
              }}
            >
              <h4
                style={{
                  margin: '0 0 14px',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#0b3f3a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Stethoscope size={16} color="#0f766e" /> Pre-Consultation Preparation Guide
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: '#52736d' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle2 size={15} color="#0f766e" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: '#0b3f3a' }}>Intake Triage Synced:</strong> Your symptoms and pain rating (
                    {assessment?.painLevel || 4}/10) are directly attached to {docName}'s clinical chart.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle2 size={15} color="#0f766e" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: '#0b3f3a' }}>Diagnostic Files:</strong>{' '}
                    {uploadedAttachments.length > 0
                      ? `${uploadedAttachments.length} document(s) uploaded and available for consultation.`
                      : 'No previous reports uploaded. You may upload them anytime before your slot.'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle2 size={15} color="#0f766e" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: '#0b3f3a' }}>Early Check-In:</strong> Please connect 5 minutes early. The
                    waiting room unlocks 10 minutes before the scheduled time.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* COLUMN 2: Medical Tax Invoice & Multi-Channel Delivery Hub */}
          {/* --------------------------------------------------------------------- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Digital Medical Tax Invoice Card */}
            <div
              className="card card-hover"
              style={{
                borderRadius: '18px',
                backgroundColor: '#ffffff',
                border: '1px solid #d9ece7',
                boxShadow: '0 4px 18px rgba(20, 60, 55, 0.06)',
                overflow: 'hidden',
              }}
            >
              {/* Receipt Header Ribbon */}
              <div
                style={{
                  padding: '18px 24px',
                  backgroundColor: '#0b3f3a',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#a7f3d0',
                      fontWeight: 700,
                    }}
                  >
                    PulseCare Health System
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>Official Medical Receipt</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#a7f3d0' }}>Receipt No</div>
                  <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 700 }}>{invoiceId}</div>
                </div>
              </div>

              {/* Receipt Body */}
              <div style={{ padding: '22px 24px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: '#52736d',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px dashed #d9ece7',
                  }}
                >
                  <div>
                    <strong>Patient:</strong> {currentUser?.fullName || 'PulseCare Patient'}
                  </div>
                  <div>
                    <strong>Date:</strong> {new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </div>
                </div>

                {/* Line Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0b3f3a' }}>
                    <span>Specialist Consultation ({specialty})</span>
                    <span style={{ fontWeight: 600 }}>₹500.00</span>
                  </div>

                  {appliedCoupon && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: '#166534',
                        backgroundColor: '#f0fdf4',
                        padding: '7px 12px',
                        borderRadius: '8px',
                        border: '1px solid #bbf7d0',
                        fontSize: '12px',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        🏷️ Discount Coupon ({appliedCoupon.code} • {appliedCoupon.discountLabel})
                      </span>
                      <span style={{ fontWeight: 700 }}>-₹{appliedCoupon.discountRupees.toFixed(2)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#52736d' }}>
                    <span>Triage Intake &amp; Advisory Routing</span>
                    <span style={{ color: '#0f766e', fontWeight: 600 }}>Included</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#52736d' }}>
                    <span>Telehealth Video &amp; Encrypted Platform</span>
                    <span>
                      <span style={{ textDecoration: 'line-through', marginRight: '6px', color: '#8aa39d' }}>
                        ₹150.00
                      </span>
                      <strong style={{ color: '#0f766e' }}>FREE</strong>
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#52736d' }}>
                    <span>OpenPDF Archival &amp; Tax Receipt</span>
                    <span style={{ color: '#0f766e', fontWeight: 600 }}>Included</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#52736d' }}>
                    <span>GST (Healthcare Exemption Under Sec 66D)</span>
                    <span>₹0.00</span>
                  </div>

                  <div
                    style={{
                      marginTop: '8px',
                      paddingTop: '12px',
                      borderTop: '2px solid #d9ece7',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0b3f3a' }}>Total Amount Paid</div>
                      <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                        {isFree ? '✓ 100% Free Consultation' : '✓ Paid via Razorpay Gateway'}
                      </div>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f766e' }}>₹{amountRupees}</div>
                  </div>
                </div>

                {/* Gateway Audit Trail */}
                {paymentInfo && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: '11px',
                      color: '#475569',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Payment Reference:</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(paymentInfo.paymentId, 'payment')}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#0f766e',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                        }}
                      >
                        <code>{paymentInfo.paymentId}</code>
                        {copiedKey === 'payment' ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Razorpay Order ID:</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(paymentInfo.orderId, 'order')}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#0f766e',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                        }}
                      >
                        <code>{paymentInfo.orderId}</code>
                        {copiedKey === 'order' ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Download PDF & Print Buttons */}
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {paymentInfo?.pdfUrl && (
                    <a
                      href={paymentInfo.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn hover-lift"
                      style={{
                        flex: '1 1 180px',
                        backgroundColor: '#0f766e',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        textDecoration: 'none',
                        padding: '11px 18px',
                        borderRadius: '12px',
                        fontWeight: 600,
                        fontSize: '13px',
                        boxShadow: '0 3px 10px rgba(15, 118, 110, 0.28)',
                      }}
                    >
                      <Download size={16} />
                      Download Official Invoice (PDF)
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn btn-secondary hover-lift"
                    style={{
                      padding: '11px 16px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: '1px solid #d9ece7',
                    }}
                  >
                    <Printer size={15} /> Print
                  </button>

                  <button
                    type="button"
                    onClick={() => setCancelModalOpen(true)}
                    className="btn btn-secondary hover-lift"
                    style={{
                      padding: '11px 16px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: refundResult ? '#16a34a' : '#dc2626',
                      borderColor: refundResult ? '#86efac' : 'rgba(220,38,38,0.3)',
                      backgroundColor: refundResult ? '#f0fdf4' : '#fff5f5',
                    }}
                  >
                    <RotateCcw size={15} /> {refundResult ? 'View Refund Receipt' : 'Cancel & Test Refund'}
                  </button>
                </div>
              </div>
            </div>

            {/* Real-time Multi-Channel Notification Hub */}
            <div
              className="card card-hover"
              style={{
                padding: '22px 24px',
                borderRadius: '18px',
                backgroundColor: '#ffffff',
                border: '1px solid #d9ece7',
                boxShadow: '0 4px 18px rgba(20, 60, 55, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(15, 118, 110, 0.12)',
                    color: '#0f766e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Zap size={16} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0b3f3a' }}>
                    Multi-Channel Real-Time Delivery Tracker
                  </h4>
                  <p style={{ margin: 0, fontSize: '11px', color: '#52736d' }}>
                    Automated event pipeline &amp; notification dispatch
                  </p>
                </div>
              </div>

              {(() => {
                const kafkaLog = auditLogs.find((l) => l.channel === 'KAFKA');
                const emailLog = auditLogs.find((l) => l.channel === 'EMAIL');
                const whatsAppLog = auditLogs.find((l) => l.channel === 'WHATSAPP');
                const dlqLog = auditLogs.find((l) => l.channel === 'DLQ');

                const formatTime = (dateStr?: string) => {
                  if (!dateStr) return '';
                  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                };

                return (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Email Item */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Mail size={16} color="#16a34a" />
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                              Email Tax Receipt {emailLog && `· ${formatTime(emailLog.createdAt)}`}
                            </div>
                            <div style={{ fontSize: '11px', color: '#52736d' }}>
                              {emailLog?.recipient || currentUser?.email || 'abhibrata.sarkar2020@gmail.com'}
                            </div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: emailLog?.status === 'FAILED' ? '#991b1b' : '#166534',
                            backgroundColor: emailLog?.status === 'FAILED' ? '#fee2e2' : '#dcfce7',
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          {emailLog?.status === 'DISPATCHED' ? 'Dispatched ✓' : (emailLog?.status || 'Delivered ✓')}
                        </span>
                      </div>

                      {/* WhatsApp Item */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Phone size={16} color="#16a34a" />
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                              WhatsApp Booking Pass {whatsAppLog && `· ${formatTime(whatsAppLog.createdAt)}`}
                            </div>
                            <div style={{ fontSize: '11px', color: '#52736d' }}>
                              {whatsAppLog?.recipient || patientPhone}
                            </div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#166534',
                            backgroundColor: '#dcfce7',
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          {whatsAppLog?.status === 'DELIVERED' ? 'Delivered ✓' : (whatsAppLog?.status || 'Dispatched ✓')}
                        </span>
                      </div>

                      {/* Kafka Streaming Item */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Zap size={16} color="#2563eb" />
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>
                              Apache Kafka Event Stream {kafkaLog && `· ${formatTime(kafkaLog.createdAt)}`}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {kafkaLog?.details || 'topic: payment-receipt-topic (3 partitions)'}
                            </div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#1e40af',
                            backgroundColor: '#dbeafe',
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          {kafkaLog?.status === 'QUEUED' ? 'Queued ✓' : 'Streamed <45ms'}
                        </span>
                      </div>

                      {/* DLQ Warning if any */}
                      {dlqLog && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fecaca',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AlertTriangle size={16} color="#dc2626" />
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>
                                Dead Letter Queue (DLQ)
                              </div>
                              <div style={{ fontSize: '11px', color: '#b91c1c' }}>
                                {dlqLog.details}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#991b1b',
                              backgroundColor: '#fee2e2',
                              padding: '3px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            DLQ Quarantined
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Inspect Audit Button */}
                    <button
                      type="button"
                      onClick={() => setAuditModalOpen(true)}
                      className="btn hover-lift"
                      style={{
                        marginTop: '14px',
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        border: '1px dashed #0f766e',
                        color: '#0f766e',
                        backgroundColor: '#f0fdf9',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <ShieldCheck size={16} color="#0f766e" />
                      <span>Inspect Kafka Outbox &amp; Pipeline Audit ({auditLogs.length} events recorded)</span>
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Bottom Navigation Hub */}
        {/* ========================================================================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            flexWrap: 'wrap',
            paddingTop: '20px',
            borderTop: '1px solid #d9ece7',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/patient')}
            className="btn btn-primary hover-lift"
            style={{
              padding: '12px 28px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>Back to Patient Dashboard</span>
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            onClick={() => navigate('/appointments')}
            className="btn btn-secondary hover-lift"
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '12px',
              border: '1px solid #ccebe3',
              color: '#0b3f3a',
            }}
          >
            <Calendar size={16} color="#0f766e" /> View All Appointments
          </button>

          <button
            type="button"
            onClick={onReset}
            className="btn btn-ghost hover-lift"
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              color: '#52736d',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} /> Schedule Another Consultation
          </button>
        </div>
      </div>
    </PageTransition>
  );
};
