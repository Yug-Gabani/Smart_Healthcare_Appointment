import type { Attachment, ConsultationType, TriageAssessment } from '../types';

/**
 * Persisted booking progress, so a patient whose session expires mid-booking
 * (triage filled, slot picked, about to pay) doesn't lose their work when the
 * app bounces them through /login.
 *
 * Stored in localStorage, scoped per-user (keyed on user id) so sessions on
 * shared browsers don't bleed into each other. Expires after
 * BOOKING_DRAFT_TTL_MS so a draft left over from a demo days ago doesn't
 * resurrect itself.
 *
 * We deliberately do NOT store payment details (Razorpay credentials, OTP,
 * CVV, etc.) — nothing in this type should be sensitive if the laptop is
 * lost. Only the booking intake + triage result + slot selection.
 */

export const BOOKING_DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface BookingDraftIntake {
  chiefComplaint: string;
  selectedSymptoms: string[];
  durationDays: number;
  painLevel: number;
  fever: boolean;
  chestPain: boolean;
  shortnessOfBreath: boolean;
}

export interface BookingDraft {
  savedAt: number; // ms epoch
  userId: string;
  step: 1 | 2 | 3;
  subStep: number;
  intake: BookingDraftIntake;
  assessment: TriageAssessment | null;
  selectedDoctorId: string;
  selectedSlotId: string;
  consultationType: ConsultationType;
  attachments: Attachment[];
  patientPhone?: string;
}

function storageKey(userId: string): string {
  return `pulsecare_booking_draft:${userId}`;
}

export function saveBookingDraft(userId: string, draft: Omit<BookingDraft, 'savedAt' | 'userId'>): void {
  if (!userId) return;
  try {
    const payload: BookingDraft = { ...draft, userId, savedAt: Date.now() };
    localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    // localStorage can throw in private mode or when quota is exceeded.
    // Not worth surfacing to the user — the draft is a convenience.
  }
}

export function loadBookingDraft(userId: string): BookingDraft | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookingDraft;
    if (!parsed || parsed.userId !== userId) return null;
    if (Date.now() - parsed.savedAt > BOOKING_DRAFT_TTL_MS) {
      localStorage.removeItem(storageKey(userId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearBookingDraft(userId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    /* silent */
  }
}
