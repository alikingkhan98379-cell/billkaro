export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const HSN_REGEX = /^\d{2,8}$/;

export function isValidGSTIN(gstin: string): boolean {
  if (!gstin) return false;
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

export function isValidIndianPhone(phone: string): boolean {
  if (!phone) return false;
  const clean = phone.replace(/[^0-9]/g, '');
  if (clean.length === 10) return INDIAN_PHONE_REGEX.test(clean);
  if (clean.length === 11 && clean.startsWith('0')) return INDIAN_PHONE_REGEX.test(clean.substring(1));
  if (clean.length === 12 && clean.startsWith('91')) return INDIAN_PHONE_REGEX.test(clean.substring(2));
  return false;
}

export function isValidIFSC(ifsc: string): boolean {
  if (!ifsc) return false;
  return IFSC_REGEX.test(ifsc.trim().toUpperCase());
}

export function isValidUPI(upi: string): boolean {
  if (!upi) return false;
  return UPI_ID_REGEX.test(upi.trim().toLowerCase());
}

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

export function isValidHSN(hsn: string): boolean {
  if (!hsn) return true;
  return HSN_REGEX.test(hsn.trim());
}

export function sanitizeText(text: string): string {
  if (!text) return '';
  return text.trim().replace(/[<>]/g, '');
}

export interface PasswordValidation {
  isValid: boolean;
  hasLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export function validateStrongPassword(password: string): PasswordValidation {
  const p = password || '';
  const hasLength = p.length >= 8;
  const hasUpper = /[A-Z]/.test(p);
  const hasLower = /[a-z]/.test(p);
  const hasNumber = /[0-9]/.test(p);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(p);
  const isValid = hasLength && hasUpper && hasLower && hasNumber && hasSpecial;
  return { isValid, hasLength, hasUpper, hasLower, hasNumber, hasSpecial };
}

export function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isCompanyIdOrUuidError(err?: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toUpperCase();
  return (
    msg.includes('company_id') ||
    msg.includes('uuid') ||
    msg.includes('invalid input syntax') ||
    code === 'PGRST204' ||
    code === '22P02'
  );
}

export function isSchemaMismatchError(err?: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toUpperCase();
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    code === '22P02' ||
    msg.includes('schema cache') ||
    msg.includes('could not find the') ||
    msg.includes('column of') ||
    msg.includes('does not exist') ||
    msg.includes('driver_phone') ||
    msg.includes('vehicle_number') ||
    msg.includes('transport_name') ||
    msg.includes('lr_number') ||
    msg.includes('company_id') ||
    msg.includes('uuid') ||
    msg.includes('invalid input syntax')
  );
}


