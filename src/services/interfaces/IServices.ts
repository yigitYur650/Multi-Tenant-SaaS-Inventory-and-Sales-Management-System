import { Database } from '../../types/database.types';
import { DashboardStats } from '../analyticsService';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

type VariantRow = Database['public']['Tables']['product_variants']['Row'];
type VariantInsert = Database['public']['Tables']['product_variants']['Insert'];
type VariantUpdate = Database['public']['Tables']['product_variants']['Update'];

type CategoryRow = Database['public']['Tables']['categories']['Row'];
type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export interface IProductService {
  getProductsWithVariants(): Promise<any[]>;
  getProducts(): Promise<ProductRow[]>;
  createProduct(product: ProductInsert): Promise<ProductRow>;
  updateProduct(id: string, product: ProductUpdate): Promise<ProductRow>;
  deleteProduct(id: string): Promise<void>;

  getProductVariants(productId: string): Promise<VariantRow[]>;
  createVariant(variant: VariantInsert): Promise<VariantRow>;
  updateVariant(id: string, variant: VariantUpdate): Promise<VariantRow>;
  deleteVariant(id: string): Promise<void>;

  smartSearch(query: string): Promise<any[]>;
}

export interface ICategoryService {
  getAllCategories(): Promise<CategoryRow[]>;
  getDeletedCategories(): Promise<CategoryRow[]>;
  createCategory(category: CategoryInsert): Promise<CategoryRow>;
  updateCategory(id: string, category: CategoryUpdate): Promise<CategoryRow>;
  softDeleteCategory(id: string): Promise<void>;
  restoreCategory(id: string): Promise<void>;
  forceDeleteCategory(id: string): Promise<void>;
}

type StockMovementInsert = Database['public']['Tables']['stock_movements']['Insert'];

export interface IStockService {
  addStockMovement(movement: any): Promise<any>;
  getMovementHistory(variantId: string): Promise<any[]>;
}

export interface ISaleService {
  processSale(salePayload: any): Promise<any>;
  getAllSales(): Promise<any[]>;
  getTodaySales(): Promise<any[]>;
  getTodaySummary(): Promise<any>;
  processReturn(returnPayload: any): Promise<any>;
  getReturnsBySale(saleId: string): Promise<any[]>;
}

export type DateRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface FinancialSummary {
  totalRevenue: number;
  paymentMethods: { method: string; amount: number }[];
  totalRefunds: number;
  netProfit: number;
}

export interface ChartData {
  label: string;
  sales: number;
}

export interface ProductPerformance {
  id: string;
  name: string;
  sku: string;
  salesCount: number;
  revenue: number;
}

export interface IAnalyticsService {
  getDashboardStats(date?: string): Promise<DashboardStats>;
  getFinancialSummary(range: DateRange): Promise<FinancialSummary>;
  getSalesChartData(range: DateRange): Promise<ChartData[]>;
  getProductPerformance(range: DateRange): Promise<{ topSelling: ProductPerformance[]; nonSelling: ProductPerformance[] }>;
  getDailyPosSummary(): Promise<any>;
}
