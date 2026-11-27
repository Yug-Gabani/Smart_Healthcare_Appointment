import { useState } from 'react';
import { ChatWidget } from './features/chatbot';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'doctors' | 'services' | 'triage'>('home');
  const [authToken, setAuthToken] = useState<string | undefined>();
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  const handleQuickLogin = async (email: string) => {
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'patient123' }) });
      if (res.ok) { const data = await res.json(); setAuthToken(data.access_token); setCurrentUser(data.full_name); }
    } catch (e) { console.error('Quick login failed:', e); }
  };
  const handleLogout = () => { setAuthToken(undefined); setCurrentUser(null); };
  const tabs = [{ id: 'home', label: 'Overview', icon: '⌂' }, { id: 'doctors', label: 'Find Doctors', icon: '♧' }, { id: 'services', label: 'Care Services', icon: '▣' }, { id: 'triage', label: 'AI Triage', icon: '⚕' }] as const;

  return (
    <div className="min-h-screen flex flex-col bg-[#eaf6f3] text-[#103f3b] font-sans">
      <header className="sticky top-0 z-40 border-b border-[#e4ebf3] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[66px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <button onClick={() => setActiveTab('home')} className="flex items-center gap-2.5" aria-label="PulseCare home">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0e8177] text-lg font-bold text-white">✚</span>
            <span className="text-[19px] font-extrabold tracking-tight">PulseCare</span>
          </button>
          <nav className="hidden items-center gap-7 md:flex">
            {tabs.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 text-[13px] font-medium transition hover:text-[#0789cb] ${activeTab === tab.id ? 'text-[#0789cb]' : 'text-[#53647c]'}`}><span>{tab.icon}</span>{tab.label}</button>)}
          </nav>
          <div className="flex items-center gap-3">
            {currentUser ? <><span className="hidden text-xs text-slate-600 sm:inline">{currentUser}</span><button onClick={handleLogout} className="rounded-lg border border-[#0789cb] px-3.5 py-2 text-xs font-semibold text-[#0789cb]">Sign Out</button></> : <><span className="hidden text-xs text-slate-500 lg:inline">Healthcare Providers?</span><button onClick={() => handleQuickLogin('john.doe@example.com')} className="rounded-lg border border-[#0789cb] px-3.5 py-2 text-xs font-semibold text-[#0789cb] transition hover:bg-sky-50" title="Demo login as patient John Doe">Login / Signup</button></>}
          </div>
        </div>
        <nav className="flex gap-5 overflow-x-auto border-t border-slate-100 px-5 py-2 md:hidden">{tabs.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="whitespace-nowrap text-xs font-medium text-slate-600">{tab.icon} {tab.label}</button>)}</nav>
      </header>

      <main className="mx-auto w-full max-w-[1240px] flex-1 space-y-10 px-5 py-8 lg:px-8 lg:py-10">
        <section className="rounded-[28px] bg-[radial-gradient(ellipse_at_center,_#d9f0e9_0%,_#eaf6f3_70%)] px-5 py-9 sm:py-12">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <span className="mb-4 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold tracking-wide text-[#ff6e62] shadow-sm">✓ &nbsp; VERIFIED BY DOCTORS</span>
            <h1 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-[42px]">Care that starts before the appointment.</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#63817c]">Book a doctor, explore what’s bothering you, and get seen faster when it matters.</p>
            <button onClick={() => setActiveTab('doctors')} className="mt-6 rounded-full bg-[#0e8177] px-7 py-3 text-xs font-bold text-white shadow-sm">⌖ Ahmedabad　⌕ Search hospitals　→</button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[['▣','Accredited Specialists','Board-certified care across five departments','bg-sky-100 text-sky-700'],['⚡','Emergency-First Triage','Urgent symptoms routed to immediate care','bg-emerald-100 text-emerald-700'],['✚','Grounded Guidance','Responses supported by verified sources','bg-violet-100 text-violet-700'],['♡','Patient-Centered','Personalized help for your next care step','bg-amber-100 text-amber-700']].map(([icon,title,desc,color])=><article key={title} className="rounded-2xl border border-[#e3ebf3] bg-white p-4 shadow-sm sm:p-5"><span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-lg ${color}`}>{icon}</span><h2 className="text-sm font-bold">{title}</h2><p className="mt-1.5 text-[11px] leading-4 text-slate-500">{desc}</p></article>)}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold tracking-tight">Explore care by specialty</h2><p className="mt-1 text-xs text-slate-500">Start with a health concern and find the right care</p></div><button onClick={() => setActiveTab('services')} className="shrink-0 text-xs font-semibold text-[#0789cb]">View services →</button></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{[['⌁','Cold, Cough & Fever','text-blue-600 bg-blue-50'],['✧','Acne & Skin Issues','text-emerald-600 bg-emerald-50'],['♡','Women’s Health','text-rose-600 bg-rose-50'],['♧','Mental Wellness','text-violet-600 bg-violet-50'],['☺','Child Health','text-amber-600 bg-amber-50'],['☻','Dental Care','text-teal-600 bg-teal-50']].map(([icon,label,color])=><button key={label} onClick={() => setActiveTab('triage')} className="flex min-h-[116px] flex-col items-center justify-center rounded-xl border border-[#e3ebf3] bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200"><span className={`mb-2 flex h-11 w-11 items-center justify-center rounded-xl text-xl ${color}`}>{icon}</span><span className="text-center text-[11px] font-bold">{label}</span><span className="mt-2 text-[9px] font-semibold text-[#0789cb]">EXPLORE CARE</span></button>)}</div>
        </section>

        <section>
          <div className="mb-4"><h2 className="text-xl font-extrabold tracking-tight">Meet our specialists</h2><p className="mt-1 text-xs text-slate-500">Explore our verified, on-duty medical staff</p></div>
          <div className="grid gap-4 md:grid-cols-3">{[['Dr. Sarah Smith','Cardiology','MD, FACC · Harvard Medical School','Mon–Fri · 9:00–16:00','bg-sky-100 text-sky-700'],['Dr. David Chen','Neurology','MD, PhD · Johns Hopkins University','Mon–Thu · 10:00–17:00','bg-violet-100 text-violet-700'],['Dr. Priya Patel','Pediatrics','MBBS, MD · Stanford Health Care','Tue–Sat · 8:30–15:30','bg-emerald-100 text-emerald-700']].map(([name,dept,qual,hours,color])=><article key={name} className="rounded-2xl border border-[#e3ebf3] bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${color}`}>♧</span><div><h3 className="text-sm font-bold">{name}</h3><p className="mt-0.5 text-[11px] font-medium text-[#0789cb]">{dept}</p></div></div><p className="mt-4 text-xs text-slate-500">{qual}</p><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-500"><span>◷ {hours}</span><span className="font-semibold text-emerald-600">Available</span></div></article>)}</div>
        </section>
      </main>
      <footer className="mt-4 border-t border-[#e3ebf3] bg-white px-5 py-5 text-center text-[11px] text-slate-500"><p>© 2026 PulseCare Healthcare System. All rights reserved.</p><p className="mt-1 text-slate-400">For medical emergencies, call 911 or visit your nearest Emergency Department.</p></footer>
      <ChatWidget authToken={authToken} />
    </div>
  );
}
