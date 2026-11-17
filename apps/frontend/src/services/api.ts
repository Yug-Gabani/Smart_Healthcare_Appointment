import type {
  AdminAppointmentItem,
  AdminOverviewData,
  AdminPaymentItem,
  Appointment,
  Attachment,
  ConsultationType,
  Doctor,
  DoctorMe,
  DoctorReview,
  DoctorStatus,
  Hospital,
  PatientProfile,
  PharmacyOrder,
  PharmacyOrderStatus,
  Prescription,
  PrescriptionItem,
  ConsultationSession,
  ConsultationSignalMessage,
  ConsultationEndRequest,
  DoctorReviewSummaryRequest,
  QueueAdvisorResponse,
  Role,
  ScheduleTemplate,
  Slot,
  TriageAssessment,
  User,
  Medicine,
  MedicineCategory,
  Cart,
  CommerceOrder,
  PharmacyCheckoutResponse,
} from '../types';

export interface TokenResponseData {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn?: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
  };
}

const RAW_API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';
const API_BASE = RAW_API ? (RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`) : '/api';

function getToken(): string | null {
  return localStorage.getItem('pulsecare_token');
}

// --------------------------------------------------------------------------
// Silent refresh-on-401
//
// Access tokens expire after ~15 minutes. Without this, every request after
// that window gets a 401, UIs throw "unauthorized", and the user ends up
// back at /login mid-booking. To avoid that we intercept 401s here, swap
// the stored refresh token for a fresh access token via /auth/refresh, and
// transparently replay the original request.
//
// `refreshPromise` deduplicates concurrent 401s — if 5 API calls hit a
// stale token at once we only run one refresh, everyone else awaits it.
// `isRetry` guards against infinite loops: a 401 on the retry is treated
// as a real auth failure (user needs to log in again).
// --------------------------------------------------------------------------
let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem('pulsecare_refresh');
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      // Refresh token itself is dead; wipe session so user sees /login cleanly.
      localStorage.removeItem('pulsecare_token');
      localStorage.removeItem('pulsecare_refresh');
      localStorage.removeItem('pulsecare_user');
      return null;
    }
    const json = await res.json();
    const data = json?.data ?? json;
    if (data?.accessToken) {
      localStorage.setItem('pulsecare_token', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('pulsecare_refresh', data.refreshToken);
      }
      if (data.user) {
        localStorage.setItem('pulsecare_user', JSON.stringify(data.user));
      }
      return data.accessToken as string;
    }
    return null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // 401 on a request that had a token AND wasn't already a retry attempt:
  // try a silent refresh and replay. Skip for auth endpoints themselves.
  if (res.status === 401 && !isRetry && token && !path.startsWith('/auth/')) {
    if (!refreshPromise) {
      refreshPromise = performRefresh().finally(() => { refreshPromise = null; });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      return request<T>(path, init, true);
    }
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};

  if (!res.ok) {
    let message = json.message || json.error || res.statusText || 'Request failed';
    if (json.fieldErrors && Array.isArray(json.fieldErrors) && json.fieldErrors.length > 0) {
      const first = json.fieldErrors[0];
      message = `${first.field}: ${first.message}`;
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  // Backend wraps everything in ApiResponse { success, data, message, timestamp }
  return (json?.data ?? json) as T;
}

export const authApi = {
  async login(email: string, password: string): Promise<TokenResponseData> {
    return request<TokenResponseData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role: Role;
    // doctor-only
    specialty?: string;
    hospitalName?: string;
    hospitalId?: string;
    registrationNumber?: string;
  }): Promise<TokenResponseData> {
    return request<TokenResponseData>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMe(_accessToken?: string): Promise<User> {
    return request<User>('/auth/me');
  },

  async requestPasswordReset(email: string): Promise<void> {
    // The server intentionally returns the same success response whether or not the
    // email is registered, so we don't branch on the body here.
    await request<null>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    await request<null>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  },

  async logout(_accessToken?: string): Promise<void> {
    const token = getToken();
    if (token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* silent */
      }
    }
    localStorage.removeItem('pulsecare_token');
    localStorage.removeItem('pulsecare_refresh');
    localStorage.removeItem('pulsecare_user');
  },

  saveAuth(data: TokenResponseData) {
    localStorage.setItem('pulsecare_token', data.accessToken);
    localStorage.setItem('pulsecare_refresh', data.refreshToken);
    localStorage.setItem('pulsecare_user', JSON.stringify(data.user));
  },

  getSavedAuth(): { token: string | null; user: User | null } {
    const token = localStorage.getItem('pulsecare_token');
    const userStr = localStorage.getItem('pulsecare_user');
    let user: User | null = null;
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch {
        user = null;
      }
    }
    return { token, user };
  },

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'probe@probe.com', password: 'probe' }),
      });
      return res.status === 401 || res.status === 200;
    } catch {
      return false;
    }
  },
};

export const doctorsApi = {
  list: (specialty?: string, hospitalId?: string): Promise<Doctor[]> => {
    const params = new URLSearchParams();
    if (specialty) params.set('specialty', specialty);
    if (hospitalId) params.set('hospitalId', hospitalId);
    const qs = params.toString();
    return request<Doctor[]>(`/v1/doctors${qs ? `?${qs}` : ''}`);
  },
  get: (id: string): Promise<Doctor> => request<Doctor>(`/v1/doctors/${id}`),
  slots: (id: string): Promise<Slot[]> => request<Slot[]>(`/v1/doctors/${id}/slots`),
};

export interface SlotHoldResponse {
  slotId: string;
  success: boolean;
  heldByYou: boolean;
  remainingHoldSeconds: number;
  message: string;
}

export const slotsApi = {
  hold: (slotId: string, holdTtlSeconds: number = 600): Promise<SlotHoldResponse> =>
    request<SlotHoldResponse>(`/v1/slots/${slotId}/hold`, {
      method: 'POST',
      body: JSON.stringify({ holdTtlSeconds }),
    }),
  release: (slotId: string): Promise<boolean> =>
    request<boolean>(`/v1/slots/${slotId}/hold`, { method: 'DELETE' }),
  status: (slotId: string): Promise<{ onHold: boolean; heldByYou: boolean; remainingSeconds: number }> =>
    request<{ onHold: boolean; heldByYou: boolean; remainingSeconds: number }>(`/v1/slots/${slotId}/hold-status`),
};

/** Public (no auth) hospital search for the landing page. */
export const publicHospitalsApi = {
  search: (opts: { q?: string; city?: string; limit?: number } = {}): Promise<Hospital[]> => {
    const params = new URLSearchParams();
    if (opts.q)     params.set('q', opts.q);
    if (opts.city)  params.set('city', opts.city);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return fetch(`/api/v1/hospitals/public/search${qs ? `?${qs}` : ''}`)
      .then(r => r.json())
      .then(j => (j?.data ?? []) as Hospital[]);
  },
  get: (id: string): Promise<Hospital> =>
    fetch(`/api/v1/hospitals/public/${id}`)
      .then(r => r.json())
      .then(j => j.data as Hospital),
};

export const hospitalsApi = {
  search: (opts: { q?: string; state?: string; city?: string; specialty?: string; limit?: number } = {}): Promise<Hospital[]> => {
    const params = new URLSearchParams();
    if (opts.q)         params.set('q', opts.q);
    if (opts.state)     params.set('state', opts.state);
    if (opts.city)      params.set('city', opts.city);
    if (opts.specialty) params.set('specialty', opts.specialty);
    if (opts.limit)     params.set('limit', String(opts.limit));
    const qs = params.toString();
    return request<Hospital[]>(`/v1/hospitals${qs ? `?${qs}` : ''}`);
  },
  get: (id: string): Promise<Hospital> => request<Hospital>(`/v1/hospitals/${id}`),
  states: (): Promise<string[]> => request<string[]>('/v1/hospitals/states'),
  cities: (state?: string): Promise<string[]> =>
    request<string[]>(`/v1/hospitals/cities${state ? `?state=${encodeURIComponent(state)}` : ''}`),
};

export const profileApi = {
  get: (): Promise<PatientProfile> => request<PatientProfile>('/v1/users/me/profile'),
  update: (body: Partial<Omit<PatientProfile, 'id' | 'email'>>): Promise<PatientProfile> =>
    request<PatientProfile>('/v1/users/me/profile', { method: 'PUT', body: JSON.stringify(body) }),
};

export interface TriageRequestBody {
  chiefComplaint: string;
  symptoms: string[];
  durationDays: number;
  painLevel: number;
  fever: boolean;
  chestPain: boolean;
  shortnessOfBreath: boolean;
}

export const triageApi = {
  assess: (body: TriageRequestBody): Promise<TriageAssessment> =>
    request<TriageAssessment>('/v1/triage/assess', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export interface BookAppointmentBody {
  doctorId: string;
  slotId: string;
  assessmentId?: string;
  consultationType: ConsultationType;
  attachmentIds?: string[];
}

export type DoctorAction =
  | 'ACCEPT'
  | 'START'
  | 'COMPLETE'
  | 'NO_SHOW'
  | 'OVERRIDE_URGENCY';

export interface PatchAppointmentBody {
  action: DoctorAction;
  urgency?: 'EMERGENCY' | 'URGENT' | 'ROUTINE';
  reason?: string;
  notes?: string;
}

export const appointmentsApi = {
  book: (body: BookAppointmentBody): Promise<Appointment> =>
    request<Appointment>('/v1/appointments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  mine: (): Promise<Appointment[]> => request<Appointment[]>('/v1/appointments/me'),
  get: (id: string): Promise<Appointment> => request<Appointment>(`/v1/appointments/${id}`),
  cancel: (id: string): Promise<Appointment> =>
    request<Appointment>(`/v1/appointments/${id}/cancel`, { method: 'PATCH' }),
  reschedule: (id: string, newSlotId: string): Promise<Appointment> =>
    request<Appointment>(`/v1/appointments/${id}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({ newSlotId }),
    }),
  bookFollowUp: (body: {
    originalAppointmentId: string;
    slotId: string;
    consultationType: ConsultationType;
  }): Promise<Appointment> =>
    request<Appointment>('/v1/appointments/follow-up', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  doctorQueue: (scope: 'active' | 'past' | 'all' = 'active'): Promise<Appointment[]> =>
    request<Appointment[]>(`/v1/appointments/queue?scope=${scope}`),
  doctorAction: (id: string, body: PatchAppointmentBody): Promise<Appointment> =>
    request<Appointment>(`/v1/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export interface CreatePrescriptionBody {
  appointmentId: string;
  notes?: string;
  followUpAfterDays?: number;
  followUpNotes?: string;
  items: PrescriptionItem[];
}
export interface UpdatePrescriptionBody {
  notes?: string;
  followUpAfterDays?: number;
  followUpNotes?: string;
  items: PrescriptionItem[];
}

export const prescriptionsApi = {
  create: (body: CreatePrescriptionBody): Promise<Prescription> =>
    request<Prescription>('/v1/prescriptions', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UpdatePrescriptionBody): Promise<Prescription> =>
    request<Prescription>(`/v1/prescriptions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  sign: (id: string): Promise<Prescription> =>
    request<Prescription>(`/v1/prescriptions/${id}/sign`, { method: 'POST' }),
  voidRx: (id: string, reason: string): Promise<Prescription> =>
    request<Prescription>(`/v1/prescriptions/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  deleteDraft: (id: string): Promise<Prescription> =>
    request<Prescription>(`/v1/prescriptions/${id}`, { method: 'DELETE' }),
  mine: (): Promise<Prescription[]> => request<Prescription[]>('/v1/prescriptions/me'),
  listForAppointment: (appointmentId: string): Promise<Prescription[]> =>
    request<Prescription[]>(`/v1/prescriptions?appointmentId=${appointmentId}`),
  get: (id: string): Promise<Prescription> => request<Prescription>(`/v1/prescriptions/${id}`),
  pdfUrl: (id: string): string => `/api/v1/prescriptions/${id}/pdf`,
};

// ---------- Doctor's own profile + schedule ----------

export const doctorProfileApi = {
  me: (): Promise<DoctorMe> => request<DoctorMe>('/v1/doctors/me'),
  update: (body: {
    fullName?: string;
    specialty?: string;
    hospitalName?: string;
    hospitalId?: string;
    registrationNumber?: string;
    yearsExperience?: number;
    consultationFee?: number;
    languages?: string;
    bio?: string;
    avatarUrl?: string;
  }): Promise<DoctorMe> =>
    request<DoctorMe>('/v1/doctors/me', { method: 'PUT', body: JSON.stringify(body) }),
  resubmit: (): Promise<DoctorMe> =>
    request<DoctorMe>('/v1/doctors/me/resubmit', { method: 'POST' }),
  replaceSchedule: (templates: Omit<ScheduleTemplate, 'id'>[]): Promise<DoctorMe> =>
    request<DoctorMe>('/v1/doctors/me/schedule', {
      method: 'PUT',
      body: JSON.stringify({ templates }),
    }),
  addSlot: (slotAt: string): Promise<Slot> =>
    request<Slot>('/v1/doctors/me/slots', { method: 'POST', body: JSON.stringify({ slotAt }) }),
  deleteSlot: (slotId: string): Promise<void> =>
    request<void>(`/v1/doctors/me/slots/${slotId}`, { method: 'DELETE' }),
};

// ---------- Admin — doctor verification ----------

// ---------- Pharmacy orders ----------

export const pharmacyApi = {
  listByStatus: (status: PharmacyOrderStatus = 'NEW'): Promise<PharmacyOrder[]> =>
    request<PharmacyOrder[]>(`/v1/pharmacy/orders?status=${status}`),
  get: (id: string): Promise<PharmacyOrder> =>
    request<PharmacyOrder>(`/v1/pharmacy/orders/${id}`),
  dispense: (id: string): Promise<PharmacyOrder> =>
    request<PharmacyOrder>(`/v1/pharmacy/orders/${id}/dispense`, { method: 'POST' }),
  pickup: (id: string): Promise<PharmacyOrder> =>
    request<PharmacyOrder>(`/v1/pharmacy/orders/${id}/pick-up`, { method: 'POST' }),
  cancel: (id: string, reason?: string): Promise<PharmacyOrder> =>
    request<PharmacyOrder>(`/v1/pharmacy/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? null }),
    }),
};

