import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { Company, BusinessProfile } from '../types';
import { PLANS_CONFIG, PlanId } from '../config/plans';
import { isValidUUID, generateUUID } from '../utils/validators';

interface CompanyContextType {
  companies: Company[];
  activeCompany: Company | null;
  activeCompanyId: string;
  loading: boolean;
  maxCompanies: number;
  currentCount: number;
  isLimitReached: boolean;
  switchCompany: (companyId: string) => Promise<void>;
  addCompany: (companyData: Partial<Company>) => Promise<{ success?: boolean; error?: string; company?: Company }>;
  updateCompany: (companyId: string, updates: Partial<Company>) => Promise<{ success?: boolean; error?: string }>;
  deleteCompany: (companyId: string) => Promise<{ success?: boolean; error?: string }>;
  refreshCompanies: () => Promise<void>;
  isItemForActiveCompany: (item: { company_id?: string | null }) => boolean;
  resolveCompany: (companyId?: string | null) => Company | undefined;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, businessProfile, planId, isPremium, updateBusinessProfile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Authoritative Maximum Companies based on plan
  const planKey = (planId in PLANS_CONFIG ? planId : (isPremium ? 'monthly' : 'free')) as PlanId;
  const maxCompanies = PLANS_CONFIG[planKey]?.maxCompanies || 2;
  const currentCount = companies.length;
  const isLimitReached = currentCount >= maxCompanies;

  const storageKey = user ? `billkaro_companies_${user.id}` : 'billkaro_companies_guest';
  const activeKey = user ? `billkaro_active_company_${user.id}` : 'billkaro_active_company_guest';

