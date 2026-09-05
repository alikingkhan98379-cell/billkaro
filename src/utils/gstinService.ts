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

// =========================================================================
// 🔑 GSTINCHECK API KEYS VAULT (MULTI-KEY POOL & ROTATION)
// =========================================================================
// Agar pehli key ke credits khatam ho jayein ya expire ho jaye,
// toh system automatically agli backup key use karega.
//
// 📍 MANUAL EDIT LOCATION:
// File: src/utils/gstinService.ts -> GST_API_KEYS array
//
// 💡 Nayi Free / Paid API Keys lene ke liye:
// 1. https://sheet.gstincheck.co.in par visit karein.
// 2. Apni nayi API Key generate karein.
// 3. Niche GST_API_KEYS array me add karein.
// =========================================================================
export const GST_API_KEYS: string[] = [
  'b327cfadf9231bd5156f7285a4c08d0c', // 🌟 Active Key #1
  '8e5294b4113c9b01e0d29b170b7346b1', // 🛡️ Backup Key #2
  // Nayi API Keys yahan add karein (comma laga kar):
  // 'YOUR_NEXT_KEY_HERE',
];

export function getStateFromGSTIN(gstin: string): string {
  const clean = gstin.trim().toUpperCase();
  if (clean.length >= 2) {
    const code = clean.substring(0, 2);
    return GST_STATE_MAP[code] || '';
  }
  return '';
}

/**
 * Extracts PAN number from a 15-digit GSTIN (characters 3-12)
 */
export function getPANFromGSTIN(gstin: string): string {
  const clean = gstin.trim().toUpperCase();
  if (clean.length >= 12) {
    return clean.substring(2, 12);
  }
  return '';
}

/**
 * Verifies GSTIN and fetches complete Company Name, Trade Name, Address, and State.
 * Automatically tries all available API keys in sequence until success.
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

    // 2. Multi-Key Fallback Engine: Tries keys in sequence until a valid response is returned
    const envKeys = ((import.meta as any).env?.VITE_GSTINCHECK_API_KEYS || '')
      .split(',')
      .map((k: string) => k.trim())
      .filter(Boolean);
    const keyPool = Array.from(new Set([...envKeys, ...GST_API_KEYS].filter(Boolean)));

    let lastErrorMessage = '';

    for (const apiKey of keyPool) {
      try {
        const url = `https://sheet.gstincheck.co.in/check/${apiKey}/${encodeURIComponent(cleanGstin)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          continue; // Try next fallback key
        }

        const apiJson = await res.json();
        if (apiJson.flag === false || apiJson.status === false) {
          lastErrorMessage = apiJson.message || '';
          continue; // Try next fallback key in pool
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
          formattedAddress = formattedAddress.replace(/^0,\s*0,\s*/, '');
        }

        const state = (rawData.pradr && rawData.pradr.addr && rawData.pradr.addr.stcd) || rawData.state || fallbackState;
        const pincode = (rawData.pradr && rawData.pradr.addr && rawData.pradr.addr.pncd) || rawData.pincode || '';
        const gstStatus = rawData.sts || rawData.status || 'Active';

        if (companyName) {
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
        }
      } catch (keyErr) {
        console.warn('GST key attempt error, trying next fallback key:', keyErr);
        continue;
      }
    }

    // If all keys in the pool were exhausted, expired, or rate limited:
    return {
      success: false,
      data: {
        gstin: cleanGstin,
        company_name: '',
        legal_name: '',
        trade_name: '',
        address: '',
        state: fallbackState
      },
      error: lastErrorMessage 
        ? `API Key Notice: ${lastErrorMessage}. State '${fallbackState}' auto-detected. Please enter Company Name & Address manually, or update API key.`
        : `State '${fallbackState}' auto-detected. Live GST lookup requires active API credits on gstincheck.co.in. Please enter details manually.`,
      notice: `State '${fallbackState}' auto-detected!`
    };
  } catch (err: any) {
    console.error('GSTIN verification fetch error:', err);
    return {
      success: false,
      data: {
        gstin: cleanGstin,
        company_name: '',
        legal_name: '',
        trade_name: '',
        address: '',
        state: fallbackState
      },
      error: `State '${fallbackState}' auto-detected! Please enter Company Name & Address manually.`,
      notice: `State '${fallbackState}' auto-detected!`
    };
  }
}

