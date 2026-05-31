import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { IStockService } from './interfaces/IServices';
import { db } from '../lib/db';
import { syncService } from './SyncService';

type StockMovementInsert = Database['public']['Tables']['stock_movements']['Insert'];

export class StockService implements IStockService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Yeni bir stok hareketi ekler. (Delta & Offline-First)
   */
  async addStockMovement(movement: any) {
    const qty = parseInt(movement.quantity, 10);
    const delta = movement.type === 'IN' || movement.type === 'RETURN' ? qty : -qty;

    const payload = {
      id: movement.variant_id,
      shop_id: movement.shop_id,
      delta: delta,
      request_id: window.crypto.randomUUID(),
      user_email: movement.user_email || 'System',
      reason: movement.reason || ''
    };

    // DEBUG: Payload Reveal
    console.log("Stock Delta Payload:", JSON.stringify(payload, null, 2));

    // 1. Optimistic UI update in Dexie local storage
    try {
      const localVar = await db.product_variants.get(movement.variant_id);
      if (localVar) {
        await db.product_variants.update(movement.variant_id, {
          stock_quantity: Math.max(0, (localVar.stock_quantity || 0) + delta)
        });
      }
    } catch (err) {
      console.warn("Local IndexedDB stock update bypassed:", err);
    }

    // 2. Enqueue the relative stock update in the offline queue
    await syncService.enqueue('product_variants', 'UPDATE', payload);

    return payload;
  }

  /**
   * Belirli bir varyantın stok hareket geçmişini çeker.
   */
  async getMovementHistory(variantId: string) {
    const { data, error } = await this.supabase
      .from('stock_movements')
      .select(`
        id,
        type,
        quantity,
        reason,
        created_at,
        user_email,
        previous_stock,
        new_stock,
        variant_id
      `)
      .eq('variant_id', variantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("StockService - Get History Error:", error);
      throw error;
    }

    return data;
  }
}
