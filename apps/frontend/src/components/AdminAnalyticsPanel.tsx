import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Loader2,
  PieChart,
  TrendingUp,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { adminApi } from '../services/api';
import type { AdminAnalyticsData } from '../types';

export const AdminAnalyticsPanel: React.FC = () => {
  const [months, setMonths] = useState<number>(6);
  const [analytics, setAnalytics] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  // Audit Export filter state
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [exportStatus, setExportStatus] = useState<string>('ALL');
  const [exportingType, setExportingType] = useState<'appointments' | 'transactions' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadAnalytics = async (windowMonths: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getAnalytics(windowMonths);
      setAnalytics(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load platform analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics(months);
  }, [months]);

  const handleExport = async (type: 'appointments' | 'transactions') => {
    setExportError(null);
    if (fromDate && toDate && fromDate > toDate) {
      setExportError('Start date cannot be after end date.');
      return;
    }
    setExportingType(type);
    try {
      if (type === 'appointments') {
        await adminApi.exportAppointmentsCsv({
          from: fromDate || undefined,
          to: toDate || undefined,
          status: exportStatus,
        });
      } else {
        await adminApi.exportTransactionsCsv({
          from: fromDate || undefined,
          to: toDate || undefined,
        });
      }
    } catch (err: any) {
      setExportError(err?.message || 'Could not download CSV report');
    } finally {
      setExportingType(null);
    }
  };

  const monthly = analytics?.monthlyRevenue ?? [];
  const specialties = analytics?.topSpecialties ?? [];
  const cancelMetrics = analytics?.cancellationMetrics;

  const maxMonthlyVal = Math.max(
    10000,
    ...monthly.map((m) => Math.max(m.revenuePaise, m.refundPaise))
  );
  const maxSpecCount = Math.max(1, ...specialties.map((s) => s.appointmentCount));

  const totalRevInWindow = monthly.reduce((acc, m) => acc + m.revenuePaise, 0);
  const totalRefInWindow = monthly.reduce((acc, m) => acc + m.refundPaise, 0);

  // Donut chart segments for Cancellation & Outcome Breakdown
  const totalAppts = cancelMetrics?.totalAppointments ?? 0;
  const completedCnt = cancelMetrics?.completedCount ?? 0;
  const cancelledCnt = cancelMetrics?.cancelledCount ?? 0;
  const noShowCnt = cancelMetrics?.noShowCount ?? 0;
  const activeCnt = Math.max(0, totalAppts - completedCnt - cancelledCnt - noShowCnt);

  const donutCircumference = 2 * Math.PI * 46;
  const segments = [
    { label: 'Completed', count: completedCnt, color: '#0f766e' },
    { label: 'Active / Booked', count: activeCnt, color: '#3b82f6' },
    { label: 'Cancelled', count: cancelledCnt, color: '#ef4444' },
    { label: 'No-Show', count: noShowCnt, color: '#f59e0b' },
  ];

  let cumulativeOffset = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Date-Filtered Streaming Audit Export Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #d9ece7',
          borderRadius: '16px',
          padding: '22px 24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={18} color="#0f766e" />
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0b3f3a', margin: 0 }}>
                Hospital Performance &amp; Audit Report Exports (CSV / Excel)
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: '#52736d', margin: '4px 0 0 0' }}>
              Stream date-filtered clinical appointment logs and Razorpay settlement ledgers directly to Excel-compatible CSV.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} color="#52736d" />
              <input
                type="date"
                aria-label="Export from date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #d9ece7',
                  fontSize: '12.5px',
                  color: '#0b3f3a',
                  backgroundColor: '#f8faf9',
                }}
              />
              <span style={{ fontSize: '12px', color: '#8aa39d' }}>to</span>
              <input
                type="date"
                aria-label="Export to date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #d9ece7',
                  fontSize: '12.5px',
                  color: '#0b3f3a',
                  backgroundColor: '#f8faf9',
                }}
              />
            </div>

            <select
              aria-label="Appointment export status"
              value={exportStatus}
              onChange={(e) => setExportStatus(e.target.value)}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid #d9ece7',
                fontSize: '12.5px',
                color: '#0b3f3a',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Appointment Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No Show</option>
              <option value="BOOKED">Booked</option>
            </select>

            <button
              onClick={() => handleExport('appointments')}
              disabled={exportingType !== null}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#0f766e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: exportingType ? 'not-allowed' : 'pointer',
                opacity: exportingType === 'transactions' ? 0.6 : 1,
              }}
            >
              {exportingType === 'appointments' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              <span>Export Appointments CSV</span>
            </button>

            <button
              onClick={() => handleExport('transactions')}
              disabled={exportingType !== null}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#eaf6f2',
                color: '#0f766e',
                border: '1px solid #bfe3da',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: exportingType ? 'not-allowed' : 'pointer',
                opacity: exportingType === 'appointments' ? 0.6 : 1,
              }}
            >
              {exportingType === 'transactions' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              <span>Export Transactions CSV</span>
            </button>
          </div>
        </div>

        {exportError && (
          <div
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertTriangle size={14} />
            <span>{exportError}</span>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '64px 20px', textAlign: 'center', color: '#52736d' }}>
          <Loader2 size={24} className="animate-spin" color="#0f766e" style={{ display: 'inline', marginRight: '8px' }} />
          Loading clinical &amp; revenue analytics…
        </div>
      ) : (
        <>
          {/* Monthly Revenue Bar Chart */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #d9ece7',
              borderRadius: '16px',
              padding: '22px 24px',
            }}
          >
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
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} color="#0f766e" />
                  <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0b3f3a', margin: 0 }}>
                    Monthly Revenue &amp; Refunds
                  </h2>
                </div>
                <div style={{ fontSize: '13px', color: '#52736d', marginTop: '3px' }}>
                  Gross: <strong>₹ {(totalRevInWindow / 100).toLocaleString('en-IN')}</strong> &middot; Refunds:{' '}
                  <strong style={{ color: '#b91c1c' }}>₹ {(totalRefInWindow / 100).toLocaleString('en-IN')}</strong> &middot; Net:{' '}
                  <strong style={{ color: '#0f766e' }}>
                    ₹ {(Math.max(0, totalRevInWindow - totalRefInWindow) / 100).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {[3, 6, 12].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMonths(m)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d9ece7',
                      backgroundColor: months === m ? '#0f766e' : '#ffffff',
                      color: months === m ? '#ffffff' : '#0b3f3a',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {m}M
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '210px', paddingTop: '20px' }}>
              {monthly.map((pt) => {
                const revHeightPct = Math.round((pt.revenuePaise / maxMonthlyVal) * 100);
                const refHeightPct = Math.round((pt.refundPaise / maxMonthlyVal) * 100);
                const isHovered = hoveredMonth === pt.monthKey;

                return (
                  <div
                    key={pt.monthKey}
                    onMouseEnter={() => setHoveredMonth(pt.monthKey)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end',
                      position: 'relative',
                    }}
                  >
                    {isHovered && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          backgroundColor: '#0b3f3a',
                          color: '#ffffff',
                          fontSize: '11px',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
                        }}
                      >
                        <div>Rev: ₹ {(pt.revenuePaise / 100).toLocaleString('en-IN')}</div>
                        <div>Ref: ₹ {(pt.refundPaise / 100).toLocaleString('en-IN')}</div>
                        <div>Txns: {pt.transactionCount}</div>
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '4px',
                        height: '155px',
                        width: '100%',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        title={`Revenue: ₹ ${(pt.revenuePaise / 100).toLocaleString('en-IN')}`}
                        style={{
                          width: '20px',
                          height: `${Math.max(pt.revenuePaise > 0 ? 6 : 2, revHeightPct)}%`,
                          backgroundColor: isHovered ? '#0d655e' : '#0f766e',
                          borderRadius: '6px 6px 2px 2px',
                          transition: 'height 0.3s ease',
                        }}
                      />
                      <div
                        title={`Refunds: ₹ ${(pt.refundPaise / 100).toLocaleString('en-IN')}`}
                        style={{
                          width: '14px',
                          height: `${Math.max(pt.refundPaise > 0 ? 6 : 2, refHeightPct)}%`,
                          backgroundColor: pt.refundPaise > 0 ? '#fca5a5' : '#eef5f3',
                          borderRadius: '6px 6px 2px 2px',
                          transition: 'height 0.3s ease',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#52736d', marginTop: '8px', fontWeight: 500 }}>
                      {pt.label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '14px', fontSize: '12px', color: '#52736d' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#0f766e' }} />
                Gross Revenue
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#fca5a5' }} />
                Refunds Issued
              </span>
            </div>
          </div>

          {/* Two-column row: Top Specialties + Cancellation & No-Show Donut */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '20px',
            }}
          >
            {/* Top Specialties */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #d9ece7',
                borderRadius: '16px',
                padding: '22px 24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <BarChart3 size={18} color="#0f766e" />
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0b3f3a', margin: 0 }}>
                  Top Specialties by Volume &amp; Revenue
                </h2>
              </div>

              {specialties.length === 0 ? (
                <div style={{ padding: '32px 12px', textAlign: 'center', color: '#8aa39d', fontSize: '13px' }}>
                  No appointment specialty data recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {specialties.map((spec) => {
                    const widthPct = Math.round((spec.appointmentCount / maxSpecCount) * 100);
                    return (
                      <div key={spec.specialty}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '13px',
                            marginBottom: '5px',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#0b3f3a' }}>{spec.specialty}</span>
                          <span style={{ color: '#52736d', fontVariantNumeric: 'tabular-nums' }}>
                            {spec.appointmentCount} visits &middot; ₹ {(spec.revenuePaise / 100).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: '8px',
                            backgroundColor: '#eef5f3',
                            borderRadius: '999px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(4, widthPct)}%`,
                              height: '100%',
                              backgroundColor: '#0f766e',
                              borderRadius: '999px',
                              transition: 'width 0.35s ease',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '11px', color: '#8aa39d', marginTop: '3px' }}>
                          {spec.completedCount} completed &middot; {spec.cancelledCount} cancelled &middot; {spec.noShowCount} no-show
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cancellation & No-Show Breakdown */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #d9ece7',
                borderRadius: '16px',
                padding: '22px 24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <PieChart size={18} color="#0f766e" />
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0b3f3a', margin: 0 }}>
                  Cancellation &amp; No-Show Audit Metrics
                </h2>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  flexWrap: 'wrap',
                  marginBottom: '20px',
                }}
              >
                <svg width="124" height="124" viewBox="0 0 124 124" aria-label="Appointment outcome donut chart">
                  <circle cx="62" cy="62" r="46" fill="none" stroke="#eef5f3" strokeWidth="14" />
                  {totalAppts > 0 &&
                    segments.map((seg) => {
                      if (seg.count <= 0) return null;
                      const dashLen = (seg.count / totalAppts) * donutCircumference;
                      const offset = -cumulativeOffset;
                      cumulativeOffset += dashLen;
                      return (
                        <circle
                          key={seg.label}
                          cx="62"
                          cy="62"
                          r="46"
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="14"
                          strokeDasharray={`${dashLen} ${donutCircumference}`}
                          strokeDashoffset={offset}
                          transform="rotate(-90 62 62)"
                        />
                      );
                    })}
                  <text
                    x="62"
                    y="59"
                    textAnchor="middle"
                    style={{ fontSize: '20px', fontWeight: 700, fill: '#0b3f3a' }}
                  >
                    {totalAppts}
                  </text>
                  <text
                    x="62"
                    y="75"
                    textAnchor="middle"
                    style={{ fontSize: '10px', fontWeight: 500, fill: '#52736d' }}
                  >
                    Total Visits
                  </text>
                </svg>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '180px' }}>
                  <MetricRateRow
                    label="Completion Rate"
                    rate={`${cancelMetrics?.completionRatePct ?? 0}%`}
                    count={completedCnt}
                    color="#0f766e"
                    bg="#eaf6f2"
                  />
                  <MetricRateRow
                    label="Cancellation Rate"
                    rate={`${cancelMetrics?.cancellationRatePct ?? 0}%`}
                    count={cancelledCnt}
                    color="#b91c1c"
                    bg="#fef2f2"
                  />
                  <MetricRateRow
                    label="No-Show Rate"
                    rate={`${cancelMetrics?.noShowRatePct ?? 0}%`}
                    count={noShowCnt}
                    color="#b45309"
                    bg="#fef3c7"
                  />
                  <MetricRateRow
                    label="Booked / Active"
                    rate={`${totalAppts > 0 ? Math.round((activeCnt / totalAppts) * 1000) / 10 : 0}%`}
                    count={activeCnt}
                    color="#1d4ed8"
                    bg="#eff6ff"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const MetricRateRow: React.FC<{
  label: string;
  rate: string;
  count: number;
  color: string;
  bg: string;
}> = ({ label, rate, count, color, bg }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 12px',
      borderRadius: '10px',
      backgroundColor: '#fbfdfd',
      border: '1px solid #eef5f3',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
      <span style={{ fontSize: '13px', fontWeight: 500, color: '#0b3f3a' }}>{label}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '12px', color: '#8aa39d' }}>({count})</span>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color,
          backgroundColor: bg,
          padding: '2px 8px',
          borderRadius: '999px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {rate}
      </span>
    </div>
  </div>
);

