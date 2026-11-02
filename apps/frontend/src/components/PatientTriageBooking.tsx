import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  HeartPulse,
  Info,
  MapPin,
  Sparkles,
  Video,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Loader2,
  Clock,
  Upload,
  FileText,
  Trash2,
  Paperclip,
} from 'lucide-react';
import type {
  Appointment,
  Attachment,
  ConsultationType,
  Doctor,
  Slot,
  TriageAssessment,
  User,
} from '../types';
import { appointmentsApi, doctorsApi, triageApi, filesApi } from '../services/api';
import { PageTransition } from '../motion/PageTransition';
import { CustomCheckbox } from './CustomCheckbox';

interface PatientTriageBookingProps {
  currentUser: User | null;
}

const COMMON_SYMPTOMS = [
  'Fever / Chills',
  'Chest Tightness / Pain',
  'Shortness of Breath',
  'Severe Headache / Migraine',
  'Abdominal Cramping / Pain',
  'Persistent Cough',
  'Dizziness / Fainting',
  'Skin Rash / Allergic Reaction',
  'Joint Swelling',
  'Sore Throat',
];

function urgencyColor(score: TriageAssessment['urgency']): string {
  if (score === 'EMERGENCY') return '#dc2626';
  if (score === 'URGENT') return '#d97706';
  return '#059669';
}

function urgencyBg(score: TriageAssessment['urgency']): string {
  if (score === 'EMERGENCY') return 'rgba(220, 38, 38, 0.08)';
  if (score === 'URGENT') return 'rgba(217, 119, 6, 0.1)';
  return 'rgba(5, 150, 105, 0.08)';
}

