import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MapPin,
  Video,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Clock,
  Upload,
  FileText,
  Trash2,
  CreditCard,
  Lock,
  Zap,
  Tag,
  Check,
} from 'lucide-react';
import type {
  Appointment, Attachment, ConsultationType, Doctor, Slot, TriageAssessment, User,
} from '../types';
import {
  appointmentsApi,
  doctorsApi,
  triageApi,
  filesApi,
  paymentsApi,
  slotsApi,
} from '../services/api';
import { PageTransition } from '../motion/PageTransition';
import { AppointmentConfirmedView } from './AppointmentConfirmedView';
import { CouponFeedbackModal, type CouponSuccessData, type CouponErrorData } from './CouponFeedbackModal';

/* ------------------------------------------------------------------ *
 * "Book a Visit" — One-at-a-Time Triage + Razorpay Payment Gateway.
 * Combines designer one-at-a-time triage flow with atomic Redis 2-phase
 * slot holds, discount coupons, and Razorpay checkout modal.
 * ------------------------------------------------------------------ */

interface PatientTriageBookingProps {
  currentUser: User | null;
}

export interface DiscountCoupon {
  code: string;
  description: string;
  type: 'PERCENT' | 'FLAT' | 'FIXED';
  value: number;
  badge: string;
}

export const TEST_COUPONS: DiscountCoupon[] = [
  { code: 'PULSE50', description: '50% Flat Off Consultation', type: 'PERCENT', value: 50, badge: '50% OFF' },
  { code: 'CARE100', description: '₹100 Instant Medical Credit', type: 'FLAT', value: 100, badge: '₹100 OFF' },
  { code: 'HEALTH1', description: 'Pay ₹1 Special Gateway Test Coin', type: 'FIXED', value: 1, badge: '₹1 TEST' },
  { code: 'PULSE90', description: '90% Healthcare Subsidy', type: 'PERCENT', value: 90, badge: '90% OFF' },
  { code: 'FREECONSULT', description: '100% Free Consultation', type: 'PERCENT', value: 100, badge: '100% FREE' },
];

/* Patient-friendly symptom chips */
const COMMON_SYMPTOMS = [
  'Fever', 'Cough', 'Headache', 'Chest tightness', 'Stomach pain',
  'Rash', 'Dizziness', 'Joint swelling', 'Sore throat', 'Trouble breathing',
];

const FONT = "'Space Grotesk', sans-serif";

/* ----------------------------- helpers ---------------------------- */

function urgencyColor(u: TriageAssessment['urgency']): string {
  if (u === 'EMERGENCY') return '#dc2626';
  if (u === 'URGENT') return '#d97706';
  return '#059669';
}

function friendlyUrgency(u: TriageAssessment['urgency']): { label: string; message: string } {
  if (u === 'EMERGENCY') return {
    label: 'Please get seen right away',
    message: "What you described sounds serious. Please don't wait — get to a doctor now, or call 108 / 112 if you can't travel safely.",
  };
  if (u === 'URGENT') return {
    label: 'See a doctor today',
    message: "Your symptoms shouldn't wait. We've found the right specialist below — book a same-day slot if you can.",
  };
  return {
    label: 'Nothing urgent',
    message: 'Looks manageable. Pick any slot that works for you — same-day or later this week is fine.',
  };
}

function painWord(p: number): string {
  if (p === 0) return 'None';
  if (p <= 3) return 'Mild';
  if (p <= 6) return 'Moderate';
  if (p <= 8) return 'Severe';
  return 'Unbearable';
}

