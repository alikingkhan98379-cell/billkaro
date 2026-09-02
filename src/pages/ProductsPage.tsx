import React, { useEffect, useState } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Tag, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Product } from '../types';
import { formatINR } from '../utils/currency';
import { Modal } from '../components/common/Modal';
import { isValidHSN } from '../utils/validators';

export const ProductsPage: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

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
        // Update
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
        // Insert
        const { data, error } = await supabase
          .from('products')
          .insert({
            user_id: user.id,
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
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.hsn_code && p.hsn_code.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Products & Items Master
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Store your inventory items, HSN codes, default rates, and GST tax slabs
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add New Item
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search items by name or HSN code..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs">Loading items master...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">No items found</h4>
            <p className="text-xs text-slate-500 mt-1">Add items to quickly autocomplete rows when creating invoices</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">HSN / SAC</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4">Base Rate (?)</th>
                  <th className="py-3 px-4">GST Rate</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {p.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {p.hsn_code || '-'}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-500">
                      {p.unit}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {formatINR(p.price)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {p.gst_percent}% GST
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setProductToDelete(p);
                            setDeleteModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
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
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Item / Product Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Graphic Design Services or Formal Cotton Shirt"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">HSN / SAC Code</label>
              <input
                type="text"
                value={hsnCode}
                onChange={e => setHsnCode(e.target.value)}
                placeholder="e.g. 998314 or 6109"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Unit of Measurement</label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-blue-600"
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
              <label className="block font-bold text-slate-700 mb-1">Default Selling Price (?) *</label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">GST Tax Slab</label>
              <select
                value={gstPercent}
                onChange={e => setGstPercent(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:ring-2 focus:ring-blue-600"
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
              className="flex-1 py-2 font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
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
          <p className="text-slate-600">
            Are you sure you want to delete item <strong className="text-slate-900">{productToDelete?.name}</strong>?
          </p>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="flex-1 py-2 font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 py-2 font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700"
            >
              Delete Item
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
