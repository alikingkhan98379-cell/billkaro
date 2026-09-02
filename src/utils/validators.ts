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
