// Implements: FR-01, FR-02
// Safety:    none
// Owner:     frontend (Group 6)

import { create } from 'zustand';

export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN' | 'PHARMACIST';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('access_token'),
  user: localStorage.getItem('auth_user')
    ? JSON.parse(localStorage.getItem('auth_user')!)
    : null,
  setAuth: (token, user) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    set({ token: null, user: null });
  },
}));
