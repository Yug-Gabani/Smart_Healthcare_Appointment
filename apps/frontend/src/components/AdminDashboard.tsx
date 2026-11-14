import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Shield,
  Video,
  X,
} from 'lucide-react';
import { PageTransition } from '../motion/PageTransition';
import { adminApi } from '../services/api';
import type {
  AdminOverviewData,
  AdminAppointmentItem,
  AdminPaymentItem,
  AppointmentStatus,
} from '../types';
import { AdminDoctors } from './AdminDoctors';

export type AdminTab = 'OVERVIEW' | 'DOCTORS' | 'APPOINTMENTS' | 'PAYMENTS';

interface AdminDashboardProps {
  defaultTab?: AdminTab;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ defaultTab = 'OVERVIEW' }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Active tab driven by URL hash or path so Header.tsx controls it natively
  const activeTab = useMemo<AdminTab>(() => {
    const hash = location.hash;
    if (location.pathname === '/admin/doctors' || hash === '#doctors') return 'DOCTORS';
    if (hash === '#consultations' || hash === '#appointments') return 'APPOINTMENTS';
    if (hash === '#payments') return 'PAYMENTS';
    return defaultTab || 'OVERVIEW';
  }, [location.pathname, location.hash, defaultTab]);

  // Overview state
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Appointments state
  const [appointments, setAppointments] = useState<AdminAppointmentItem[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [aptSearch, setAptSearch] = useState('');
  const [aptStatusFilter, setAptStatusFilter] = useState<'ALL' | string>('ALL');
  const [aptTypeFilter, setAptTypeFilter] = useState<'ALL' | string>('ALL');

  // Payments state
  const [payments, setPayments] = useState<AdminPaymentItem[]>([]);
  const [loadingPayments, setLoadingPayments] = useState<boolean>(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [paySearch, setPaySearch] = useState('');
  const [payStatusFilter, setPayStatusFilter] = useState<string>('ALL');

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, []);

  // Load Overview Data
  const fetchOverview = async () => {
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const data = await adminApi.getOverview();
      setOverview(data);
    } catch (err: any) {
      console.error('Failed to fetch admin overview:', err);
      setOverviewError(err?.message || 'Failed to fetch administration overview. Check connection to backend.');
    } finally {
      setLoadingOverview(false);
    }
  };

  // Load Appointments Data
  const fetchAppointments = async () => {
    setLoadingAppointments(true);
    setAppointmentsError(null);
    try {
      const data = await adminApi.getAppointments();
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch appointments:', err);
      setAppointmentsError(err?.message || 'Failed to fetch platform appointments');
    } finally {
      setLoadingAppointments(false);
    }
  };

  // Load Payments Data
  const fetchPayments = async () => {
    setLoadingPayments(true);
    setPaymentsError(null);
    try {
      const data = await adminApi.getPayments();
      setPayments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch payments:', err);
      setPaymentsError(err?.message || 'Failed to fetch financial transactions');
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (activeTab === 'APPOINTMENTS' && appointments.length === 0) {
      fetchAppointments();
    } else if (activeTab === 'PAYMENTS' && payments.length === 0) {
      fetchPayments();
    }
  }, [activeTab]);

  const handleRefresh = () => {
    if (activeTab === 'OVERVIEW') fetchOverview();
    else if (activeTab === 'APPOINTMENTS') fetchAppointments();
    else if (activeTab === 'PAYMENTS') fetchPayments();
  };

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    if (!Array.isArray(appointments)) return [];
    return appointments.filter((apt) => {
      const q = aptSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        apt.patientName?.toLowerCase().includes(q) ||
        apt.patientEmail?.toLowerCase().includes(q) ||
        apt.doctorName?.toLowerCase().includes(q) ||
        apt.doctorSpecialty?.toLowerCase().includes(q);

      const matchesStatus =
        aptStatusFilter === 'ALL' ||
        apt.status?.toUpperCase() === aptStatusFilter.toUpperCase();

      const matchesType =
        aptTypeFilter === 'ALL' ||
        apt.consultationType?.toUpperCase() === aptTypeFilter.toUpperCase();

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [appointments, aptSearch, aptStatusFilter, aptTypeFilter]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    if (!Array.isArray(payments)) return [];
    return payments.filter((pay) => {
      const q = paySearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        pay.razorpayOrderId?.toLowerCase().includes(q) ||
        pay.razorpayPaymentId?.toLowerCase().includes(q) ||
        pay.patientName?.toLowerCase().includes(q) ||
        pay.patientEmail?.toLowerCase().includes(q) ||
        pay.id?.toLowerCase().includes(q);

      const matchesStatus =
        payStatusFilter === 'ALL' ||
        pay.status?.toUpperCase() === payStatusFilter.toUpperCase();

      return matchesSearch && matchesStatus;
    });
  }, [payments, paySearch, payStatusFilter]);

  // Safe Stats Extraction
  const stats = overview?.stats;
  const approvedDoctors = stats?.approvedDoctors ?? stats?.totalDoctorsVerified ?? 0;
  const pendingDoctors = stats?.pendingDoctors ?? stats?.totalDoctorsPending ?? 0;
  const totalPatients = stats?.totalPatients ?? 0;
  const totalAppointments = stats?.totalAppointments ?? 0;
  const completedAppointments = stats?.completedAppointments ?? 0;
  const totalRevenuePaise = stats?.totalRevenuePaise ?? stats?.grossRevenuePaise ?? 0;
  const totalRefundPaise = stats?.totalRefundPaise ?? stats?.grossRefundsPaise ?? 0;

  const pendingList = Array.isArray(overview?.pendingDoctors) ? overview!.pendingDoctors : [];
  const recentList = Array.isArray(overview?.recentConsultations) ? overview!.recentConsultations : [];
  const health = overview?.systemHealth;

  const hospitalsCount = health?.totalHospitalsLoaded ?? health?.hospitalsCount ?? stats?.totalHospitals ?? 0;
  const outboxPending = health?.outboxPendingCount ?? health?.pendingOutboxEvents ?? 0;
  const dbStatus = health?.databaseStatus || 'UP';

  return (
    <PageTransition
      style={{
        width: '100%',
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '36px 20px 64px 20px',
        boxSizing: 'border-box',
        fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
        color: '#0b3f3a',
      }}
    >
      {/* PAGE HEADER: Matched with Doctor & Patient Dashboard style */}
      <section
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: '#0b3f3a',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {activeTab === 'OVERVIEW' && 'Operations & overview'}
            {activeTab === 'DOCTORS' && 'Practitioner verification'}
            {activeTab === 'APPOINTMENTS' && 'Master consultations ledger'}
            {activeTab === 'PAYMENTS' && 'Financial transactions & settlements'}
          </h1>
          <div style={{ fontSize: '14px', color: '#52736d', marginTop: '4px' }}>
            Real-time platform operations &middot; Provider credentialing &middot; Razorpay settlements
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: overviewError ? '#dc2626' : loadingOverview ? '#0f766e' : '#059669',
              marginTop: '6px',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: overviewError ? '#dc2626' : loadingOverview ? '#d97706' : '#10b981',
                display: 'inline-block',
              }}
            />
            <span>
              {overviewError
                ? `Error: ${overviewError}`
                : loadingOverview
                ? 'Syncing platform data…'
                : 'Live · System healthy'}
            </span>
            <button
              onClick={handleRefresh}
              title="Refresh"
              className="icon-pop"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#0f766e',
                padding: '0 4px',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <RefreshCw size={13} className={loadingOverview || loadingAppointments || loadingPayments ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div style={{ fontSize: '13px', color: '#52736d', fontWeight: 500 }}>
          {todayLabel}
        </div>
      </section>

      {/* Main Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'OVERVIEW' && (
          <motion.div
            key="tab-overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {overviewError && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} />
                  <span>{overviewError}</span>
                </div>
                <button
                  onClick={fetchOverview}
                  style={{
                    backgroundColor: '#b91c1c',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* 4 KPI TILES: Matched with Doctor & Patient Dashboard style */}
            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px',
                marginBottom: '28px',
              }}
            >
              {[
                {
                  label: 'Verified doctors',
                  value: approvedDoctors,
                  sub: pendingDoctors > 0 ? `${pendingDoctors} pending verification` : 'All applications reviewed',
                  dot: pendingDoctors > 0,
                  dotColor: '#dc2626',
                  onClick: () => navigate('/admin#doctors'),
                },
                {
                  label: 'Registered patients',
                  value: totalPatients,
                  sub: 'Active platform accounts',
                  dot: false,
                  dotColor: '#0f766e',
                },
                {
                  label: 'Total consultations',
                  value: totalAppointments,
                  sub: `${completedAppointments} completed (${totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0}% completion)`,
                  dot: false,
                  dotColor: '#0f766e',
                  onClick: () => navigate('/admin#consultations'),
                },
                {
                  label: 'Gross volume (Razorpay)',
                  value: `₹ ${(totalRevenuePaise / 100).toLocaleString('en-IN')}`,
                  sub: totalRefundPaise > 0 ? `₹ ${(totalRefundPaise / 100).toLocaleString('en-IN')} refunded` : 'Settlements active',
                  dot: false,
                  dotColor: '#0f766e',
                  onClick: () => navigate('/admin#payments'),
                },
              ].map((k) => (
                <div
                  key={k.label}
                  onClick={k.onClick}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #d9ece7',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    cursor: k.onClick ? 'pointer' : 'default',
                    transition: 'border-color 160ms ease, box-shadow 160ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (k.onClick) {
                      e.currentTarget.style.borderColor = '#0f766e';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 118, 110, 0.08)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (k.onClick) {
                      e.currentTarget.style.borderColor = '#d9ece7';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#8aa39d', fontWeight: 500 }}>
                    {k.label}
                  </div>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: 600,
                      color: '#0b3f3a',
                      margin: '4px 0',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {k.value}
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#52736d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {k.dot && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: k.dotColor,
                        }}
                      />
                    )}
                    <span>{k.sub}</span>
                  </div>
                </div>
              ))}
            </section>

            {/* Split Grid: Doctor Approvals Queue + System Health */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '20px',
                marginBottom: '28px',
              }}
            >
              {/* Doctor Approvals Quick-Queue */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #d9ece7',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Shield size={17} color="#0f766e" />
                      <h2
                        style={{
                          fontSize: '16px',
                          fontWeight: 600,
                          color: '#0b3f3a',
                          margin: 0,
                        }}
                      >
                        Doctor verification queue
                      </h2>
                    </div>
                    {pendingList.length > 0 && (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#b45309',
                          backgroundColor: '#fef3c7',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                        }}
                      >
                        {pendingList.length} pending
                      </span>
                    )}
                  </div>

                  {pendingList.length === 0 ? (
                    <div
                      style={{
                        padding: '36px 16px',
                        textAlign: 'center',
                        backgroundColor: '#f8faf9',
                        borderRadius: '12px',
                        border: '1px dashed #d7e8e5',
                        color: '#5e7b76',
                        fontSize: '13px',
                      }}
                    >
                      <CheckCircle2
                        size={24}
                        color="#0f766e"
                        style={{ margin: '0 auto 8px auto', display: 'block' }}
                      />
                      <div>All practitioner credential applications are verified.</div>
                      <div style={{ fontSize: '12px', color: '#8aa39d', marginTop: '2px' }}>
                        New submissions will appear here automatically.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {pendingList.slice(0, 4).map((doc) => {
                        const docId = doc.id || doc.doctorId || '';
                        return (
                          <div
                            key={docId}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              backgroundColor: '#fbfdfd',
                              border: '1px solid #eef5f3',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0b3f3a' }}>
                                {doc.fullName || 'Doctor Application'}
                              </div>
                              <div style={{ fontSize: '12px', color: '#0f766e', marginTop: '1px' }}>
                                {doc.specialty || 'General Practitioner'} &middot; {doc.hospital || doc.hospitalName || 'Independent'}
                              </div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: '#8aa39d',
                                  fontFamily: 'ui-monospace, SF Mono, monospace',
                                  marginTop: '2px',
                                }}
                              >
                                Reg #{doc.registrationNumber || 'N/A'}
                              </div>
                            </div>
                            <button
                              onClick={() => navigate('/admin#doctors')}
                              style={{
                                backgroundColor: '#0f766e',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'background-color 160ms ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0d655e')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0f766e')}
                            >
                              Review
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f0f7f5' }}>
                  <button
                    onClick={() => navigate('/admin#doctors')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#0f766e',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0,
                    }}
                  >
                    Open full verification directory ({approvedDoctors} approved) &rarr;
                  </button>
                </div>
              </div>

              {/* Infrastructure & Health */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #d9ece7',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Server size={17} color="#0f766e" />
                      <h2
                        style={{
                          fontSize: '16px',
                          fontWeight: 600,
                          color: '#0b3f3a',
                          margin: 0,
                        }}
                      >
                        Platform infrastructure
                      </h2>
                    </div>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#15803d',
                        backgroundColor: '#dcfce7',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: '#15803d',
                        }}
                      />
                      Healthy
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <HealthRow
                      icon={<Database size={15} color="#0f766e" />}
                      title="PostgreSQL Database"
                      detail="Active connection pool"
                      status={dbStatus}
                      isGood={String(dbStatus).toLowerCase().includes('up') || String(dbStatus).toLowerCase().includes('connect')}
                    />
                    <HealthRow
                      icon={<Activity size={15} color="#0f766e" />}
                      title="PMJAY Hospital Registry"
                      detail="National empanelled hospitals indexed"
                      status={`${Number(hospitalsCount || 0).toLocaleString()} Hospitals`}
                      isGood={Number(hospitalsCount) > 0}
                    />
                    <HealthRow
                      icon={<Server size={15} color="#0f766e" />}
                      title="Outbox Event Relay"
                      detail="Kafka & notification event queue"
                      status={
                        Number(outboxPending) === 0
                          ? '0 pending'
                          : `${outboxPending} pending`
                      }
                      isGood={Number(outboxPending) === 0}
                    />
                    <HealthRow
                      icon={<Clock size={15} color="#0f766e" />}
                      title="Server Synchronized Clock"
                      detail="NTP synchronized"
                      status={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      isGood={true}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f0f7f5' }}>
                  <span style={{ fontSize: '12px', color: '#8aa39d' }}>
                    Payment gateway webhook signature verified with Razorpay.
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Consultations Stream */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #d9ece7',
                borderRadius: '16px',
                padding: '20px 24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#0b3f3a',
                      margin: '0 0 2px 0',
                    }}
                  >
                    Recent clinical consultations
                  </h2>
                  <div style={{ fontSize: '13px', color: '#52736d' }}>
                    Live platform consultations feed across video and in-person visits
                  </div>
                </div>

                <button
                  onClick={() => navigate('/admin#consultations')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#0f766e',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  View all ({totalAppointments}) &rarr;
                </button>
              </div>

              {recentList.length === 0 ? (
                <div
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: '#8aa39d',
                    fontSize: '13px',
                  }}
                >
                  No platform consultations recorded yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: '1px solid #d9ece7', color: '#8aa39d' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 500 }}>Patient</th>
                        <th style={{ padding: '8px 12px', fontWeight: 500 }}>Doctor</th>
                        <th style={{ padding: '8px 12px', fontWeight: 500 }}>Mode</th>
                        <th style={{ padding: '8px 12px', fontWeight: 500 }}>Time</th>
                        <th style={{ padding: '8px 12px', fontWeight: 500 }}>Fee</th>
                        <th style={{ padding: '8px 12px', fontWeight: 500 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentList.map((item) => {
                        const aptId = item.id || item.appointmentId || '';
                        const fee = item.feeRupees ?? (item.amountPaise ? item.amountPaise / 100 : 500);
                        const isVideo = String(item.consultationType).toUpperCase() === 'VIDEO';

                        return (
                          <tr
                            key={aptId}
                            style={{
                              borderBottom: '1px solid #f6faf9',
                              transition: 'background-color 120ms ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fbfdfd')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <td style={{ padding: '10px 12px', color: '#0b3f3a', fontWeight: 500 }}>
                              <div>{item.patientName || 'Anonymous Patient'}</div>
                              <div style={{ fontSize: '11px', color: '#8aa39d' }}>{item.patientEmail || ''}</div>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#0b3f3a' }}>
                              <div>{item.doctorName || 'Doctor'}</div>
                              <div style={{ fontSize: '11px', color: '#0f766e' }}>{item.doctorSpecialty || item.specialty || 'General Practitioner'}</div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '12px',
                                  color: isVideo ? '#0f766e' : '#0b3f3a',
                                }}
                              >
                                {isVideo ? <Video size={13} color="#0f766e" /> : <Calendar size={13} color="#52736d" />}
                                {isVideo ? 'Video' : 'In-Person'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#52736d', fontSize: '12px' }}>
                              {item.slotAt ? new Date(item.slotAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                            </td>
                            <td
                              style={{
                                padding: '10px 12px',
                                color: '#0b3f3a',
                                fontWeight: 500,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              ₹ {Number(fee || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <StatusPill status={item.status || 'BOOKED'} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Doctor Verification Tab */}
        {activeTab === 'DOCTORS' && (
          <motion.div
            key="tab-doctors"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #d9ece7',
                borderRadius: '16px',
                padding: '24px',
              }}
            >
              <AdminDoctors embedded={true} initialStatus="PENDING" />
            </div>
          </motion.div>
        )}

        {/* Consultations Directory Tab */}
        {activeTab === 'APPOINTMENTS' && (
          <motion.div
            key="tab-appointments"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #d9ece7',
                borderRadius: '16px',
                padding: '24px',
              }}
            >
              {/* Filter Strip */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: '#f8faf9',
                      border: '1px solid #d9ece7',
                      borderRadius: '8px',
                    }}
                  >
                    <Search size={14} color="#8aa39d" />
                    <input
                      type="text"
                      placeholder="Search patient or doctor…"
                      value={aptSearch}
                      onChange={(e) => setAptSearch(e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: '13px',
                        outline: 'none',
                        color: '#0b3f3a',
                        width: '180px',
                      }}
                    />
                    {aptSearch && (
                      <button
                        onClick={() => setAptSearch('')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={12} color="#8aa39d" />
                      </button>
                    )}
                  </div>

                  <select
                    value={aptStatusFilter}
                    onChange={(e) => setAptStatusFilter(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d9ece7',
                      backgroundColor: '#ffffff',
                      color: '#0b3f3a',
                      fontSize: '13px',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="BOOKED">Booked</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="NO_SHOW">No Show</option>
                  </select>

                  <select
                    value={aptTypeFilter}
                    onChange={(e) => setAptTypeFilter(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d9ece7',
                      backgroundColor: '#ffffff',
                      color: '#0b3f3a',
                      fontSize: '13px',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="ALL">All Modalities</option>
                    <option value="VIDEO">Video Consultations</option>
                    <option value="IN_PERSON">In-Person Visits</option>
                  </select>
                </div>

                <div style={{ fontSize: '13px', color: '#52736d' }}>
                  {filteredAppointments.length} record{filteredAppointments.length === 1 ? '' : 's'}
                </div>
              </div>

              {appointmentsError && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  {appointmentsError}
                </div>
              )}

              {loadingAppointments ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52736d' }}>
                  <Loader2 size={24} className="animate-spin" color="#0f766e" style={{ display: 'inline', marginRight: '8px' }} />
                  Loading consultations ledger…
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div
                  style={{
                    padding: '48px 16px',
                    textAlign: 'center',
                    backgroundColor: '#f8faf9',
                    borderRadius: '12px',
                    border: '1px dashed #d9ece7',
                    color: '#8aa39d',
                    fontSize: '13.5px',
                  }}
                >
                  No consultations match the filter criteria.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: '1px solid #d9ece7', color: '#8aa39d' }}>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Patient</th>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Doctor</th>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Mode</th>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Urgency</th>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Slot time</th>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Fee</th>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppointments.map((apt) => {
                        const fee = apt.feeRupees ?? (apt.amountPaise ? apt.amountPaise / 100 : 0);
                        const isVideo = String(apt.consultationType).toUpperCase() === 'VIDEO';

                        return (
                          <tr
                            key={apt.id}
                            style={{
                              borderBottom: '1px solid #f6faf9',
                              transition: 'background-color 120ms ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fbfdfd')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <td style={{ padding: '12px', color: '#0b3f3a', fontWeight: 500 }}>
                              <div>{apt.patientName || 'Patient'}</div>
                              <div style={{ fontSize: '11px', color: '#8aa39d' }}>{apt.patientEmail || ''}</div>
                            </td>
                            <td style={{ padding: '12px', color: '#0b3f3a' }}>
                              <div>{apt.doctorName || 'Doctor'}</div>
                              <div style={{ fontSize: '11px', color: '#0f766e' }}>
                                {apt.doctorSpecialty || ''} {apt.hospitalName ? `• ${apt.hospitalName}` : ''}
                              </div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '12px',
                                  color: isVideo ? '#0f766e' : '#0b3f3a',
                                }}
                              >
                                {isVideo ? <Video size={13} color="#0f766e" /> : <Calendar size={13} color="#52736d" />}
                                {isVideo ? 'Video' : 'In-Person'}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <UrgencyTag urgency={apt.urgency as string} />
                            </td>
                            <td style={{ padding: '12px', color: '#52736d', fontSize: '12px' }}>
                              {apt.slotAt ? new Date(apt.slotAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                            </td>
                            <td
                              style={{
                                padding: '12px',
                                color: '#0b3f3a',
                                fontWeight: 500,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              ₹ {Number(fee || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <StatusPill status={apt.status || 'BOOKED'} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Financial Transactions Tab */}
        {activeTab === 'PAYMENTS' && (
          <motion.div
            key="tab-payments"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #d9ece7',
                borderRadius: '16px',
                padding: '24px',
              }}
            >
              {/* Filter Strip */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: '#f8faf9',
                      border: '1px solid #d9ece7',
                      borderRadius: '8px',
                    }}
                  >
                    <Search size={14} color="#8aa39d" />
                    <input
                      type="text"
                      placeholder="Search order or patient…"
                      value={paySearch}
                      onChange={(e) => setPaySearch(e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: '13px',
                        outline: 'none',
                        color: '#0b3f3a',
                        width: '200px',
                      }}
                    />
                    {paySearch && (
                      <button
                        onClick={() => setPaySearch('')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={12} color="#8aa39d" />
                      </button>
                    )}
                  </div>

                  <select
                    value={payStatusFilter}
                    onChange={(e) => setPayStatusFilter(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d9ece7',
                      backgroundColor: '#ffffff',
                      color: '#0b3f3a',
                      fontSize: '13px',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="ALL">All States</option>
                    <option value="PAID">Paid</option>
                    <option value="CREATED">Created</option>
                    <option value="FAILED">Failed</option>
                    <option value="REFUNDED">Refunded</option>
                  </select>
                </div>

                <div style={{ fontSize: '13px', color: '#52736d' }}>
                  {filteredPayments.length} transaction{filteredPayments.length === 1 ? '' : 's'}
                </div>
              </div>

              {paymentsError && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  {paymentsError}
                </div>
              )}

              {loadingPayments ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52736d' }}>
                  <Loader2 size={24} className="animate-spin" color="#0f766e" style={{ display: 'inline', marginRight: '8px' }} />
                  Loading payment audit logs…
                </div>
              ) : filteredPayments.length === 0 ? (
                <div
                  style={{
                    padding: '48px 16px',
                    textAlign: 'center',
                    backgroundColor: '#f8faf9',
                    borderRadius: '12px',
                    border: '1px dashed #d9ece7',
                    color: '#8aa39d',
                    fontSize: '13.5px',
                  }}
                >
                  No transactions match the selected filters.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: '1px solid #d9ece7', color: '#8aa39d' }}>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Razorpay Order</th>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Payment ID</th>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Patient</th>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Amount</th>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Status</th>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Date</th>
                        <th style={{ padding: '10px 12px', fontWeight: 500 }}>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((pay) => {
                        const orderId = pay.orderId || pay.id;
                        const amt = pay.amountPaise ? pay.amountPaise / 100 : 0;

                        return (
                          <tr
                            key={pay.id}
                            style={{
                              borderBottom: '1px solid #f6faf9',
                              transition: 'background-color 120ms ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fbfdfd')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <td
                              style={{
                                padding: '12px',
                                fontFamily: 'ui-monospace, SF Mono, monospace',
                                fontSize: '12px',
                                color: '#0b3f3a',
                              }}
                            >
                              {pay.razorpayOrderId || '—'}
                            </td>
                            <td
                              style={{
                                padding: '12px',
                                fontFamily: 'ui-monospace, SF Mono, monospace',
                                fontSize: '12px',
                                color: pay.razorpayPaymentId ? '#0f766e' : '#8aa39d',
                              }}
                            >
                              {pay.razorpayPaymentId || 'Pending'}
                            </td>
                            <td style={{ padding: '12px', color: '#0b3f3a' }}>
                              <div style={{ fontWeight: 500 }}>{pay.patientName || 'Patient'}</div>
                              <div style={{ fontSize: '11px', color: '#8aa39d' }}>{pay.patientEmail || ''}</div>
                            </td>
                            <td
                              style={{
                                padding: '12px',
                                fontWeight: 500,
                                color: '#0b3f3a',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              ₹ {Number(amt || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <StatusPill status={pay.status || 'CREATED'} />
                            </td>
                            <td style={{ padding: '12px', color: '#52736d', fontSize: '12px' }}>
                              {pay.createdAt ? new Date(pay.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </td>
                            <td style={{ padding: '12px' }}>
                              {pay.status?.toUpperCase() === 'PAID' ? (
                                <a
                                  href={`/api/v1/payments/receipt/${orderId}/pdf`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    backgroundColor: '#eaf6f2',
                                    color: '#0f766e',
                                    borderRadius: '6px',
                                    textDecoration: 'none',
                                    fontSize: '11.5px',
                                    fontWeight: 500,
                                  }}
                                >
                                  <Download size={11} />
                                  <span>PDF</span>
                                </a>
                              ) : (
                                <span style={{ fontSize: '11px', color: '#8aa39d' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};

// ----------------- SUB-COMPONENTS -----------------

const HealthRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  detail: string;
  status: string;
  isGood: boolean;
}> = ({ icon, title, detail, status, isGood }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 10px',
      borderRadius: '8px',
      backgroundColor: '#fbfdfd',
      border: '1px solid #eef5f3',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '6px',
          backgroundColor: '#eaf6f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#0b3f3a' }}>{title}</div>
        <div style={{ fontSize: '11px', color: '#8aa39d' }}>{detail}</div>
      </div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: isGood ? '#059669' : '#b45309',
        }}
      >
        {status}
      </span>
    </div>
  </div>
);

const StatusPill: React.FC<{ status: AppointmentStatus | string }> = ({ status }) => {
  const s = status?.toUpperCase();
  let bg = '#eaf6f2';
  let color = '#0f766e';

  if (s === 'COMPLETED' || s === 'PAID' || s === 'APPROVED') {
    bg = '#ecfdf5';
    color = '#065f46';
  } else if (s === 'CANCELLED' || s === 'FAILED' || s === 'REJECTED') {
    bg = '#fef2f2';
    color = '#b91c1c';
  } else if (s === 'EXPIRED') {
    bg = '#fee2e2';
    color = '#991b1b';
  } else if (s === 'NO_SHOW' || s === 'PENDING' || s === 'CREATED') {
    bg = '#fef3c7';
    color = '#92400e';
  } else if (s === 'REFUNDED') {
    bg = '#e0e7ff';
    color = '#3730a3';
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: bg,
        color: color,
      }}
    >
      {status}
    </span>
  );
};

const UrgencyTag: React.FC<{ urgency?: string }> = ({ urgency }) => {
  const u = urgency?.toUpperCase() || 'ROUTINE';
  let color = '#52736d';

  if (u === 'EMERGENCY') color = '#dc2626';
  else if (u === 'URGENT') color = '#b45309';

  return (
    <span
      style={{
        fontSize: '12px',
        fontWeight: 500,
        color: color,
      }}
    >
      {u}
    </span>
  );
};

export default AdminDashboard;
