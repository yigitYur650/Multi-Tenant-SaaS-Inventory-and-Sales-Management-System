import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { IProductService, ISaleService, IStockService, ICategoryService, IAnalyticsService } from './interfaces/IServices';

// Gercek Servisler
import { ProductService } from './productService';
import { SaleService } from './saleService';
import { StockService } from './stockService';
import { CategoryService } from './categoryService';
import { AnalyticsService } from './analyticsService';

export interface AppServices {
  productService: IProductService;
  saleService: ISaleService;
  stockService: IStockService;
  categoryService: ICategoryService;
  analyticsService: IAnalyticsService;
}

export function getServices(supabaseClient: SupabaseClient<Database, 'public'>): AppServices {
  // --- ÜRETİM ORTAMI SERVİS YAPILANDIRMASI ---
  // Tüm servisler %100 Supabase altyapısına bağlanmıştır.
  return {
    productService: new ProductService(supabaseClient),
    saleService: new SaleService(supabaseClient),
    stockService: new StockService(supabaseClient),
    categoryService: new CategoryService(supabaseClient),
    analyticsService: new AnalyticsService(supabaseClient)
  };
}
