import Dexie, { Table } from 'dexie';

export interface LocalCategory {
  id: string;
  shop_id: string;
  name: string;
  is_deleted: boolean;
  updated_at: string;
}

export interface LocalColor {
  id: string;
  shop_id: string;
  name: string;
  updated_at: string;
}

export interface LocalSize {
  id: string;
  shop_id: string;
  name: string;
  updated_at: string;
}

export interface LocalProduct {
  id: string;
  shop_id: string;
  category_id: string;
  name: string;
  description?: string;
  is_deleted: boolean;
  updated_at: string;
  version: number;
  request_id?: string;
}

export interface LocalProductVariant {
  id: string;
  product_id: string;
  sku: string | null;
  color_id: string | null;
  size_id: string | null;
  wholesale_price: number;
  retail_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_deleted: boolean;
  updated_at: string;
}

export interface LocalSale {
  id: string;
  shop_id: string;
  total_amount: number;
  sale_date: string;
  updated_at: string;
  version: number;
  request_id?: string;
}

export interface SyncQueueItem {
  id?: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  payload: any;
  request_id: string;
  status: 'PENDING' | 'SYNCING' | 'ERROR';
  created_at: string;
}

export interface LocalFailedSync {
  id?: number;
  table: string;
  action: string;
  payload: any;
  error_message: string;
  correlation_id: string;
  created_at: string;
}

export class AppDatabase extends Dexie {
  products!: Table<LocalProduct>;
  product_variants!: Table<LocalProductVariant>;
  categories!: Table<LocalCategory>;
  colors!: Table<LocalColor>;
  sizes!: Table<LocalSize>;
  sales!: Table<LocalSale>;
  sync_queue!: Table<SyncQueueItem>;
  failed_syncs!: Table<LocalFailedSync>;
  stock_movements_offline!: Table<any>; // For sandbox mock compatibility

  constructor() {
    super('saas_erp_db');
    this.version(1).stores({
      products: 'id, shop_id, category_id',
      product_variants: 'id, product_id',
      categories: 'id, shop_id',
      colors: 'id, shop_id',
      sizes: 'id, shop_id',
      sales: 'id, shop_id, sale_date',
      sync_queue: '++id, status, table',
      stock_movements_offline: 'id, variant_id'
    });
    this.version(2).stores({
      failed_syncs: '++id, table, correlation_id'
    });
  }
}

export const db = new AppDatabase();
