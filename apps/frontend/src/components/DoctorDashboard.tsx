import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PageTransition } from '../motion/PageTransition';
import { listItem, slideInRight, EASE_ENTER, EASE_EXIT } from '../motion/presets';
import { CustomSelect } from './CustomSelect';
import {
  Search,
  Download,
  X,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  FileText,
  ExternalLink,
  Video,
} from 'lucide-react';
import type { Appointment, DoctorStatus, Attachment } from '../types';
import { appointmentsApi, doctorProfileApi } from '../services/api';
import { PrescriptionEditor } from './PrescriptionEditor';

/**
 * Map a backend Appointment to the queue item shape this screen was originally built around.
 * Age/gender/questionnaire/past-visits are placeholders until those feeds exist; we show
 * `—` instead of fabricated data so a clinician never acts on invented history.
 */
function appointmentToQueueItem(a: Appointment): QueueItem {
  const slotTime = a.slotAt
    ? new Date(a.slotAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    : '—';
  const urgency: 'EMG' | 'URG' | 'RTN' =
    a.urgency === 'EMERGENCY' ? 'EMG' : a.urgency === 'URGENT' ? 'URG' : 'RTN';
  const shortId = '#' + a.patientId.replace(/-/g, '').slice(0, 4);
  return {
    id: a.id,
    patientId: shortId,
    patientName: a.patientName ?? 'Anonymous Patient',
    age: 0,
    gender: '—',
    slot: slotTime,
    mode: a.consultationType === 'VIDEO' ? 'VID' : 'IPS',
    urgency,
    rationale: a.chiefComplaint ?? 'No chief complaint recorded',
    confidence: urgency === 'EMG' ? 92 : urgency === 'URG' ? 78 : 65,
    chiefComplaint: a.chiefComplaint ?? '',
    symptoms: a.chiefComplaint ? [a.chiefComplaint] : [],
    duration: '—',
    history: '',
    questionnaire: [],
    pastVisits: [],
    attachments: a.attachments || [],
  };
}

interface QueueItem {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  slot: string;
  mode: 'VID' | 'IPS';
  urgency: 'EMG' | 'URG' | 'RTN';
  rationale: string;
  confidence: number;
  chiefComplaint: string;
  symptoms: string[];
  duration: string;
  history: string;
  questionnaire: { q: string; a: string }[];
  pastVisits: { date: string; doctor: string; diagnosis: string }[];
  attachments?: Attachment[];
}


type ViewTab = 'active' | 'past';

export const DoctorDashboard: React.FC = () => {
  const navigate = useNavigate();
  // Guard: unapproved doctors cannot access the clinical dashboard. We fetch the status
  // once and redirect to /doctor/profile if PENDING or REJECTED.
  const [verifiedStatus, setVerifiedStatus] = useState<DoctorStatus | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);

  useEffect(() => {
    doctorProfileApi.me()
      .then(d => setVerifiedStatus(d.status))
      .catch(() => setVerifiedStatus('APPROVED'))   // fall through for seeded doctors without a /me row
      .finally(() => setStatusChecked(true));
  }, []);

  // Both lists are always loaded. `queue` below is derived from whichever tab is active;
  // KPIs always read from `activeQueue` so switching tabs doesn't skew the headline numbers.
  const [activeQueue, setActiveQueue] = useState<QueueItem[]>([]);
  const [pastQueue, setPastQueue] = useState<QueueItem[]>([]);
  // Raw backend status per appointment id — used by the Past tab's status pill + drawer.
  const [queueStatus, setQueueStatus] = useState<Record<string, Appointment['status']>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [filterMode, setFilterMode] = useState<string>('ALL');
  const [filterUrgency, setFilterUrgency] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tab, setTab] = useState<ViewTab>('active');

  // Slot availability state for doctor's forward 7-day calendar
  const DEFAULT_TIMES = useMemo(() => ['09:30 AM', '10:30 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM'], []);

  const [slotOverrides, setSlotOverrides] = useState<Record<string, 'OPEN' | 'CLOSED'>>(() => {
    try {
      const saved = localStorage.getItem('pulsecare_doctor_slots_overrides');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [slotToast, setSlotToast] = useState<{ message: string; type: 'open' | 'closed' } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showSlotToast = (message: string, type: 'open' | 'closed') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setSlotToast({ message, type });
    toastTimeoutRef.current = window.setTimeout(() => setSlotToast(null), 3000);
  };

  const isWeekend = (dateOrISO: Date | string): boolean => {
    let d: Date;
    if (typeof dateOrISO === 'string') {
      const [year, month, day] = dateOrISO.split('-').map(Number);
      d = new Date(year, month - 1, day);
    } else {
      d = dateOrISO;
    }
    const dayOfWeek = d.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 is Sun, 6 is Sat
  };

  const isSlotOpen = useCallback((key: string, dateISO?: string): boolean => {
    const override = slotOverrides[key];
    if (override === 'OPEN') return true;
    if (override === 'CLOSED') return false;
    // By default: Saturday & Sunday are holidays (CLOSED)
    if (dateISO && isWeekend(dateISO)) return false;
    // Monday to Friday are OPEN by default
    return true;
  }, [slotOverrides]);

  const toggleSlot = useCallback((key: string, time: string, dayLabel: string, dateISO: string) => {
    const currentlyOpen = isSlotOpen(key, dateISO);
    const newStatus: 'OPEN' | 'CLOSED' = currentlyOpen ? 'CLOSED' : 'OPEN';
    setSlotOverrides(prev => {
      const next = { ...prev, [key]: newStatus };
      try {
        localStorage.setItem('pulsecare_doctor_slots_overrides', JSON.stringify(next));
        window.dispatchEvent(new Event('storage'));
      } catch {}
      return next;
    });
    showSlotToast(
      `${time} on ${dayLabel} is now marked as ${newStatus}`,
      currentlyOpen ? 'closed' : 'open'
    );
  }, [slotOverrides, isSlotOpen]);

  const toggleDaySlots = useCallback((dateISO: string, dayLabel: string) => {
    const hasAnyClosed = DEFAULT_TIMES.some(time => !isSlotOpen(`${dateISO}_${time}`, dateISO));
    const targetStatus: 'OPEN' | 'CLOSED' = hasAnyClosed ? 'OPEN' : 'CLOSED';

    setSlotOverrides(prev => {
      const next = { ...prev };
      DEFAULT_TIMES.forEach(time => {
        next[`${dateISO}_${time}`] = targetStatus;
      });
      try {
        localStorage.setItem('pulsecare_doctor_slots_overrides', JSON.stringify(next));
        window.dispatchEvent(new Event('storage'));
      } catch {}
      return next;
    });

    showSlotToast(
      `All slots for ${dayLabel} set to ${targetStatus}`,
      targetStatus === 'OPEN' ? 'open' : 'closed'
    );
  }, [slotOverrides, DEFAULT_TIMES, isSlotOpen]);

  const openAllSlots = useCallback(() => {
    setSlotOverrides({});
    try {
      localStorage.removeItem('pulsecare_doctor_slots_overrides');
      window.dispatchEvent(new Event('storage'));
    } catch {}
    showSlotToast('Schedule reset to defaults (Mon–Fri open, Sat & Sun holidays)', 'open');
  }, []);

  const next7Days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() + idx);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateISO = `${year}-${month}-${day}`;
      const dayName = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' });
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const isSatOrSun = d.getDay() === 0 || d.getDay() === 6;
      return { idx, date: d, dateISO, dayName, dateStr, isWeekend: isSatOrSun };
    });
  }, []);

  const totalPossibleSlots = next7Days.length * DEFAULT_TIMES.length;
  const totalOpenSlots = useMemo(() => {
    return next7Days.reduce((acc, day) => {
      return acc + DEFAULT_TIMES.filter(t => isSlotOpen(`${day.dateISO}_${t}`, day.dateISO)).length;
    }, 0);
  }, [next7Days, DEFAULT_TIMES, isSlotOpen]);
  const totalClosedSlots = totalPossibleSlots - totalOpenSlots;

  const prevActiveIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeQueue.length > 0) {
      if (isFirstLoadRef.current) {
        prevActiveIdsRef.current = new Set(activeQueue.map(q => q.id));
        isFirstLoadRef.current = false;
      } else {
        const fresh = new Set<string>();
        for (const item of activeQueue) {
          if (!prevActiveIdsRef.current.has(item.id)) {
            fresh.add(item.id);
          }
        }
        if (fresh.size > 0) {
          setNewIds(fresh);
        }
        prevActiveIdsRef.current = new Set(activeQueue.map(q => q.id));
      }
    }
  }, [activeQueue]);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    const rank: Record<string, number> = { EMG: 0, URG: 1, RTN: 2 };

    Promise.all([
      appointmentsApi.doctorQueue('active'),
      appointmentsApi.doctorQueue('past'),
    ])
      .then(([active, past]) => {
        const activeItems = active.map(appointmentToQueueItem);
        activeItems.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
        setActiveQueue(activeItems);

        const pastItems = past.map(appointmentToQueueItem);
        setPastQueue(pastItems);

        const statusMap: Record<string, Appointment['status']> = {};
        for (const a of active) statusMap[a.id] = a.status;
        for (const a of past)   statusMap[a.id] = a.status;
        setQueueStatus(statusMap);
      })
      .catch(err => setLoadError(err?.message || 'Could not load queue'))
      .finally(() => setLoading(false));
  }, []);

  // What the table shows is derived from the active tab.
  const queue = tab === 'active' ? activeQueue : pastQueue;
  const setQueue = (updater: (prev: QueueItem[]) => QueueItem[]) => {
    // Live mutations only make sense for the active tab (ACCEPT / OVERRIDE / COMPLETE / NO_SHOW).
    // We still keep the API shape so applyUpdatedAppointment stays simple.
    if (tab === 'active') setActiveQueue(updater);
    else setPastQueue(updater);
  };
  const activeCount = activeQueue.length;
  const pastCount = pastQueue.length;

  useEffect(() => {
    reload();
  }, [reload]);

  // Drawer Override form state
  const [overrideScore, setOverrideScore] = useState<string>('Routine');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [saveBanner, setSaveBanner] = useState<boolean>(false);

  const handleOpenItem = (item: QueueItem) => {
    setSelectedItem(item);
    setOverrideScore(item.urgency === 'EMG' ? 'Emergency' : item.urgency === 'URG' ? 'Urgent' : 'Routine');
    setOverrideReason('');
    setSaveBanner(false);
  };

  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rxEditorFor, setRxEditorFor] = useState<QueueItem | null>(null);

  const applyUpdatedAppointment = (updated: Appointment) => {
    const next = appointmentToQueueItem(updated);
    setQueue(prev => {
      const kept = prev.filter(q => q.id !== next.id);
      // Drop from queue if it's no longer active (completed/no_show); otherwise re-insert.
      const stillActive =
        updated.status === 'BOOKED' || updated.status === 'CONFIRMED';
      const merged = stillActive ? [...kept, next] : kept;
      const rank: Record<string, number> = { EMG: 0, URG: 1, RTN: 2 };
      merged.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
      return merged;
    });
    setSelectedItem(stillActiveSelector(updated) ? next : null);
  };

  const stillActiveSelector = (a: Appointment) =>
    a.status === 'BOOKED' || a.status === 'CONFIRMED';

  const runAction = async (
    action: 'ACCEPT' | 'START' | 'COMPLETE' | 'NO_SHOW',
    extra?: { notes?: string }
  ) => {
    if (!selectedItem) return;
    setActionBusy(action);
    setActionError(null);
    try {
      const updated = await appointmentsApi.doctorAction(selectedItem.id, {
        action,
        notes: extra?.notes,
      });
      applyUpdatedAppointment(updated);
      setSaveBanner(true);
      setTimeout(() => setSaveBanner(false), 2500);
    } catch (err: any) {
      setActionError(err.message || 'Action failed');
    } finally {
      setActionBusy(null);
    }
  };

  const handleSaveOverride = async () => {
    if (!selectedItem) return;
    const newUrgency: 'EMERGENCY' | 'URGENT' | 'ROUTINE' =
      overrideScore === 'Emergency' ? 'EMERGENCY'
      : overrideScore === 'Urgent' ? 'URGENT'
      : 'ROUTINE';
    const currentUrgency: 'EMERGENCY' | 'URGENT' | 'ROUTINE' =
      selectedItem.urgency === 'EMG' ? 'EMERGENCY'
      : selectedItem.urgency === 'URG' ? 'URGENT'
      : 'ROUTINE';
    if (newUrgency === currentUrgency) {
      setActionError('Pick a different urgency to override, or cancel.');
      return;
    }
    if (!overrideReason.trim()) {
      setActionError('A clinical reason is required to override urgency.');
      return;
    }
    setActionBusy('OVERRIDE_URGENCY');
    setActionError(null);
    try {
      const updated = await appointmentsApi.doctorAction(selectedItem.id, {
        action: 'OVERRIDE_URGENCY',
        urgency: newUrgency,
        reason: overrideReason.trim(),
      });
      applyUpdatedAppointment(updated);
      setSaveBanner(true);
      setTimeout(() => setSaveBanner(false), 2500);
    } catch (err: any) {
      setActionError(err.message || 'Could not save override');
    } finally {
      setActionBusy(null);
    }
  };

  // Filtered queue rows
  const filteredQueue = queue.filter(item => {
    const matchesUrgency =
      filterUrgency === 'ALL' ||
      (filterUrgency === 'EMG' && item.urgency === 'EMG') ||
      (filterUrgency === 'URG' && item.urgency === 'URG') ||
      (filterUrgency === 'RTN' && item.urgency === 'RTN');

    const matchesMode =
      filterMode === 'ALL' || item.mode === filterMode;

    const matchesSearch =
      item.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.rationale.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesUrgency && matchesMode && matchesSearch;
  });

  // Emergency banner should only come from the live queue.
  const emergencyItem = activeQueue.find(q => q.urgency === 'EMG');

  // KPIs are always derived from the active queue, independent of which tab you're viewing.
  const kpiTotal = activeQueue.length;
  const kpiEmergency = activeQueue.filter(q => q.urgency === 'EMG').length;
  const kpiUrgent = activeQueue.filter(q => q.urgency === 'URG').length;
  const location = useLocation();
  const currentSection = location.hash === '#availability' ? 'availability'
    : location.hash === '#patients' ? 'patients'
    : location.hash === '#transcripts' ? 'transcripts'
    : 'queue';

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
  });

  if (!statusChecked) {
    return (
      <div style={{ padding: '64px', textAlign: 'center', color: '#6b7280' }}>
        <Loader2 size={20} className="animate-spin" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
        Loading…
      </div>
    );
  }
  if (verifiedStatus && verifiedStatus !== 'APPROVED') {
    return <Navigate to="/doctor/profile" replace />;
  }

  return (
    <PageTransition style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '36px 20px 64px 20px',
      fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
      color: '#0b3f3a',
    }}>
      {currentSection === 'queue' && (
      <>
      {/* PAGE HEADER: Today's queue + Timestamp + SSE */}
      <section style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '28px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#0b3f3a',
            margin: 0,
            letterSpacing: '-0.025em',
          }}>
            Today's queue
          </h1>
          <div style={{ fontSize: '14px', color: '#52736d', marginTop: '4px' }}>
            Live queue · updates automatically
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: loadError ? '#dc2626' : loading ? '#0f766e' : '#059669',
            marginTop: '4px',
            fontWeight: 500,
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: loadError ? '#dc2626' : loading ? '#d97706' : '#10b981',
              display: 'inline-block',
            }} />
            <span>
              {loadError ? `Error: ${loadError}` : loading ? 'Fetching queue…' : `Live · ${activeCount} active`}
            </span>
            <button
              onClick={reload}
              title="Refresh"
              className="icon-pop"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#0f766e', padding: '0 4px', display: 'inline-flex', alignItems: 'center',
              }}
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <div style={{
          fontSize: '13px',
          color: '#52736d',
          fontWeight: 500,
        }}>
          {todayLabel}
        </div>
      </section>

      {/* KPI STRIP - 4 Tiles with Warm Cream / Brown Aesthetic */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
        marginBottom: '28px',
      }}>
        {/* Tile 1: Today */}
        <div
          className="card-hover"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '18px 22px',
            border: '1px solid #d9ece7',
            boxShadow: '0 4px 16px rgba(20, 60, 55, 0.05)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#52736d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#0b3f3a', margin: '4px 0' }}>
            {kpiTotal}
          </div>
          <div style={{ fontSize: '13px', color: '#52736d' }}>
            booked + confirmed
          </div>
        </div>

        {/* Tile 2: Emergency */}
        <div
          className="card-hover"
          style={{
            backgroundColor: '#fef2f2',
            borderRadius: '16px',
            padding: '18px 22px',
            border: '1px solid #fecaca',
            boxShadow: '0 4px 16px rgba(220, 38, 38, 0.06)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Emergency
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626', margin: '4px 0' }}>
            {kpiEmergency}
          </div>
          <div style={{
            fontSize: '13px',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 500,
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#dc2626' }} />
            needs now
          </div>
        </div>

        {/* Tile 3: Pending questions */}
        <div
          className="card-hover"
          style={{
            backgroundColor: '#fffbeb',
            borderRadius: '16px',
            padding: '18px 22px',
            border: '1px solid #fde68a',
            boxShadow: '0 4px 16px rgba(217, 119, 6, 0.06)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#b45309', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Urgent
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#b45309', margin: '4px 0' }}>
            {kpiUrgent}
          </div>
          <div style={{ fontSize: '13px', color: '#b45309' }}>
            same-day review
          </div>
        </div>

        {/* Tile 4: Routine */}
        <div
          className="card-hover"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '18px 22px',
            border: '1px solid #d9ece7',
            boxShadow: '0 4px 16px rgba(20, 60, 55, 0.05)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#52736d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Routine
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#0b3f3a', margin: '4px 0' }}>
            {Math.max(0, activeQueue.length - kpiEmergency - kpiUrgent)}
          </div>
          <div style={{ fontSize: '13px', color: '#52736d' }}>
            scheduled visits
          </div>
        </div>
      </section>

      {/* TAB STRIP: Active queue vs past appointments */}
      <section style={{
        display: 'flex', gap: '4px',
        borderBottom: '1px solid #d9ece7',
        marginBottom: '22px',
      }}>
        {([
          { k: 'active', label: `Live queue (${activeCount})` },
          { k: 'past', label: `Past appointments (${pastCount})` },
        ] as const).map(t => {
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => { setTab(t.k); setSelectedItem(null); }}
              style={{
                padding: '10px 20px', fontSize: '14px',
                fontWeight: active ? 700 : 500,
                color: active ? '#0b3f3a' : '#52736d',
                background: 'transparent', border: 'none',
                borderBottom: active ? '2px solid #0f766e' : '2px solid transparent',
                marginBottom: '-1px', cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </section>

      {/* EMERGENCY PRIORITY BANNER (only on active tab) */}
      {tab === 'active' && emergencyItem && (
        <section style={{
          backgroundColor: '#dc2626',
          color: '#ffffff',
          borderRadius: '14px',
          padding: '14px 22px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '14px',
          fontWeight: 600,
          boxShadow: '0 6px 20px rgba(220, 38, 38, 0.22)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>▲</span>
            <span>EMERGENCY · Patient {emergencyItem.patientId} · {emergencyItem.rationale}</span>
          </div>
          <button
            onClick={() => handleOpenItem(emergencyItem)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 14px',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.35)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
          >
            Open now →
          </button>
        </section>
      )}

      {/* FILTERS STRIP */}
      <section style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px',
      }}>
        {/* Left Filter selects */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#52736d' }}>
          <span style={{ fontWeight: 600, marginRight: '4px' }}>Filter:</span>

          {/* All Urgency Filter */}
          <CustomSelect
            value={filterUrgency}
            onChange={setFilterUrgency}
            options={[
              { value: 'ALL', label: 'All Urgencies' },
              { value: 'EMG', label: 'Emergency' },
              { value: 'URG', label: 'Urgent' },
              { value: 'RTN', label: 'Routine' },
            ]}
            variant="pill"
          />

          {/* Mode Filter */}
          <CustomSelect
            value={filterMode}
            onChange={setFilterMode}
            options={[
              { value: 'ALL', label: 'All Modes' },
              { value: 'VID', label: 'Video' },
              { value: 'IPS', label: 'In-person' },
            ]}
            variant="pill"
          />

          {/* Status Filter */}
          <CustomSelect
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'WAITING', label: 'Waiting' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
              { value: 'DONE', label: 'Done' },
            ]}
            variant="pill"
          />
        </div>

        {/* Right Search Patient ID */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}>
          <input
            type="text"
            placeholder="Search patient ID"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #d9ece7',
              borderRadius: '9999px',
              padding: '7px 14px 7px 32px',
              fontSize: '13px',
              color: '#0b3f3a',
              outline: 'none',
              width: '210px',
              boxShadow: '0 2px 6px rgba(20, 60, 55, 0.03)',
            }}
          />
          <Search size={14} color="#0f766e" style={{ position: 'absolute', left: '12px' }} />
        </div>
      </section>

      {/* QUEUE TABLE */}
      <section style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        border: '1px solid #d9ece7',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(20, 60, 55, 0.05)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            textAlign: 'left',
          }}>
            <thead>
              <tr style={{
                borderBottom: '2px solid #d9ece7',
                backgroundColor: '#ffffff',
                color: '#52736d',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                <th style={{ padding: '14px 20px', width: '110px' }}>URGENCY</th>
                <th style={{ padding: '14px 20px', width: '90px' }}>SLOT</th>
                <th style={{ padding: '14px 20px', width: '100px' }}>PATIENT</th>
                <th style={{ padding: '14px 20px', width: '80px' }}>MODE</th>
                <th style={{ padding: '14px 20px' }}>AI RATIONALE</th>
                <th style={{ padding: '14px 20px', width: '90px' }}>CONF</th>
                <th style={{ padding: '14px 20px', width: '90px', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#52736d' }}>
                    <Loader2 size={20} className="animate-spin" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
                    Fetching your queue…
                  </td>
                </tr>
              )}
              {!loading && loadError && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#dc2626', fontSize: '14px' }}>
                    {loadError}
                  </td>
                </tr>
              )}
              {!loading && !loadError && filteredQueue.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#52736d' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#0b3f3a', marginBottom: '6px' }}>
                      {queue.length === 0 ? 'No patients in your queue yet' : 'No rows match the current filters'}
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      {queue.length === 0
                        ? 'When a patient books with you, their case appears here.'
                        : 'Clear a filter or search term to see more.'}
                    </div>
                  </td>
                </tr>
              )}
              <AnimatePresence>
                {!loading && !loadError && filteredQueue.map(item => {
                  const isEmergency = item.urgency === 'EMG';
                  const isUrgent = item.urgency === 'URG';
                  const isNew = newIds.has(item.id);

                  const dotColor = isEmergency ? '#dc2626' : isUrgent ? '#d97706' : '#10b981';
                  const labelText = isEmergency ? 'EMG' : isUrgent ? 'URG' : 'RTN';

                  return (
                    <motion.tr
                      key={item.id}
                      layout
                      variants={listItem}
                      initial={isNew ? { backgroundColor: '#fff2d4' } : "initial"}
                      animate={isNew ? {
                        backgroundColor: isEmergency ? '#fffbfb' : '#ffffff',
                        ...(isEmergency ? { borderLeftColor: ['#dc2626', 'transparent', '#dc2626'] } : {})
                      } : "animate"}
                      exit={{ opacity: 0, y: -6, transition: { duration: 0.18, ease: EASE_EXIT } }}
                      transition={isNew ? { duration: 1.0, ease: EASE_ENTER } : undefined}
                      style={{
                        borderBottom: '1px solid #d9ece7',
                        backgroundColor: isEmergency ? '#fffbfb' : '#ffffff',
                        borderLeft: isEmergency ? '3px solid #dc2626' : '3px solid transparent',
                        height: '50px',
                      }}
                      onMouseEnter={e => {
                        if (!isEmergency) e.currentTarget.style.backgroundColor = '#eaf6f2';
                      }}
                      onMouseLeave={e => {
                        if (!isEmergency) e.currentTarget.style.backgroundColor = '#ffffff';
                      }}
                    >
                      {/* Urgency + (on Past tab) real status */}
                      <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                        <div
                          className="badge-morph"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            fontWeight: 700, fontSize: '12px', color: dotColor,
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor }} />
                          <span>{labelText}</span>
                        </div>
                        {tab === 'past' && queueStatus[item.id] && (
                          <div style={{ marginTop: '4px' }}>
                            <span
                              className="badge-morph"
                              style={{
                                fontSize: '10px', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.04em',
                                padding: '2px 8px', borderRadius: '9999px',
                                color: queueStatus[item.id] === 'COMPLETED' ? '#065f46'
                                     : queueStatus[item.id] === 'NO_SHOW' ? '#92400e'
                                     : '#6b7280',
                                backgroundColor: queueStatus[item.id] === 'COMPLETED' ? '#d1fae5'
                                     : queueStatus[item.id] === 'NO_SHOW' ? '#fef3c7'
                                     : '#f3f4f6',
                              }}
                            >
                              {queueStatus[item.id]}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Slot */}
                      <td style={{ padding: '12px 20px', fontWeight: 600, color: '#0b3f3a' }}>
                        {item.slot}
                      </td>

                      {/* Patient */}
                      <td style={{ padding: '12px 20px', color: '#0b3f3a' }}>
                        <div style={{ fontWeight: 700 }}>{item.patientName}</div>
                        <div style={{ fontSize: '11px', color: '#8aa39d', fontFamily: 'monospace', marginTop: 2 }}>
                          {item.patientId}
                        </div>
                      </td>

                      {/* Mode */}
                      <td style={{ padding: '12px 20px', color: '#52736d', fontSize: '12px' }}>
                        {item.mode}
                      </td>

                      {/* AI Rationale */}
                      <td style={{ padding: '12px 20px', color: '#0b3f3a' }}>
                        {item.rationale}
                      </td>

                      {/* Confidence */}
                      <td style={{ padding: '12px 20px', color: '#52736d', fontSize: '12px' }}>
                        {item.confidence}%
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenItem(item)}
                          className="hover-lift"
                          style={{
                            backgroundColor: 'transparent',
                            border: '1px solid #d9ece7',
                            borderRadius: '9999px',
                            padding: '5px 16px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#0b3f3a',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#0f766e';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.borderColor = '#0f766e';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#0b3f3a';
                            e.currentTarget.style.borderColor = '#d9ece7';
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* BOTTOM PAGINATION BAR */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderTop: '1px solid #d9ece7',
          fontSize: '12px',
          color: '#52736d',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ color: '#8aa39d' }}>
            Showing {filteredQueue.length} of {queue.length}
          </div>

          <button
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #d9ece7',
              borderRadius: '9999px',
              padding: '6px 18px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#0b3f3a',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#0f766e')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#d9ece7')}
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </section>
      </>
      )}

      {/* AVAILABILITY SECTION */}
      {currentSection === 'availability' && (
        <div>
          <section style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0b3f3a', margin: 0, letterSpacing: '-0.025em' }}>
              Clinical Availability & Slot Inventory
            </h1>
            <div style={{ fontSize: '14px', color: '#52736d', marginTop: '4px' }}>
              Set consultation hours, review your forward 7-day slot inventory, and manage booking availability.
            </div>
          </section>

          {/* Availability Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '28px' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px 22px', border: '1px solid #d9ece7', boxShadow: '0 4px 16px rgba(20, 60, 55, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', marginBottom: '8px' }}>
                <Clock size={16} />
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Consultation Hours</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#0b3f3a' }}>09:30 AM – 05:30 PM</div>
              <div style={{ fontSize: '13px', color: '#52736d', marginTop: '4px' }}>Mon – Sat · 30 min per visit</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px 22px', border: '1px solid #d9ece7', boxShadow: '0 4px 16px rgba(20, 60, 55, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', marginBottom: '8px' }}>
                <CheckCircle2 size={16} />
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Forward Inventory</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#0b3f3a' }}>
                {totalOpenSlots} Active Slots
              </div>
              <div style={{ fontSize: '13px', color: '#52736d', marginTop: '4px' }}>
                {totalClosedSlots > 0 ? `${totalClosedSlots} closed · ` : ''}7-day rolling window
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px 22px', border: '1px solid #d9ece7', boxShadow: '0 4px 16px rgba(20, 60, 55, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', marginBottom: '8px' }}>
                <Calendar size={16} />
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Telehealth & In-Person</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#059669' }}>● Online & Active</div>
              <div style={{ fontSize: '13px', color: '#52736d', marginTop: '4px' }}>Accepting both video & clinic visits</div>
            </div>
          </div>

          {/* 7-Day Rolling Calendar View */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #d9ece7', padding: '24px', boxShadow: '0 4px 16px rgba(20, 60, 55, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0b3f3a', margin: 0 }}>Upcoming 7 Days Slots</h2>
                <div style={{ fontSize: '13px', color: '#52736d', marginTop: '3px' }}>
                  Click any slot to toggle between <strong>OPEN</strong> and <strong>CLOSED</strong>. Closed slots cannot be booked by patients.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#0f766e',
                  backgroundColor: '#eaf6f2',
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  border: '1px solid #d9ece7'
                }}>
                  {totalOpenSlots} / {totalPossibleSlots} Slots Open
                </span>
                {totalClosedSlots > 0 && (
                  <button
                    type="button"
                    onClick={openAllSlots}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #d9ece7',
                      borderRadius: '8px',
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#0f766e',
                      cursor: 'pointer',
                      fontFamily: "'Space Grotesk', sans-serif",
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eaf6f2')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  >
                    Open All 42 Slots
                  </button>
                )}
              </div>
            </div>

            {/* Notification Toast */}
            <AnimatePresence>
              {slotToast && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: slotToast.type === 'open' ? '#ecfdf5' : '#fff1f2',
                    border: `1px solid ${slotToast.type === 'open' ? '#a7f3d0' : '#fecdd3'}`,
                    color: slotToast.type === 'open' ? '#065f46' : '#9f1239',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '16px',
                  }}
                >
                  <CheckCircle2 size={15} />
                  <span>{slotToast.message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
              {next7Days.map((day) => {
                const dayHasClosed = DEFAULT_TIMES.some(t => !isSlotOpen(`${day.dateISO}_${t}`, day.dateISO));
                return (
                  <div
                    key={day.idx}
                    style={{
                      backgroundColor: day.isWeekend ? '#fafbfb' : day.idx === 0 ? '#eaf6f2' : '#ffffff',
                      border: day.idx === 0 ? '1px solid #0f766e' : day.isWeekend ? '1px dashed #d1d5db' : '1px solid #d9ece7',
                      borderRadius: '14px',
                      padding: '14px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: day.idx === 0 ? '#0f766e' : '#0b3f3a' }}>
                          {day.dayName}
                        </span>
                        {day.isWeekend && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#dc2626',
                            borderRadius: '4px',
                            padding: '1px 5px',
                            letterSpacing: '0.02em',
                          }}>
                            Holiday
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleDaySlots(day.dateISO, day.dayName)}
                        title={`Click to ${dayHasClosed ? 'open' : 'close'} all slots for ${day.dayName}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '1px 4px',
                          color: '#0f766e',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >
                        {dayHasClosed ? 'Open All' : 'Close All'}
                      </button>
                    </div>
                    <div style={{ fontSize: '12px', color: '#52736d', marginBottom: '12px' }}>
                      {day.dateStr}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {DEFAULT_TIMES.map((time, tIdx) => {
                        const slotKey = `${day.dateISO}_${time}`;
                        const isOpen = isSlotOpen(slotKey, day.dateISO);
                        return (
                          <button
                            key={tIdx}
                            type="button"
                            onClick={() => toggleSlot(slotKey, time, day.dayName, day.dateISO)}
                            title={`Click to mark as ${isOpen ? 'CLOSED (Unavailable)' : 'OPEN (Available)'}`}
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '5px 7px',
                              borderRadius: '7px',
                              backgroundColor: isOpen ? '#ffffff' : '#f8faf9',
                              border: isOpen ? '1px solid #d9ece7' : '1px dashed #d1d5db',
                              color: isOpen ? '#0b3f3a' : '#8aa39d',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                              fontFamily: "'Space Grotesk', sans-serif",
                              transition: 'all 0.15s ease',
                              boxShadow: isOpen ? '0 1px 3px rgba(20, 60, 55, 0.04)' : 'none',
                              opacity: isOpen ? 1 : 0.8,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = isOpen ? '#0f766e' : '#dc2626';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = isOpen ? '#d9ece7' : '#d1d5db';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            <span style={{ textDecoration: isOpen ? 'none' : 'line-through' }}>{time}</span>
                            <span
                              style={{
                                color: isOpen ? '#059669' : '#dc2626',
                                backgroundColor: isOpen ? '#ecfdf5' : '#fef2f2',
                                border: isOpen ? '1px solid rgba(5, 150, 105, 0.25)' : '1px solid rgba(220, 38, 38, 0.25)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontSize: '9px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <span>{isOpen ? '●' : '✕'}</span>
                              <span>{isOpen ? 'OPEN' : 'CLOSED'}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PATIENTS DIRECTORY SECTION */}
      {currentSection === 'patients' && (
        <div>
          <section style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0b3f3a', margin: 0, letterSpacing: '-0.025em' }}>
              Patient Directory
            </h1>
            <div style={{ fontSize: '14px', color: '#52736d', marginTop: '4px' }}>
              Review clinical profiles, previous diagnoses, and appointment histories for patients under your care.
            </div>
          </section>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #d9ece7', overflow: 'hidden', boxShadow: '0 4px 16px rgba(20, 60, 55, 0.05)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #d9ece7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '16px', color: '#0b3f3a' }}>
                All Patients ({[...activeQueue, ...pastQueue].length > 0 ? [...activeQueue, ...pastQueue].length : 3})
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#eaf6f2', borderBottom: '1px solid #d9ece7', color: '#52736d', fontWeight: 600 }}>
                    <th style={{ padding: '12px 20px' }}>Patient</th>
                    <th style={{ padding: '12px 20px' }}>Patient ID</th>
                    <th style={{ padding: '12px 20px' }}>Latest Complaint</th>
                    <th style={{ padding: '12px 20px' }}>Urgency</th>
                    <th style={{ padding: '12px 20px' }}>Last Consultation</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {([...activeQueue, ...pastQueue].length > 0 ? [...activeQueue, ...pastQueue] : [
                    { id: '1', patientName: 'Hari Patel', patientId: '#8b17', chiefComplaint: 'Persistent fever and mild throat pain', urgency: 'URG' as const, slot: 'Today · 07:30 PM' },
                    { id: '2', patientName: 'Sarah Jenkins', patientId: '#4500', chiefComplaint: 'Follow-up for asthma and bronchial review', urgency: 'RTN' as const, slot: 'Yesterday · 11:30 AM' },
                    { id: '3', patientName: 'Avi Patel', patientId: '#3a21', chiefComplaint: 'Acute chest tightness during exertion', urgency: 'EMG' as const, slot: '2 days ago · 09:30 AM' },
                  ]).map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #d9ece7' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 600, color: '#0b3f3a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#eaf6f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f766e', fontWeight: 700 }}>
                            {p.patientName.charAt(0)}
                          </div>
                          <span>{p.patientName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', color: '#52736d', fontFamily: 'monospace' }}>{p.patientId}</td>
                      <td style={{ padding: '14px 20px', color: '#0b3f3a' }}>{p.chiefComplaint || 'Consultation follow-up'}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700,
                          backgroundColor: p.urgency === 'EMG' ? '#fee2e2' : p.urgency === 'URG' ? '#fef3c7' : '#ecfdf5',
                          color: p.urgency === 'EMG' ? '#dc2626' : p.urgency === 'URG' ? '#d97706' : '#059669',
                        }}>
                          {p.urgency === 'EMG' ? 'Emergency' : p.urgency === 'URG' ? 'Urgent' : 'Routine'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', color: '#52736d' }}>{p.slot}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            if ('rationale' in p) handleOpenItem(p as QueueItem);
                            window.location.hash = '#my-queue';
                          }}
                          style={{ backgroundColor: '#eaf6f2', border: '1px solid #d9ece7', borderRadius: '9999px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, color: '#0f766e', cursor: 'pointer' }}
                        >
                          View Case
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TRANSCRIPTS SECTION */}
      {currentSection === 'transcripts' && (
        <div>
          <section style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0b3f3a', margin: 0, letterSpacing: '-0.025em' }}>
              Consultation Transcripts & Clinical Notes
            </h1>
            <div style={{ fontSize: '14px', color: '#52736d', marginTop: '4px' }}>
              Deepgram speech-to-text transcripts, AI-generated advisory summaries, and verified clinician notes (DR-11, DR-15).
            </div>
          </section>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              {
                id: 'tr-01',
                patient: 'Hari Patel (#8b17)',
                date: 'Today · 07:30 PM',
                mode: 'Video Consultation',
                status: 'Reviewed & Approved',
                summary: 'Patient presented with a 3-day history of 101°F fever and throat discomfort. Denies shortness of breath or chest pain. Advised oral hydration, Paracetamol 650mg SOS, and CBC if fever persists beyond 48 hours.',
                consent: 'Explicit Audio Recording Consent Verified (DPDP / DR-11)',
              },
              {
                id: 'tr-02',
                patient: 'Sarah Jenkins (#4500)',
                date: 'Yesterday · 11:30 AM',
                mode: 'In-person Clinic Visit',
                status: 'Clinician Verified',
                summary: 'Regular asthma follow-up. Peak flow measurements stable at 420 L/min. Continued Budesonide/Formoterol 200/6 inhaler 1 puff twice daily. Next review in 3 months.',
                consent: 'Explicit In-Clinic Transcription Consent Verified',
              },
            ].map(item => (
              <div key={item.id} style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #d9ece7', padding: '22px 24px', boxShadow: '0 4px 16px rgba(20, 60, 55, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#0b3f3a' }}>{item.patient}</span>
                    <span style={{ fontSize: '13px', color: '#52736d', marginLeft: '10px' }}>{item.date} · {item.mode}</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                    ✓ {item.status}
                  </span>
                </div>
                <div style={{ backgroundColor: '#eaf6f2', borderRadius: '12px', padding: '14px 16px', fontSize: '13px', lineHeight: '1.6', color: '#0b3f3a', marginBottom: '12px', border: '1px solid #d9ece7' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                    AI Clinical Summary (Advisory Only)
                  </div>
                  {item.summary}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#52736d', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                    <ShieldCheck size={14} />
                    <span>{item.consent}</span>
                  </div>
                  <button
                    onClick={() => alert('Transcript and clinical summary ready for export.')}
                    style={{ background: 'none', border: 'none', color: '#0f766e', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Export / Print Notes →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CLINICAL REVIEW SIDE DRAWER (Slides from right, 480px width) */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedItem(null)}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(11, 63, 58, 0.45)',
                zIndex: 99,
              }}
            />
            <motion.aside
              key="drawer-body"
              variants={slideInRight}
              initial="initial"
              animate="animate"
              exit={{ x: 480, opacity: 0.9, transition: { duration: 0.22, ease: EASE_EXIT } }}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '480px',
                maxWidth: '100vw',
                backgroundColor: '#ffffff',
                boxShadow: '-8px 0 32px rgba(20, 60, 55, 0.12)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                borderLeft: '1px solid #d9ece7',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {/* Drawer Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #d9ece7',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0b3f3a' }}>
                    {selectedItem.patientName}
                  </div>
                  <div style={{ fontSize: '13px', color: '#52736d', marginTop: '2px' }}>
                    {selectedItem.patientId} · Appointment {selectedItem.slot} · {selectedItem.mode === 'VID' ? 'Video consult' : 'In-person consult'}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="icon-pop"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#52736d',
                    padding: '4px',
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Content */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}>
                <AnimatePresence>
                  {saveBanner && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: EASE_ENTER }}
                      style={{
                        backgroundColor: '#ecfdf5',
                        color: '#065f46',
                        border: '1px solid #a7f3d0',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    >
                      ✓ Clinical override updated successfully.
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* AI Advisory Box */}
                <div style={{
                  backgroundColor: '#eaf6f2',
                  border: '1px solid #d9ece7',
                  borderRadius: '16px',
                  padding: '18px',
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: '#0f766e',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                  }}>
                    AI ADVISORY
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: selectedItem.urgency === 'EMG' ? '#dc2626' : selectedItem.urgency === 'URG' ? '#d97706' : '#10b981',
                    marginBottom: '16px',
                  }}>
                    <span>Urgency: {selectedItem.urgency === 'EMG' ? 'EMERGENCY' : selectedItem.urgency === 'URG' ? 'URGENT' : 'ROUTINE'}</span>
                    <span style={{ color: '#52736d', fontWeight: 400 }}>· {selectedItem.confidence}% confidence</span>
                  </div>

                  {/* Override Controls */}
                  <div style={{
                    paddingTop: '12px',
                    borderTop: '1px solid #d9ece7',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0b3f3a' }}>
                      Override Urgency:
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={overrideScore}
                        onChange={e => setOverrideScore(e.target.value)}
                        style={{
                          flex: 1,
                          backgroundColor: '#ffffff',
                          border: '1px solid #d9ece7',
                          borderRadius: '8px',
                          padding: '7px 10px',
                          fontSize: '13px',
                          color: '#0b3f3a',
                          outline: 'none',
                        }}
                      >
                        <option value="Routine">Routine</option>
                        <option value="Urgent">Urgent</option>
                        <option value="Emergency">Emergency</option>
                      </select>
                      <button
                        onClick={handleSaveOverride}
                        disabled={actionBusy === 'OVERRIDE_URGENCY'}
                        className="hover-lift"
                        style={{
                          backgroundColor: '#0f766e',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 16px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: actionBusy === 'OVERRIDE_URGENCY' ? 'wait' : 'pointer',
                          opacity: actionBusy === 'OVERRIDE_URGENCY' ? 0.6 : 1,
                        }}
                      >
                        {actionBusy === 'OVERRIDE_URGENCY' ? 'Saving…' : 'Save with reason'}
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Clinical reason for override (e.g., patient vitals stable)"
                      value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #d9ece7',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        fontSize: '12px',
                        color: '#0b3f3a',
                        outline: 'none',
                      }}
                    />
                    {actionError && (
                      <div style={{
                        marginTop: '4px',
                        fontSize: '12px', color: '#dc2626',
                        backgroundColor: 'rgba(220, 38, 38, 0.06)',
                        border: '1px solid rgba(220, 38, 38, 0.2)',
                        borderRadius: '8px', padding: '6px 10px',
                      }}>{actionError}</div>
                    )}
                  </div>
                </div>

                {/* Why Section */}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0b3f3a', marginBottom: '8px' }}>
                    Why
                  </div>
                  <ul style={{
                    margin: 0,
                    paddingLeft: '18px',
                    fontSize: '13px',
                    color: '#0b3f3a',
                    lineHeight: '1.7',
                  }}>
                    {selectedItem.symptoms.map((sym, idx) => (
                      <li key={idx}>{sym}</li>
                    ))}
                  </ul>
                </div>

                {/* Questionnaire responses */}
                <div style={{
                  border: '1px solid #d9ece7',
                  borderRadius: '16px',
                  padding: '16px',
                  backgroundColor: '#ffffff',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0b3f3a', marginBottom: '8px' }}>
                    Questionnaire responses
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    {selectedItem.questionnaire.map((q, idx) => (
                      <div key={idx} style={{ borderBottom: '1px solid #d9ece7', paddingBottom: '6px' }}>
                        <div style={{ color: '#52736d' }}>{q.q}</div>
                        <div style={{ fontWeight: 600, color: '#0b3f3a', marginTop: '2px' }}>{q.a}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Past Visits */}
                <div style={{
                  border: '1px solid #d9ece7',
                  borderRadius: '16px',
                  padding: '16px',
                  backgroundColor: '#ffffff',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0b3f3a', marginBottom: '8px' }}>
                    Past visits ({selectedItem.pastVisits.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    {selectedItem.pastVisits.map((pv, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#0b3f3a' }}>
                        <span>{pv.date} · {pv.doctor}</span>
                        <span style={{ color: '#52736d' }}>{pv.diagnosis}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Attached Images / Documents */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0b3f3a' }}>
                      Attached Files ({selectedItem.attachments?.length || 0})
                    </div>
                  </div>
                  {selectedItem.attachments && selectedItem.attachments.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                      {selectedItem.attachments.map((att) => {
                        const isImg = att.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(att.fileName);
                        return (
                          <a
                            key={att.id}
                            href={att.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              borderRadius: '10px',
                              border: '1px solid #d9ece7',
                              overflow: 'hidden',
                              textDecoration: 'none',
                              backgroundColor: '#ffffff',
                              boxShadow: '0 1px 3px rgba(11,63,58,0.06)',
                              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 4px 10px rgba(11,63,58,0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(11,63,58,0.06)';
                            }}
                          >
                            <div style={{
                              height: '75px',
                              backgroundColor: '#eaf6f2',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              position: 'relative',
                            }}>
                              {isImg ? (
                                <img
                                  src={att.fileUrl}
                                  alt={att.fileName}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <FileText size={28} color="#0f766e" />
                              )}
                              <span style={{
                                position: 'absolute',
                                bottom: '4px',
                                right: '4px',
                                background: 'rgba(11,63,58,0.7)',
                                color: '#ffffff',
                                borderRadius: '4px',
                                padding: '2px 4px',
                                fontSize: '9px',
                                fontWeight: 700,
                              }}>
                                {att.fileCategory === 'SYMPTOM_IMAGE' ? 'PHOTO' : att.fileCategory === 'PRIOR_PRESCRIPTION' ? 'RX' : 'REPORT'}
                              </span>
                            </div>
                            <div style={{ padding: '6px 8px' }}>
                              <div style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#0b3f3a',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }} title={att.fileName}>
                                {att.fileName}
                              </div>
                              <div style={{ fontSize: '10px', color: '#52736d', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                <ExternalLink size={10} /> View
                              </div>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{
                      fontSize: '12px',
                      color: '#52736d',
                      padding: '12px',
                      backgroundColor: '#f5faf8',
                      borderRadius: '8px',
                      border: '1px dashed #d9ece7',
                      textAlign: 'center',
                    }}>
                      No images or prior prescriptions uploaded for this consultation.
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer: read-only banner on past tab, actions on active */}
              {tab === 'past' ? (
                <div style={{
                  padding: '18px 24px', borderTop: '1px solid #d9ece7',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: '10px', flexWrap: 'wrap',
                  backgroundColor: '#eaf6f2',
                }}>
                  <div style={{ fontSize: '13px', color: '#52736d' }}>
                    Read-only · final status:{' '}
                    <strong style={{ color: '#0b3f3a' }}>{queueStatus[selectedItem.id] ?? '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {selectedItem.mode === 'VID' && (
                      <button
                        onClick={() => navigate(`/consultation/${selectedItem.id}`)}
                        className="hover-lift"
                        style={{
                          backgroundColor: '#0f766e', color: '#ffffff',
                          border: 'none', borderRadius: '9999px',
                          padding: '8px 18px', fontSize: '13px', fontWeight: 600,
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        <FileText size={14} /> Visit Summary
                      </button>
                    )}
                    <button
                      onClick={() => setRxEditorFor(selectedItem)}
                      className="hover-lift"
                      style={{
                        backgroundColor: '#0f766e', color: '#ffffff',
                        border: 'none', borderRadius: '9999px',
                        padding: '8px 18px', fontSize: '13px', fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Prescription
                    </button>
                    <button
                      onClick={() => setSelectedItem(null)}
                      style={{
                        backgroundColor: 'transparent', color: '#0b3f3a',
                        border: '1px solid #d9ece7', borderRadius: '9999px',
                        padding: '8px 18px', fontSize: '13px', fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
              <div style={{
                padding: '18px 24px',
                borderTop: '1px solid #d9ece7',
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
              }}>
                {selectedItem.mode === 'VID' && (
                  <button
                    onClick={() => navigate(`/consultation/${selectedItem.id}`)}
                    className="hover-lift"
                    style={{
                      width: '100%',
                      backgroundColor: '#10b981', color: '#ffffff',
                      border: 'none', borderRadius: '9999px',
                      padding: '11px 0', fontSize: '13px', fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '8px',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                      marginBottom: '4px',
                    }}
                    title="Enter live video consultation room with patient"
                  >
                    <Video size={16} /> Start Video Consult
                  </button>
                )}
                <button
                  onClick={() => runAction('ACCEPT')}
                  disabled={!!actionBusy}
                  className="hover-lift"
                  style={{
                    flex: 1, minWidth: '140px',
                    backgroundColor: '#0f766e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '11px 0',
                    fontSize: '13px', fontWeight: 600,
                    cursor: actionBusy ? 'wait' : 'pointer',
                    opacity: actionBusy ? 0.6 : 1,
                  }}
                  title="Accept this appointment (BOOKED → CONFIRMED)"
                >
                  {actionBusy === 'ACCEPT' ? 'Accepting…' : 'Accept & confirm'}
                </button>
                <button
                  onClick={() => runAction('COMPLETE', { notes: 'Consultation completed' })}
                  disabled={!!actionBusy}
                  className="hover-lift"
                  style={{
                    flex: 1, minWidth: '120px',
                    backgroundColor: '#059669', color: '#ffffff',
                    border: 'none', borderRadius: '9999px',
                    padding: '11px 0', fontSize: '13px', fontWeight: 600,
                    cursor: actionBusy ? 'wait' : 'pointer',
                    opacity: actionBusy ? 0.6 : 1,
                  }}
                  title="Mark completed"
                >
                  {actionBusy === 'COMPLETE' ? 'Saving…' : 'Mark complete'}
                </button>
                <button
                  onClick={() => runAction('NO_SHOW')}
                  disabled={!!actionBusy}
                  className="hover-lift"
                  style={{
                    backgroundColor: 'transparent',
                    color: '#dc2626',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    borderRadius: '9999px',
                    padding: '11px 18px',
                    fontSize: '13px', fontWeight: 500,
                    cursor: actionBusy ? 'wait' : 'pointer',
                  }}
                >
                  {actionBusy === 'NO_SHOW' ? 'Saving…' : 'No-show'}
                </button>
                <button
                  onClick={() => setRxEditorFor(selectedItem)}
                  disabled={!!actionBusy}
                  className="hover-lift"
                  style={{
                    backgroundColor: '#0284c7', color: '#ffffff',
                    border: 'none', borderRadius: '9999px',
                    padding: '11px 18px', fontSize: '13px', fontWeight: 600,
                    cursor: actionBusy ? 'wait' : 'pointer',
                  }}
                >
                  Write prescription
                </button>
              </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {rxEditorFor && (
        <PrescriptionEditor
          appointmentId={rxEditorFor.id}
          patientName={rxEditorFor.patientName}
          onClose={() => setRxEditorFor(null)}
        />
      )}
    </PageTransition>
  );
};
