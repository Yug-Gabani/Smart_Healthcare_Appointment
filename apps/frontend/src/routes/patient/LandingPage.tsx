// Implements: FR-03, FR-04, FR-06
// Safety:    S1, S2, S4
// Owner:     frontend (Group 6)

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  UserCheck,
  FlaskConical,
  Activity,
  Search,
  MapPin,
  Clock,
  Sparkles,
  Shield,
  Stethoscope,
  ChevronRight,
  HeartPulse,
  Brain,
  Baby,
  Smile,
} from 'lucide-react';
import { AIAdvisoryBanner } from '@/components/composed/AIAdvisoryBanner';
import { useAuthStore } from '@/stores/authStore';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [symptomSearch, setSymptomSearch] = useState('');
  const [location, setLocation] = useState('Ahmedabad / Gandhinagar');

  // Quick triage state (can be used with or without prior sign in!)
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [patientSymptoms, setPatientSymptoms] = useState('');
  const [duration, setDuration] = useState('1-2 days');
  const [severity, setSeverity] = useState('Moderate');
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageResult, setTriageResult] = useState<{
    urgency: string;
    summary: string;
    specialty: string;
  } | null>(null);

  const specialties = [
    {
      id: 'cold-cough',
      title: 'Cold, Cough & Fever',
      tag: 'General Physician',
      icon: Activity,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      id: 'skin',
      title: 'Acne & Skin Issues',
      tag: 'Dermatologist',
      icon: Sparkles,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      id: 'women-health',
      title: 'Period Doubts & Pregnancy',
      tag: 'Gynecologist',
      icon: HeartPulse,
      color: 'bg-rose-50 text-rose-600',
    },
    {
      id: 'mental-health',
      title: 'Depression & Anxiety',
      tag: 'Psychiatrist',
      icon: Brain,
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      id: 'pediatric',
      title: 'Child not feeling well',
      tag: 'Pediatrician',
      icon: Baby,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      id: 'dental',
      title: 'Toothache & Cavities',
      tag: 'Dentist',
      icon: Smile,
      color: 'bg-teal-50 text-teal-600',
    },
  ];

  const doctorsList = [
    {
      name: 'Dr. Aarav Patel',
      specialty: 'Senior Cardiologist & Physician',
      experience: '14 yrs exp',
      location: 'Civil Hospital Road, Gandhinagar',
      rating: '98%',
      stories: '240 Patient Stories',
      fee: '₹600',
      available: 'Available in 15 mins',
    },
    {
      name: 'Dr. Sneha Desai',
      specialty: 'Consultant Dermatologist',
      experience: '9 yrs exp',
      location: 'SG Highway, Ahmedabad',
      rating: '96%',
      stories: '180 Patient Stories',
      fee: '₹500',
      available: 'Available Today',
    },
    {
      name: 'Dr. Rajesh Sharma',
      specialty: 'Pediatric Specialist',
      experience: '18 yrs exp',
      location: 'Sector 21, Gandhinagar',
      rating: '99%',
      stories: '410 Patient Stories',
      fee: '₹700',
      available: 'Available Tomorrow',
    },
  ];

  const handleInstantTriage = (initialSymptoms?: string) => {
    if (initialSymptoms) {
      setPatientSymptoms(initialSymptoms);
    }
    setShowTriageModal(true);
  };

  const runQuickTriage = () => {
    setTriageLoading(true);

    const text = patientSymptoms.toLowerCase();
    const isEmergency =
      text.includes('chest pain') ||
      text.includes('heart') ||
      text.includes('unconscious') ||
      text.includes('cannot breathe') ||
      text.includes('severe bleeding');

    setTimeout(() => {
      setTriageLoading(false);
      if (isEmergency) {
        setTriageResult({
          urgency: 'EMERGENCY',
          summary:
            'Critical emergency indicator detected. Life-safety protocol triggered. Immediate in-person hospital evaluation or emergency dispatch required.',
          specialty: 'Emergency Medicine / Cardiology',
        });
      } else if (severity === 'Severe' || text.includes('high fever')) {
        setTriageResult({
          urgency: 'URGENT',
          summary:
            'Acute symptoms reported. Priority consultation with a medical specialist recommended within 2-4 hours.',
          specialty: 'General Medicine / Urgent Care',
        });
      } else {
        setTriageResult({
          urgency: 'ROUTINE',
          summary:
            'Symptoms are consistent with non-acute conditions. Routine clinical consultation or video appointment advised.',
          specialty: 'Family Medicine & General Practice',
        });
      }
    }, 800);
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Top Search & Location Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4 flex items-center gap-2 border-b md:border-b-0 md:border-r border-slate-200 pb-2 md:pb-0 md:pr-3">
            <MapPin className="w-5 h-5 text-sky-600 shrink-0" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full text-sm font-medium text-slate-700 focus:outline-none placeholder:text-slate-400"
              placeholder="Enter Location / City"
            />
          </div>
          <div className="md:col-span-6 flex items-center gap-2">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={symptomSearch}
              onChange={(e) => setSymptomSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && symptomSearch.trim()) {
                  handleInstantTriage(symptomSearch);
                }
              }}
              className="w-full text-sm text-slate-700 focus:outline-none placeholder:text-slate-400"
              placeholder="Search doctors, symptoms (e.g. fever, headache, chest pain)..."
            />
          </div>
          <div className="md:col-span-2">
            <button
              onClick={() => handleInstantTriage(symptomSearch || 'General checkup')}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition shadow-sm"
            >
              Check Symptoms
            </button>
          </div>
        </div>
      </div>

      {/* 4 Feature Service Hero Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div
          onClick={() => handleInstantTriage('Need instant video consultation')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-sky-400 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 bg-sky-100 text-sky-700 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <Video className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">
              Instant Video Consult
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Connect with verified doctors within 60 seconds.
            </p>
          </div>
          <div className="mt-5 flex items-center justify-between text-xs font-semibold text-sky-600">
            <span>START CONSULT</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        <div
          onClick={() => {
            const el = document.getElementById('doctors-directory');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">
              Find Doctors Near You
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Confirmed appointments with top certified specialists.
            </p>
          </div>
          <div className="mt-5 flex items-center justify-between text-xs font-semibold text-emerald-600">
            <span>BOOK CLINIC VISIT</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        <div
          onClick={() => handleInstantTriage('Pre-visit automated lab triage')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <FlaskConical className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">
              Smart AI Triage
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              AI pre-screening & urgency estimation before consultation.
            </p>
          </div>
          <div className="mt-5 flex items-center justify-between text-xs font-semibold text-indigo-600">
            <span>FREE HEALTH CHECK</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        <div
          onClick={() => {
            if (!user) navigate('/auth');
            else navigate('/doctor');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-amber-400 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">
              Doctor Care Portal
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Clinician review panel, queue management & e-prescriptions.
            </p>
          </div>
          <div className="mt-5 flex items-center justify-between text-xs font-semibold text-amber-700">
            <span>FOR CLINICIANS</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Consult top doctors by health concern */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Consult top doctors online for any health concern
            </h2>
            <p className="text-sm text-slate-500">
              Private AI-assisted consultations with verified doctors in all specialties
            </p>
          </div>
          <button
            onClick={() => handleInstantTriage('General health assessment')}
            className="text-sm font-semibold text-sky-600 hover:text-sky-700"
          >
            Check all concerns &rarr;
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {specialties.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => handleInstantTriage(`Concern: ${item.title}`)}
                className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-sm transition cursor-pointer flex flex-col items-center text-center group"
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition ${item.color}`}
                >
                  <Icon className="w-7 h-7" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 line-clamp-2 h-8">
                  {item.title}
                </h4>
                <span className="text-[11px] font-semibold text-sky-600 uppercase mt-2">
                  Consult Now
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Book an appointment with verified doctors */}
      <div id="doctors-directory" className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Book an appointment with top specialists
          </h2>
          <p className="text-sm text-slate-500">
            Experience doctors available for in-clinic visits and virtual care
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {doctorsList.map((doc, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {doc.name}
                    </h3>
                    <p className="text-xs text-sky-600 font-medium">
                      {doc.specialty}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {doc.experience}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{doc.location}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700 font-medium pt-1">
                    <span className="text-emerald-600 font-semibold">
                      {doc.rating} Patient Satisfaction
                    </span>
                    <span>Fee: {doc.fee}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {doc.available}
                </span>
                <button
                  onClick={() => {
                    if (!user) {
                      handleInstantTriage(`Booking with ${doc.name}`);
                    } else {
                      navigate('/patient');
                    }
                  }}
                  className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-sm"
                >
                  Book Appointment
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QUICK PRE-VISIT AI TRIAGE MODAL */}
      {showTriageModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    Pre-Visit Smart Triage
                  </h3>
                  <p className="text-xs text-slate-500">
                    No account required for instant AI symptom assessment
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTriageModal(false);
                  setTriageResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2"
              >
                ✕
              </button>
            </div>

            {!triageResult ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Describe your health concern or symptoms *
                  </label>
                  <textarea
                    rows={3}
                    value={patientSymptoms}
                    onChange={(e) => setPatientSymptoms(e.target.value)}
                    placeholder="e.g. Mild throat pain and fever since yesterday, or sharp chest pain..."
                    className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Duration
                    </label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full text-sm p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none"
                    >
                      <option value="Just today">Started today</option>
                      <option value="1-2 days">1-2 days</option>
                      <option value="1 week">About a week</option>
                      <option value="More than a week">Over a week</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Severity
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      className="w-full text-sm p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none"
                    >
                      <option value="Mild">Mild / Tolerable</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Severe">Severe / Acute</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={runQuickTriage}
                  disabled={!patientSymptoms.trim() || triageLoading}
                  className="w-full mt-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-3 rounded-xl transition text-sm disabled:opacity-50"
                >
                  {triageLoading
                    ? 'AI Analyzing Symptoms (Claude 3.5)...'
                    : 'Analyze Urgency & Recommend Care'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <AIAdvisoryBanner
                  urgency={triageResult.urgency}
                  summary={triageResult.summary}
                  isEmergency={triageResult.urgency === 'EMERGENCY'}
                />

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Suggested Care Path:</span>
                    <span className="font-semibold text-slate-800">
                      {triageResult.specialty}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Clinical Review:</span>
                    <span className="font-semibold text-sky-700">
                      Pending Doctor Confirmation
                    </span>
                  </div>
                </div>

                {user ? (
                  <button
                    onClick={() => {
                      setShowTriageModal(false);
                      navigate('/patient');
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl transition text-sm"
                  >
                    View in Patient Portal
                  </button>
                ) : (
                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setShowTriageModal(false);
                        navigate('/auth');
                      }}
                      className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 rounded-xl transition text-sm"
                    >
                      Save Case & Sign In / Register
                    </button>
                    <button
                      onClick={() => {
                        setShowTriageModal(false);
                        setTriageResult(null);
                      }}
                      className="w-full text-slate-500 hover:text-slate-700 font-medium py-2 text-xs"
                    >
                      Continue browsing as Guest
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
