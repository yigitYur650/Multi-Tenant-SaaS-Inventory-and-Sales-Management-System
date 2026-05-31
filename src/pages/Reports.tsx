import React, { useState, useEffect } from 'react';
import { PageTransition } from '../components/PageTransition';
import { 
  TrendingUp, 
  CreditCard, 
  RotateCcw, 
  PieChart, 
  ChevronDown, 
  ChevronUp, 
  Package, 
  AlertCircle,
  BarChart2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { useServices } from '../components/ServiceProvider';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/formatter';
import { 
  DateRange, 
  FinancialSummary, 
  ChartData, 
  ProductPerformance 
} from '../services/interfaces/IServices';

export function Reports() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const { analyticsService } = useServices();
  
  const currentLocale = i18n.language === 'tr' ? 'tr-TR' : 'en-US';
  
  const [range, setRange] = useState<DateRange>('daily');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [performance, setPerformance] = useState<{ 
    topSelling: ProductPerformance[]; 
    nonSelling: ProductPerformance[]; 
  }>({ topSelling: [], nonSelling: [] });

  const [openAccordion, setOpenAccordion] = useState<string | null>('top');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [sum, chart, perf] = await Promise.all([
          analyticsService.getFinancialSummary(range),
          analyticsService.getSalesChartData(range),
          analyticsService.getProductPerformance(range)
        ]);
        
        setSummary(sum);
        setChartData(chart);
        setPerformance(perf);
      } catch (error) {
        console.error("Rapor verileri çekilirken hata oluştu:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [range, analyticsService]);

  const filterButtons: { label: string; value: DateRange }[] = [
    { label: t('reports.filters.daily'), value: 'daily' },
    { label: t('reports.filters.weekly'), value: 'weekly' },
    { label: t('reports.filters.monthly'), value: 'monthly' },
    { label: t('reports.filters.yearly'), value: 'yearly' },
  ];

  if (loading && !summary) {
    return (
      <PageTransition className="p-6 space-y-6">
        <div className="flex justify-between items-center mb-8">
          <div className="h-10 w-48 bg-purple-100 animate-pulse rounded-lg" />
          <div className="flex space-x-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 w-24 bg-purple-50 animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-50 animate-pulse rounded-2xl border border-slate-100" />
          ))}
        </div>
        <div className="h-96 bg-indigo-50/30 animate-pulse rounded-3xl border border-indigo-100" />
      </PageTransition>
    );
  }

  return (
    <PageTransition className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <span className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <BarChart2 size={28} />
            </span>
            {t('reports.title')}
          </h1>
          <p className="text-slate-500 mt-1">{t('reports.subtitle')}</p>
        </div>

        <div className="bg-slate-100 p-1 rounded-xl flex self-start md:self-center">
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setRange(btn.value)}
              className={`px-4 py-2 text-sm font-semibold transition-all duration-200 rounded-lg ${
                range === btn.value
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title={t('reports.kpi.totalRevenue')} 
          value={formatCurrency(summary?.totalRevenue, profile)}
          icon={<TrendingUp className="text-indigo-600" size={24} />}
          color="bg-indigo-50"
          loading={loading}
        />
        <KPICard 
          title={t('reports.kpi.paymentDistribution')} 
          value={summary?.paymentMethods[0]?.method || t('sales.checkout.paymentMethods.cash')}
          subValue={formatCurrency(summary?.paymentMethods[0]?.amount, profile)}
          icon={<CreditCard className="text-purple-600" size={24} />}
          color="bg-purple-50"
          loading={loading}
        />
        <KPICard 
          title={t('reports.kpi.totalRefund')} 
          value={formatCurrency(summary?.totalRefunds, profile)}
          icon={<RotateCcw className="text-rose-600" size={24} />}
          color="bg-rose-50"
          loading={loading}
        />
        <KPICard 
          title={t('reports.kpi.netProfit')} 
          value={formatCurrency(summary?.netProfit, profile)}
          icon={<PieChart className="text-emerald-600" size={24} />}
          color="bg-emerald-50"
          loading={loading}
        />
      </div>

      {/* Main Chart */}
      <div className="bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-white/40 shadow-xl shadow-slate-200/30">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-slate-800">{t('reports.charts.salesTrends')}</h3>
          <div className="text-sm text-slate-400 font-medium">{t('reports.charts.amountLabel')}</div>
        </div>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(value) => `${value / 1000}k`}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                }}
              />
              <Bar 
                dataKey="sales" 
                fill="#6366f1" 
                radius={[6, 6, 0, 0]} 
                barSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Accordion Lists */}
      <div className="space-y-4">
        <AccordionItem 
          title={t('reports.performance.topSelling')} 
          icon={<Package className="text-indigo-600" />}
          isOpen={openAccordion === 'top'}
          onToggle={() => setOpenAccordion(openAccordion === 'top' ? null : 'top')}
        >
          <div className="divide-y divide-slate-100">
            {performance.topSelling.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className="py-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">{item.name}</div>
                  <div className="text-xs text-slate-400">SKU: {item.sku}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-indigo-600">{item.salesCount} {t('reports.performance.unitPiece')}</div>
                  <div className="text-xs text-slate-500">{formatCurrency(item.revenue, profile)}</div>
                </div>
              </div>
            ))}
            {performance.topSelling.length === 0 && (
              <div className="py-8 text-center text-slate-400">{t('reports.performance.noSalesPeriod')}</div>
            )}
          </div>
        </AccordionItem>

        <AccordionItem 
          title={t('reports.performance.nonSelling')} 
          icon={<AlertCircle className="text-rose-500" />}
          isOpen={openAccordion === 'non'}
          onToggle={() => setOpenAccordion(openAccordion === 'non' ? null : 'non')}
        >
          <div className="divide-y divide-slate-100">
            {performance.nonSelling.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className="py-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-700">{item.name}</div>
                  <div className="text-xs text-slate-400">SKU: {item.sku}</div>
                </div>
                <div className="text-rose-500 text-sm font-semibold italic">{t('reports.performance.zeroSales')}</div>
              </div>
            ))}
            {performance.nonSelling.length === 0 && (
              <div className="py-8 text-center text-slate-400">{t('reports.performance.allProductsSold')}</div>
            )}
          </div>
        </AccordionItem>
      </div>
    </PageTransition>
  );
}

// Alt Bileşen Tipleri
interface KPICardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  color: string;
  loading: boolean;
}

interface AccordionItemProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

// Alt Bileşenler (Yardımcı)
function KPICard({ title, value, subValue, icon, color, loading }: KPICardProps) {
  return (
    <div className={`p-6 rounded-3xl border border-white/40 bg-white/60 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-500/5 ${loading ? 'opacity-60' : ''} shadow-lg shadow-black/5`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${color} shadow-sm`}>
          {icon}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</div>
        <div className="text-2xl font-black text-slate-900 mt-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-700">{value}</div>
        {subValue && (
          <div className="text-xs text-slate-400 mt-1 font-semibold underline underline-offset-4 decoration-indigo-200">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
}

function AccordionItem({ title, icon, children, isOpen, onToggle }: AccordionItemProps) {
  return (
    <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/40 overflow-hidden shadow-xl shadow-slate-200/20">
      <button 
        onClick={onToggle}
        className="w-full p-5 flex items-center justify-between hover:bg-white/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-bold text-slate-800">{title}</span>
        </div>
        {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  );
}
