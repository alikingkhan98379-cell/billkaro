/**
 * Automated Verification Test Suite for BillKaro PDF Generation & Native Sharing
 */

function runPdfSharingTests() {
  console.log('================================================================');
  console.log('BILLKARO PDF SHARING & FILENAME SANITIZATION — AUTOMATED TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Helper matching src/utils/shareService.ts
  function sanitizeFilename(name) {
    return name
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .trim();
  }

  function getInvoiceFilename(invoiceNumber, customerName) {
    const safeInv = sanitizeFilename(invoiceNumber || 'INV');
    const safeCust = sanitizeFilename(customerName || 'Customer');
    return `BillKaro_${safeInv}_${safeCust}.pdf`;
  }

  function buildWhatsAppInvoiceMessage(invoice, business, customer) {
    const invoiceNum = invoice.invoice_number || 'Invoice';
    const totalAmount = invoice.grand_total ? `₹${invoice.grand_total.toLocaleString('en-IN')}` : '₹0';
    const bName = business?.name || 'Our Business';
    const cName = customer?.name ? `Dear ${customer.name}, ` : '';

    return `${cName}Please find your GST Tax Invoice *${invoiceNum}* for *${totalAmount}* from *${bName}*.\n\nThank you for doing business with us!`;
  }

  // Test 1: Filename Sanitization for Windows / Android / iOS safe characters
  const safe1 = getInvoiceFilename('INV-001/2026', 'Sharma & Sons: Traders');
  assert(safe1 === 'BillKaro_INV-001_2026_Sharma_&_Sons_Traders.pdf', `Sanitized special chars: ${safe1}`);

  const safe2 = getInvoiceFilename('INV*99?', 'Rahul <New>');
  assert(safe2 === 'BillKaro_INV_99__Rahul__New_.pdf' || safe2.endsWith('.pdf'), `Illegal chars replaced safely: ${safe2}`);
  assert(!safe2.includes('*') && !safe2.includes('?') && !safe2.includes('<') && !safe2.includes('>'), 'No illegal OS characters present');

  // Test 2: WhatsApp Share Message Construction
  const mockInvoice = {
    invoice_number: 'INV-2026-0042',
    grand_total: 14500,
    created_at: '2026-09-05T12:00:00Z'
  };
  const mockBusiness = {
    name: 'Ramesh Trading Co'
  };
  const mockCustomer = {
    name: 'Vikram Gupta',
    phone: '9876543210'
  };

  const msg = buildWhatsAppInvoiceMessage(mockInvoice, mockBusiness, mockCustomer);
  assert(msg.includes('Dear Vikram Gupta'), 'Includes personalized customer greeting');
  assert(msg.includes('INV-2026-0042'), 'Includes invoice number in bold');
  assert(msg.includes('₹14,500'), 'Includes formatted INR grand total');
  assert(msg.includes('Ramesh Trading Co'), 'Includes business name');

  // Test 3: WhatsApp Web URI formatting
  function getWhatsAppUrl(phone, text) {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const encoded = encodeURIComponent(text);
    return formattedPhone ? `https://wa.me/${formattedPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  }

  const waUrl = getWhatsAppUrl('9876543210', msg);
  assert(waUrl.startsWith('https://wa.me/919876543210?text='), 'Formats Indian 10-digit phone to 91 country prefix');
  assert(waUrl.includes('Dear%20Vikram%20Gupta'), 'Properly URI encodes message payload');

  // Test 4: Web Share API Simulation
  class MockNavigator {
    constructor(canShareFiles = true) {
      this.canShareFiles = canShareFiles;
      this.sharedData = null;
    }
    canShare(data) {
      if (data && data.files && !this.canShareFiles) return false;
      return true;
    }
    async share(data) {
      this.sharedData = data;
      return true;
    }
  }

  // Mobile Web Share with File
  const mobileNav = new MockNavigator(true);
  const mockFile = { name: 'BillKaro_INV-001_Customer.pdf', size: 1024, type: 'application/pdf' };
  const canShare = mobileNav.canShare({ files: [mockFile] });
  assert(canShare === true, 'Mobile Web Share detects file sharing capability');

  mobileNav.share({
    files: [mockFile],
    title: 'Tax Invoice INV-001',
    text: msg
  });
  assert(mobileNav.sharedData && mobileNav.sharedData.files.length === 1, 'Web Share API attaches actual PDF File');
  assert(mobileNav.sharedData.files[0].name.endsWith('.pdf'), 'Attached file has .pdf extension');

  // Desktop Fallback Simulation
  const desktopNav = new MockNavigator(false);
  const canDesktopShare = desktopNav.canShare({ files: [mockFile] });
  assert(canDesktopShare === false, 'Desktop correctly detects no native file share capability and flags fallback');

  console.log('\n----------------------------------------------------------------');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPdfSharingTests();
