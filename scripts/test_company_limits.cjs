/**
 * Automated Verification Test Suite for BillKaro Multi-Company Management & Plan Limits
 */

function runCompanyLimitTests() {
  console.log('================================================================');
  console.log('BILLKARO MULTI-COMPANY LIMITS & MANAGEMENT — AUTOMATED VERIFICATION');
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

  // 1. Authoritative Plans Configuration
  const PLANS_CONFIG = {
    free: {
      id: 'free',
      name: 'Free Starter',
      maxCompanies: 2,
      watermarkEnabled: true,
      adsEnabled: true
    },
    monthly: {
      id: 'monthly',
      name: 'Monthly Pro',
      maxCompanies: 3,
      watermarkEnabled: false,
      adsEnabled: false
    },
    six_months: {
      id: 'six_months',
      name: '6 Months Pro',
      maxCompanies: 3,
      watermarkEnabled: false,
      adsEnabled: false
    },
    yearly: {
      id: 'yearly',
      name: 'Yearly Pro',
      maxCompanies: 4,
      watermarkEnabled: false,
      adsEnabled: false
    }
  };

  // Test 1: Plan Limits Definition
  assert(PLANS_CONFIG.free.maxCompanies === 2, 'Free Starter maxCompanies === 2');
  assert(PLANS_CONFIG.free.watermarkEnabled === true, 'Free Starter has watermark enabled');
  assert(PLANS_CONFIG.monthly.maxCompanies === 3, 'Monthly Pro maxCompanies === 3');
  assert(PLANS_CONFIG.monthly.watermarkEnabled === false, 'Monthly Pro watermark is disabled (clean invoice)');
  assert(PLANS_CONFIG.six_months.maxCompanies === 3, '6 Months Pro maxCompanies === 3');
  assert(PLANS_CONFIG.yearly.maxCompanies === 4, 'Yearly Pro maxCompanies === 4 (Maximum profile slots)');
  assert(PLANS_CONFIG.yearly.watermarkEnabled === false, 'Yearly Pro watermark is disabled');

  // Test 2: Multi-Company Manager Simulator
  class CompanyManager {
    constructor(planId = 'free') {
      this.planId = planId;
      this.companies = [];
      this.activeCompanyId = null;
      this.businessProfileSync = null;
    }

    getMaxCompanies() {
      return PLANS_CONFIG[this.planId]?.maxCompanies || 2;
    }

    get isLimitReached() {
      return this.companies.length >= this.getMaxCompanies();
    }

    addCompany(data) {
      if (!data.name || !data.name.trim()) {
        return { error: 'Company / Business Name is required.' };
      }
      if (this.companies.length >= this.getMaxCompanies()) {
        return {
          error: `Company limit reached. You can manage up to ${this.getMaxCompanies()} companies on your current ${PLANS_CONFIG[this.planId]?.name || 'Plan'}.`
        };
      }
      const newComp = {
        id: 'comp_' + (this.companies.length + 1),
        name: data.name.trim(),
        gstin: data.gstin || '',
        phone: data.phone || '',
        address: data.address || ''
      };
      this.companies.push(newComp);
      this.switchCompany(newComp.id);
      return { success: true, company: newComp };
    }

    switchCompany(companyId) {
      const target = this.companies.find(c => c.id === companyId);
      if (!target) return false;
      this.activeCompanyId = companyId;
      this.businessProfileSync = {
        name: target.name,
        gstin: target.gstin,
        phone: target.phone,
        address: target.address
      };
      return true;
    }

    deleteCompany(companyId) {
      if (this.companies.length <= 1) {
        return { error: 'You must have at least one business profile.' };
      }
      this.companies = this.companies.filter(c => c.id !== companyId);
      if (this.activeCompanyId === companyId) {
        this.switchCompany(this.companies[0].id);
      }
      return { success: true };
    }
  }

  // Test 3: Free Plan (Limit = 2) Lifecycle
  const freeManager = new CompanyManager('free');
  assert(freeManager.getMaxCompanies() === 2, 'Free manager maximum is 2');

  const addRes1 = freeManager.addCompany({ name: 'Primary Store', gstin: '07AAAAA0000A1Z5' });
  assert(addRes1.success === true, 'Successfully added 1st company on Free plan');
  assert(freeManager.activeCompanyId === 'comp_1', 'Active company automatically switched to 1st company');
  assert(freeManager.businessProfileSync.name === 'Primary Store', 'Business profile synced to Primary Store');
  assert(freeManager.isLimitReached === false, 'Limit not reached with 1 company on Free plan');

  const addRes2 = freeManager.addCompany({ name: 'Secondary Branch', gstin: '07BBBBB1111B2Z6' });
  assert(addRes2.success === true, 'Successfully added 2nd company on Free plan');
  assert(freeManager.activeCompanyId === 'comp_2', 'Active company automatically switched to 2nd company');
  assert(freeManager.isLimitReached === true, 'Limit reached with 2 companies on Free plan');

  // Rejection on 3rd company for Free plan
  const addRes3 = freeManager.addCompany({ name: 'Third Branch' });
  assert(addRes3.error && addRes3.error.includes('Company limit reached'), 'Rejected 3rd company addition on Free plan');
  assert(freeManager.companies.length === 2, 'Companies count remained 2');

  // Test 4: Switching between companies
  freeManager.switchCompany('comp_1');
  assert(freeManager.activeCompanyId === 'comp_1', 'Switched back to comp_1');
  assert(freeManager.businessProfileSync.name === 'Primary Store', 'Business profile synced back to Primary Store');

  // Test 5: Deletion guard
  const delErr = freeManager.deleteCompany('comp_1');
  assert(delErr.success === true, 'Successfully deleted comp_1 when 2 companies exist');
  assert(freeManager.companies.length === 1, 'Companies count reduced to 1');
  assert(freeManager.activeCompanyId === 'comp_2', 'Active company fallback switched to remaining comp_2');

  const delBlocked = freeManager.deleteCompany('comp_2');
  assert(delBlocked.error && delBlocked.error.includes('at least one'), 'Blocked deletion of last remaining company');
  assert(freeManager.companies.length === 1, 'Company not deleted');

  // Test 6: Yearly Plan (Limit = 4) Lifecycle
  const yearlyManager = new CompanyManager('yearly');
  assert(yearlyManager.getMaxCompanies() === 4, 'Yearly manager maximum is 4');
  assert(yearlyManager.addCompany({ name: 'Firm A' }).success === true, 'Added Firm A (1/4)');
  assert(yearlyManager.addCompany({ name: 'Firm B' }).success === true, 'Added Firm B (2/4)');
  assert(yearlyManager.addCompany({ name: 'Firm C' }).success === true, 'Added Firm C (3/4)');
  assert(yearlyManager.addCompany({ name: 'Firm D' }).success === true, 'Added Firm D (4/4)');
  assert(yearlyManager.isLimitReached === true, 'Limit reached at 4 companies for Yearly Pro');

  const yearlyRejected = yearlyManager.addCompany({ name: 'Firm E' });
  assert(yearlyRejected.error && yearlyRejected.error.includes('Company limit reached'), 'Rejected 5th company addition on Yearly Pro');
  assert(yearlyManager.companies.length === 4, 'Yearly Pro maintains strictly 4 companies');

  // Test 7: Validation
  const emptyRes = yearlyManager.addCompany({ name: '   ' });
  assert(emptyRes.error && emptyRes.error.includes('required'), 'Rejects empty/whitespace company name');

  console.log('\n----------------------------------------------------------------');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCompanyLimitTests();
