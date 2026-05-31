import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { IAnalyticsService, DateRange, FinancialSummary, ChartData, ProductPerformance } from './interfaces/IServices';

// Supabase generated types içerisinden ilgili Row'ları export/import ediyoruz
type TopSellingVariant = Database['public']['Views']['top_selling_variants']['Row'];
type LowStockAlert = Database['public']['Views']['low_stock_alerts']['Row'];

export interface DashboardStats {
  todayRevenue: number;
  todayProfit: number;
  totalSalesToday: number;
  topSelling: TopSellingVariant[];
  lowStockItems: LowStockAlert[];
}

export class AnalyticsService implements IAnalyticsService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Dashboard için gerekli tüm verileri çeker (Daily Sales, Top Variants, Low Stock).
   */
  async getDashboardStats(date: string = new Date().toISOString().split('T')[0]): Promise<DashboardStats> {
    try {
      if (!this.supabase) throw new Error("Supabase client is not initialized");

      // 1. Günlük Satış Özeti
      const { data, error: dailyError } = await this.supabase
        .from('daily_sales_summary')
        .select('*')
        .eq('sale_date', date)
        .maybeSingle(); 
        
      if (dailyError) throw dailyError;
      const dailySales = data as any;

      // 2. Çok Satanlar Listesi
      const { data: topSelling, error: topError } = await this.supabase
        .from('top_selling_variants')
        .select('*')
        .order('total_quantity_sold', { ascending: false })
        .limit(10);
      if (topError) throw topError;

      // 3. Kritik Stok Uyarıları (Dinamik Eşik Mantığı: stock <= threshold)
      const { data: allVariants, error: fetchError } = await this.supabase
        .from('product_variants')
        .select(`
          id,
          stock_quantity,
          low_stock_threshold,
          products(name, shop_id),
          colors(name),
          sizes(name)
        `);

      if (fetchError) throw fetchError;

      const lowStockAlerts = (allVariants as any[])
        .filter((v: any) => v.stock_quantity <= (v.low_stock_threshold || 10))
        .map((v: any) => ({
          shop_id: v.products?.shop_id || '',
          variant_id: v.id,
          product_name: v.products?.name || 'Bilinmiyor',
          color: v.colors?.name || '-',
          size: v.sizes?.name || '-',
          stock_quantity: v.stock_quantity
        }));

      if (lowStockAlerts && lowStockAlerts.length > 0) {
        this.triggerN8NLowStockWebhook(lowStockAlerts);
      }

      return {
        todayRevenue: dailySales?.total_revenue || 0,
        todayProfit: dailySales?.net_profit || 0,
        totalSalesToday: dailySales?.total_sales || 0,
        topSelling: topSelling || [],
        lowStockItems: lowStockAlerts as any
      };
    } catch (error) {
      console.error("❌ AnalyticsService Error:", error);
      return {
        todayRevenue: 0,
        todayProfit: 0,
        totalSalesToday: 0,
        topSelling: [],
        lowStockItems: []
      };
    }
  }

  async getFinancialSummary(range: DateRange): Promise<FinancialSummary> {
    try {
      const { data, error } = await this.supabase
        .from('daily_sales_summary')
        .select('*')
        .order('sale_date', { ascending: false });

      if (error) throw error;
      const stats = (data || []) as any[];

      // Basitlik için tüm verileri topluyoruz (Filtreleme range'e göre genişletilebilir)
      const totalRevenue = stats.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
      const netProfit = stats.reduce((sum, s) => sum + (s.net_profit || 0), 0);

      // Ödeme yöntemi dağılımı (Payments tablosundan çekilmeli, şimdilik statik veya mock-logic)
      return {
        totalRevenue,
        paymentMethods: [
          { method: 'Nakit', amount: totalRevenue * 0.6 },
          { method: 'Kredi Kartı', amount: totalRevenue * 0.4 }
        ],
        totalRefunds: 0,
        netProfit
      };
    } catch (err) {
      console.error("getFinancialSummary Error:", err);
      return { totalRevenue: 0, paymentMethods: [], totalRefunds: 0, netProfit: 0 };
    }
  }

  async getSalesChartData(range: DateRange): Promise<ChartData[]> {
    try {
      const { data, error } = await this.supabase
        .from('daily_sales_summary')
        .select('sale_date, total_revenue')
        .order('sale_date', { ascending: true })
        .limit(30);

      if (error) throw error;
      return ((data || []) as any[]).map(s => ({
        label: new Date(s.sale_date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
        sales: s.total_revenue || 0
      }));
    } catch (err) {
      console.error("getSalesChartData Error:", err);
      return [];
    }
  }

  async getProductPerformance(range: DateRange): Promise<{ topSelling: ProductPerformance[]; nonSelling: ProductPerformance[] }> {
    try {
      const { data, error } = await this.supabase
        .from('top_selling_variants')
        .select('*')
        .order('total_quantity_sold', { ascending: false })
        .limit(5);

      if (error) throw error;

      const performance: ProductPerformance[] = ((data || []) as any[]).map(v => ({
        id: v.variant_id || '',
        name: `${v.product_name} (${v.color_name} - ${v.size_name})`,
        sku: v.sku || '',
        salesCount: v.total_quantity_sold || 0,
        revenue: v.total_profit || 0 // Not: profit döndürüyor view, kurala göre revenue/profit eşlenebilir
      }));

      return {
        topSelling: performance,
        nonSelling: [] // Hiç satmayanlar için ayrı bir logic gerekebilir
      };
    } catch (err) {
      console.error("getProductPerformance Error:", err);
      return { topSelling: [], nonSelling: [] };
    }
  }

  async getDailyPosSummary(): Promise<any> {
    return {
      cash: 0,
      card: 0,
      total: 0
    };
  }

  /**
   * n8n Webhook Tetiklemesi
   */
  private async triggerN8NLowStockWebhook(items: any[]) {
    try {
      // Mock webhook call
      console.log(`[n8n Webhook] ${items.length} adet kritik stoğa düşmüş ürün tespit edildi.`);
    } catch (error: unknown) {
      console.error("Webhook tetiklenemedi:", error);
    }
  }
}
