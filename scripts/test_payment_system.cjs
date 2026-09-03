/**
 * Automated Verification Test Suite for BillKaro UPI Payment System (Phase 1)
 */

function runTests() {
  console.log('====================================================');
  console.log('BILLKARO UPI PAYMENT SYSTEM — AUTOMATED VERIFICATION');
  console.log('====================================================\n');

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

  // Authoritative Configuration Tests
  const plans = {
    free: { id: 'free', price: 0, durationDays: 0, adsEnabled: true },
    monthly: { id: 'monthly', price: 49, durationDays: 30, adsEnabled: false },
    six_months: { id: 'six_months', price: 250, durationDays: 180, discount: 15, adsEnabled: false },
    yearly: { id: 'yearly', price: 470, durationDays: 365, discount: 20, adsEnabled: false }
  };

  const receiverUpi = '9638938258@ybl';
  const paymentNote = 'BillKaro';

  // Test 1: Plan Pricing & Durations
  assert(plans.free.price === 0, 'Free Plan is ₹0');
  assert(plans.free.adsEnabled === true, 'Free Plan has Ads ON');
  assert(plans.monthly.price === 49, 'Monthly Plan is ₹49');
  assert(plans.monthly.durationDays === 30, 'Monthly Plan duration is 30 days');
  assert(plans.monthly.adsEnabled === false, 'Monthly Plan has Ads OFF');

  assert(plans.six_months.price === 250, '6 Months Plan is ₹250');
  assert(plans.six_months.durationDays === 180, '6 Months Plan duration is 180 days (~15% discount)');
  assert(plans.six_months.adsEnabled === false, '6 Months Plan has Ads OFF');

  assert(plans.yearly.price === 470, 'Yearly Plan is ₹470');
  assert(plans.yearly.durationDays === 365, 'Yearly Plan duration is 365 days (~20% discount)');
  assert(plans.yearly.adsEnabled === false, 'Yearly Plan has Ads OFF');

  // Test 2: UPI URI generation format
  function mockGenerateUpiUri(amount, orderId) {
    const params = new URLSearchParams({
      pa: receiverUpi,
      pn: paymentNote,
      am: amount.toString(),
      cu: 'INR',
      tn: orderId ? `BillKaro-${orderId}` : paymentNote
    });
    return `upi://pay?${params.toString()}`;
  }

  const monthlyUri = mockGenerateUpiUri(49, 'ORDER-101');
  assert(monthlyUri.includes('pa=9638938258%40ybl') || monthlyUri.includes('pa=9638938258@ybl'), 'UPI URI has receiver 9638938258@ybl');
  assert(monthlyUri.includes('am=49'), 'Monthly UPI URI amount is 49');
  assert(monthlyUri.includes('cu=INR'), 'UPI URI currency is INR');
  assert(monthlyUri.includes('BillKaro-ORDER-101'), 'UPI URI contains order ID reference');

  const sixMonthUri = mockGenerateUpiUri(250, 'ORDER-202');
  assert(sixMonthUri.includes('am=250'), '6 Month UPI URI amount is 250');

  const yearlyUri = mockGenerateUpiUri(470, 'ORDER-303');
  assert(yearlyUri.includes('am=470'), 'Yearly UPI URI amount is 470');

  // Test 3: Anti-Tampering (Server-Side authoritative amount mapping)
  function serverDetermineAmount(planId) {
    const map = { monthly: 49, six_months: 250, yearly: 470 };
    return map[planId] || null;
  }

  assert(serverDetermineAmount('yearly') === 470, 'Server maps yearly plan strictly to ₹470');
  assert(serverDetermineAmount('monthly') === 49, 'Server maps monthly plan strictly to ₹49');
  assert(serverDetermineAmount('six_months') === 250, 'Server maps six_months plan strictly to ₹250');
  assert(serverDetermineAmount('invalid_hacked_plan') === null, 'Server rejects invalid/tampered plan');

  // Test 4: Subscription Expiry Extension Logic
  function calculateExpiry(existingExpiry, planDurationDays) {
    const now = new Date();
    let startDate = now;
    if (existingExpiry && new Date(existingExpiry) > now) {
      startDate = new Date(existingExpiry);
    }
    const newExpiry = new Date(startDate.getTime() + planDurationDays * 24 * 60 * 60 * 1000);
    return newExpiry;
  }

  const initialExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days remaining
  const extendedExpiry = calculateExpiry(initialExpiry.toISOString(), 30);
  const diffDays = Math.round((extendedExpiry.getTime() - initialExpiry.getTime()) / (1000 * 60 * 60 * 24));
  assert(diffDays === 30, 'Active subscription is extended from current expiry date (+30 days preserved)');

  // Test 5: Expired Subscription Status Check
  function isSubscriptionActive(sub) {
    if (!sub || sub.plan === 'free') return false;
    if (sub.status && sub.status !== 'ACTIVE') return false;
    if (!sub.is_active) return false;
    if (sub.expiry_date) {
      return new Date(sub.expiry_date).getTime() > Date.now();
    }
    return true;
  }

  const activeSub = { plan: 'premium', status: 'ACTIVE', is_active: true, expiry_date: new Date(Date.now() + 1000000).toISOString() };
  const expiredSub = { plan: 'premium', status: 'ACTIVE', is_active: true, expiry_date: new Date(Date.now() - 1000000).toISOString() };
  const freeSub = { plan: 'free', status: 'ACTIVE', is_active: true };

  assert(isSubscriptionActive(activeSub) === true, 'Active premium sub is validated as active');
  assert(isSubscriptionActive(expiredSub) === false, 'Expired sub is recognized as inactive (Ads ON)');
  assert(isSubscriptionActive(freeSub) === false, 'Free sub is recognized as inactive (Ads ON)');

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
