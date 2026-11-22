import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '../motion/PageTransition';
import { listItem } from '../motion/presets';
import {
  Upload,
  FileText,
  Eye,
  Download,
  Trash2,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Plus,
  FolderOpen,
  Calendar,
  HardDrive,
  FileSpreadsheet,
  Activity,
  ArrowUpDown,
} from 'lucide-react';
import type { Attachment, AttachmentCategory } from '../types';
import { filesApi } from '../services/api';
import {
  MedicalDocumentPreviewModal,
  formatCategoryLabel,
  getCategoryBadgeStyle,
  formatFileSize,
  formatDate,
} from './MedicalDocumentPreviewModal';

const FONT = "'Space Grotesk', sans-serif";

const CATEGORY_OPTIONS: { key: AttachmentCategory; label: string; icon: string }[] = [
  { key: 'BLOOD_REPORT', label: 'Blood Report', icon: '🩸' },
  { key: 'MRI', label: 'MRI Scan', icon: '🧠' },
  { key: 'XRAY', label: 'X-Ray', icon: '🩻' },
  { key: 'PRESCRIPTION', label: 'Prescription', icon: '💊' },
  { key: 'OTHER', label: 'Other Document', icon: '📄' },
];

export const PatientRecordsVault: React.FC = () => {
  const navigate = useNavigate();

  const [records, setRecords] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Upload state
  const [selectedCategory, setSelectedCategory] = useState<AttachmentCategory>('BLOOD_REPORT');
  const [uploading, setUploading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Preview & Delete state
  const [previewDoc, setPreviewDoc] = useState<Attachment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await filesApi.myAttachments();
      setRecords(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load medical records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    let uploadedCount = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File ${file.name} exceeds the 10 MB limit.`);
        }
        await filesApi.upload(file, selectedCategory);
        uploadedCount++;
      }
      setSuccessMsg(`Successfully uploaded ${uploadedCount} document${uploadedCount > 1 ? 's' : ''} to your vault.`);
      await fetchRecords();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from your records vault?`)) {
      return;
    }
    setDeletingId(id);
    try {
      await filesApi.deleteAttachment(id);
      setRecords(prev => prev.filter(r => r.id !== id));
      setSuccessMsg(`Deleted "${name}" from vault.`);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete record');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRecords = useMemo(() => {
    return records
      .filter(doc => {
        const matchesCategory =
          filterCategory === 'ALL' ||
          doc.fileCategory === filterCategory ||
          (filterCategory === 'PRESCRIPTION' && doc.fileCategory === 'PRIOR_PRESCRIPTION');

        const matchesSearch =
          !searchQuery.trim() ||
          doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          formatCategoryLabel(doc.fileCategory).toLowerCase().includes(searchQuery.toLowerCase());

        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [records, filterCategory, searchQuery, sortOrder]);

  return (
    <PageTransition>
      <div
        style={{
          width: '94%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '40px 16px 80px',
          fontFamily: FONT,
        }}
      >
        {/* Page Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', marginBottom: '8px' }}>
            <ShieldCheck size={20} />
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Secure Clinical Vault · HIPAA & Digital Health Compliant
            </span>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0b3f3a', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Medical Records & Lab Reports Vault
          </h1>
          <p style={{ fontSize: '15px', color: '#52736d', margin: 0, maxWidth: '720px', lineHeight: 1.6 }}>
            Upload, organize, and view your diagnostic reports, MRI/CT scans, prescriptions, and medical records.
            Authorized doctors can review your historical documents during telehealth and clinical consultations.
          </p>
        </div>

        {/* Alerts */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '12px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '14px',
                fontWeight: 500,
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={18} />
                <span>{successMsg}</span>
              </div>
              <button
                onClick={() => setSuccessMsg(null)}
                style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontWeight: 700 }}
              >
                ✕
              </button>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '14px',
                fontWeight: 500,
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 700 }}
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #d9ece7',
            padding: '24px 28px',
            boxShadow: '0 4px 20px rgba(11, 63, 58, 0.04)',
            marginBottom: '40px',
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0b3f3a', margin: '0 0 6px' }}>
              Upload Medical Document
            </h2>
            <p style={{ fontSize: '13px', color: '#52736d', margin: 0 }}>
              Select a category to tag your document, then drag and drop or browse files.
            </p>
          </div>

          {/* Category Selector Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
            {CATEGORY_OPTIONS.map(cat => {
              const active = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    border: active ? '1.5px solid #0f766e' : '1px solid #d9ece7',
                    backgroundColor: active ? '#eaf6f2' : '#ffffff',
                    color: active ? '#0f766e' : '#0b3f3a',
                    fontSize: '13px',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    fontFamily: FONT,
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Dropzone */}
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDragOver(false);
              handleUploadFiles(e.dataTransfer.files);
            }}
            onClick={() => {
              if (!uploading) fileInputRef.current?.click();
            }}
            style={{
              borderRadius: '16px',
              border: isDragOver ? '2px dashed #0f766e' : '2px dashed #cfe0da',
              backgroundColor: isDragOver ? '#eaf6f2' : '#f8fbfa',
              padding: '36px 20px',
              textAlign: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              transition: 'all 180ms ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={e => handleUploadFiles(e.target.files)}
            />

            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#eaf6f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0f766e',
              }}
            >
              {uploading ? (
                <Loader2 size={26} className="animate-spin" />
              ) : (
                <Upload size={26} />
              )}
            </div>

            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#0b3f3a', marginBottom: '4px' }}>
                {uploading ? 'Uploading your medical documents…' : 'Click to upload or drag & drop files here'}
              </div>
              <div style={{ fontSize: '12px', color: '#52736d' }}>
                PDF, PNG, JPG, or WEBP up to 10 MB per document · Tagged as <strong>{formatCategoryLabel(selectedCategory)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar: Filters, Search, and Counts */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {/* Category Filter Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[
              { key: 'ALL', label: `All (${records.length})` },
              { key: 'BLOOD_REPORT', label: 'Blood Reports' },
              { key: 'MRI', label: 'MRI Scans' },
              { key: 'XRAY', label: 'X-Rays' },
              { key: 'PRESCRIPTION', label: 'Prescriptions' },
              { key: 'OTHER', label: 'Other' },
            ].map(tab => {
              const active = filterCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterCategory(tab.key)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: active ? '1px solid #0f766e' : '1px solid #d9ece7',
                    backgroundColor: active ? '#0f766e' : '#ffffff',
                    color: active ? '#ffffff' : '#0b3f3a',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 140ms ease',
                    fontFamily: FONT,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search & Sort Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #d9ece7',
                borderRadius: '10px',
              }}
            >
              <Search size={16} color="#52736d" />
              <input
                type="text"
                placeholder="Search documents…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '13px',
                  color: '#0b3f3a',
                  width: '180px',
                  fontFamily: FONT,
                  backgroundColor: 'transparent',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ border: 'none', background: 'none', color: '#52736d', cursor: 'pointer', fontSize: '12px' }}
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid #d9ece7',
                backgroundColor: '#ffffff',
                color: '#0b3f3a',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
              title="Toggle sort order"
            >
              <ArrowUpDown size={14} />
              <span>{sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 20px',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #d9ece7',
              gap: '12px',
            }}
          >
            <Loader2 size={32} className="animate-spin" color="#0f766e" />
            <span style={{ fontSize: '14px', color: '#52736d' }}>Loading your medical vault…</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '64px 20px',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #d9ece7',
            }}
          >
            <FolderOpen size={48} color="#0f766e" style={{ margin: '0 auto 16px', opacity: 0.8 }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0b3f3a', margin: '0 0 6px' }}>
              {records.length === 0 ? 'Your Medical Vault is Empty' : 'No Matching Documents Found'}
            </h3>
            <p style={{ fontSize: '14px', color: '#52736d', margin: '0 0 20px' }}>
              {records.length === 0
                ? 'Upload your blood tests, MRI scans, prescriptions, or prior reports above.'
                : 'Try adjusting your search terms or filter selection.'}
            </p>
            {records.length > 0 && (
              <button
                onClick={() => {
                  setFilterCategory('ALL');
                  setSearchQuery('');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#eaf6f2',
                  border: '1px solid #d9ece7',
                  color: '#0f766e',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '20px',
            }}
          >
            {filteredRecords.map(doc => {
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
                <motion.div
                  key={doc.id}
                  variants={listItem}
                  initial="hidden"
                  animate="show"
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #d9ece7',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 8px rgba(11, 63, 58, 0.04)',
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(11, 63, 58, 0.1)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(11, 63, 58, 0.04)';
                  }}
                >
                  {/* Thumbnail / Header Area */}
                  <div
                    onClick={() => setPreviewDoc(doc)}
                    style={{
                      height: '140px',
                      backgroundColor: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      cursor: 'pointer',
                      overflow: 'hidden',
                    }}
                  >
                    {isImage ? (
                      <img
                        src={doc.fileUrl}
                        alt={doc.fileName}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 200ms ease',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '8px',
                          color: '#0f766e',
                        }}
                      >
                        <FileText size={44} />
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#52736d' }}>
                          PDF Document
                        </span>
                      </div>
                    )}

                    {/* Category Tag Overlay */}
                    <span
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {formatCategoryLabel(doc.fileCategory)}
                    </span>

                    {/* Preview Hover Cue */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(11, 63, 58, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        opacity: 0,
                        transition: 'opacity 150ms ease',
                        gap: '6px',
                        fontWeight: 600,
                        fontSize: '13px',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.opacity = '0';
                      }}
                    >
                      <Eye size={18} /> Click to Preview
                    </div>
                  </div>

                  {/* Card Details */}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
                    <div>
                      <div
                        style={{
                          fontSize: '14px',
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
                          gap: '10px',
                          fontSize: '12px',
                          color: '#52736d',
                          marginTop: '4px',
                        }}
                      >
                        <span>{formatFileSize(doc.fileSizeBytes)}</span>
                        <span>·</span>
                        <span>{formatDate(doc.createdAt)}</span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 'auto',
                        paddingTop: '12px',
                        borderTop: '1px solid #eaf6f2',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            backgroundColor: '#eaf6f2',
                            border: 'none',
                            color: '#0f766e',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Eye size={14} /> Preview
                        </button>

                        <a
                          href={doc.fileUrl}
                          download={doc.fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            backgroundColor: '#f1f5f9',
                            border: 'none',
                            color: '#334155',
                            fontSize: '12px',
                            fontWeight: 600,
                            textDecoration: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <Download size={14} />
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id, doc.fileName)}
                        disabled={deletingId === doc.id}
                        aria-label={`Delete ${doc.fileName}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: deletingId === doc.id ? 'wait' : 'pointer',
                          padding: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          opacity: deletingId === doc.id ? 0.5 : 0.8,
                        }}
                        title="Delete document"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* In-Browser Preview Modal */}
        <MedicalDocumentPreviewModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      </div>
    </PageTransition>
  );
};

