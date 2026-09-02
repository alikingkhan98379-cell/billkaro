import { InvoiceItem, TaxType } from '../types';

export interface CalculationResult {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
}

export function calculateInvoiceTotals(
  items: InvoiceItem[],
  taxType: TaxType,
  discountValue: number = 0,
  discountIsPercentage: boolean = false
): CalculationResult {
  let subtotal = 0;
  let totalTax = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  items.forEach(item => {
    const qty = Number(item.qty) || 0;
    const price = Number(item.price) || 0;
    const gstPercent = Number(item.gst_percent) || 0;
    
    const lineSubtotal = qty * price;
    subtotal += lineSubtotal;

    if (taxType !== 'NONE') {
      const lineTax = (lineSubtotal * gstPercent) / 100;
      totalTax += lineTax;

      if (taxType === 'CGST_SGST') {
        cgst += lineTax / 2;
        sgst += lineTax / 2;
      } else if (taxType === 'IGST') {
        igst += lineTax;
      }
    }
  });

  let discountAmount = 0;
  if (discountIsPercentage) {
    discountAmount = (subtotal * (Number(discountValue) || 0)) / 100;
  } else {
    discountAmount = Number(discountValue) || 0;
  }
  if (discountAmount > subtotal) discountAmount = subtotal;

  const taxableAmount = Math.max(0, subtotal - discountAmount);

  if (discountAmount > 0 && subtotal > 0) {
    const ratio = taxableAmount / subtotal;
    cgst = cgst * ratio;
    sgst = sgst * ratio;
    igst = igst * ratio;
    totalTax = totalTax * ratio;
  }

  const rawGrandTotal = taxableAmount + totalTax;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((grandTotal - rawGrandTotal) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    igst: Math.round(igst * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    roundOff,
    grandTotal
  };
}
