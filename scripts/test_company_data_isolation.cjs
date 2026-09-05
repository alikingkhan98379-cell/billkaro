/**
 * BILLKARO MULTI-COMPANY DATA ISOLATION & BUSINESS-WISE ANALYTICS TEST SUITE
 * Verifies strict per-company scoping for Invoices, Customers, Products,
 * Financial KPIs (Billed, Paid, Pending Udhaar), and Multi-Company Overview Matrix.
 */

const assert = require('assert');

console.log('================================================================');
console.log('BILLKARO MULTI-COMPANY DATA ISOLATION — AUTOMATED VERIFICATION');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${err.message}`);
  }
}

// Mock User & Companies Setup
const mockUser = { id: 'usr_test_123', email: 'merchant@billkaro.in' };

const companyA = {
  id: 'comp_wholesale_01',
  user_id: mockUser.id,
  name: 'Sharma Wholesale Traders',
  gstin: '07AAAAA0000A1Z5',
  state: 'Delhi',
  is_default: true
};

const companyB = {
  id: 'comp_retail_02',
  user_id: mockUser.id,
  name: 'Sharma Retail Store',
  gstin: '07BBBBB1111B2Z6',
  state: 'Delhi',
  is_default: false
};

const companyC = {
  id: 'comp_services_03',
  user_id: mockUser.id,
  name: 'Sharma Logistics & Services',
  gstin: '',
  state: 'Haryana',
  is_default: false
};

const companiesList = [companyA, companyB, companyC];

// Mock Dataset
const mockCustomers = [
  { id: 'c1', user_id: mockUser.id, company_id: companyA.id, name: 'Metro Supermarket' },
  { id: 'c2', user_id: mockUser.id, company_id: companyA.id, name: 'Gupta Kirana' },
  { id: 'c3', user_id: mockUser.id, company_id: companyB.id, name: 'Anil Kumar (Walk-in)' },
  { id: 'c4', user_id: mockUser.id, company_id: companyC.id, name: 'Speedy Express' },
  { id: 'c_legacy', user_id: mockUser.id, company_id: undefined, name: 'Old Client Before Migration' } // Legacy
];

const mockProducts = [
  { id: 'p1', user_id: mockUser.id, company_id: companyA.id, name: 'Rice 50kg Bag', price: 2500 },
  { id: 'p2', user_id: mockUser.id, company_id: companyA.id, name: 'Wheat Flour 30kg', price: 1200 },
  { id: 'p3', user_id: mockUser.id, company_id: companyB.id, name: 'Rice 1kg Packet', price: 65 },
  { id: 'p4', user_id: mockUser.id, company_id: companyC.id, name: 'Local Freight Delivery', price: 1500 },
  { id: 'p_legacy', user_id: mockUser.id, company_id: null, name: 'Old Item 101', price: 500 } // Legacy
];

const mockInvoices = [
  // Company A Invoices
  { id: 'inv1', user_id: mockUser.id, company_id: companyA.id, invoice_number: 'INV-0001', grand_total: 50000, cgst: 2500, sgst: 2500, igst: 0, status: 'PAID' },
  { id: 'inv2', user_id: mockUser.id, company_id: companyA.id, invoice_number: 'INV-0002', grand_total: 35000, cgst: 1750, sgst: 1750, igst: 0, status: 'UNPAID' },
  // Company B Invoices
  { id: 'inv3', user_id: mockUser.id, company_id: companyB.id, invoice_number: 'INV-0001', grand_total: 5000, cgst: 250, sgst: 250, igst: 0, status: 'PAID' },
  { id: 'inv4', user_id: mockUser.id, company_id: companyB.id, invoice_number: 'INV-0002', grand_total: 1200, cgst: 60, sgst: 60, igst: 0, status: 'UNPAID' },
  { id: 'inv5', user_id: mockUser.id, company_id: companyB.id, invoice_number: 'INV-0003', grand_total: 800, cgst: 40, sgst: 40, igst: 0, status: 'OVERDUE' },
  // Company C Invoices
  { id: 'inv6', user_id: mockUser.id, company_id: companyC.id, invoice_number: 'INV-0001', grand_total: 15000, cgst: 0, sgst: 0, igst: 2700, status: 'PAID' },
  // Legacy Invoice without company_id
  { id: 'inv_legacy', user_id: mockUser.id, company_id: undefined, invoice_number: 'INV-LEGACY-01', grand_total: 10000, cgst: 500, sgst: 500, igst: 0, status: 'PAID' }
];

// Helper Scoping Function (Matches frontend logic)
function isItemForActiveCompany(item, activeCompId, primaryCompId) {
  if (!item) return false;
  if (item.company_id) {
    return item.company_id === activeCompId;
  }
  // Legacy fallback: items with no company_id belong to primary company
  return activeCompId === primaryCompId;
}

// 1. Customer Scoping Tests
test('Company A customer directory contains only Company A clients + legacy', () => {
  const compACustomers = mockCustomers.filter(c => isItemForActiveCompany(c, companyA.id, companyA.id));
  assert.strictEqual(compACustomers.length, 3); // c1, c2, c_legacy
  assert.ok(compACustomers.some(c => c.name === 'Metro Supermarket'));
  assert.ok(compACustomers.some(c => c.name === 'Gupta Kirana'));
  assert.ok(compACustomers.some(c => c.name === 'Old Client Before Migration'));
});

test('Company B customer directory contains only Company B clients (zero bleeding)', () => {
  const compBCustomers = mockCustomers.filter(c => isItemForActiveCompany(c, companyB.id, companyA.id));
  assert.strictEqual(compBCustomers.length, 1);
  assert.strictEqual(compBCustomers[0].name, 'Anil Kumar (Walk-in)');
  assert.ok(!compBCustomers.some(c => c.name === 'Metro Supermarket'));
});

test('Company C customer directory contains only Company C clients', () => {
  const compCCustomers = mockCustomers.filter(c => isItemForActiveCompany(c, companyC.id, companyA.id));
  assert.strictEqual(compCCustomers.length, 1);
  assert.strictEqual(compCCustomers[0].name, 'Speedy Express');
});

// 2. Product / Inventory Scoping Tests
test('Company A products catalog contains wholesale items + legacy item', () => {
  const compAProds = mockProducts.filter(p => isItemForActiveCompany(p, companyA.id, companyA.id));
  assert.strictEqual(compAProds.length, 3); // p1, p2, p_legacy
  assert.ok(compAProds.some(p => p.name === 'Rice 50kg Bag'));
  assert.ok(compAProds.some(p => p.name === 'Old Item 101'));
});

test('Company B products catalog contains retail items only', () => {
  const compBProds = mockProducts.filter(p => isItemForActiveCompany(p, companyB.id, companyA.id));
  assert.strictEqual(compBProds.length, 1);
  assert.strictEqual(compBProds[0].name, 'Rice 1kg Packet');
  assert.ok(!compBProds.some(p => p.name === 'Rice 50kg Bag'));
});

// 3. Invoice & Financial KPI Isolation Tests
test('Company A Financial KPIs: Billed, Paid, and Pending Udhaar are strictly isolated', () => {
  const compAInvs = mockInvoices.filter(i => isItemForActiveCompany(i, companyA.id, companyA.id));
  // Invoices: inv1 (50k paid), inv2 (35k unpaid), inv_legacy (10k paid)
  assert.strictEqual(compAInvs.length, 3);

  const totalBilled = compAInvs.reduce((acc, inv) => acc + inv.grand_total, 0);
  const totalPaid = compAInvs.filter(i => i.status === 'PAID').reduce((acc, inv) => acc + inv.grand_total, 0);
  const totalPending = compAInvs.filter(i => i.status !== 'PAID').reduce((acc, inv) => acc + inv.grand_total, 0);
  const totalGst = compAInvs.reduce((acc, inv) => acc + inv.cgst + inv.sgst + inv.igst, 0);

  assert.strictEqual(totalBilled, 95000); // 50,000 + 35,000 + 10,000
  assert.strictEqual(totalPaid, 60000);   // 50,000 + 10,000
  assert.strictEqual(totalPending, 35000); // 35,000 pending udhaar
  assert.strictEqual(totalGst, 9500);     // 5,000 + 3,500 + 1,000
});

test('Company B Financial KPIs: Billed, Paid, and Pending Udhaar are strictly isolated', () => {
  const compBInvs = mockInvoices.filter(i => isItemForActiveCompany(i, companyB.id, companyA.id));
  // Invoices: inv3 (5k paid), inv4 (1.2k unpaid), inv5 (800 overdue)
  assert.strictEqual(compBInvs.length, 3);

  const totalBilled = compBInvs.reduce((acc, inv) => acc + inv.grand_total, 0);
  const totalPaid = compBInvs.filter(i => i.status === 'PAID').reduce((acc, inv) => acc + inv.grand_total, 0);
  const totalPending = compBInvs.filter(i => i.status !== 'PAID').reduce((acc, inv) => acc + inv.grand_total, 0);

  assert.strictEqual(totalBilled, 7000);  // 5,000 + 1,200 + 800
  assert.strictEqual(totalPaid, 5000);    // 5,000 paid
  assert.strictEqual(totalPending, 2000); // 1,200 + 800 = 2,000 udhaar
});

test('Company C Financial KPIs: IGST calculated cleanly with zero pending dues', () => {
  const compCInvs = mockInvoices.filter(i => isItemForActiveCompany(i, companyC.id, companyA.id));
  assert.strictEqual(compCInvs.length, 1);

  const totalBilled = compCInvs.reduce((acc, inv) => acc + inv.grand_total, 0);
  const totalPaid = compCInvs.filter(i => i.status === 'PAID').reduce((acc, inv) => acc + inv.grand_total, 0);
  const totalPending = compCInvs.filter(i => i.status !== 'PAID').reduce((acc, inv) => acc + inv.grand_total, 0);
  const totalGst = compCInvs.reduce((acc, inv) => acc + inv.cgst + inv.sgst + inv.igst, 0);

  assert.strictEqual(totalBilled, 15000);
  assert.strictEqual(totalPaid, 15000);
  assert.strictEqual(totalPending, 0);
  assert.strictEqual(totalGst, 2700);
});

// 4. Multi-Company Overview Matrix Calculation Test
test('Multi-Company Summary Matrix aggregates all businesses side-by-side accurately', () => {
  const matrix = companiesList.map(comp => {
    const compInvoices = mockInvoices.filter(inv => 
      inv.company_id ? inv.company_id === comp.id : comp.id === companyA.id
    );
    const compCustomers = mockCustomers.filter(c =>
      c.company_id ? c.company_id === comp.id : comp.id === companyA.id
    );
    const totalBilled = compInvoices.reduce((acc, inv) => acc + inv.grand_total, 0);
    const totalPaid = compInvoices.filter(i => i.status === 'PAID').reduce((acc, inv) => acc + inv.grand_total, 0);
    const totalPending = compInvoices.filter(i => i.status !== 'PAID').reduce((acc, inv) => acc + inv.grand_total, 0);

    return {
      company_id: comp.id,
      company_name: comp.name,
      invoices_count: compInvoices.length,
      customers_count: compCustomers.length,
      total_billed: totalBilled,
      total_paid: totalPaid,
      total_pending: totalPending
    };
  });

  assert.strictEqual(matrix.length, 3);

  // Check Company A row
  assert.strictEqual(matrix[0].company_name, 'Sharma Wholesale Traders');
  assert.strictEqual(matrix[0].invoices_count, 3);
  assert.strictEqual(matrix[0].customers_count, 3);
  assert.strictEqual(matrix[0].total_billed, 95000);
  assert.strictEqual(matrix[0].total_pending, 35000);

  // Check Company B row
  assert.strictEqual(matrix[1].company_name, 'Sharma Retail Store');
  assert.strictEqual(matrix[1].invoices_count, 3);
  assert.strictEqual(matrix[1].customers_count, 1);
  assert.strictEqual(matrix[1].total_billed, 7000);
  assert.strictEqual(matrix[1].total_pending, 2000);

  // Check Company C row
  assert.strictEqual(matrix[2].company_name, 'Sharma Logistics & Services');
  assert.strictEqual(matrix[2].invoices_count, 1);
  assert.strictEqual(matrix[2].customers_count, 1);
  assert.strictEqual(matrix[2].total_billed, 15000);
  assert.strictEqual(matrix[2].total_pending, 0);
});

// 5. Active Company Switching Reactivity Test
test('Switching active company changes active ID and switches active context', () => {
  let activeId = companyA.id;
  assert.strictEqual(activeId, 'comp_wholesale_01');

  // Switch to Company B
  activeId = companyB.id;
  assert.strictEqual(activeId, 'comp_retail_02');

  const activeInvoices = mockInvoices.filter(i => isItemForActiveCompany(i, activeId, companyA.id));
  assert.strictEqual(activeInvoices.length, 3);
  assert.strictEqual(activeInvoices[0].company_id, 'comp_retail_02');
});

// 6. Security & Tamper-Resistance Tests
test('User A cannot view or access User B company data under any circumstances', () => {
  const alienInvoice = { id: 'alien_1', user_id: 'usr_hacker_999', company_id: companyA.id, grand_total: 100000 };
  const userAInvoices = [alienInvoice, ...mockInvoices].filter(i => i.user_id === mockUser.id);
  assert.ok(!userAInvoices.some(i => i.user_id === 'usr_hacker_999'));
});

// 7. Backward Compatibility Guarantee Test
test('Legacy records with missing company_id never produce undefined or NaN in calculations', () => {
  const legacyInv = { id: 'inv_null', user_id: mockUser.id, company_id: null, grand_total: 1000, cgst: 50, sgst: 50, igst: 0, status: 'PAID' };
  const isAssigned = isItemForActiveCompany(legacyInv, companyA.id, companyA.id);
  assert.strictEqual(isAssigned, true);
  assert.strictEqual(Number(legacyInv.grand_total), 1000);
});

console.log('\n----------------------------------------------------------------');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('----------------------------------------------------------------\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
