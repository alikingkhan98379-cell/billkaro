import React, { useState, useMemo } from 'react';
import { 
  HelpCircle, 
  Mail, 
  MessageSquare, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  ShieldCheck, 
  CreditCard, 
  FileText, 
  Users, 
  Package, 
  Building2, 
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';

interface HelpTopic {
  id: string;
  category: 'invoicing' | 'customers' | 'products' | 'gst' | 'payments' | 'business' | 'general';
  title: string;
  summary: string;
  content: string[];
}

const SUPPORT_EMAIL = 'smartgstbill@gmail.com';
const SUPPORT_WHATSAPP_PHONE = '919638938258';
const SUPPORT_WHATSAPP_DISPLAY = '+91 96389 38258';

export const HelpSupportPage: React.FC = () => {
  const { user, isPremium, planId } = useAuth();
  const { navigate } = useRouter();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>('create-invoice');

  // Pre-filled WhatsApp Support Links
  const getWhatsAppLink = (contextMessage?: string) => {
    let text = contextMessage || 'Hi BillKaro Support,\nI need help with my BillKaro account.';
    if (user?.email) {
      text += `\n\nAccount Email: ${user.email}`;
    }
    return `https://wa.me/${SUPPORT_WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
  };

  // Pre-filled Email Support Links
  const getEmailLink = (customSubject?: string, customBody?: string) => {
    const subject = customSubject || 'BillKaro Support Request';
    let body = customBody || 'Hello BillKaro Support,\n\nI need help with:\n\n';
    if (user?.email) {
      body += `Account Email: ${user.email}\n`;
    }
    body += '\nThank you.';
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Common Help Topics (10 Standard SaaS Knowledgebase Articles)
  const helpTopics: HelpTopic[] = useMemo(() => [
    {
      id: 'create-invoice',
      category: 'invoicing',
      title: 'How do I create an invoice?',
      summary: 'Generate GST-compliant tax invoices in seconds with line items, tax mode, and UPI QR code.',
      content: [
        '1. Click on "Create Invoice" from the sidebar or bottom navigation bar.',
        '2. Select or enter your Customer details (Name, Phone, GSTIN, Address).',
        '3. Add items with HSN Code, Quantity, Rate, Discount %, and GST Tax Rate.',
        '4. Choose whether to apply CGST + SGST (Intra-state) or IGST (Inter-state).',
        '5. Click "Save & WhatsApp PDF" or "Download PDF" to instantly generate a branded GST invoice.'
      ]
    },
    {
      id: 'add-customer',
      category: 'customers',
      title: 'How do I add a customer?',
      summary: 'Manage your customer and client directory with GSTIN numbers and contact info.',
      content: [
        '1. Open "Customers Master" from the navigation menu.',
        '2. Click the "Add New Customer" button at the top right.',
        '3. Enter the Customer Name, Phone Number, Billing Address, and optional GSTIN.',
        '4. Save the customer to automatically access and auto-fill their information during invoice creation.'
      ]
    },
    {
      id: 'add-products',
      category: 'products',
      title: 'How do I add products?',
      summary: 'Maintain an item catalog with standard pricing, HSN codes, and default GST tax slabs.',
      content: [
        '1. Navigate to "Products Master" from the menu.',
        '2. Click "Add New Product" and enter the Item Name, Unit (Pcs, Kg, Box, etc.), and Selling Price.',
        '3. Set the item HSN/SAC Code and default GST rate (0%, 5%, 12%, 18%, 28%).',
        '4. Saved items will be available via 1-click selection in the invoice item picker.'
      ]
    },
    {
      id: 'gst-calculation',
      category: 'gst',
      title: 'How does GST calculation work?',
      summary: 'Automatic real-time calculation of Taxable Value, CGST, SGST, IGST, and Grand Total.',
      content: [
        'BillKaro automatically calculates tax amounts based on your selected tax mode:',
        '• Intra-State (Same State): Splits the selected GST rate equally into CGST and SGST (e.g. 18% GST = 9% CGST + 9% SGST).',
        '• Inter-State (Different State): Applies the full GST rate as IGST (e.g. 18% IGST).',
        'All line-level item discounts and overall invoice discounts are factored into the net Taxable Value before computing GST.'
      ]
    },
    {
      id: 'share-invoice-whatsapp',
      category: 'invoicing',
      title: 'How do I share an invoice on WhatsApp?',
      summary: 'Directly send genuine .pdf invoice files with payment QR codes to your customer WhatsApp.',
      content: [
        '• On Mobile (Android / iOS): Tap "Save & WhatsApp PDF" on invoice creation or "Share" on any saved invoice in Invoices History. The Web Share API will attach the actual .pdf file directly into WhatsApp.',
        '• On Desktop: Clicking WhatsApp share downloads the PDF locally and opens WhatsApp Web with a formatted summary message. You can then attach the downloaded PDF in the chat.'
      ]
    },
    {
      id: 'upgrade-premium',
      category: 'payments',
      title: 'How do I upgrade to Premium?',
      summary: 'Unlock unlimited invoices, watermark-free PDFs, custom logos, ads removal, and multi-company slots.',
      content: [
        '1. Navigate to the "Upgrade to Pro" page from the navigation menu.',
        '2. Choose your preferred plan: Monthly Pro (₹49 / 30 days), 6 Months Pro (₹250 / 180 days), or Yearly Pro (₹470 / 365 days).',
        '3. Scan the Dynamic UPI QR Code using Google Pay, PhonePe, Paytm, Cred, or any UPI app.',
        '4. Submit your 12-digit UTR / UPI Transaction Reference number for instant verification.'
      ]
    },
    {
      id: 'premium-activation-time',
      category: 'payments',
      title: 'How long does Premium activation take?',
      summary: 'Authoritative payment verification SLA and timeline details.',
      content: [
        '• Payments are verified against our bank records as soon as received.',
        '• Activation is typically completed within a maximum window of 4 hours.',
        '• Once approved, your account immediately switches to "Pro Active" with Ads OFF and watermark removal enabled across all devices.'
      ]
    },
    {
      id: 'payment-pending-status',
      category: 'payments',
      title: 'What happens if my payment is pending?',
      summary: 'Understanding pending verification status and tracking approval.',
      content: [
        '• When you submit your UTR reference, your order status updates to "PENDING_ADMIN".',
        '• You can track the status of your order anytime in the "Your Payment History" table on the Premium page.',
        '• If you entered an incorrect UTR or need urgent activation, reach out to WhatsApp support with your Order ID.'
      ]
    },
    {
      id: 'update-business-profile',
      category: 'business',
      title: 'How do I update my business profile?',
      summary: 'Configure GSTIN, Bank details, UPI QR code, Company Logo, and Digital Signature.',
      content: [
        '1. Open "Business Profile & UPI" from the sidebar.',
        '2. Enter your Business Name, Registered Address, Contact Number, and 15-digit GSTIN (or click "Auto-Fill from GST").',
        '3. Enter your Bank Account details and UPI ID (VPA) to print a dynamic scan-and-pay QR code on invoices.',
        '4. Upload your company logo and digital signature (PNG/JPG), then click "Save Business Profile".'
      ]
    },
    {
      id: 'manage-multiple-companies',
      category: 'business',
      title: 'How do I manage multiple companies?',
      summary: 'Switch between separate business entities with dedicated GST numbers and plan limits.',
      content: [
        '• Free Starter accounts can manage up to 2 distinct business profiles.',
        '• Monthly & 6-Month Pro accounts can manage up to 3 companies.',
        '• Yearly Pro accounts can manage up to 4 companies.',
        '• Use the "Company Switcher" dropdown in the top Navbar or Business Profile page to add a new business or switch the active company anytime.'
      ]
    }
  ], []);

  // Filter topics based on search query
  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return helpTopics;
    const q = searchQuery.toLowerCase().trim();
    return helpTopics.filter(topic => 
      topic.title.toLowerCase().includes(q) ||
      topic.summary.toLowerCase().includes(q) ||
      topic.content.some(line => line.toLowerCase().includes(q))
    );
  }, [helpTopics, searchQuery]);

  const toggleTopic = (id: string) => {
    setExpandedTopicId(prev => (prev === id ? null : id));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* 1. HEADER & SEARCH HERO */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-5 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold backdrop-blur-md border border-white/10">
              <HelpCircle className="w-3.5 h-3.5 text-blue-200" />
              <span>BillKaro Support Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              How can we help?
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 max-w-xl">
              Get help with BillKaro, billing, invoices, GST calculation, payments, or your account settings.
            </p>
          </div>

          {/* Account Context Card (Safe & Non-Sensitive) */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15 text-left self-start sm:self-auto shrink-0 min-w-[200px]">
            <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider block">
              Signed In As
            </span>
            <span className="text-xs font-bold text-white block truncate max-w-[220px]">
              {user?.email || 'Guest User'}
            </span>
            <div className="mt-1.5 flex items-center gap-1.5">
              {isPremium ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Premium Member</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded-full border border-blue-400/20">
                  <span>Free Starter</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search help articles (e.g. invoice, GST, WhatsApp, payment, company)..."
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs sm:text-sm rounded-2xl border border-white/20 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Search help articles"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 2. TWO LARGE QUICK SUPPORT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* CARD 1: WHATSAPP */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
              <MessageSquare className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Chat with us on WhatsApp
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Get quick help from the BillKaro support team. Direct resolution for invoices, UPI payments, and billing queries.
              </p>
              <p className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
                {SUPPORT_WHATSAPP_DISPLAY}
              </p>
            </div>
          </div>

          <a
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            aria-label="Chat with BillKaro support on WhatsApp"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat on WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>

        {/* CARD 2: EMAIL */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
              <Mail className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Email Support
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Send us your issue and our support team will get back to you with detailed resolution and assistance.
              </p>
              <p className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 mt-1.5 truncate">
                {SUPPORT_EMAIL}
              </p>
            </div>
          </div>

          <a
            href={getEmailLink()}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            aria-label="Send email to BillKaro support"
          >
            <Mail className="w-4 h-4" />
            <span>Email Support</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>
      </div>

      {/* 3. SUPPORT RESPONSE NOTICE */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
        <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
        <div className="text-xs">
          <span className="font-bold text-slate-900 dark:text-white">Support Response: </span>
          <span className="text-slate-600 dark:text-slate-300">
            Need help? Contact us through WhatsApp or email and our team will assist you promptly.
          </span>
        </div>
      </div>

      {/* 4. DEDICATED PAYMENT & PREMIUM SUPPORT SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
          <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Payment & Premium Support
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Assistance for UPI transactions, UTR verification, plan renewals, and invoices
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white">⚡ UTR / Payment Verification</span>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              If your payment was submitted but status is still pending after bank clearance, reach out directly with your Order ID.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white">🔒 Security & Duplicate Protection</span>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Every UPI transaction is authoritatively validated against banking records to protect against duplicate UTR reuse.
            </p>
          </div>
        </div>

        <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
              Having trouble with a Premium payment or activation?
            </h4>
            <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
              Our billing desk will verify your UTR and activate your Pro suite right away.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={getWhatsAppLink('Hi BillKaro Support, I need help with my Premium plan / UPI payment.')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition min-h-[38px]"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp Support</span>
            </a>
            <a
              href={getEmailLink('BillKaro Premium Payment Support', 'Hello BillKaro Billing Support,\n\nI need help with my Premium UPI payment.\n\nUTR Reference:\nOrder ID:\n')}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition min-h-[38px]"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email Billing</span>
            </a>
          </div>
        </div>
      </div>

      {/* 5. COMMON HELP TOPICS ACCORDION */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Common Help Topics & Guides
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Instant answers to frequently asked questions about BillKaro
            </p>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {filteredTopics.length} Articles
          </span>
        </div>

        {filteredTopics.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <HelpCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              No help articles found matching "{searchQuery}"
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Try searching with another keyword or reach out directly to our WhatsApp support team.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Clear search query
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredTopics.map((topic, index) => {
              const isExpanded = expandedTopicId === topic.id;
              return (
                <div key={topic.id} className="py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => toggleTopic(topic.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`topic-content-${topic.id}`}
                    className="w-full text-left flex items-start justify-between gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-600 group-hover:text-white transition">
                        {index + 1}
                      </span>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                          {topic.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {topic.summary}
                        </p>
                      </div>
                    </div>

                    <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div
                      id={`topic-content-${topic.id}`}
                      role="region"
                      className="pl-11 pr-4 pt-2 pb-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 animate-in fade-in"
                    >
                      {topic.content.map((paragraph, pIdx) => (
                        <p key={pIdx} className="leading-relaxed">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. PRIVACY & SECURITY COMMITMENT */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong className="text-slate-700 dark:text-slate-300">Security Guarantee:</strong> BillKaro support never asks for your password, email OTP, or payment credentials. Your business and invoice records remain strictly isolated under Postgres RLS.
        </p>
      </div>
    </div>
  );
};
