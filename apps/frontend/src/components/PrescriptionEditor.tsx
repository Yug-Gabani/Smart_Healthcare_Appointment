import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { scaleIn, EASE_ENTER, EASE_EXIT } from '../motion/presets';
import { Loader2, Plus, Trash2, X, Download } from 'lucide-react';
import type { MealTiming, Prescription, PrescriptionItem } from '../types';
import { describePrescriptionItem } from '../types';
import { prescriptionsApi } from '../services/api';

// Chips omit UNSPECIFIED from the regular lists; it's a separate "none" state.

/**
 * Two logical groups for the chip strip. Rendering keeps them in order with a
 * subtle divider so the picker reads as "meal-relative" first, then "other" —
 * which is how doctors actually think about dosing timing.
 */
const MEAL_CHIPS: { value: MealTiming; label: string }[] = [
  { value: 'BEFORE_BREAKFAST', label: 'Before breakfast' },
  { value: 'AFTER_BREAKFAST',  label: 'After breakfast' },
  { value: 'BEFORE_LUNCH',     label: 'Before lunch' },
  { value: 'AFTER_LUNCH',      label: 'After lunch' },
  { value: 'BEFORE_DINNER',    label: 'Before dinner' },
  { value: 'AFTER_DINNER',     label: 'After dinner' },
];
const OTHER_CHIPS: { value: MealTiming; label: string }[] = [
  { value: 'WITH_MEAL',     label: 'With a meal' },
  { value: 'EMPTY_STOMACH', label: 'Empty stomach' },
  { value: 'AT_BEDTIME',    label: 'At bedtime' },
  { value: 'AS_NEEDED',     label: 'As needed' },
  { value: 'UNSPECIFIED',   label: 'No specific timing' },
];

interface PrescriptionEditorProps {
  appointmentId: string;
  patientName?: string;
  onClose: () => void;
  onSigned?: (rx: Prescription) => void;
}

function blankItem(): PrescriptionItem {
  return {
    drugName: '',
    dose: '',
    frequency: '',
    duration: '',
    instructions: '',
    mealTimings: ['UNSPECIFIED'],
  };
}

/**
 * Toggle a meal timing in a list, enforcing the "UNSPECIFIED is exclusive" rule.
 *   - Clicking UNSPECIFIED clears everything else and becomes the sole selection.
 *   - Clicking anything else removes UNSPECIFIED and toggles that chip.
 *   - Clicking the only remaining chip (no others left) falls back to UNSPECIFIED.
 */
function toggleTiming(current: MealTiming[] | undefined, value: MealTiming): MealTiming[] {
  const list = current ?? [];
  if (value === 'UNSPECIFIED') return ['UNSPECIFIED'];
  const withoutUnspec = list.filter(t => t !== 'UNSPECIFIED');
  if (withoutUnspec.includes(value)) {
    const next = withoutUnspec.filter(t => t !== value);
    return next.length === 0 ? ['UNSPECIFIED'] : next;
  }
  return [...withoutUnspec, value];
}

/**
 * Modal editor + signer. Loads the active prescription for the given appointment on mount:
 *   - no active rx  → shows a blank DRAFT form
 *   - DRAFT exists  → shows editable form pre-filled
 *   - SIGNED exists → shows read-only view with Void + PDF download
 *   - VOIDED only   → shows read-only banner and a blank form to issue a new one
 */
