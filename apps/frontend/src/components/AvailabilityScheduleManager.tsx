import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  TreePalm,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
  Sparkles,
  CalendarOff,
} from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { doctorProfileApi } from '../services/api';
import type {
  DoctorLeave,
  DoctorSlotDetail,
  ScheduleTemplate,
} from '../types';

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DURATION_OPTIONS = [
  { value: '15', label: '15 mins' },
  { value: '20', label: '20 mins' },
  { value: '30', label: '30 mins' },
  { value: '45', label: '45 mins' },
  { value: '60', label: '60 mins' },
];

interface DayRowConfig {
  enabled: boolean;
  startTime: string; // "09:00"
  endTime: string;   // "13:00"
  slotDurationMinutes: number; // 20
}

export const AvailabilityScheduleManager: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [savingSchedule, setSavingSchedule] = useState<boolean>(false);
  const [submittingLeave, setSubmittingLeave] = useState<boolean>(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Weekly Schedule State (1..7 => Mon..Sun)
  const [weeklyConfig, setWeeklyConfig] = useState<Record<number, DayRowConfig>>({
    1: { enabled: true, startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 },
    2: { enabled: false, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30 },
    3: { enabled: true, startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 },
    4: { enabled: false, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30 },
    5: { enabled: true, startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 },
    6: { enabled: false, startTime: '10:00', endTime: '14:00', slotDurationMinutes: 30 },
    7: { enabled: false, startTime: '10:00', endTime: '14:00', slotDurationMinutes: 30 },
  });

  // Leaves & 14-day Slots Inventory
  const [leaves, setLeaves] = useState<DoctorLeave[]>([]);
  const [slotsInventory, setSlotsInventory] = useState<DoctorSlotDetail[]>([]);

  // New Leave Form
  const [leaveStart, setLeaveStart] = useState<string>('');
  const [leaveEnd, setLeaveEnd] = useState<string>('');
  const [leaveReason, setLeaveReason] = useState<string>('');

  // Ad-hoc slot creation
  const [adHocDate, setAdHocDate] = useState<string>('');
  const [adHocTime, setAdHocTime] = useState<string>('09:00');
  const [showAdHocModal, setShowAdHocModal] = useState<boolean>(false);

  // Notification Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  // Convert raw templates to week config
  const populateWeeklyConfig = (templates: ScheduleTemplate[]) => {
    const nextConfig: Record<number, DayRowConfig> = {
      1: { enabled: false, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30 },
      2: { enabled: false, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30 },
      3: { enabled: false, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30 },
      4: { enabled: false, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30 },
      5: { enabled: false, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30 },
      6: { enabled: false, startTime: '09:00', endTime: '14:00', slotDurationMinutes: 30 },
      7: { enabled: false, startTime: '09:00', endTime: '14:00', slotDurationMinutes: 30 },
    };

    if (templates && templates.length > 0) {
      templates.forEach((t) => {
        const dow = t.dayOfWeek;
        if (dow >= 1 && dow <= 7) {
          nextConfig[dow] = {
            enabled: true,
            startTime: t.startTime.slice(0, 5),
            endTime: t.endTime.slice(0, 5),
            slotDurationMinutes: t.slotDurationMinutes || 30,
          };
        }
      });
    } else {
      // Default: Mon, Wed, Fri 9:00 AM - 1:00 PM with 20 min slots (matching user issue criteria)
      nextConfig[1] = { enabled: true, startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 };
      nextConfig[3] = { enabled: true, startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 };
      nextConfig[5] = { enabled: true, startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 };
    }

    setWeeklyConfig(nextConfig);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, leavesRes, slotsRes] = await Promise.all([
        doctorProfileApi.me(),
        doctorProfileApi.getLeaves().catch(() => [] as DoctorLeave[]),
        doctorProfileApi.getSlotsInventory(14).catch(() => [] as DoctorSlotDetail[]),
      ]);
      populateWeeklyConfig(meRes.scheduleTemplate || []);
      setLeaves(leavesRes);
      setSlotsInventory(slotsRes);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load availability data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Apply Presets
  const applyPreset = (presetType: 'MWF_20' | 'WEEKDAY_30' | 'FULLWEEK_30') => {
    const updated: Record<number, DayRowConfig> = { ...weeklyConfig };
    if (presetType === 'MWF_20') {
      for (let d = 1; d <= 7; d++) {
        if (d === 1 || d === 3 || d === 5) {
          updated[d] = { enabled: true, startTime: '09:00', endTime: '13:00', slotDurationMinutes: 20 };
        } else {
          updated[d] = { ...updated[d], enabled: false };
        }
      }
      showToast('Loaded preset: Every Mon/Wed/Fri from 9:00 AM to 1:00 PM (20 min slots)');
    } else if (presetType === 'WEEKDAY_30') {
      for (let d = 1; d <= 7; d++) {
        if (d <= 5) {
          updated[d] = { enabled: true, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30 };
        } else {
          updated[d] = { ...updated[d], enabled: false };
        }
      }
      showToast('Loaded preset: Standard Weekdays (Mon–Fri, 9:00 AM – 5:00 PM, 30 min)');
    } else if (presetType === 'FULLWEEK_30') {
      for (let d = 1; d <= 7; d++) {
        if (d <= 6) {
          updated[d] = { enabled: true, startTime: '09:30', endTime: '16:30', slotDurationMinutes: 30 };
        } else {
          updated[d] = { ...updated[d], enabled: false };
        }
      }
      showToast('Loaded preset: Mon–Sat (9:30 AM – 4:30 PM, 30 min)');
    }
    setWeeklyConfig(updated);
  };

  // Save Weekly Schedule -> Regenerates next 14 days of slots
  const handleSaveWeeklySchedule = async () => {
    setSavingSchedule(true);
    try {
      const payload: Omit<ScheduleTemplate, 'id'>[] = [];
      for (let dow = 1; dow <= 7; dow++) {
        const conf = weeklyConfig[dow];
        if (conf.enabled) {
          if (conf.startTime >= conf.endTime) {
            throw new Error(`${DAY_NAMES[dow - 1]}: End time must be after start time`);
          }
          payload.push({
            dayOfWeek: dow,
            startTime: `${conf.startTime}:00`,
            endTime: `${conf.endTime}:00`,
            slotDurationMinutes: Number(conf.slotDurationMinutes),
          });
        }
      }

      const updated = await doctorProfileApi.replaceSchedule(payload);
      populateWeeklyConfig(updated.scheduleTemplate || []);

      // Refresh slots inventory
      const freshSlots = await doctorProfileApi.getSlotsInventory(14);
      setSlotsInventory(freshSlots);

      showToast('Weekly schedule saved! Slots automatically generated for the next 14 days.');
    } catch (err: any) {
      showToast(err?.message || 'Could not save recurring schedule', 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  // Add Leave / Vacation Date
  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd) {
      showToast('Please select start date and end date', 'error');
      return;
    }
    if (leaveEnd < leaveStart) {
      showToast('End date cannot be earlier than start date', 'error');
      return;
    }

    setSubmittingLeave(true);
    try {
      await doctorProfileApi.addLeave({
        startDate: leaveStart,
        endDate: leaveEnd,
        reason: leaveReason.trim() || undefined,
      });

      // Reload leaves and slots inventory
      const [freshLeaves, freshSlots] = await Promise.all([
        doctorProfileApi.getLeaves(),
        doctorProfileApi.getSlotsInventory(14),
      ]);
      setLeaves(freshLeaves);
      setSlotsInventory(freshSlots);

      setLeaveStart('');
      setLeaveEnd('');
      setLeaveReason('');
      showToast('Leave marked. Slots suppressed and existing unbooked slots set to unavailable.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to mark leave', 'error');
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Cancel / Delete Leave
  const handleDeleteLeave = async (leaveId: string) => {
    setActionBusyId(leaveId);
    try {
      await doctorProfileApi.deleteLeave(leaveId);
      const [freshLeaves, freshSlots] = await Promise.all([
        doctorProfileApi.getLeaves(),
        doctorProfileApi.getSlotsInventory(14),
      ]);
      setLeaves(freshLeaves);
      setSlotsInventory(freshSlots);
      showToast('Leave cancelled. Regular 14-day schedule and slots restored.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to cancel leave', 'error');
    } finally {
      setActionBusyId(null);
    }
  };

  // Toggle Single Slot Availability (Open <-> Unavailable)
  const handleToggleSlotAvailability = async (slot: DoctorSlotDetail) => {
    if (slot.booked) {
      showToast('Cannot change availability of an already booked appointment slot', 'error');
      return;
    }
    setActionBusyId(slot.id);
    try {
      const updated = await doctorProfileApi.toggleSlotAvailability(slot.id);
      setSlotsInventory((prev) =>
        prev.map((s) => (s.id === slot.id ? { ...s, available: updated.available } : s))
      );
      showToast(
        `Slot at ${formatTime(slot.slotAt)} is now marked as ${updated.available ? 'OPEN' : 'UNAVAILABLE'}`
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to update slot status', 'error');
    } finally {
      setActionBusyId(null);
    }
  };

  // Add Ad-Hoc Slot
  const handleAddAdHocSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adHocDate || !adHocTime) {
      showToast('Please select date and time for the one-off slot', 'error');
      return;
    }
    try {
      const slotIso = new Date(`${adHocDate}T${adHocTime}:00`).toISOString();
      await doctorProfileApi.addSlot(slotIso);
      const freshSlots = await doctorProfileApi.getSlotsInventory(14);
      setSlotsInventory(freshSlots);
      setShowAdHocModal(false);
      showToast(`Ad-hoc slot added on ${adHocDate} at ${adHocTime}`);
    } catch (err: any) {
      showToast(err?.message || 'Could not add ad-hoc slot', 'error');
    }
  };

  // Format Helpers
  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return isoString;
    }
  };

  // Group slots by date for the next 14 days
  const forward14Days = useMemo(() => {
    const days: {
      dateISO: string;
      dayLabel: string;
      dateStr: string;
      isToday: boolean;
      isTomorrow: boolean;
      leave?: DoctorLeave;
      slots: DoctorSlotDetail[];
    }[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateISO = `${year}-${month}-${day}`;

      const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' });
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      // Check if this date falls within any leave
      const activeLeave = leaves.find((l) => dateISO >= l.startDate && dateISO <= l.endDate);

      // Find slots for this date
      const daySlots = slotsInventory
        .filter((s) => s.slotAt.startsWith(dateISO))
        .sort((a, b) => a.slotAt.localeCompare(b.slotAt));

      days.push({
        dateISO,
        dayLabel,
        dateStr,
        isToday: i === 0,
        isTomorrow: i === 1,
        leave: activeLeave,
        slots: daySlots,
      });
    }

    return days;
  }, [leaves, slotsInventory]);

  // Overall Statistics
  const totalSlotsCount = slotsInventory.length;
  const openSlotsCount = slotsInventory.filter((s) => s.available && !s.booked).length;
  const bookedSlotsCount = slotsInventory.filter((s) => s.booked).length;
  const unavailableSlotsCount = slotsInventory.filter((s) => !s.available && !s.booked).length;
  const upcomingLeavesCount = leaves.filter((l) => {
    const todayISO = new Date().toISOString().slice(0, 10);
    return l.endDate >= todayISO;
  }).length;

  if (loading) {
    return (
      <div style={{ padding: '64px', textAlign: 'center', color: '#6b7280' }}>
        <Loader2 size={24} className="animate-spin" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: '#0f766e' }} />
        <span style={{ fontSize: '15px', fontWeight: 500 }}>Loading recurring availability & schedule...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: 'fixed',
              top: '24px',
              right: '24px',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 18px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
              backgroundColor: toast.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: toast.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${toast.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header section */}
      <section style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0b3f3a', margin: 0, letterSpacing: '-0.02em' }}>
              Recurring Schedule & Vacation/Leave Calendar
            </h1>
            <p style={{ fontSize: '14px', color: '#52736d', marginTop: '6px', maxWidth: '780px', lineHeight: 1.5 }}>
              Set your recurring weekly working hours (e.g. Every Mon/Wed/Fri 9:00 AM – 1:00 PM with 20 min slots). Slots are automatically generated for the next 14 days. Block out vacation and leave days to suppress slot creation and mark existing unbooked slots as unavailable.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ffffff',
              border: '1px solid #d9ece7',
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#0f766e',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </section>

      {/* Overview Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #d9ece7', boxShadow: '0 4px 16px rgba(20, 60, 55, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', marginBottom: '6px' }}>
            <Calendar size={16} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#8aa39d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>14-Day Horizon</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0b3f3a' }}>{totalSlotsCount} Total Slots</div>
          <div style={{ fontSize: '12px', color: '#52736d', marginTop: '4px' }}>Materialized from weekly template</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #d9ece7', boxShadow: '0 4px 16px rgba(20, 60, 55, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', marginBottom: '6px' }}>
            <CheckCircle2 size={16} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#8aa39d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Open For Booking</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#059669' }}>{openSlotsCount} Active</div>
          <div style={{ fontSize: '12px', color: '#52736d', marginTop: '4px' }}>Ready for patient appointments</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #d9ece7', boxShadow: '0 4px 16px rgba(20, 60, 55, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', marginBottom: '6px' }}>
            <Clock size={16} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#8aa39d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Booked Visits</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e40af' }}>{bookedSlotsCount} Booked</div>
          <div style={{ fontSize: '12px', color: '#52736d', marginTop: '4px' }}>Confirmed patient appointments</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #d9ece7', boxShadow: '0 4px 16px rgba(20, 60, 55, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d97706', marginBottom: '6px' }}>
            <TreePalm size={16} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#8aa39d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vacation / Leaves</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#b45309' }}>{upcomingLeavesCount} Active Block(s)</div>
          <div style={{ fontSize: '12px', color: '#52736d', marginTop: '4px' }}>{unavailableSlotsCount} slots suppressed/closed</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '28px', marginBottom: '28px' }}>
        {/* SECTION 1: RECURRING WEEKLY WORKING HOURS */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #d9ece7', padding: '24px', boxShadow: '0 4px 16px rgba(20, 60, 55, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={20} color="#0f766e" />
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0b3f3a', margin: 0 }}>
                  Weekly Recurring Working Hours
                </h2>
              </div>
              <p style={{ fontSize: '13px', color: '#52736d', margin: '4px 0 0 0' }}>
                Define default consultation hours per day. Saving automatically generates fresh concrete slots for the next 14 days.
              </p>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>Quick Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset('MWF_20')}
                style={{
                  backgroundColor: '#eaf6f2',
                  border: '1px solid #bce3d9',
                  borderRadius: '8px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#0f766e',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Every Mon/Wed/Fri from 9:00 AM to 1:00 PM with 20 minute slots"
              >
                <Sparkles size={12} /> Mon/Wed/Fri (20m)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('WEEKDAY_30')}
                style={{
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                Mon–Fri 9–5 (30m)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('FULLWEEK_30')}
                style={{
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                Mon–Sat (30m)
              </button>
            </div>
          </div>

          {/* Days Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {DAY_NAMES.map((dayName, idx) => {
              const dow = idx + 1;
              const config = weeklyConfig[dow] || {
                enabled: false,
                startTime: '09:00',
                endTime: '17:00',
                slotDurationMinutes: 30,
              };

              return (
                <div
                  key={dow}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(140px, 1.2fr) minmax(110px, 1fr) minmax(110px, 1fr) minmax(130px, 1fr) auto',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: config.enabled ? '#ffffff' : '#f9fafb',
                    border: config.enabled ? '1px solid #d9ece7' : '1px dashed #e5e7eb',
                    opacity: config.enabled ? 1 : 0.65,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) =>
                        setWeeklyConfig((prev) => ({
                          ...prev,
                          [dow]: { ...prev[dow], enabled: e.target.checked },
                        }))
                      }
                      style={{ width: '16px', height: '16px', accentColor: '#0f766e', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: config.enabled ? 700 : 500, color: config.enabled ? '#0b3f3a' : '#9ca3af' }}>
                      {dayName}
                    </span>
                  </label>

                  <div>
                    <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>Start Time</label>
                    <input
                      type="time"
                      value={config.startTime}
                      disabled={!config.enabled}
                      onChange={(e) =>
                        setWeeklyConfig((prev) => ({
                          ...prev,
                          [dow]: { ...prev[dow], startTime: e.target.value },
                        }))
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        fontSize: '13px',
                        color: '#111827',
                        backgroundColor: config.enabled ? '#ffffff' : '#f3f4f6',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>End Time</label>
                    <input
                      type="time"
                      value={config.endTime}
                      disabled={!config.enabled}
                      onChange={(e) =>
                        setWeeklyConfig((prev) => ({
                          ...prev,
                          [dow]: { ...prev[dow], endTime: e.target.value },
                        }))
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        fontSize: '13px',
                        color: '#111827',
                        backgroundColor: config.enabled ? '#ffffff' : '#f3f4f6',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>Slot Duration</label>
                    <CustomSelect
                      value={String(config.slotDurationMinutes)}
                      onChange={(val) =>
                        setWeeklyConfig((prev) => ({
                          ...prev,
                          [dow]: { ...prev[dow], slotDurationMinutes: Number(val) },
                        }))
                      }
                      options={DURATION_OPTIONS}
                      disabled={!config.enabled}
                    />
                  </div>

                  <div style={{ fontSize: '12px', color: config.enabled ? '#059669' : '#9ca3af', fontWeight: 600, textAlign: 'right' }}>
                    {config.enabled ? 'ACTIVE' : 'OFF'}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={handleSaveWeeklySchedule}
              disabled={savingSchedule}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#0f766e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: savingSchedule ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(15, 118, 110, 0.2)',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!savingSchedule) e.currentTarget.style.backgroundColor = '#0b5a54'; }}
              onMouseLeave={(e) => { if (!savingSchedule) e.currentTarget.style.backgroundColor = '#0f766e'; }}
            >
              {savingSchedule ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Weekly Schedule & Regenerate 14-Day Slots
            </button>
          </div>
        </div>

        {/* SECTION 2: VACATION & LEAVE CALENDAR */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #d9ece7', padding: '24px', boxShadow: '0 4px 16px rgba(20, 60, 55, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <TreePalm size={20} color="#b45309" />
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0b3f3a', margin: 0 }}>
              Vacation & Leave Calendar
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: '#52736d', margin: '0 0 18px 0' }}>
            Mark vacation days or planned leaves. Marking leave dates automatically suppresses slot creation and marks existing unbooked slots as unavailable.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Mark Leave Form */}
            <form onSubmit={handleAddLeave} style={{ backgroundColor: '#fcfdfd', border: '1px solid #e2ece9', borderRadius: '14px', padding: '18px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0b3f3a', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CalendarOff size={16} color="#0f766e" /> Mark New Leave / Vacation
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      color: '#111827',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    min={leaveStart || new Date().toISOString().slice(0, 10)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      color: '#111827',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                  Reason / Purpose (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual Vacation, Medical Conference, Personal Leave"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submittingLeave}
                style={{
                  width: '100%',
                  display: 'inline-flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#b45309',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: submittingLeave ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => { if (!submittingLeave) e.currentTarget.style.backgroundColor = '#92400e'; }}
                onMouseLeave={(e) => { if (!submittingLeave) e.currentTarget.style.backgroundColor = '#b45309'; }}
              >
                {submittingLeave ? <Loader2 size={15} className="animate-spin" /> : <TreePalm size={15} />}
                Block Out Leave Dates
              </button>
            </form>

            {/* Marked Leaves List */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0b3f3a', marginBottom: '12px' }}>
                Active & Upcoming Leaves ({leaves.length})
              </div>

              {leaves.length === 0 ? (
                <div
                  style={{
                    padding: '24px',
                    border: '1px dashed #d9ece7',
                    borderRadius: '12px',
                    backgroundColor: '#f8faf9',
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: '13px',
                  }}
                >
                  <TreePalm size={24} color="#9ca3af" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  No vacation or leave dates currently recorded. All recurring weekly slots are active.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                  {leaves.map((leave) => {
                    const isBusy = actionBusyId === leave.id;
                    return (
                      <div
                        key={leave.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          backgroundColor: '#fffbeb',
                          border: '1px solid #fef3c7',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>
                              {leave.startDate} {leave.startDate !== leave.endDate ? `to ${leave.endDate}` : '(1 day)'}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                backgroundColor: '#fde68a',
                                color: '#78350f',
                                padding: '1px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              ON LEAVE
                            </span>
                          </div>
                          {leave.reason && (
                            <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
                              {leave.reason}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteLeave(leave.id)}
                          disabled={isBusy}
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#b91c1c',
                            cursor: isBusy ? 'not-allowed' : 'pointer',
                            padding: '4px 8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Cancel leave and restore regular slots"
                        >
                          {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: 14-DAY ROLLING SLOT INVENTORY */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #d9ece7', padding: '24px', boxShadow: '0 4px 16px rgba(20, 60, 55, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} color="#0f766e" />
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0b3f3a', margin: 0 }}>
                  Forward 14-Day Slot Inventory & Availability
                </h2>
              </div>
              <p style={{ fontSize: '13px', color: '#52736d', margin: '4px 0 0 0' }}>
                Slots materialized from your weekly hours. Click any unbooked slot to toggle availability between <strong style={{ fontWeight: 700 }}>Open</strong> and <strong style={{ fontWeight: 700 }}>Unavailable</strong>.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setAdHocDate(new Date().toISOString().slice(0, 10));
                  setShowAdHocModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d9ece7',
                  borderRadius: '9px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#0f766e',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Add Ad-Hoc Slot
              </button>
            </div>
          </div>

          {/* 14-Day Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px' }}>
            {forward14Days.map((day) => {
              const isOnLeave = Boolean(day.leave);
              return (
                <div
                  key={day.dateISO}
                  style={{
                    backgroundColor: isOnLeave ? '#fffbeb' : day.isToday ? '#eaf6f2' : '#ffffff',
                    border: isOnLeave
                      ? '1px dashed #f59e0b'
                      : day.isToday
                      ? '1px solid #0f766e'
                      : '1px solid #d9ece7',
                    borderRadius: '14px',
                    padding: '14px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '220px',
                  }}
                >
                  {/* Day Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: day.isToday ? '#0f766e' : '#0b3f3a' }}>
                        {day.dayLabel}
                      </span>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{day.dateStr}</div>
                    </div>

                    {isOnLeave ? (
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          borderRadius: '4px',
                          padding: '2px 5px',
                          letterSpacing: '0.02em',
                        }}
                      >
                        ON LEAVE
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setLeaveStart(day.dateISO);
                          setLeaveEnd(day.dateISO);
                          window.scrollTo({ top: 380, behavior: 'smooth' });
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0f766e',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                        title="Mark this date as leave"
                      >
                        + Leave
                      </button>
                    )}
                  </div>

                  {isOnLeave && (
                    <div style={{ fontSize: '11px', color: '#92400e', backgroundColor: '#fef9c3', padding: '4px 6px', borderRadius: '6px', marginBottom: '10px' }}>
                      🌴 {day.leave?.reason || 'Leave active (slot creation suppressed)'}
                    </div>
                  )}

                  {/* Slots for this Day */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, marginTop: '4px' }}>
                    {day.slots.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', padding: '12px 0', textAlign: 'center' }}>
                        {isOnLeave ? 'Slots suppressed' : 'No slots scheduled'}
                      </div>
                    ) : (
                      day.slots.map((slot) => {
                        const isBusy = actionBusyId === slot.id;
                        const isSlotOpen = slot.available && !slot.booked;
                        const isSlotBooked = slot.booked;

                        return (
                          <button
                            key={slot.id}
                            type="button"
                            disabled={isSlotBooked || isBusy}
                            onClick={() => handleToggleSlotAvailability(slot)}
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '5px 7px',
                              borderRadius: '7px',
                              backgroundColor: isSlotBooked
                                ? '#eff6ff'
                                : isSlotOpen
                                ? '#ffffff'
                                : '#f3f4f6',
                              border: isSlotBooked
                                ? '1px solid #bfdbfe'
                                : isSlotOpen
                                ? '1px solid #d9ece7'
                                : '1px dashed #d1d5db',
                              color: isSlotBooked
                                ? '#1e40af'
                                : isSlotOpen
                                ? '#0b3f3a'
                                : '#9ca3af',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: isSlotBooked ? 'default' : 'pointer',
                              opacity: isSlotBooked ? 1 : isSlotOpen ? 1 : 0.7,
                              transition: 'all 0.15s ease',
                            }}
                            title={
                              isSlotBooked
                                ? `Booked by ${slot.patientName || 'Patient'}`
                                : `Click to mark ${isSlotOpen ? 'Unavailable' : 'Available'}`
                            }
                          >
                            <span style={{ textDecoration: !isSlotOpen && !isSlotBooked ? 'line-through' : 'none' }}>
                              {formatTime(slot.slotAt)}
                            </span>

                            {isBusy ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : isSlotBooked ? (
                              <span style={{ fontSize: '9px', fontWeight: 700, color: '#1d4ed8', backgroundColor: '#dbeafe', padding: '1px 4px', borderRadius: '4px' }}>
                                BOOKED
                              </span>
                            ) : isSlotOpen ? (
                              <span style={{ fontSize: '9px', fontWeight: 700, color: '#059669', backgroundColor: '#ecfdf5', padding: '1px 4px', borderRadius: '4px' }}>
                                OPEN
                              </span>
                            ) : (
                              <span style={{ fontSize: '9px', fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '1px 4px', borderRadius: '4px' }}>
                                CLOSED
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ad-Hoc Slot Modal */}
      {showAdHocModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '380px',
              width: '90%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0b3f3a' }}>Add Ad-Hoc Slot</div>
              <button
                type="button"
                onClick={() => setShowAdHocModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddAdHocSlot}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={adHocDate}
                  onChange={(e) => setAdHocDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                  Time *
                </label>
                <input
                  type="time"
                  required
                  value={adHocTime}
                  onChange={(e) => setAdHocTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAdHocModal(false)}
                  style={{
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#4b5563',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: '#0f766e',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  Add Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
