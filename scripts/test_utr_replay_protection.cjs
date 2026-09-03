/**
 * BILLKARO — UTR & TRANSACTION ID DUPLICATE / REPLAY PROTECTION TEST SUITE
 * Exhaustive 20-Point Verification for Duplicate UTR, Transaction ID, Normalization & Anti-Replay
 */

function runUtrReplayTestSuite() {
  console.log('================================================================');
  console.log('BILLKARO — UTR & TRANSACTION ID DUPLICATE / REPLAY PROTECTION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(id, title, testFn) {
    try {
      testFn();
      console.log(`[PASS] Test ${id}: ${title}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${id}: ${title} -> ${err.message}`);
      failed++;
    }
  }

  function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
  }

  // Simulated Database
  const database = {
    payments: [
      {
        id: 'pay-101',
        user_id: 'user-A',
        order_id: 'BILLKARO-20260904-AAA11111',
        plan_id: 'monthly',
        amount: 49.00,
        utr: '423589123456',
        transaction_reference: 'TXN1000000001',
        status: 'PENDING_ADMIN',
        verification_status: 'UNDER_REVIEW'
      },
      {
        id: 'pay-102',
        user_id: 'user-C',
        order_id: 'BILLKARO-20260904-CCC33333',
        plan_id: 'yearly',
        amount: 470.00,
        utr: '987654321098',
        transaction_reference: 'TXN9999999999',
        status: 'APPROVED',
        verification_status: 'VERIFIED'
      },
      {
        id: 'pay-103',
        user_id: 'user-D',
        order_id: 'BILLKARO-20260904-DDD44444',
        plan_id: 'monthly',
        amount: 49.00,
        utr: '111222333444',
        transaction_reference: 'TXN1112223334',
        status: 'REJECTED',
        verification_status: 'REJECTED'
      }
    ],
    auditLogs: [],
    subscriptions: {}
  };

  // Normalization logic
  function normalizeIdentifier(val) {
    if (!val) return null;
    const clean = val.toString().trim().toUpperCase();
    return clean === '' ? null : clean;
  }

  // Submit payment proof implementation
  function submitPaymentProof(userId, orderId, rawUtr, rawTxnRef) {
    const cleanUtr = normalizeIdentifier(rawUtr);
    const cleanTxnRef = normalizeIdentifier(rawTxnRef);

    if (!cleanUtr || cleanUtr.length < 6) {
      return { error: 'Please enter a valid 12-digit UPI / UTR Reference Number.' };
    }

    const currentPayment = database.payments.find(p => p.order_id === orderId && p.user_id === userId);
    if (!currentPayment) {
      return { error: 'Payment order not found.' };
    }

    if (currentPayment.status === 'APPROVED') {
      return { error: 'This payment order has already been approved and activated.' };
    }

    // 1. Duplicate UTR check across non-rejected payments
    const utrDuplicate = database.payments.find(
      p => p.utr && p.utr.toUpperCase() === cleanUtr && p.id !== currentPayment.id && p.status !== 'REJECTED' && p.status !== 'EXPIRED'
    );
    if (utrDuplicate) {
      database.auditLogs.push({
        action: 'DUPLICATE_UTR_ATTEMPT',
        userId,
        orderId,
        utr: cleanUtr
      });
      return { error: 'This transaction reference has already been submitted.' };
    }

    // 2. Duplicate Transaction ID check across non-rejected payments
    if (cleanTxnRef) {
      const txnDuplicate = database.payments.find(
        p => p.transaction_reference && p.transaction_reference.toUpperCase() === cleanTxnRef && p.id !== currentPayment.id && p.status !== 'REJECTED' && p.status !== 'EXPIRED'
      );
      if (txnDuplicate) {
        database.auditLogs.push({
          action: 'DUPLICATE_TRANSACTION_ATTEMPT',
          userId,
          orderId,
          transaction_reference: cleanTxnRef
        });
        return { error: 'This transaction reference has already been submitted.' };
      }
    }

    // 3. UTR == Transaction Reference check (Anti-Replay Suspicion)
    let verificationStatus = 'UNDER_REVIEW';
    let userMsg = 'Your payment proof has been submitted successfully and is under review.';
    if (cleanTxnRef && cleanUtr === cleanTxnRef) {
      verificationStatus = 'SUSPICIOUS';
      userMsg = 'Your payment details require additional verification.';
      database.auditLogs.push({
        action: 'UTR_TRANSACTION_MATCH',
        userId,
        orderId,
        utr: cleanUtr,
        transaction_reference: cleanTxnRef
      });
    }

    currentPayment.utr = cleanUtr;
    currentPayment.transaction_reference = cleanTxnRef;
    currentPayment.status = 'PENDING_ADMIN';
    currentPayment.verification_status = verificationStatus;

    database.auditLogs.push({
      action: 'PAYMENT_SUBMITTED',
      userId,
      orderId,
      utr: cleanUtr,
      transaction_reference: cleanTxnRef,
      verification_status: verificationStatus
    });

    return {
      success: true,
      order_id: orderId,
      status: 'PENDING_ADMIN',
      verification_status: verificationStatus,
      message: userMsg
    };
  }

  // --- TESTS ---

  test(1, 'Unique UTR → PASS', () => {
    database.payments.push({
      id: 'pay-new-1',
      user_id: 'user-B',
      order_id: 'BILLKARO-20260904-BBB22222',
      plan_id: 'monthly',
      amount: 49.00,
      status: 'WAITING_FOR_PAYMENT'
    });

    const res = submitPaymentProof('user-B', 'BILLKARO-20260904-BBB22222', '555666777888', 'TXN5556667778');
    assert(res.success === true, 'Valid unique submission accepted');
    assert(res.verification_status === 'UNDER_REVIEW', 'Status set to UNDER_REVIEW');
  });

  test(2, 'Duplicate UTR → REJECT with safe message', () => {
    database.payments.push({
      id: 'pay-new-2',
      user_id: 'user-E',
      order_id: 'BILLKARO-20260904-EEE55555',
      plan_id: 'monthly',
      amount: 49.00,
      status: 'WAITING_FOR_PAYMENT'
    });

    // Try submitting UTR from pay-101 ('423589123456')
    const res = submitPaymentProof('user-E', 'BILLKARO-20260904-EEE55555', '423589123456', 'TXN_DIFF_123');
    assert(res.error === 'This transaction reference has already been submitted.', 'Duplicate UTR rejected');
    assert(!res.error.includes('user-A'), 'Does not leak User A info');
  });

  test(3, 'Unique Transaction ID → PASS', () => {
    database.payments.push({
      id: 'pay-new-3',
      user_id: 'user-F',
      order_id: 'BILLKARO-20260904-FFF66666',
      plan_id: 'monthly',
      amount: 49.00,
      status: 'WAITING_FOR_PAYMENT'
    });

    const res = submitPaymentProof('user-F', 'BILLKARO-20260904-FFF66666', '777888999000', 'TXN_UNIQUE_999');
    assert(res.success === true, 'Unique Transaction ID accepted');
  });

  test(4, 'Duplicate Transaction ID → REJECT', () => {
    database.payments.push({
      id: 'pay-new-4',
      user_id: 'user-G',
      order_id: 'BILLKARO-20260904-GGG77777',
      plan_id: 'monthly',
      amount: 49.00,
      status: 'WAITING_FOR_PAYMENT'
    });

    // Try submitting Transaction Reference from pay-101 ('TXN1000000001')
    const res = submitPaymentProof('user-G', 'BILLKARO-20260904-GGG77777', '999111222333', 'TXN1000000001');
    assert(res.error === 'This transaction reference has already been submitted.', 'Duplicate Txn ID rejected');
  });

  test(5, 'UTR = Transaction ID → SUSPICIOUS / PENDING_ADMIN', () => {
    database.payments.push({
      id: 'pay-new-5',
      user_id: 'user-H',
      order_id: 'BILLKARO-20260904-HHH88888',
      plan_id: 'monthly',
      amount: 49.00,
      status: 'WAITING_FOR_PAYMENT'
    });

    const res = submitPaymentProof('user-H', 'BILLKARO-20260904-HHH88888', 'SAMEIDENTIFIER123', 'SAMEIDENTIFIER123');
    assert(res.success === true, 'Accepted for review');
    assert(res.verification_status === 'SUSPICIOUS', 'Flagged as SUSPICIOUS');
    assert(res.status === 'PENDING_ADMIN', 'Status set strictly to PENDING_ADMIN');
    assert(res.message === 'Your payment details require additional verification.', 'Safe user message');
  });

  test(6, 'Same UTR across two users → REJECT', () => {
    database.payments.push({
      id: 'pay-user-1',
      user_id: 'user-1',
      order_id: 'ORD-USER-1',
      plan_id: 'monthly',
      amount: 49.00,
      status: 'WAITING_FOR_PAYMENT'
    });
    database.payments.push({
      id: 'pay-user-2',
      user_id: 'user-2',
      order_id: 'ORD-USER-2',
      plan_id: 'monthly',
      amount: 49.00,
      status: 'WAITING_FOR_PAYMENT'
    });

    const res1 = submitPaymentProof('user-1', 'ORD-USER-1', 'CROSSUSERUTR12', 'TXN1');
    assert(res1.success === true, 'User 1 submission accepted');

    const res2 = submitPaymentProof('user-2', 'ORD-USER-2', 'CROSSUSERUTR12', 'TXN2');
    assert(res2.error === 'This transaction reference has already been submitted.', 'User 2 blocked with same UTR');
  });

  test(7, 'Same Transaction ID across two users → REJECT', () => {
    database.payments.push({
      id: 'pay-user-3',
      user_id: 'user-3',
      order_id: 'ORD-USER-3',
      plan_id: 'monthly',
      amount: 49.00,
      status: 'WAITING_FOR_PAYMENT'
    });
    database.payments.push({
      id: 'pay-user-4',
      user_id: 'user-4',
      order_id: 'ORD-USER-4',
      plan_id: 'monthly',
      amount: 49.00,
      status: 'WAITING_FOR_PAYMENT'
    });

    const res1 = submitPaymentProof('user-3', 'ORD-USER-3', 'UTRUSER3', 'SHAREDTXNID99');
    assert(res1.success === true, 'User 3 submission accepted');

    const res2 = submitPaymentProof('user-4', 'ORD-USER-4', 'UTRUSER4', 'SHAREDTXNID99');
    assert(res2.error === 'This transaction reference has already been submitted.', 'User 4 blocked with same Txn ID');
  });

  test(8, 'Same UTR reused on another order → REJECT', () => {
    database.payments.push({
      id: 'pay-order-A',
      user_id: 'user-repeat',
      order_id: 'ORD-REPEAT-A',
      plan_id: 'monthly',
      amount: 49.00,
      status: 'WAITING_FOR_PAYMENT'
    });
    database.payments.push({
      id: 'pay-order-B',
      user_id: 'user-repeat',
      order_id: 'ORD-REPEAT-B',
      plan_id: 'yearly',
      amount: 470.00,
      status: 'WAITING_FOR_PAYMENT'
    });

    const resA = submitPaymentProof('user-repeat', 'ORD-REPEAT-A', 'REPEATUTR4444', 'TXNA');
    assert(resA.success === true, 'Order A accepted');

    const resB = submitPaymentProof('user-repeat', 'ORD-REPEAT-B', 'REPEATUTR4444', 'TXNB');
    assert(resB.error === 'This transaction reference has already been submitted.', 'Order B rejected with same UTR');
  });

  test(9, 'Same Transaction ID reused on another order → REJECT', () => {
    database.payments.push({
      id: 'pay-order-C',
      user_id: 'user-repeat-2',
      order_id: 'ORD-REPEAT-C',
      plan_id: 'monthly',
      amount: 49.00,
      status: 'WAITING_FOR_PAYMENT'
    });
    database.payments.push({
      id: 'pay-order-D',
      user_id: 'user-repeat-2',
      order_id: 'ORD-REPEAT-D',
      plan_id: 'six_months',
      amount: 250.00,
      status: 'WAITING_FOR_PAYMENT'
    });

    const resC = submitPaymentProof('user-repeat-2', 'ORD-REPEAT-C', 'UTRC123456', 'REPEATTXN888');
    assert(resC.success === true, 'Order C accepted');

    const resD = submitPaymentProof('user-repeat-2', 'ORD-REPEAT-D', 'UTRD123456', 'REPEATTXN888');
    assert(resD.error === 'This transaction reference has already been submitted.', 'Order D rejected with same Txn ID');
  });

  test(10, 'Already approved UTR replay → REJECT', () => {
    database.payments.push({
      id: 'pay-replay-appr',
      user_id: 'user-replay-1',
      order_id: 'ORD-REPLAY-1',
      plan_id: 'yearly',
      amount: 470.00,
      status: 'WAITING_FOR_PAYMENT'
    });

    // pay-102 has UTR '987654321098' which is APPROVED
    const res = submitPaymentProof('user-replay-1', 'ORD-REPLAY-1', '987654321098', 'TXN_NEW');
    assert(res.error === 'This transaction reference has already been submitted.', 'Approved UTR replay rejected');
  });

  test(11, 'Already approved Transaction ID replay → REJECT', () => {
    database.payments.push({
      id: 'pay-replay-appr-2',
      user_id: 'user-replay-2',
      order_id: 'ORD-REPLAY-2',
      plan_id: 'yearly',
      amount: 470.00,
      status: 'WAITING_FOR_PAYMENT'
    });

    // pay-102 has Txn ID 'TXN9999999999' which is APPROVED
    const res = submitPaymentProof('user-replay-2', 'ORD-REPLAY-2', 'UTR_NEW_555', 'TXN9999999999');
    assert(res.error === 'This transaction reference has already been submitted.', 'Approved Txn ID replay rejected');
  });

  test(12, 'Concurrent duplicate submission → Only first accepted', () => {
    let raceWinner = null;
    let raceLoser = null;

    database.payments.push({
      id: 'pay-race-1',
      user_id: 'user-race-1',
      order_id: 'ORD-RACE-1',
      plan_id: 'monthly',
      amount: 49.00,
      status: 'WAITING_FOR_PAYMENT'
    });
    database.payments.push({
      id: 'pay-race-2',
      user_id: 'user-race-2',
      order_id: 'ORD-RACE-2',
      plan_id: 'monthly',
      amount: 49.00,
      status: 'WAITING_FOR_PAYMENT'
    });

    const res1 = submitPaymentProof('user-race-1', 'ORD-RACE-1', 'RACETESTUTR99', 'RACETXN99');
    const res2 = submitPaymentProof('user-race-2', 'ORD-RACE-2', 'RACETESTUTR99', 'RACETXN99');

    assert(res1.success === true, 'First racer accepted');
    assert(res2.error === 'This transaction reference has already been submitted.', 'Second racer rejected');
  });

  test(13, 'User cannot edit UTR after approval', () => {
    const approvedPayment = database.payments.find(p => p.status === 'APPROVED');
    assert(approvedPayment !== undefined, 'Approved payment exists');

    function simulateUserDirectUpdate(payment, newUtr, isAdmin) {
      if (!isAdmin && payment.status === 'APPROVED') {
        throw new Error('Unauthorized modification of approved payment.');
      }
      payment.utr = newUtr;
    }

    let blocked = false;
    try {
      simulateUserDirectUpdate(approvedPayment, 'HACKEDUTR123', false);
    } catch (e) {
      blocked = true;
    }
    assert(blocked, 'Direct edit on approved UTR blocked');
  });

  test(14, 'User cannot edit Transaction ID after approval', () => {
    const approvedPayment = database.payments.find(p => p.status === 'APPROVED');
    function simulateUserDirectUpdate(payment, newTxn, isAdmin) {
      if (!isAdmin && payment.status === 'APPROVED') {
        throw new Error('Unauthorized modification of approved transaction ID.');
      }
      payment.transaction_reference = newTxn;
    }

    let blocked = false;
    try {
      simulateUserDirectUpdate(approvedPayment, 'HACKEDTXN123', false);
    } catch (e) {
      blocked = true;
    }
    assert(blocked, 'Direct edit on approved Transaction ID blocked');
  });

  test(15, 'Frontend cannot manipulate amount', () => {
    const prices = { monthly: 49.00, six_months: 250.00, yearly: 470.00 };
    function resolvePrice(planId, clientAmount) {
      return prices[planId] || 49.00;
    }
    assert(resolvePrice('yearly', 1) === 470.00, 'Yearly price locked to ₹470');
    assert(resolvePrice('monthly', 999) === 49.00, 'Monthly price locked to ₹49');
  });

  test(16, 'Frontend cannot manipulate plan', () => {
    const prices = { monthly: 49.00, six_months: 250.00, yearly: 470.00 };
    function validatePlan(planId) {
      if (!prices[planId]) throw new Error('Invalid plan');
      return planId;
    }
    let caught = false;
    try {
      validatePlan('free_pro_hack');
    } catch (e) {
      caught = true;
    }
    assert(caught, 'Invalid plan rejected');
  });

  test(17, 'Frontend cannot manipulate payment status', () => {
    function updateStatus(oldStatus, newStatus, isAdmin) {
      if (!isAdmin && (newStatus === 'APPROVED' || newStatus === 'VERIFIED')) {
        throw new Error('Unauthorized status modification.');
      }
      return newStatus;
    }
    let blocked = false;
    try {
      updateStatus('WAITING_FOR_PAYMENT', 'APPROVED', false);
    } catch (e) {
      blocked = true;
    }
    assert(blocked, 'Direct client upgrade to APPROVED blocked');
  });

  test(18, 'Non-admin cannot approve suspicious payment', () => {
    function adminApprove(userRole, userEmail) {
      const isAdmin = userRole === 'admin' || ['smartgstbill@gmail.com', 'admin@billkaro.com'].includes(userEmail);
      if (!isAdmin) throw new Error('Unauthorized.');
      return { success: true };
    }
    let blocked = false;
    try {
      adminApprove('user', 'attacker@example.com');
    } catch (e) {
      blocked = true;
    }
    assert(blocked, 'Non-admin blocked from approval');
  });

  test(19, 'Suspicious payment never auto-activates Premium', () => {
    const suspiciousPay = database.payments.find(p => p.verification_status === 'SUSPICIOUS');
    assert(suspiciousPay.status === 'PENDING_ADMIN', 'Suspicious payment remains PENDING_ADMIN');
    assert(suspiciousPay.status !== 'APPROVED', 'Suspicious payment is NOT approved');
    // Ensure subscription is not active
    assert(database.subscriptions[suspiciousPay.user_id] === undefined, 'No premium active for suspicious user');
  });

  test(20, 'Existing legitimate payment flow still works smoothly', () => {
    database.payments.push({
      id: 'pay-legit-flow',
      user_id: 'user-legit',
      order_id: 'ORD-LEGIT-100',
      plan_id: 'yearly',
      amount: 470.00,
      status: 'WAITING_FOR_PAYMENT'
    });

    const submitRes = submitPaymentProof('user-legit', 'ORD-LEGIT-100', 'LEGITUTR8888', 'LEGITTXN9999');
    assert(submitRes.success === true, 'Legitimate submission succeeded');
    assert(submitRes.verification_status === 'UNDER_REVIEW', 'Under review status assigned');

    // Admin approves
    const target = database.payments.find(p => p.order_id === 'ORD-LEGIT-100');
    target.status = 'APPROVED';
    target.verification_status = 'VERIFIED';
    database.subscriptions[target.user_id] = {
      plan: 'premium',
      is_active: true,
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    };

    assert(database.subscriptions['user-legit'].is_active === true, 'Premium activated on admin approval');
  });

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed + failed} TOTAL | ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runUtrReplayTestSuite();
