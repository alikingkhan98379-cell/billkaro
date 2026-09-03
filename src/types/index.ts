export type TaxType = 'CGST_SGST' | 'IGST' | 'NONE';
export type InvoiceStatus = 'PAID' | 'UNPAID' | 'PARTIAL' | 'OVERDUE';
export type SubscriptionPlan = 'free' | 'premium';
export type NotificationType = 'payment' | 'invoice_created' | 'invoice_overdue' | 'welcome' | 'system' | 'security';

export interface BusinessProfile {
  id: string;
  user_id: string;
  name: string;
  full_name?: string;
  last_login_at?: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  logo_url: string;
  bank_name: string;
  account_no: string;
  ifsc: string;
  signature_url: string;
  upi_id: string;
  terms_conditions: string;
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  state: string;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  hsn_code: string;
  price: number;
  unit: string;
  gst_percent: number;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  product_id?: string;
  product_name: string;
  hsn_code: string;
  qty: number;
  unit: string;
  price: number;
  gst_percent: number;
  amount: number;
  created_at?: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  customer_id?: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  tax_type: TaxType;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  discount: number;
  grand_total: number;
  status: InvoiceStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  customer?: Customer;
  items?: InvoiceItem[];
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
}

export type PaymentStatus = 
  | 'CREATED' 
  | 'WAITING_FOR_PAYMENT' 
  | 'SUBMITTED' 
  | 'VERIFYING' 
  | 'PENDING_ADMIN' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'EXPIRED';

export type VerificationStatus = 'UNVERIFIED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'SUSPICIOUS';

export interface PaymentRecord {
  id: string;
  user_id: string;
  order_id: string;
  plan_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  upi_id: string;
  payment_note: string;
  utr?: string;
  transaction_reference?: string;
  screenshot_path?: string;
  screenshot_url?: string; // Signed/accessible preview URL
  status: PaymentStatus;
  verification_status: VerificationStatus;
  verification_message?: string;
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
  submitted_at?: string;
  verified_at?: string;
  approved_at?: string;
  rejected_at?: string;
  expires_at?: string;
  user_email?: string;
  user_name?: string;
}

export interface PaymentAuditLog {
  id: string;
  payment_id: string;
  user_id: string;
  action: string;
  performed_by?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: string; // 'free' | 'monthly' | 'six_months' | 'yearly' | 'premium'
  plan_id?: string;
  plan_name?: string;
  status?: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  is_active: boolean;
  start_date?: string;
  expiry_date?: string;
  payment_id?: string;
  upgraded_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface SubscriptionRequest {
  id: string;
  user_id: string;
  utr_number: string;
  screenshot_url: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

export interface AuthActivityLog {
  id: string;
  user_id: string;
  email: string;
  event_type: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface UserAuthStatus {
  exists: boolean;
  has_google?: boolean;
  has_password?: boolean;
  provider?: 'google' | 'email' | 'both';
}

export interface SignupOtpResponse {
  error?: string;
  errorCode?: 'ALREADY_EXISTS' | 'GOOGLE_EXISTS' | 'EMAIL_EXISTS' | 'RATE_LIMITED' | 'GENERIC_ERROR';
  message?: string;
}



