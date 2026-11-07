import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, Loader2, CheckCircle2, Video, MapPin,
  Upload, FileText, Trash2, Clock,
} from 'lucide-react';
import type {
  Appointment, Attachment, ConsultationType, Doctor, Slot, TriageAssessment, User,
} from '../types';
import { appointmentsApi, doctorsApi, triageApi, filesApi } from '../services/api';
import { PageTransition } from '../motion/PageTransition';
import { CustomCheckbox } from './CustomCheckbox';

/* ------------------------------------------------------------------ *
 * "Book a Visit" — one-at-a-time redesign.
 * Step 1 is split into six calm micro-questions; Steps 2 & 3 stay single
 * screens. Palette / type / icons unchanged from the rest of PulseCare.
 * Design spec: "Book Visit — Handoff Notes".
 * ------------------------------------------------------------------ */

interface PatientTriageBookingProps {
  currentUser: User | null;
}

/* Patient-friendly symptom chips (no clinical jargon, no "+" prefix). */
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

/** Warm, patient-facing wording — the chip label still carries the raw level. */
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

/* --- body-map / specialty pre-fill (unchanged from the original) --- */
export interface SpotIntakePreset {
  label: string; chiefComplaint: string; selectedSymptoms: string[];
  durationDays: number; painLevel: number; fever: boolean; chestPain: boolean; shortnessOfBreath: boolean;
}
const DEFAULT_PRESET: SpotIntakePreset = {
  label: '', chiefComplaint: '', selectedSymptoms: [],
  durationDays: 2, painLevel: 4, fever: false, chestPain: false, shortnessOfBreath: false,
};
/* Keep your existing SPOT_INTAKE_PRESETS / resolveSpotKey / inferPresetFromComplaint
 * here (omitted for brevity) — they already live in the current file and need no change. */
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

