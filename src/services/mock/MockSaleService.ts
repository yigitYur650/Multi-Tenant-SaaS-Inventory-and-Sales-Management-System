import { ISaleService } from '../interfaces/IServices';

export class MockSaleService implements ISaleService {
  async processSale(salePayload: any): Promise<any> {
    return salePayload;
  }

  async getAllSales(): Promise<any[]> {
    return [];
  }

  async getTodaySales(): Promise<any[]> {
    return [];
  }

  async getTodaySummary(): Promise<any> {
    return { totalRevenue: 0, cash: 0, card: 0, count: 0 };
  }

  async processReturn(returnPayload: any): Promise<any> {
    return returnPayload;
  }

  async getReturnsBySale(saleId: string): Promise<any[]> {
    return [];
  }
}
