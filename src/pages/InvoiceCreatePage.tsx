import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  Share2, 
  UserPlus, 
  Package, 
  Sparkles, 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft, 
  Check,
  Building,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Edit3
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Customer, Product, Invoice, InvoiceItem, TaxType } from '../types';
import { calculateInvoiceTotals } from '../utils/taxCalculator';
import { formatINR, numberToIndianWords } from '../utils/currency';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { openWhatsAppShare } from '../utils/whatsapp';
import { shareInvoicePDF } from '../utils/shareService';
import { Modal } from '../components/common/Modal';
import { isValidIndianPhone, isValidGSTIN, isValidEmail } from '../utils/validators';
import { verifyGSTINWithBackend } from '../utils/gstinService';

interface InvoiceCreatePageProps {
  setCurrentTab: (tab: string) => void;
  onInvoiceCreated?: () => void;
}

export const InvoiceCreatePage: React.FC<InvoiceCreatePageProps> = ({
  setCurrentTab,
  onInvoiceCreated
}) => {
  const { user, businessProfile, subscription } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

  const [invoiceNumber, setInvoiceNumber] = useState<string>('INV-0001');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>('');
  const [taxType, setTaxType] = useState<TaxType>('CGST_SGST');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountIsPercentage, setDiscountIsPercentage] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Cash Customer');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerGstin, setCustomerGstin] = useState<string>('');
  const [customerState, setCustomerState] = useState<string>('Delhi');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [saveToDirectory, setSaveToDirectory] = useState<boolean>(false);
  const [isManualCustomer, setIsManualCustomer] = useState<boolean>(false);

  const [items, setItems] = useState<InvoiceItem[]>([
    {
      product_name: '',
      hsn_code: '',
      qty: 1,
      unit: 'PCS',
      price: 0,
      gst_percent: 18,
      amount: 0
    }
  ]);

  const [customerModalOpen, setCustomerModalOpen] = useState<boolean>(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [modalSaving, setModalSaving] = useState<boolean>(false);
  const [fetchingGstInline, setFetchingGstInline] = useState<boolean>(false);
  const [fetchingGstModal, setFetchingGstModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [modalErrorMessage, setModalErrorMessage] = useState<string>('');
  const [modalNoticeMessage, setModalNoticeMessage] = useState<string>('');
  const [gstSuccessMessage, setGstSuccessMessage] = useState<string>('');

  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');
  const [newCustEmail, setNewCustEmail] = useState<string>('');
  const [newCustGstin, setNewCustGstin] = useState<string>('');
  const [newCustAddress, setNewCustAddress] = useState<string>('');
  const [newCustState, setNewCustState] = useState<string>('Delhi');

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setLoadingInitial(true);
      try {
        const { data: custData, error: custErr } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', user.id)
          .order('name');
        if (!custErr && custData) {
          setCustomers(custData);
        }

        const { data: prodData } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', user.id)
          .order('name');
        if (prodData) setProducts(prodData);

        const { data: invList } = await supabase
          .from('invoices')
          .select('invoice_number, invoice_date, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (invList && invList.length > 0) {
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          const thisMonthInvoices = invList.filter(inv => {
            const d = new Date(inv.invoice_date || inv.created_at || '');
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
          });

          if (subscription?.plan !== 'premium' && thisMonthInvoices.length >= 5) {
            setUpgradeModalOpen(true);
          }

          const count = invList.length + 1;
          const nextSeq = 'INV-' + count.toString().padStart(4, '0');
          setInvoiceNumber(nextSeq);
        } else {
          setInvoiceNumber('INV-0001');
        }
      } catch (err) {
        console.error('Error fetching invoice setup:', err);
      } finally {
        setLoadingInitial(false);
      }
    };

    loadData();
  }, [user, subscription]);

  // Unsaved changes protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasContent = items.some(it => it.product_name.trim() || it.price > 0) || (customerName.trim() && customerName !== 'Cash Customer');
      if (hasContent && !saving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [items, customerName, saving]);

  const handleSelectCustomerFromDropdown = (custId: string) => {
    setSelectedCustomerId(custId);
    if (!custId) {
      setIsManualCustomer(false);
      setCustomerName('Cash Customer');
      setCustomerPhone('');
      setCustomerEmail('');
      setCustomerGstin('');
      setCustomerState('Delhi');
      setCustomerAddress('');
      return;
    }

    const found = customers.find(c => c.id === custId);
    if (found) {
      setCustomerName(found.name);
      setCustomerPhone(found.phone || '');
      setCustomerEmail(found.email || '');
      setCustomerGstin(found.gstin || '');
      setCustomerState(found.state || 'Delhi');
      setCustomerAddress(found.address || '');
      setIsManualCustomer(false);
    }
  };

  const handleFetchGstInline = async () => {
    setErrorMessage('');
    setGstSuccessMessage('');
    if (!customerGstin.trim()) {
      setErrorMessage('Please enter a 15-character GSTIN number first.');
      return;
    }

    setFetchingGstInline(true);
    const res = await verifyGSTINWithBackend(customerGstin);
    setFetchingGstInline(false);

    if (res.success && res.data) {
      if (res.data.company_name) setCustomerName(res.data.company_name);
      if (res.data.address) setCustomerAddress(res.data.address);
      if (res.data.state) setCustomerState(res.data.state);
      setIsManualCustomer(true);
      if (res.data.company_name) {
        setGstSuccessMessage(`? GST Verified: ${res.data.company_name} details auto-filled!`);
      } else {
        setGstSuccessMessage(res.notice || `? State '${res.data.state}' auto-detected from GSTIN!`);
      }
      setTimeout(() => setGstSuccessMessage(''), 6000);
    } else {
      setErrorMessage(res.error || 'Could not fetch details, please enter manually.');
    }
  };

  const handleFetchGstModal = async () => {
    setModalErrorMessage('');
    setModalNoticeMessage('');
    if (!newCustGstin.trim()) {
      setModalErrorMessage('Please enter a 15-character GSTIN number first.');
      return;
    }

    setFetchingGstModal(true);
    const res = await verifyGSTINWithBackend(newCustGstin);
    setFetchingGstModal(false);

    if (res.success && res.data) {
      if (res.data.company_name) setNewCustName(res.data.company_name);
      if (res.data.address) setNewCustAddress(res.data.address);
      if (res.data.state) setNewCustState(res.data.state);
      if (!res.data.company_name) {
        setModalNoticeMessage(`? State '${res.data.state}' auto-detected! Note: Full Name & Address requires active API credits on gstincheck.co.in.`);
      }
    } else {
      setModalErrorMessage(res.error || 'Could not fetch details, please enter manually.');
    }
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    const qty = Number(updated[index].qty) || 0;
    const price = Number(updated[index].price) || 0;
    updated[index].amount = Math.round(qty * price * 100) / 100;
    setItems(updated);
  };

  const handleSelectProduct = (index: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const updated = [...items];
    updated[index] = {
      ...updated[index],
      product_id: prod.id,
      product_name: prod.name,
      hsn_code: prod.hsn_code || '',
      price: prod.price || 0,
      unit: prod.unit || 'PCS',
      gst_percent: prod.gst_percent ?? 18,
      amount: Math.round((Number(updated[index].qty) || 1) * (prod.price || 0) * 100) / 100
    };
    setItems(updated);
  };

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      { product_name: '', hsn_code: '', qty: 1, unit: 'PCS', price: 0, gst_percent: 18, amount: 0 }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const totals = calculateInvoiceTotals(items, taxType, discountValue, discountIsPercentage);

  const handleOpenCustomerModal = () => {
    setNewCustName('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustGstin('');
    setNewCustAddress('');
    setNewCustState('Delhi');
    setModalErrorMessage('');
    setCustomerModalOpen(true);
  };

  const handleCreateCustomerFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMessage('');

    if (!newCustName.trim()) {
      setModalErrorMessage('Customer / Business name is required.');
      return;
    }

    if (newCustPhone.trim() && !isValidIndianPhone(newCustPhone.trim())) {
      setModalErrorMessage('Please enter a valid 10-digit Indian phone number (or leave blank).');
      return;
    }

    if (newCustGstin.trim() && !isValidGSTIN(newCustGstin.trim())) {
      setModalErrorMessage('Please enter a valid 15-character GSTIN (e.g. 07AAAAA0000A1Z5) or leave blank.');
      return;
    }

    if (newCustEmail.trim() && !isValidEmail(newCustEmail.trim())) {
      setModalErrorMessage('Please enter a valid email address (or leave blank).');
      return;
    }

    setModalSaving(true);
    try {
      const cleanPhone = newCustPhone.trim().replace(/[^0-9]/g, '');
      const cleanGstin = newCustGstin.trim().toUpperCase();

      if (user) {
        const { data, error } = await supabase
          .from('customers')
          .insert({
            user_id: user.id,
            name: newCustName.trim(),
            phone: cleanPhone,
            email: newCustEmail.trim(),
            gstin: cleanGstin,
            address: newCustAddress.trim(),
            state: newCustState.trim() || 'Delhi'
          })
          .select()
          .single();

        if (error) {
          console.warn('Supabase customer insert notice:', error.message);
          const localCust: Customer = {
            id: 'temp_' + Date.now(),
            user_id: user.id,
            name: newCustName.trim(),
            phone: cleanPhone,
            email: newCustEmail.trim(),
            gstin: cleanGstin,
            address: newCustAddress.trim(),
            state: newCustState.trim() || 'Delhi'
          };
          setCustomers(prev => [...prev, localCust]);
          setSelectedCustomerId(localCust.id);
          setCustomerName(localCust.name);
          setCustomerPhone(localCust.phone);
          setCustomerEmail(localCust.email);
          setCustomerGstin(localCust.gstin);
          setCustomerState(localCust.state);
          setCustomerAddress(localCust.address);
          setCustomerModalOpen(false);
          return;
        }

        if (data) {
          setCustomers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
          setSelectedCustomerId(data.id);
          setCustomerName(data.name);
          setCustomerPhone(data.phone || '');
          setCustomerEmail(data.email || '');
          setCustomerGstin(data.gstin || '');
          setCustomerState(data.state || 'Delhi');
          setCustomerAddress(data.address || '');
          setCustomerModalOpen(false);
        }
      }
    } catch (err: any) {
      setModalErrorMessage(err?.message || 'Error saving customer. Please check your network.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleSaveInvoice = async (action: 'save' | 'pdf' | 'whatsapp') => {
    setErrorMessage('');

    if (!invoiceNumber.trim()) {
      setErrorMessage('Please enter an invoice number.');
      return;
    }

    const validItems = items.filter(it => it.product_name.trim().length > 0);
    if (validItems.length === 0) {
      setErrorMessage('Please add at least one line item with a name.');
      return;
    }

    setSaving(true);
    try {
      const activeCustomerObject: Customer = {
        id: selectedCustomerId && !selectedCustomerId.startsWith('temp_') ? selectedCustomerId : 'adhoc',
        user_id: user?.id || 'guest',
        name: customerName.trim() || 'Cash Customer',
        phone: customerPhone.trim(),
        email: customerEmail.trim(),
        gstin: customerGstin.trim().toUpperCase(),
        address: customerAddress.trim(),
        state: customerState.trim() || 'Delhi'
      };

      const lineItemsPayload: InvoiceItem[] = validItems.map(it => ({
        product_name: it.product_name.trim(),
        hsn_code: it.hsn_code ? it.hsn_code.trim() : '',
        qty: Number(it.qty) || 1,
        unit: it.unit || 'PCS',
        price: Number(it.price) || 0,
        gst_percent: Number(it.gst_percent) || 0,
        amount: Number(it.amount) || 0
      }));

      const fullInvoice: Invoice = {
        id: 'inv_' + Date.now(),
        user_id: user?.id || 'guest',
        customer_id: activeCustomerObject.id.startsWith('temp_') || activeCustomerObject.id === 'adhoc' ? undefined : activeCustomerObject.id,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        due_date: dueDate || undefined,
        tax_type: taxType,
        subtotal: totals.subtotal,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        discount: totals.discountAmount,
        grand_total: totals.grandTotal,
        status: 'UNPAID',
        notes: notes.trim(),
        items: lineItemsPayload,
        customer: activeCustomerObject
      };

      // 1. PDF Download
      if (action === 'pdf' && businessProfile) {
        try {
          const doc = await generateInvoicePDF(fullInvoice, businessProfile, activeCustomerObject);
          doc.save(`${fullInvoice.invoice_number}_${activeCustomerObject.name}.pdf`);
        } catch (pdfErr) {
          console.error('PDF Generation note:', pdfErr);
        }
      }

      // 2. WhatsApp / Native PDF Share
      if (action === 'whatsapp' && businessProfile) {
        try {
          await shareInvoicePDF(fullInvoice, businessProfile, activeCustomerObject);
        } catch (waErr) {
          console.error('Invoice share note:', waErr);
        }
      }

      // 3. Database Persistence
      if (user) {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData?.session?.user?.id || user.id;

        let finalCustomerId = selectedCustomerId && !selectedCustomerId.startsWith('temp_') ? selectedCustomerId : null;
        if (saveToDirectory && customerName.trim() && customerName !== 'Cash Customer' && !finalCustomerId) {
          try {
            const { data: newCust } = await supabase
              .from('customers')
              .insert({
                user_id: currentUserId,
                name: customerName.trim(),
                phone: customerPhone.trim(),
                email: customerEmail.trim(),
                gstin: customerGstin.trim().toUpperCase(),
                address: customerAddress.trim(),
                state: customerState.trim() || 'Delhi'
              })
              .select()
              .single();

            if (newCust) {
              finalCustomerId = newCust.id;
              setCustomers(prev => [...prev, newCust]);
            }
          } catch (e) {
            // ignore
          }
        }

        const { data: invData, error: invError } = await supabase
          .from('invoices')
          .insert({
            user_id: currentUserId,
            customer_id: finalCustomerId,
            invoice_number: invoiceNumber.trim(),
            invoice_date: invoiceDate,
            due_date: dueDate || null,
            tax_type: taxType,
            subtotal: totals.subtotal,
            cgst: totals.cgst,
            sgst: totals.sgst,
            igst: totals.igst,
            discount: totals.discountAmount,
            grand_total: totals.grandTotal,
            status: 'UNPAID',
            notes: notes.trim()
          })
          .select()
          .single();

        if (invError) {
          console.warn('Database save warning:', invError.message);
          if (invError.message.includes('row-level security') || invError.message.includes('policy')) {
            setErrorMessage('Your login session had expired or URL token was invalidated. Your PDF/WhatsApp was generated successfully! Please log in again to sync cloud history.');
          } else {
            setErrorMessage(invError.message);
          }
          setSaving(false);
          return;
        }

        if (invData) {
          const dbItems = validItems.map(it => ({
            invoice_id: invData.id,
            product_name: it.product_name.trim(),
            hsn_code: it.hsn_code ? it.hsn_code.trim() : '',
            qty: Number(it.qty) || 1,
            unit: it.unit || 'PCS',
            price: Number(it.price) || 0,
            gst_percent: Number(it.gst_percent) || 0,
            amount: Number(it.amount) || 0
          }));
          await supabase.from('invoice_items').insert(dbItems);

          try {
            confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
          } catch (e) {}

          if (onInvoiceCreated) onInvoiceCreated();
          setCurrentTab('invoices');
        }
      }
    } catch (err: any) {
      console.error('Invoice action error:', err);
      setErrorMessage(err?.message || 'Invoice processed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentTab('invoices')}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Create GST Tax Invoice
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Auto-calculates GST breakdown and generates UPI payment QR code
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={saving}
            onClick={() => handleSaveInvoice('save')}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer min-h-[44px]"
          >
            Save Draft
          </button>
          <button
            disabled={saving}
            onClick={() => handleSaveInvoice('pdf')}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Save & Download PDF
          </button>
          <button
            disabled={saving}
            onClick={() => handleSaveInvoice('whatsapp')}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <Share2 className="w-4 h-4" />
            WhatsApp Share
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      {gstSuccessMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-2xl flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold">{gstSuccessMessage}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 sm:p-8 space-y-8 transition-colors">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Invoice Number
            </label>
            <input
              type="text"
              required
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Invoice Date
            </label>
            <input
              type="date"
              required
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Due Date (Optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Tax Mechanism
            </label>
            <select
              value={taxType}
              onChange={e => setTaxType(e.target.value as TaxType)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            >
              <option value="CGST_SGST">Intra-State (CGST + SGST)</option>
              <option value="IGST">Inter-State (IGST)</option>
              <option value="NONE">Non-GST / Exempt (0%)</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Bill To (Customer Information)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Pick from directory or type directly on the invoice</p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenCustomerModal}
                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-blue-200/60 dark:border-blue-800/60 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add to Directory</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select from Directory
              </label>
              <select
                value={selectedCustomerId}
                onChange={e => handleSelectCustomerFromDropdown(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              >
                <option value="">-- Manual / Walk-in Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Customer / Firm Name *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={e => {
                  setCustomerName(e.target.value);
                  setIsManualCustomer(true);
                }}
                placeholder="e.g. Ramesh Trading Co. or Cash Customer"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number (WhatsApp)
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={e => {
                  setCustomerPhone(e.target.value);
                  setIsManualCustomer(true);
                }}
                placeholder="9876543210"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 text-xs">Customer GSTIN</label>
                <button
                  type="button"
                  disabled={fetchingGstInline || !customerGstin}
                  onClick={handleFetchGstInline}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                >
                  {fetchingGstInline ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                  <span>{fetchingGstInline ? 'Verifying...' : '⚡ Auto-Fill from GST'}</span>
                </button>
              </div>
              <input
                type="text"
                maxLength={15}
                value={customerGstin}
                onChange={e => {
                  setCustomerGstin(e.target.value.toUpperCase());
                  setIsManualCustomer(true);
                }}
                placeholder="07AAAAA0000A1Z5"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Place of Supply / State
              </label>
              <input
                type="text"
                value={customerState}
                onChange={e => {
                  setCustomerState(e.target.value);
                  setIsManualCustomer(true);
                }}
                placeholder="e.g. Delhi or Maharashtra"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Billing Address
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={e => {
                  setCustomerAddress(e.target.value);
                  setIsManualCustomer(true);
                }}
                placeholder="Shop / House No, City, Pincode"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {!selectedCustomerId && customerName && customerName !== 'Cash Customer' && (
            <label className="inline-flex items-center gap-2 cursor-pointer pt-1 text-xs text-blue-700 dark:text-blue-400 font-semibold">
              <input
                type="checkbox"
                checked={saveToDirectory}
                onChange={e => setSaveToDirectory(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-700 focus:ring-blue-500"
              />
              <span>Save this customer to my directory for future invoices</span>
            </label>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Line Items & Products</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Pick from products master or type manually</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100/75 dark:bg-slate-800/60 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Item / Description</th>
                  <th className="py-2.5 px-3 w-28">HSN/SAC</th>
                  <th className="py-2.5 px-3 w-24">Qty</th>
                  <th className="py-2.5 px-3 w-24">Unit</th>
                  <th className="py-2.5 px-3 w-28">Price (₹)</th>
                  <th className="py-2.5 px-3 w-24">GST %</th>
                  <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-200">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 text-center text-slate-400 dark:text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="space-y-1">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Cotton Shirt or Web Development"
                          value={item.product_name}
                          onChange={e => handleItemChange(idx, 'product_name', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                        />
                        {products.length > 0 && (
                          <select
                            onChange={e => handleSelectProduct(idx, e.target.value)}
                            defaultValue=""
                            className="w-full text-[10px] text-slate-500 dark:text-slate-400 bg-transparent border-0 focus:ring-0 p-0 cursor-pointer"
                          >
                            <option value="" disabled className="dark:bg-slate-800 dark:text-slate-300">⚡ Autofill from product master...</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id} className="dark:bg-slate-800 dark:text-slate-200">
                                {p.name} - ₹{p.price} ({p.gst_percent}%)
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        placeholder="6109"
                        value={item.hsn_code}
                        onChange={e => handleItemChange(idx, 'hsn_code', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-center text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.qty}
                        onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-center text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={item.unit}
                        onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      >
                        <option value="PCS">PCS</option>
                        <option value="NOS">NOS</option>
                        <option value="KG">KG</option>
                        <option value="MTR">MTR</option>
                        <option value="BOX">BOX</option>
                        <option value="SET">SET</option>
                        <option value="LTR">LTR</option>
                        <option value="BAG">BAG</option>
                        <option value="HRS">HRS</option>
                        <option value="SQFT">SQFT</option>
                        <option value="DOZ">DOZ</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.price}
                        onChange={e => handleItemChange(idx, 'price', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-right text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={item.gst_percent}
                        onChange={e => handleItemChange(idx, 'gst_percent', Number(e.target.value))}
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-center text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                      {formatINR(item.amount)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={items.length <= 1}
                        className="text-slate-300 dark:text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-30 transition p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleAddItemRow}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Item</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Invoice Notes & Terms (Optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Thanks for your business! Payment due within 15 days."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Apply Discount</span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Deducted before tax calculation</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={discountValue}
                  onChange={e => setDiscountValue(Number(e.target.value) || 0)}
                  className="w-24 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-right text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setDiscountIsPercentage(!discountIsPercentage)}
                  className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer"
                >
                  {discountIsPercentage ? '%' : '₹'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{formatINR(totals.subtotal)}</span>
            </div>

            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span>Discount Applied:</span>
                <span>- {formatINR(totals.discountAmount)}</span>
              </div>
            )}

            {taxType === 'CGST_SGST' ? (
              <>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>CGST (Central Tax):</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatINR(totals.cgst)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>SGST (State Tax):</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatINR(totals.sgst)}</span>
                </div>
              </>
            ) : taxType === 'IGST' ? (
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>IGST (Integrated Tax):</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatINR(totals.igst)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 italic">
                <span>GST Tax:</span>
                <span>Exempt / Zero Rated</span>
              </div>
            )}

            {totals.roundOff !== 0 && (
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Round Off:</span>
                <span>{totals.roundOff > 0 ? `+${totals.roundOff}` : totals.roundOff}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <span className="text-sm font-black text-slate-900 dark:text-white">Grand Total:</span>
              <span className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                {formatINR(totals.grandTotal)}
              </span>
            </div>

            <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium italic">
              {numberToIndianWords(totals.grandTotal)}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        title="Add New Customer to Directory"
      >
        <form onSubmit={handleCreateCustomerFromModal} className="space-y-4 text-xs">
          {modalErrorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{modalErrorMessage}</span>
            </div>
          )}

          {modalNoticeMessage && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[11px] rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{modalNoticeMessage}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer / Business Name *</label>
            <input
              type="text"
              required
              value={newCustName}
              onChange={e => setNewCustName(e.target.value)}
              placeholder="e.g. Acme Trading Co."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number (10 digits)</label>
              <input
                type="text"
                value={newCustPhone}
                onChange={e => setNewCustPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">GSTIN</label>
                <button
                  type="button"
                  disabled={fetchingGstModal || !newCustGstin}
                  onClick={handleFetchGstModal}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                >
                  {fetchingGstModal ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                  <span>{fetchingGstModal ? 'Verifying...' : '⚡ Fetch'}</span>
                </button>
              </div>
              <input
                type="text"
                maxLength={15}
                value={newCustGstin}
                onChange={e => setNewCustGstin(e.target.value.toUpperCase())}
                placeholder="07AAAAA0000A1Z5"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email (Optional)</label>
              <input
                type="email"
                value={newCustEmail}
                onChange={e => setNewCustEmail(e.target.value)}
                placeholder="customer@email.com"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Place of Supply / State</label>
              <input
                type="text"
                value={newCustState}
                onChange={e => setNewCustState(e.target.value)}
                placeholder="e.g. Maharashtra"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Billing Address</label>
            <textarea
              rows={2}
              value={newCustAddress}
              onChange={e => setNewCustAddress(e.target.value)}
              placeholder="Shop No 12, Main Market..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCustomerModalOpen(false)}
              className="flex-1 py-2 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={modalSaving}
              className="flex-1 py-2 font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px]"
            >
              {modalSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save Customer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Monthly Free Invoice Limit Reached"
      >
        <div className="text-center space-y-4 py-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            You have reached the 5 Free Invoices limit for this month
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Upgrade to BillKaro Pro starting at just <strong className="text-slate-900 dark:text-white">₹49/month</strong> or <strong className="text-slate-900 dark:text-white">₹470/year</strong> to generate Unlimited Invoices, enable Custom Logo & Digital Signature, and 100% Ad-Free Billing.
          </p>
          <div className="flex gap-3 pt-3">
            <button
              onClick={() => setUpgradeModalOpen(false)}
              className="flex-1 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer min-h-[44px]"
            >
              Continue on Free
            </button>
            <button
              onClick={() => {
                setUpgradeModalOpen(false);
                setCurrentTab('premium');
              }}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition shadow-md cursor-pointer min-h-[44px]"
            >
              Upgrade to Pro (From ₹49)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
