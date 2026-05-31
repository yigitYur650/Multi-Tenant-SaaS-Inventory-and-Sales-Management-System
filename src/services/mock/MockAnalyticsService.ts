import { IAnalyticsService, DateRange, FinancialSummary, ChartData, ProductPerformance } from '../interfaces/IServices';
import { DashboardStats } from '../analyticsService';

export class MockAnalyticsService implements IAnalyticsService {
  async getDashboardStats(date?: string): Promise<DashboardStats> {
    return {
      todayRevenue: 0,
      todayProfit: 0,
      totalSalesToday: 0,
      topSelling: [],
      lowStockItems: []
    };
  }

  async getFinancialSummary(range: DateRange): Promise<FinancialSummary> {
    return {
      totalRevenue: 0,
      paymentMethods: [],
      totalRefunds: 0,
      netProfit: 0
    };
  }

  async getSalesChartData(range: DateRange): Promise<ChartData[]> {
    return [];
  }

  async getProductPerformance(range: DateRange): Promise<{ topSelling: ProductPerformance[]; nonSelling: ProductPerformance[] }> {
    return {
      topSelling: [],
      nonSelling: []
    };
  }

  async getDailyPosSummary(): Promise<any> {
    return { cash: 0, card: 0, total: 0 };
  }
}
