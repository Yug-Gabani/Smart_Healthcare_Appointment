import type { AppointmentStatus } from '../types';

export type EffectiveStatusKey =
  | 'LIVE_NOW'
  | 'UPCOMING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'NO_SHOW';

export interface EffectiveStatusDetails {
  key: EffectiveStatusKey;
  label: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  timeContext: string;
  canJoinCall: boolean;
  canCancel: boolean;
  isPast: boolean;
  description: string;
}

/**
 * Checks if an appointment's scheduled consultation window has completely elapsed
 * without having been completed or cancelled.
 *
 * An appointment is considered expired if:
 * 1. Its status is explicitly 'EXPIRED' or 'NO_SHOW', OR
 * 2. Its status is still 'BOOKED' or 'CONFIRMED' but the slot time (+ 45 mins grace period)
 *    is in the past.
 */
export function isAppointmentExpired(slotAt?: string, status?: AppointmentStatus | string): boolean {
  if (status === 'EXPIRED' || status === 'NO_SHOW') return true;
  if (status === 'COMPLETED' || status === 'CANCELLED') return false;
  if (!slotAt) return false;

  const slotTime = new Date(slotAt).getTime();
  if (isNaN(slotTime)) return false;

  // 45 minutes consultation window allowance
  const gracePeriodMs = 45 * 60 * 1000;
  return Date.now() > slotTime + gracePeriodMs;
}

/**
 * Checks if an appointment is currently active/ongoing right now
 * (from 15 minutes before slot start up to 45 minutes after start).
 */
export function isAppointmentLive(slotAt?: string, status?: AppointmentStatus | string): boolean {
  if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'EXPIRED' || status === 'NO_SHOW') {
    return false;
  }
  if (!slotAt) return false;

  const slotTime = new Date(slotAt).getTime();
  if (isNaN(slotTime)) return false;

  const now = Date.now();
  const diffMinutes = (slotTime - now) / 60000;

  // Active if 15 mins before or up to 45 mins after start
  return diffMinutes <= 15 && diffMinutes >= -45;
}

/**
 * Checks if an appointment is upcoming in the future (not live yet, not expired).
 */
export function isAppointmentUpcoming(slotAt?: string, status?: AppointmentStatus | string): boolean {
  if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'EXPIRED' || status === 'NO_SHOW') {
    return false;
  }
  if (!slotAt) return false;

  const slotTime = new Date(slotAt).getTime();
  if (isNaN(slotTime)) return false;

  const now = Date.now();
  const diffMinutes = (slotTime - now) / 60000;

  return diffMinutes > 15;
}

/**
 * Formats a slot timestamp into an intuitive human-readable string.
 */
export function formatAppointmentSlot(iso?: string): string {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'TBA';

  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (sameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  if (isYesterday) return `Yesterday · ${time}`;

  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}

/**
 * Formats countdown or elapsed time relative to now.
 */
export function formatTimeRelative(iso?: string): string {
  if (!iso) return '';
  const diffMs = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diffMs / 60000);

  if (mins > 0 && mins <= 15) return `in ${mins} min`;
  if (mins <= 0 && mins >= -45) return 'Live now · in session';
  if (mins < -45) {
    const elapsedDays = Math.abs(Math.round(mins / (60 * 24)));
    if (elapsedDays === 0) return 'Missed earlier today';
    return `Missed ${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`;
  }

  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Returns comprehensive status metadata and UI styling for an appointment.
 */
export function getAppointmentStatusDetails(appt: {
  slotAt?: string;
  status?: AppointmentStatus | string;
}): EffectiveStatusDetails {
  const { slotAt, status } = appt;

  // 1. Explicit Cancelled
  if (status === 'CANCELLED') {
    return {
      key: 'CANCELLED',
      label: 'Cancelled',
      badgeColor: '#dc2626',
      badgeBg: '#fef2f2',
      badgeBorder: '#fecaca',
      timeContext: 'Appointment cancelled',
      canJoinCall: false,
      canCancel: false,
      isPast: true,
      description: 'Consultation was cancelled. Slot was released.',
    };
  }

  // 2. Explicit Completed
  if (status === 'COMPLETED') {
    return {
      key: 'COMPLETED',
      label: 'Completed',
      badgeColor: '#059669',
      badgeBg: '#ecfdf5',
      badgeBorder: '#a7f3d0',
      timeContext: 'Consultation completed',
      canJoinCall: false,
      canCancel: false,
      isPast: true,
      description: 'Consultation finished successfully. Clinical records and meeting summary available.',
    };
  }

  // 3. Explicit No-show
  if (status === 'NO_SHOW') {
    return {
      key: 'NO_SHOW',
      label: 'Missed (No-show)',
      badgeColor: '#d97706',
      badgeBg: '#fffbeb',
      badgeBorder: '#fde68a',
      timeContext: 'Patient did not attend',
      canJoinCall: false,
      canCancel: false,
      isPast: true,
      description: 'Clinician marked as no-show. The consultation window has closed.',
    };
  }

  // 4. Elapsed Slot -> Expired / Missed
  if (isAppointmentExpired(slotAt, status)) {
    return {
      key: 'EXPIRED',
      label: 'Missed / Expired',
      badgeColor: '#b91c1c',
      badgeBg: '#fef2f2',
      badgeBorder: '#fecaca',
      timeContext: formatTimeRelative(slotAt),
      canJoinCall: false,
      canCancel: false,
      isPast: true,
      description: 'The scheduled consultation time has passed without attendance. The room is closed.',
    };
  }

  // 5. Active Live Session
  if (isAppointmentLive(slotAt, status)) {
    return {
      key: 'LIVE_NOW',
      label: 'Live now',
      badgeColor: '#059669',
      badgeBg: '#ecfdf5',
      badgeBorder: '#a7f3d0',
      timeContext: 'Consultation window open',
      canJoinCall: true,
      canCancel: false,
      isPast: false,
      description: 'Your physician is available or in session. Click to enter the video room.',
    };
  }

  // 6. Future Upcoming
  return {
    key: 'UPCOMING',
    label: status === 'CONFIRMED' ? 'Confirmed' : 'Booked',
    badgeColor: '#0f766e',
    badgeBg: '#eaf6f2',
    badgeBorder: '#d9ece7',
    timeContext: formatTimeRelative(slotAt),
    canJoinCall: false,
    canCancel: true,
    isPast: false,
    description: 'Scheduled on medical roster. Waiting for session start.',
  };
}
