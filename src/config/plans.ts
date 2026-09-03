// Authoritative Centralized Plan Configuration for BillKaro
// NEVER duplicate pricing elsewhere in the application.

export type PlanId = 'free' | 'monthly' | 'six_months' | 'yearly';

export interface PlanConfig {
  id: PlanId;
  name: string;
  price: number; // in INR
  durationDays: number;
  discountPercent: number;
  adsEnabled: boolean;
  badge?: string;
  description: string;
  features: string[];
}

export const UPI_CONFIG = {
  receiverUpiId: '9638938258@ybl',
  merchantName: 'BillKaro',
  paymentNote: 'BillKaro',
  currency: 'INR',
  maxVerificationWindowHours: 4
} as const;

export const PLANS_CONFIG: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free Starter',
    price: 0,
    durationDays: 0,
    discountPercent: 0,
    adsEnabled: true,
    description: 'Essential billing for new businesses & sole proprietors',
    features: [
      'Up to 5 invoices per month',
      'Standard GST Tax calculation',
      'Customer & Product catalog',
      'Standard PDF invoices',
      'Basic Email Support'
    ]
  },
  monthly: {
    id: 'monthly',
    name: 'Monthly Pro',
    price: 49,
    durationDays: 30,
    discountPercent: 0,
    adsEnabled: false,
    description: 'Flexible monthly billing with complete ad-free Pro features',
    features: [
      'Unlimited GST & Non-GST Invoices',
      'Ads completely OFF',
      'Upload Custom Logo & Signature',
      'Dynamic UPI QR Code on Invoices',
      '1-Click WhatsApp Sharing',
      'Customer Ledger & Balance Tracking',
      'Inventory & Low Stock Alerts'
    ]
  },
  six_months: {
    id: 'six_months',
    name: '6 Months Pro',
    price: 250,
    durationDays: 180,
    discountPercent: 15,
    adsEnabled: false,
    badge: 'Save 15%',
    description: 'Half-yearly plan with 15% discount for growing businesses',
    features: [
      'Everything in Monthly Pro',
      'Ads completely OFF (180 Days)',
      '15% Cost Savings',
      'Unlimited Invoices & Estimates',
      'Priority Customer Support',
      'Bulk Excel Export & Reports'
    ]
  },
  yearly: {
    id: 'yearly',
    name: 'Yearly Pro',
    price: 470,
    durationDays: 365,
    discountPercent: 20,
    adsEnabled: false,
    badge: 'Best Value • Save 20%',
    description: 'Annual peace of mind with maximum 20% discount',
    features: [
      'Everything in Pro Suite (365 Days)',
      'Ads completely OFF for 1 Full Year',
      'Maximum 20% Cost Savings',
      'Unlimited Invoices, Estimates & Quotes',
      'Custom Invoice Numbering Series',
      'VIP Priority Phone & WhatsApp Support',
      'Early Access to New GST Tools'
    ]
  }
};

/**
 * Generate Dynamic UPI Payment URI
 */
export function generateUpiUri(amount: number, orderId?: string): string {
  const params = new URLSearchParams({
    pa: UPI_CONFIG.receiverUpiId,
    pn: UPI_CONFIG.merchantName,
    am: amount.toString(),
    cu: UPI_CONFIG.currency,
    tn: orderId ? `BillKaro-${orderId}` : UPI_CONFIG.paymentNote
  });
  return `upi://pay?${params.toString()}`;
}
