import { db } from '../lib/db';
import { supabase } from '../lib/supabaseClient';

/**
 * Soyut senkronizasyon sağlayıcısı. 
 * İleride Go Backend'e geçişte bu arayüzü implemente eden yeni bir sınıf yazılması yeterlidir.
 */
export interface ISyncProvider {
  processBatch(items: any[]): Promise<{ success: boolean; results: any[] }>;
}

export class SupabaseSyncProvider implements ISyncProvider {
  async processBatch(items: any[]): Promise<{ success: boolean; results: any[] }> {
    const goApiUrl = import.meta.env.VITE_GO_API_URL || (import.meta as any).env?.VITE_GO_API_URL;
    
    if (goApiUrl) {
      const correlationId = window.crypto.randomUUID();
      try {
        const response = await fetch(`${goApiUrl}/api/v1/sync/batch`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId
          },
          body: JSON.stringify({
            items: items.map(item => ({
              table: item.table,
              action: item.action,
              payload: item.payload,
              request_id: item.request_id,
              correlation_id: correlationId
            }))
          })
        });

        if (response.status === 200 || response.status === 202) {
          return {
            success: true,
            results: items.map(item => ({ queueId: item.id, status: 'success', correlationId }))
          };
        } else {
          const errText = await response.text();
          throw new Error(errText || `Server responded with status ${response.status}`);
        }
      } catch (err: any) {
        return {
          success: false,
          results: items.map(item => ({ queueId: item.id, status: 'error', error: err, correlationId }))
        };
      }
    }

    // Fallback: Direct Supabase sync
    const results = [];
    for (const item of items) {
      try {
        let error = null;
        if (item.table === 'product_variants' && item.payload.delta !== undefined) {
          const { error: rpcError } = await (supabase as any).rpc('update_variant_stock_delta', {
            p_variant_id: item.payload.id,
            p_delta: item.payload.delta
          });
          error = rpcError;
        } else if (item.table === 'sales' && item.action === 'INSERT') {
          const { error: rpcError } = await (supabase as any).rpc('process_sale', { 
            payload: { ...item.payload, request_id: item.request_id } 
          });
          error = rpcError;
          if (error) console.error("🔥 process_sale RPC Error:", error);
        } else {
          const { error: insertError } = await (supabase as any)
            .from(item.table as any)
            .upsert({ ...item.payload, request_id: item.request_id });
          error = insertError;
        }

        if (error) throw error;
        results.push({ queueId: item.id, status: 'success' });
      } catch (error: any) {
        results.push({ queueId: item.id, status: 'error', error });
      }
    }
    return { success: true, results };
  }
}

class SyncService {
  private isProcessing = false;
  private provider: ISyncProvider;

