import React, { useState, useEffect, useMemo } from 'react';
import { useServices } from '../components/ServiceProvider';
import { PageTransition } from '../components/PageTransition';
import { 
  Search, 
  ShoppingCart as CartIcon, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Package,
  X,
  CreditCard,
  Banknote,
  Send,
  User as UserIcon,
  CircleDollarSign,
  History,
  Printer,
  ChevronRight,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useRefresh } from '../components/RefreshContext';
import { SlideOver } from '../components/SlideOver';
import { pdfService } from '../services/pdfService';
import { Download } from 'lucide-react';

interface CartItem {
  variant_id: string;
  product_name: string;
  variant_name: string;
  price: number;
  quantity: number;
  stock: number;
}
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate, formatDateOnly } from '../lib/formatter';

export function Sales() {
  const { t } = useTranslation();
  const { productService, saleService } = useServices();
  const { user, profile } = useAuth();
  const { triggerRefresh, refreshKey } = useRefresh();
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Step 3 States
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [dailySummary, setDailySummary] = useState<any>(null);

  // Return States
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedItemForReturn, setSelectedItemForReturn] = useState<any>(null);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState(t('sales.return.reasons.changedMind'));
  const [saleReturns, setSaleReturns] = useState<any[]>([]);

  // Report States
  const [allSalesData, setAllSalesData] = useState<any[]>([]);
  const [reportPeriod, setReportPeriod] = useState('daily');

  // Fetch initial data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await productService.getProductsWithVariants();
        const flattened: any[] = [];
        data.forEach((p: any) => {
          p.product_variants?.forEach((v: any) => {
            flattened.push({
              id: v.id,
              product_id: p.id,
              name: p.name,
              variant_name: `${v.colors?.name || ''} / ${v.sizes?.name || ''}`,
              sku: v.sku,
              price: v.retail_price || 0,
              stock: v.stock_quantity || 0,
              category: p.categories?.name
            });
          });
        });
        setProducts(flattened);

        // Fetch All Sales
        const allSales = await saleService.getAllSales();
        setAllSalesData(allSales);

        // Fetch Today's Data
        const sales = await saleService.getTodaySales();
        const summary = await saleService.getTodaySummary();
        setRecentSales(sales);
        setDailySummary(summary);

      } catch (err) {
        console.error("POS Data Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [productService, saleService, refreshKey]);

  // Filters
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const lq = searchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(lq) || 
      p.sku?.toLowerCase().includes(lq) ||
      p.variant_name.toLowerCase().includes(lq)
    );
  }, [products, searchQuery]);

  // Report Memo
  const filteredReportSales = useMemo(() => {
    const now = new Date();
    return allSalesData.filter(sale => {
      const saleDate = new Date(sale.created_at);
      if (reportPeriod === 'daily') {
        return saleDate.toDateString() === now.toDateString();
      } else if (reportPeriod === 'weekly') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return saleDate >= weekAgo;
      } else if (reportPeriod === 'monthly') {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        return saleDate >= monthAgo;
      } else if (reportPeriod === 'yearly') {
        const yearAgo = new Date();
        yearAgo.setFullYear(now.getFullYear() - 1);
        return saleDate >= yearAgo;
      }
      return true; // 'all'
    });
  }, [allSalesData, reportPeriod]);

  const reportSummary = useMemo(() => {
    return filteredReportSales.reduce((acc, sale) => {
      acc.total += Number(sale.total_amount) || 0;
      acc.count += 1;
      return acc;
    }, { total: 0, count: 0 });
  }, [filteredReportSales]);

  // Cart Actions
  const addToCart = (product: any) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.variant_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => 
          item.variant_id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, {
        variant_id: product.id,
        product_name: product.name,
        variant_name: product.variant_name,
        price: product.price,
        quantity: 1,
        stock: product.stock
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.variant_id === id) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.stock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.variant_id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckoutSuccess = async () => {
    setCart([]);
    setIsCheckoutOpen(false);
    setIsSuccess(true);
    triggerRefresh();
    // Refresh history
    const sales = await saleService.getTodaySales();
    const summary = await saleService.getTodaySummary();
    setRecentSales(sales);
    setDailySummary(summary);
    setTimeout(() => setIsSuccess(false), 3000);
  };

  const handlePrint = (sale: any) => {
     setSelectedSale(sale);
     setTimeout(() => {
        window.print();
     }, 100);
  };

  const loadSaleReturns = async (saleId: string) => {
    try {
      const returns = await saleService.getReturnsBySale(saleId);
      setSaleReturns(returns);
    } catch (err) {
      console.error("Returns Fetch Error:", err);
    }
  };

  useEffect(() => {
    if (selectedSale) {
      loadSaleReturns(selectedSale.id);
    }
  }, [selectedSale]);

  const handleReturn = async () => {
    if (!selectedItemForReturn || !selectedSale) return;
    
    try {
      const payload = {
        sale_item_id: selectedItemForReturn.id,
        sale_id: selectedSale.id,
        variant_id: selectedItemForReturn.variant_id,
        quantity: returnQuantity,
        reason: returnReason
      };

      await saleService.processReturn(payload);
      setIsReturnModalOpen(false);
      setSelectedItemForReturn(null);
      triggerRefresh();
      // Reload returns and sales
      loadSaleReturns(selectedSale.id);
      const sales = await saleService.getTodaySales();
      setRecentSales(sales);
    } catch (err: any) {
      alert(t('sales.return.error') + err.message);
    }
  };

  const getReturnedQty = (itemId: string) => {
    return saleReturns
      .filter(r => r.sale_item_id === itemId)
      .reduce((sum, r) => sum + r.quantity, 0);
  };

  return (
    <PageTransition className="min-h-screen -m-8 p-8 transition-colors duration-1000 bg-emerald-50/40">
      <div className="flex gap-8 h-[calc(100vh-120px)] overflow-hidden">
        
        {/* SOL: ÜRÜN VİTRİNİ (%70) */}
        <div className="flex-[7] flex flex-col gap-6 overflow-hidden">
          <div className="flex items-center justify-between gap-4 bg-white/60 backdrop-blur-md p-4 rounded-[28px] border border-emerald-100 shadow-sm print:hidden">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder={t('sales.searchPlaceholder')} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-medium text-emerald-900 transition-all shadow-sm"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" size={20} />
            </div>
            <div className="flex items-center gap-2">
               <button 
                 onClick={() => setIsHistoryOpen(true)}
                 className="flex items-center gap-2 bg-white text-slate-600 px-6 py-3.5 rounded-2xl font-bold text-sm border border-emerald-100 hover:bg-emerald-50 transition-all shadow-sm"
               >
                 <History size={18} className="text-emerald-500" />
                 {t('sales.recentActions')}
               </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar print:hidden">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-32 bg-emerald-100/30 animate-pulse rounded-3xl" />
                ))}
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
                {filteredProducts.map((p) => (
                  <motion.button
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={p.stock <= 0}
                    className={`flex flex-col text-left p-4 rounded-3xl border transition-all relative overflow-hidden group ${
                      p.stock <= 0 
                      ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' 
                      : 'bg-white border-emerald-100 shadow-sm hover:shadow-xl hover:shadow-emerald-200/50 hover:border-emerald-300'
                    }`}
                  >
                    <div className="absolute -top-6 -right-6 w-12 h-12 bg-emerald-500/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
                    
                    <span className="text-[10px] font-black uppercase text-emerald-500 mb-1 line-clamp-1">{p.category || t('sales.categoryGeneral')}</span>
                    <h4 className="font-bold text-slate-800 text-sm mb-0.5 line-clamp-1 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{p.name}</h4>
                    <p className="text-[10px] font-bold text-slate-600 mb-3 truncate">{p.variant_name}</p>
                    
                    <div className="mt-auto flex items-end justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{t('sales.unitPrice')}</span>
                        <span className="text-sm font-black text-slate-900 leading-none">{formatCurrency(p.price, profile)}</span>
                      </div>
                      <div className={`px-2 py-1 rounded-lg text-[9px] font-black ${p.stock <= 5 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
                        {t('sales.stock')}: {p.stock}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-emerald-50/20 rounded-[40px] border-2 border-dashed border-emerald-100">
                <Search size={48} className="text-emerald-200 mb-4" />
                <p className="text-emerald-400 font-bold italic">{t('sales.noProductFound')}</p>
              </div>
            )}
          </div>
        </div>

        {/* SAĞ: KASA / SEPET (%30) */}
        <div className="flex-[3] flex flex-col bg-white rounded-[32px] shadow-2xl border border-emerald-100 overflow-hidden relative print:hidden">
          {isSuccess && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute top-0 left-0 right-0 bg-emerald-500 text-white p-4 z-50 text-center font-bold text-sm shadow-xl"
            >
              🎉 {t('sales.summary.success')}
            </motion.div>
          )}

          <div className="p-6 bg-emerald-600 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <CartIcon size={24} />
              </div>
              <div>
                <h3 className="font-black text-lg leading-none">{t('sales.cart.title')}</h3>
                <p className="text-xs text-emerald-100 mt-1 uppercase tracking-widest font-bold font-mono">{cart.length} {t('sales.cart.items')}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/30">
            {cart.length > 0 ? (
              <AnimatePresence>
                {cart.map((item) => (
                  <motion.div
                    key={item.variant_id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-3 bg-white rounded-2xl border border-emerald-100 flex flex-col gap-2 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="text-[11px] font-black text-slate-800 uppercase line-clamp-1">{item.product_name}</h5>
                        <p className="text-[9px] font-bold text-emerald-600">{item.variant_name}</p>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.variant_id)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center bg-slate-50 border border-slate-100 rounded-xl p-1">
                        <button 
                          onClick={() => updateQuantity(item.variant_id, -1)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-xs font-black text-slate-800">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.variant_id, 1)}
                          disabled={item.quantity >= item.stock}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-30"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400">{t('sales.cart.rowTotal')}</p>
                        <p className="text-sm font-black text-slate-900">{formatCurrency(item.price * item.quantity, profile)}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-200 rounded-full flex items-center justify-center mb-4">
                  <CartIcon size={40} />
                </div>
                <p className="text-sm font-bold text-emerald-300 uppercase tracking-tighter">{t('sales.cart.empty')}</p>
                <p className="text-xs text-slate-400 mt-2 italic">{t('sales.cart.emptySubtitle')}</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-white border-t border-emerald-100 space-y-4 shadow-inner">
            {/* Daily Summary Preview */}
            {dailySummary && (
              <div className="grid grid-cols-3 gap-2 pb-4 border-b border-dashed border-emerald-100">
                 <div className="text-center bg-emerald-50/50 p-2 rounded-xl border border-emerald-100/50">
                    <p className="text-[8px] font-black text-emerald-600 uppercase">{t('sales.summary.cash')}</p>
                    <p className="text-[10px] font-black text-slate-700">{formatCurrency(Math.round(dailySummary.cash), profile)}</p>
                 </div>
                 <div className="text-center bg-blue-50/50 p-2 rounded-xl border border-blue-100/50">
                    <p className="text-[8px] font-black text-blue-600 uppercase">{t('sales.summary.card')}</p>
                    <p className="text-[10px] font-black text-slate-700">{formatCurrency(Math.round(dailySummary.card), profile)}</p>
                 </div>
                 <div className="text-center bg-amber-50/50 p-2 rounded-xl border border-amber-100/50">
                    <p className="text-[8px] font-black text-amber-600 uppercase">{t('sales.summary.mailOrder')}</p>
                    <p className="text-[10px] font-black text-slate-700">{formatCurrency(Math.round(dailySummary.mailOrder), profile)}</p>
                 </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={14} /> {t('sales.summary.total')}
              </span>
              <span className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(cartTotal, profile)}</span>
            </div>
            
            <button 
              onClick={() => setIsCheckoutOpen(true)}
              disabled={cart.length === 0}
              className="w-full bg-emerald-600 text-white py-5 rounded-[24px] font-black text-sm shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3 group uppercase tracking-widest"
            >
              <CheckCircle2 size={24} className="group-hover:scale-110 transition-transform" />
              {t('sales.summary.complete')}
            </button>
          </div>
        </div>
      </div>

      {isCheckoutOpen && (
        <CheckoutModal 
          cart={cart}
          total={cartTotal}
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {/* Satış Geçmişi & Raporlama Modalı */}
      <SlideOver 
        isOpen={isHistoryOpen} 
        onClose={() => { setIsHistoryOpen(false); setSelectedSale(null); }}
        title={t('sales.history.title')}
      >
        <div className="space-y-6">
           {/* Raporlama Kontrolleri */}
           <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col gap-4 shadow-sm">
              <div className="flex justify-between items-center">
                 <select 
                   value={reportPeriod} 
                   onChange={(e) => setReportPeriod(e.target.value)}
                   className="bg-white border border-emerald-100 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm outline-none transition-colors"
                 >
                   <option value="daily">{t('sales.history.period.daily')}</option>
                   <option value="weekly">{t('sales.history.period.weekly')}</option>
                   <option value="monthly">{t('sales.history.period.monthly')}</option>
                   <option value="yearly">{t('sales.history.period.yearly')}</option>
                   <option value="all">{t('sales.history.period.all')}</option>
                 </select>
                 <button 
                   onClick={() => pdfService.generateSalesReport(filteredReportSales, reportPeriod, profile, profile?.shops?.name)}
                   className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-200"
                 >
                   <Download size={16} /> Rapor İndir
                 </button>
              </div>
              <div className="flex gap-4">
                 <div className="flex-1 bg-white p-4 rounded-2xl border border-emerald-50 shadow-sm">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{t('sales.history.totalRevenue')}</p>
                    <p className="text-xl font-black text-emerald-600">{formatCurrency(reportSummary.total, profile)}</p>
                 </div>
                 <div className="flex-1 bg-white p-4 rounded-2xl border border-emerald-50 shadow-sm">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{t('sales.history.saleCount')}</p>
                    <p className="text-xl font-black text-slate-800">{reportSummary.count} <span className="text-sm text-slate-400 font-medium">{t('sales.history.transaction')}</span></p>
                 </div>
              </div>
           </div>

           <div className="space-y-3">
             <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">{t('sales.history.listTitle')}</h4>
             {filteredReportSales.map((sale) => (
             <button 
               key={sale.id}
               onClick={() => setSelectedSale(sale)}
               className={`w-full p-5 rounded-3xl border-2 transition-all flex items-center justify-between group ${
                 selectedSale?.id === sale.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-emerald-200'
               }`}
             >
                <div className="text-left">
                   <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                        sale.payment_method === 'CASH' ? 'bg-emerald-100 text-emerald-600' :
                        sale.payment_method === 'CREDIT_CARD' ? 'bg-blue-100 text-blue-600' :
                        sale.payment_method === 'MAIL_ORDER' ? 'bg-amber-100 text-amber-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                         {sale.payment_method}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">{formatDate(sale.created_at, profile, { hour: '2-digit', minute: '2-digit', second: '2-digit', year: undefined, month: undefined, day: undefined })}</span>
                   </div>
                   <p className="text-lg font-black text-slate-800 leading-none">{formatCurrency(sale.total_amount, profile)}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                   <ChevronRight size={20} />
                </div>
             </button>
           ))}

           </div>

           {filteredReportSales.length === 0 && (
             <div className="text-center py-20 text-slate-300 font-bold uppercase tracking-widest italic opacity-50">{t('sales.history.noSales')}</div>
           )}

           {/* Satış Detayı */}
           {selectedSale && (
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="p-6 bg-slate-900 text-white rounded-[32px] mt-8"
             >
                <div className="flex justify-between items-start mb-6">
                   <h4 className="font-black text-lg">{t('sales.history.detailTitle')}</h4>
                   <button 
                     onClick={() => handlePrint(selectedSale)}
                     className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold"
                   >
                     <Printer size={16} /> {t('sales.history.printReceipt')}
                   </button>
                </div>

                <div className="space-y-4 mb-6">
                   {selectedSale.sale_items?.map((it: any) => {
                     const returnedQty = getReturnedQty(it.id);
                     const isFullyReturned = returnedQty >= it.quantity;

                     return (
                       <div key={it.id} className="p-4 bg-white/5 rounded-2xl space-y-3">
                          <div className="flex justify-between items-start">
                             <div className="flex-1">
                                <p className="font-bold text-slate-200 truncate">{it.product_variants?.products?.name}</p>
                                <p className="text-[10px] text-slate-500">{it.quantity} Adet x {formatCurrency(it.unit_price, profile)}</p>
                             </div>
                             <p className="font-black text-white">{formatCurrency(it.total_price, profile)}</p>
                          </div>
                          
                          <div className="flex items-center justify-between pt-2 border-t border-white/5 font-mono">
                             {isFullyReturned ? (
                               <span className="text-[10px] font-black uppercase text-rose-400 bg-rose-400/10 px-2 py-1 rounded-lg">{t('sales.history.returned')}</span>
                             ) : (
                               <button 
                                 onClick={() => {
                                   setSelectedItemForReturn(it);
                                   setReturnQuantity(it.quantity - returnedQty);
                                   setIsReturnModalOpen(true);
                                 }}
                                 className="text-[10px] font-black uppercase text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1"
                               >
                                 <Plus size={10} className="rotate-45" /> {t('sales.history.takeReturn')}
                               </button>
                             )}
                             {returnedQty > 0 && !isFullyReturned && (
                               <span className="text-[9px] text-slate-400 font-bold italic">{t('sales.history.returnedInfo', { count: returnedQty })}</span>
                             )}
                          </div>
                       </div>
                     );
                   })}
                </div>

                <div className="pt-4 border-t border-white/10 space-y-2">
                   <div className="flex justify-between text-xs">
                      <span className="text-slate-400">{t('sales.history.cashier')}:</span>
                      <span className="font-bold">{selectedSale.user_email || t('common.unknown')}</span>
                   </div>
                   {selectedSale.customer_note && (
                     <div className="p-3 bg-white/5 rounded-xl text-xs flex gap-2 mt-2 italic text-emerald-400">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>"{selectedSale.customer_note}"</span>
                     </div>
                   )}
                </div>
             </motion.div>
           )}
        </div>
      </SlideOver>

      {/* Yazdırılabilir Fiş (Gizli Component) */}
      <div className="hidden print:block fixed inset-0 bg-white z-[1000] p-8 text-black font-mono">
         {selectedSale && (
           <div className="w-[80mm] mx-auto text-sm">
              <div className="text-center mb-6">
                 <h2 className="text-xl font-black uppercase tracking-tighter mb-1">{t('sales.receipt.title')}</h2>
                 <p className="text-[10px] uppercase">{profile?.shops?.name || 'MAGAZA 1'}</p>
                 <div className="my-4 border-b border-dashed border-black"></div>
                 <p className="text-[10px]">{t('sales.receipt.date')}: {formatDate(selectedSale.created_at, profile)}</p>
                 <p className="text-[10px]">{t('sales.receipt.receiptNo')}: {selectedSale.id.split('-')[0].toUpperCase()}</p>
              </div>

              <div className="space-y-2 mb-6">
                 <div className="flex justify-between border-b border-black pb-1 mb-1 font-bold">
                    <span>{t('sales.receipt.itemHeader')}</span>
                    <span>{t('sales.receipt.totalHeader')}</span>
                 </div>
                 {selectedSale.sale_items?.map((it: any) => (
                   <div key={it.id} className="flex justify-between text-[11px]">
                      <div className="flex-1 pr-4">
                         <p className="font-black">{it.product_variants?.products?.name}</p>
                         <p>{it.quantity} x {formatCurrency(it.unit_price, profile)}</p>
                      </div>
                      <span className="font-black">{formatCurrency(it.total_price, profile)}</span>
                   </div>
                 ))}
              </div>

              <div className="border-t border-dashed border-black pt-4 space-y-1">
                 <div className="flex justify-between text-base font-black">
                    <span>{t('sales.receipt.total')}</span>
                    <span>{formatCurrency(selectedSale.total_amount, profile)}</span>
                 </div>
                 <div className="flex justify-between text-[10px]">
                    <span>{t('sales.receipt.payment')}: {selectedSale.payment_method}</span>
                 </div>
                 <div className="flex justify-between text-[10px]">
                    <span>{t('sales.receipt.cashier')}: {selectedSale.user_email}</span>
                 </div>
              </div>

              <div className="text-center mt-10 text-[10px]">
                 <p>{t('sales.receipt.footer1')}</p>
                 <p>{t('sales.receipt.footer2')}</p>
              </div>
           </div>
         )}
      </div>

      {/* Yazdırma Esnasında Body CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          .print\\:block { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: 80mm auto; margin: 0; }
        }
      ` }} />
      {isReturnModalOpen && selectedItemForReturn && (
        <ReturnModal 
          item={selectedItemForReturn}
          maxQty={selectedItemForReturn.quantity - getReturnedQty(selectedItemForReturn.id)}
          onClose={() => { setIsReturnModalOpen(false); setSelectedItemForReturn(null); }}
          onConfirm={handleReturn}
          quantity={returnQuantity}
          setQuantity={setReturnQuantity}
          reason={returnReason}
          setReason={setReturnReason}
        />
      )}
    </PageTransition>
  );
}

