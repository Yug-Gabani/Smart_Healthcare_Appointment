export interface PasswordValidationResult {
  isValid: boolean;
  message: string;
}

export interface PasswordRequirement {
  id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';
  label: string;
  met: boolean;
}

export type PasswordStrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrengthInfo {
  score: number;
  maxScore: number;
  level: PasswordStrengthLevel;
  label: string;
  requirements: PasswordRequirement[];
}

export function getPasswordStrength(password: string): PasswordStrengthInfo {
  const requirements: PasswordRequirement[] = [
    { id: 'length', label: '8+ characters', met: password.length >= 8 },
    { id: 'uppercase', label: 'Uppercase (A-Z)', met: /[A-Z]/.test(password) },
    { id: 'lowercase', label: 'Lowercase (a-z)', met: /[a-z]/.test(password) },
    { id: 'number', label: 'Number (0-9)', met: /[0-9]/.test(password) },
    { id: 'special', label: 'Symbol (!@#$...)', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = requirements.filter(r => r.met).length;
  const maxScore = requirements.length;

  let level: PasswordStrengthLevel = 'empty';
  let label = '';

  if (password.length > 0) {
    if (score <= 2) {
      level = 'weak';
      label = 'Weak';
    } else if (score === 3) {
      level = 'fair';
      label = 'Fair';
    } else if (score === 4) {
      level = 'good';
      label = 'Good';
    } else {
      level = 'strong';
      label = 'Strong';
    }
  }

  return { score, maxScore, level, label, requirements };
}

export function validateStrongPassword(password: string): PasswordValidationResult {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character' };
  }
  return { isValid: true, message: '' };
}