  constructor(provider: ISyncProvider) {
    this.provider = provider;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processQueue());
    }
  }

  /**
   * Kuyruğu paketler (batch) halinde eritir. 
   * 50K eşzamanlı kullanıcı hedefi için tek tek değil, toplu işleme odaklıdır.
   */
  async processQueue() {
    if (this.isProcessing || !navigator.onLine) return;
    this.isProcessing = true;

    try {
      const batchSize = 20;
      const pendingItems = await db.sync_queue
        .where('status')
        .equals('PENDING')
        .limit(batchSize)
        .toArray();

      if (pendingItems.length === 0) return;

      // İşleniyor olarak işaretle
      const ids = pendingItems.map(i => i.id!);
      await db.sync_queue.where('id').anyOf(ids).modify({ status: 'SYNCING' });

      const batchResult = await this.provider.processBatch(pendingItems);

      for (const res of batchResult.results) {
        if (res.status === 'success') {
          await db.sync_queue.delete(res.queueId);
        } else {
          // Hata Yönetimi ve Rollback
          const error = res.error;
          const queueItem = pendingItems.find(i => i.id === res.queueId);
          const errorMsg = error?.message || (typeof error === 'string' ? error : 'Unknown sync error');
          const correlationId = res.correlationId || window.crypto.randomUUID();

          // P0001: Custom SQL Error Code for Version Mismatch (Conflict)
          // 23514: CHECK constraint violation (insufficient stock)
          if (error?.code === 'P0001' || errorMsg?.includes('Conflict')) {
            await this.handleRollback(res.queueId);
            if (queueItem) {
              await db.failed_syncs.add({
                table: queueItem.table,
                action: queueItem.action,
                payload: queueItem.payload,
                error_message: `${errorMsg} (Rollback completed)`,
                correlation_id: correlationId,
                created_at: new Date().toISOString()
              });
            }
          } else if (error?.code === '23505') { // Idempotency: Unique violation (already synced)
            await db.sync_queue.delete(res.queueId);
          } else if (error?.code === '23514' || errorMsg?.includes('23514') || errorMsg?.includes('check constraint')) {
            // Insufficient stock: rollback changes and delete queue item
            await this.handleRollback(res.queueId);
            if (queueItem) {
              await db.failed_syncs.add({
                table: queueItem.table,
                action: queueItem.action,
                payload: queueItem.payload,
                error_message: `${errorMsg} (Yetersiz Stok - Geri Alındı)`,
                correlation_id: correlationId,
                created_at: new Date().toISOString()
              });
            }
          } else {
            // Network timeout / Server Busy (Move to local DLQ to clear sync queue)
            if (queueItem) {
              await db.failed_syncs.add({
                table: queueItem.table,
                action: queueItem.action,
                payload: queueItem.payload,
                error_message: errorMsg,
                correlation_id: correlationId,
                created_at: new Date().toISOString()
              });
              await db.sync_queue.delete(res.queueId);
            }
          }
        }
      }

      // Kuyrukta daha fazla öğe varsa devam et
      if (pendingItems.length === batchSize) {
        this.processQueue();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Conflict veya hata durumunda Dexie üzerindeki veriyi geri alır (Rollback).
   */
  private async handleRollback(queueId: number) {
    const item = await db.sync_queue.get(queueId);
    if (!item) return;

    try {
      if (item.table === 'sales') {
        await db.sales.delete(item.payload.id);
      } else if (item.table === 'products') {
        await db.products.delete(item.payload.id);
      } else if (item.table === 'product_variants') {
        // Rollback local stock changes
        const delta = item.payload.delta || 0;
        const localVar = await db.product_variants.get(item.payload.id);
        if (localVar) {
          await db.product_variants.update(item.payload.id, {
            stock_quantity: Math.max(0, (localVar.stock_quantity || 0) - delta)
          });
        }
      }
      
      await db.sync_queue.delete(queueId);

      // UI'a uyarı gönder (Event Bus mantığı)
      window.dispatchEvent(new CustomEvent('sync_rollback', { 
        detail: { 
          table: item.table, 
          message: 'Veri güncel değil veya yetersiz stok nedeniyle işlem geri alındı.' 
        } 
      }));
    } catch (err) {
      console.error("Rollback Error:", err);
    }
  }

  /**
   * Yeni bir işlemi kuyruğa ekler.
   * Stok değişimleri için delta değerlerini biriktirir (accumulate).
   */
  async enqueue(table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) {
    if (table === 'product_variants' && action === 'UPDATE' && payload.delta !== undefined) {
      const existing = await db.sync_queue
        .where('table')
        .equals('product_variants')
        .filter(item => item.action === 'UPDATE' && item.payload.id === payload.id && item.status === 'PENDING')
        .first();

      if (existing) {
        const newDelta = (existing.payload.delta || 0) + payload.delta;
        if (newDelta === 0) {
          await db.sync_queue.delete(existing.id!);
        } else {
          existing.payload.delta = newDelta;
          await db.sync_queue.put(existing);
        }
        
        if (navigator.onLine) {
          this.processQueue();
        }
        return;
      }
    }

    await db.sync_queue.add({
      table,
      action,
      payload,
      request_id: payload.request_id || window.crypto.randomUUID(),
      status: 'PENDING',
      created_at: new Date().toISOString()
    });
    
    if (navigator.onLine) {
      this.processQueue();
    }
  }
}

export const syncService = new SyncService(new SupabaseSyncProvider());
