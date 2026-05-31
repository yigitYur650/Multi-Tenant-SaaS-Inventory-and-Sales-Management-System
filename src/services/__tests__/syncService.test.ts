import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// GLOBAL MOCK STORAGE TO BYPASS HOISTING ISSUES
// ============================================================
(globalThis as any).mockSyncQueue = [] as any[];
(globalThis as any).mockFailedSyncs = [] as any[];
(globalThis as any).mockProductVariants = [] as any[];

vi.mock('../../lib/db', () => {
  return {
    db: {
      sync_queue: {
        add: vi.fn(async (item: any) => {
          const queue = (globalThis as any).mockSyncQueue;
          const id = queue.length + 1;
          const newItem = { ...item, id };
          queue.push(newItem);
          return id;
        }),
        put: vi.fn(async (item: any) => {
          const queue = (globalThis as any).mockSyncQueue;
          const idx = queue.findIndex((i: any) => i.id === item.id);
          if (idx !== -1) {
            queue[idx] = item;
          } else {
            queue.push(item);
          }
          return item.id;
        }),
        delete: vi.fn(async (id: number) => {
          const queue = (globalThis as any).mockSyncQueue;
          const idx = queue.findIndex((i: any) => i.id === id);
          if (idx !== -1) queue.splice(idx, 1);
        }),
        get: vi.fn(async (id: number) => {
          const queue = (globalThis as any).mockSyncQueue;
          return queue.find((i: any) => i.id === id) || null;
        }),
        where: vi.fn((key: string) => {
          return {
            equals: vi.fn((val: any) => {
              const queue = (globalThis as any).mockSyncQueue;
              let filtered = queue.filter((item: any) => item[key] === val);
              return {
                filter: vi.fn((predicate: (x: any) => boolean) => {
                  filtered = filtered.filter(predicate);
                  return {
                    first: vi.fn(async () => filtered[0] || null),
                    toArray: vi.fn(async () => filtered)
                  };
                }),
                limit: vi.fn((n: number) => {
                  filtered = filtered.slice(0, n);
                  return {
                    toArray: vi.fn(async () => filtered)
                  };
                }),
                toArray: vi.fn(async () => filtered)
              };
            }),
            anyOf: vi.fn((ids: any[]) => {
              return {
                modify: vi.fn(async (changes: any) => {
                  const queue = (globalThis as any).mockSyncQueue;
                  queue.forEach((item: any) => {
                    if (ids.includes(item.id)) {
                      Object.assign(item, changes);
                    }
                  });
                })
              };
            })
          };
        })
      },
      failed_syncs: {
        add: vi.fn(async (item: any) => {
          const failed = (globalThis as any).mockFailedSyncs;
          const id = failed.length + 1;
          failed.push({ ...item, id });
          return id;
        }),
        toArray: vi.fn(async () => (globalThis as any).mockFailedSyncs)
      },
      product_variants: {
        get: vi.fn(async (id: string) => {
          const variants = (globalThis as any).mockProductVariants;
          return variants.find((v: any) => v.id === id) || null;
        }),
        update: vi.fn(async (id: string, changes: any) => {
          const variants = (globalThis as any).mockProductVariants;
          const idx = variants.findIndex((v: any) => v.id === id);
          if (idx !== -1) {
            variants[idx] = { ...variants[idx], ...changes };
          }
        })
      }
    }
  };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn()
  }
}));

// Now safe to import syncService since vi.mock is defined and global variables exist
import { syncService } from '../SyncService';

describe('SyncService Tests', () => {
  beforeEach(() => {
    (globalThis as any).mockSyncQueue = [] as any[];
    (globalThis as any).mockFailedSyncs = [] as any[];
    (globalThis as any).mockProductVariants = [] as any[];
    vi.clearAllMocks();

    // Setup environments and globals. Start offline (navigator.onLine = false)
    // so that enqueue does not automatically call processQueue synchronously.
    vi.stubEnv('VITE_GO_API_URL', 'http://localhost:3001');
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('crypto', { randomUUID: () => 'mock-uuid' });
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      crypto: { randomUUID: () => 'mock-uuid' }
    });
  });

  it('should accumulate stock deltas for the same variant in the queue', async () => {
    // Initial enqueue: UPDATE variant 1 with delta +5
    await syncService.enqueue('product_variants', 'UPDATE', { id: 'variant-1', delta: 5 });
    const queue = (globalThis as any).mockSyncQueue;
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.delta).toBe(5);

    // Second enqueue: UPDATE variant 1 with delta -3 (should accumulate to +2)
    await syncService.enqueue('product_variants', 'UPDATE', { id: 'variant-1', delta: -3 });
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.delta).toBe(2);

    // Third enqueue: UPDATE variant 1 with delta -2 (should reduce to 0 and remove from queue)
    await syncService.enqueue('product_variants', 'UPDATE', { id: 'variant-1', delta: -2 });
    expect(queue).toHaveLength(0);
  });

  it('should trigger local rollback and route to DLQ when backend returns check constraint violation (23514)', async () => {
    const variants = (globalThis as any).mockProductVariants;
    variants.push({ id: 'variant-1', stock_quantity: 10 });

    // Enqueue a stock change
    await syncService.enqueue('product_variants', 'UPDATE', { id: 'variant-1', delta: -15 });

    // Mock fetch to simulate 400 Bad Request with check constraint error (23514 / Yetersiz Stok)
    const mockFetch = vi.fn().mockResolvedValue({
      status: 400,
      text: async () => 'check constraint violation: stock_quantity cannot be negative (23514)'
    });
    vi.stubGlobal('fetch', mockFetch);

    // Simulate online network so that processQueue proceeds
    vi.stubGlobal('navigator', { onLine: true });

    // Trigger processing
    await syncService.processQueue();

    // Verify rollback:
    // In our mock database, when enqueue was called offline,
    // the caller did not do the optimistic UI update on mockProductVariants.
    // However, when SyncService rolls back, it does:
    // stock_quantity: Math.max(0, (localVar.stock_quantity || 0) - delta)
    // For localVar = { stock_quantity: 10 }, and delta = -15, the rollback evaluates to:
    // 10 - (-15) = 25.
    const updatedVar = variants.find((v: any) => v.id === 'variant-1');
    expect(updatedVar?.stock_quantity).toBe(25); // Reverted stock: 10 - (-15) = 25

    // Verify routed to DLQ (failed_syncs)
    const failed = (globalThis as any).mockFailedSyncs;
    expect(failed).toHaveLength(1);
    expect(failed[0].error_message).toContain('Yetersiz Stok');

    // Verify removed from queue
    const queue = (globalThis as any).mockSyncQueue;
    expect(queue).toHaveLength(0);
  });
});