// İade Modalı
function ReturnModal({ item, maxQty, onClose, onConfirm, quantity, setQuantity, reason, setReason }: any) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const reasons = [
    t('sales.return.reasons.defective'),
    t('sales.return.reasons.sizeMismatch'),
    t('sales.return.reasons.changedMind'),
    t('sales.return.reasons.other')
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="p-6 bg-rose-600 text-white flex justify-between items-center">
           <h3 className="font-black uppercase tracking-tight">{t('sales.return.title')}</h3>
           <button onClick={onClose} className="p-2 hover:bg-rose-700 rounded-xl transition-all"><X size={20} /></button>
        </div>
        
        <div className="p-8 space-y-6">
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('sales.return.product')}</p>
              <p className="font-bold text-slate-800">{item.product_variants?.products?.name}</p>
              <p className="text-xs text-slate-400">{item.product_variants?.colors?.name} / {item.product_variants?.sizes?.name}</p>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('sales.return.quantity')}</label>
                 <input 
                   type="number" min="1" max={maxQty}
                   value={quantity}
                   onChange={(e) => setQuantity(Math.min(maxQty, Math.max(1, parseInt(e.target.value) || 1)))}
                   className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xl font-black text-slate-800 focus:border-rose-500 outline-none transition-all"
                 />
                 <p className="text-[9px] text-slate-400 font-bold ml-1">{t('sales.return.maxQty', { count: maxQty })}</p>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('sales.return.reason')}</label>
                 <select 
                   value={reason}
                   onChange={(e) => setReason(e.target.value)}
                   className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:border-rose-500 outline-none transition-all h-[58px]"
                 >
                    {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                 </select>
              </div>
           </div>

           <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
              <div className="flex justify-between items-center">
                 <span className="text-[10px] font-black text-rose-600 uppercase">{t('sales.return.totalReturn')}</span>
                 <span className="text-xl font-black text-rose-600">{formatCurrency(item.unit_price * quantity, profile)}</span>
              </div>
           </div>

           <div className="flex gap-3 pt-2">
              <button 
                onClick={onClose}
                className="flex-1 py-4 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
              >
                {t('sales.return.cancel')}
              </button>
              <button 
                onClick={onConfirm}
                className="flex-[2] py-4 bg-rose-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95"
              >
                {t('sales.return.confirm')}
              </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
}

