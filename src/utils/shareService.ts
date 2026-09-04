import { Invoice, BusinessProfile, Customer } from '../types';
import { generateInvoicePDF } from './pdfGenerator';

export interface ShareResult {
  success: boolean;
  method: 'native_pdf_share' | 'download_and_whatsapp_fallback' | 'download_only';
  message: string;
  error?: string;
}

/**
 * Clean filename helper
 */
export function getInvoicePdfFileName(invoice: Invoice, customer?: Customer): string {
  const safeNumber = (invoice.invoice_number || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeCustomer = (customer?.name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `BillKaro_${safeNumber}_${safeCustomer}.pdf`;
}

/**
 * Generate PDF Blob & File object
 */
export async function generateInvoicePdfFile(
  invoice: Invoice,
  business: BusinessProfile,
  customer?: Customer
): Promise<{ file: File; blob: Blob; fileName: string }> {
  const doc = await generateInvoicePDF(invoice, business, customer);
  const blob = doc.output('blob');
  const fileName = getInvoicePdfFileName(invoice, customer);
  const file = new File([blob], fileName, { type: 'application/pdf' });
  return { file, blob, fileName };
}

/**
 * Share invoice using native Web Share API with actual PDF file attachment,
 * or fallback gracefully to PDF download + WhatsApp message
 */
export async function shareInvoicePDF(
  invoice: Invoice,
  business: BusinessProfile,
  customer?: Customer
): Promise<ShareResult> {
  try {
    const { file, fileName } = await generateInvoicePdfFile(invoice, business, customer);
    const invoiceNo = invoice.invoice_number || 'Invoice';
    const businessName = business.name || 'BillKaro';

    // 1. Check if native Web Share API supports file sharing
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: `Invoice ${invoiceNo}`,
          text: `Tax Invoice ${invoiceNo} from ${businessName}`,
          files: [file]
        });

        return {
          success: true,
          method: 'native_pdf_share',
          message: 'Invoice PDF shared successfully via native share.'
        };
      } catch (shareErr: any) {
        // If user cancelled the share sheet, return cleanly without error
        if (shareErr?.name === 'AbortError') {
          return {
            success: true,
            method: 'native_pdf_share',
            message: 'Share cancelled by user.'
          };
        }
        console.warn('Native share threw error, falling back:', shareErr);
      }
    }

    // 2. Fallback: Trigger download of PDF file directly
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    // 3. Open WhatsApp with clean, professional short text
    const phone = customer?.phone ? customer.phone.replace(/[^0-9]/g, '') : '';
    const cleanMsg = encodeURIComponent(
      `Hello ${customer?.name || 'Customer'},\n\nPlease find attached Tax Invoice *${invoiceNo}* for ₹${Number(invoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })} from *${businessName}*.\n\nThank you for your business!`
    );

    let waUrl = `https://wa.me/?text=${cleanMsg}`;
    if (phone && phone.length === 10) {
      waUrl = `https://wa.me/91${phone}?text=${cleanMsg}`;
    } else if (phone && phone.length > 10) {
      waUrl = `https://wa.me/${phone}?text=${cleanMsg}`;
    }

    window.open(waUrl, '_blank');

    return {
      success: true,
      method: 'download_and_whatsapp_fallback',
      message: 'PDF downloaded to your device. Attach this file in WhatsApp to send.'
    };
  } catch (err: any) {
    console.error('Invoice share failed:', err);
    return {
      success: false,
      method: 'download_only',
      message: 'Failed to share invoice PDF.',
      error: err?.message || 'Unknown error'
    };
  }
}