function formatSlot(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

function normalizeSlotTime(d: Date): string {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

function getSlotDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface SpotIntakePreset {
  label: string;
  chiefComplaint: string;
  selectedSymptoms: string[];
  durationDays: number;
  painLevel: number;
  fever: boolean;
  chestPain: boolean;
  shortnessOfBreath: boolean;
}

export const SPOT_INTAKE_PRESETS: Record<string, SpotIntakePreset> = {
  chest: {
    label: 'Chest & Heart',
    chiefComplaint: 'Sharp chest tightness, squeezing pressure radiating to arm, and shortness of breath upon exertion',
    selectedSymptoms: ['Chest Tightness / Pain', 'Shortness of Breath'],
    durationDays: 1,
    painLevel: 6,
    fever: false,
    chestPain: true,
    shortnessOfBreath: true,
  },
  head: {
    label: 'Head & Neurological',
    chiefComplaint: 'Severe throbbing migraine and persistent headache with dizziness, visual sensitivity, and nausea',
    selectedSymptoms: ['Severe Headache / Migraine', 'Dizziness / Fainting'],
    durationDays: 2,
    painLevel: 6,
    fever: false,
    chestPain: false,
    shortnessOfBreath: false,
  },
  mental: {
    label: 'Mental Health',
    chiefComplaint: 'Persistent anxiety, overwhelming emotional distress, insomnia, and difficulty concentrating',
    selectedSymptoms: ['Dizziness / Fainting'],
    durationDays: 7,
    painLevel: 3,
    fever: false,
    chestPain: false,
    shortnessOfBreath: false,
  },
  abdomen: {
    label: 'Stomach & Digestion',
    chiefComplaint: 'Persistent abdominal cramping, severe burning sensation in stomach, and nausea after meals',
    selectedSymptoms: ['Abdominal Cramping / Pain'],
    durationDays: 3,
    painLevel: 5,
    fever: false,
    chestPain: false,
    shortnessOfBreath: false,
  },
  joints: {
    label: 'Bones & Joints',
    chiefComplaint: 'Aching joint stiffness, inflammation, and reduced range of motion in shoulders and elbows',
    selectedSymptoms: ['Joint Swelling'],
    durationDays: 4,
    painLevel: 5,
    fever: false,
    chestPain: false,
    shortnessOfBreath: false,
  },
  skin: {
    label: 'Skin & Allergies',
    chiefComplaint: 'Spreading itchy red rash, allergic hive flare-up, and localized irritation across skin',
    selectedSymptoms: ['Skin Rash / Allergic Reaction'],
    durationDays: 3,
    painLevel: 4,
    fever: false,
    chestPain: false,
    shortnessOfBreath: false,
  },
  reproductive: {
    label: 'Reproductive & Urinary',
    chiefComplaint: 'Pelvic cramping, sharp lower abdominal discomfort, and painful urinary irritation for 2 days',
    selectedSymptoms: ['Abdominal Cramping / Pain'],
    durationDays: 2,
    painLevel: 5,
    fever: false,
    chestPain: false,
    shortnessOfBreath: false,
  },
  knee: {
    label: 'Knees',
    chiefComplaint: 'Acute knee joint pain, noticeable swelling, and tenderness with difficulty bending or bearing weight',
    selectedSymptoms: ['Joint Swelling'],
    durationDays: 2,
    painLevel: 6,
    fever: false,
    chestPain: false,
    shortnessOfBreath: false,
  },
  ankle: {
    label: 'Ankles & Feet',
    chiefComplaint: 'Twisted ankle injury with sharp throbbing pain, localized swelling, and difficulty walking',
    selectedSymptoms: ['Joint Swelling'],
    durationDays: 1,
    painLevel: 6,
    fever: false,
    chestPain: false,
    shortnessOfBreath: false,
  },
  neck_back: {
    label: 'Neck & Upper Spine',
    chiefComplaint: 'Stiff neck, sharp radiating muscular spasm when rotating head, and tension headache',
    selectedSymptoms: ['Severe Headache / Migraine', 'Joint Swelling'],
    durationDays: 3,
    painLevel: 5,
    fever: false,
    chestPain: false,
    shortnessOfBreath: false,
  },
  upper_back: {
    label: 'Upper Back & Shoulders',
    chiefComplaint: 'Severe upper back tightness, postural aching between shoulder blades, and muscular stiffness',
    selectedSymptoms: ['Joint Swelling'],
    durationDays: 4,
    painLevel: 5,
    fever: false,
    chestPain: false,
    shortnessOfBreath: false,
  },
  lower_back: {
    label: 'Lower Back & Spine',
    chiefComplaint: 'Acute lower back strain, stiffness, and lumbar pain radiating down hip while sitting or bending',
    selectedSymptoms: ['Joint Swelling'],
    durationDays: 3,
    painLevel: 6,
    fever: false,
    chestPain: false,
    shortnessOfBreath: false,
  },
  hips_back: {
    label: 'Hips & Glutes',
    chiefComplaint: 'Deep hip joint discomfort, pelvic muscle stiffness, and mobility ache while standing or walking',
    selectedSymptoms: ['Joint Swelling'],
    durationDays: 4,
    painLevel: 5,
    fever: false,
    chestPain: false,
    shortnessOfBreath: false,
  },
  calf: {
    label: 'Calves & Hamstrings',
    chiefComplaint: 'Sudden calf muscle cramping, tenderness, and hamstring tightness after physical activity',
    selectedSymptoms: ['Joint Swelling'],
    durationDays: 2,
    painLevel: 5,
    fever: false,
    chestPain: false,
    shortnessOfBreath: false,
  },
};

const DEFAULT_PRESET: SpotIntakePreset = {
  label: '',
  chiefComplaint: 'Persistent high fever and dry cough for 3 days',
  selectedSymptoms: ['Fever / Chills', 'Persistent Cough'],
  durationDays: 3,
  painLevel: 4,
  fever: true,
  chestPain: false,
  shortnessOfBreath: false,
};

function resolveSpotKey(input: string): string | null {
  if (!input) return null;
  const clean = input.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
  if (SPOT_INTAKE_PRESETS[clean]) return clean;
  if (clean.includes('chest') || clean.includes('heart') || clean.includes('cardiac')) return 'chest';
  if (clean.includes('head') || clean.includes('migraine') || clean.includes('neuro')) return 'head';
  if (clean.includes('mental') || clean.includes('anxiety') || clean.includes('psych')) return 'mental';
  if (clean.includes('stomach') || clean.includes('abdom') || clean.includes('digest')) return 'abdomen';
  if (clean.includes('joint') || clean.includes('bone')) return 'joints';
  if (clean.includes('skin') || clean.includes('rash') || clean.includes('allergy')) return 'skin';
  if (clean.includes('reproductive') || clean.includes('urinary') || clean.includes('pelvic')) return 'reproductive';
  if (clean.includes('knee')) return 'knee';
  if (clean.includes('ankle') || clean.includes('foot') || clean.includes('feet')) return 'ankle';
  if (clean.includes('neck')) return 'neck_back';
  if (clean.includes('upperback') || clean.includes('shoulder')) return 'upper_back';
  if (clean.includes('lowerback') || clean.includes('lumbar') || clean.includes('sciatica')) return 'lower_back';
  if (clean.includes('hip') || clean.includes('glute')) return 'hips_back';
  if (clean.includes('calf') || clean.includes('calves') || clean.includes('hamstring')) return 'calf';
  return null;
}

function inferPresetFromComplaint(text: string): SpotIntakePreset {
  const lower = text.toLowerCase();
  const symptoms: string[] = [];
  let fever = false;
  let chestPain = false;
  let shortnessOfBreath = false;
  let painLevel = 4;
  let durationDays = 3;

  if (lower.includes('chest') || lower.includes('heart') || lower.includes('cardiac') || lower.includes('angina')) {
    symptoms.push('Chest Tightness / Pain');
    chestPain = true;
    painLevel = 6;
    durationDays = 1;
  }
  if (lower.includes('breath') || lower.includes('dyspnea') || lower.includes('suffocat')) {
    symptoms.push('Shortness of Breath');
    shortnessOfBreath = true;
    painLevel = Math.max(painLevel, 6);
  }
  if (lower.includes('head') || lower.includes('migraine')) {
    symptoms.push('Severe Headache / Migraine');
    painLevel = Math.max(painLevel, 5);
  }
  if (lower.includes('fever') || lower.includes('chill') || lower.includes('temperature')) {
    symptoms.push('Fever / Chills');
    fever = true;
  }
  if (lower.includes('cough')) {
    symptoms.push('Persistent Cough');
  }
  if (lower.includes('stomach') || lower.includes('abdom') || lower.includes('cramp') || lower.includes('belly') || lower.includes('nausea') || lower.includes('digest') || lower.includes('bloat')) {
    symptoms.push('Abdominal Cramping / Pain');
    painLevel = Math.max(painLevel, 5);
  }
  if (lower.includes('dizzy') || lower.includes('faint') || lower.includes('vertigo') || lower.includes('lighthead') || lower.includes('fatigue') || lower.includes('weakness') || lower.includes('insomnia') || lower.includes('sleep')) {
    symptoms.push('Dizziness / Fainting');
  }
  if (lower.includes('rash') || lower.includes('allergy') || lower.includes('allergic') || lower.includes('hive') || lower.includes('itch') || lower.includes('skin')) {
    symptoms.push('Skin Rash / Allergic Reaction');
  }
  if (lower.includes('joint') || lower.includes('swell') || lower.includes('knee') || lower.includes('ankle') || lower.includes('back') || lower.includes('neck') || lower.includes('muscle')) {
    symptoms.push('Joint Swelling');
  }
  if (lower.includes('throat')) {
    symptoms.push('Sore Throat');
  }

  return {
    label: text.length > 30 ? text.substring(0, 28) + '...' : text,
    chiefComplaint: text,
    selectedSymptoms: symptoms.length > 0 ? symptoms : ['Fever / Chills'],
    durationDays,
    painLevel,
    fever,
    chestPain,
    shortnessOfBreath,
  };
}

export const PatientTriageBooking: React.FC<PatientTriageBookingProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const resolveInitialPreset = (): SpotIntakePreset => {
    let hotspotKey = searchParams.get('hotspot') || '';
    let complaintText = searchParams.get('complaint') || '';

    try {
      if (!hotspotKey) {
        const storedSpot = sessionStorage.getItem('pulsecare_pending_hotspot');
        if (storedSpot) {
          hotspotKey = storedSpot;
          sessionStorage.removeItem('pulsecare_pending_hotspot');
        }
      }
      if (!complaintText) {
        const storedComplaint = sessionStorage.getItem('pulsecare_pending_complaint');
        if (storedComplaint) {
          complaintText = storedComplaint;
          sessionStorage.removeItem('pulsecare_pending_complaint');
        }
      }
    } catch {}

    const resolved = resolveSpotKey(hotspotKey);
    if (resolved && SPOT_INTAKE_PRESETS[resolved]) {
      return SPOT_INTAKE_PRESETS[resolved];
    }
    if (complaintText) {
      return inferPresetFromComplaint(complaintText);
    }
    return DEFAULT_PRESET;
  };

  const initialPreset = useMemo(resolveInitialPreset, []);

  // Step 1 — intake
  const [activePresetLabel, setActivePresetLabel] = useState<string>(initialPreset.label);
  const [chiefComplaint, setChiefComplaint] = useState<string>(initialPreset.chiefComplaint);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(initialPreset.selectedSymptoms);
  const [durationDays, setDurationDays] = useState<number>(initialPreset.durationDays);
  const [painLevel, setPainLevel] = useState<number>(initialPreset.painLevel);
  const [fever, setFever] = useState<boolean>(initialPreset.fever);
  const [chestPain, setChestPain] = useState<boolean>(initialPreset.chestPain);
  const [shortnessOfBreath, setShortnessOfBreath] = useState<boolean>(initialPreset.shortnessOfBreath);

  // Step 1 Attachments (symptom images, prior prescriptions)
  const [uploadedAttachments, setUploadedAttachments] = useState<Attachment[]>([]);
  const [uploadCategory, setUploadCategory] = useState<'SYMPTOM_IMAGE' | 'PRIOR_PRESCRIPTION' | 'LAB_REPORT'>('SYMPTOM_IMAGE');
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadingFile(true);
    setUploadError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File ${file.name} exceeds 10MB limit.`);
        }
        const uploaded = await filesApi.upload(file, uploadCategory);
        setUploadedAttachments(prev => [...prev, uploaded]);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload attachment');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeAttachment = (id: string) => {
    setUploadedAttachments(prev => prev.filter(a => a.id !== id));
  };

  useEffect(() => {
    const rawSpot = searchParams.get('hotspot');
    const rawComplaint = searchParams.get('complaint');
    if (rawSpot) {
      const resolved = resolveSpotKey(rawSpot);
      if (resolved && SPOT_INTAKE_PRESETS[resolved]) {
        const p = SPOT_INTAKE_PRESETS[resolved];
        setActivePresetLabel(p.label);
        setChiefComplaint(p.chiefComplaint);
        setSelectedSymptoms(p.selectedSymptoms);
        setDurationDays(p.durationDays);
        setPainLevel(p.painLevel);
        setFever(p.fever);
        setChestPain(p.chestPain);
        setShortnessOfBreath(p.shortnessOfBreath);
        return;
      }
    }
    if (rawComplaint) {
      const p = inferPresetFromComplaint(rawComplaint);
      setActivePresetLabel(p.label);
      setChiefComplaint(p.chiefComplaint);
      setSelectedSymptoms(p.selectedSymptoms);
      setDurationDays(p.durationDays);
      setPainLevel(p.painLevel);
      setFever(p.fever);
      setChestPain(p.chestPain);
      setShortnessOfBreath(p.shortnessOfBreath);
    }
  }, [searchParams]);

  // Step 2 — triage result (from backend)
  const [assessment, setAssessment] = useState<TriageAssessment | null>(null);
  const [assessing, setAssessing] = useState<boolean>(false);
  const [triageError, setTriageError] = useState<string | null>(null);

  // Step 3 — doctor + slot
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState<boolean>(false);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [doctorSlots, setDoctorSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState<boolean>(false);
  const [selectedDayISO, setSelectedDayISO] = useState<string>('');
  const [slotOverrides, setSlotOverrides] = useState<Record<string, 'OPEN' | 'CLOSED'>>(() => {
    try {
      const saved = localStorage.getItem('pulsecare_doctor_slots_overrides');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pulsecare_doctor_slots_overrides') {
        try {
          setSlotOverrides(e.newValue ? JSON.parse(e.newValue) : {});
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const [consultationType, setConsultationType] = useState<ConsultationType>('VIDEO');
  const [booking, setBooking] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);

  const toggleSymptom = (symptom: string) =>
    setSelectedSymptoms(prev =>
      prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
    );

  // Fetch doctors (filtered by suggested specialty if present) when we enter step 3.
  useEffect(() => {
    if (step !== 3) return;
    setDoctorsLoading(true);
    setDoctorsError(null);
    const specialty = assessment?.suggestedSpecialty;
    doctorsApi
      .list(specialty)
      .then(list => {
        // If specialty filter returns nothing, fall back to the full list.
        if (list.length === 0 && specialty) {
          return doctorsApi.list();
        }
        return list;
      })
      .then(list => {
        setDoctors(list);
        if (list.length > 0) {
          const first = list[0];
          setSelectedDoctorId(first.id);
        }
      })
      .catch(err => setDoctorsError(err.message || 'Failed to load doctors'))
      .finally(() => setDoctorsLoading(false));
  }, [step, assessment?.suggestedSpecialty]);

  const selectedDoctor = useMemo(
    () => doctors.find(d => d.id === selectedDoctorId) || null,
    [doctors, selectedDoctorId]
  );

  // Fetch all open forward slots for the selected doctor
  useEffect(() => {
    if (!selectedDoctorId) {
      setDoctorSlots([]);
      return;
    }
    setSlotsLoading(true);
    doctorsApi.slots(selectedDoctorId)
      .then(slots => {
        if (Array.isArray(slots) && slots.length > 0) {
          setDoctorSlots(slots);
        } else {
          const doc = doctors.find(d => d.id === selectedDoctorId);
          if (doc?.nextSlots && doc.nextSlots.length > 0) {
            setDoctorSlots(doc.nextSlots.map(s => ({
              id: s.id,
              doctorId: selectedDoctorId,
              slotAt: s.slotAt,
              booked: false,
            })));
          } else {
            setDoctorSlots([]);
          }
        }
      })
      .catch(() => {
        const doc = doctors.find(d => d.id === selectedDoctorId);
        if (doc?.nextSlots) {
          setDoctorSlots(doc.nextSlots.map(s => ({
            id: s.id,
            doctorId: selectedDoctorId,
            slotAt: s.slotAt,
            booked: false,
          })));
        } else {
          setDoctorSlots([]);
        }
      })
      .finally(() => setSlotsLoading(false));
  }, [selectedDoctorId, doctors]);

  // Strictly filter out booked, past, doctor-closed, or weekend holiday slots so patient NEVER sees closed slots
  const availableSlots = useMemo(() => {
    const now = new Date();
    return doctorSlots.filter(slot => {
      if (slot.booked) return false;
      const d = new Date(slot.slotAt);
      if (isNaN(d.getTime()) || d < now) return false;

      const dateISO = getSlotDateISO(d);
      const timeStr = normalizeSlotTime(d);
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      const unpaddedTime = `${hours}:${minutes} ${ampm}`;

      const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const hasExplicitOpen =
        slotOverrides[`${dateISO}_${timeStr}`] === 'OPEN' ||
        slotOverrides[`${dateISO}_${unpaddedTime}`] === 'OPEN' ||
        slotOverrides[`${slot.doctorId}_${dateISO}_${timeStr}`] === 'OPEN' ||
        slotOverrides[`${slot.doctorId}_${dateISO}_${unpaddedTime}`] === 'OPEN' ||
        slotOverrides[`${selectedDoctorId}_${dateISO}_${timeStr}`] === 'OPEN' ||
        slotOverrides[`${selectedDoctorId}_${dateISO}_${unpaddedTime}`] === 'OPEN';

      const hasExplicitClosed =
        slotOverrides[`${dateISO}_${timeStr}`] === 'CLOSED' ||
        slotOverrides[`${dateISO}_${unpaddedTime}`] === 'CLOSED' ||
        slotOverrides[`${slot.doctorId}_${dateISO}_${timeStr}`] === 'CLOSED' ||
        slotOverrides[`${slot.doctorId}_${dateISO}_${unpaddedTime}`] === 'CLOSED' ||
        slotOverrides[`${selectedDoctorId}_${dateISO}_${timeStr}`] === 'CLOSED' ||
        slotOverrides[`${selectedDoctorId}_${dateISO}_${unpaddedTime}`] === 'CLOSED';

      if (hasExplicitClosed) return false;
      if (hasExplicitOpen) return true;

      // By default: Saturday & Sunday are holidays (closed)
      if (isWeekend) return false;

      return true;
    });
  }, [doctorSlots, slotOverrides, selectedDoctorId]);

  // Group open slots across the rolling 7-day schedule (and any additional days)
  const scheduleDays = useMemo(() => {
    const daysMap = new Map<string, {
      dateISO: string;
      dayName: string;
      dateFormatted: string;
      weekday: string;
      isWeekend: boolean;
      slots: Slot[];
    }>();

    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateISO = getSlotDateISO(d);
      const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' });
      const dateFormatted = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      daysMap.set(dateISO, {
        dateISO,
        dayName,
        dateFormatted,
        weekday,
        isWeekend,
        slots: [],
      });
    }

    availableSlots.forEach(slot => {
      const d = new Date(slot.slotAt);
      const dateISO = getSlotDateISO(d);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (!daysMap.has(dateISO)) {
        daysMap.set(dateISO, {
          dateISO,
          dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
          dateFormatted: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
          isWeekend,
          slots: [slot],
        });
      } else {
        daysMap.get(dateISO)!.slots.push(slot);
      }
    });

    daysMap.forEach(dayObj => {
      dayObj.slots.sort((a, b) => new Date(a.slotAt).getTime() - new Date(b.slotAt).getTime());
    });

    return Array.from(daysMap.values()).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  }, [availableSlots]);

  // Auto-select first available day and slot when schedule changes
  useEffect(() => {
    if (scheduleDays.length === 0) return;
    const currentDayObj = scheduleDays.find(d => d.dateISO === selectedDayISO);
    if (!selectedDayISO || !currentDayObj || currentDayObj.slots.length === 0) {
      const firstWithSlots = scheduleDays.find(d => d.slots.length > 0) || scheduleDays[0];
      if (firstWithSlots) {
        setSelectedDayISO(firstWithSlots.dateISO);
        if (firstWithSlots.slots.length > 0) {
          setSelectedSlotId(firstWithSlots.slots[0].id);
        } else {
          setSelectedSlotId('');
        }
      }
    } else {
      if (!currentDayObj.slots.some(s => s.id === selectedSlotId)) {
        setSelectedSlotId(currentDayObj.slots[0]?.id ?? '');
      }
    }
  }, [scheduleDays, selectedDayISO, selectedSlotId]);

  const handleDayClick = (dayISO: string) => {
    setSelectedDayISO(dayISO);
    const dayObj = scheduleDays.find(d => d.dateISO === dayISO);
    if (dayObj && dayObj.slots.length > 0) {
      const hasSelected = dayObj.slots.some(s => s.id === selectedSlotId);
      if (!hasSelected) {
        setSelectedSlotId(dayObj.slots[0].id);
      }
    } else {
      setSelectedSlotId('');
    }
  };

  const currentDaySlots = useMemo(() => {
    return scheduleDays.find(d => d.dateISO === selectedDayISO)?.slots ?? [];
  }, [scheduleDays, selectedDayISO]);

  const selectedSlot = useMemo(() => {
    return availableSlots.find(s => s.id === selectedSlotId) || null;
  }, [availableSlots, selectedSlotId]);

  const handleAssess = async () => {
    setAssessing(true);
    setTriageError(null);
    try {
      const result = await triageApi.assess({
        chiefComplaint,
        symptoms: selectedSymptoms,
        durationDays,
        painLevel,
        fever,
        chestPain,
        shortnessOfBreath,
      });
      setAssessment(result);
      setStep(2);
    } catch (err: any) {
      setTriageError(err.message || 'Triage service is unavailable');
    } finally {
      setAssessing(false);
    }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedSlotId) {
      setBookingError('Choose a doctor and a slot before confirming.');
      return;
    }
    setBooking(true);
    setBookingError(null);
    try {
      const booked = await appointmentsApi.book({
        doctorId: selectedDoctorId,
        slotId: selectedSlotId,
        assessmentId: assessment?.id,
        consultationType,
        attachmentIds: uploadedAttachments.map(a => a.id),
      });
      setConfirmed(booked);
    } catch (err: any) {
      setBookingError(err.message || 'Could not book this slot. Try another.');
    } finally {
      setBooking(false);
    }
  };

  if (confirmed) {
    return (
      <PageTransition>
        <div className="card card-hover" style={{ maxWidth: '680px', margin: '56px auto', padding: '40px', textAlign: 'center' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            backgroundColor: 'rgba(50, 138, 59, 0.12)', color: 'var(--success)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <CheckCircle2 size={36} />
          </div>
          <h1 className="font-serif text-heading-lg" style={{ color: 'var(--ink)', marginBottom: '12px' }}>
            Your appointment is confirmed.
          </h1>
          <p className="text-body" style={{ color: 'var(--muted)', marginBottom: '28px' }}>
            Your intake and advisory triage are now attached to the record for{' '}
            <strong>{confirmed.doctorName}</strong>.
          </p>
          <div style={{
            backgroundColor: 'var(--canvas)', borderRadius: '16px', padding: '24px',
            textAlign: 'left', marginBottom: '28px', display: 'grid', gap: '12px',
            fontSize: '14px', border: '1px solid var(--border)',
          }}>
            <div><strong>Patient:</strong> {currentUser?.fullName ?? 'You'}</div>
            <div><strong>Mode:</strong> {confirmed.consultationType === 'VIDEO' ? 'Encrypted Video Telehealth' : 'In-Person Clinic'}</div>
            <div><strong>Attending Physician:</strong> {confirmed.doctorName} ({confirmed.doctorSpecialty})</div>
            <div><strong>Hospital:</strong> {confirmed.doctorHospital}</div>
            <div><strong>Scheduled Slot:</strong> {confirmed.slotAt ? formatSlot(confirmed.slotAt) : 'TBA'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong>Triage Classification:</strong>
              <span className="badge-morph" style={{
                padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
                color: urgencyColor(confirmed.urgency), backgroundColor: urgencyBg(confirmed.urgency),
              }}>{confirmed.urgency}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/appointments')} className="btn btn-secondary hover-lift">
              View All Appointments
            </button>
            <button onClick={() => navigate('/patient')} className="btn btn-primary hover-lift">
              Back to Dashboard
            </button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div style={{ maxWidth: '1160px', margin: '48px auto', padding: '0 24px' }}>
        <section style={{ maxWidth: '840px', margin: '0 auto 48px', textAlign: 'center' }}>
        <span className="badge-ai-warm" style={{ marginBottom: '24px' }}>
          <Sparkles size={14} />
          AI-assisted · reviewed by doctors
        </span>
        <h1 className="font-serif text-display" style={{ color: 'var(--ink)', margin: '16px 0 20px' }}>
          Care that starts
          <br />
          before the appointment.
        </h1>
        <p className="text-subheading" style={{ maxWidth: '580px', margin: '0 auto' }}>
          Describe your symptoms, let us classify urgency, then pick a doctor — all before you leave your home.
        </p>
      </section>

      {/* Stepper */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '10px', marginBottom: '36px', flexWrap: 'wrap',
      }}>
        {[
          { n: 1, label: '1. Symptoms & Intake' },
          { n: 2, label: '2. AI Urgency Review' },
          { n: 3, label: '3. Doctor & Schedule' },
        ].map((s, idx) => (
          <React.Fragment key={s.n}>
            <button
              type="button"
              onClick={() => s.n < step && setStep(s.n as 1 | 2 | 3)}
              disabled={s.n > step}
              className={`btn ${step === s.n ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 20px', fontSize: '13px', minHeight: '38px', opacity: s.n > step ? 0.6 : 1 }}
            >
              {s.label}
            </button>
            {idx < 2 && <ChevronRight size={15} color="var(--muted)" />}
          </React.Fragment>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)',
        gap: '32px',
        alignItems: 'start',
      }}>
        <div className="card" style={{ padding: '36px' }}>
          {step === 1 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  backgroundColor: 'var(--info)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <HeartPulse size={20} color="var(--primary)" />
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Describe Your Condition</h2>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Step 1 of 3 · Pre-visit intake</div>
                </div>
              </div>

              {activePresetLabel && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 14px',
                  borderRadius: '12px',
                  backgroundColor: '#eaf6f2',
                  border: '1px solid #d9ece7',
                  color: '#0f766e',
                  fontSize: '13px',
                  fontWeight: 500,
                  marginBottom: '20px',
                }}>
                  <Sparkles size={16} color="#0f766e" style={{ flexShrink: 0 }} />
                  <span>
                    Auto-filled for <strong>{activePresetLabel}</strong> based on your selection. You can customize symptoms anytime.
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Duration (Days)</label>
                  <input
                    type="number" min={0} max={60}
                    className="form-input"
                    value={durationDays}
                    onChange={e => setDurationDays(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Patient</label>
                  <input
                    type="text" className="form-input" value={currentUser?.fullName ?? 'Guest'} disabled
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Primary Concern / Chief Complaint</label>
                <textarea
                  className="form-textarea"
                  value={chiefComplaint}
                  onChange={e => setChiefComplaint(e.target.value)}
                  placeholder="Describe your symptoms in your own words..."
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Select Symptoms Experienced</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                  {COMMON_SYMPTOMS.map(s => {
                    const active = selectedSymptoms.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSymptom(s)}
                        className="chip"
                        style={{
                          padding: '8px 18px', borderRadius: '9999px', fontSize: '13px',
                          fontFamily: 'var(--font-sans)', fontWeight: active ? 600 : 400,
                          cursor: 'pointer',
                          border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                          backgroundColor: active ? 'var(--info)' : 'var(--canvas)',
                          color: active ? 'var(--primary)' : 'var(--ink)',
                        }}
                      >
                        {active ? '✓ ' : '+ '}{s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{
                marginTop: '24px', padding: '20px', borderRadius: '16px',
                backgroundColor: 'rgba(255, 109, 57, 0.08)',
                border: '1px solid rgba(255, 109, 57, 0.2)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontWeight: 600, fontSize: '14px', color: 'var(--accent-warm)', marginBottom: '12px',
                }}>
                  <AlertTriangle size={18} />
                  <span>Critical Safety Markers</span>
                </div>
                <div style={{ display: 'grid', gap: '12px', fontSize: '13px' }}>
                  <CustomCheckbox
                    checked={chestPain}
                    onChange={setChestPain}
                    label="Acute chest pain, pressure, or tightness radiating to arm"
                    color="#dc2626"
                  />
                  <CustomCheckbox
                    checked={shortnessOfBreath}
                    onChange={setShortnessOfBreath}
                    label="Severe difficulty breathing or resting breathlessness"
                    color="#dc2626"
                  />
                  <CustomCheckbox
                    checked={fever}
                    onChange={setFever}
                    label="Body temperature elevated above 101.5°F"
                    color="#dc2626"
                  />
                </div>
              </div>

              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label className="form-label">Pain Severity: <strong>{painLevel} / 10</strong></label>
                  <span style={{
                    fontSize: '13px', fontWeight: 600,
                    color: painLevel >= 8 ? 'var(--danger)' : 'var(--muted)',
                  }}>
                    {painLevel === 0 && 'No Pain'}
                    {painLevel >= 1 && painLevel <= 3 && 'Mild Discomfort'}
                    {painLevel >= 4 && painLevel <= 6 && 'Moderate Pain'}
                    {painLevel >= 7 && painLevel <= 8 && 'Severe Pain'}
                    {painLevel >= 9 && 'Emergency'}
                  </span>
                </div>
                <input
                  type="range" min={0} max={10} value={painLevel}
                  onChange={e => setPainLevel(Number(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: painLevel >= 8 ? 'var(--danger)' : 'var(--primary)',
                    cursor: 'pointer',
                  }}
                />
              </div>

              {triageError && (
                <div style={{
                  marginTop: '20px', padding: '12px 16px', borderRadius: '12px',
                  backgroundColor: 'rgba(220, 38, 38, 0.08)',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  color: '#dc2626', fontSize: '13px',
                }}>
                  {triageError}
                </div>
              )}

              <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleAssess}
                  disabled={assessing || !chiefComplaint.trim()}
                  className="btn btn-primary hover-lift"
                >
                  {assessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Running Triage...
                    </>
                  ) : (
                    <>
                      Run Advisory Triage <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 2 && assessment && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  backgroundColor: 'var(--info)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={20} color="var(--primary)" />
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Automated Urgency Assessment</h2>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Step 2 of 3 · Server-side rule engine</div>
                </div>
              </div>

              <div style={{
                padding: '24px', borderRadius: '16px',
                backgroundColor: urgencyBg(assessment.urgency),
                border: `1px solid ${urgencyColor(assessment.urgency)}25`,
                marginBottom: '24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Triage Status:</span>
                    <span style={{
                      padding: '3px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
                      color: urgencyColor(assessment.urgency),
                      backgroundColor: '#ffffff',
                    }}>{assessment.urgency}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Suggested specialty: <strong>{assessment.suggestedSpecialty}</strong>
                  </span>
                </div>
                <p style={{
                  fontSize: '15px', lineHeight: '1.6',
                  color: urgencyColor(assessment.urgency),
                }}>
                  {assessment.rationale}
                </p>
              </div>

              <div style={{
                backgroundColor: 'var(--canvas)', borderRadius: '16px', padding: '20px',
                marginBottom: '28px', fontSize: '14px', border: '1px solid var(--border)',
              }}>
                <div style={{ fontWeight: 600, marginBottom: '10px' }}>Reported Clinical Summary:</div>
                <ul style={{ paddingLeft: '20px', color: 'var(--muted)', lineHeight: '1.8' }}>
                  <li>Primary concern: <em>"{assessment.chiefComplaint}"</em></li>
                  <li>Symptoms flagged: {assessment.symptoms.join(', ') || 'None selected'}</li>
                  <li>Pain index: {assessment.painLevel} / 10 | Duration: {assessment.durationDays} day(s)</li>
                  <li>Cardiopulmonary alert: {assessment.chestPain || assessment.shortnessOfBreath ? 'POSITIVE' : 'Negative'}</li>
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px' }}>
                <button type="button" onClick={() => setStep(1)} className="btn btn-secondary hover-lift">
                  Back to Symptoms
                </button>
                <button type="button" onClick={() => setStep(3)} className="btn btn-primary hover-lift">
                  Select Doctor & Slot <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && assessment && (
            <form onSubmit={handleBook}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  backgroundColor: 'var(--info)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Calendar size={20} color="var(--primary)" />
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Select Doctor & Consultation Mode</h2>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Step 3 of 3 · Finalize Booking</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Consultation Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
                  <button
                    type="button" onClick={() => setConsultationType('VIDEO')}
                    style={{
                      padding: '16px 20px', borderRadius: '16px',
                      border: consultationType === 'VIDEO' ? '2px solid var(--primary)' : '1px solid var(--border)',
                      backgroundColor: consultationType === 'VIDEO' ? 'var(--info)' : 'var(--surface)',
                      display: 'flex', alignItems: 'center', gap: '14px',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <Video size={24} color={consultationType === 'VIDEO' ? 'var(--primary)' : 'var(--muted)'} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ink)' }}>Telehealth Video</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Encrypted video call</div>
                    </div>
                  </button>
                  <button
                    type="button" onClick={() => setConsultationType('IN_PERSON')}
                    style={{
                      padding: '16px 20px', borderRadius: '16px',
                      border: consultationType === 'IN_PERSON' ? '2px solid var(--primary)' : '1px solid var(--border)',
                      backgroundColor: consultationType === 'IN_PERSON' ? 'var(--info)' : 'var(--surface)',
                      display: 'flex', alignItems: 'center', gap: '14px',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <MapPin size={24} color={consultationType === 'IN_PERSON' ? 'var(--primary)' : 'var(--muted)'} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ink)' }}>In-Person Clinic</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Hospital facility visit</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '20px' }}>
                <label className="form-label">
                  Clinicians specialising in {assessment.suggestedSpecialty}
                </label>
                {doctorsLoading && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
                    <Loader2 size={20} className="animate-spin" style={{ display: 'inline', marginRight: 8 }} />
                    Loading doctors…
                  </div>
                )}
                {doctorsError && (
                  <div style={{
                    padding: '12px 16px', borderRadius: '12px',
                    backgroundColor: 'rgba(220, 38, 38, 0.08)',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    color: '#dc2626', fontSize: '13px',
                  }}>
                    {doctorsError}
                  </div>
                )}
                {!doctorsLoading && !doctorsError && doctors.length === 0 && (
                  <div style={{ padding: '16px', color: 'var(--muted)' }}>No doctors available right now.</div>
                )}
                <div style={{ display: 'grid', gap: '12px', marginTop: '6px' }}>
                  {doctors.map(doc => {
                    const active = selectedDoctorId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => {
                          setSelectedDoctorId(doc.id);
                        }}
                        className="card-hover"
                        style={{
                          padding: '16px 20px', borderRadius: '16px',
                          border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                          backgroundColor: active ? 'var(--info)' : 'var(--surface)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          {doc.avatarUrl ? (
                            <img
                              src={doc.avatarUrl}
                              alt={doc.fullName}
                              style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{
                              width: '48px', height: '48px', borderRadius: '50%',
                              backgroundColor: 'var(--canvas)', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              color: 'var(--primary)', fontWeight: 700,
                            }}>
                              {doc.fullName.split(' ').map(s => s[0]).join('').slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ink)' }}>{doc.fullName}</div>
                            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                              {doc.specialty} · {doc.hospital}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '13px' }}>
                          <div style={{ color: '#f59e0b', fontWeight: 600 }}>★ {Number(doc.rating).toFixed(2)}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                            {active ? `${availableSlots.length} available slot${availableSlots.length === 1 ? '' : 's'}` : `${doc.openSlotCount} open slot${doc.openSlotCount === 1 ? '' : 's'}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day & Slot Selection Section */}
              <div className="form-group" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} color="var(--primary)" />
                    <span>Select Appointment Date & Time</span>
                  </label>
                  <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={13} /> Only open available slots displayed
                  </span>
                </div>

                {/* Day Selector Pill Bar (Flexible booking on any day) */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  padding: '6px 2px 10px',
                  scrollbarWidth: 'thin',
                }}>
                  {scheduleDays.map(day => {
                    const isSelected = selectedDayISO === day.dateISO;
                    const hasSlots = day.slots.length > 0;
                    return (
                      <button
                        key={day.dateISO}
                        type="button"
                        onClick={() => handleDayClick(day.dateISO)}
                        style={{
                          flex: '0 0 auto',
                          minWidth: '108px',
                          padding: '10px 14px',
                          borderRadius: '14px',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                          backgroundColor: isSelected ? 'var(--info)' : 'var(--surface)',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 2px 8px rgba(15, 118, 110, 0.12)' : 'none',
                        }}
                      >
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: isSelected ? 'var(--primary)' : 'var(--ink)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}>
                          {day.dayName}
                        </div>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: isSelected ? 'var(--primary)' : 'var(--muted)',
                          marginTop: '2px',
                        }}>
                          {day.dateFormatted}
                        </div>
                        <div style={{
                          marginTop: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: hasSlots
                            ? (isSelected ? 'var(--primary)' : 'rgba(15, 118, 110, 0.1)')
                            : day.isWeekend
                              ? 'rgba(239, 68, 68, 0.12)'
                              : 'rgba(148, 163, 184, 0.15)',
                          color: hasSlots
                            ? (isSelected ? '#ffffff' : 'var(--primary)')
                            : day.isWeekend
                              ? '#dc2626'
                              : 'var(--muted)',
                        }}>
                          {hasSlots ? `${day.slots.length} open` : day.isWeekend ? 'Holiday' : 'No slots'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Available Slots for the Selected Day */}
                <div style={{
                  marginTop: '10px',
                  padding: '16px 20px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--canvas)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--ink)',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span>
                      Available slots for{' '}
                      <strong style={{ color: 'var(--primary)' }}>
                        {scheduleDays.find(d => d.dateISO === selectedDayISO)?.weekday ?? 'Selected Date'},{' '}
                        {scheduleDays.find(d => d.dateISO === selectedDayISO)?.dateFormatted}
                      </strong>
                    </span>
                    {slotsLoading && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--muted)', fontSize: '12px' }}>
                        <Loader2 size={12} className="animate-spin" /> Updating slots…
                      </span>
                    )}
                  </div>

                  {currentDaySlots.length === 0 ? (
                    <div style={{
                      padding: '22px 16px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--surface)',
                      border: '1px dashed var(--border)',
                      textAlign: 'center',
                      color: 'var(--muted)',
                      fontSize: '13px',
                    }}>
                      {scheduleDays.find(d => d.dateISO === selectedDayISO)?.isWeekend ? (
                        <>
                          <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '4px', fontSize: '14px' }}>
                            Weekend Clinic Holiday
                          </div>
                          Clinics are closed on Saturdays and Sundays. All regular appointment slots are closed on weekends.
                          <div style={{ marginTop: '8px', color: 'var(--primary)', fontWeight: 600 }}>
                            Please select a weekday (Monday to Friday) from the calendar above to view available appointments.
                          </div>
                        </>
                      ) : (
                        <>
                          No available slots on this day. The doctor is currently unavailable or all slots are booked/closed.
                          <div style={{ marginTop: '6px', color: 'var(--primary)', fontWeight: 600 }}>
                            Please select another date from the schedule above.
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {currentDaySlots.map(slot => {
                        const active = selectedSlotId === slot.id;
                        const slotDate = new Date(slot.slotAt);
                        const timeStr = normalizeSlotTime(slotDate);
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedSlotId(slot.id)}
                            className="chip"
                            style={{
                              padding: '9px 18px',
                              borderRadius: '9999px',
                              border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                              backgroundColor: active ? 'var(--primary)' : 'var(--surface)',
                              color: active ? '#ffffff' : 'var(--ink)',
                              fontWeight: active ? 600 : 500,
                              fontSize: '13px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.15s ease',
                              boxShadow: active ? '0 2px 6px rgba(15, 118, 110, 0.25)' : 'none',
                            }}
                          >
                            <Clock size={13} color={active ? '#ffffff' : 'var(--primary)'} />
                            <span>{timeStr}</span>
                            {active && <CheckCircle2 size={13} color="#ffffff" style={{ marginLeft: 2 }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {bookingError && (
                <div style={{
                  marginTop: '20px', padding: '12px 16px', borderRadius: '12px',
                  backgroundColor: 'rgba(220, 38, 38, 0.08)',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  color: '#dc2626', fontSize: '13px',
                }}>
                  {bookingError}
                </div>
              )}

              <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <button type="button" onClick={() => setStep(2)} className="btn btn-secondary hover-lift">
                  Back
                </button>
                <button
                  type="submit"
                  disabled={booking || !selectedDoctorId || !selectedSlotId}
                  className="btn btn-primary hover-lift"
                >
                  {booking ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Booking…
                    </>
                  ) : (
                    'Confirm & Schedule Visit'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Column: Live summary & Medical Attachments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '96px' }}>
          {/* Triage Live Summary */}
          <div className="card card-hover" style={{ padding: '24px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Triage Live Summary</h3>
              </div>
              {assessment && (
                <span style={{
                  padding: '3px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
                  color: urgencyColor(assessment.urgency), backgroundColor: urgencyBg(assessment.urgency),
                }}>{assessment.urgency}</span>
              )}
            </div>

            {!assessment ? (
              <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
                Fill out the intake on the left. Once you run advisory triage the server classifies urgency
                and suggests a specialty for your booking.
              </p>
            ) : (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <div className="text-caption" style={{
                    color: 'var(--muted)', textTransform: 'uppercase',
                    letterSpacing: '0.04em', marginBottom: '6px',
                  }}>
                    Clinical Rationale:
                  </div>
                  <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--ink)' }}>
                    {assessment.rationale}
                  </p>
                </div>
                {assessment.urgency === 'EMERGENCY' && (
                  <div style={{
                    backgroundColor: 'rgba(192, 57, 43, 0.08)',
                    border: '1px solid rgba(192, 57, 43, 0.3)',
                    borderRadius: '12px', padding: '14px', fontSize: '13px',
                    color: 'var(--danger)', display: 'flex', gap: '10px', marginBottom: '20px',
                  }}>
                    <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>High Urgency Alert:</strong> Red-flag indicators detected.
                      Consider calling 108 / 112 or proceed immediately to the nearest emergency room.
                    </div>
                  </div>
                )}
                <div style={{
                  backgroundColor: 'var(--canvas)', borderRadius: '14px', padding: '16px',
                  display: 'grid', gap: '10px', fontSize: '13px', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Suggested specialty:</span>
                    <strong>{assessment.suggestedSpecialty}</strong>
                  </div>
                  {selectedDoctor && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Attending:</span>
                        <strong>{selectedDoctor.fullName}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Facility:</span>
                        <span>{selectedDoctor.hospital}</span>
                      </div>
                    </>
                  )}
                  {selectedSlot && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Selected slot:</span>
                      <strong style={{ color: 'var(--primary)' }}>{formatSlot(selectedSlot.slotAt)}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Mode:</span>
                    <span>{consultationType === 'VIDEO' ? 'Telehealth Video' : 'In-Person'}</span>
                  </div>
                </div>
              </>
            )}

            <div style={{
              marginTop: '16px', padding: '12px 14px',
              backgroundColor: 'var(--info)', borderRadius: '10px',
              fontSize: '12px', color: 'var(--ink)', lineHeight: '1.5',
              display: 'flex', gap: '10px',
            }}>
              <Info size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>AI Clinical Advisory (DR-15):</strong> Scores are advisory. A doctor reviews every booking.
              </div>
            </div>
          </div>

          {/* Medical Attachments & Prior Records (Right Column Empty Space) */}
          <div className="card card-hover" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '8px',
                  backgroundColor: '#eaf6f2', color: '#0f766e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Paperclip size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0b3f3a' }}>
                    Upload Medical Records
                  </div>
                  <div style={{ fontSize: '11px', color: '#52736d' }}>
                    Symptom images, prior Rx, or lab reports
                  </div>
                </div>
              </div>

              {/* Attachment Category Switcher */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[
                  { id: 'SYMPTOM_IMAGE', label: 'Photo' },
                  { id: 'PRIOR_PRESCRIPTION', label: 'Prior Rx' },
                  { id: 'LAB_REPORT', label: 'Report' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setUploadCategory(cat.id as any)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      backgroundColor: uploadCategory === cat.id ? '#0f766e' : '#eaf6f2',
                      color: uploadCategory === cat.id ? '#ffffff' : '#0b3f3a',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />

            {/* Drag & Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: isDragging ? '2px solid #0f766e' : '1.5px dashed #0f766e',
                borderRadius: '12px',
                padding: '20px 14px',
                textAlign: 'center',
                backgroundColor: isDragging ? '#d9ece7' : '#f8faf9',
                cursor: uploadingFile ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
                transform: isDragging ? 'scale(1.02)' : 'none',
                boxShadow: isDragging ? '0 4px 12px rgba(15, 118, 110, 0.15)' : 'none',
              }}
              onMouseEnter={e => { if (!isDragging) e.currentTarget.style.backgroundColor = '#eaf6f2'; }}
              onMouseLeave={e => { if (!isDragging) e.currentTarget.style.backgroundColor = '#f8faf9'; }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                {uploadingFile ? (
                  <Loader2 size={24} className="animate-spin" color="#0f766e" />
                ) : (
                  <Upload size={24} color="#0f766e" />
                )}
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0b3f3a' }}>
                  {uploadingFile
                    ? 'Uploading file to secure server…'
                    : isDragging
                      ? 'Drop file here to upload!'
                      : 'Drag & drop file or click to browse'}
                </span>
                <span style={{ fontSize: '11px', color: '#52736d' }}>
                  Supports JPEG, PNG, WebP photos & PDF (up to 10MB)
                </span>
              </div>
            </div>

            {uploadError && (
              <div style={{
                marginTop: '10px', padding: '8px 12px', borderRadius: '8px',
                backgroundColor: 'rgba(220, 38, 38, 0.08)', color: '#dc2626', fontSize: '12px',
              }}>
                {uploadError}
              </div>
            )}

            {/* Uploaded attachments cards */}
            {uploadedAttachments.length > 0 && (
              <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
                {uploadedAttachments.map(att => {
                  const isImg = att.mimeType.startsWith('image/') || att.fileUrl.match(/\.(jpg|jpeg|png|webp)$/i);
                  return (
                    <div
                      key={att.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: '1px solid #d9ece7',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        {isImg ? (
                          <img
                            src={att.fileUrl}
                            alt={att.fileName}
                            style={{ width: '34px', height: '34px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{
                            width: '34px', height: '34px', borderRadius: '6px',
                            backgroundColor: '#eaf6f2', color: '#0f766e',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <FileText size={16} />
                          </div>
                        )}
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{
                            fontSize: '12px', fontWeight: 600, color: '#0b3f3a',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px',
                          }} title={att.fileName}>
                            {att.fileName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#52736d', marginTop: '1px' }}>
                            <span style={{
                              backgroundColor: '#eaf6f2', color: '#0f766e',
                              padding: '1px 5px', borderRadius: '4px', fontWeight: 600,
                            }}>
                              {att.fileCategory === 'SYMPTOM_IMAGE' ? 'Photo'
                                : att.fileCategory === 'PRIOR_PRESCRIPTION' ? 'Rx'
                                : 'Report'}
                            </span>
                            <span>{(att.fileSizeBytes / 1024).toFixed(0)} KB</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <a
                          href={att.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '11px', color: '#0f766e', fontWeight: 600,
                            textDecoration: 'none', padding: '3px 6px', borderRadius: '4px',
                            backgroundColor: '#f0f9f6',
                          }}
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.id)}
                          style={{
                            background: 'none', border: 'none', color: '#dc2626',
                            cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center',
                          }}
                          title="Remove attachment"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </PageTransition>
  );
};
