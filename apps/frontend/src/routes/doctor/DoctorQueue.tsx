// Implements: FR-16
// Safety:    S1, S8, DR-15
// Owner:     frontend (Group 6)

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { AIAdvisoryBanner } from '@/components/composed/AIAdvisoryBanner';

interface Appointment {
  id: string;
  patient_id: string;
  status: string;
  symptoms_text: string;
  questionnaire_responses: any;
  ai_urgency?: string | null;
  ai_summary?: string | null;
  clinician_urgency?: string | null;
  clinician_notes?: string | null;
  created_at: string;
}

export const DoctorQueue: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
  const [clinicianUrgency, setClinicianUrgency] = useState<string>('ROUTINE');
  const [clinicianNotes, setClinicianNotes] = useState<string>('');

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ['doctor-queue'],
    queryFn: () => apiFetch('/appointments'),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiFetch(`/appointments/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setSelectedApp(null);
      setClinicianNotes('');
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
    },
  });

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    reviewMutation.mutate({
      id: selectedApp.id,
      payload: {
        clinician_urgency: clinicianUrgency,
        clinician_notes: clinicianNotes,
      },
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Doctor Clinical Queue</h1>
        <p className="text-slate-600">
          Review patient cases, triage classifications, and authorize consultations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-slate-700">Patient Queue</h2>
          {isLoading ? (
            <p className="text-slate-500">Loading triage queue...</p>
          ) : appointments?.length === 0 ? (
            <p className="text-slate-500">Queue is clear.</p>
          ) : (
            appointments?.map((app) => (
              <div
                key={app.id}
                onClick={() => {
                  setSelectedApp(app);
                  setClinicianUrgency(app.ai_urgency || 'ROUTINE');
                }}
                className={`p-4 rounded-xl border cursor-pointer transition ${
                  selectedApp?.id === app.id
                    ? 'border-sky-500 bg-sky-50/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        app.status === 'EMERGENCY_ESCALATED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {app.status}
                    </span>
                    <p className="text-sm font-medium text-slate-800 mt-2">
                      {app.symptoms_text}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(app.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <AIAdvisoryBanner
                  urgency={app.ai_urgency}
                  summary={app.ai_summary}
                  isEmergency={app.status === 'EMERGENCY_ESCALATED'}
                />
              </div>
            ))
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-700 mb-4">
            Clinician Decision Panel
          </h2>
          {selectedApp ? (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <span className="text-xs text-slate-500">Case ID:</span>
                <p className="font-mono text-xs font-semibold text-slate-700">
                  {selectedApp.id}
                </p>
              </div>

              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Clinician Urgency Decision (DR-15)
                  </label>
                  <select
                    value={clinicianUrgency}
                    onChange={(e) => setClinicianUrgency(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                  >
                    <option value="EMERGENCY">EMERGENCY</option>
                    <option value="URGENT">URGENT</option>
                    <option value="ROUTINE">ROUTINE</option>
                    <option value="SELF_CARE">SELF_CARE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Clinician Notes & Care Plan
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={clinicianNotes}
                    onChange={(e) => setClinicianNotes(e.target.value)}
                    placeholder="Document clinical diagnosis rationale and next steps..."
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={reviewMutation.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg transition disabled:opacity-50"
                >
                  {reviewMutation.isPending
                    ? 'Confirming Review...'
                    : 'Confirm & Authorize Consultation'}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
              Select a patient from the queue to review and override or confirm AI triage.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
