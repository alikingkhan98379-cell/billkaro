export type TaxType = 'CGST_SGST' | 'IGST' | 'NONE';
export type InvoiceStatus = 'PAID' | 'UNPAID' | 'PARTIAL' | 'OVERDUE';
export type SubscriptionPlan = 'free' | 'premium';
export type NotificationType = 'payment' | 'invoice_created' | 'invoice_overdue' | 'welcome' | 'system' | 'security';

export interface BusinessProfile {
  id: string;
  user_id: string;
  name: string;
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

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  is_active: boolean;
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
