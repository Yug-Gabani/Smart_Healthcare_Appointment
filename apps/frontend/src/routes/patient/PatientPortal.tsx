// Implements: FR-03, FR-04, FR-06
// Safety:    S1, S2, S4
// Owner:     frontend (Group 6)

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { AIAdvisoryBanner } from '@/components/composed/AIAdvisoryBanner';

interface Appointment {
  id: string;
  status: string;
  symptoms_text: string;
  ai_urgency?: string | null;
  ai_summary?: string | null;
  clinician_urgency?: string | null;
  clinician_notes?: string | null;
  created_at: string;
}

export const PatientPortal: React.FC = () => {
  const queryClient = useQueryClient();
  const [symptoms, setSymptoms] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [medications, setMedications] = useState('');

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ['patient-appointments'],
    queryFn: () => apiFetch('/appointments'),
  });

  const triageMutation = useMutation({
    mutationFn: (payload: { symptoms: string; responses: any }) =>
      apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setSymptoms('');
      setMedicalHistory('');
      setMedications('');
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triageMutation.mutate({
      symptoms,
      responses: {
        medical_history: medicalHistory,
        current_medications: medications,
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Patient Health Portal</h1>
        <p className="text-slate-600">
          Book appointments and complete smart pre-visit clinical triage.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">
          Pre-visit Questionnaire & Triage
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Describe your current symptoms *
            </label>
            <textarea
              required
              rows={3}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g. Mild headache and low fever since yesterday evening..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Medical History / Conditions
              </label>
              <input
                type="text"
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="e.g. Asthma, Hypertension"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Current Medications
              </label>
              <input
                type="text"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                placeholder="e.g. Paracetamol 500mg"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={triageMutation.isPending}
            className="bg-sky-600 hover:bg-sky-700 text-white font-medium px-5 py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {triageMutation.isPending ? 'Analyzing & Booking...' : 'Submit Pre-visit Triage'}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-800">Your Consultations</h2>
        {isLoading ? (
          <p className="text-slate-500">Loading appointments...</p>
        ) : appointments?.length === 0 ? (
          <p className="text-slate-500">No appointments booked yet.</p>
        ) : (
          appointments?.map((app) => (
            <div
              key={app.id}
              className="bg-white p-5 rounded-xl shadow-sm border border-slate-200"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">
                    Status: {app.status}
                  </span>
                  <p className="text-sm font-medium text-slate-800 mt-2">
                    Symptoms: {app.symptoms_text}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(app.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* S1: AI Advisory Banner */}
              <AIAdvisoryBanner
                urgency={app.ai_urgency}
                summary={app.ai_summary}
                isEmergency={app.status === 'EMERGENCY_ESCALATED'}
              />

              {app.clinician_urgency && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 text-sm">
                  <span className="font-semibold">Clinician Decision:</span>{' '}
                  {app.clinician_urgency}
                  {app.clinician_notes && <p className="mt-1">{app.clinician_notes}</p>}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
