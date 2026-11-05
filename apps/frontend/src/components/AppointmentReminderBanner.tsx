import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Video, Bell, X, ArrowRight, Clock } from 'lucide-react';
import { appointmentsApi } from '../services/api';
import type { Appointment, User } from '../types';

interface AppointmentReminderBannerProps {
  currentUser: User | null;
}

/**
 * Web Audio API synthesized notification chime.
 * Produces an elegant, reliable two-tone hospital/telehealth alert without external mp3 dependencies.
 */
export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // First tone (E5 ~ 659.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second tone (A5 ~ 880Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.18);
    gain2.gain.setValueAtTime(0.3, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.65);
  } catch (err) {
    console.warn('Audio chime could not be played:', err);
  }
}

export const AppointmentReminderBanner: React.FC<AppointmentReminderBannerProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [timeStatus, setTimeStatus] = useState<string>('');
  const [isImminent, setIsImminent] = useState<boolean>(false);
  const [dismissedApptId, setDismissedApptId] = useState<string | null>(null);

  const chimePlayedRef = useRef<Set<string>>(new Set());

  // Request browser notification permission once user interacts
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        // Ignore permission failure
      }
    }
  }, []);

  const triggerDesktopNotification = useCallback((appt: Appointment, msg: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const title = 'PulseCare: Consultation Reminder';
        const partnerName = currentUser?.role === 'DOCTOR'
          ? (appt.patientName || 'Patient')
          : (appt.doctorName || 'Doctor');
        new Notification(title, {
          body: `${msg} with ${partnerName}. Click to join.`,
          icon: '/favicon.ico',
        });
      } catch (e) {
        console.warn('Notification error:', e);
      }
    }
  }, [currentUser]);

  const checkUpcomingAppointments = useCallback(async () => {
    if (!currentUser) {
      setActiveAppointment(null);
      return;
    }

    try {
      let appointments: Appointment[] = [];
      if (currentUser.role === 'DOCTOR') {
        appointments = await appointmentsApi.doctorQueue('active');
      } else if (currentUser.role === 'PATIENT') {
        appointments = await appointmentsApi.mine();
      }

      if (!appointments || appointments.length === 0) {
        setActiveAppointment(null);
        return;
      }

      const now = new Date().getTime();

      // Find upcoming or active video appointments:
      // Condition: Consultation is VIDEO, not cancelled/completed,
      // and scheduled within next 15 minutes OR past by less than 60 minutes.
      const candidate = appointments.find(appt => {
        if (appt.consultationType !== 'VIDEO') return false;
        if (appt.status === 'CANCELLED' || appt.status === 'COMPLETED') return false;
        if (!appt.slotAt) return false;

        const slotTime = new Date(appt.slotAt).getTime();
        const diffMinutes = (slotTime - now) / (1000 * 60);

        // Within 15 minutes before slot time OR up to 90 minutes after slot time
        return diffMinutes <= 15 && diffMinutes >= -90;
      });

      if (!candidate) {
        setActiveAppointment(null);
        return;
      }

      const slotTime = new Date(candidate.slotAt!).getTime();
      const diffMinutes = Math.round((slotTime - now) / (1000 * 60));

      let statusMsg = '';
      let imminent = false;

      if (diffMinutes > 1) {
        statusMsg = `Starts in ${diffMinutes} minutes`;
      } else if (diffMinutes > 0) {
        statusMsg = 'Starts in 1 minute';
        imminent = true;
      } else {
        statusMsg = 'Consultation time has arrived — Room is active!';
        imminent = true;
      }

      setTimeStatus(statusMsg);
      setIsImminent(imminent);
      setActiveAppointment(candidate);

      // Play audio chime and push notification once when imminent
      if (imminent && !chimePlayedRef.current.has(candidate.id)) {
        chimePlayedRef.current.add(candidate.id);
        playNotificationChime();
        triggerDesktopNotification(candidate, statusMsg);
      }
    } catch (err) {
      // Silently fail polling
    }
  }, [currentUser, triggerDesktopNotification]);

  useEffect(() => {
    checkUpcomingAppointments();
    const interval = setInterval(checkUpcomingAppointments, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, [checkUpcomingAppointments]);

  // Don't show banner if already inside the consultation room or if dismissed
  const isConsultationRoom = location.pathname.startsWith('/consultation');
  if (isConsultationRoom || !activeAppointment || dismissedApptId === activeAppointment.id) {
    return null;
  }

  const partnerLabel = currentUser?.role === 'DOCTOR' ? 'Patient' : 'Doctor';
  const partnerName = currentUser?.role === 'DOCTOR'
    ? (activeAppointment.patientName || 'Patient')
    : (activeAppointment.doctorName ? `Dr. ${activeAppointment.doctorName}` : 'Doctor');

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        background: isImminent
          ? 'linear-gradient(90deg, #047857 0%, #0d9488 50%, #0284c7 100%)'
          : 'linear-gradient(90deg, #065f46 0%, #047857 100%)',
        color: '#ffffff',
        padding: '10px 20px',
        boxShadow: '0 4px 20px rgba(4, 120, 87, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        animation: 'slideDown 0.35s ease-out',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: isImminent ? 'pulse 1.5s infinite' : 'none',
          }}
        >
          {isImminent ? <Bell size={18} color="#fff" /> : <Clock size={18} color="#fff" />}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                padding: '2px 8px',
                borderRadius: '6px',
              }}
            >
              Video Consultation
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              {partnerLabel}: <strong>{partnerName}</strong>
            </span>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: '13px', opacity: 0.95, fontWeight: 500 }}>
            {timeStatus}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => {
            requestNotificationPermission();
            navigate(`/consultation/${activeAppointment.id}`);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#ffffff',
            color: '#047857',
            border: 'none',
            borderRadius: '9999px',
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.04)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Video size={16} />
          <span>Join Video Call</span>
          <ArrowRight size={14} />
        </button>

        <button
          onClick={() => setDismissedApptId(activeAppointment.id)}
          title="Dismiss reminder"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.8)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

