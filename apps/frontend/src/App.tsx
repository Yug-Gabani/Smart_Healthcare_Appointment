// Implements: FR-01, FR-03, FR-16
// Safety:    S1
// Owner:     frontend (Group 6)

import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { AuthPage } from '@/routes/auth/AuthPage';
import { PatientPortal } from '@/routes/patient/PatientPortal';
import { DoctorQueue } from '@/routes/doctor/DoctorQueue';
import { LandingPage } from '@/routes/patient/LandingPage';
import { Activity, Stethoscope, Video, FlaskConical } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const NavigationBar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
        {/* Brand & Main Practo-style links */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-sky-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl text-slate-900 tracking-tight">
              Pulse<span className="text-sky-600">Care</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700">
            <Link
              to="/"
              className="hover:text-sky-600 transition flex items-center gap-1.5"
            >
              <Stethoscope className="w-4 h-4 text-slate-400" />
              Find Doctors
            </Link>
            <Link
              to="/"
              className="hover:text-sky-600 transition flex items-center gap-1.5"
            >
              <Video className="w-4 h-4 text-slate-400" />
              Video Consult
            </Link>
            <Link
              to="/"
              className="hover:text-sky-600 transition flex items-center gap-1.5"
            >
              <FlaskConical className="w-4 h-4 text-slate-400" />
              AI Triage
            </Link>
          </nav>
        </div>

        {/* Right action bar: Sign in / Out & Role Portals */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              {user.role === 'DOCTOR' && (
                <Link
                  to="/doctor"
                  className="text-xs bg-sky-50 text-sky-700 border border-sky-200 font-semibold px-3 py-1.5 rounded-lg hover:bg-sky-100 transition"
                >
                  Doctor Queue
                </Link>
              )}
              {user.role === 'PATIENT' && (
                <Link
                  to="/patient"
                  className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition"
                >
                  My Appointments
                </Link>
              )}
              <span className="text-xs text-slate-500 hidden sm:inline">
                {user.email}
              </span>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="text-xs font-semibold text-slate-500 hover:text-red-600 transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 hidden lg:inline">
                Healthcare Providers?
              </span>
              <Link
                to="/auth"
                className="border border-sky-600 text-sky-600 hover:bg-sky-50 font-semibold text-xs sm:text-sm px-4 py-2 rounded-xl transition"
              >
                Login / Signup
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen flex flex-col bg-slate-50">
          <NavigationBar />

          <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/patient" element={<PatientPortal />} />
              <Route path="/doctor" element={<DoctorQueue />} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
};
