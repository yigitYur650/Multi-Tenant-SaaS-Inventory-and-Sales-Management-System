import React, { useState, useEffect } from 'react';
import { useServices } from './ServiceProvider';
import { useRefresh } from './RefreshContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/formatter';
import { Plus, Trash2, Package, History as HistoryIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { useMasterData } from '../context/MasterDataContext';
import { useTranslation } from 'react-i18next';

interface ProductFormProps {
  onClose: () => void;
  initialData?: any;
}

export function ProductForm({ onClose, initialData }: ProductFormProps) {
  const { t } = useTranslation();
  const { productService, stockService } = useServices();
  const { triggerRefresh } = useRefresh();
  const { profile, user } = useAuth();
  const { categories, colors, sizes } = useMasterData();
  const [loading, setLoading] = useState(false);
  
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [variants, setVariants] = useState<any[]>([]);

  useEffect(() => {
    if (initialData) {
      setCategoryId(initialData.category_id || '');
      setDescription(initialData.description || '');
      
      const mappedVariants = initialData.product_variants?.map((v: any) => ({
        id: v.id,
        color_id: v.color || v.color_id || '',
        size_id: v.size || v.size_id || '',
        sku: v.sku || '',
        retail_price: v.retail_price || '',
        stock_quantity: v.stock_quantity || '',
        low_stock_threshold: v.low_stock_threshold || '',
        isExisting: true
      })) || [];

      setVariants(mappedVariants.length > 0 ? mappedVariants : [{
        id: Date.now().toString(),
        color_id: '', size_id: '', sku: '', retail_price: '', stock_quantity: '', low_stock_threshold: '', isExisting: false
      }]);
    } else {
      setCategoryId('');
      setDescription('');
      setVariants([{
        id: Date.now().toString(),
        color_id: '', size_id: '', sku: '', retail_price: '', stock_quantity: '', low_stock_threshold: '', isExisting: false
      }]);
    }
  }, [initialData]);
  
  const handleAddVariant = () => {
    setVariants([...variants, {
      id: Date.now().toString(),
      color_id: '', size_id: '', sku: '', retail_price: '', stock_quantity: '', low_stock_threshold: '', isExisting: false
    }]);
  };

  const handleUpdateVariant = (id: string, field: string, value: string) => {
    setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const handleRemoveVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) return alert(t('productForm.errors.selectCategory'));
    
    for (const v of variants) {
      if (!v.color_id || !v.size_id) {
        return alert(t('productForm.errors.selectColorSize'));
      }
      if (v.low_stock_threshold === '' || v.low_stock_threshold === null) {
        return alert(t('productForm.errors.setThreshold'));
      }
    }
    
    setLoading(true);
    try {
      const selectedCat = categories.find(c => c.id === categoryId);
      
      const productPayload = {
        name: selectedCat?.name || t('inventory.product.noCategory'),
        description: description.trim() || null,
        shop_id: profile?.shop_id || '',
        category_id: categoryId
      };
      
      let productId = initialData?.id;

      if (initialData) {
        await productService.updateProduct(productId, productPayload);
      } else {
        const product = await productService.createProduct(productPayload as any);
        productId = product.id;
      }

      if (initialData) {
        const currentVariantIds = variants.filter(v => v.isExisting).map(v => v.id);
        const originalVariantIds = initialData.product_variants.map((v: any) => v.id);
        const toDelete = originalVariantIds.filter((id: string) => !currentVariantIds.includes(id));
        
        for (const deleteId of toDelete) {
          await productService.deleteVariant(deleteId);
        }
      }

      for (const [index, v] of variants.entries()) {
        const retailPriceNum = parseFloat(v.retail_price.toString().replace(',', '.')) || 0;
        const stockQtyNum = parseInt(v.stock_quantity.toString()) || 0;
        const lowStockThresholdNum = parseInt(v.low_stock_threshold.toString()) || 0;

        const variantPayload: any = {
          product_id: productId,
          color_id: v.color_id || null,
          size_id: v.size_id || null,
          sku: v.sku?.trim() || null,
          retail_price: retailPriceNum,
          wholesale_price: retailPriceNum * 0.8,
          low_stock_threshold: lowStockThresholdNum
        };

        if (v.isExisting) {
          // Calculate stock delta and update via stockService to avoid direct triggers on stock_quantity
          const orig = initialData?.product_variants?.find((ov: any) => ov.id === v.id);
          const oldStock = orig ? (orig.stock_quantity || 0) : 0;
          const delta = stockQtyNum - oldStock;
          
          if (delta !== 0) {
            await stockService.addStockMovement({
              variant_id: v.id,
              shop_id: profile?.shop_id || '',
              type: delta > 0 ? 'IN' : 'OUT',
              quantity: Math.abs(delta),
              user_email: user?.email || 'System',
              previous_stock: oldStock,
              new_stock: stockQtyNum
            });
          }

          await productService.updateVariant(v.id, variantPayload);
        } else {
          variantPayload.stock_quantity = stockQtyNum;
          await productService.createVariant(variantPayload);
        }
      }
      
      triggerRefresh();
      onClose();
    } catch (err: any) {
      alert(`${t('productForm.errors.generic')} ${err.message || 'Bilinmiyor'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 space-y-8 pb-10">
        
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-indigo-600 mb-4 tracking-wider uppercase">{t('productForm.step1')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5 ml-1">{t('productForm.categoryLabel')}</label>
              <select
                required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm font-medium"
              >
                <option value="">{t('productForm.selectPlaceholder')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5 ml-1">{t('productForm.descriptionLabel')}</label>
              <textarea 
                value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm resize-none text-sm"
                placeholder={t('productForm.descriptionPlaceholder')}
              />
            </div>
          </div>
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-blue-600 tracking-wider uppercase">{t('productForm.step2')}</h3>
            <button 
              type="button" 
              onClick={handleAddVariant}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Plus size={14} /> {t('productForm.addVariant')}
            </button>
          </div>
          
          <div className="space-y-4 relative">
            <div className="absolute top-4 bottom-4 left-[23px] w-0.5 bg-slate-100 -z-10 rounded-full"></div>
            
            <AnimatePresence mode="popLayout">
              {variants.length > 0 ? (
                variants.map((variant, index) => (
                  <motion.div 
                    key={variant.id}
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    className="relative pl-12"
                  >
                    <div className="absolute left-[19px] top-6 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm z-10"></div>
                    
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm group">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                          # {index + 1}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveVariant(variant.id)}
                          className="text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-3">
                         <div>
                           <label className="block text-[11px] font-semibold text-slate-500 mb-1 ml-1 uppercase">{t('productForm.colorLabel')}</label>
                           <select
                             required value={variant.color_id} onChange={(e) => handleUpdateVariant(variant.id, 'color_id', e.target.value)}
                             className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                           >
                             <option value="">{t('productForm.colorLabel')} {t('productForm.selectPlaceholder').toLowerCase()}</option>
                             {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                           </select>
                         </div>
                         <div>
                           <label className="block text-[11px] font-semibold text-slate-500 mb-1 ml-1 uppercase">{t('productForm.sizeLabel')}</label>
                           <select
                             required value={variant.size_id} onChange={(e) => handleUpdateVariant(variant.id, 'size_id', e.target.value)}
                             className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                           >
                             <option value="">{t('productForm.sizeLabel')} {t('productForm.selectPlaceholder').toLowerCase()}</option>
                             {sizes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                           </select>
                         </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                         <div>
                           <label className="block text-[11px] font-semibold text-slate-500 mb-1 ml-1 uppercase">{t('productForm.stockLabel')}</label>
                           <input 
                             required type="number" min="0" value={variant.stock_quantity} onChange={(e) => handleUpdateVariant(variant.id, 'stock_quantity', e.target.value)}
                             className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                             placeholder={t('inventory.stockModal.unit')}
                           />
                         </div>
                         <div>
                           <label className="block text-[11px] font-semibold text-slate-500 mb-1 ml-1 uppercase">{t('productForm.criticalStockLabel')}</label>
                           <input 
                             required type="number" min="0" value={variant.low_stock_threshold} onChange={(e) => handleUpdateVariant(variant.id, 'low_stock_threshold', e.target.value)}
                             className="w-full px-3 py-2 bg-rose-50 border border-rose-100 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-rose-500 outline-none transition-colors text-rose-600 font-bold"
                             placeholder={t('categoryManager.history.result')}
                           />
                         </div>
                         <div>
                           <label className="block text-[11px] font-semibold text-slate-500 mb-1 ml-1 uppercase">{t('productForm.priceLabel')}</label>
                           <input 
                             required type="number" min="0" step="0.01" value={variant.retail_price} onChange={(e) => handleUpdateVariant(variant.id, 'retail_price', e.target.value)}
                             className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-emerald-600 font-bold"
                             placeholder="0.00"
                           />
                         </div>
                         <div>
                           <label className="block text-[11px] font-semibold text-slate-500 mb-1 ml-1 uppercase">{t('productForm.skuLabel')}</label>
                           <input 
                             value={variant.sku} onChange={(e) => handleUpdateVariant(variant.id, 'sku', e.target.value)}
                             className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-mono focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                             placeholder={t('productForm.skuPlaceholder')}
                           />
                         </div>
                      </div>

                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-12 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 gap-3"
                >
                  <Package size={40} className="opacity-20" />
                  <p className="font-bold text-sm">{t('productForm.noVariant')}</p>
                  <button 
                    type="button" 
                    onClick={handleAddVariant}
                    className="text-xs font-black text-blue-600 underline underline-offset-4"
                  >
                    {t('productForm.addVariantNow')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {initialData && (
        <div className="mt-12 bg-slate-50 rounded-3xl p-8 border border-white shadow-inner">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <HistoryIcon size={20} />
            </div>
            <h3 className="text-lg font-black text-slate-800">{t('productForm.auditTrail')}</h3>
          </div>
          
          <div className="space-y-4">
            {variants.filter(v => v.isExisting).map((v: any) => (
              <MovementHistoryList key={v.id} variantId={v.id} variantLabel={`${v.sku || 'SKU Yok'} (${colors.find(c => c.id === v.color_id)?.name} - ${sizes.find(s => s.id === v.size_id)?.name})`} />
            ))}
          </div>
        </div>
      )}

      <div className="pt-6 border-t border-slate-200/60 flex items-center justify-between gap-4 mt-12 sticky bottom-0 bg-white/90 backdrop-blur-md pb-4">
        <button 
          type="button" 
          onClick={onClose}
          className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
        >
          {t('productForm.cancel')}
        </button>
        <button 
          type="submit" 
          disabled={loading || categories.length === 0}
          className="flex-1 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 transition-all disabled:opacity-70 flex justify-center items-center"
        >
          {loading ? (
             <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('productForm.saving')}
             </div>
          ) : (
            <div className="flex items-center gap-2">
              <Package size={18} /> {initialData ? t('productForm.saveChanges') : t('productForm.saveAll')}
            </div>
          )}
        </button>
      </div>
    </form>
  );
}

function MovementHistoryList({ variantId, variantLabel }: { variantId: string, variantLabel: string }) {
  const { t } = useTranslation();
  const { stockService } = useServices();
  const { profile } = useAuth();
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!variantId || variantId.length < 20) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await stockService.getMovementHistory(variantId);
        setMovements(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [variantId]);

  if (loading) return <div className="text-[10px] text-slate-400 p-2 animate-pulse font-bold tracking-widest">{t('categoryManager.history.loading')}</div>;
  if (!movements.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm mb-6">
      <div className="px-5 py-3 bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.2em] flex justify-between items-center">
        <span>{variantLabel}</span>
        <span className="bg-indigo-500 px-2 py-0.5 rounded text-[9px]">{movements.length} {t('categoryManager.history.records')}</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-2 font-black text-slate-400 uppercase tracking-tighter">{t('categoryManager.history.date')}</th>
              <th className="px-4 py-2 font-black text-slate-400 uppercase tracking-tighter">{t('categoryManager.history.user')}</th>
              <th className="px-4 py-2 font-black text-slate-400 uppercase tracking-tighter text-center">{t('categoryManager.history.type')}</th>
              <th className="px-4 py-2 font-black text-slate-400 uppercase tracking-tighter text-right">{t('categoryManager.history.previous')}</th>
              <th className="px-4 py-2 font-black text-slate-400 uppercase tracking-tighter text-right">{t('categoryManager.history.change')}</th>
              <th className="px-4 py-2 font-black text-slate-400 uppercase tracking-tighter text-right">{t('categoryManager.history.result')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {movements.map((m: any) => (
              <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  {formatDate(m.created_at, profile)}
                </td>
                <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">
                  {m.user_email || t('categoryManager.history.system')}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-md font-black text-[9px] ${m.type === 'IN' || m.type === 'RETURN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {m.type === 'IN' || m.type === 'RETURN' ? t('categoryManager.history.in') : t('categoryManager.history.out')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-400 font-mono">{m.previous_stock ?? '-'}</td>
                <td className={`px-4 py-3 text-right font-black ${m.type === 'IN' || m.type === 'RETURN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {m.type === 'IN' || m.type === 'RETURN' ? '+' : '-'}{m.quantity}
                </td>
                <td className="px-4 py-3 text-right font-black text-slate-900 bg-slate-50/30">{m.new_stock ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

