import React, { useEffect, useState, useMemo } from 'react';
import { useServices } from '../components/ServiceProvider';
import { useRefresh } from '../components/RefreshContext';
import { PageTransition } from '../components/PageTransition';
import { Package, Plus, Trash2, Edit3, Folders, Filter, X, ArrowUpRight, ArrowDownRight, History, Activity } from 'lucide-react';
import { SlideOver } from '../components/SlideOver';
import { ProductForm } from '../components/ProductForm';
import { CategoryManager } from '../components/CategoryManager';
import { SkeletonCard } from '../components/Skeleton';
import { useMasterData } from '../context/MasterDataContext';
import { useAuth } from '../context/AuthContext';
import { pdfService } from '../services/pdfService';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Inventory() {
  const { t } = useTranslation();
  const { productService, stockService } = useServices();
  const { refreshKey, triggerRefresh } = useRefresh();
  const { categories, colors, sizes } = useMasterData();
  const { profile } = useAuth();
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Modals
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        setErrorMsg('');
        let pl;
        if (searchQuery.trim().length > 0) {
          pl = await productService.smartSearch(searchQuery);
        } else {
          pl = await productService.getProductsWithVariants();
        }
        setProducts(pl);
      } catch (err) {
        setErrorMsg(t('inventory.product.noProductFound'));
      } finally {
        setLoading(false);
      }
    }
    const isInitialLoad = !products.length;
    const delay = searchQuery.trim().length > 0 ? 300 : (isInitialLoad ? 0 : 100);

    const delayDebounceFn = setTimeout(() => {
      loadProducts();
    }, delay);

    return () => clearTimeout(delayDebounceFn);
  }, [productService, refreshKey, searchQuery, t]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = !selectedCat || p.category_id === selectedCat;
      const matchColor = !selectedColor || p.product_variants?.some((v: any) => v.color_id === selectedColor);
      const matchSize = !selectedSize || p.product_variants?.some((v: any) => v.size_id === selectedSize);
      return matchCat && matchColor && matchSize;
    });
  }, [products, selectedCat, selectedColor, selectedSize]);

  const handleEdit = (product: any) => {
    if (profile?.role !== 3) return alert(t('inventory.product.editNoAuth'));
    setEditingProduct(product);
    setIsProductFormOpen(true);
  };

  const openStockModal = (variant: any, productName: string, allVariants: any[] = []) => {
    setSelectedVariant({ ...variant, productName, allVariants });
    setIsStockModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (profile?.role !== 3) return alert(t('inventory.product.deleteNoAuth'));
    if (confirm(t('inventory.product.deleteConfirm'))) {
      try {
        await productService.deleteProduct(id);
        triggerRefresh();
      } catch(err: any) {
        alert(err.message || t('inventory.stockModal.error'));
      }
    }
  };

  const handleCloseForm = () => {
    setIsProductFormOpen(false);
    setEditingProduct(null);
  };

  const resetFilters = () => {
    setSelectedCat('');
    setSelectedColor('');
    setSelectedSize('');
    setSearchQuery('');
  };

  return (
    <PageTransition className="pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 border-l-4 border-indigo-600 pl-4">{t('inventory.title')}</h1>
          <p className="text-sm text-slate-500 mt-1 pl-4">{t('inventory.subtitle')}</p>
        </div>
        
        {profile?.role === 3 && (
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => pdfService.generateInventoryReport(products, profile, profile?.shops?.name)}
              className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-6 py-3 rounded-2xl font-bold text-sm transition-all border border-emerald-200 shadow-sm"
            >
              <FileText size={18} /> {t('inventory.buttons.report')}
            </button>
            <button 
              onClick={() => setIsCategoryManagerOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-2xl font-bold text-sm transition-all border border-slate-200 shadow-sm"
            >
              <Folders size={18} className="text-indigo-600" /> {t('inventory.buttons.manageCategories')}
            </button>
            <button 
              onClick={() => { setEditingProduct(null); setIsProductFormOpen(true); }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-xl shadow-indigo-200 group"
            >
              <Plus size={18} /> {t('inventory.buttons.addNew')}
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 mb-8 flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
           <input
             type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
             placeholder={t('inventory.filters.searchPlaceholder')}
             className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 transition-all shadow-sm"
           />
           <Folders className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        </div>
        <div className="flex flex-wrap gap-2">
           <select 
             value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}
             className="bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-600"
           >
             <option value="">{t('inventory.filters.allCategories')}</option>
             {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
           </select>
           <select 
             value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)}
             className="bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-600"
           >
             <option value="">{t('inventory.filters.color')}</option>
             {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
           </select>
           <button onClick={resetFilters} title={t('inventory.filters.reset')} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"><X size={18} /></button>
        </div>
      </div>

      {/* Main Inventory Grid */}
      <div className="bg-slate-50/50 rounded-3xl p-8 border border-white shadow-inner min-h-[500px]">
        {loading ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
           </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((p) => (
              <div key={p.id} className="bg-white rounded-3xl p-7 shadow-sm border border-slate-100 hover:shadow-2xl hover:shadow-indigo-100 transition-all group flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black uppercase tracking-tighter bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md leading-none">
                    {p.categories?.name || t('inventory.product.noCategory')}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {profile?.role === 3 && (
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
                
                <h4 className="font-extrabold text-slate-800 text-xl leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                  {p.name}
                </h4>
                {p.description && <p className="text-xs text-slate-600 italic mb-6 line-clamp-2">"{p.description}"</p>}

                <div className="space-y-3 mb-8">
                  {p.product_variants?.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100/50 hover:bg-indigo-50/50 transition-colors">
                       <div className="flex flex-col">
                         <span className="text-[11px] font-bold text-slate-700">{v.colors?.name} / {v.sizes?.name}</span>
                         <span className="text-[9px] font-mono text-slate-600">{v.sku || 'N/A'}</span>
                       </div>
                       <div className="flex items-center gap-3">
                         <div className={`px-2 py-1 rounded-lg text-xs font-black ${v.stock_quantity <= (v.low_stock_threshold || 10) ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>
                           {v.stock_quantity}
                         </div>
                          <button 
                            onClick={() => openStockModal({ ...v, shop_id: p.shop_id }, p.name)}
                            className="p-2 bg-white rounded-xl shadow-sm hover:bg-indigo-600 hover:text-white transition-all scale-90 hover:scale-100"
                            title={t('inventory.product.stockAction')}
                          >
                            <Activity size={14} />
                          </button>
                       </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-6 border-t border-slate-50 flex gap-2">
                  <button 
                    onClick={() => handleEdit(p)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${profile?.role === 3 ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    disabled={profile?.role !== 3}
                    title={profile?.role !== 3 ? t('inventory.product.adminOnly') : ""}
                  >
                    <Edit3 size={16} /> {t('inventory.product.details')}
                  </button>
                  <button 
                    onClick={() => {
                      if (p.product_variants && p.product_variants.length > 0) {
                        const variantsWithShop = p.product_variants.map((v: any) => ({ ...v, shop_id: p.shop_id }));
                        openStockModal(variantsWithShop[0], p.name, variantsWithShop);
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all border border-indigo-100"
                  >
                    <Activity size={16} /> {t('inventory.product.stockAction')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300 italic font-medium">
            <Filter size={48} className="mb-4 opacity-20" />
            {t('inventory.product.noProductFound')}
          </div>
        )}
      </div>

      {/* SlideOver: Product Edit / Detail */}
      <SlideOver 
        isOpen={isProductFormOpen} 
        onClose={handleCloseForm}
        title={editingProduct ? t('productForm.titleEdit') : t('productForm.titleNew')}
      >
        <ProductForm 
          onClose={handleCloseForm} 
          initialData={editingProduct}
        />
      </SlideOver>

      {/* SlideOver: Category Management */}
      <SlideOver
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        title={t('categoryManager.title')}
      >
        <CategoryManager />
      </SlideOver>

      {/* Modal: Stock Movement */}
      {isStockModalOpen && selectedVariant && (
        <StockMovementModal 
          variant={selectedVariant}
          onClose={() => { setIsStockModalOpen(false); setSelectedVariant(null); }}
          onSuccess={() => { triggerRefresh(); setIsStockModalOpen(false); setSelectedVariant(null); }}
        />
      )}
    </PageTransition>
  );
}

// Yeni: Stok Hareketi Modalı
function StockMovementModal({ variant, onClose, onSuccess }: { variant: any, onClose: () => void, onSuccess: () => void }) {
  const { t } = useTranslation();
  const { stockService } = useServices();
  const { profile, user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState('1');
  
  // Çoklu varyant desteği
  const [currentVariant, setCurrentVariant] = useState(variant);
  const allVariants = variant.allVariants || [variant];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseInt(quantity);
    if (!qtyNum || qtyNum <= 0) return alert(t('inventory.stockModal.quantityError'));
    
    setLoading(true);
    try {
      const prevStock = currentVariant.stock_quantity || 0;
      const newStock = type === 'IN' ? prevStock + qtyNum : prevStock - qtyNum;

      if (type === 'OUT' && newStock < 0) {
        if (!confirm(t('inventory.stockModal.negativeStockWarning'))) {
           setLoading(false);
           return;
        }
      }

      const movementPayload = {
        variant_id: String(currentVariant.id),
        shop_id: String(currentVariant.shop_id || profile?.shop_id || ''),
        type: type.toUpperCase(),
        quantity: parseInt(String(qtyNum), 10),
        user_email: String(user?.email || t('categoryManager.history.system')), 
        previous_stock: parseInt(String(prevStock), 10),
        new_stock: parseInt(String(newStock), 10)
      };

      await stockService.addStockMovement(movementPayload);
      onSuccess();
    } catch (err) {
      alert(t('inventory.stockModal.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
           <div>
             <h3 className="font-bold">{t('inventory.stockModal.title')}</h3>
             <p className="text-[10px] text-slate-400 uppercase tracking-widest">{variant.productName}</p>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
           {/* Varyant Seçici (Eğer birden fazla varyant varsa) */}
           {allVariants.length > 1 && (
             <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase ml-2">{t('inventory.stockModal.variantSelection')}</label>
               <select 
                 value={currentVariant.id}
                 onChange={(e) => setCurrentVariant(allVariants.find((v: any) => v.id === e.target.value))}
                 className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700"
               >
                 {allVariants.map((v: any) => (
                   <option key={v.id} value={v.id}>
                     {v.colors?.name} / {v.sizes?.name} ({t('inventory.product.stock')}: {v.stock_quantity})
                   </option>
                 ))}
               </select>
             </div>
           )}

           <div className="flex gap-4">
             <button 
               type="button" onClick={() => setType('IN')}
               className={`flex-1 flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${type === 'IN' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:bg-slate-50'}`}
             >
               <div className={`p-2 rounded-xl mb-2 ${type === 'IN' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                 <ArrowDownRight size={24} />
               </div>
               <span className={`text-xs font-black ${type === 'IN' ? 'text-emerald-600' : 'text-slate-400'}`}>{t('inventory.stockModal.addStock')}</span>
             </button>
             <button 
               type="button" onClick={() => setType('OUT')}
               className={`flex-1 flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${type === 'OUT' ? 'border-rose-500 bg-rose-50' : 'border-slate-100 hover:bg-slate-50'}`}
             >
               <div className={`p-2 rounded-xl mb-2 ${type === 'OUT' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                 <ArrowUpRight size={24} />
               </div>
               <span className={`text-xs font-black ${type === 'OUT' ? 'text-rose-600' : 'text-slate-400'}`}>{t('inventory.stockModal.removeStock')}</span>
             </button>
           </div>

           <div className="space-y-4">
             <div>
               <label className="text-[10px] font-black text-slate-400 uppercase ml-2">{t('inventory.stockModal.quantity')}</label>
               <div className="relative">
                 <input 
                   required type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                   className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 text-2xl font-black text-slate-800"
                   placeholder="0"
                 />
                 <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{t('inventory.stockModal.unit')}</div>
               </div>
             </div>
             
             {/* Bilgilendirme */}
             <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                 <div className="text-[10px] font-bold text-slate-400">{t('inventory.stockModal.currentStock')}</div>
                 <div className="text-sm font-black text-slate-700">{currentVariant.stock_quantity}</div>
                 <div className="text-slate-300">→</div>
                 <div className="text-[10px] font-bold text-slate-400">{t('inventory.stockModal.newStock')}</div>
                 <div className={`text-sm font-black ${type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                   {type === 'IN' ? (currentVariant.stock_quantity + (parseInt(quantity) || 0)) : (currentVariant.stock_quantity - (parseInt(quantity) || 0))}
                 </div>
             </div>
           </div>

           <div className="pt-4 flex gap-3">
             <button 
               type="button" onClick={onClose}
               className="flex-1 py-4 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
             >
               {t('inventory.stockModal.cancel')}
             </button>
             <button 
               type="submit" disabled={loading}
               className={`flex-[2] py-4 rounded-2xl text-white font-black text-sm shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${type === 'IN' ? 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700' : 'bg-rose-600 shadow-rose-200 hover:bg-rose-700'}`}
             >
               {loading ? (
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
               ) : (
                 <>{t('inventory.stockModal.confirm')}</>
               )}
             </button>
           </div>
        </form>
      </div>
    </div>
  );
}
