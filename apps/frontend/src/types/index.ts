export type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN' | 'PHARMACIST' | 'STAFF';

export type UrgencyLevel = 'EMERGENCY' | 'URGENT' | 'ROUTINE';

export type ConsultationType = 'VIDEO' | 'IN_PERSON';

export type AppointmentStatus =
  | 'BOOKED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
}

export interface SlotSummary {
  id: string;
  slotAt: string;
}

export interface Doctor {
  id: string;
  fullName: string;
  specialty: string;
  hospital: string;
  avatarUrl?: string;
  rating: number;
  reviewCount?: number;
  bio?: string;
  nextSlots: SlotSummary[];
  openSlotCount: number;
  /** Legacy field retained so the old booking modal still compiles until it is retired. */
  name?: string;
  avatar?: string;
  availableDays?: string[];
  slots?: string[];
}

export interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileCategory: 'SYMPTOM_IMAGE' | 'PRIOR_PRESCRIPTION' | 'LAB_REPORT' | 'OTHER';
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface DoctorReview {
  id: string;
  appointmentId: string;
  doctorId: string;
  doctorName?: string;
  doctorSpecialty?: string;
  patientName: string;
  rating: number;
  comment?: string;
  tags?: string;
  isAnonymous: boolean;
  createdAt: string;
}

export interface Slot {
  id: string;
  doctorId: string;
  slotAt: string;
  booked: boolean;
}

