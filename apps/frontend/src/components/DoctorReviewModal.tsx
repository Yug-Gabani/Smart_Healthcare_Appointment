import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, X, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { reviewsApi } from '../services/api';
import type { DoctorReview } from '../types';

interface DoctorReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  doctorId?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  doctorAvatarUrl?: string;
  onSuccess?: () => void;
}

const REVIEW_TAGS = [
  'Thorough & Attentive',
  'Clear Explanations',
  'Empathetic & Kind',
  'Punctual',
  'Great Follow-up',
  'Accurate Treatment',
];

const RATING_LABELS: Record<number, string> = {
  1: 'Needs improvement',
  2: 'Fair',
  3: 'Good experience',
  4: 'Very good consultation',
  5: 'Exceptional care',
};

export const DoctorReviewModal: React.FC<DoctorReviewModalProps> = ({
  isOpen,
  onClose,
  appointmentId,
  doctorId: _doctorId,
  doctorName = 'Attending Doctor',
  doctorSpecialty,
  doctorAvatarUrl,
  onSuccess,
}) => {
  const [existingReview, setExistingReview] = useState<DoctorReview | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !appointmentId) return;
    setLoadingInitial(true);
    setError(null);
    setSubmitted(false);
    reviewsApi
      .getForAppointment(appointmentId)
      .then((rev) => {
        setExistingReview(rev);
        if (rev) {
          setRating(rev.rating);
          setComment(rev.comment || '');
          setIsAnonymous(rev.isAnonymous || false);
          if (rev.tags) setSelectedTags(rev.tags.split(',').map((t) => t.trim()));
        } else {
          setRating(5);
          setComment('');
          setSelectedTags([]);
          setIsAnonymous(false);
        }
      })
      .catch(() => {
        setExistingReview(null);
      })
      .finally(() => setLoadingInitial(false));
  }, [isOpen, appointmentId]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) return;
    setSubmitting(true);
    setError(null);
    try {
      await reviewsApi.submit(appointmentId, {
        rating,
        comment: comment.trim() || undefined,
        tags: selectedTags.length ? selectedTags.join(', ') : undefined,
        isAnonymous,
      });
      setSubmitted(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Could not submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const activeRating = hoverRating ?? rating;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 63, 58, 0.55)',
        backdropFilter: 'blur(5px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          maxWidth: '520px',
          width: '100%',
          padding: '20px 24px',
          boxShadow: '0 20px 40px rgba(11, 63, 58, 0.2)',
          border: '1px solid #d9ece7',
          position: 'relative',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: '#52736d',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '50%',
          }}
        >
          <X size={20} />
        </button>

        {loadingInitial ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#52736d' }}>
            <Loader2 size={24} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
            Loading consultation review…
          </div>
        ) : submitted ? (
          <div style={{ textAlign: 'center', padding: '36px 12px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#d9ece7',
                color: '#0f766e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0b3f3a', margin: '0 0 8px 0' }}>
              Thank You for Your Feedback!
            </h3>
            <p style={{ fontSize: '14px', color: '#52736d', margin: 0 }}>
              Your rating helps patients find quality care and supports our clinical team.
            </p>
          </div>
        ) : (
          <div>
            {/* Doctor Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              {doctorAvatarUrl ? (
                <img
                  src={doctorAvatarUrl}
                  alt={doctorName}
                  style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    backgroundColor: '#eaf6f2',
                    color: '#0f766e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '18px',
                  }}
                >
                  {doctorName.split(' ').map((s) => s[0]).join('').slice(0, 2)}
                </div>
              )}
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0b3f3a', margin: 0 }}>
                  {doctorName}
                </h3>
                <div style={{ fontSize: '13px', color: '#52736d' }}>
                  {doctorSpecialty ? `${doctorSpecialty} · ` : ''}Consultation Feedback
                </div>
              </div>
            </div>

            {existingReview && (
              <div
                style={{
                  backgroundColor: '#eaf6f2',
                  border: '1px solid #d9ece7',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#0f766e',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <ShieldCheck size={16} /> You have already reviewed this consultation. Submitting again will update your feedback.
              </div>
            )}

            {error && (
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: '#dc2626',
                  marginBottom: '16px',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Star Rating */}
              <div style={{ textAlign: 'center', margin: '8px 0 14px 0' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#52736d', marginBottom: '6px' }}>
                  How was your consultation experience?
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        transform: activeRating >= star ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform 0.15s ease',
                      }}
                    >
                      <Star
                        size={28}
                        color={activeRating >= star ? '#f59e0b' : '#d1d5db'}
                        fill={activeRating >= star ? '#f59e0b' : 'transparent'}
                      />
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f766e', marginTop: '4px', minHeight: '16px' }}>
                  {RATING_LABELS[activeRating] || ''}
                </div>
              </div>

              {/* Tags */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0b3f3a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  What went well?
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {REVIEW_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: isSelected ? '1px solid #0f766e' : '1px solid #d9ece7',
                          backgroundColor: isSelected ? '#0f766e' : '#f5faf8',
                          color: isSelected ? '#ffffff' : '#0b3f3a',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comment */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0b3f3a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Additional Comments (Optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share details about your appointment, clarity of doctor advice, or overall satisfaction..."
                  rows={2}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #d9ece7',
                    fontSize: '12px',
                    color: '#0b3f3a',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Anonymous Checkbox */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#52736d',
                  cursor: 'pointer',
                  marginBottom: '16px',
                }}
              >
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  style={{ accentColor: '#0f766e', width: '15px', height: '15px', cursor: 'pointer' }}
                />
                Post review anonymously (hides your name on public reviews)
              </label>

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="hover-lift"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0f766e',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: submitting ? 'wait' : 'pointer',
                  }}
                >
                  {submitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Submitting…</>
                  ) : existingReview ? (
                    'Update Review'
                  ) : (
                    'Submit Review'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
};
