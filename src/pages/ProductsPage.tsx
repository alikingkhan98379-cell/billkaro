import React, { useEffect, useState } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { supabase } from '../lib/supabase';
import { Product } from '../types';
import { formatINR } from '../utils/currency';
import { Modal } from '../components/common/Modal';
import { isValidHSN } from '../utils/validators';

export const ProductsPage: React.FC = () => {
  const { user } = useAuth();
  const { activeCompany, activeCompanyId, companies, isItemForActiveCompany, resolveCompany } = useCompany();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewFilter, setViewFilter] = useState<'active' | 'all'>('active');

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Form Fields
  const [name, setName] = useState<string>('');
  const [hsnCode, setHsnCode] = useState<string>('');
  const [price, setPrice] = useState<number | string>('');
  const [unit, setUnit] = useState<string>('PCS');
  const [gstPercent, setGstPercent] = useState<number>(18);

  const fetchProducts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (!error && data) {
        setProducts(data);
      }
    } catch (e) {
      console.error('Error loading products:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [user]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setHsnCode('');
    setPrice('');
    setUnit('PCS');
    setGstPercent(18);
    setErrorMessage('');
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setHsnCode(p.hsn_code || '');
    setPrice(p.price);
    setUnit(p.unit || 'PCS');
    setGstPercent(p.gst_percent);
    setErrorMessage('');
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!user) return;

    if (!name.trim()) {
      setErrorMessage('Item name is required.');
      return;
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setErrorMessage('Please enter a valid price (greater than or equal to 0).');
      return;
    }
    if (hsnCode && !isValidHSN(hsnCode)) {
      setErrorMessage('Please enter a valid 2 to 8 digit HSN/SAC code.');
      return;
    }

    setSaving(true);
    try {
      if (editingProduct) {
        const { data, error } = await supabase
          .from('products')
          .update({
            name: name.trim(),
            hsn_code: hsnCode.trim(),
            price: numPrice,
            unit: unit.trim(),
            gst_percent: Number(gstPercent),
            updated_at: new Date().toISOString()
          })
          .eq('id', editingProduct.id)
          .select()
          .single();

        if (error) {
          setErrorMessage(error.message);
        } else if (data) {
          setProducts(prev => prev.map(p => (p.id === data.id ? data : p)));
          setModalOpen(false);
        }
      } else {
        const primaryId = companies.length > 0 ? companies[0].id : null;
        const currentId = activeCompany?.id || activeCompanyId || primaryId;

        const { data, error } = await supabase
          .from('products')
          .insert({
            user_id: user.id,
            company_id: currentId,
            name: name.trim(),
            hsn_code: hsnCode.trim(),
            price: numPrice,
            unit: unit.trim(),
            gst_percent: Number(gstPercent)
          })
          .select()
          .single();

        if (error) {
          setErrorMessage(error.message);
        } else if (data) {
          setProducts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
          setModalOpen(false);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete.id);

      setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
      setDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  const filteredProducts = products.filter(p => {
    if (viewFilter === 'active' && !isItemForActiveCompany(p)) {
      return false;
    }
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.hsn_code && p.hsn_code.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Products & Items Master
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Store inventory items, HSN codes, default rates, and GST tax slabs for <strong className="text-blue-600 dark:text-blue-400">{activeCompany?.name || 'your business'}</strong>
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition self-start sm:self-auto cursor-pointer min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Item</span>
        </button>
      </div>

      {/* View Filter Pill Bar (When multiple companies exist) */}
      {companies.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Filtering:</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-xs font-black">
              {viewFilter === 'active' ? (activeCompany?.name || 'Active Business') : 'All Businesses Combined'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewFilter('active')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer min-h-[32px] ${
                viewFilter === 'active'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {activeCompany?.name || 'Active Business'} Only
            </button>
            <button
              onClick={() => setViewFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer min-h-[32px] ${
                viewFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
              }`}
            >
              All Businesses ({products.length})
            </button>
          </div>
        </div>
      )}

      {/* Catalog Search & List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 sm:p-6 space-y-4 transition-colors">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search items by name or HSN code..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs">Loading items master...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No items found</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Add your items or services once to autocomplete prices, HSN, and GST on every invoice.
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition cursor-pointer"
            >
              + Add Item
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">HSN / SAC</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4">Base Rate</th>
                  <th className="py-3 px-4">GST Rate</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-200">
                {filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        {companies.length > 1 && (
                          <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200/50">
                            {resolveCompany(p.company_id)?.name || 'Primary'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {p.hsn_code || '-'}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-500 dark:text-slate-400">
                      {p.unit}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {formatINR(p.price)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {p.gst_percent}% GST
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setProductToDelete(p);
                            setDeleteModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? 'Edit Product / Service' : 'Add New Product / Service'}
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Item / Product Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Graphic Design Services or Formal Cotton Shirt"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">HSN / SAC Code</label>
              <input
                type="text"
                value={hsnCode}
                onChange={e => setHsnCode(e.target.value)}
                placeholder="e.g. 998314 or 6109"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Unit of Measurement</label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              >
                <option value="PCS">PCS (Pieces)</option>
                <option value="NOS">NOS (Numbers)</option>
                <option value="KG">KG (Kilograms)</option>
                <option value="MTR">MTR (Meters)</option>
                <option value="BOX">BOX (Boxes)</option>
                <option value="SET">SET (Sets)</option>
                <option value="LTR">LTR (Liters)</option>
                <option value="BAG">BAG (Bags)</option>
                <option value="HRS">HRS (Hours)</option>
                <option value="SQFT">SQFT (Square Feet)</option>
                <option value="DOZ">DOZ (Dozens)</option>
                <option value="TON">TON (Metric Tonnes)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Default Selling Price (₹) *</label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">GST Tax Slab</label>
              <select
                value={gstPercent}
                onChange={e => setGstPercent(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600"
              >
                <option value="0">0% (Nil / Exempt)</option>
                <option value="5">5% GST</option>
                <option value="12">12% GST</option>
                <option value="18">18% GST (Standard)</option>
                <option value="28">28% GST (Luxury / Sin)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              {saving ? 'Saving...' : editingProduct ? 'Update Product' : 'Save Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Product Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Item"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Are you sure you want to delete item <strong className="text-slate-900 dark:text-white">{productToDelete?.name}</strong>?
          </p>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="flex-1 py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 py-2.5 font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 cursor-pointer min-h-[44px]"
            >
              Delete Item
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