export interface TriageAssessment {
  id: string;
  patientId: string;
  chiefComplaint: string;
  symptoms: string[];
  durationDays: number;
  painLevel: number;
  fever: boolean;
  chestPain: boolean;
  shortnessOfBreath: boolean;
  urgency: UrgencyLevel;
  rationale: string;
  suggestedSpecialty: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  doctorName?: string;
  doctorSpecialty?: string;
  doctorHospital?: string;
  doctorAvatarUrl?: string;
  slotId: string;
  slotAt?: string;
  assessmentId?: string;
  consultationType: ConsultationType;
  urgency: UrgencyLevel;
  status: AppointmentStatus;
  chiefComplaint?: string;
  notes?: string;
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export type PrescriptionStatus = 'DRAFT' | 'SIGNED' | 'VOIDED';

export type MealTiming =
  | 'UNSPECIFIED'
  | 'BEFORE_BREAKFAST'
  | 'AFTER_BREAKFAST'
  | 'BEFORE_LUNCH'
  | 'AFTER_LUNCH'
  | 'BEFORE_DINNER'
  | 'AFTER_DINNER'
  | 'WITH_MEAL'
  | 'EMPTY_STOMACH'
  | 'AT_BEDTIME'
  | 'AS_NEEDED';

export const MEAL_TIMING_LABELS: Record<MealTiming, string> = {
  UNSPECIFIED: '',
  BEFORE_BREAKFAST: 'before breakfast',
  AFTER_BREAKFAST: 'after breakfast',
  BEFORE_LUNCH: 'before lunch',
  AFTER_LUNCH: 'after lunch',
  BEFORE_DINNER: 'before dinner',
  AFTER_DINNER: 'after dinner',
  WITH_MEAL: 'with a meal',
  EMPTY_STOMACH: 'on an empty stomach',
  AT_BEDTIME: 'at bedtime',
  AS_NEEDED: 'as needed',
};

export const MEAL_TIMING_OPTIONS: { value: MealTiming; label: string }[] = [
  { value: 'UNSPECIFIED',      label: 'No specific timing' },
  { value: 'BEFORE_BREAKFAST', label: 'Before breakfast' },
  { value: 'AFTER_BREAKFAST',  label: 'After breakfast' },
  { value: 'BEFORE_LUNCH',     label: 'Before lunch' },
  { value: 'AFTER_LUNCH',      label: 'After lunch' },
  { value: 'BEFORE_DINNER',    label: 'Before dinner' },
  { value: 'AFTER_DINNER',     label: 'After dinner' },
  { value: 'WITH_MEAL',        label: 'With a meal' },
  { value: 'EMPTY_STOMACH',    label: 'On an empty stomach' },
  { value: 'AT_BEDTIME',       label: 'At bedtime' },
  { value: 'AS_NEEDED',        label: 'As needed' },
];

export interface PrescriptionItem {
  id?: string;
  drugName: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions?: string;
  /** One or more meal timings. UNSPECIFIED or empty means "no specific timing". */
  mealTimings?: MealTiming[];
}

/** Join N meal-timing labels into one readable phrase with Oxford commas. */
export function joinMealTimings(timings: MealTiming[] | undefined): string {
  if (!timings || timings.length === 0) return '';
  const labels = timings
    .filter(t => t !== 'UNSPECIFIED')
    .map(t => MEAL_TIMING_LABELS[t])
    .filter(Boolean);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

/**
 * Render a prescription line in plain language for patients:
 *   "500 mg · 3 times a day · for 5 days · after breakfast and after dinner"
 */
export function describePrescriptionItem(it: PrescriptionItem): string {
  const parts: string[] = [];
  if (it.dose) parts.push(it.dose);
  if (it.frequency) {
    const f = it.frequency.trim();
    const match = f.match(/^(\d+)\s*(?:x|times?)?\s*\/?\s*(day|daily|d)?/i);
    if (match && match[1]) {
      const n = parseInt(match[1], 10);
      if (n === 1) parts.push('once a day');
      else if (n === 2) parts.push('twice a day');
      else parts.push(`${n} times a day`);
    } else {
      parts.push(f);
    }
  }
  if (it.duration) {
    const d = it.duration.trim();
    parts.push(/^\d+$/.test(d) ? `for ${d} days` : (d.toLowerCase().startsWith('for ') ? d : `for ${d}`));
  }
  const timing = joinMealTimings(it.mealTimings);
  if (timing) parts.push(timing);
  return parts.join(' · ');
}

export interface Prescription {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  doctorName?: string;
  doctorSpecialty?: string;
  doctorHospital?: string;
  status: PrescriptionStatus;
  signedAt?: string;
  voidOf?: string;
  voidReason?: string;
  notes?: string;
  items: PrescriptionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Hospital {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  specialties: string[];
  logoUrl?: string;
}

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export interface PatientProfile {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: Gender;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPincode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
}

// ---------- Doctor verification + profile ----------

export type DoctorStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ScheduleTemplate {
  id?: string;
  dayOfWeek: number;              // 1 = Mon ... 7 = Sun (ISO)
  startTime: string;              // "09:00:00"
  endTime: string;                // "12:30:00"
  slotDurationMinutes: number;    // 15 | 20 | 30 | 45 | 60
}

export interface DoctorMe {
  id: string;
  userId: string;
  fullName: string;
  specialty: string;
  hospital: string;
  hospitalId?: string;
  avatarUrl?: string;
  rating: number;
  bio?: string;
  status: DoctorStatus;
  registrationNumber?: string;
  yearsExperience?: number;
  consultationFee?: number;
  languages?: string;
  rejectionReason?: string;
  submittedAt?: string;
  reviewedAt?: string;
  scheduleTemplate: ScheduleTemplate[];
}

export const COMMON_SPECIALTIES = [
  'General Medicine',
  'Cardiology',
  'Pediatrics',
  'Dermatology',
  'Orthopedics',
  'Gynecology',
  'Psychiatry',
  'Neurology',
  'ENT',
  'Pulmonology',
  'Gastroenterology',
  'Urology',
  'Ophthalmology',
  'Dentistry',
  'Oncology',
] as const;

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// ---------- Pharmacy orders ----------

export type PharmacyOrderStatus = 'NEW' | 'DISPENSED' | 'PICKED_UP' | 'CANCELLED';

export interface PharmacyOrderItem {
  id?: string;
  drugName: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions?: string;
  mealTimings?: MealTiming[];
}

export interface PharmacyOrder {
  id: string;
  prescriptionId: string;
  patientId: string;
  patientName?: string;
  pharmacistId?: string;
  pharmacistName?: string;
  status: PharmacyOrderStatus;
  doctorName?: string;
  doctorSpecialty?: string;
  items: PharmacyOrderItem[];
  prescriptionNotes?: string;
  dispensedAt?: string;
  pickedUpAt?: string;
  cancelledAt?: string;
  cancelledReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Video Consultations & Summaries ----------

export type ConsultationSessionStatus = 'SCHEDULED' | 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';

export interface ConsultationSession {
  id: string;
  appointmentId: string;
  roomId: string;
  status: ConsultationSessionStatus;
  canJoin: boolean;
  joinMessage: string;
  slotAt?: string;
  doctorName?: string;
  patientName?: string;
  startedAt?: string;
  endedAt?: string;
  transcript?: string;
  summaryChiefComplaint?: string;
  summaryObservations?: string;
  summaryDoctorAdvice?: string;
  summaryPrescribedActions?: string;
  summaryFollowUp?: string;
  createdAt: string;
}

export interface ConsultationSignalMessage {
  type: string;
  senderId: string;
  senderRole?: string;
  payload: string;
  timestamp: number;
}

export interface ConsultationEndRequest {
  transcript?: string;
  doctorNotes?: string;
  observations?: string;
  prescribedActions?: string;
  followUp?: string;
}
