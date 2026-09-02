import { supabase } from '../lib/supabase';
import { isValidGSTIN } from './validators';

export const GST_STATE_MAP: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory'
};

export interface VerifiedGSTData {
  gstin: string;
  company_name: string;
  legal_name: string;
  trade_name: string;
  address: string;
  state: string;
  pincode?: string;
  status?: string;
}

export interface GSTVerificationResult {
  success: boolean;
  data?: VerifiedGSTData;
  error?: string;
  notice?: string;
  isRateLimited?: boolean;
}

// Active API Key
const GST_API_KEY = '8e5294b4113c9b01e0d29b170b7346b1';

export function getStateFromGSTIN(gstin: string): string {
  const clean = gstin.trim().toUpperCase();
  if (clean.length >= 2) {
    const code = clean.substring(0, 2);
    return GST_STATE_MAP[code] || '';
  }
  return '';
}

/**
 * Verifies GSTIN and fetches complete Company Name, Trade Name, Address, and State.
 */
export async function verifyGSTINWithBackend(rawGstin: string): Promise<GSTVerificationResult> {
  const cleanGstin = rawGstin.trim().toUpperCase();

  if (!cleanGstin) {
    return { success: false, error: 'Please enter a 15-character GSTIN number.' };
  }

  if (!isValidGSTIN(cleanGstin)) {
    return { success: false, error: 'Invalid GSTIN format (e.g. 07AAAAA0000A1Z5).' };
  }

  const fallbackState = getStateFromGSTIN(cleanGstin) || 'Delhi';

  try {
    // 1. Try Supabase Edge Function first
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('verify-gstin', {
      body: { gstin: cleanGstin }
    });

    if (!edgeErr && edgeData?.success && edgeData?.data?.company_name) {
      return {
        success: true,
        data: edgeData.data
      };
    }

    // 2. Direct secure client lookup fallback (for local dev & instant response)
    const url = `https://sheet.gstincheck.co.in/check/${GST_API_KEY}/${encodeURIComponent(cleanGstin)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) {
      return {
        success: true,
        data: {
          gstin: cleanGstin,
          company_name: '',
          legal_name: '',
          trade_name: '',
          address: '',
          state: fallbackState
        },
        notice: `State '${fallbackState}' auto-detected!`
      };
    }

    const apiJson = await res.json();
    if (apiJson.flag === false || apiJson.status === false) {
      return {
        success: true,
        data: {
          gstin: cleanGstin,
          company_name: '',
          legal_name: '',
          trade_name: '',
          address: '',
          state: fallbackState
        },
        notice: apiJson.message || `State '${fallbackState}' auto-detected!`
      };
    }

    const rawData = apiJson.data || {};
    const tradeName = rawData.tradeNam || rawData.trade_name || rawData.tradeName || rawData.lgnm || '';
    const legalName = rawData.lgnm || rawData.legal_name || rawData.legalName || tradeName || '';
    const companyName = tradeName || legalName || '';

    let formattedAddress = '';
    if (typeof rawData.pradr?.adr === 'string' && rawData.pradr.adr.trim()) {
      formattedAddress = rawData.pradr.adr.trim();
    } else if (rawData.pradr?.addr) {
      const addrObj = rawData.pradr.addr;
      const parts = [
        addrObj.bno && addrObj.bno !== '0' ? addrObj.bno : '',
        addrObj.bnm,
        addrObj.flno,
        addrObj.st,
        addrObj.loc,
        addrObj.city,
        addrObj.dst,
        addrObj.stcd,
        addrObj.pncd
      ].filter(Boolean);
      formattedAddress = parts.join(', ');
    } else if (typeof rawData.address === 'string') {
      formattedAddress = rawData.address.trim();
    }

    if (formattedAddress.startsWith('0, 0, ')) {
      formattedAddress = formattedAddress.replace(/^0,s*0,s*/, '');
    }

    const state = (rawData.pradr && rawData.pradr.addr && rawData.pradr.addr.stcd) || rawData.state || fallbackState;
    const pincode = (rawData.pradr && rawData.pradr.addr && rawData.pradr.addr.pncd) || rawData.pincode || '';
    const gstStatus = rawData.sts || rawData.status || 'Active';

    return {
      success: true,
      data: {
        gstin: cleanGstin,
        company_name: companyName,
        legal_name: legalName,
        trade_name: tradeName,
        address: formattedAddress,
        state: state,
        pincode: pincode,
        status: gstStatus
      }
    };
  } catch (err: any) {
    console.error('GSTIN verification fetch error:', err);
    return {
      success: true,
      data: {
        gstin: cleanGstin,
        company_name: '',
        legal_name: '',
        trade_name: '',
        address: '',
        state: fallbackState
      },
      notice: `State '${fallbackState}' auto-detected!`
    };
  }
}