/* ------------------------------------------------------------------ *
 * Body-map hotspot → intake preset.
 * BodyMapHero navigates here with ?hotspot=<key> (or ?focus=), or drops
 * the key in sessionStorage under 'pulsecare_pending_hotspot' when the
 * user wasn't signed in yet. resolveSpotKey does a fuzzy match so
 * "cardiac" → "chest", "migraine" → "head", etc.
 * ------------------------------------------------------------------ */
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
  joints: {
    label: 'Joints',
    chiefComplaint: 'Swollen, stiff joints that are worse in the morning.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 7, painLevel: 5, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  skin: {
    label: 'Skin',
    chiefComplaint: 'Red, itchy rash spreading across the forearm; no known trigger.',
    selectedSymptoms: ['Rash'],
    durationDays: 4, painLevel: 3, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  reproductive: {
    label: 'Reproductive & Urinary',
    chiefComplaint: 'Lower-pelvic discomfort with irregular menstrual cycle.',
    selectedSymptoms: ['Stomach pain'],
    durationDays: 10, painLevel: 4, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  knee: {
    label: 'Knee',
    chiefComplaint: 'Knee pain and swelling after a fall; hard to put weight on it.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 2, painLevel: 7, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  ankle: {
    label: 'Ankle',
    chiefComplaint: 'Twisted ankle — swollen and painful when bearing weight.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 1, painLevel: 6, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  neck_back: {
    label: 'Neck & Back',
    chiefComplaint: 'Dull back pain with stiffness that worsens through the day.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 5, painLevel: 5, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  upper_back: {
    label: 'Upper Back',
    chiefComplaint: 'Upper-back tightness between the shoulder blades.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 4, painLevel: 5, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  lower_back: {
    label: 'Lower Back',
    chiefComplaint: 'Lower back ache radiating down one leg.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 6, painLevel: 6, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  hips_back: {
    label: 'Hips & Back',
    chiefComplaint: 'Hip pain that flares with walking or climbing stairs.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 7, painLevel: 5, fever: false, chestPain: false, shortnessOfBreath: false,
  },
  calf: {
    label: 'Calf',
    chiefComplaint: 'Calf tenderness and mild swelling after a long flight.',
    selectedSymptoms: ['Joint swelling'],
    durationDays: 2, painLevel: 5, fever: false, chestPain: false, shortnessOfBreath: false,
  },
};

/** Fuzzy match the hotspot string coming from BodyMapHero to a preset key. */
function resolveSpotKey(raw: string): string | null {
  if (!raw) return null;
  const k = raw.toLowerCase().trim();
  if (SPOT_INTAKE_PRESETS[k]) return k;
  if (/(chest|heart|cardiac|angina|lung)/.test(k)) return 'chest';
  if (/(head|migraine|face|skull)/.test(k)) return 'head';
  if (/(mental|mood|mind|anxiety|depress|psych)/.test(k)) return 'mental';
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

export const PatientTriageBooking: React.FC<PatientTriageBookingProps> = ({ currentUser: _currentUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* Prefill chain, in priority order:
   *   1. ?hotspot= / ?focus= URL param (body-map figure click)
   *   2. sessionStorage['pulsecare_pending_hotspot'] (clicked pre-login)
   *   3. ?complaint= URL param (free text from hero search)
   *   4. sessionStorage['pulsecare_pending_complaint']
   *   5. DEFAULT_PRESET (blank)
   */
  const initialPreset = useMemo<SpotIntakePreset>(() => {
    let hotspotKey = searchParams.get('hotspot') || searchParams.get('focus') || '';
    if (!hotspotKey) {
      try {
        const stored = sessionStorage.getItem('pulsecare_pending_hotspot');
        if (stored) { hotspotKey = stored; sessionStorage.removeItem('pulsecare_pending_hotspot'); }
      } catch { /* sessionStorage may be unavailable */ }
    }
    const resolved = resolveSpotKey(hotspotKey);
    if (resolved && SPOT_INTAKE_PRESETS[resolved]) return SPOT_INTAKE_PRESETS[resolved];

    let complaint = searchParams.get('complaint') || '';
    if (!complaint) {
      try {
        const stored = sessionStorage.getItem('pulsecare_pending_complaint');
        if (stored) { complaint = stored; sessionStorage.removeItem('pulsecare_pending_complaint'); }
      } catch { /* ignore */ }
    }
    if (complaint) return inferPresetFromComplaint(complaint);
    return DEFAULT_PRESET;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [subStep, setSubStep] = useState(0); // 0..5 within Step 1

  // Step 1 fields
  const [chiefComplaint, setChiefComplaint] = useState(initialPreset.chiefComplaint);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(initialPreset.selectedSymptoms);
  const [durationDays, setDurationDays] = useState(initialPreset.durationDays);
  const [painLevel, setPainLevel] = useState(initialPreset.painLevel);
  const [fever, setFever] = useState(initialPreset.fever);
  const [chestPain, setChestPain] = useState(initialPreset.chestPain);
  const [shortnessOfBreath, setShortnessOfBreath] = useState(initialPreset.shortnessOfBreath);
  const [prefillLabel] = useState(initialPreset.label);
  const [complaintError, setComplaintError] = useState(false);

  // Attachments (inline in Step 1, q6)
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadCategory, setUploadCategory] = useState<UploadCategory>('SYMPTOM_IMAGE');
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2
  const [assessment, setAssessment] = useState<TriageAssessment | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);

  // Step 3
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [doctorSlots, setDoctorSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDayISO, setSelectedDayISO] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [consultationType, setConsultationType] = useState<ConsultationType>('VIDEO');
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);

  const toggleSymptom = (s: string) =>
    setSelectedSymptoms(p => (p.includes(s) ? p.filter(x => x !== s) : [...p, s]));

  /* ----------------------- attachments ----------------------- */
  const processFiles = async (files: FileList | File[]) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds 10MB`);
        const uploaded = await filesApi.upload(file, uploadCategory);
        setAttachments(p => [...p, uploaded]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const removeAttachment = (id: string) => setAttachments(p => p.filter(a => a.id !== id));

  /* ----------------------- triage ----------------------- */
  const handleAssess = async () => {
    if (!chiefComplaint.trim()) { setComplaintError(true); setSubStep(0); return; }
    setAssessing(true); setTriageError(null);
    try {
      const result = await triageApi.assess({
        chiefComplaint, symptoms: selectedSymptoms, durationDays, painLevel,
        fever, chestPain, shortnessOfBreath,
      });
      setAssessment(result); setStep(2);
    } catch (err: any) {
      setTriageError(err.message || 'Triage service is unavailable');
    } finally { setAssessing(false); }
  };

  /* -------------------- doctors (on entering step 3) -------------------- */
  useEffect(() => {
    if (step !== 3) return;
    setDoctorsLoading(true); setDoctorsError(null);
    const specialty = assessment?.suggestedSpecialty;
    doctorsApi.list(specialty)
      .then(list => (list.length === 0 && specialty ? doctorsApi.list() : list))
      .then(list => { setDoctors(list); if (list.length) setSelectedDoctorId(list[0].id); })
      .catch(err => setDoctorsError(err.message || 'Failed to load doctors'))
      .finally(() => setDoctorsLoading(false));
  }, [step, assessment?.suggestedSpecialty]);

  const selectedDoctor = useMemo(
    () => doctors.find(d => d.id === selectedDoctorId) || null,
    [doctors, selectedDoctorId],
  );

  /* -------------------- slots for selected doctor -------------------- */
  useEffect(() => {
    if (!selectedDoctorId) { setDoctorSlots([]); return; }
    setSlotsLoading(true);
    doctorsApi.slots(selectedDoctorId)
      .then(slots => setDoctorSlots(Array.isArray(slots) ? slots : []))
      .catch(() => setDoctorSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDoctorId]);

  // Open, future, weekday-only slots (weekends are holidays).
  const availableSlots = useMemo(() => {
    const now = new Date();
    return doctorSlots.filter(s => {
      if (s.booked) return false;
      const d = new Date(s.slotAt);
      if (isNaN(d.getTime()) || d < now) return false;
      const dow = d.getDay();
      return dow !== 0 && dow !== 6;
    });
  }, [doctorSlots]);

  // Rolling 7-day schedule grouped by day.
  const scheduleDays = useMemo(() => {
    const map = new Map<string, { dateISO: string; dayName: string; dateFormatted: string; weekday: string; isWeekend: boolean; slots: Slot[] }>();
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const iso = getSlotDateISO(d);
      map.set(iso, {
        dateISO: iso,
        dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' }),
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

  // Auto-pick first day with slots.
  useEffect(() => {
    if (!scheduleDays.length) return;
    const cur = scheduleDays.find(d => d.dateISO === selectedDayISO);
    if (!cur) {
      const first = scheduleDays.find(d => d.slots.length) || scheduleDays[0];
      setSelectedDayISO(first.dateISO);
      setSelectedSlotId(first.slots[0]?.id ?? '');
    } else if (!cur.slots.some(s => s.id === selectedSlotId)) {
      setSelectedSlotId(cur.slots[0]?.id ?? '');
    }
  }, [scheduleDays, selectedDayISO, selectedSlotId]);

  const currentDay = scheduleDays.find(d => d.dateISO === selectedDayISO);
  const currentDaySlots = currentDay?.slots ?? [];
  const selectedSlot = availableSlots.find(s => s.id === selectedSlotId) || null;

  /* ----------------------- book ----------------------- */
  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedSlotId) { setBookingError('Pick a doctor and a time first.'); return; }
    setBooking(true); setBookingError(null);
    try {
      const booked = await appointmentsApi.book({
        doctorId: selectedDoctorId, slotId: selectedSlotId,
        assessmentId: assessment?.id, consultationType,
        attachmentIds: attachments.map(a => a.id),
      });
      setConfirmed(booked);
    } catch (err: any) {
      setBookingError(err.message || 'Could not book this slot. Try another.');
    } finally { setBooking(false); }
  };

  /* =========================== styles =========================== */
  const card: React.CSSProperties = {
    maxWidth: 560, margin: '0 auto', background: '#fff', border: '1px solid var(--border)',
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
      <PageTransition>
        <div style={{ maxWidth: 880, margin: '48px auto', padding: '0 24px' }}>
          <div style={{ ...card, position: 'relative', overflow: 'hidden', textAlign: 'center', padding: '48px 36px' }}>
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i} style={{
                position: 'absolute', top: -10, left: `${4 + i * 5.3}%`, width: 8,
                height: 8 + (i % 3) * 4, borderRadius: 2,
                background: ['#0f766e', '#d97706', '#059669', '#ff6b5b', '#0b3f3a'][i % 5],
                opacity: 0, animation: `bv-confetti ${2.4 + (i % 4) * 0.3}s ease-in ${i * 0.08}s infinite`,
              }} />
            ))}
            <div style={{ position: 'relative' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e3f1ed', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle2 size={34} />
              </div>
              <h1 style={{ font: `700 26px/1.2 ${FONT}`, color: 'var(--ink)', letterSpacing: '-.02em', margin: '0 0 10px' }}>You're booked.</h1>
              <p style={{ font: `400 15px/1.6 ${FONT}`, color: 'var(--muted)', margin: '0 auto 26px', maxWidth: 380 }}>
                Your intake is attached to the record for <strong>{confirmed.doctorName}</strong>. We've sent the details to your phone.
              </p>
              <div style={{ textAlign: 'left', background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'grid', gap: 9, font: `500 13px ${FONT}`, color: 'var(--muted)', marginBottom: 24 }}>
                <div><strong style={{ color: 'var(--ink)' }}>Doctor</strong> · {confirmed.doctorName} · {confirmed.doctorHospital}</div>
                <div><strong style={{ color: 'var(--ink)' }}>When</strong> · {confirmed.slotAt ? formatSlot(confirmed.slotAt) : 'TBA'}</div>
                <div><strong style={{ color: 'var(--ink)' }}>How</strong> · {confirmed.consultationType === 'VIDEO' ? 'Video call' : 'In person'}</div>
                <div><strong style={{ color: 'var(--ink)' }}>Specialty</strong> · {confirmed.doctorSpecialty}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={() => navigate('/appointments')} style={btnGhost}>View appointments</button>
                <button onClick={() => navigate('/patient')} style={btnPrimary}>Back to dashboard</button>
              </div>
              <div style={{ marginTop: 20, font: `500 12px ${FONT}`, color: 'var(--ink-muted)' }}>
                A real doctor reviews every booking — a guide, not a diagnosis.
              </div>
            </div>
          </div>
        </div>
      </PageTransition>
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
        {complaintError && <div style={{ marginTop: 8, font: `500 13px ${FONT}`, color: 'var(--danger)' }}>Tell us a little about what's wrong first.</div>}
      </div>
    ),
    // 1 — duration
    (
      <div key="q1">
        <div style={kicker}>About you · 2 of 6</div>
        <h2 style={h2}>How long has this been going on?</h2>
        <p style={sub}>Roughly — a best guess is fine.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="number" min={0} max={90} value={durationDays}
            onChange={e => setDurationDays(Math.max(0, Number(e.target.value) || 0))}
            style={{ width: 96, padding: '14px 16px', border: '1.5px solid var(--border)', borderRadius: 10, font: `600 18px ${FONT}`, color: 'var(--ink)', background: '#f8fbfa', outline: 'none', textAlign: 'center' }}
          />
          <span style={{ font: `500 15px ${FONT}`, color: 'var(--muted)' }}>{durationDays === 1 ? 'day' : 'days'}</span>
        </div>
      </div>
    ),
    // 2 — symptoms
    (
      <div key="q2">
        <div style={kicker}>About you · 3 of 6</div>
        <h2 style={h2}>Any of these feel familiar?</h2>
        <p style={sub}>Tap anything that fits — or skip it.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
          {COMMON_SYMPTOMS.map(s => {
            const on = selectedSymptoms.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggleSymptom(s)} style={{
                padding: '10px 17px', borderRadius: 9999, font: `${on ? 600 : 500} 13px ${FONT}`, cursor: 'pointer',
                border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                background: on ? '#e3f1ed' : '#f8fbfa', color: on ? 'var(--primary)' : 'var(--muted)',
              }}>{on ? '✓ ' : ''}{s}</button>
            );
          })}
        </div>
      </div>
    ),
    // 3 — red flags
    (
      <div key="q3">
        <div style={kicker}>About you · 4 of 6</div>
        <h2 style={h2}>Any of these happening right now?</h2>
        <p style={sub}>Only tick what's true — it helps us know how fast to act.</p>
        <div style={{ borderLeft: '3px solid #c0392b', paddingLeft: 16, display: 'grid', gap: 8 }}>
          <CustomCheckbox checked={chestPain} onChange={setChestPain} color="#c0392b" label="Chest pain or pressure (especially if it spreads to the arm)" />
          <CustomCheckbox checked={shortnessOfBreath} onChange={setShortnessOfBreath} color="#c0392b" label="Really struggling to breathe, even while resting" />
          <CustomCheckbox checked={fever} onChange={setFever} color="#c0392b" label="A high fever (above 101.5°F / 38.6°C)" />
        </div>
      </div>
    ),
    // 4 — pain
    (
      <div key="q4">
        <div style={kicker}>About you · 5 of 6</div>
        <h2 style={h2}>How bad is the pain?</h2>
        <p style={sub}>Slide to roughly where it sits today.</p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ font: `700 34px ${FONT}`, color: painLevel >= 8 ? 'var(--danger)' : 'var(--primary)', letterSpacing: '-.02em' }}>
            {painLevel}<span style={{ fontSize: 17, color: 'var(--ink-muted)' }}>/10</span>
          </span>
          <span style={{ font: `600 15px ${FONT}`, color: painLevel >= 8 ? 'var(--danger)' : 'var(--muted)' }}>{painWord(painLevel)}</span>
        </div>
        <input type="range" min={0} max={10} value={painLevel} onChange={e => setPainLevel(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer', accentColor: painLevel >= 8 ? 'var(--danger)' : 'var(--primary)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, font: `500 11px ${FONT}`, color: '#b2c4bf' }}>
          <span>None</span><span>Moderate</span><span>Unbearable</span>
        </div>
      </div>
    ),
    // 5 — attachments
    (
      <div key="q5">
        <div style={kicker}>About you · 6 of 6</div>
        <h2 style={h2}>Add anything helpful</h2>
        <p style={sub}>Photos, an old prescription, a lab report. Optional.</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {([['SYMPTOM_IMAGE', 'Photo'], ['PRIOR_PRESCRIPTION', 'Prescription'], ['LAB_REPORT', 'Report']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setUploadCategory(id)} style={{
              padding: '4px 11px', borderRadius: 9999, font: `${uploadCategory === id ? 600 : 500} 11px ${FONT}`, cursor: 'pointer',
              border: `1px solid ${uploadCategory === id ? 'var(--primary)' : 'var(--border)'}`,
              background: uploadCategory === id ? 'var(--primary)' : 'transparent',
              color: uploadCategory === id ? '#fff' : 'var(--muted)',
            }}>{label}</button>
          ))}
        </div>
        <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" style={{ display: 'none' }}
          onChange={e => e.target.files && processFiles(e.target.files)} />
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
          onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files); }}
          style={{
            border: `1.5px dashed ${isDragging ? 'var(--primary)' : '#9cc3ba'}`, borderRadius: 12,
            background: isDragging ? '#e8f4f0' : '#f4faf8', padding: '26px 16px', textAlign: 'center',
            cursor: uploading ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
          }}
        >
          {uploading ? <Loader2 size={24} className="animate-spin" color="#0f766e" /> : <Upload size={24} color="#0f766e" />}
          <span style={{ font: `600 13px ${FONT}`, color: 'var(--ink)' }}>
            {uploading ? 'Uploading…' : isDragging ? 'Drop to upload' : 'Drag & drop, or tap to add'}
          </span>
          <span style={{ font: `500 11px ${FONT}`, color: 'var(--ink-muted)' }}>JPEG, PNG or PDF · up to 10MB</span>
        </div>
        {attachments.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 10, background: '#fff' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9, font: `600 12px ${FONT}`, color: 'var(--ink)', overflow: 'hidden' }}>
              <FileText size={16} color="#0f766e" />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{a.fileName}</span>
            </span>
            <button type="button" onClick={() => removeAttachment(a.id)} style={{ background: 'none', border: 'none', color: '#8aa39d', cursor: 'pointer', display: 'flex' }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    ),
  ];

  return (
    <PageTransition>
      <style>{`
        @keyframes bv-confetti{0%{opacity:0;transform:translateY(-10px) rotate(0)}10%{opacity:1}100%{opacity:0;transform:translateY(320px) rotate(540deg)}}
        @keyframes bv-qin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion: reduce){.bv-q{animation:none!important}}
      `}</style>
      <div style={{ maxWidth: 880, margin: '48px auto', padding: '0 24px' }}>

        {/* progress line */}
        <div style={{ maxWidth: 560, margin: '0 auto 40px' }} aria-hidden>
          <div style={{ font: `600 10px ${FONT}`, letterSpacing: '.16em', color: 'var(--ink-muted)', textTransform: 'uppercase', textAlign: 'center', marginBottom: 18 }}>Book a visit</div>
          <div style={{ position: 'relative', height: 24 }}>
            <div style={{ position: 'absolute', top: 11, left: 12, right: 12, height: 2, background: '#d6e2db', borderRadius: 2 }} />
            <div style={{ position: 'absolute', top: 11, left: 12, height: 2, background: 'var(--primary)', borderRadius: 2, width: `calc((100% - 24px) * ${stepIdx / 2})`, transition: 'width 340ms cubic-bezier(.2,.65,.3,.9)' }} />
            {[1, 2, 3].map(n => {
              const done = n - 1 < stepIdx, cur = n - 1 === stepIdx;
              return (
                <button key={n} type="button" disabled={n - 1 >= stepIdx} onClick={() => n < step && setStep(n as 1 | 2 | 3)} style={{
                  position: 'absolute', top: 0, left: n === 1 ? 0 : n === 2 ? 'calc(50% - 12px)' : 'calc(100% - 24px)',
                  width: 24, height: 24, borderRadius: '50%', font: `700 11px ${FONT}`, padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: n < step ? 'pointer' : 'default',
                  border: cur ? '2px solid var(--primary)' : done ? 'none' : '1px solid #d6e2db',
                  background: done ? 'var(--primary)' : '#fff', color: done ? '#fff' : cur ? 'var(--primary)' : '#9aa89f',
                }}>{n}</button>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, font: `500 12px ${FONT}` }}>
            {['Your symptoms', 'Recommendation', 'Pick a time'].map((l, i) => (
              <span key={l} style={{ color: stepIdx >= i ? 'var(--ink)' : 'var(--ink-muted)', fontWeight: stepIdx === i ? 600 : 400 }}>{l}</span>
            ))}
          </div>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ ...card, padding: '36px 36px 30px', minHeight: 400, display: 'flex', flexDirection: 'column' }}>
            {prefillLabel && (
              <div style={{ borderLeft: '2px solid var(--primary)', paddingLeft: 12, marginBottom: 22, font: `500 12px/1.5 ${FONT}`, color: 'var(--muted)' }}>
                Pre-filled for <strong style={{ color: 'var(--ink)' }}>{prefillLabel}</strong>. Change anything that doesn't fit.
              </div>
            )}
            <div style={{ display: 'flex', gap: 5, marginBottom: 26 }}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ height: 4, borderRadius: 2, transition: 'all 240ms ease', flex: i === subStep ? 2 : 1, background: i === subStep ? 'var(--primary)' : i < subStep ? '#9fcabf' : '#e3ece9' }} />
              ))}
            </div>

            <div style={{ flex: 1 }}>
              <div className="bv-q" key={subStep} style={{ animation: 'bv-qin 260ms ease both' }}>
                {subQuestions[subStep]}
              </div>
            </div>

            {triageError && (
              <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 12, background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)', color: 'var(--danger)', font: `400 13px ${FONT}` }}>{triageError}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 30, paddingTop: 22, borderTop: '1px solid #eef5f3' }}>
              <button type="button" disabled={subStep === 0} onClick={() => setSubStep(s => Math.max(0, s - 1))}
                style={{ ...btnGhost, color: subStep === 0 ? '#c3d0cc' : 'var(--muted)', borderColor: subStep === 0 ? '#eef5f3' : '#cfe0da', cursor: subStep === 0 ? 'default' : 'pointer' }}>
                <ArrowLeft size={15} /> Back
              </button>
              {subStep < 5 ? (
                <button type="button" onClick={() => setSubStep(s => Math.min(5, s + 1))} style={btnPrimary}>Next <ArrowRight size={16} /></button>
              ) : (
                <button type="button" onClick={handleAssess} disabled={assessing} style={btnPrimary}>
                  {assessing ? <><Loader2 size={15} className="animate-spin" /> Checking…</> : <>Get my recommendation <ArrowRight size={16} /></>}
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 */}
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
              <button type="button" onClick={() => setStep(3)} style={btnPrimary}>Pick a doctor & time <ArrowRight size={16} /></button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && assessment && (
          <form onSubmit={handleBook} style={card}>
            <h2 style={h2}>Pick your doctor & time</h2>
            <p style={sub}>Almost done.</p>

            <div style={{ font: `600 13px ${FONT}`, color: 'var(--ink)', marginBottom: 9 }}>How would you like to meet?</div>
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

            <div style={{ font: `600 13px ${FONT}`, color: 'var(--ink)', marginBottom: 10 }}>Doctors for {assessment.suggestedSpecialty}</div>
            {doctorsLoading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}><Loader2 size={18} className="animate-spin" /> Loading doctors…</div>}
            {doctorsError && <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', font: `400 13px ${FONT}` }}>{doctorsError}</div>}
            {!doctorsLoading && !doctorsError && !doctors.length && <div style={{ padding: 16, color: 'var(--muted)' }}>No doctors available right now.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {doctors.map(doc => {
                const on = selectedDoctorId === doc.id;
                return (
                  <button key={doc.id} type="button" onClick={() => setSelectedDoctorId(doc.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 18px',
                    borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                    border: on ? '2px solid var(--primary)' : '1px solid var(--border)', background: on ? '#e3f1ed' : '#fff',
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
                      <span style={{ display: 'block', font: `500 12px ${FONT}`, color: 'var(--ink-muted)' }}>{on ? `${availableSlots.length} open` : `${doc.openSlotCount} open`} slots</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ font: `600 13px ${FONT}`, color: 'var(--ink)', margin: '24px 0 10px' }}>Pick a day</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, scrollSnapType: 'x mandatory' }}>
              {scheduleDays.map(day => {
                const on = selectedDayISO === day.dateISO, has = day.slots.length > 0;
                return (
                  <button key={day.dateISO} type="button" onClick={() => { setSelectedDayISO(day.dateISO); setSelectedSlotId(day.slots[0]?.id ?? ''); }} style={{
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

            <div style={{ marginTop: 14, padding: 18, borderRadius: 14, background: 'var(--canvas)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: `600 13px ${FONT}`, color: 'var(--ink)', marginBottom: 12 }}>
                <span>Open times — {currentDay ? `${currentDay.weekday}, ${currentDay.dateFormatted}` : ''}</span>
                {slotsLoading && <span style={{ font: `500 12px ${FONT}`, color: 'var(--ink-muted)' }}><Loader2 size={12} className="animate-spin" /> Updating…</span>}
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
                    return (
                      <button key={slot.id} type="button" onClick={() => setSelectedSlotId(slot.id)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 9999, font: `600 13px ${FONT}`, cursor: 'pointer',
                        border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary)' : '#fff', color: on ? '#fff' : 'var(--ink)',
                      }}><Clock size={13} color={on ? '#fff' : '#0f766e'} />{normalizeSlotTime(new Date(slot.slotAt))}</button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border)', font: `500 13px ${FONT}`, color: 'var(--muted)' }}>
              {selectedDoctor && selectedSlot
                ? `${assessment.suggestedSpecialty} · ${selectedDoctor.fullName} · ${formatSlot(selectedSlot.slotAt)} · ${consultationType === 'VIDEO' ? 'Video call' : 'In person'}`
                : 'Pick a day and time to see your appointment summary.'}
            </div>

            {bookingError && <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', font: `400 13px ${FONT}` }}>{bookingError}</div>}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24 }}>
              <button type="button" onClick={() => setStep(2)} style={btnGhost}><ArrowLeft size={15} /> Back</button>
              <button type="submit" disabled={booking || !selectedDoctorId || !selectedSlotId}
                style={{ ...btnPrimary, background: booking || !selectedSlotId ? '#9fc3bd' : 'var(--primary)', cursor: booking || !selectedSlotId ? 'not-allowed' : 'pointer' }}>
                {booking ? <><Loader2 size={15} className="animate-spin" /> Booking…</> : <>Book appointment <ArrowRight size={16} /></>}
              </button>
            </div>
          </form>
        )}
      </div>
    </PageTransition>
  );
};
