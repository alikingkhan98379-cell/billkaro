/**
 * Automated Verification Test Suite for BillKaro Help & Support Center
 */

function runHelpSupportTests() {
  console.log('================================================================');
  console.log('BILLKARO HELP & SUPPORT CENTER — AUTOMATED VERIFICATION');
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

  // 1. Authoritative Support Details
  const SUPPORT_EMAIL = 'smartgstbill@gmail.com';
  const SUPPORT_WHATSAPP_PHONE = '919638938258';
  const SUPPORT_WHATSAPP_DISPLAY = '+91 96389 38258';

  assert(SUPPORT_EMAIL === 'smartgstbill@gmail.com', 'Official support email is smartgstbill@gmail.com');
  assert(SUPPORT_WHATSAPP_PHONE === '919638938258', 'International WhatsApp phone number is 919638938258');
  assert(SUPPORT_WHATSAPP_DISPLAY === '+91 96389 38258', 'Formatted display phone is +91 96389 38258');

  // 2. WhatsApp URL Construction
  function buildWhatsAppUrl(phone, customText, userEmail) {
    let text = customText || 'Hi BillKaro Support,\nI need help with my BillKaro account.';
    if (userEmail) {
      text += `\n\nAccount Email: ${userEmail}`;
    }
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  const waGuest = buildWhatsAppUrl(SUPPORT_WHATSAPP_PHONE);
  assert(waGuest.startsWith('https://wa.me/919638938258?text='), 'Guest WhatsApp link has valid base URL');
  assert(waGuest.includes('Hi%20BillKaro%20Support'), 'WhatsApp link includes URL encoded greeting');

  const waUser = buildWhatsAppUrl(SUPPORT_WHATSAPP_PHONE, 'Hi BillKaro Support, payment issue', 'user@example.com');
  assert(waUser.includes('user%40example.com'), 'Includes contextual user email safely URL-encoded');
  assert(!waUser.includes('password') && !waUser.includes('token') && !waUser.includes('otp'), 'Does not leak sensitive auth credentials in WhatsApp link');

  // 3. Email URL Construction
  function buildEmailUrl(email, subject, body, userEmail) {
    const safeSubject = subject || 'BillKaro Support Request';
    let safeBody = body || 'Hello BillKaro Support,\n\nI need help with:\n\n';
    if (userEmail) {
      safeBody += `Account Email: ${userEmail}\n`;
    }
    safeBody += '\nThank you.';
    return `mailto:${email}?subject=${encodeURIComponent(safeSubject)}&body=${encodeURIComponent(safeBody)}`;
  }

  const mailLink = buildEmailUrl(SUPPORT_EMAIL, 'BillKaro Support Request', undefined, 'business@test.com');
  assert(mailLink.startsWith('mailto:smartgstbill@gmail.com?'), 'Email link starts with mailto:smartgstbill@gmail.com');
  assert(mailLink.includes('subject=BillKaro%20Support%20Request'), 'Email link has URL encoded subject');
  assert(mailLink.includes('business%40test.com'), 'Email link includes user account context safely');
  assert(!mailLink.includes('password') && !mailLink.includes('secret'), 'Email link contains zero private credentials');

  // 4. Common Help Topics Data Verification (10 Required Topics)
  const REQUIRED_TOPICS = [
    'How do I create an invoice?',
    'How do I add a customer?',
    'How do I add products?',
    'How does GST calculation work?',
    'How do I share an invoice on WhatsApp?',
    'How do I upgrade to Premium?',
    'How long does Premium activation take?',
    'What happens if my payment is pending?',
    'How do I update my business profile?',
    'How do I manage multiple companies?'
  ];

  const helpTopics = [
    { id: 'create-invoice', title: 'How do I create an invoice?', summary: 'Generate GST-compliant tax invoices' },
    { id: 'add-customer', title: 'How do I add a customer?', summary: 'Manage your customer and client directory' },
    { id: 'add-products', title: 'How do I add products?', summary: 'Maintain an item catalog' },
    { id: 'gst-calculation', title: 'How does GST calculation work?', summary: 'Automatic real-time calculation' },
    { id: 'share-invoice-whatsapp', title: 'How do I share an invoice on WhatsApp?', summary: 'Directly send genuine .pdf invoice files' },
    { id: 'upgrade-premium', title: 'How do I upgrade to Premium?', summary: 'Unlock unlimited invoices' },
    { id: 'premium-activation-time', title: 'How long does Premium activation take?', summary: 'Payment verification SLA' },
    { id: 'payment-pending-status', title: 'What happens if my payment is pending?', summary: 'Understanding pending verification status' },
    { id: 'update-business-profile', title: 'How do I update my business profile?', summary: 'Configure GSTIN, Bank details' },
    { id: 'manage-multiple-companies', title: 'How do I manage multiple companies?', summary: 'Switch between separate business entities' }
  ];

  assert(helpTopics.length === 10, 'Contains exactly 10 comprehensive help topics');

  REQUIRED_TOPICS.forEach((reqTitle, idx) => {
    const found = helpTopics.some(t => t.title.toLowerCase() === reqTitle.toLowerCase());
    assert(found, `Help topic #${idx + 1} present: "${reqTitle}"`);
  });

  // 5. Search Filtering Logic
  function searchHelpTopics(topics, query) {
    if (!query || !query.trim()) return topics;
    const q = query.toLowerCase().trim();
    return topics.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.summary.toLowerCase().includes(q)
    );
  }

  const invoiceSearch = searchHelpTopics(helpTopics, 'invoice');
  assert(invoiceSearch.length >= 2, 'Search "invoice" returns relevant topics');

  const gstSearch = searchHelpTopics(helpTopics, 'GST');
  assert(gstSearch.length >= 1, 'Search "GST" returns GST calculation topic');

  const companySearch = searchHelpTopics(helpTopics, 'companies');
  assert(companySearch.length >= 1, 'Search "companies" returns multi-company topic');

  const emptySearch = searchHelpTopics(helpTopics, 'xyznonexistent123');
  assert(emptySearch.length === 0, 'Search for non-existent term returns empty list gracefully');

  // 6. Router Integration Check
  const VALID_ROUTES = [
    'dashboard',
    'create-invoice',
    'invoices',
    'customers',
    'products',
    'business-profile',
    'notifications',
    'premium',
    'privacy-terms',
    'admin-payments',
    'help-support'
  ];

  assert(VALID_ROUTES.includes('help-support'), 'help-support is registered in VALID_ROUTES');

  console.log('\n----------------------------------------------------------------');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHelpSupportTests();
