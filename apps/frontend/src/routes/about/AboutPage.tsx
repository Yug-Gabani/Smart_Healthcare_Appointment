// Implements: About section & Project details
// Owner:     Group 6 (IT314 - Software Engineering)

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Brain,
  Video,
  Users,
  ArrowRight,
  Stethoscope,
  HeartHandshake,
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  const teamMembers = [
    { name: 'Yug Gabani' },
    { name: 'Kush Hingrajiya' },
    { name: 'Dev Sanghani' },
    { name: 'Vivek Amipara' },
    { name: 'Parag Bera' },
    { name: 'Darsh Valand' },
    { name: 'Abhibrata Sarkar' },
    { name: 'Hari Patel' },
    { name: 'Vikas Bhabhor' },
  ];

  const highlights = [
    {
      icon: Stethoscope,
      title: 'Doctor Discovery & Booking',
      desc: 'Seamless appointments across leading verified specialists with instant slot confirmation.',
      color: 'bg-sky-50 text-sky-600',
    },
    {
      icon: Video,
      title: 'HD Video Consultations',
      desc: 'Connect remotely with physicians from home with secure, real-time video sessions.',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      icon: Brain,
      title: 'AI Advisory Triage',
      desc: 'Smart urgency estimation powered by modern LLMs to help prioritize critical patient needs.',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      icon: HeartHandshake,
      title: 'Doctor In-the-Loop',
      desc: 'AI suggestions are strictly advisory; licensed physicians always review and confirm care paths.',
      color: 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div className="pb-16 max-w-5xl mx-auto space-y-12">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-900 via-slate-900 to-sky-950 text-white p-8 sm:p-12 shadow-xl border border-sky-800/40">
        <div className="relative z-10 max-w-2xl space-y-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Smart Healthcare Appointment & Triage System
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            PulseCare bridges the gap between patient symptoms and professional medical care.
            Combining intuitive appointment booking with AI-assisted pre-consultation triage,
            our goal is to streamline healthcare workflows while keeping doctors in full control.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm shadow-md"
            >
              Book an Appointment
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm border border-white/20"
            >
              Sign In to Portal
            </Link>
          </div>
        </div>
      </div>

      {/* Mission & Key Highlights */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">What PulseCare Does</h2>
          <p className="text-sm text-slate-500 mt-1">
            Engineered for high reliability, responsiveness, and clinical safety.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {highlights.map((item, idx) => (
            <div
              key={idx}
              className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition flex items-start gap-4"
            >
              <div className={`p-3 rounded-xl shrink-0 ${item.color}`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">{item.title}</h3>
                <p className="text-slate-600 text-xs sm:text-sm mt-1 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Engineering Team */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-sky-600" />
              Engineering Team
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Built with care by Group 6 students for the IT314 Software Engineering project.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {teamMembers.map((member, idx) => (
            <div
              key={idx}
              className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-sky-300 transition flex items-center gap-3.5"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm">
                {member.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 text-sm truncate">{member.name}</h4>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
