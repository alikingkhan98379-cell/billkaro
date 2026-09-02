import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory"
};

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Only POST is supported." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required. Please log in to verify GSTIN." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? supabaseAnonKey;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session. Please log in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON request body." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawGstin = typeof body?.gstin === "string" ? body.gstin.trim().toUpperCase() : "";
    if (!rawGstin) {
      return new Response(
        JSON.stringify({ error: "GSTIN is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!GSTIN_REGEX.test(rawGstin)) {
      return new Response(
        JSON.stringify({ error: "Invalid GSTIN format. Must be a valid 15-character GSTIN (e.g. 07AAAAA0000A1Z5)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stateCode = rawGstin.substring(0, 2);
    const fallbackState = GST_STATE_CODES[stateCode] || "Delhi";

    // Server-Side Rate Limiting Check (Max 10 lookups per user per hour)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count, error: countErr } = await adminClient
      .from("gstin_lookup_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if (!countErr && typeof count === "number" && count >= 10) {
      return new Response(
        JSON.stringify({
          error: "Rate limit reached: Maximum 10 GSTIN verifications allowed per hour.",
          isRateLimited: true,
          data: {
            gstin: rawGstin,
            state: fallbackState
          }
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GSTINCHECK_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: true,
          notice: "GST API secret not configured. State auto-detected from GSTIN.",
          data: {
            gstin: rawGstin,
            company_name: "",
            legal_name: "",
            trade_name: "",
            address: "",
            state: fallbackState
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    let externalRes: Response;
    try {
      const targetUrl = `https://sheet.gstincheck.co.in/check/${apiKey}/${encodeURIComponent(rawGstin)}`;
      externalRes = await fetch(targetUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { "Accept": "application/json" }
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      console.error("External GSTIN API fetch error:", fetchErr?.message || fetchErr);
      return new Response(
        JSON.stringify({
          success: true,
          notice: "Could not connect to external GST portal. State auto-detected.",
          data: { gstin: rawGstin, state: fallbackState, company_name: "", address: "" }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    let apiData: any = {};
    try {
      apiData = await externalRes.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: true,
          notice: "Could not parse external GST response. State auto-detected.",
          data: { gstin: rawGstin, state: fallbackState, company_name: "", address: "" }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (apiData.flag === false || apiData.status === false) {
      const msg = apiData.message || "";
      return new Response(
        JSON.stringify({
          success: true,
          notice: msg || "Could not fetch details. State auto-detected.",
          data: {
            gstin: rawGstin,
            state: fallbackState,
            company_name: "",
            trade_name: "",
            address: ""
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawData = apiData.data || apiData;
    const tradeName = rawData.tradeNam || rawData.trade_name || rawData.tradeName || rawData.lgnm || "";
    const legalName = rawData.lgnm || rawData.legal_name || rawData.legalName || tradeName || "";
    const companyName = tradeName || legalName || "";

    let formattedAddress = "";
    if (typeof rawData.pradr?.adr === "string" && rawData.pradr.adr.trim()) {
      formattedAddress = rawData.pradr.adr.trim();
    } else if (rawData.pradr?.addr) {
      const addrObj = rawData.pradr.addr;
      const parts = [
        addrObj.bno && addrObj.bno !== "0" ? addrObj.bno : "",
        addrObj.bnm,
        addrObj.flno,
        addrObj.st,
        addrObj.loc,
        addrObj.city,
        addrObj.dst,
        addrObj.stcd,
        addrObj.pncd
      ].filter(Boolean);
      formattedAddress = parts.join(", ");
    } else if (typeof rawData.address === "string" && rawData.address.trim()) {
      formattedAddress = rawData.address.trim();
    }

    if (formattedAddress.startsWith("0, 0, ")) {
      formattedAddress = formattedAddress.replace(/^0,s*0,s*/, "");
    }

    const state = rawData.pradr?.addr?.stcd || rawData.state || fallbackState;
    const pincode = rawData.pradr?.addr?.pncd || rawData.pincode || "";
    const gstStatus = rawData.sts || rawData.status || "Active";

    // Log Lookup into gstin_lookup_log
    try {
      await adminClient.from("gstin_lookup_log").insert({
        user_id: user.id,
        gstin: rawGstin,
      });
    } catch (logErr) {
      console.warn("Failed to log GSTIN lookup:", logErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          gstin: rawGstin,
          company_name: companyName,
          legal_name: legalName,
          trade_name: tradeName,
          address: formattedAddress,
          state: state,
          pincode: pincode,
          status: gstStatus,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Unexpected edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Could not fetch details, please enter manually." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