  // Load companies from persistence and sync with businessProfile
  const loadCompanies = useCallback(() => {
    if (!user) {
      setCompanies([]);
      setActiveCompanyId('');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let list: Company[] = [];

      // 1. Check cloud database companies_data first (survives device / domain / browser changes)
      if (businessProfile?.companies_data && Array.isArray(businessProfile.companies_data) && businessProfile.companies_data.length > 0) {
        list = businessProfile.companies_data;
      } else {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            list = JSON.parse(saved);
          } catch (e) {
            list = [];
          }
        }
      }

      // Auto-migrate any non-UUID IDs to valid UUIDs to prevent PostgreSQL syntax errors
      let needsSave = false;
      list = list.map(c => {
        if (!isValidUUID(c.id)) {
          needsSave = true;
          return { ...c, id: generateUUID() };
        }
        return c;
      });

      // If no stored companies, seed from current businessProfile or create default
      if (list.length === 0) {
        const defaultId = isValidUUID(businessProfile?.id) ? businessProfile!.id : generateUUID();
        const defaultCompany: Company = {
          id: defaultId,
          user_id: user.id,
          name: businessProfile?.name && businessProfile.name !== 'My Business' ? businessProfile.name : 'My Business',
          full_name: businessProfile?.full_name || '',
          address: businessProfile?.address || '',
          phone: businessProfile?.phone || '',
          email: businessProfile?.email || user.email || '',
          gstin: businessProfile?.gstin || '',
          state: 'Delhi',
          logo_url: businessProfile?.logo_url || '',
          bank_name: businessProfile?.bank_name || '',
          account_no: businessProfile?.account_no || '',
          ifsc: businessProfile?.ifsc || '',
          signature_url: businessProfile?.signature_url || '',
          upi_id: businessProfile?.upi_id || '',
          terms_conditions: businessProfile?.terms_conditions || '',
          is_default: true,
          created_at: new Date().toISOString()
        };
        list = [defaultCompany];
        needsSave = true;
      } else if (businessProfile && businessProfile.name && businessProfile.name !== 'My Business') {
        // Sync active business profile updates back to list if matched
        const activeIdx = list.findIndex(c => c.id === businessProfile.id || c.name === businessProfile.name);
        if (activeIdx >= 0) {
          list[activeIdx] = {
            ...list[activeIdx],
            name: businessProfile.name,
            address: businessProfile.address,
            phone: businessProfile.phone,
            email: businessProfile.email,
            gstin: businessProfile.gstin,
            logo_url: businessProfile.logo_url,
            bank_name: businessProfile.bank_name,
            account_no: businessProfile.account_no,
            ifsc: businessProfile.ifsc,
            signature_url: businessProfile.signature_url,
            upi_id: businessProfile.upi_id,
            terms_conditions: businessProfile.terms_conditions
          };
          needsSave = true;
        }
      }

      if (needsSave) {
        localStorage.setItem(storageKey, JSON.stringify(list));
      }

      setCompanies(list);

      const savedActiveId = businessProfile?.active_company_id || localStorage.getItem(activeKey);
      if (savedActiveId && list.some(c => c.id === savedActiveId)) {
        setActiveCompanyId(savedActiveId);
      } else if (list.length > 0) {
        setActiveCompanyId(list[0].id);
        localStorage.setItem(activeKey, list[0].id);
      }
    } catch (e) {
      console.error('Error loading companies:', e);
    } finally {
      setLoading(false);
    }
  }, [user, businessProfile, storageKey, activeKey]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const activeCompany = companies.find(c => c.id === activeCompanyId) || (companies.length > 0 ? companies[0] : null);

  // Switch Active Company
  const switchCompany = async (companyId: string) => {
    const target = companies.find(c => c.id === companyId);
    if (!target) return;

    setActiveCompanyId(companyId);
    localStorage.setItem(activeKey, companyId);

    // Sync active company details into business_profile table so all PDF generators and invoices use it
    await updateBusinessProfile({
      name: target.name,
      address: target.address || '',
      phone: target.phone || '',
      email: target.email || '',
      gstin: target.gstin || '',
      logo_url: target.logo_url || '',
      bank_name: target.bank_name || '',
      account_no: target.account_no || '',
      ifsc: target.ifsc || '',
      signature_url: target.signature_url || '',
      upi_id: target.upi_id || '',
      terms_conditions: target.terms_conditions || '',
      companies_data: companies,
      active_company_id: companyId
    });
  };

  // Add Company (Enforces strict plan limit)
  const addCompany = async (
    companyData: Partial<Company>
  ): Promise<{ success?: boolean; error?: string; company?: Company }> => {
    if (!user) return { error: 'Please sign in to add a company.' };

    if (companies.length >= maxCompanies) {
      return {
        error: `Company limit reached. You can manage up to ${maxCompanies} companies on your current ${PLANS_CONFIG[planKey]?.name || 'Plan'}.`
      };
    }

    if (!companyData.name || !companyData.name.trim()) {
      return { error: 'Company / Business Name is required.' };
    }

    const newCompany: Company = {
      id: generateUUID(),
      user_id: user.id,
      name: companyData.name.trim(),
      address: companyData.address || '',
      phone: companyData.phone || '',
      email: companyData.email || '',
      gstin: companyData.gstin || '',
      state: companyData.state || 'Delhi',
      logo_url: companyData.logo_url || '',
      bank_name: companyData.bank_name || '',
      account_no: companyData.account_no || '',
      ifsc: companyData.ifsc || '',
      signature_url: companyData.signature_url || '',
      upi_id: companyData.upi_id || '',
      terms_conditions: companyData.terms_conditions || '',
      is_default: companies.length === 0,
      created_at: new Date().toISOString()
    };

    const updatedList = [...companies, newCompany];
    setCompanies(updatedList);
    localStorage.setItem(storageKey, JSON.stringify(updatedList));

    // Automatically switch to newly created company and sync to Supabase cloud
    setActiveCompanyId(newCompany.id);
    localStorage.setItem(activeKey, newCompany.id);

    await updateBusinessProfile({
      name: newCompany.name,
      address: newCompany.address || '',
      phone: newCompany.phone || '',
      email: newCompany.email || '',
      gstin: newCompany.gstin || '',
      logo_url: newCompany.logo_url || '',
      bank_name: newCompany.bank_name || '',
      account_no: newCompany.account_no || '',
      ifsc: newCompany.ifsc || '',
      signature_url: newCompany.signature_url || '',
      upi_id: newCompany.upi_id || '',
      terms_conditions: newCompany.terms_conditions || '',
      companies_data: updatedList,
      active_company_id: newCompany.id
    });

    return { success: true, company: newCompany };
  };

  // Update Company
  const updateCompany = async (
    companyId: string,
    updates: Partial<Company>
  ): Promise<{ success?: boolean; error?: string }> => {
    const idx = companies.findIndex(c => c.id === companyId);
    if (idx === -1) return { error: 'Company not found.' };

    const updatedCompany = { ...companies[idx], ...updates, updated_at: new Date().toISOString() };
    const updatedList = [...companies];
    updatedList[idx] = updatedCompany;

    setCompanies(updatedList);
    localStorage.setItem(storageKey, JSON.stringify(updatedList));

    const cloudPayload: any = {
      companies_data: updatedList
    };

    // If updating currently active company, also sync to business_profile
    if (companyId === activeCompanyId) {
      cloudPayload.name = updatedCompany.name;
      cloudPayload.address = updatedCompany.address || '';
      cloudPayload.phone = updatedCompany.phone || '';
      cloudPayload.email = updatedCompany.email || '';
      cloudPayload.gstin = updatedCompany.gstin || '';
      cloudPayload.logo_url = updatedCompany.logo_url || '';
      cloudPayload.bank_name = updatedCompany.bank_name || '';
      cloudPayload.account_no = updatedCompany.account_no || '';
      cloudPayload.ifsc = updatedCompany.ifsc || '';
      cloudPayload.signature_url = updatedCompany.signature_url || '';
      cloudPayload.upi_id = updatedCompany.upi_id || '';
      cloudPayload.terms_conditions = updatedCompany.terms_conditions || '';
      cloudPayload.active_company_id = companyId;
    }

    await updateBusinessProfile(cloudPayload);

    return { success: true };
  };

  // Delete Company
  const deleteCompany = async (companyId: string): Promise<{ success?: boolean; error?: string }> => {
    if (companies.length <= 1) {
      return { error: 'You must have at least one business profile.' };
    }

    const updatedList = companies.filter(c => c.id !== companyId);
    setCompanies(updatedList);
    localStorage.setItem(storageKey, JSON.stringify(updatedList));

    if (companyId === activeCompanyId && updatedList.length > 0) {
      await switchCompany(updatedList[0].id);
    } else {
      await updateBusinessProfile({ companies_data: updatedList });
    }

    return { success: true };
  };

  // Helper to determine if an invoice, customer, or product belongs to currently active company
  // Safely attributes legacy items without company_id to the primary/first company
  const isItemForActiveCompany = useCallback((item: { company_id?: string | null }) => {
    const primaryId = companies.length > 0 ? companies[0].id : '';
    const currentId = activeCompany?.id || activeCompanyId || primaryId;
    if (!item) return false;
    if (item.company_id) {
      return item.company_id === currentId;
    }
    // Legacy fallback: items with no company_id belong to the primary company
    return currentId === primaryId;
  }, [activeCompany, activeCompanyId, companies]);

  // Helper to resolve company details by ID
  const resolveCompany = useCallback((companyId?: string | null) => {
    if (!companyId) return companies[0];
    return companies.find(c => c.id === companyId) || companies[0];
  }, [companies]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompany,
        activeCompanyId: activeCompany?.id || activeCompanyId || (companies[0]?.id || ''),
        loading,
        maxCompanies,
        currentCount,
        isLimitReached,
        switchCompany,
        addCompany,
        updateCompany,
        deleteCompany,
        refreshCompanies: async () => loadCompanies(),
        isItemForActiveCompany,
        resolveCompany
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used within a CompanyProvider');
  return context;
};