export const patientOrdersApi = {
  listMine: (): Promise<PharmacyOrder[]> => request<PharmacyOrder[]>('/v1/me/orders'),
  create: (prescriptionId: string): Promise<PharmacyOrder> =>
    request<PharmacyOrder>('/v1/me/orders', {
      method: 'POST',
      body: JSON.stringify({ prescriptionId }),
    }),
  cancel: (orderId: string, reason?: string): Promise<PharmacyOrder> =>
    request<PharmacyOrder>(`/v1/me/orders/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? null }),
    }),
};

export const adminDoctorsApi = {
  list: (status?: DoctorStatus | 'ALL'): Promise<DoctorMe[]> => {
    const query = status && status !== 'ALL' ? `?status=${status}` : '';
    return request<DoctorMe[]>(`/v1/admin/doctors${query}`);
  },
  approve: (id: string): Promise<DoctorMe> =>
    request<DoctorMe>(`/v1/admin/doctors/${id}/approve`, { method: 'POST' }),
  reject: (id: string, reason: string): Promise<DoctorMe> =>
    request<DoctorMe>(`/v1/admin/doctors/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  suspend: (id: string, reason: string): Promise<DoctorMe> =>
    request<DoctorMe>(`/v1/admin/doctors/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  reinstate: (id: string): Promise<DoctorMe> =>
    request<DoctorMe>(`/v1/admin/doctors/${id}/reinstate`, { method: 'POST' }),
};

// ---------- Admin — Platform Dashboard & Finance Operations ----------

export const adminApi = {
  getOverview: (): Promise<AdminOverviewData> =>
    request<AdminOverviewData>('/v1/admin/overview'),
  getAppointments: (): Promise<AdminAppointmentItem[]> =>
    request<AdminAppointmentItem[]>('/v1/admin/appointments'),
  getPayments: (): Promise<AdminPaymentItem[]> =>
    request<AdminPaymentItem[]>('/v1/admin/payments'),
};

// ---------- Files & Medical Attachments ----------

export const filesApi = {
  upload: async (
    file: File,
    category: 'SYMPTOM_IMAGE' | 'PRIOR_PRESCRIPTION' | 'LAB_REPORT' | 'OTHER' = 'SYMPTOM_IMAGE',
    assessmentId?: string,
    appointmentId?: string
  ): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    if (assessmentId) formData.append('assessmentId', assessmentId);
    if (appointmentId) formData.append('appointmentId', appointmentId);

    const token = localStorage.getItem('pulsecare_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/v1/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      let errMsg = 'File upload failed';
      try {
        const j = await res.json();
        if (j.message) errMsg = j.message;
      } catch {}
      throw new Error(errMsg);
    }
    const json = await res.json();
    return json.data as Attachment;
  },
  myAttachments: (): Promise<Attachment[]> => request<Attachment[]>('/v1/files/my'),
};

// ---------- Doctor Reviews & Ratings ----------

export interface CreateReviewBody {
  rating: number;
  comment?: string;
  tags?: string;
  isAnonymous?: boolean;
}

export const reviewsApi = {
  submit: (appointmentId: string, body: CreateReviewBody): Promise<DoctorReview> =>
    request<DoctorReview>(`/v1/appointments/${appointmentId}/review`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getForAppointment: (appointmentId: string): Promise<DoctorReview | null> =>
    request<DoctorReview | null>(`/v1/appointments/${appointmentId}/review`),
  getForDoctor: (doctorId: string): Promise<DoctorReview[]> =>
    request<DoctorReview[]>(`/v1/reviews/doctors/${doctorId}`),
  landing: (limit: number = 6): Promise<DoctorReview[]> =>
    request<DoctorReview[]>(`/v1/reviews/landing?limit=${limit}`),
};

// ---------- Privacy & Compliance (GDPR / HIPAA) ----------

export const complianceApi = {
  exportData: async (): Promise<void> => {
    const token = localStorage.getItem('pulsecare_token');
    const res = await fetch(`${API_BASE}/v1/compliance/export`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error('Data export failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulsecare-health-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  deleteAccount: (): Promise<string> =>
    request<string>('/v1/compliance/account', { method: 'DELETE' }),
};

// ---------- Video Consultations & WebRTC Signaling ----------

export const consultationsApi = {
  getSession: (appointmentId: string): Promise<ConsultationSession> =>
    request<ConsultationSession>(`/v1/consultations/appointments/${appointmentId}`),

  start: (appointmentId: string): Promise<ConsultationSession> =>
    request<ConsultationSession>(`/v1/consultations/appointments/${appointmentId}/start`, {
      method: 'POST',
    }),

  end: (appointmentId: string, data?: ConsultationEndRequest): Promise<ConsultationSession> =>
    request<ConsultationSession>(`/v1/consultations/appointments/${appointmentId}/end`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),

  sendSignal: (
    appointmentId: string,
    message: { type: string; payload: string }
  ): Promise<string> =>
    request<string>(`/v1/consultations/appointments/${appointmentId}/signal`, {
      method: 'POST',
      body: JSON.stringify(message),
    }),

  pollSignals: (
    appointmentId: string,
    since: number = 0
  ): Promise<ConsultationSignalMessage[]> =>
    request<ConsultationSignalMessage[]>(
      `/v1/consultations/appointments/${appointmentId}/signals?since=${since}`
    ),

  reviewSummary: (
    appointmentId: string,
    data: DoctorReviewSummaryRequest
  ): Promise<ConsultationSession> =>
    request<ConsultationSession>(`/v1/consultations/appointments/${appointmentId}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateConsent: (
    appointmentId: string,
    consent: boolean = true
  ): Promise<ConsultationSession> =>
    request<ConsultationSession>(
      `/v1/consultations/appointments/${appointmentId}/consent?consent=${consent}`,
      {
        method: 'POST',
      }
    ),
};

// ---------- AI Clinical Queue Advisor ----------

export const aiAdvisorApi = {
  getQueueAdvice: async (payload: {
    doctor_name: string;
    queue: Array<{
      id: string;
      patient_id?: string;
      patient_name: string;
      chief_complaint?: string;
      urgency: string;
      confidence?: number;
      slot?: string;
      mode?: string;
    }>;
  }): Promise<QueueAdvisorResponse> => {
    try {
      const res = await fetch('/ai/queue-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      // Deterministic fallback if ai-service port is offline or not yet started
      const queue = payload.queue || [];
      const emgCount = queue.filter(q => q.urgency === 'EMG' || q.urgency === 'EMERGENCY').length;
      const urgCount = queue.filter(q => q.urgency === 'URG' || q.urgency === 'URGENT').length;
      const rtnCount = queue.filter(q => q.urgency === 'RTN' || q.urgency === 'ROUTINE').length;

      const priorityOrder = [...queue].sort((a, b) => {
        const rank: Record<string, number> = { EMG: 0, EMERGENCY: 0, URG: 1, URGENT: 1, RTN: 2, ROUTINE: 2 };
        return (rank[a.urgency] ?? 2) - (rank[b.urgency] ?? 2);
      });

      const topEmg = priorityOrder.find(q => q.urgency === 'EMG' || q.urgency === 'EMERGENCY');

      return {
        overall_assessment: emgCount > 0
          ? `High alert: ${emgCount} emergency and ${urgCount} urgent case(s) detected in current queue.`
          : urgCount > 0
          ? `Moderate triage workload: ${urgCount} urgent case(s) identified.`
          : 'Queue is clinically stable. All patients are routine reviews.',
        priority_recommendation: topEmg
          ? `Immediate evaluation recommended: Prioritize ${topEmg.patient_name} (${topEmg.patient_id}) presenting with '${topEmg.chief_complaint}'.`
          : urgCount > 0
          ? `Attend to urgent patient ${priorityOrder[0]?.patient_name} before routine appointments.`
          : 'Follow standard slot timetable. No emergency escalations detected.',
        suggested_order_ids: priorityOrder.map(q => q.id),
        emergency_count: emgCount,
        urgent_count: urgCount,
        routine_count: rtnCount,
        clinical_alerts: topEmg
          ? [`🚨 Immediate Emergency: ${topEmg.patient_name} - ${topEmg.chief_complaint}`]
          : [],
      };
    }
  },
};

// ---------- Payments & Razorpay Gateway ----------

export interface CreatePaymentOrderBody {
  amountPaise: number;
  patientName?: string;
  patientEmail?: string;
  patientPhone?: string;
  doctorId?: string;
  patientId?: string;
  appointmentId?: string;
  slotTime?: string;
}

export interface CreatePaymentOrderResponse {
  paymentOrderId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  receipt: string;
  status: string;
}

export interface VerifyPaymentBody {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyPaymentResponse {
  status: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}

export interface NotificationAuditLog {
  id: string;
  orderId: string;
  appointmentId?: string;
  channel: 'KAFKA' | 'EMAIL' | 'WHATSAPP' | 'DLQ' | 'REFUND';
  recipient?: string;
  status: 'QUEUED' | 'DISPATCHED' | 'DELIVERED' | 'FAILED' | 'DLQ_ROUTED' | 'PROCESSED';
  details?: string;
  retryCount: number;
  createdAt: string;
  completedAt?: string;
}

export type RefundTier = 'FULL_100' | 'PARTIAL_50' | 'PARTIAL_25' | 'NO_REFUND_0' | 'FREE_CONSULTATION';

export interface RefundPreviewResponse {
  appointmentId: string;
  doctorName?: string;
  slotAt: string;
  hoursRemaining: number;
  tier: RefundTier;
  refundPercentage: number;
  originalAmountPaise: number;
  refundAmountPaise: number;
  retentionAmountPaise: number;
  policyMessage: string;
  eligibleForRefund: boolean;
  canCancel: boolean;
  currentAppointmentStatus: string;
  paymentStatus: string;
  razorpayPaymentId?: string;
  simulatedNotice?: string;
}

export interface CancelAndRefundBody {
  reason?: string;
  simulatedHoursRemaining?: number;
}

export interface CancelAndRefundResponse {
  appointmentId: string;
  appointmentStatus: string;
  refundId?: string;
  razorpayPaymentId?: string;
  originalAmountPaise: number;
  refundAmountPaise: number;
  retentionAmountPaise: number;
  refundPercentage: number;
  tier: RefundTier;
  refundStatus: string;
  policyMessage: string;
  slotAt: string;
  cancelledAt: string;
  hoursRemaining: number;
}

export interface PaymentRefund {
  id: string;
  paymentOrderId?: string;
  appointmentId?: string;
  patientId: string;
  razorpayPaymentId?: string;
  razorpayRefundId?: string;
  originalAmountPaise: number;
  refundAmountPaise: number;
  retentionAmountPaise: number;
  refundPercentage: number;
  tier: string;
  status: string;
  hoursBeforeSlot?: number;
  policyMessage?: string;
  createdAt: string;
}

export const paymentsApi = {
  createOrder: (body: CreatePaymentOrderBody): Promise<CreatePaymentOrderResponse> =>
    request<CreatePaymentOrderResponse>('/v1/payments/create-order', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  verify: (body: VerifyPaymentBody): Promise<VerifyPaymentResponse> =>
    request<VerifyPaymentResponse>('/v1/payments/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  receiptPdfUrl: (orderId: string): string => '/api/v1/payments/receipt/' + orderId + '/pdf',
  getNotificationAudit: (orderId: string): Promise<NotificationAuditLog[]> =>
    request<NotificationAuditLog[]>(`/v1/payments/${orderId}/notifications`),
  getGlobalAudit: (): Promise<NotificationAuditLog[]> =>
    request<NotificationAuditLog[]>('/v1/payments/notifications/audit'),
  getRefundPreview: (appointmentId: string, simulatedHours?: number): Promise<RefundPreviewResponse> => {
    const q = simulatedHours !== undefined ? `?simulatedHours=${simulatedHours}` : '';
    return request<RefundPreviewResponse>(`/v1/payments/appointments/${appointmentId}/refund-preview${q}`);
  },
  cancelAndRefund: (appointmentId: string, body?: CancelAndRefundBody): Promise<CancelAndRefundResponse> =>
    request<CancelAndRefundResponse>(`/v1/payments/appointments/${appointmentId}/cancel-and-refund`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
  getRefundStatus: (appointmentId: string): Promise<PaymentRefund | null> =>
    request<PaymentRefund | null>(`/v1/payments/appointments/${appointmentId}/refund-status`),
};

export const pharmacyCommerceApi = {
  getCategories: (): Promise<MedicineCategory[]> =>
    request<MedicineCategory[]>('/v1/pharmacy/categories'),

  getMedicines: (params?: {
    categoryId?: string;
    search?: string;
    requiresPrescription?: boolean;
    page?: number;
    size?: number;
  }): Promise<{ content: Medicine[]; totalElements: number; totalPages: number }> => {
    const query = new URLSearchParams();
    if (params?.categoryId) query.append('categoryId', params.categoryId);
    if (params?.search) query.append('search', params.search);
    if (params?.requiresPrescription !== undefined) {
      query.append('requiresPrescription', String(params.requiresPrescription));
    }
    if (params?.page !== undefined) query.append('page', String(params.page));
    if (params?.size !== undefined) query.append('size', String(params.size));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<{ content: Medicine[]; totalElements: number; totalPages: number }>(`/v1/pharmacy/medicines${qs}`);
  },

  getFeaturedMedicines: (): Promise<Medicine[]> =>
    request<Medicine[]>('/v1/pharmacy/medicines/featured'),

  getMedicine: (id: string): Promise<Medicine> =>
    request<Medicine>(`/v1/pharmacy/medicines/${id}`),

  getCart: (): Promise<Cart> =>
    request<Cart>('/v1/pharmacy/cart'),

  addToCart: (medicineId: string, quantity: number = 1): Promise<Cart> =>
    request<Cart>('/v1/pharmacy/cart/items', {
      method: 'POST',
      body: JSON.stringify({ medicineId, quantity }),
    }),

  updateCartItem: (cartItemId: string, quantity: number): Promise<Cart> =>
    request<Cart>(`/v1/pharmacy/cart/items/${cartItemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    }),

  removeCartItem: (cartItemId: string): Promise<Cart> =>
    request<Cart>(`/v1/pharmacy/cart/items/${cartItemId}`, {
      method: 'DELETE',
    }),

  clearCart: (): Promise<Cart> =>
    request<Cart>('/v1/pharmacy/cart', {
      method: 'DELETE',
    }),

  createCheckoutOrder: (body: {
    deliveryName: string;
    deliveryPhone: string;
    deliveryStreet: string;
    deliveryCity: string;
    deliveryState: string;
    deliveryPincode: string;
    prescriptionId?: string;
    notes?: string;
  }): Promise<PharmacyCheckoutResponse> =>
    request<PharmacyCheckoutResponse>('/v1/pharmacy/checkout/create-order', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  verifyPayment: (body: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<CommerceOrder> =>
    request<CommerceOrder>('/v1/pharmacy/checkout/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getMyOrders: (): Promise<CommerceOrder[]> =>
    request<CommerceOrder[]>('/v1/pharmacy/me/orders'),

  getOrderDetails: (orderId: string): Promise<CommerceOrder> =>
    request<CommerceOrder>(`/v1/pharmacy/me/orders/${orderId}`),
};

