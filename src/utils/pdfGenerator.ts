import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { BusinessProfile, Customer, Invoice, InvoiceItem } from '../types';
import { numberToIndianWords } from './currency';
import { GST_STATE_MAP } from './gstinService';

function formatDateIndian(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatNum(num?: number): string {
  if (num === undefined || num === null || isNaN(num)) return '0.00';
  return Number(num).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function cleanAddress(addr?: string): string {
  if (!addr) return '';
  return addr
    .replace(/^0,s*0,s*/i, '')
    .replace(/^0,s*/i, '')
    .replace(/^s*,s*/, '')
    .trim();
}

function getPanFromGstin(gstin?: string): string {
  if (!gstin) return '';
  const clean = gstin.trim().toUpperCase();
  if (clean.length === 15) {
    return clean.substring(2, 12);
  }
  return '';
}

function getStateWithCode(stateName?: string, gstin?: string): string {
  if (gstin && gstin.trim().length >= 2) {
    const code = gstin.trim().substring(0, 2);
    const mapped = GST_STATE_MAP[code];
    if (mapped) {
      return `${mapped} (${code})`;
    }
  }
  if (stateName) {
    const entry = Object.entries(GST_STATE_MAP).find(
      ([, name]) => name.toLowerCase() === stateName.trim().toLowerCase()
    );
    if (entry) {
      return `${stateName} (${entry[0]})`;
    }
    return stateName;
  }
  return '';
}

export async function generateInvoicePDF(
  invoice: Invoice,
  business: BusinessProfile,
  customer?: Customer
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm

  const borderColor: [number, number, number] = [30, 41, 59]; // slate-800
  const tableBorderColor: [number, number, number] = [51, 65, 85]; // slate-700
  const textColor: [number, number, number] = [15, 23, 42]; // slate-900
  const grayText: [number, number, number] = [71, 85, 105]; // slate-600
  const headerBg: [number, number, number] = [248, 250, 252]; // slate-50

  let currentY = margin;

  // --------------------------------------------------------------------------
  // 1. TOP TITLE HEADER: TAX INVOICE & ORIGINAL FOR CUSTOMER
  // --------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...textColor);
  doc.text('TAX INVOICE', pageWidth / 2, currentY + 3, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grayText);
  doc.text('Original for Customer', pageWidth - margin, currentY + 3, { align: 'right' });

  currentY += 6;

  // --------------------------------------------------------------------------
  // 2. SELLER & INVOICE DETAILS BOX
  // --------------------------------------------------------------------------
  const topBoxStartY = currentY;
  const sellerBoxWidth = 104;
  const invoiceBoxWidth = contentWidth - sellerBoxWidth; // 82mm

  let sY = topBoxStartY + 4;
  const leftPadding = margin + 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...textColor);
  const sellerName = (business.name || 'BUSINESS NAME').toUpperCase();
  doc.text(sellerName, leftPadding, sY);
  sY += 4.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textColor);

  const cleanBusinessAddr = cleanAddress(business.address);
  if (cleanBusinessAddr) {
    const addrLines = doc.splitTextToSize(cleanBusinessAddr, sellerBoxWidth - 6);
    doc.text(addrLines, leftPadding, sY);
    sY += addrLines.length * 3.4;
  }

  const sellerStateStr = getStateWithCode(undefined, business.gstin);
  if (sellerStateStr) {
    doc.text(`${sellerStateStr}, India`, leftPadding, sY);
    sY += 3.6;
  }

  const sellerGstin = (business.gstin || '').toUpperCase();
  const sellerPan = getPanFromGstin(sellerGstin);

  if (sellerGstin) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${sellerGstin}`, leftPadding, sY);
    doc.setFont('helvetica', 'normal');
    sY += 3.4;
  }

  if (sellerPan) {
    doc.text(`PAN: ${sellerPan}`, leftPadding, sY);
    sY += 3.4;
  }

  if (business.phone) {
    doc.text(`Phone: ${business.phone}`, leftPadding, sY);
    sY += 3.4;
  }

  const sellerContentHeight = Math.max(sY - topBoxStartY + 2, 34);
  const rightBoxX = margin + sellerBoxWidth;
  const topBoxHeight = sellerContentHeight;

  // Draw Top Outer Box
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.rect(margin, topBoxStartY, contentWidth, topBoxHeight);

  // Vertical divider between Seller and Invoice Meta
  doc.line(rightBoxX, topBoxStartY, rightBoxX, topBoxStartY + topBoxHeight);

  // Right Box Content: Split into rows
  const metaRowHeight = topBoxHeight / 2;
  doc.line(rightBoxX, topBoxStartY + metaRowHeight, margin + contentWidth, topBoxStartY + metaRowHeight);

  const metaColWidth = invoiceBoxWidth / 2;
  doc.line(rightBoxX + metaColWidth, topBoxStartY, rightBoxX + metaColWidth, topBoxStartY + metaRowHeight);

  // Cell 1: Invoice No
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...grayText);
  doc.text('Invoice No.:', rightBoxX + 3, topBoxStartY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  doc.text(invoice.invoice_number || 'INV-0001', rightBoxX + 3, topBoxStartY + 10.5);

  // Cell 2: Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...grayText);
  doc.text('Date:', rightBoxX + metaColWidth + 3, topBoxStartY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  doc.text(formatDateIndian(invoice.invoice_date), rightBoxX + metaColWidth + 3, topBoxStartY + 10.5);

  // Cell 3: Place of Supply
  const bottomRowY = topBoxStartY + metaRowHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...grayText);
  doc.text('Place of Supply:', rightBoxX + 3, bottomRowY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...textColor);

  const placeOfSupplyStr = getStateWithCode(customer?.state, customer?.gstin) || (customer?.state || 'Local State');
  doc.text(placeOfSupplyStr, rightBoxX + 3, bottomRowY + 10);

  currentY = topBoxStartY + topBoxHeight;

  // --------------------------------------------------------------------------
  // 3. BILL TO & SHIP TO BOXES
  // --------------------------------------------------------------------------
  const partyBoxStartY = currentY;
  const colHalfWidth = contentWidth / 2; // 93mm each

  let bY = partyBoxStartY + 4;
  const custName = customer?.name || 'Cash Customer';
  const cleanCustAddr = cleanAddress(customer?.address);
  const custGstin = (customer?.gstin || '').toUpperCase();
  const custPan = getPanFromGstin(custGstin);
  const custPhone = customer?.phone || '';
  const custState = getStateWithCode(customer?.state, customer?.gstin);

  // Header "Bill To" & "Ship To"
  doc.setFillColor(...headerBg);
  doc.rect(margin, partyBoxStartY, colHalfWidth, 5.5, 'F');
  doc.rect(margin + colHalfWidth, partyBoxStartY, colHalfWidth, 5.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textColor);
  doc.text('Bill To', margin + 3, partyBoxStartY + 4);
  doc.text('Ship To', margin + colHalfWidth + 3, partyBoxStartY + 4);

  bY = partyBoxStartY + 9;

  // Bill To Content
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...textColor);
  doc.text(custName, margin + 3, bY);
  bY += 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  if (cleanCustAddr) {
    const cAddrLines = doc.splitTextToSize(cleanCustAddr, colHalfWidth - 6);
    doc.text(cAddrLines, margin + 3, bY);
    bY += cAddrLines.length * 3.2;
  }

  if (custState) {
    doc.text(`${custState}, India`, margin + 3, bY);
    bY += 3.2;
  }

  let contactY = bY + 1;
  if (custPhone) {
    doc.text(`Phone: ${custPhone}`, margin + 3, contactY);
  }
  contactY += 3.2;

  if (custGstin) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${custGstin}`, margin + 3, contactY);
    doc.setFont('helvetica', 'normal');
  }
  if (custPan) {
    doc.text(`PAN: ${custPan}`, margin + colHalfWidth - 26, contactY);
  }
  contactY += 4;

  // Ship To Content
  let sShipY = partyBoxStartY + 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(custName, margin + colHalfWidth + 3, sShipY);
  sShipY += 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  if (cleanCustAddr) {
    const cAddrLines = doc.splitTextToSize(cleanCustAddr, colHalfWidth - 6);
    doc.text(cAddrLines, margin + colHalfWidth + 3, sShipY);
    sShipY += cAddrLines.length * 3.2;
  }
  if (custState) {
    doc.text(`${custState}, India`, margin + colHalfWidth + 3, sShipY);
    sShipY += 3.2;
  }

  let sContactY = sShipY + 1;
  if (custPhone) {
    doc.text(`Phone: ${custPhone}`, margin + colHalfWidth + 3, sContactY);
  }
  sContactY += 3.2;
  if (custGstin) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${custGstin}`, margin + colHalfWidth + 3, sContactY);
    doc.setFont('helvetica', 'normal');
  }
  if (custPan) {
    doc.text(`PAN: ${custPan}`, margin + contentWidth - 26, sContactY);
  }

  const partyBoxHeight = Math.max(contactY, sContactY) - partyBoxStartY + 2;

  // Draw Party Box Outlines
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.rect(margin, partyBoxStartY, contentWidth, partyBoxHeight);
  doc.line(margin + colHalfWidth, partyBoxStartY, margin + colHalfWidth, partyBoxStartY + partyBoxHeight);
  doc.line(margin, partyBoxStartY + 5.5, margin + contentWidth, partyBoxStartY + 5.5);

  currentY = partyBoxStartY + partyBoxHeight;

  // --------------------------------------------------------------------------
  // 4. ITEMS TABLE (MATCHING REFERENCE ACCOUNTING LEDGER GRID)
  // --------------------------------------------------------------------------
  // Exact column widths:
  // 0: # (8mm)            -> x: 12 to 20
  // 1: Item & Description (68mm) -> x: 20 to 88
  // 2: HSN/SAC (20mm)     -> x: 88 to 108
  // 3: Tax% (16mm)        -> x: 108 to 124
  // 4: Qty. (18mm)        -> x: 124 to 142
  // 5: Per (12mm)         -> x: 142 to 154
  // 6: Rate/Item (20mm)   -> x: 154 to 174
  // 7: Amount (24mm)      -> x: 174 to 198
  // Total width = 186mm

  const colWidths = [8, 68, 20, 16, 18, 12, 20, 24];
  const colX = [margin];
  for (let i = 0; i < colWidths.length; i++) {
    colX.push(colX[i] + colWidths[i]);
  }

  const tableHeaderHeight = 6.5;
  const items = invoice.items || [];
  const isIgst = invoice.tax_type === 'IGST';
  const taxRateAvg = items.length > 0 ? (items[0].gst_percent || 18) : 18;

  // Summary Rows
  const summaryRows: Array<{ label: string; value: string }> = [
    { label: 'Taxable Amount', value: formatNum(invoice.subtotal) }
  ];

  if (invoice.discount > 0) {
    summaryRows.push({ label: 'Discount', value: '-' + formatNum(invoice.discount) });
  }

  if (isIgst) {
    summaryRows.push({
      label: `IGST ${taxRateAvg.toFixed(1)}%`,
      value: formatNum(invoice.igst)
    });
  } else if (invoice.tax_type === 'CGST_SGST') {
    const halfRate = (taxRateAvg / 2).toFixed(1);
    summaryRows.push({
      label: `CGST ${halfRate}%`,
      value: formatNum(invoice.cgst)
    });
    summaryRows.push({
      label: `SGST ${halfRate}%`,
      value: formatNum(invoice.sgst)
    });
  }

  const roundOffVal = Number((invoice.grand_total - (invoice.subtotal - invoice.discount + invoice.cgst + invoice.sgst + invoice.igst)).toFixed(2)) || 0;
  summaryRows.push({ label: 'Round off', value: formatNum(roundOffVal) });

  const summaryRowHeight = 4.8;
  const summaryTotalHeight = summaryRows.length * summaryRowHeight;
  const totalRowHeight = 6.5;

  const minItemsBodyHeight = Math.max(items.length * 7 + summaryTotalHeight + 6, 52);
  const totalTableHeight = tableHeaderHeight + minItemsBodyHeight + totalRowHeight;

  const tableTopY = currentY;
  const tableBottomY = tableTopY + totalTableHeight;
  const summaryStartY = tableBottomY - totalRowHeight - summaryTotalHeight;
  const totalRowY = tableBottomY - totalRowHeight;

  // Outer border of items table
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.rect(margin, tableTopY, contentWidth, totalTableHeight);

  // Table Header Background & Divider Line
  doc.setFillColor(...headerBg);
  doc.rect(margin, tableTopY, contentWidth, tableHeaderHeight, 'F');
  doc.line(margin, tableTopY + tableHeaderHeight, margin + contentWidth, tableTopY + tableHeaderHeight);

  // Header Titles
  const headers = ['#', 'Item & Description', 'HSN/SAC', 'Tax%', 'Qty.', 'Per', 'Rate/Item', 'Amount'];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textColor);

  doc.text(headers[0], colX[0] + colWidths[0] / 2, tableTopY + 4.5, { align: 'center' });
  doc.text(headers[1], colX[1] + 3, tableTopY + 4.5);
  doc.text(headers[2], colX[2] + colWidths[2] / 2, tableTopY + 4.5, { align: 'center' });
  doc.text(headers[3], colX[3] + colWidths[3] / 2, tableTopY + 4.5, { align: 'center' });
  doc.text(headers[4], colX[4] + colWidths[4] - 2, tableTopY + 4.5, { align: 'right' });
  doc.text(headers[5], colX[5] + colWidths[5] / 2, tableTopY + 4.5, { align: 'center' });
  doc.text(headers[6], colX[6] + colWidths[6] - 2, tableTopY + 4.5, { align: 'right' });
  doc.text(headers[7], colX[7] + colWidths[7] - 2, tableTopY + 4.5, { align: 'right' });

  // Render Item Lines
  let totalQty = 0;
  let itemRowY = tableTopY + tableHeaderHeight + 5;

  items.forEach((item, idx) => {
    const qty = Number(item.qty) || 0;
    const price = Number(item.price) || 0;
    const amount = Number(item.amount) || qty * price;
    totalQty += qty;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...textColor);

    // #
    doc.text((idx + 1).toString(), colX[0] + colWidths[0] / 2, itemRowY, { align: 'center' });
    // Product Name (Bold)
    doc.setFont('helvetica', 'bold');
    doc.text(item.product_name || 'Item', colX[1] + 3, itemRowY);
    doc.setFont('helvetica', 'normal');

    // HSN/SAC
    doc.text(item.hsn_code || '-', colX[2] + colWidths[2] / 2, itemRowY, { align: 'center' });
    // Tax%
    doc.text((item.gst_percent || 0).toFixed(1) + '%', colX[3] + colWidths[3] / 2, itemRowY, { align: 'center' });
    // Qty
    doc.text(formatNum(qty), colX[4] + colWidths[4] - 2, itemRowY, { align: 'right' });
    // Per
    doc.text(item.unit || 'PCS', colX[5] + colWidths[5] / 2, itemRowY, { align: 'center' });
    // Rate/Item
    doc.text(formatNum(price), colX[6] + colWidths[6] - 2, itemRowY, { align: 'right' });
    // Amount (Bold)
    doc.setFont('helvetica', 'bold');
    doc.text(formatNum(amount), colX[7] + colWidths[7] - 2, itemRowY, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    itemRowY += 6.5;
  });

  // CONTINUOUS VERTICAL DIVIDER LINES ACROSS THE ENTIRE TABLE
  // All column vertical dividers run cleanly from tableTopY down to totalRowY!
  for (let i = 1; i < colX.length - 1; i++) {
    doc.line(colX[i], tableTopY, colX[i], totalRowY);
  }

  // SUMMARY LABELS AND VALUES IN LOWER SECTION
  let currSumY = summaryStartY + 3.5;
  summaryRows.forEach(row => {
    // Label in italic right before Rate/Item or Amount column
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(7.5);
    doc.setTextColor(...textColor);
    doc.text(row.label, colX[7] - 3, currSumY, { align: 'right' });

    // Value right-aligned in Amount column
    doc.setFont('helvetica', 'normal');
    doc.text(row.value, colX[8] - 2, currSumY, { align: 'right' });

    currSumY += summaryRowHeight;
  });

  // TOTAL ROW (Horizontal Line across the entire table width)
  doc.line(margin, totalRowY, margin + contentWidth, totalRowY);

  // In Total Row:
  // "Total" right-aligned before Amount column
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...textColor);
  doc.text('Total', colX[7] - 3, totalRowY + 4.5, { align: 'right' });

  // Total Quantity placed strictly in the Qty column (colX[4] to colX[5])
  doc.text(formatNum(totalQty), colX[5] - 2, totalRowY + 4.5, { align: 'right' });

  // Grand Total placed strictly in the Amount column (colX[7] to colX[8])
  doc.setFontSize(9);
  doc.text(`Rs. ${formatNum(invoice.grand_total)}`, colX[8] - 2, totalRowY + 4.5, { align: 'right' });

  currentY = tableBottomY;

  // --------------------------------------------------------------------------
  // 5. AMOUNT IN WORDS ROW
  // --------------------------------------------------------------------------
  doc.rect(margin, currentY, contentWidth, 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...textColor);
  doc.text('Amount Chargeable (in Words):', margin + 3, currentY + 4.2);

  doc.setFont('helvetica', 'normal');
  const wordsText = numberToIndianWords(invoice.grand_total);
  doc.text(wordsText, margin + 42, currentY + 4.2);

  doc.setFont('helvetica', 'bolditalic');
  doc.text('E & O.E', margin + contentWidth - 3, currentY + 4.2, { align: 'right' });

  currentY += 6;

  // --------------------------------------------------------------------------
  // 6. HSN/SAC TAX BREAKDOWN TABLE (EXACT 186mm NO-CLIP GRID)
  // --------------------------------------------------------------------------
  const hsnMap: Record<string, { taxable: number; rate: number; taxAmount: number }> = {};
  items.forEach(it => {
    const h = it.hsn_code || '-';
    const rate = it.gst_percent || 0;
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    const taxable = qty * price;
    const tax = (taxable * rate) / 100;

    if (!hsnMap[h]) {
      hsnMap[h] = { taxable: 0, rate, taxAmount: 0 };
    }
    hsnMap[h].taxable += taxable;
    hsnMap[h].taxAmount += tax;
  });

  let hsnHead: any[];
  let hsnBody: any[];
  let hsnColStyles: any;

  if (isIgst) {
    // Total = 38 + 42 + 24 + 42 + 40 = 186mm
    hsnColStyles = {
      0: { cellWidth: 38, halign: 'left' },
      1: { cellWidth: 42, halign: 'right' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 42, halign: 'right' },
      4: { cellWidth: 40, halign: 'right' }
    };

    hsnHead = [
      [
        { content: 'HSN/SAC', rowSpan: 2, styles: { halign: 'left' } },
        { content: 'Taxable Value', rowSpan: 2, styles: { halign: 'right' } },
        { content: 'IGST', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Total Tax Amount', rowSpan: 2, styles: { halign: 'right' } }
      ],
      [
        { content: 'Rate', styles: { halign: 'center' } },
        { content: 'Amount', styles: { halign: 'right' } }
      ]
    ];

    hsnBody = Object.entries(hsnMap).map(([hsn, val]) => [
      hsn,
      formatNum(val.taxable),
      val.rate.toFixed(1),
      formatNum(val.taxAmount),
      formatNum(val.taxAmount)
    ]);

    hsnBody.push([
      { content: 'TOTAL', styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatNum(invoice.subtotal), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: '-', styles: { halign: 'center' } },
      { content: formatNum(invoice.igst), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatNum(invoice.igst), styles: { fontStyle: 'bold', halign: 'right' } }
    ]);
  } else {
    // Total = 26 + 28 + 18 + 28 + 18 + 28 + 40 = 186mm
    hsnColStyles = {
      0: { cellWidth: 26, halign: 'left' },
      1: { cellWidth: 28, halign: 'right' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 40, halign: 'right' }
    };

    hsnHead = [
      [
        { content: 'HSN/SAC', rowSpan: 2, styles: { halign: 'left' } },
        { content: 'Taxable Value', rowSpan: 2, styles: { halign: 'right' } },
        { content: 'Central Tax', colSpan: 2, styles: { halign: 'center' } },
        { content: 'State Tax', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Total Tax Amount', rowSpan: 2, styles: { halign: 'right' } }
      ],
      [
        { content: 'Rate', styles: { halign: 'center' } },
        { content: 'Amount', styles: { halign: 'right' } },
        { content: 'Rate', styles: { halign: 'center' } },
        { content: 'Amount', styles: { halign: 'right' } }
      ]
    ];

    hsnBody = Object.entries(hsnMap).map(([hsn, val]) => {
      const halfRate = (val.rate / 2).toFixed(1);
      const halfTax = val.taxAmount / 2;
      return [
        hsn,
        formatNum(val.taxable),
        halfRate,
        formatNum(halfTax),
        halfRate,
        formatNum(halfTax),
        formatNum(val.taxAmount)
      ];
    });

    hsnBody.push([
      { content: 'TOTAL', styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatNum(invoice.subtotal), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: '-', styles: { halign: 'center' } },
      { content: formatNum(invoice.cgst), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: '-', styles: { halign: 'center' } },
      { content: formatNum(invoice.sgst), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatNum(invoice.cgst + invoice.sgst), styles: { fontStyle: 'bold', halign: 'right' } }
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: hsnHead,
    body: hsnBody,
    theme: 'grid',
    columnStyles: hsnColStyles,
    headStyles: {
      fillColor: headerBg,
      textColor: textColor,
      fontStyle: 'bold',
      fontSize: 7.2,
      lineWidth: 0.2,
      lineColor: tableBorderColor
    },
    styles: {
      fontSize: 7.2,
      cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
      textColor: textColor,
      lineWidth: 0.2,
      lineColor: tableBorderColor
    }
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // --------------------------------------------------------------------------
  // 7. FOOTER BOX: BANK DETAILS, UPI QR & AUTHORISED SIGNATORY
  // --------------------------------------------------------------------------
  const footerBoxHeight = 32;
  const footerBoxY = currentY;

  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.rect(margin, footerBoxY, contentWidth, footerBoxHeight);

  // Split footer: Left (Bank & Terms 115mm) | Right (Authorised Signatory 71mm)
  const leftFooterWidth = 115;
  const rightFooterX = margin + leftFooterWidth;
  doc.line(rightFooterX, footerBoxY, rightFooterX, footerBoxY + footerBoxHeight);

  // Bank & Terms Left Content
  let fbY = footerBoxY + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...textColor);
  doc.text('Bank Payment Details:', margin + 3, fbY);
  fbY += 3.4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(`Bank: ${business.bank_name || 'N/A'}`, margin + 3, fbY);
  doc.text(`A/C No: ${business.account_no || 'N/A'}`, margin + 45, fbY);
  fbY += 3.2;
  doc.text(`IFSC: ${business.ifsc || 'N/A'}`, margin + 3, fbY);
  doc.text(`UPI ID: ${business.upi_id || 'N/A'}`, margin + 45, fbY);
  fbY += 4.5;

  // Terms & Conditions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Terms and Conditions:', margin + 3, fbY);
  fbY += 3.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(...grayText);
  const termsText = business.terms_conditions || '1. Goods once sold will not be taken back.\n2. Payment due within 15 days of invoice date.\n3. Subject to local jurisdiction.';
  const termsLines = doc.splitTextToSize(termsText, leftFooterWidth - 6);
  doc.text(termsLines.slice(0, 3), margin + 3, fbY);

  // Right Side: Authorised Signatory Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textColor);
  const forBusinessText = `For ${sellerName}`;
  doc.text(forBusinessText, rightFooterX + (contentWidth - leftFooterWidth) / 2, footerBoxY + 5, { align: 'center' });

  // Signature image if available
  if (business.signature_url) {
    try {
      doc.addImage(
        business.signature_url,
        'PNG',
        rightFooterX + (contentWidth - leftFooterWidth) / 2 - 16,
        footerBoxY + 7,
        32,
        15
      );
    } catch (e) {
      // ignore
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textColor);
  doc.text('Authorised Signatory', rightFooterX + (contentWidth - leftFooterWidth) / 2, footerBoxY + footerBoxHeight - 3, { align: 'center' });

  // --------------------------------------------------------------------------
  // 8. BOTTOM CREATION WATERMARK
  // --------------------------------------------------------------------------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Created by BillKaro. Available on Android and iOS.', pageWidth / 2, 290, { align: 'center' });

  return doc;
}
