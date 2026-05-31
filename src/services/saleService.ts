import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { ISaleService } from './interfaces/IServices';
import { db } from '../lib/db';
import { syncService } from './SyncService';

export class SaleService implements ISaleService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Atomik olarak bir satış işlemi kurgular. (Offline-First & Idempotency)
   */
  async processSale(salePayload: any): Promise<any> {
    const id = salePayload.id || window.crypto.randomUUID();
    const request_id = window.crypto.randomUUID();
    const created_at = new Date().toISOString();

    const finalizedPayload = {
      ...salePayload,
      id,
      request_id,
      created_at,
      version: 1,
      user_email: salePayload.user_email || 'Bilinmeyen',
      customer_note: salePayload.customer_note || '',
      payment_type: salePayload.payment_method === 'CASH' ? 'CASH' : 'CARD', 
      discount_amount: salePayload.discount_amount || 0,
      items: salePayload.items.map((item: any) => ({
        ...item, 
        id: item.id || window.crypto.randomUUID()
      })),
      payments: (salePayload.payments || []).map((p: any) => ({
        ...p, 
        id: p.id || window.crypto.randomUUID(), 
        created_at: new Date().toISOString()
      }))
    };

    // 1. Optimistic UI: Yerel veritabanına (Dexie) yaz
    await db.sales.add({
      id: finalizedPayload.id,
      shop_id: finalizedPayload.shop_id,
      total_amount: finalizedPayload.total_amount,
      sale_date: finalizedPayload.created_at,
      updated_at: finalizedPayload.created_at,
      version: finalizedPayload.version,
      request_id: finalizedPayload.request_id
    });

    // 2. Senkronizasyon kuyruğuna ekle (Idempotency Garantili)
    await syncService.enqueue('sales', 'INSERT', finalizedPayload);

    return finalizedPayload;
  }

  /**
   * Tüm satışları getirir (Raporlama için)
   */
  async getAllSales(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('sales')
      .select(`
        *,
        sale_items (
          *,
          product_variants (
            *,
            products (name)
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Bugün yapılan satışları, kalemleriyle birlikte getirir.
   */
  async getTodaySales(): Promise<any[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await this.supabase
      .from('sales')
      .select(`
        *,
        sale_items (
          *,
          product_variants (
            *,
            products (name)
          )
        )
      `)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Bugünün özet verisini (Ciro ve Ödeme Tipi Dağılımı) hesaplar.
   */
  async getTodaySummary(): Promise<any> {
    const sales = await this.getTodaySales();
    
    const summary = {
      totalRevenue: 0,
      cash: 0,
      card: 0,
      mailOrder: 0,
      unspecified: 0,
      count: sales.length
    };

    sales.forEach(sale => {
      const amount = Number(sale.total_amount) || 0;
      summary.totalRevenue += amount;

      switch(sale.payment_method) {
        case 'CASH': summary.cash += amount; break;
        case 'CREDIT_CARD': summary.card += amount; break;
        case 'MAIL_ORDER': summary.mailOrder += amount; break;
        default: summary.unspecified += amount; break;
      }
    });

    return summary;
  }

  /**
   * Bir satış kalemini iade alır. (Stok artırımı + İade kaydı)
   */
  async processReturn(returnPayload: any): Promise<any> {
    // @ts-ignore
    const { data, error } = await this.supabase.rpc('process_return', {
      payload: returnPayload
    });

    if (error) {
      console.error("SaleService - processReturn Error:", error);
      throw error;
    }
    return data;
  }

  /**
   * Bir satışa ait tüm iadeleri çeker.
   */
  async getReturnsBySale(saleId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('returns')
      .select('*')
      .eq('sale_id', saleId);
    
    if (error) throw error;
    return data;
  }
}
