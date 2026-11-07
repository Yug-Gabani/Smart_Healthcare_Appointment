import React from 'react';
import {
  X,
  RefreshCw,
  Zap,
  Mail,
  Phone,
  AlertTriangle,
  ShieldCheck,
  Database,
  Layers,
  Clock,
} from 'lucide-react';
import type { NotificationAuditLog } from '../services/api';

interface PipelineAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  auditLogs: NotificationAuditLog[];
  loading: boolean;
  onRefresh: () => void;
}

export const PipelineAuditModal: React.FC<PipelineAuditModalProps> = ({
  isOpen,
  onClose,
  orderId,
  auditLogs,
  loading,
  onRefresh,
}) => {
  if (!isOpen) return null;

  const channelIcon = (channel: string) => {
    switch (channel) {
      case 'KAFKA':
        return <Zap size={15} color="#2563eb" />;
      case 'EMAIL':
        return <Mail size={15} color="#16a34a" />;
      case 'WHATSAPP':
        return <Phone size={15} color="#059669" />;
      case 'DLQ':
        return <AlertTriangle size={15} color="#dc2626" />;
      default:
        return <Layers size={15} color="#64748b" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return { bg: '#dbeafe', color: '#1e40af', label: 'Queued in Kafka' };
      case 'DISPATCHED':
        return { bg: '#e0f2fe', color: '#0369a1', label: 'Dispatched' };
      case 'DELIVERED':
        return { bg: '#dcfce7', color: '#166534', label: 'Delivered ✓' };
      case 'DLQ_ROUTED':
        return { bg: '#fee2e2', color: '#991b1b', label: 'Quarantined to DLQ' };
      case 'FAILED':
        return { bg: '#fee2e2', color: '#991b1b', label: 'Failed' };
      default:
        return { bg: '#f1f5f9', color: '#475569', label: status };
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 63, 58, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '740px',
          maxHeight: '90vh',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: 'rgba(15, 118, 110, 0.12)',
                color: '#0f766e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0b3f3a' }}>
                  Pipeline &amp; Outbox Audit Inspector
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  Kafka 3.x
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                End-to-End Event Stream, Transactional Outbox &amp; Dead Letter Queue Trail
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onRefresh}
              className="btn btn-secondary hover-lift"
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Refresh audit trail"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          {/* Architecture Resilience Triad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div
              style={{
                padding: '14px',
                borderRadius: '14px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Database size={16} color="#16a34a" />
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#166534' }}>Transactional Outbox</span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#52736d', lineHeight: 1.4 }}>
                100% database-to-Kafka consistency. Events committed in PostgreSQL ledger before dispatch.
              </p>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '14px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Zap size={16} color="#2563eb" />
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e40af' }}>3-Partition Queue</span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#52736d', lineHeight: 1.4 }}>
                Parallel message partitions for high concurrency. 3 consumer worker threads.
              </p>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '14px',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <AlertTriangle size={16} color="#d97706" />
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#92400e' }}>Dead Letter Queue (DLQ)</span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#52736d', lineHeight: 1.4 }}>
                3x exponential backoff retries. Poison pills safely quarantined to <code>payment-receipt-dlq</code>.
              </p>
            </div>
          </div>

          {/* Order Reference Box */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>Target Order ID: </span>
              <strong style={{ fontFamily: 'monospace', color: '#0f766e' }}>{orderId}</strong>
            </div>
            <div style={{ color: '#64748b' }}>
              Recorded Events: <strong style={{ color: '#0f172a' }}>{auditLogs.length}</strong>
            </div>
          </div>

          {/* Audit Trail Timeline */}
          {auditLogs.length === 0 ? (
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                borderRadius: '14px',
                border: '1px dashed #cbd5e1',
                color: '#64748b',
                fontSize: '13px',
              }}
            >
              <Clock size={24} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
              <div>Polling for notification audit logs...</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>
                Events stream asynchronously from Apache Kafka and transactional outbox.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {auditLogs.map((logItem, idx) => {
                const badge = statusBadge(logItem.status);
                const timeStr = new Date(logItem.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <div
                    key={logItem.id || idx}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '14px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '10px',
                          backgroundColor: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        {channelIcon(logItem.channel)}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                            {logItem.channel}
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: badge.bg,
                              color: badge.color,
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            {badge.label}
                          </span>
                          {logItem.retryCount > 0 && (
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                fontSize: '10px',
                                fontWeight: 700,
                              }}
                            >
                              Retry #{logItem.retryCount}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                          {logItem.details}
                        </div>
                        {logItem.recipient && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Target: {logItem.recipient}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          color: '#64748b',
                          fontWeight: 600,
                        }}
                      >
                        {timeStr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
            style={{
              padding: '9px 20px',
              borderRadius: '10px',
              fontSize: '13px',
              backgroundColor: '#0f766e',
            }}
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
