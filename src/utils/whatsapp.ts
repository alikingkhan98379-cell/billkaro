import { BusinessProfile, Customer, Invoice } from '../types';
import { formatINR } from './currency';

export function generateWhatsAppMessage(
  invoice: Invoice,
  business: BusinessProfile,
  customer?: Customer
): string {
  const customerName = customer?.name || 'Valued Customer';
  const businessName = business.name || 'Our Store';
  const amount = formatINR(invoice.grand_total);
  
  let msg = `Dear *${customerName}*,

`;
  msg += `Thank you for your business! Here are the details for your tax invoice:

`;
  msg += `?? *Invoice No:* ${invoice.invoice_number}
`;
  msg += `?? *Date:* ${invoice.invoice_date}
`;
  msg += `?? *Total Amount:* ${amount}
`;
  msg += `?? *Status:* ${invoice.status}

`;

  if (business.upi_id) {
    msg += `?? *Pay via UPI:* ` + business.upi_id + `
`;
  }
  if (business.bank_name && business.account_no) {
    msg += `?? *Bank:* ${business.bank_name} | *A/C:* ${business.account_no} | *IFSC:* ${business.ifsc}

`;
  }

  msg += `Best regards,
*${businessName}*
`;
  if (business.phone) msg += `?? ${business.phone}`;

  return encodeURIComponent(msg);
}

export function openWhatsAppShare(
  invoice: Invoice,
  business: BusinessProfile,
  customer?: Customer
) {
  const phone = customer?.phone ? customer.phone.replace(/[^0-9]/g, '') : '';
  const message = generateWhatsAppMessage(invoice, business, customer);
  
  let url = '';
  if (phone && phone.length === 10) {
    url = `https://wa.me/91${phone}?text=${message}`;
  } else if (phone && phone.length > 10) {
    url = `https://wa.me/${phone}?text=${message}`;
  } else {
    url = `https://wa.me/?text=${message}`;
  }

  window.open(url, '_blank');
}
