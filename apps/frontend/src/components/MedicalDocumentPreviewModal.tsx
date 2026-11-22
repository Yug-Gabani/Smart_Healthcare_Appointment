import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  Eye,
  Calendar,
  HardDrive,
} from 'lucide-react';
import type { Attachment } from '../types';

interface MedicalDocumentPreviewModalProps {
  document: Attachment | null;
  onClose: () => void;
}

export function formatCategoryLabel(cat?: string): string {
  switch (cat) {
    case 'BLOOD_REPORT':
      return 'Blood Report';
    case 'MRI':
      return 'MRI Scan';
    case 'XRAY':
      return 'X-Ray';
    case 'PRESCRIPTION':
    case 'PRIOR_PRESCRIPTION':
      return 'Prescription';
    case 'LAB_REPORT':
      return 'Lab Report';
    case 'SYMPTOM_IMAGE':
      return 'Symptom Photo';
    case 'OTHER':
    default:
      return 'Medical Document';
  }
}

export function getCategoryBadgeStyle(cat?: string): { bg: string; text: string; border: string } {
  switch (cat) {
    case 'BLOOD_REPORT':
      return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };
    case 'MRI':
      return { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' };
    case 'XRAY':
      return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
    case 'PRESCRIPTION':
    case 'PRIOR_PRESCRIPTION':
      return { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
    case 'LAB_REPORT':
      return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
    case 'SYMPTOM_IMAGE':
      return { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' };
    case 'OTHER':
    default:
      return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const MedicalDocumentPreviewModal: React.FC<MedicalDocumentPreviewModalProps> = ({
  document: doc,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!doc) return null;

  const isPdf =
    doc.mimeType === 'application/pdf' ||
    doc.fileName.toLowerCase().endsWith('.pdf') ||
    doc.fileUrl.toLowerCase().includes('.pdf');

  const isImage =
    doc.mimeType?.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(doc.fileName) ||
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(doc.fileUrl);

  const badge = getCategoryBadgeStyle(doc.fileCategory);

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(11, 63, 58, 0.65)',
            backdropFilter: 'blur(4px)',
          }}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          transition={{ type: 'spring', damping: 25, stiffness: 320 }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '960px',
            maxHeight: '92vh',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(11, 63, 58, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #d9ece7',
            zIndex: 1001,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid #eaf6f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fbfa',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#eaf6f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#0f766e',
                }}
              >
                {isPdf ? <FileText size={22} /> : isImage ? <Eye size={22} /> : <FileSpreadsheet size={22} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#0b3f3a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={doc.fileName}
                >
                  {doc.fileName}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '12px',
                    color: '#52736d',
                    marginTop: '2px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: badge.bg,
                      color: badge.text,
                      border: `1px solid ${badge.border}`,
                    }}
                  >
                    {formatCategoryLabel(doc.fileCategory)}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <HardDrive size={12} /> {formatFileSize(doc.fileSizeBytes)}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} /> {formatDate(doc.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <a
                href={doc.fileUrl}
                download={doc.fileName}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#eaf6f2',
                  border: '1px solid #d9ece7',
                  color: '#0f766e',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease',
                }}
              >
                <Download size={15} />
                <span>Download</span>
              </a>

              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d9ece7',
                  color: '#0b3f3a',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
                title="Open in new window"
              >
                <ExternalLink size={15} />
                <span>New Tab</span>
              </a>

              <button
                onClick={onClose}
                aria-label="Close preview"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body Viewer */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              backgroundColor: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px',
              maxHeight: 'calc(92vh - 80px)',
              position: 'relative',
              padding: isPdf ? '0' : '20px',
            }}
          >
            {isPdf ? (
              <iframe
                src={doc.fileUrl}
                title={doc.fileName}
                style={{
                  width: '100%',
                  height: '75vh',
                  minHeight: '520px',
                  border: 'none',
                  backgroundColor: '#ffffff',
                }}
              />
            ) : isImage ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                }}
              >
                <img
                  src={doc.fileUrl}
                  alt={doc.fileName}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '74vh',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px',
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #d9ece7',
                  maxWidth: '420px',
                }}
              >
                <AlertCircle size={44} color="#0f766e" style={{ margin: '0 auto 16px' }} />
                <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0b3f3a' }}>
                  In-Browser Preview Not Available
                </h4>
                <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#52736d', lineHeight: 1.5 }}>
                  This file format ({doc.mimeType || 'unknown'}) cannot be directly previewed inline.
                  You can download it or open it directly in a new tab.
                </p>
                <a
                  href={doc.fileUrl}
                  download={doc.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    backgroundColor: '#0f766e',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <Download size={16} /> Download File
                </a>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