function formatSlot(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

function normalizeSlotTime(d: Date): string {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

function getSlotDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface SpotIntakePreset {
  label: string; chiefComplaint: string; selectedSymptoms: string[];
  durationDays: number; painLevel: number; fever: boolean; chestPain: boolean; shortnessOfBreath: boolean;
}

const DEFAULT_PRESET: SpotIntakePreset = {
  label: '', chiefComplaint: '', selectedSymptoms: [],
  durationDays: 2, painLevel: 4, fever: false, chestPain: false, shortnessOfBreath: false,
};

function inferPresetFromComplaint(text: string): SpotIntakePreset {
  const l = text.toLowerCase();
  const sym: string[] = [];
  let fever = false, chestPain = false, sob = false, pain = 4, days = 3;
  if (/(chest|heart|cardiac|angina)/.test(l)) { sym.push('Chest tightness'); chestPain = true; pain = 6; days = 1; }
  if (/(breath|dyspnea|suffocat)/.test(l)) { sym.push('Trouble breathing'); sob = true; pain = Math.max(pain, 6); }
  if (/(head|migraine)/.test(l)) { sym.push('Headache'); pain = Math.max(pain, 5); }
  if (/(fever|chill|temperature)/.test(l)) { sym.push('Fever'); fever = true; }
  if (/cough/.test(l)) sym.push('Cough');
  if (/(stomach|abdom|cramp|belly|nausea|bloat)/.test(l)) { sym.push('Stomach pain'); pain = Math.max(pain, 5); }
  if (/(dizzy|faint|vertigo|lighthead)/.test(l)) sym.push('Dizziness');
  if (/(rash|allerg|hive|itch|skin)/.test(l)) sym.push('Rash');
  if (/(joint|swell|knee|ankle|back|neck)/.test(l)) sym.push('Joint swelling');
  if (/throat/.test(l)) sym.push('Sore throat');
  return {
    label: text.length > 30 ? text.slice(0, 28) + '…' : text,
    chiefComplaint: text, selectedSymptoms: sym.length ? sym : [],
    durationDays: days, painLevel: pain, fever, chestPain, shortnessOfBreath: sob,
  };
}

const SPOT_INTAKE_PRESETS: Record<string, SpotIntakePreset> = {
  chest: {
    label: 'Chest & Heart',
    chiefComplaint: 'Sharp chest tightness, squeezing pressure radiating to arm, and shortness of breath upon exertion.',
    selectedSymptoms: ['Chest tightness', 'Trouble breathing'],
    durationDays: 1, painLevel: 7, fever: false, chestPain: true, shortnessOfBreath: true,
  },
  head: {
    label: 'Head & Face',
    chiefComplaint: 'Severe headache with throbbing behind the eyes; sensitive to light.',
    selectedSymptoms: ['Headache'],
    durationDays: 2, painLevel: 7, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  mental: {
    label: 'Mind & Mood',
    chiefComplaint: 'Persistent low mood, poor sleep and trouble concentrating for the past two weeks.',
    selectedSymptoms: ['Dizziness'],
    durationDays: 14, painLevel: 3, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  abdomen: {
    label: 'Stomach & Belly',
    chiefComplaint: 'Cramping stomach pain around the belly button with nausea after meals.',
    selectedSymptoms: ['Stomach pain'],
    durationDays: 3, painLevel: 6, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  knee: {
    label: 'Knee & Joint',
    chiefComplaint: 'Swollen right knee with stiff aching pain after walking or climbing stairs.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 5, painLevel: 5, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  ankle: {
    label: 'Ankle & Foot',
    chiefComplaint: 'Twisted ankle with tenderness on the outer side and mild swelling.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 2, painLevel: 6, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  upper_back: {
    label: 'Upper Back & Shoulders',
    chiefComplaint: 'Persistent tension knots and aching between the shoulder blades from desk posture.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 7, painLevel: 4, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  lower_back: {
    label: 'Lower Back & Lumbar',
    chiefComplaint: 'Sharp shooting pain across lower back when bending forward or standing up.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 4, painLevel: 7, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  hips_back: {
    label: 'Hips & Pelvis',
    chiefComplaint: 'Deep hip aching with stiffness during morning movements.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 10, painLevel: 5, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  neck_back: {
    label: 'Neck & Cervical',
    chiefComplaint: 'Stiff neck with limited rotation and pain radiating towards upper shoulders.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 3, painLevel: 5, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  calf: {
    label: 'Calf & Lower Leg',
    chiefComplaint: 'Sudden calf cramping with tightness during evening walks.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 2, painLevel: 5, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  joints: {
    label: 'Joints & Arthritis',
    chiefComplaint: 'Multiple aching joints with stiffness and mild morning swelling.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 14, painLevel: 6, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  skin: {
    label: 'Skin & Dermatology',
    chiefComplaint: 'Itchy reddish rash across forearms with mild flaking and irritation.',
    selectedSymptoms: ['Rash'],
    durationDays: 4, painLevel: 3, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  reproductive: {
    label: 'Reproductive & Pelvic',
    chiefComplaint: 'Lower abdominal pelvic dull ache with burning sensation during urination.',
    selectedSymptoms: ['Stomach pain'],
    durationDays: 3, painLevel: 5, fever: false, chestPain: false, shortnessOfBreath: false,
  },
};

function resolveSpotKey(raw: string | null): string | null {
  if (!raw) return null;
  const k = raw.toLowerCase().trim();
  if (SPOT_INTAKE_PRESETS[k]) return k;
  if (/(chest|heart|cardiac|angina)/.test(k)) return 'chest';
  if (/(head|migraine|brain|cranial)/.test(k)) return 'head';
  if (/(mental|mood|depress|anxiety)/.test(k)) return 'mental';
  if (/(abdom|stomach|belly|gut|liver)/.test(k)) return 'abdomen';
  if (/(knee)/.test(k)) return 'knee';
  if (/(ankle|foot)/.test(k)) return 'ankle';
  if (/(upper.?back)/.test(k)) return 'upper_back';
  if (/(lower.?back|lumbar)/.test(k)) return 'lower_back';
  if (/(hip)/.test(k)) return 'hips_back';
  if (/(neck|cervical)/.test(k)) return 'neck_back';
  if (/(calf|shin)/.test(k)) return 'calf';
  if (/(joint|arthrit)/.test(k)) return 'joints';
  if (/(skin|rash|derm)/.test(k)) return 'skin';
  if (/(reprod|urinary|pelv|uter|bladder)/.test(k)) return 'reproductive';
  return null;
}

type UploadCategory = 'SYMPTOM_IMAGE' | 'PRIOR_PRESCRIPTION' | 'LAB_REPORT';

export const PatientTriageBooking: React.FC<PatientTriageBookingProps> = ({ currentUser }) => {
  const [searchParams] = useSearchParams();

  /* "Shortcut" mode: patient landed here from a landing-page specialty tile
   * with ?specialty=X. They skip the 6-question triage flow and go straight
   * to step 3 (pick a doctor, time & pay). A short required intake textarea
   * on step 3 still gathers one line of context for the doctor; it is sent
   * as a minimal triage assessment just before booking so the appointment
   * still links to a TriageAssessment row. */
  const shortcutSpecialty = useMemo(() => searchParams.get('specialty') || null, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* React Router doesn't reset scroll position on navigation. Patients often click a
   * specialty tile near the bottom of the landing page, so without this they'd land
   * mid-way down the booking page (past the intake and the Fast Lane chip). Reset once. */
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const initialPreset = useMemo<SpotIntakePreset>(() => {
    let hotspotKey = searchParams.get('hotspot') || searchParams.get('focus') || '';
    if (!hotspotKey) {
      try {
        const stored = sessionStorage.getItem('pulsecare_pending_hotspot');
        if (stored) { hotspotKey = stored; sessionStorage.removeItem('pulsecare_pending_hotspot'); }
      } catch { /* sessionStorage fallback */ }
    }
    const resolved = resolveSpotKey(hotspotKey);
    if (resolved && SPOT_INTAKE_PRESETS[resolved]) return SPOT_INTAKE_PRESETS[resolved];
    let complaintText = searchParams.get('complaint') || '';
    if (!complaintText) {
      try {
        const stored = sessionStorage.getItem('pulsecare_pending_complaint');
        if (stored) { complaintText = stored; sessionStorage.removeItem('pulsecare_pending_complaint'); }
      } catch { /* sessionStorage fallback */ }
    }
    if (complaintText) return inferPresetFromComplaint(complaintText);
    return DEFAULT_PRESET;
  }, [searchParams]);

  // Overall steps: 1 = intake, 2 = AI review, 3 = pick doctor & time (shortcut lands on 3)
  const [step, setStep] = useState<1 | 2 | 3>(shortcutSpecialty ? 3 : 1);
  const [subStep, setSubStep] = useState<number>(0);
  const [shortcutIntake, setShortcutIntake] = useState('');
  const [shortcutIntakeError, setShortcutIntakeError] = useState(false);

  // Step 1 micro-intake fields
  const [chiefComplaint, setChiefComplaint] = useState(initialPreset.chiefComplaint);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(initialPreset.selectedSymptoms);
  const [durationDays, setDurationDays] = useState<number>(initialPreset.durationDays);
  const [painLevel, setPainLevel] = useState<number>(initialPreset.painLevel);
  const [fever, setFever] = useState<boolean>(initialPreset.fever);
  const [chestPain, setChestPain] = useState<boolean>(initialPreset.chestPain);
  const [shortnessOfBreath, setShortnessOfBreath] = useState<boolean>(initialPreset.shortnessOfBreath);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadCategory, setUploadCategory] = useState<UploadCategory>('SYMPTOM_IMAGE');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [complaintError, setComplaintError] = useState(false);

  // Step 2 triage assessment
  const [assessment, setAssessment] = useState<TriageAssessment | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);

  // Step 3 doctor & scheduling
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [doctorSlots, setDoctorSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDayISO, setSelectedDayISO] = useState('');
  const [consultationType, setConsultationType] = useState<ConsultationType>('VIDEO');
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);

  /* Scroll to the top of the page whenever the step flips OR the confirmation card renders.
   * Step 3's form is tall, so clicking "Book appointment" or "Instant Test" at the bottom
   * leaves the browser scrolled way down — when the next step or confirmation renders, the
   * patient lands below the fold and thinks nothing happened. */
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step, confirmed]);

  /** Which doctor card has its details panel expanded (bio, experience, languages, fee). */
  const [expandedDoctorId, setExpandedDoctorId] = useState('');

  // Payment Gateway states
  const [paymentInfo, setPaymentInfo] = useState<{
    orderId: string;
    paymentId: string;
    amountPaise: number;
    status: string;
    pdfUrl: string;
  } | null>(null);
  const [patientPhone, setPatientPhone] = useState<string>(currentUser?.phone || '+919876543210');

  // Redis 2-phase hold states
  const [holdSecondsRemaining, setHoldSecondsRemaining] = useState<number | null>(null);
  const [reservingSlot, setReservingSlot] = useState<boolean>(false);
  const [slotReservationMessage, setSlotReservationMessage] = useState<string | null>(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<DiscountCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [couponSuccessModal, setCouponSuccessModal] = useState<CouponSuccessData | null>(null);
  const [couponErrorModal, setCouponErrorModal] = useState<CouponErrorData | null>(null);

  const calculatePayablePaise = (coupon: DiscountCoupon | null): { payablePaise: number; discountPaise: number } => {
    if (!coupon) return { payablePaise: 50000, discountPaise: 0 };
    if (coupon.type === 'PERCENT') {
      if (coupon.value >= 100) return { payablePaise: 0, discountPaise: 50000 };
      const discount = Math.round(50000 * (coupon.value / 100));
      return { payablePaise: Math.max(100, 50000 - discount), discountPaise: discount };
    }
    if (coupon.type === 'FLAT') {
      const discount = coupon.value * 100;
      return { payablePaise: Math.max(100, 50000 - discount), discountPaise: discount };
    }
    if (coupon.type === 'FIXED') {
      const payable = coupon.value * 100;
      return { payablePaise: payable, discountPaise: Math.max(0, 50000 - payable) };
    }
    return { payablePaise: 50000, discountPaise: 0 };
  };

  const { payablePaise, discountPaise } = calculatePayablePaise(appliedCoupon);

  const handleApplyCoupon = (codeToApply?: string) => {
    const code = (codeToApply !== undefined ? codeToApply : couponInput).trim().toUpperCase();
    if (!code) {
      setCouponError('Please enter a coupon code.');
      setCouponSuccess(null);
      return;
    }
    const found = TEST_COUPONS.find(c => c.code.toUpperCase() === code);
    if (!found) {
      setCouponError(`Coupon '${code}' is invalid or expired.`);
      setCouponSuccess(null);
      setCouponErrorModal({
        attemptedCode: code,
        message: 'This coupon code was not found in the active pulse promotions database.',
      });
      return;
    }
    setAppliedCoupon(found);
    setCouponInput(found.code);
    setCouponError(null);
    const { payablePaise: newPayable, discountPaise: newDisc } = calculatePayablePaise(found);
    const msg = `Coupon '${found.code}' applied! You save ₹${(newDisc / 100).toFixed(2)}.`;
    setCouponSuccess(msg);
    setCouponSuccessModal({
      coupon: found,
      discountPaise: newDisc,
      payablePaise: newPayable,
    });
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
    setCouponSuccess(null);
  };

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms(cur => (cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]));
  };

  /* Attachments upload */
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const att = await filesApi.upload(file, uploadCategory);
        setAttachments(cur => [...cur, att]);
      }
    } catch (err: any) {
      alert(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(cur => cur.filter(a => a.id !== id));
  };

  /* Step 2 AI assessment */
  const handleAssess = async () => {
    if (!chiefComplaint.trim()) {
      setComplaintError(true);
      setSubStep(0);
      return;
    }
    setAssessing(true);
    setTriageError(null);
    try {
      const res = await triageApi.assess({
        chiefComplaint: chiefComplaint.trim(),
        symptoms: selectedSymptoms,
        durationDays,
        painLevel,
        fever,
        chestPain,
        shortnessOfBreath,
      });
      setAssessment(res);
      setStep(2);
    } catch (err: any) {
      setTriageError(err.message || 'Triage service unavailable. Please retry.');
    } finally {
      setAssessing(false);
    }
  };

  /* Effective specialty for step 3 — comes from either the triage result or the
   * shortcut URL param. Used by the doctor fetch and in the UI labels. */
  const effectiveSpecialty = assessment?.suggestedSpecialty ?? shortcutSpecialty ?? null;
  const isShortcut = !!shortcutSpecialty && !assessment;

  /** Per-doctor slot cache. Populated once by the list-load prefetch (in parallel for all
   *  doctors in the specialty) and read instantly on every doctor switch — so switching
   *  back-and-forth between doctors is zero-latency instead of triggering a refetch each time. */
  const slotsCacheRef = useRef<Record<string, Slot[]>>({});

  /* Fetch doctors for specialty — triggered by either triage result or shortcut URL.
   * As soon as the list arrives, kick off slot fetches for ALL doctors in parallel so by
   * the time the patient clicks around, every card is already warm in the cache. */
  useEffect(() => {
    if (!effectiveSpecialty) return;
    setDoctorsLoading(true);
    setDoctorsError(null);
    doctorsApi.list(effectiveSpecialty)
      .then(docs => {
        setDoctors(docs);
        if (docs.length > 0) setSelectedDoctorId(docs[0].id);
        // Prefetch every doctor's slots in parallel; result goes straight into the cache.
        slotsCacheRef.current = {};
        docs.forEach(d => {
          doctorsApi.slots(d.id)
            .then(slots => {
              slotsCacheRef.current[d.id] = slots;
              // If this is the currently-selected doctor, surface the slots immediately.
              setSelectedDoctorId(curId => {
                if (curId === d.id) setDoctorSlots(slots);
                return curId;
              });
            })
            .catch(() => { /* keep cache empty; manual fetch effect will retry on click */ });
        });
      })
      .catch(err => setDoctorsError(err.message || 'Could not load doctors.'))
      .finally(() => setDoctorsLoading(false));
  }, [effectiveSpecialty]);

  /* Fetch slots for selected doctor. Hits the cache first (populated by the prefetch above),
   * only falls through to the network for a cache miss — e.g. if the prefetch is still inflight
   * when the user clicks a different doctor, or failed for this one. */
  useEffect(() => {
    if (!selectedDoctorId) { setDoctorSlots([]); return; }
    const cached = slotsCacheRef.current[selectedDoctorId];
    if (cached) { setDoctorSlots(cached); setSlotsLoading(false); return; }
    setDoctorSlots([]);
    setSlotsLoading(true);
    doctorsApi.slots(selectedDoctorId)
      .then(slots => { slotsCacheRef.current[selectedDoctorId] = slots; setDoctorSlots(slots); })
      .catch(() => setDoctorSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDoctorId]);

  /* Build schedule day columns */
  const availableSlots = useMemo(() => {
    return doctorSlots.filter(s => !s.booked);
  }, [doctorSlots]);

  const scheduleDays = useMemo(() => {
    const map = new Map<string, { dateISO: string; dayName: string; dateFormatted: string; weekday: string; isWeekend: boolean; slots: Slot[] }>();
    const base = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const iso = getSlotDateISO(d);
      map.set(iso, {
        dateISO: iso,
        dayName: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString(undefined, { weekday: 'short' }),
        dateFormatted: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        slots: [],
      });
    }
    availableSlots.forEach(s => {
      const iso = getSlotDateISO(new Date(s.slotAt));
      if (map.has(iso)) map.get(iso)!.slots.push(s);
    });
    map.forEach(day => day.slots.sort((a, b) => +new Date(a.slotAt) - +new Date(b.slotAt)));
    return Array.from(map.values()).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  }, [availableSlots]);

  // Auto-pick first day with slots
  useEffect(() => {
    if (!scheduleDays.length) return;
    const cur = scheduleDays.find(d => d.dateISO === selectedDayISO);
    if (!cur) {
      const first = scheduleDays.find(d => d.slots.length) || scheduleDays[0];
      setSelectedDayISO(first.dateISO);
    }
  }, [scheduleDays, selectedDayISO]);

  // Redis 2-phase hold countdown timer
  useEffect(() => {
    if (holdSecondsRemaining === null || holdSecondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setHoldSecondsRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setSelectedSlotId('');
          setSlotReservationMessage('Your 10-minute slot reservation has expired. Please select a time slot again.');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [holdSecondsRemaining]);

  // Release hold if user navigates away or unmounts
  useEffect(() => {
    return () => {
      if (selectedSlotId) {
        slotsApi.release(selectedSlotId).catch(() => {});
      }
    };
  }, [selectedSlotId]);

  const handleSlotClick = async (slot: Slot) => {
    if (slot.onHold && !slot.heldByYou) {
      const mins = Math.max(1, Math.ceil((slot.remainingHoldSeconds || 60) / 60));
      setSlotReservationMessage(`Slot is currently on hold by another patient (${mins} min left). Please choose another slot.`);
      return;
    }
    if (selectedSlotId === slot.id && holdSecondsRemaining && holdSecondsRemaining > 0) {
      return;
    }

    setReservingSlot(true);
    setSlotReservationMessage(null);
    try {
      if (selectedSlotId && selectedSlotId !== slot.id) {
        slotsApi.release(selectedSlotId).catch(() => {});
      }
      const res = await slotsApi.hold(slot.id, 600);
      if (res.success && res.heldByYou) {
        setSelectedSlotId(slot.id);
        setHoldSecondsRemaining(res.remainingHoldSeconds || 600);
        setSlotReservationMessage(null);
      } else {
        setSelectedSlotId('');
        setHoldSecondsRemaining(null);
        setSlotReservationMessage(res.message || 'This slot was just reserved by another patient.');
      }
    } catch {
      // Local fallback in case Redis is bypassed
      setSelectedSlotId(slot.id);
      setHoldSecondsRemaining(600);
    } finally {
      setReservingSlot(false);
    }
  };

  const currentDay = scheduleDays.find(d => d.dateISO === selectedDayISO);
  const currentDaySlots = currentDay?.slots ?? [];
  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId) || null;
  const selectedSlot = availableSlots.find(s => s.id === selectedSlotId) || null;

  /* Load Razorpay script dynamically */
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  /* Finalize booking after payment verify */
  const finalizePaymentAndBooking = async (orderId: string, paymentId: string, signature: string) => {
    try {
      const verifyRes = await paymentsApi.verify({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
      });

      /* Shortcut path: synthesise a minimal triage record from the one-line intake
       * so the appointment still carries context. If the triage call fails we fall
       * through and book without an assessmentId — the backend allows that. */
      let assessmentId = assessment?.id;
      if (isShortcut && shortcutIntake.trim()) {
        try {
          const mini = await triageApi.assess({
            chiefComplaint: shortcutIntake.trim(),
            symptoms: [], durationDays: 1, painLevel: 0,
            fever: false, chestPain: false, shortnessOfBreath: false,
          });
          assessmentId = mini.id;
        } catch { /* keep assessmentId undefined and continue */ }
      }

      const booked = await appointmentsApi.book({
        doctorId: selectedDoctorId,
        slotId: selectedSlotId,
        assessmentId,
        consultationType,
        attachmentIds: attachments.map(a => a.id),
      });

      setPaymentInfo({
        orderId,
        paymentId,
        amountPaise: payablePaise,
        status: verifyRes.status || 'PAID',
        pdfUrl: paymentsApi.receiptPdfUrl(orderId),
      });

      setConfirmed(booked);
    } catch (err: any) {
      setBookingError(err.message || 'Payment verification or booking finalization failed. Please contact clinic support.');
    } finally {
      setBooking(false);
    }
  };

  /* Live Razorpay Checkout flow */
  const handleLivePaymentBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedSlotId) {
      setBookingError('Pick a doctor and a time first.');
      return;
    }
    if (isShortcut && !shortcutIntake.trim()) {
      setShortcutIntakeError(true);
      setBookingError('Please tell us briefly why you are seeing a ' + effectiveSpecialty + ' today.');
      return;
    }
    setBooking(true);
    setBookingError(null);

    const slotTimeStr = selectedSlot?.slotAt ? formatSlot(selectedSlot.slotAt) : 'Today 04:30 PM';
    const amountPaise = payablePaise;

    // Free Consultation Bypass (100% OFF)
    if (amountPaise === 0) {
      const freeOrderId = 'order_free_' + Math.random().toString(36).substring(2, 12);
      await finalizePaymentAndBooking(freeOrderId, 'pay_free_voucher', 'sandbox_signature');
      return;
    }

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Could not load Razorpay SDK. Please check your internet connection.');
      }

      const order = await paymentsApi.createOrder({
        amountPaise,
        patientName: currentUser?.fullName || 'PulseCare Patient',
        patientEmail: currentUser?.email || 'patient@pulsecare.com',
        patientPhone: patientPhone,
        doctorId: selectedDoctorId,
        slotTime: slotTimeStr,
      });

      if (!order || !order.razorpayOrderId) {
        throw new Error('Failed to create payment order. Try instant test booking.');
      }

      const options = {
        key: order.keyId || 'rzp_test_placeholder',
        amount: order.amountPaise,
        currency: order.currency || 'INR',
        name: 'PulseCare Health Systems',
        description: `Consultation with ${selectedDoctor?.fullName || 'Specialist'}`,
        order_id: order.razorpayOrderId,
        prefill: {
          name: currentUser?.fullName || 'PulseCare Patient',
          email: currentUser?.email || 'patient@pulsecare.com',
          contact: patientPhone,
        },
        theme: {
          color: '#0f766e',
        },
        modal: {
          ondismiss: function () {
            setBooking(false);
          },
        },
        handler: async function (resp: any) {
          await finalizePaymentAndBooking(
            resp.razorpay_order_id,
            resp.razorpay_payment_id,
            resp.razorpay_signature
          );
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        setBookingError(`Payment failed: ${resp.error?.description || 'Transaction cancelled'}`);
        setBooking(false);
      });
      rzp.open();
    } catch (err: any) {
      setBookingError(err.message || 'Failed to initialize Razorpay checkout gateway.');
      setBooking(false);
    }
  };

  /* Instant Test Booking flow */
  const handleTestBooking = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedSlotId) {
      setBookingError('Choose a doctor and a slot before confirming.');
      return;
    }
    if (isShortcut && !shortcutIntake.trim()) {
      setShortcutIntakeError(true);
      setBookingError('Please tell us briefly why you are seeing a ' + effectiveSpecialty + ' today.');
      return;
    }
    setBooking(true);
    setBookingError(null);

    const slotTimeStr = selectedSlot?.slotAt ? formatSlot(selectedSlot.slotAt) : 'Today 04:30 PM';
    const amountPaise = payablePaise;

    try {
      let orderId = (payablePaise === 0 ? 'order_free_' : 'order_sb_') + Math.random().toString(36).substring(2, 12);
      if (payablePaise > 0) {
        try {
          const order = await paymentsApi.createOrder({
            amountPaise,
            patientName: currentUser?.fullName || 'PulseCare Patient',
            patientEmail: currentUser?.email || 'patient@pulsecare.com',
            patientPhone: patientPhone,
            doctorId: selectedDoctorId,
            slotTime: slotTimeStr,
          });
          if (order?.razorpayOrderId) {
            orderId = order.razorpayOrderId;
          }
        } catch {
          // Continuous testing fallback
        }
      }

      const simPaymentId = 'pay_sim_' + Math.random().toString(36).substring(2, 12);
      await finalizePaymentAndBooking(orderId, simPaymentId, 'sandbox_signature');
    } catch (err: any) {
      setBookingError(err.message || 'Direct test booking failed. Please try again.');
      setBooking(false);
    }
  };

  /* =========================== styles =========================== */
  const card: React.CSSProperties = {
    maxWidth: 620, margin: '0 auto', background: '#fff', border: '1px solid var(--border)',
    borderRadius: 16, boxShadow: '0 2px 8px rgba(11,63,58,.04)', padding: 36,
  };
  const h2: React.CSSProperties = { font: `700 24px/1.2 ${FONT}`, color: 'var(--ink)', letterSpacing: '-.02em', margin: '0 0 6px' };
  const sub: React.CSSProperties = { font: `400 14px/1.5 ${FONT}`, color: 'var(--ink-muted)', margin: '0 0 22px' };
  const kicker: React.CSSProperties = { font: `600 10px ${FONT}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 10 };
  const btnPrimary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 22px', background: 'var(--primary)', color: '#fff', border: 'none',
    borderRadius: 12, font: `600 14px ${FONT}`, cursor: 'pointer', minHeight: 46,
  };
  const btnGhost: React.CSSProperties = {
    padding: '12px 20px', background: 'transparent', color: 'var(--muted)',
    border: '1.5px solid #cfe0da', borderRadius: 12, font: `600 14px ${FONT}`, cursor: 'pointer', minHeight: 46,
  };

  /* =========================== confirmation =========================== */
  if (confirmed) {
    return (
      <AppointmentConfirmedView
        confirmed={confirmed}
        paymentInfo={paymentInfo}
        currentUser={currentUser}
        patientPhone={patientPhone}
        selectedDoctor={selectedDoctor}
        assessment={assessment}
        uploadedAttachments={attachments}
        appliedCoupon={
          appliedCoupon
            ? {
                code: appliedCoupon.code,
                discountRupees: discountPaise / 100,
                discountLabel: appliedCoupon.badge,
              }
            : null
        }
        onReset={() => {
          setConfirmed(null);
          setPaymentInfo(null);
          setAppliedCoupon(null);
          setCouponInput('');
          setCouponError(null);
          setCouponSuccess(null);
          setStep(1);
          setSubStep(0);
          setChiefComplaint('');
          setSelectedSymptoms([]);
          setAssessment(null);
          setSelectedDoctorId('');
          setSelectedSlotId('');
          setAttachments([]);
        }}
      />
    );
  }

  /* =========================== step 1 sub-questions =========================== */
  const stepIdx = step - 1;
  const subQuestions = [
    // 0 — complaint
    (
      <div key="q0">
        <div style={kicker}>About you · 1 of 6</div>
        <h2 style={h2}>What's bothering you?</h2>
        <p style={sub}>In your own words — a sentence is plenty.</p>
        <textarea
          value={chiefComplaint}
          onChange={e => { setChiefComplaint(e.target.value); setComplaintError(false); }}
          placeholder="e.g. I've had a bad headache and felt dizzy since yesterday"
          style={{
            width: '100%', minHeight: 118, padding: '14px 16px',
            border: `1.5px solid ${complaintError ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 10, font: `400 15px/1.5 ${FONT}`, color: 'var(--ink)',
            background: '#f8fbfa', resize: 'vertical', outline: 'none',
          }}
        />
        {complaintError && <p style={{ font: `500 12px ${FONT}`, color: 'var(--danger)', margin: '6px 0 0' }}>Please describe your symptoms to continue.</p>}
      </div>
    ),
    // 1 — symptoms
    (
      <div key="q1">
        <div style={kicker}>Symptoms · 2 of 6</div>
        <h2 style={h2}>Anything specific you're noticing?</h2>
        <p style={sub}>Tap any that apply — or skip if none fit.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {COMMON_SYMPTOMS.map(s => {
            const on = selectedSymptoms.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggleSymptom(s)} style={{
                padding: '9px 16px', borderRadius: 9999, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                background: on ? 'var(--primary)' : '#fff', color: on ? '#fff' : 'var(--ink)',
                font: `500 13px ${FONT}`, cursor: 'pointer', transition: 'all .12s',
              }}>{s}</button>
            );
          })}
        </div>
      </div>
    ),
    // 2 — duration
    (
      <div key="q2">
        <div style={kicker}>Timeline · 3 of 6</div>
        <h2 style={h2}>How long has this been going on?</h2>
        <p style={sub}>An estimate is fine.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { d: 1, l: 'Started today' },
            { d: 3, l: 'A few days' },
            { d: 7, l: 'About a week' },
            { d: 14, l: 'Over a week' },
          ].map(opt => {
            const on = durationDays === opt.d;
            return (
              <button key={opt.d} type="button" onClick={() => setDurationDays(opt.d)} style={{
                flex: '1 1 calc(50% - 6px)', padding: '14px 16px', borderRadius: 12,
                border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                background: on ? '#e3f1ed' : '#fff', color: on ? 'var(--primary)' : 'var(--ink)',
                font: `600 14px ${FONT}`, cursor: 'pointer', textAlign: 'left',
              }}>{opt.l}</button>
            );
          })}
        </div>
      </div>
    ),
    // 3 — pain
    (
      <div key="q3">
        <div style={kicker}>Discomfort · 4 of 6</div>
        <h2 style={h2}>How much does it hurt?</h2>
        <p style={sub}>0 is none, 10 is the worst pain you can imagine.</p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ font: `700 36px ${FONT}`, color: 'var(--primary)' }}>{painLevel}</span>
          <span style={{ font: `600 15px ${FONT}`, color: 'var(--muted)' }}>{painWord(painLevel)}</span>
        </div>
        <input type="range" min={0} max={10} value={painLevel} onChange={e => setPainLevel(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} />
      </div>
    ),
    // 4 — red flags
    (
      <div key="q4">
        <div style={kicker}>Safety · 5 of 6</div>
        <h2 style={h2}>Any of these right now?</h2>
        <p style={sub}>Helps us know if you need to be seen immediately.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { checked: fever, set: setFever, l: 'Fever or chills' },
            { checked: chestPain, set: setChestPain, l: 'Chest tightness, pain, or pressure' },
            { checked: shortnessOfBreath, set: setShortnessOfBreath, l: 'Trouble catching your breath' },
          ].map(it => (
            <label key={it.l} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12,
              border: `1.5px solid ${it.checked ? 'var(--primary)' : 'var(--border)'}`,
              background: it.checked ? '#e3f1ed' : '#fff', cursor: 'pointer', font: `500 14px ${FONT}`, color: 'var(--ink)',
            }}>
              <input type="checkbox" checked={it.checked} onChange={e => it.set(e.target.checked)} style={{ width: 17, height: 17, accentColor: 'var(--primary)' }} />
              <span>{it.l}</span>
            </label>
          ))}
        </div>
      </div>
    ),
    // 5 — files
    (
      <div key="q5">
        <div style={kicker}>Optional · 6 of 6</div>
        <h2 style={h2}>Have a photo or report to share?</h2>
        <p style={sub}>A rash photo, lab report, or previous prescription helps the doctor prepare.</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {([['SYMPTOM_IMAGE', 'Photo'], ['PRIOR_PRESCRIPTION', 'Prescription'], ['LAB_REPORT', 'Lab report']] as const).map(([cat, label]) => (
            <button key={cat} type="button" onClick={() => setUploadCategory(cat)} style={{
              flex: 1, padding: '8px 10px', borderRadius: 8,
              border: `1px solid ${uploadCategory === cat ? 'var(--primary)' : 'var(--border)'}`,
              background: uploadCategory === cat ? '#e3f1ed' : '#fff', color: uploadCategory === cat ? 'var(--primary)' : 'var(--muted)',
              font: `600 12px ${FONT}`, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
        <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => handleFileUpload(e.target.files)} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{
          width: '100%', padding: '24px 16px', borderRadius: 12, border: '1.5px dashed #cfe0da',
          background: '#f8fbfa', cursor: 'pointer', font: `500 13px ${FONT}`, color: 'var(--muted)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          {uploading ? <Loader2 size={20} className="animate-spin" color="var(--primary)" /> : <Upload size={20} color="var(--primary)" />}
          <span>{uploading ? 'Uploading…' : 'Tap to choose file (JPG, PNG, PDF up to 10 MB)'}</span>
        </button>
        {attachments.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {attachments.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#e3f1ed', borderRadius: 8, font: `500 12px ${FONT}` }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)' }}><FileText size={14} />{a.fileName}</span>
                <button type="button" onClick={() => removeAttachment(a.id)} style={{ background: 'none', border: 'none', color: '#8aa39d', cursor: 'pointer', display: 'flex' }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
  ];

  return (
    <PageTransition>
      <CouponFeedbackModal
        successData={couponSuccessModal}
        errorData={couponErrorModal}
        onClose={() => {
          setCouponSuccessModal(null);
          setCouponErrorModal(null);
        }}
        onSelectCoupon={(code) => {
          setCouponErrorModal(null);
          handleApplyCoupon(code);
        }}
      />
      <div style={{ maxWidth: 880, margin: '48px auto', padding: '0 24px' }}>
        {/* Step Indicator Header (hidden in shortcut mode — steps 1 & 2 were bypassed) */}
        {!isShortcut && (
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, font: `600 13px ${FONT}`, color: 'var(--muted)' }}>
              {['1. Intake', '2. Review', '3. Book & Pay'].map((l, i) => (
                <span key={l} style={{ color: stepIdx >= i ? 'var(--primary)' : 'var(--ink-muted)', fontWeight: stepIdx === i ? 700 : 500 }}>
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1: Micro-Questions */}
        {step === 1 && (
          <div style={card}>
            <div style={{ height: 4, background: '#eef5f3', borderRadius: 2, overflow: 'hidden', marginBottom: 28 }}>
              <div style={{ height: '100%', width: `${((subStep + 1) / 6) * 100}%`, background: 'var(--primary)', transition: 'width .2s ease' }} />
            </div>

            {subQuestions[subStep]}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 30, paddingTop: 22, borderTop: '1px solid #eef5f3' }}>
              <button
                type="button"
                disabled={subStep === 0}
                onClick={() => setSubStep(s => Math.max(0, s - 1))}
                style={{ ...btnGhost, color: subStep === 0 ? '#c3d0cc' : 'var(--muted)', borderColor: subStep === 0 ? '#eef5f3' : '#cfe0da', cursor: subStep === 0 ? 'default' : 'pointer' }}
              >
                <ArrowLeft size={15} /> Back
              </button>
              {subStep < 5 ? (
                <button type="button" onClick={() => setSubStep(s => Math.min(5, s + 1))} style={btnPrimary}>
                  Next <ArrowRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={handleAssess} disabled={assessing} style={btnPrimary}>
                  {assessing ? <><Loader2 size={15} className="animate-spin" /> Checking…</> : <>Get recommendation <ArrowRight size={16} /></>}
                </button>
              )}
            </div>
            {triageError && <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', font: `400 13px ${FONT}` }}>{triageError}</div>}
          </div>
        )}

        {/* STEP 2: Urgency Review */}
        {step === 2 && assessment && (
          <div style={card}>
            <div style={{ font: `600 11px ${FONT}`, letterSpacing: '.09em', textTransform: 'uppercase', color: urgencyColor(assessment.urgency), marginBottom: 8 }}>
              {friendlyUrgency(assessment.urgency).label}
            </div>
            <p style={{ font: `500 17px/1.5 ${FONT}`, color: 'var(--ink)', letterSpacing: '-.005em', margin: '0 0 14px', maxWidth: 460 }}>
              {friendlyUrgency(assessment.urgency).message}
            </p>
            <div style={{ font: `400 13px ${FONT}`, color: 'var(--ink-muted)' }}>
              Recommended specialty: <strong style={{ color: 'var(--ink)' }}>{assessment.suggestedSpecialty}</strong>
            </div>

            {assessment.urgency === 'EMERGENCY' && (
              <div style={{ borderLeft: '3px solid var(--danger)', paddingLeft: 14, marginTop: 20, font: `600 14px/1.5 ${FONT}`, color: 'var(--danger)' }}>
                Call <strong>108 / 112</strong> now if you can't travel safely, or head to the nearest emergency room.
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', margin: '26px 0', padding: '20px 0' }}>
              <div style={{ font: `600 11px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 8 }}>What you told us</div>
              <p style={{ font: `400 13px/1.7 ${FONT}`, color: 'var(--muted)', margin: 0 }}>
                You told us: “{assessment.chiefComplaint}.”
                {assessment.symptoms.length > 0 && <> You mentioned {assessment.symptoms.join(', ').toLowerCase()}.</>}{' '}
                Pain {assessment.painLevel}/10, going on for {assessment.durationDays} day{assessment.durationDays === 1 ? '' : 's'}.
                {(assessment.chestPain || assessment.shortnessOfBreath) && <> You also flagged chest or breathing trouble.</>}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <button type="button" onClick={() => { setStep(1); setSubStep(5); }} style={btnGhost}><ArrowLeft size={15} /> Back</button>
              <button type="button" onClick={() => setStep(3)} style={btnPrimary}>Pick doctor & payment <ArrowRight size={16} /></button>
            </div>
          </div>
        )}

        {/* STEP 3: Doctor, Time, Coupons, and Razorpay Gateway */}
        {step === 3 && (assessment || isShortcut) && (
          <form onSubmit={handleLivePaymentBooking} style={card}>
            {isShortcut ? (
              <>
                <div style={{ display: 'inline-block', font: `600 10px ${FONT}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', background: '#e3f1ed', padding: '4px 10px', borderRadius: 9999, marginBottom: 12 }}>
                  Fast lane · {effectiveSpecialty}
                </div>
                <h2 style={h2}>Pick your doctor, time & checkout</h2>
                <p style={sub}>
                  You skipped the symptom check because you already know what you need.{' '}
                  <a href="/book" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                    Answer symptom questions instead
                  </a>
                </p>

                {/* EMERGENCY disclaimer — short, calm, not alarming unless needed */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 20, borderRadius: 10, background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.22)', color: '#92400e', font: `500 12.5px/1.4 ${FONT}` }}>
                  <span style={{ font: `700 14px ${FONT}`, marginTop: 1 }}>!</span>
                  <span>If this feels urgent — chest pain, trouble breathing, heavy bleeding, confusion — call <strong>108</strong> now, or <a href="/book" style={{ color: '#92400e', textDecoration: 'underline' }}>run a quick symptom check</a> first.</span>
                </div>

                {/* Required one-line intake */}
                <div style={{ marginBottom: 24 }}>
                  <label htmlFor="shortcut-intake" style={{ display: 'block', font: `600 13px ${FONT}`, color: 'var(--ink)', marginBottom: 8 }}>
                    One quick thing — why are you seeing a {effectiveSpecialty} today?
                  </label>
                  <textarea
                    id="shortcut-intake"
                    value={shortcutIntake}
                    onChange={e => { setShortcutIntake(e.target.value); if (shortcutIntakeError && e.target.value.trim()) setShortcutIntakeError(false); }}
                    placeholder="A sentence is plenty — e.g. 'Chest tightness after exercise for the past week.'"
                    rows={3}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 12,
                      border: `1px solid ${shortcutIntakeError ? 'var(--danger)' : 'var(--border)'}`,
                      background: '#fff', font: `400 14px/1.5 ${FONT}`, color: 'var(--ink)', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  {shortcutIntakeError && (
                    <div style={{ marginTop: 6, font: `400 12px ${FONT}`, color: 'var(--danger)' }}>The doctor needs at least a short sentence to prep for your visit.</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2 style={h2}>Pick your doctor, time & checkout</h2>
                <p style={sub}>Select your specialist, reserve a slot with 2-phase lock, and complete booking.</p>
              </>
            )}

            <div style={{ font: `600 13px ${FONT}`, color: 'var(--ink)', marginBottom: 9 }}>Consultation Mode</div>
            <div style={{ display: 'inline-flex', padding: 4, borderRadius: 9999, background: '#eef4f0', border: '1px solid var(--border)', gap: 2, marginBottom: 24 }}>
              {([['VIDEO', 'Video call', <Video size={14} />], ['IN_PERSON', 'In person', <MapPin size={14} />]] as const).map(([v, label, icon]) => {
                const on = consultationType === v;
                return (
                  <button key={v} type="button" onClick={() => setConsultationType(v)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9999, border: 'none',
                    background: on ? '#fff' : 'transparent', color: on ? 'var(--primary)' : 'var(--ink-muted)',
                    font: `${on ? 600 : 500} 13px ${FONT}`, cursor: 'pointer', boxShadow: on ? '0 1px 2px rgba(11,63,58,.08)' : 'none',
                  }}>{icon} {label}</button>
                );
              })}
            </div>

            <div style={{ font: `600 13px ${FONT}`, color: 'var(--ink)', marginBottom: 10 }}>Specialists in {effectiveSpecialty}</div>
            {doctorsLoading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}><Loader2 size={18} className="animate-spin" /> Loading specialists…</div>}
            {doctorsError && <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', font: `400 13px ${FONT}` }}>{doctorsError}</div>}
            {!doctorsLoading && !doctorsError && !doctors.length && <div style={{ padding: 16, color: 'var(--muted)' }}>No doctors available right now.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {doctors.map(doc => {
                const on = selectedDoctorId === doc.id;
                const expanded = expandedDoctorId === doc.id;
                /* The "More about Dr. X" row only shows when we have *something* to reveal.
                 * At a minimum every seeded doctor has a bio; profile extras (experience,
                 * languages, fee) appear when the doctor record has them set. */
                const hasExtra = !!(doc.bio || doc.yearsExperience || doc.consultationFee || doc.languages || (doc.reviewCount ?? 0) > 0);
                /* "Dr. Robert Chen, FACC" → "Dr. Robert Chen" (strip credentials after the comma) */
                const shortName = doc.fullName.replace(/,.*$/, '').trim();
                return (
                  <div key={doc.id} style={{
                    borderRadius: 14,
                    border: on ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: on ? '#e3f1ed' : '#fff',
                    overflow: 'hidden',
                  }}>
                    {/* Top row — selectable */}
                    <button type="button" onClick={() => setSelectedDoctorId(doc.id)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                      padding: '14px 18px', cursor: 'pointer', textAlign: 'left',
                      border: 'none', background: 'transparent', fontFamily: 'inherit',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                        {doc.avatarUrl
                          ? <img src={doc.avatarUrl} alt={doc.fullName} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                          : <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#e3f1ed', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 14px ${FONT}` }}>{doc.fullName.replace('Dr. ', '').split(' ').map(s => s[0]).join('').slice(0, 2)}</span>}
                        <span>
                          <span style={{ display: 'block', font: `600 15px ${FONT}`, color: 'var(--ink)' }}>{doc.fullName}</span>
                          <span style={{ display: 'block', font: `400 13px ${FONT}`, color: 'var(--ink-muted)' }}>{doc.specialty} · {doc.hospital}</span>
                        </span>
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', font: `600 13px ${FONT}`, color: '#d97706' }}>★ {Number(doc.rating).toFixed(1)}</span>
                        <span style={{ display: 'block', font: `500 12px ${FONT}`, color: 'var(--ink-muted)' }}>{on ? (slotsLoading ? '…' : `${availableSlots.length} open`) : `${doc.openSlotCount} open`} slots</span>
                      </span>
                    </button>

                    {/* "More about Dr. X" toggle */}
                    {hasExtra && (
                      <div style={{ padding: '0 18px 10px', textAlign: 'right' }}>
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); setExpandedDoctorId(expanded ? '' : doc.id); }}
                          aria-expanded={expanded}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px',
                            font: `600 12px ${FONT}`, color: 'var(--primary)',
                          }}>
                          {expanded ? '▴ Less' : `▾ More about ${shortName}`}
                        </button>
                      </div>
                    )}

                    {/* Expanded details panel */}
                    {expanded && hasExtra && (
                      <div style={{
                        padding: '14px 18px',
                        borderTop: '1px dashed var(--border)',
                        background: on ? 'rgba(255,255,255,.4)' : 'var(--canvas)',
                        font: `400 13px/1.55 ${FONT}`, color: 'var(--ink)',
                      }}>
                        {/* Quick-facts row */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginBottom: doc.bio ? 10 : 0 }}>
                          {doc.yearsExperience != null && (
                            <span><strong>{doc.yearsExperience}</strong> yrs experience</span>
                          )}
                          {doc.languages && (
                            <span>Speaks <strong>{doc.languages}</strong></span>
                          )}
                          {doc.consultationFee != null && (
                            <span>Consultation ₹<strong>{Number(doc.consultationFee).toFixed(0)}</strong></span>
                          )}
                          {(doc.reviewCount ?? 0) > 0 && (
                            <span><strong>{doc.reviewCount}</strong> patient reviews</span>
                          )}
                        </div>
                        {doc.bio && (
                          <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{doc.bio}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ font: `600 13px ${FONT}`, color: 'var(--ink)', margin: '24px 0 10px' }}>Pick Consultation Day</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, scrollSnapType: 'x mandatory' }}>
              {scheduleDays.map(day => {
                const on = selectedDayISO === day.dateISO, has = day.slots.length > 0;
                return (
                  <button key={day.dateISO} type="button" onClick={() => setSelectedDayISO(day.dateISO)} style={{
                    flex: '0 0 auto', minWidth: 92, padding: '11px 12px', borderRadius: 14, cursor: 'pointer', textAlign: 'center', scrollSnapAlign: 'start',
                    border: on ? '2px solid var(--primary)' : '1px solid var(--border)', background: on ? '#e3f1ed' : '#fff',
                  }}>
                    <span style={{ display: 'block', font: `700 12px ${FONT}`, textTransform: 'uppercase', letterSpacing: '.04em', color: on ? 'var(--primary)' : 'var(--ink)' }}>{day.dayName}</span>
                    <span style={{ display: 'block', font: `600 12px ${FONT}`, color: on ? 'var(--primary)' : 'var(--ink-muted)', marginTop: 2 }}>{day.dateFormatted}</span>
                    <span style={{
                      display: 'inline-block', marginTop: 7, padding: '2px 9px', borderRadius: 9999, font: `600 11px ${FONT}`,
                      background: has ? (on ? 'var(--primary)' : '#e3f1ed') : day.isWeekend ? 'rgba(220,38,38,.1)' : 'rgba(148,163,184,.15)',
                      color: has ? (on ? '#fff' : 'var(--primary)') : day.isWeekend ? 'var(--danger)' : 'var(--ink-muted)',
                    }}>{has ? `${day.slots.length} open` : day.isWeekend ? 'Holiday' : 'No slots'}</span>
                  </button>
                );
              })}
            </div>

            {/* Time Slot Picker with Redis 2-Phase Concurrency Hold */}
            <div style={{ marginTop: 14, padding: 18, borderRadius: 14, background: 'var(--canvas)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: `600 13px ${FONT}`, color: 'var(--ink)', marginBottom: 12 }}>
                <span>Open times — {currentDay ? `${currentDay.weekday}, ${currentDay.dateFormatted}` : ''}</span>
                {reservingSlot ? (
                  <span style={{ font: `500 12px ${FONT}`, color: '#0f766e', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Loader2 size={12} className="animate-spin" /> Reserving soft hold…
                  </span>
                ) : slotsLoading ? (
                  <span style={{ font: `500 12px ${FONT}`, color: 'var(--ink-muted)' }}><Loader2 size={12} className="animate-spin" /> Updating…</span>
                ) : null}
              </div>
              {currentDaySlots.length === 0 ? (
                <div style={{ padding: 16, border: '1px dashed #cbddd7', borderRadius: 10, background: '#fff', textAlign: 'center' }}>
                  <div style={{ font: `700 14px ${FONT}`, color: 'var(--danger)', marginBottom: 4 }}>{currentDay?.isWeekend ? 'Weekend clinic holiday' : 'No open slots'}</div>
                  <div style={{ font: `400 13px/1.5 ${FONT}`, color: 'var(--muted)' }}>
                    {currentDay?.isWeekend ? 'Clinics are closed on weekends. Try a weekday — slots are open Mon–Fri.' : 'All times here are booked. Try another day from the strip above.'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                  {currentDaySlots.map(slot => {
                    const on = selectedSlotId === slot.id;
                    const isHeldByOther = slot.onHold && !slot.heldByYou;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => handleSlotClick(slot)}
                        disabled={isHeldByOther || reservingSlot}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 9999,
                          font: `600 13px ${FONT}`, cursor: isHeldByOther ? 'not-allowed' : 'pointer',
                          border: `1.5px solid ${on ? 'var(--primary)' : isHeldByOther ? '#fca5a5' : 'var(--border)'}`,
                          background: on ? 'var(--primary)' : isHeldByOther ? '#fef2f2' : '#fff',
                          color: on ? '#fff' : isHeldByOther ? '#dc2626' : 'var(--ink)',
                          opacity: isHeldByOther ? 0.7 : 1,
                        }}
                      >
                        <Clock size={13} color={on ? '#fff' : isHeldByOther ? '#dc2626' : '#0f766e'} />
                        {normalizeSlotTime(new Date(slot.slotAt))}
                        {isHeldByOther && <span style={{ fontSize: 10, fontWeight: 700 }}>(Hold)</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Slot Reservation Timer Notice */}
              {selectedSlot && holdSecondsRemaining !== null && holdSecondsRemaining > 0 && (
                <div style={{
                  marginTop: 14, padding: '10px 14px', borderRadius: 10,
                  backgroundColor: '#f0fdf9', border: '1px solid #a7f3d0',
                  color: '#065f46', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    <Lock size={14} color="#059669" /> Slot exclusively reserved for you
                  </span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>
                    {Math.floor(holdSecondsRemaining / 60)}:{String(holdSecondsRemaining % 60).padStart(2, '0')}
                  </span>
                </div>
              )}

              {slotReservationMessage && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', fontSize: 13 }}>
                  {slotReservationMessage}
                </div>
              )}
            </div>

            {/* Discount Coupon & Pricing Engine */}
            <div style={{ marginTop: 20, padding: 18, borderRadius: 14, background: '#f8faf9', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ font: `600 13px ${FONT}`, color: 'var(--ink)' }}>Consultation Fee</span>
                <span style={{ font: `700 15px ${FONT}`, color: 'var(--ink)' }}>₹500.00</span>
              </div>

              {/* Coupon Row */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  type="text"
                  placeholder="Promo code (e.g. PULSE50, HEALTH1)"
                  value={couponInput}
                  onChange={e => setCouponInput(e.target.value.toUpperCase())}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid #cfe0da',
                    fontSize: 13, fontFamily: FONT, outline: 'none',
                  }}
                />
                {appliedCoupon ? (
                  <button type="button" onClick={handleRemoveCoupon} style={{ ...btnGhost, padding: '8px 14px', minHeight: 38, fontSize: 12 }}>
                    Remove
                  </button>
                ) : (
                  <button type="button" onClick={() => handleApplyCoupon()} style={{ ...btnPrimary, padding: '8px 16px', minHeight: 38, fontSize: 12 }}>
                    <Tag size={13} /> Apply
                  </button>
                )}
              </div>

              {couponSuccess && <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 6 }}>{couponSuccess}</div>}
              {couponError && <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginTop: 6 }}>{couponError}</div>}

              {/* Demo Coupon Pill Shortcuts */}
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, alignSelf: 'center' }}>Demo:</span>
                {TEST_COUPONS.slice(0, 4).map(c => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleApplyCoupon(c.code)}
                    style={{
                      border: '1px dashed #0f766e', background: '#f0fdf9', color: '#0f766e',
                      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {c.code} ({c.badge})
                  </button>
                ))}
              </div>

              {/* Final Payable */}
              <div style={{ borderTop: '1px solid #e2ece8', marginTop: 14, paddingTop: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ font: `700 14px ${FONT}`, color: 'var(--ink)' }}>Total Payable</span>
                  {discountPaise > 0 && <span style={{ fontSize: 12, color: '#059669', marginLeft: 8 }}>(Saved ₹{(discountPaise / 100).toFixed(2)})</span>}
                </div>
                <span style={{ font: `800 24px ${FONT}`, color: '#0f766e' }}>
                  ₹{(payablePaise / 100).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Patient Phone Verification Input */}
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', font: `600 12px ${FONT}`, color: 'var(--ink)', marginBottom: 6 }}>
                Mobile Number for WhatsApp & SMS Receipt
              </label>
              <input
                type="tel"
                value={patientPhone}
                onChange={e => setPatientPhone(e.target.value)}
                placeholder="+919876543210"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cfe0da',
                  font: `500 14px ${FONT}`, outline: 'none', background: '#f8faf9',
                }}
              />
            </div>

            {/* Summary Line */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)', font: `500 13px ${FONT}`, color: 'var(--muted)' }}>
              {selectedDoctor && selectedSlot
                ? `${effectiveSpecialty} · ${selectedDoctor.fullName} · ${formatSlot(selectedSlot.slotAt)} · ${consultationType === 'VIDEO' ? 'Video call' : 'In person'}`
                : 'Pick a specialist, day, and time slot to finalize.'}
            </div>

            {bookingError && <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', font: `400 13px ${FONT}` }}>{bookingError}</div>}

            {/* Dual Action Buttons: Live Razorpay & Instant Test */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setStep(2)} style={btnGhost}><ArrowLeft size={15} /> Back</button>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {/* Instant Test Mode Button */}
                <button
                  type="button"
                  onClick={handleTestBooking}
                  disabled={booking || !selectedDoctorId || !selectedSlotId}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px',
                    borderRadius: 12, border: '1.5px solid #0f766e', color: '#0f766e', background: '#f0fdf9',
                    font: `600 13px ${FONT}`, cursor: (booking || !selectedSlotId) ? 'not-allowed' : 'pointer', minHeight: 46,
                  }}
                  title="Bypass Razorpay checkout modal and confirm immediately for fast testing"
                >
                  {booking ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} color="#0f766e" />}
                  <span>Instant Test (₹{(payablePaise / 100).toFixed(2)})</span>
                </button>

                {/* Live Razorpay Gateway Button */}
                <button
                  type="submit"
                  disabled={booking || !selectedDoctorId || !selectedSlotId}
                  style={{
                    ...btnPrimary,
                    background: (booking || !selectedSlotId) ? '#9fc3bd' : 'var(--primary)',
                    cursor: (booking || !selectedSlotId) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {booking ? (
                    <><Loader2 size={16} className="animate-spin" /> Processing…</>
                  ) : payablePaise === 0 ? (
                    <><Check size={16} /> Confirm Free Consultation</>
                  ) : (
                    <><CreditCard size={16} /> Pay ₹{(payablePaise / 100).toFixed(2)} via Razorpay</>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </PageTransition>
  );
};
