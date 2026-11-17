import React, { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  Phone,
  RotateCcw,
  Search,
  Shield,
  Star,
  UserCheck,
  X,
} from 'lucide-react';
import { PageTransition } from '../motion/PageTransition';
import { fadeInUp } from '../motion/presets';
import { adminDoctorsApi } from '../services/api';
import type { DoctorMe, DoctorStatus } from '../types';

export type DoctorFilterStatus = 'ALL' | DoctorStatus;

const STATUS_TABS: { value: DoctorFilterStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'ALL', label: 'All Practitioners', icon: <UserCheck size={14} /> },
  { value: 'APPROVED', label: 'Active Roster', icon: <Shield size={14} /> },
  { value: 'PENDING', label: 'Pending Review', icon: <Clock size={14} /> },
  { value: 'SUSPENDED', label: 'Suspended', icon: <Ban size={14} /> },
  { value: 'REJECTED', label: 'Rejected', icon: <AlertTriangle size={14} /> },
];

const DAYS_OF_WEEK = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface AdminDoctorsProps {
  embedded?: boolean;
  initialStatus?: DoctorFilterStatus;
}

export const AdminDoctors: React.FC<AdminDoctorsProps> = ({ embedded = false, initialStatus = 'ALL' }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<DoctorFilterStatus>(initialStatus);
  const [doctors, setDoctors] = useState<DoctorMe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & display
  const [searchQuery, setSearchQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Modal / Drawer state
  const [selected, setSelected] = useState<DoctorMe | null>(null);
  const [actionModal, setActionModal] = useState<{
    type: 'SUSPEND' | 'REJECT';
    doctor: DoctorMe;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [acting, setActing] = useState(false);

  // Fetch all doctors for client-side filtering and counters
  const fetchDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminDoctorsApi.list('ALL');
      setDoctors(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load practitioners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  // Compute status counts
  const counts = useMemo(() => {
    const res: Record<string, number> = { ALL: doctors.length, APPROVED: 0, PENDING: 0, SUSPENDED: 0, REJECTED: 0 };
    doctors.forEach((d) => {
      if (res[d.status] !== undefined) {
        res[d.status] = (res[d.status] || 0) + 1;
      }
    });
    return res;
  }, [doctors]);

  // Unique specialties
  const availableSpecialties = useMemo(() => {
    const set = new Set<string>();
    doctors.forEach((d) => {
      if (d.specialty) set.add(d.specialty.trim());
    });
    return Array.from(set).sort();
  }, [doctors]);

  // Filtered rows
  const filteredDoctors = useMemo(() => {
    return doctors.filter((d) => {
      // Tab filter
      if (tab !== 'ALL' && d.status !== tab) return false;

      // Specialty filter
      if (specialtyFilter !== 'ALL' && d.specialty !== specialtyFilter) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = d.fullName?.toLowerCase().includes(q);
        const matchesSpecialty = d.specialty?.toLowerCase().includes(q);
        const matchesHospital = d.hospital?.toLowerCase().includes(q);
        const matchesReg = d.registrationNumber?.toLowerCase().includes(q);
        const matchesEmail = d.email?.toLowerCase().includes(q);
        if (!matchesName && !matchesSpecialty && !matchesHospital && !matchesReg && !matchesEmail) {
          return false;
        }
      }

      return true;
    });
  }, [doctors, tab, specialtyFilter, searchQuery]);

  // Governance Actions
  const handleApprove = async (id: string) => {
    setActing(true);
    setError(null);
    try {
      const updated = await adminDoctorsApi.approve(id);
      setDoctors((prev) => prev.map((d) => (d.id === id ? { ...d, ...updated } : d)));
      if (selected && selected.id === id) {
        setSelected((prev) => (prev ? { ...prev, ...updated } : null));
      }
    } catch (e: any) {
      setError(e?.message || 'Could not approve doctor');
    } finally {
      setActing(false);
    }
  };

  const handleReinstate = async (id: string) => {
    setActing(true);
    setError(null);
    try {
      const updated = await adminDoctorsApi.reinstate(id);
      setDoctors((prev) => prev.map((d) => (d.id === id ? { ...d, ...updated } : d)));
      if (selected && selected.id === id) {
        setSelected((prev) => (prev ? { ...prev, ...updated } : null));
      }
    } catch (e: any) {
      setError(e?.message || 'Could not reinstate doctor');
    } finally {
      setActing(false);
    }
  };

  const handleConfirmActionModal = async () => {
    if (!actionModal || !actionReason.trim()) return;
    setActing(true);
    setError(null);
    try {
      const { type, doctor } = actionModal;
      let updated: DoctorMe;
      if (type === 'SUSPEND') {
        updated = await adminDoctorsApi.suspend(doctor.id, actionReason.trim());
      } else {
        updated = await adminDoctorsApi.reject(doctor.id, actionReason.trim());
      }
      setDoctors((prev) => prev.map((d) => (d.id === doctor.id ? { ...d, ...updated } : d)));
      if (selected && selected.id === doctor.id) {
        setSelected((prev) => (prev ? { ...prev, ...updated } : null));
      }
      setActionModal(null);
      setActionReason('');
    } catch (e: any) {
      setError(e?.message || `Could not ${actionModal.type.toLowerCase()} doctor`);
    } finally {
      setActing(false);
    }
  };

  const statusBadge = (status: DoctorStatus) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: '#059669',
              backgroundColor: '#ecfdf5',
              padding: '3px 9px',
              borderRadius: 9999,
              border: '1px solid #a7f3d0',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }} />
            Active
          </span>
        );
      case 'PENDING':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: '#d97706',
              backgroundColor: '#fffbeb',
              padding: '3px 9px',
              borderRadius: 9999,
              border: '1px solid #fde68a',
            }}
          >
            <Clock size={11} />
            Pending Review
          </span>
        );
      case 'SUSPENDED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: '#e11d48',
              backgroundColor: '#fff1f2',
              padding: '3px 9px',
              borderRadius: 9999,
              border: '1px solid #fecdd3',
            }}
          >
            <Ban size={11} />
            Suspended
          </span>
        );
      case 'REJECTED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: '#dc2626',
              backgroundColor: '#fef2f2',
              padding: '3px 9px',
              borderRadius: 9999,
              border: '1px solid #fecaca',
            }}
          >
            <X size={11} />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const content = (
    <div style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}>
      {!embedded && (
        <div style={{ marginBottom: 24 }}>
          <motion.h1
            {...fadeInUp}
            style={{ fontSize: '28px', fontWeight: 700, color: '#0b3f3a', margin: 0, letterSpacing: '-0.02em' }}
          >
            Practitioner Directory & Roster
          </motion.h1>
          <p style={{ color: '#5e7b76', margin: '6px 0 0 0', fontSize: '14px' }}>
            Comprehensive medical staff directory, clinical credential review, and practice governance.
          </p>
        </div>
      )}

      {/* Top Status Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 20,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_TABS.map((t) => {
            const count = counts[t.value] || 0;
            const isSelected = tab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className="hover-lift"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 9999,
                  border: isSelected ? '1px solid #0f766e' : '1px solid #d7e8e5',
                  background: isSelected ? '#0f766e' : '#fff',
                  color: isSelected ? '#fff' : '#5e7b76',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {t.icon}
                <span>{t.label}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 9999,
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#e6f3f0',
                    color: isSelected ? '#fff' : '#0f766e',
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View toggle (Grid / Table) */}
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: '#f1f7f5',
            borderRadius: 8,
            padding: 3,
            border: '1px solid #d7e8e5',
          }}
        >
          <button
            onClick={() => setViewMode('table')}
            title="Table View"
            style={{
              border: 'none',
              background: viewMode === 'table' ? '#ffffff' : 'transparent',
              color: viewMode === 'table' ? '#0f766e' : '#6b7280',
              boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              borderRadius: 6,
              padding: '5px 9px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <List size={15} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            title="Grid Cards View"
            style={{
              border: 'none',
              background: viewMode === 'grid' ? '#ffffff' : 'transparent',
              color: viewMode === 'grid' ? '#0f766e' : '#6b7280',
              boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              borderRadius: 6,
              padding: '5px 9px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {/* Search and Specialty Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
          alignItems: 'center',
          backgroundColor: '#fafdfc',
          border: '1px solid #e1efe9',
          padding: '12px 16px',
          borderRadius: 14,
        }}
      >
        <div style={{ flex: '1 1 260px', position: 'relative' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search doctor by name, email, specialty, hospital, or registration number…"
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 9999,
              border: '1px solid #d7e8e5',
              fontSize: 13,
              color: '#0b3f3a',
              backgroundColor: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} color="#5e7b76" />
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: 9999,
              border: '1px solid #d7e8e5',
              fontSize: 13,
              color: '#0b3f3a',
              backgroundColor: '#fff',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Specialties ({availableSpecialties.length})</option>
            {availableSpecialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {(searchQuery || specialtyFilter !== 'ALL') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSpecialtyFilter('ALL');
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#0f766e',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <RotateCcw size={12} /> Clear filters
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content: Loading, Empty, or List */}
      {loading ? (
        <div style={{ padding: '64px 24px', textAlign: 'center', color: '#6b7280' }}>
          <Loader2 size={24} className="animate-spin" style={{ display: 'inline', marginRight: 8, color: '#0f766e' }} />
          <div style={{ marginTop: 8, fontSize: 13 }}>Loading practitioner directory…</div>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div
          style={{
            padding: '56px 24px',
            textAlign: 'center',
            color: '#6b7280',
            border: '1px dashed #d7e8e5',
            borderRadius: 16,
            background: '#f8fcfa',
            fontSize: 14,
          }}
        >
          No doctors match the selected filters or query.
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div
          style={{
            overflowX: 'auto',
            border: '1px solid #e1efe9',
            borderRadius: 16,
            backgroundColor: '#ffffff',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#f5faf8', borderBottom: '1px solid #e1efe9', color: '#5e7b76' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Doctor</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Specialty & Hospital</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Credentials</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Rating & Consultations</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctors.map((d) => (
                <tr
                  key={d.id}
                  style={{
                    borderBottom: '1px solid #f0f7f5',
                    transition: 'background-color 0.12s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fbfdfd')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Doctor Info */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          backgroundColor: '#e6f3f0',
                          color: '#0f766e',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {d.avatarUrl ? (
                          <img src={d.avatarUrl} alt={d.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          d.fullName?.charAt(0) || 'D'
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0b3f3a' }}>{d.fullName}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {d.email || d.phone || 'No direct contact'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Specialty & Hospital */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#0f766e' }}>{d.specialty}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{d.hospital || '—'}</div>
                  </td>

                  {/* Credentials */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#334155' }}>
                      {d.registrationNumber || 'Pending reg'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {d.yearsExperience != null ? `${d.yearsExperience} yrs exp` : '—'} &middot;{' '}
                      {d.consultationFee != null ? `₹${d.consultationFee}` : '—'}
                    </div>
                  </td>

                  {/* Rating & Consultations */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, color: '#0b3f3a' }}>
                      <Star size={13} fill="#f59e0b" color="#f59e0b" />
                      <span>{d.rating != null ? Number(d.rating).toFixed(1) : '5.0'}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>({d.reviewCount || 0})</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {d.completedConsultations != null
                        ? `${d.completedConsultations} completed (${d.totalAppointments || 0} booked)`
                        : 'Active provider'}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td style={{ padding: '14px 16px' }}>{statusBadge(d.status)}</td>

                  {/* Actions */}
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => setSelected(d)}
                        className="hover-lift"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid #d7e8e5',
                          backgroundColor: '#ffffff',
                          color: '#0f766e',
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Inspect
                      </button>

                      {d.status === 'APPROVED' && (
                        <button
                          onClick={() => setActionModal({ type: 'SUSPEND', doctor: d })}
                          title="Suspend practitioner"
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #fecdd3',
                            backgroundColor: '#fff1f2',
                            color: '#e11d48',
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Ban size={12} /> Suspend
                        </button>
                      )}

                      {d.status === 'SUSPENDED' && (
                        <button
                          onClick={() => handleReinstate(d.id)}
                          disabled={acting}
                          title="Reinstate to active roster"
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #a7f3d0',
                            backgroundColor: '#ecfdf5',
                            color: '#059669',
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <CheckCircle2 size={12} /> Reinstate
                        </button>
                      )}

                      {d.status === 'PENDING' && (
                        <button
                          onClick={() => handleApprove(d.id)}
                          disabled={acting}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: 'none',
                            backgroundColor: '#0f766e',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <CheckCircle2 size={12} /> Approve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID CARDS VIEW */
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            width: '100%',
          }}
        >
          {filteredDoctors.map((d) => (
            <motion.div
              key={d.id}
              {...fadeInUp}
              className="hover-lift"
              style={{
                background: '#fff',
                border: '1px solid #d7e8e5',
                borderRadius: 16,
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
                boxShadow: '0 2px 6px rgba(15, 118, 110, 0.04)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        backgroundColor: '#e6f3f0',
                        color: '#0f766e',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        overflow: 'hidden',
                      }}
                    >
                      {d.avatarUrl ? (
                        <img src={d.avatarUrl} alt={d.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        d.fullName?.charAt(0) || 'D'
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0b3f3a' }}>{d.fullName}</div>
                      <div style={{ fontSize: 13, color: '#0f766e', fontWeight: 600 }}>{d.specialty}</div>
                    </div>
                  </div>
                  {statusBadge(d.status)}
                </div>

                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                  <div>{d.hospital || 'Private Clinical Practice'}</div>
                  {d.registrationNumber && (
                    <div style={{ fontFamily: 'ui-monospace, monospace', marginTop: 2 }}>
                      Reg: {d.registrationNumber}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 10,
                    backgroundColor: '#f8fcfa',
                    border: '1px solid #e6f3f0',
                    fontSize: 12,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <div style={{ color: '#88a39d' }}>Rating</div>
                    <div style={{ fontWeight: 600, color: '#0b3f3a', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Star size={11} fill="#f59e0b" color="#f59e0b" />
                      {d.rating != null ? Number(d.rating).toFixed(1) : '5.0'} ({d.reviewCount || 0})
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#88a39d' }}>Consultation Fee</div>
                    <div style={{ fontWeight: 600, color: '#0b3f3a' }}>
                      {d.consultationFee != null ? `₹${d.consultationFee}` : '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setSelected(d)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 8,
                    border: '1px solid #d7e8e5',
                    backgroundColor: '#ffffff',
                    color: '#0f766e',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Details
                </button>

                {d.status === 'APPROVED' && (
                  <button
                    onClick={() => setActionModal({ type: 'SUSPEND', doctor: d })}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #fecdd3',
                      backgroundColor: '#fff1f2',
                      color: '#e11d48',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Suspend
                  </button>
                )}

                {d.status === 'SUSPENDED' && (
                  <button
                    onClick={() => handleReinstate(d.id)}
                    disabled={acting}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #a7f3d0',
                      backgroundColor: '#ecfdf5',
                      color: '#059669',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Reinstate
                  </button>
                )}

                {d.status === 'PENDING' && (
                  <button
                    onClick={() => handleApprove(d.id)}
                    disabled={acting}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: '#0f766e',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Approve
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* DETAIL INSPECTION DRAWER */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11, 63, 58, 0.45)',
              zIndex: 1000,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <motion.aside
              initial={{ x: 500 }}
              animate={{ x: 0 }}
              exit={{ x: 500 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(520px, 100%)',
                background: '#fff',
                height: '100%',
                padding: '28px 30px',
                overflowY: 'auto',
                boxShadow: '-16px 0 40px rgba(11, 63, 58, 0.15)',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        backgroundColor: '#e6f3f0',
                        color: '#0f766e',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        overflow: 'hidden',
                      }}
                    >
                      {selected.avatarUrl ? (
                        <img src={selected.avatarUrl} alt={selected.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        selected.fullName?.charAt(0) || 'D'
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#0b3f3a' }}>{selected.fullName}</div>
                      <div style={{ fontSize: 13, color: '#0f766e', fontWeight: 600 }}>{selected.specialty}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    aria-label="Close"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div style={{ marginTop: 14, marginBottom: 20 }}>{statusBadge(selected.status)}</div>

                {/* Suspension / Rejection alert banner if active */}
                {selected.rejectionReason && (selected.status === 'REJECTED' || selected.status === 'SUSPENDED') && (
                  <div
                    style={{
                      backgroundColor: selected.status === 'SUSPENDED' ? '#fff1f2' : '#fef2f2',
                      border: `1px solid ${selected.status === 'SUSPENDED' ? '#fecdd3' : '#fecaca'}`,
                      borderRadius: 12,
                      padding: '12px 14px',
                      fontSize: 13,
                      color: selected.status === 'SUSPENDED' ? '#be123c' : '#b91c1c',
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} />
                      {selected.status === 'SUSPENDED' ? 'Suspension Reason & Notice' : 'Previous Rejection Reason'}
                    </div>
                    <div>{selected.rejectionReason}</div>
                  </div>
                )}

                {/* Key metadata grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <DetailRow
                    icon={<FileText size={14} />}
                    label="Medical Registration #"
                    value={selected.registrationNumber || 'Pending verification'}
                    mono
                  />
                  <DetailRow icon={<Mail size={14} />} label="Email Address" value={selected.email || '—'} />
                  <DetailRow icon={<Phone size={14} />} label="Phone Number" value={selected.phone || '—'} />
                  <DetailRow label="Affiliated Hospital" value={selected.hospital || '—'} />
                  <DetailRow
                    label="Consultation Fee"
                    value={selected.consultationFee != null ? `₹ ${selected.consultationFee}` : '—'}
                  />
                  <DetailRow
                    label="Experience & Languages"
                    value={`${selected.yearsExperience != null ? `${selected.yearsExperience} years` : '—'}${
                      selected.languages ? ` · ${selected.languages}` : ''
                    }`}
                  />
                  {selected.bio && <DetailRow label="Professional Biography" value={selected.bio} />}

                  {/* Clinical volume statistics */}
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: 12,
                      backgroundColor: '#f8fcfa',
                      border: '1px solid #e1efe9',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                      marginTop: 4,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        Patient Rating
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0b3f3a', marginTop: 2 }}>
                        ★ {selected.rating != null ? Number(selected.rating).toFixed(1) : '5.0'}
                        <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>
                          {' '}
                          ({selected.reviewCount || 0} reviews)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        Consultations Volume
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f766e', marginTop: 2 }}>
                        {selected.completedConsultations || 0}{' '}
                        <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>completed</span>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Templates Table */}
                  {selected.scheduleTemplate && selected.scheduleTemplate.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#5e7b76',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Calendar size={13} />
                        Weekly Availability Roster
                      </div>
                      <div
                        style={{
                          border: '1px solid #e1efe9',
                          borderRadius: 10,
                          overflow: 'hidden',
                          fontSize: 12,
                        }}
                      >
                        {selected.scheduleTemplate.map((tmpl, idx) => (
                          <div
                            key={tmpl.id || idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfefd',
                              borderBottom:
                                idx === (selected.scheduleTemplate?.length ?? 0) - 1 ? 'none' : '1px solid #f0f7f5',
                            }}
                          >
                            <span style={{ fontWeight: 600, color: '#0b3f3a' }}>
                              {DAYS_OF_WEEK[tmpl.dayOfWeek] || `Day ${tmpl.dayOfWeek}`}
                            </span>
                            <span style={{ color: '#0f766e', fontFamily: 'ui-monospace, monospace' }}>
                              {tmpl.startTime?.slice(0, 5)} - {tmpl.endTime?.slice(0, 5)} ({tmpl.slotDurationMinutes}m)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: '1px solid #e1efe9',
                  display: 'flex',
                  gap: 10,
                }}
              >
                {selected.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleApprove(selected.id)}
                      disabled={acting}
                      style={{
                        flex: 1,
                        background: '#0f766e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '11px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Approve Doctor
                    </button>
                    <button
                      onClick={() => setActionModal({ type: 'REJECT', doctor: selected })}
                      disabled={acting}
                      style={{
                        flex: 1,
                        background: '#fff',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                        borderRadius: 10,
                        padding: '11px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <X size={14} /> Reject
                    </button>
                  </>
                )}

                {selected.status === 'APPROVED' && (
                  <>
                    <button
                      onClick={() => {
                        setSelected(null);
                        navigate('/admin#consultations');
                      }}
                      style={{
                        flex: 1,
                        background: '#f0fdf9',
                        color: '#0f766e',
                        border: '1px solid #ccfbf1',
                        borderRadius: 10,
                        padding: '11px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      View Consultations
                    </button>
                    <button
                      onClick={() => setActionModal({ type: 'SUSPEND', doctor: selected })}
                      disabled={acting}
                      style={{
                        flex: 1,
                        background: '#fff',
                        color: '#e11d48',
                        border: '1px solid #fecdd3',
                        borderRadius: 10,
                        padding: '11px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Ban size={14} /> Suspend Doctor
                    </button>
                  </>
                )}

                {selected.status === 'SUSPENDED' && (
                  <button
                    onClick={() => handleReinstate(selected.id)}
                    disabled={acting}
                    style={{
                      width: '100%',
                      background: '#059669',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '12px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Reinstate to Active Practice
                  </button>
                )}

                {selected.status === 'REJECTED' && (
                  <button
                    onClick={() => handleApprove(selected.id)}
                    disabled={acting}
                    style={{
                      width: '100%',
                      background: '#0f766e',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '12px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {acting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    Re-evaluate & Approve
                  </button>
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUSPENSION / REJECTION REASON MODAL */}
      <AnimatePresence>
        {actionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.5)',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                width: 'min(480px, 100%)',
                backgroundColor: '#ffffff',
                borderRadius: 16,
                padding: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {actionModal.type === 'SUSPEND' ? (
                    <div
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        backgroundColor: '#fff1f2',
                        color: '#e11d48',
                        display: 'flex',
                      }}
                    >
                      <Ban size={18} />
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        backgroundColor: '#fef2f2',
                        color: '#b91c1c',
                        display: 'flex',
                      }}
                    >
                      <AlertTriangle size={18} />
                    </div>
                  )}
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                    {actionModal.type === 'SUSPEND' ? 'Suspend Doctor Account' : 'Reject Practitioner Submission'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setActionModal(null);
                    setActionReason('');
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                {actionModal.type === 'SUSPEND'
                  ? `Suspending Dr. ${actionModal.doctor.fullName} will immediately hide their profile and disable patient bookings across all specialties.`
                  : `Please specify the reason for rejecting Dr. ${actionModal.doctor.fullName}'s application. This feedback will be displayed to the doctor so they can rectify and resubmit.`}
              </p>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Reason / Clinical Audit Note
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                rows={3}
                placeholder={
                  actionModal.type === 'SUSPEND'
                    ? 'e.g. License verification audit in progress / temporary administrative leave…'
                    : 'e.g. Medical registration certificate is unreadable or has expired…'
                }
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => {
                    setActionModal(null);
                    setActionReason('');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#64748b',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmActionModal}
                  disabled={!actionReason.trim() || acting}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 10,
                    border: 'none',
                    background: actionModal.type === 'SUSPEND' ? '#e11d48' : '#b91c1c',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: !actionReason.trim() || acting ? 'not-allowed' : 'pointer',
                    opacity: !actionReason.trim() || acting ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {acting && <Loader2 size={13} className="animate-spin" />}
                  {actionModal.type === 'SUSPEND' ? 'Confirm Suspension' : 'Confirm Rejection'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <PageTransition
      style={{
        width: '100%',
        maxWidth: '1440px',
        margin: '48px auto',
        padding: '0 24px',
        boxSizing: 'border-box',
      }}
    >
      {content}
    </PageTransition>
  );
};

const DetailRow: React.FC<{ label: string; value: string; icon?: React.ReactNode; mono?: boolean }> = ({
  label,
  value,
  icon,
  mono,
}) => (
  <div style={{ borderBottom: '1px solid #ecf5f3', paddingBottom: 10 }}>
    <div
      style={{
        fontSize: 11,
        color: '#5e7b76',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {icon} {label}
    </div>
    <div
      style={{
        marginTop: 4,
        color: '#0b3f3a',
        fontSize: 14,
        lineHeight: 1.5,
        fontFamily: mono ? 'ui-monospace, SF Mono, monospace' : 'inherit',
        wordBreak: 'break-word',
      }}
    >
      {value}
    </div>
  </div>
);

export default AdminDoctors;