export const PrescriptionEditor: React.FC<PrescriptionEditorProps> = ({
  appointmentId,
  patientName,
  onClose,
  onSigned,
}) => {
  const [history, setHistory] = useState<Prescription[]>([]);
  const [active, setActive] = useState<Prescription | null>(null); // DRAFT or SIGNED
  const [items, setItems] = useState<PrescriptionItem[]>([blankItem()]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const load = () => {
    setBusy('load');
    setError(null);
    prescriptionsApi
      .listForAppointment(appointmentId)
      .then(list => {
        setHistory(list);
        // "active" = any DRAFT, or any SIGNED that hasn't been voided by a sibling VOIDED record.
    const voidedTargets = new Set(list.filter(r => r.status === 'VOIDED' && r.voidOf).map(r => r.voidOf!));
    const current = list.find(r =>
      r.status === 'DRAFT' ||
      (r.status === 'SIGNED' && !voidedTargets.has(r.id))
    ) ?? null;
        setActive(current);
        if (current) {
          setItems(current.items.length > 0 ? current.items : [blankItem()]);
          setNotes(current.notes ?? '');
        } else {
          setItems([blankItem()]);
          setNotes('');
        }
      })
      .catch(e => setError(e?.message || 'Could not load prescriptions'))
      .finally(() => setBusy(null));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  const canEdit = !active || active.status === 'DRAFT';
  const isSigned = active?.status === 'SIGNED';

  const updateItem = (idx: number, patch: Partial<PrescriptionItem>) =>
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () => setItems(prev => [...prev, blankItem()]);
  const removeItem = (idx: number) =>
    setItems(prev => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const validate = (): string | null => {
    if (items.length === 0) return 'Add at least one medication.';
    for (const [i, it] of items.entries()) {
      if (!it.drugName.trim()) return `Row ${i + 1}: drug name required.`;
      if (!it.dose.trim()) return `Row ${i + 1}: dose required.`;
      if (!it.frequency.trim()) return `Row ${i + 1}: frequency required.`;
      if (!it.duration.trim()) return `Row ${i + 1}: duration required.`;
    }
    return null;
  };

  const saveDraft = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setBusy('save');
    try {
      if (active && active.status === 'DRAFT') {
        const updated = await prescriptionsApi.update(active.id, { notes, items });
        setActive(updated);
      } else {
        const created = await prescriptionsApi.create({ appointmentId, notes, items });
        setActive(created);
      }
      load();
    } catch (e: any) {
      setError(e?.message || 'Could not save draft');
    } finally {
      setBusy(null);
    }
  };

  const signNow = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setBusy('sign');
    try {
      // Ensure the latest edits are persisted before signing.
      let draft = active;
      if (!draft) {
        draft = await prescriptionsApi.create({ appointmentId, notes, items });
      } else if (draft.status === 'DRAFT') {
        draft = await prescriptionsApi.update(draft.id, { notes, items });
      }
      const signed = await prescriptionsApi.sign(draft!.id);
      setActive(signed);
      onSigned?.(signed);
      load();
    } catch (e: any) {
      setError(e?.message || 'Could not sign prescription');
    } finally {
      setBusy(null);
    }
  };

  const confirmVoid = async () => {
    if (!active || active.status !== 'SIGNED') return;
    if (!voidReason.trim()) { setError('A reason is required to void.'); return; }
    setBusy('void');
    setError(null);
    try {
      await prescriptionsApi.voidRx(active.id, voidReason.trim());
      setVoidOpen(false);
      setVoidReason('');
      // The previously-SIGNED record is now retired by a VOIDED counterpart, so the editor
      // should offer a fresh draft form for the corrected prescription.
      setActive(null);
      setItems([blankItem()]);
      setNotes('');
      load();
    } catch (e: any) {
      setError(e?.message || 'Could not void prescription');
    } finally {
      setBusy(null);
    }
  };

  const discardDraft = async () => {
    if (!active || active.status !== 'DRAFT') return;
    if (!confirm('Discard this draft?')) return;
    setBusy('delete');
    try {
      await prescriptionsApi.deleteDraft(active.id);
      load();
    } catch (e: any) {
      setError(e?.message || 'Could not delete draft');
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = () => {
    if (!active) return;
    const token = localStorage.getItem('pulsecare_token');
    fetch(prescriptionsApi.pdfUrl(active.id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prescription-${active.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError('PDF download failed'));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        backgroundColor: 'rgba(11, 63, 58, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <motion.div
        variants={scaleIn}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{
          backgroundColor: '#ffffff', borderRadius: '20px',
          maxWidth: '820px', width: '100%', maxHeight: '92vh', overflow: 'auto',
          boxShadow: '0 24px 64px rgba(20, 60, 55, 0.20)',
          border: '1px solid #d9ece7',
        }}
      >
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #d9ece7',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, backgroundColor: '#ffffff', zIndex: 2,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0b3f3a' }}>
              Prescription
            </h2>
            <div style={{ fontSize: '13px', color: '#52736d', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{patientName ? `For ${patientName}` : 'Patient'}</span>
              {active && (
                <span className="badge-morph" style={{
                  fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                  backgroundColor: active.status === 'SIGNED' ? '#ecfdf5' : '#eaf6f2',
                  color: active.status === 'SIGNED' ? '#065f46' : '#0f766e',
                  border: active.status === 'SIGNED' ? '1px solid #a7f3d0' : '1px solid #d9ece7',
                }}>
                  {active.status}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="icon-pop"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#52736d', padding: '4px',
            }}
          ><X size={20} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {isSigned && (
            <div style={{
              padding: '12px 14px', borderRadius: '12px',
              backgroundColor: 'rgba(5, 150, 105, 0.08)',
              border: '1px solid rgba(5, 150, 105, 0.25)',
              color: '#065f46', fontSize: '13px', marginBottom: '14px',
            }}>
              Signed on {active!.signedAt ? new Date(active!.signedAt).toLocaleString() : '—'}.
              This prescription is immutable (DR-03). To correct an error, void it and issue a new one.
            </div>
          )}

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '10px',
              backgroundColor: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              color: '#dc2626', fontSize: '13px', marginBottom: '12px',
            }}>{error}</div>
          )}

          {busy === 'load' ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#52736d' }}>
              <Loader2 size={20} className="animate-spin" style={{ display: 'inline', marginRight: 8 }} />
              Loading…
            </div>
          ) : (
            <>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700,
                color: '#52736d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Clinical notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={!canEdit}
                placeholder="e.g. patient has mild penicillin sensitivity; monitor for rash."
                style={{
                  width: '100%', minHeight: '60px', padding: '10px 12px',
                  borderRadius: '10px', border: '1px solid #d9ece7',
                  fontFamily: 'inherit', fontSize: '14px', color: '#0b3f3a',
                  backgroundColor: canEdit ? '#ffffff' : '#eaf6f2',
                  outline: 'none', resize: 'vertical',
                }}
              />

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: '18px', marginBottom: '8px',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700,
                  color: '#52736d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Medications
                </div>
                {canEdit && (
                  <button
                    onClick={addItem}
                    className="hover-lift"
                    style={{
                      backgroundColor: 'transparent', border: '1px dashed #0f766e',
                      color: '#0f766e', borderRadius: '9999px',
                      padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} /> Add medication
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <AnimatePresence initial={false}>
                  {items.map((it, idx) => (
                    <motion.div
                      key={idx}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18, ease: EASE_EXIT } }}
                      transition={{ duration: 0.2, ease: EASE_ENTER }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.4fr 0.8fr 1fr 0.9fr 36px',
                        gap: '8px', alignItems: 'start',
                        padding: '12px', borderRadius: '12px',
                        border: '1px solid #d9ece7',
                        backgroundColor: canEdit ? '#ffffff' : '#eaf6f2',
                      }}
                    >
                      <div>
                        <FieldLabel>Drug name</FieldLabel>
                        <input
                          value={it.drugName} onChange={e => updateItem(idx, { drugName: e.target.value })}
                          disabled={!canEdit} placeholder="e.g. Paracetamol"
                          style={cellStyle(canEdit)}
                        />
                      </div>
                      <div>
                        <FieldLabel>Dose</FieldLabel>
                        <input
                          value={it.dose} onChange={e => updateItem(idx, { dose: e.target.value })}
                          disabled={!canEdit} placeholder="e.g. 500 mg"
                          style={cellStyle(canEdit)}
                        />
                      </div>
                      <div>
                        <FieldLabel>How often</FieldLabel>
                        <input
                          value={it.frequency} onChange={e => updateItem(idx, { frequency: e.target.value })}
                          disabled={!canEdit} placeholder="e.g. 3 times a day"
                          style={cellStyle(canEdit)}
                        />
                      </div>
                      <div>
                        <FieldLabel>For how long</FieldLabel>
                        <input
                          value={it.duration} onChange={e => updateItem(idx, { duration: e.target.value })}
                          disabled={!canEdit} placeholder="e.g. 5 days"
                          style={cellStyle(canEdit)}
                        />
                      </div>
                      {canEdit && items.length > 1 ? (
                        <button
                          onClick={() => removeItem(idx)}
                          title="Remove"
                          className="icon-pop"
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: '#dc2626', padding: '6px', alignSelf: 'end',
                          }}
                        ><Trash2 size={16} /></button>
                      ) : <div />}

                      {/* second row: compact MULTI-SELECT chip picker */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <FieldLabel>When to take it · pick one or more</FieldLabel>
                        <div
                          role="group"
                          aria-label="When to take this medication"
                          style={{
                            display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                            gap: '4px', padding: '2px 0',
                          }}
                        >
                          {MEAL_CHIPS.map(opt => {
                            const active = (it.mealTimings ?? []).includes(opt.value);
                            return (
                              <TimingChip
                                key={opt.value}
                                label={opt.label}
                                active={active}
                                disabled={!canEdit}
                                onClick={() => updateItem(idx, { mealTimings: toggleTiming(it.mealTimings, opt.value) })}
                              />
                            );
                          })}
                          <span aria-hidden style={{
                            width: '1px', height: '18px', backgroundColor: '#d9ece7',
                            margin: '0 4px',
                          }} />
                          {OTHER_CHIPS.map(opt => {
                            const active = (it.mealTimings ?? []).includes(opt.value);
                            return (
                              <TimingChip
                                key={opt.value}
                                label={opt.label}
                                active={active}
                                disabled={!canEdit}
                                muted={opt.value === 'UNSPECIFIED'}
                                onClick={() => updateItem(idx, { mealTimings: toggleTiming(it.mealTimings, opt.value) })}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* third row: extra notes */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <FieldLabel>Extra notes (optional)</FieldLabel>
                        <input
                          value={it.instructions ?? ''} onChange={e => updateItem(idx, { instructions: e.target.value })}
                          disabled={!canEdit}
                          placeholder="e.g. with plenty of water; avoid alcohol"
                          style={{ ...cellStyle(canEdit), width: '100%' }}
                        />
                      </div>

                      {/* readable preview — helps the doctor see what the patient will read */}
                      <div style={{
                        gridColumn: '1 / -1',
                        fontSize: '12px', color: '#0f766e',
                        backgroundColor: '#eaf6f2', padding: '6px 10px',
                        borderRadius: '8px', fontStyle: 'italic',
                        border: '1px dashed #d9ece7',
                      }}>
                        Patient will see: <strong>{it.drugName || '(drug)'}</strong> — {describePrescriptionItem(it) || '…'}
                        {it.instructions ? ` · ${it.instructions}` : ''}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Voided history */}
              {history.filter(r => r.status === 'VOIDED').length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700,
                    color: '#52736d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Prior voided versions
                  </div>
                  {history.filter(r => r.status === 'VOIDED').map(v => (
                    <div key={v.id} style={{
                      padding: '10px 12px', borderRadius: '10px',
                      backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                      color: '#991b1b', fontSize: '12px', marginBottom: '8px',
                    }}>
                      VOIDED {new Date(v.createdAt).toLocaleString()} · {v.voidReason ?? 'no reason'}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #d9ece7',
          display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end',
          backgroundColor: '#eaf6f2',
        }}>
          {canEdit && active?.status === 'DRAFT' && (
            <button onClick={discardDraft} disabled={!!busy}
              className="hover-lift"
              style={ghostBtn('#dc2626')}>
              Discard draft
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={saveDraft} disabled={!!busy} className="hover-lift" style={ghostBtn('#0f766e')}>
                {busy === 'save' ? 'Saving…' : 'Save draft'}
              </button>
              <button onClick={signNow} disabled={!!busy} className="hover-lift" style={primaryBtn()}>
                {busy === 'sign' ? 'Signing…' : 'Sign & issue'}
              </button>
            </>
          )}
          {isSigned && (
            <>
              <button onClick={downloadPdf} className="hover-lift" style={ghostBtn('#0f766e')}>
                <Download size={14} /> Download PDF
              </button>
              <button onClick={() => setVoidOpen(true)} disabled={!!busy}
                className="hover-lift"
                style={ghostBtn('#dc2626')}>
                Void prescription
              </button>
            </>
          )}
          <button onClick={onClose} style={ghostBtn('#52736d')}>Close</button>
        </div>

        {/* Void confirmation modal (overlay inside) */}
        {voidOpen && (
          <div style={{
            position: 'absolute', inset: 0, backgroundColor: 'rgba(11, 63, 58, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            borderRadius: '20px',
          }}>
            <div style={{
              backgroundColor: '#ffffff', borderRadius: '14px', padding: '20px',
              maxWidth: '420px', width: '100%',
              boxShadow: '0 12px 32px rgba(20, 60, 55, 0.18)',
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Void this prescription?</h3>
              <p style={{ fontSize: '13px', color: '#52736d', marginTop: '6px' }}>
                A VOIDED record is added. The original SIGNED copy remains in the audit trail.
              </p>
              <input
                value={voidReason} onChange={e => setVoidReason(e.target.value)}
                placeholder="Reason (required)"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '10px',
                  border: '1px solid #d9ece7', fontSize: '14px',
                  margin: '12px 0', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => setVoidOpen(false)} style={ghostBtn('#52736d')}>Cancel</button>
                <button onClick={confirmVoid} disabled={!!busy}
                  className="hover-lift"
                  style={{ ...primaryBtn(), backgroundColor: '#dc2626' }}>
                  {busy === 'void' ? 'Voiding…' : 'Confirm void'}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

function cellStyle(editable: boolean): React.CSSProperties {
  return {
    padding: '8px 10px', borderRadius: '8px',
    border: '1px solid #d9ece7', fontSize: '13px', color: '#0b3f3a',
    backgroundColor: editable ? '#ffffff' : 'transparent',
    outline: 'none', fontFamily: 'inherit', minWidth: 0, width: '100%',
    boxSizing: 'border-box',
  };
}

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: '10px', fontWeight: 700, color: '#8aa39d',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    marginBottom: '4px',
  }}>{children}</div>
);

interface TimingChipProps {
  label: string;
  active: boolean;
  disabled: boolean;
  muted?: boolean;
  onClick: () => void;
}
const TimingChip: React.FC<TimingChipProps> = ({ label, active, disabled, muted, onClick }) => {
  const base: React.CSSProperties = {
    padding: '4px 10px', borderRadius: '9999px',
    fontSize: '11px', lineHeight: '14px', fontWeight: 500,
    border: '1px solid',
    cursor: disabled ? 'not-allowed' : 'pointer',
    userSelect: 'none', whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  };
  const inactive: React.CSSProperties = muted
    ? { backgroundColor: '#ffffff', borderColor: '#d9ece7', color: '#8aa39d' }
    : { backgroundColor: '#eaf6f2', borderColor: '#d9ece7', color: '#0b3f3a' };
  const activeStyle: React.CSSProperties = {
    backgroundColor: '#0f766e', borderColor: '#0f766e', color: '#ffffff', fontWeight: 600,
  };
  const style = { ...base, ...(active ? activeStyle : inactive), opacity: disabled && !active ? 0.5 : 1 };
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className="chip"
      style={style}
      onMouseEnter={e => {
        if (!disabled && !active) e.currentTarget.style.borderColor = '#0f766e';
      }}
      onMouseLeave={e => {
        if (!disabled && !active) e.currentTarget.style.borderColor = '#d9ece7';
      }}
    >
      {label}
    </button>
  );
};

function ghostBtn(color: string): React.CSSProperties {
  return {
    backgroundColor: 'transparent', border: `1px solid ${color}`, color,
    borderRadius: '9999px', padding: '8px 16px', fontSize: '13px', fontWeight: 600,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
  };
}

function primaryBtn(): React.CSSProperties {
  return {
    backgroundColor: '#0f766e', color: '#ffffff', border: 'none',
    borderRadius: '9999px', padding: '8px 20px', fontSize: '13px', fontWeight: 600,
    cursor: 'pointer',
  };
}