// Ödeme Modalı
function CheckoutModal({ cart, total, onClose, onSuccess }: { cart: CartItem[], total: number, onClose: () => void, onSuccess: () => void }) {
  const { t } = useTranslation();
  const { saleService } = useServices();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT_CARD' | 'MAIL_ORDER' | 'UNSPECIFIED'>('CASH');
  const [customerNote, setCustomerNote] = useState('');

  const isMailOrder = paymentMethod === 'MAIL_ORDER';
  const isValid = !isMailOrder || (isMailOrder && customerNote.trim().length > 0);

  const handleFinish = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const payload = {
        shop_id: profile?.shop_id,
        user_email: user?.email,
        total_amount: total,
        discount_amount: 0, // Eksik olan zorunlu alan
        payment_method: paymentMethod,
        customer_note: customerNote,
        items: cart.map(item => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity
        }))
      };

      const result = await saleService.processSale(payload);
      onSuccess();
    } catch (err: any) {
      alert(t('common.error') + ": " + (err.message || t('sales.return.error')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md print:hidden">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl flex flex-col overflow-hidden border border-emerald-100"
      >
        <div className="p-8 bg-emerald-600 text-white flex justify-between items-center relative overflow-hidden">
           <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
           <div>
             <h3 className="text-2xl font-black tracking-tight leading-none">{t('sales.checkout.title')}</h3>
             <p className="text-xs text-emerald-100 uppercase tracking-widest font-bold mt-2 font-mono">{t('sales.checkout.options')}</p>
           </div>
           <button onClick={onClose} className="p-3 hover:bg-emerald-700/50 rounded-2xl transition-all relative z-10"><X size={24} /></button>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-4">
             <PaymentOption 
               active={paymentMethod === 'CASH'} icon={<Banknote />} label={t('sales.checkout.paymentMethods.cash')} amount={total} 
               onClick={() => setPaymentMethod('CASH')}
             />
             <PaymentOption 
               active={paymentMethod === 'CREDIT_CARD'} icon={<CreditCard />} label={t('sales.checkout.paymentMethods.card')} amount={total}
               onClick={() => setPaymentMethod('CREDIT_CARD')}
             />
             <PaymentOption 
               active={paymentMethod === 'MAIL_ORDER'} icon={<Send />} label={t('sales.checkout.paymentMethods.mailOrder')} amount={total}
               onClick={() => setPaymentMethod('MAIL_ORDER')}
             />
             <PaymentOption 
               active={paymentMethod === 'UNSPECIFIED'} icon={<CircleDollarSign />} label={t('sales.checkout.paymentMethods.fast')} amount={total}
               onClick={() => setPaymentMethod('UNSPECIFIED')}
             />
          </div>

          {isMailOrder && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="space-y-3"
            >
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest font-mono">{t('sales.checkout.customerInfo')}</label>
              <textarea 
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder={t('sales.checkout.customerPlaceholder')}
                className="w-full bg-slate-50 border-2 border-emerald-100 rounded-[24px] p-5 text-sm font-bold text-slate-800 focus:border-emerald-500 outline-none transition-all placeholder-slate-300 h-32"
              />
            </motion.div>
          )}

          <div className="bg-emerald-50/50 p-6 rounded-[32px] border border-emerald-100 flex items-center justify-between shadow-inner">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-50">
                   <UserIcon size={24} />
                </div>
                <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1 font-mono">{t('sales.checkout.cashier')}</p>
                   <p className="text-sm font-black text-slate-800">{profile?.full_name || user?.email}</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1 font-mono">{t('sales.checkout.totalCollection')}</p>
                <p className="text-2xl font-black text-emerald-600">{formatCurrency(total, profile)}</p>
             </div>
          </div>

          <button 
            disabled={loading || !isValid}
            onClick={handleFinish}
            className="w-full py-6 bg-slate-900 text-white rounded-[24px] font-black tracking-widest shadow-2xl hover:bg-emerald-600 transition-all active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none uppercase"
          >
            {loading ? t('sales.checkout.processing') : t('sales.checkout.confirm')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PaymentOption({ active, icon, label, amount, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`p-6 rounded-[32px] border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden ${
        active 
        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xl shadow-emerald-100 ring-4 ring-emerald-500/10' 
        : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-emerald-200 shadow-sm'
      }`}
    >
       <div className={`p-3 rounded-2xl ${active ? 'bg-emerald-500 text-white' : 'bg-white text-slate-300'} transition-colors shadow-sm`}>
          {React.cloneElement(icon, { size: 24 })}
       </div>
       <span className="text-xs font-black uppercase tracking-tight font-mono">{label}</span>
       {active && <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />}
    </button>
  );
}
