export interface PhoneValidationResult {
  isValid: boolean;
  message: string;
}

const PHONE_REGEX = /^(?:\+?[0-9](?:[\s\-()]{0,2}[0-9]){6,14})?$/;

export function validatePhoneNumber(phone: string | undefined | null): PhoneValidationResult {
  const trimmed = (phone ?? '').trim();
  if (!trimmed) {
    return { isValid: true, message: '' };
  }
  if (!PHONE_REGEX.test(trimmed)) {
    return {
      isValid: false,
      message: 'Please enter a valid phone number (7–15 digits, optional + prefix)',
    };
  }
  return { isValid: true, message: '' };
}

