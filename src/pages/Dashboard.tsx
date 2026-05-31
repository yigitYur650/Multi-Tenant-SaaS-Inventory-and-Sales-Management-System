import React, { useEffect, useState } from 'react';
import { useServices } from '../components/ServiceProvider';
import { useRefresh } from '../components/RefreshContext';
import { PageTransition } from '../components/PageTransition';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/formatter';

export function Dashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { analyticsService, productService } = useServices();
  const { refreshKey } = useRefresh();
  const [stats, setStats] = useState<any>(null);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        setError(null);
        console.log("Dashboard: Fetching stats...");
        
        const [ds, pl] = await Promise.all([
          analyticsService.getDashboardStats(),
          productService.getProducts()
        ]);
        
        setStats(ds);
        setProductCount(pl.length);
        console.log("Dashboard: Stats fetched successfully.");
      } catch (err) {
        console.error("Dashboard Load Error:", err);
        setError(t('dashboard.error'));
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [analyticsService, productService, refreshKey]);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-slate-500 font-medium animate-pulse">{t('dashboard.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-center p-6">
        <div className="bg-rose-50 text-rose-500 p-4 rounded-full">
          <AlertTriangle size={48} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">{t('dashboard.errorTitle')}</h2>
        <p className="text-slate-500 max-w-sm">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          {t('dashboard.retry')}
        </button>
      </div>
    );
  }

  const chartData = stats?.topSelling?.map((item: any) => ({
    name: item.product_name || item.sku || t('common.unknown'),
    satis: item.total_quantity_sold || item.total_revenue || 0
  })) || [];

  return (
    <PageTransition>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('dashboard.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="glass bg-white/60 hover:bg-white/80 backdrop-blur-md border border-white/40 p-6 rounded-2xl flex items-start gap-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-200/50 shadow-lg shadow-black/5">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl shadow-sm shadow-blue-500/10">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dashboard.dailyRevenue')}</p>
            <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mt-1">
              {formatCurrency(stats?.todayRevenue, profile) || '0'}
            </h3>
          </div>
        </div>

        <div className="glass bg-white/60 hover:bg-white/80 backdrop-blur-md border border-white/40 p-6 rounded-2xl flex items-start gap-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-emerald-500/5 hover:border-emerald-200/50 shadow-lg shadow-black/5">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl shadow-sm shadow-emerald-500/10">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dashboard.registeredProducts')}</p>
            <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600 mt-1">
              {productCount}
            </h3>
          </div>
        </div>

        <div className="glass bg-white/60 hover:bg-white/80 backdrop-blur-md border border-white/40 p-6 rounded-2xl flex items-start gap-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200/50 shadow-lg shadow-black/5">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl shadow-sm shadow-indigo-500/10">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dashboard.saleCount')}</p>
            <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mt-1">
              {stats?.totalSalesToday || '0'}
            </h3>
          </div>
        </div>

        <div className="glass bg-white/60 hover:bg-white/80 backdrop-blur-md border border-white/40 p-6 rounded-2xl flex items-start gap-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-rose-500/5 hover:border-rose-200/50 shadow-lg shadow-black/5 bg-gradient-to-br from-white/60 to-rose-50/40">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-xl shadow-sm shadow-rose-500/10">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dashboard.criticalStock')}</p>
            <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-rose-600 to-orange-600 mt-1">
              {stats?.lowStockItems?.length || '0'} {t('dashboard.unitProduct')}
            </h3>
          </div>
        </div>
      </div>

      <div className="glass bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl p-6 shadow-xl shadow-slate-200/30">
        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-500"/>
          {t('dashboard.performanceTitle')}
        </h2>
        <div className="h-80 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}} 
                  contentStyle={{borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', backdropFilter: 'blur(10px)', backgroundColor: 'rgba(255,255,255,0.9)'}}
                />
                <Bar dataKey="satis" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={48} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400 font-medium">{t('dashboard.noData')}</div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
