import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductService } from '../productService';

// ============================================================
// MOCK SUPABASE CLIENT
// ============================================================

/**
 * Chainable mock builder: Supabase query builder zincirleme
 * metodlarını simüle eder (.select().eq().single() gibi).
 */
function createQueryBuilder(resolvedValue: { data: any; error: any }) {
  const builder: any = {};
  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'is', 'order', 'single', 'from', 'rpc'
  ];
  methods.forEach(method => {
    builder[method] = vi.fn(() => builder);
  });
  // Son çağrıda Promise döndürmesi için then desteği
  builder.then = (resolve: any) => resolve(resolvedValue);
  return builder;
}

function createMockSupabase() {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return {
    client: { from: mockFrom, rpc: mockRpc } as any,
    mockFrom,
    mockRpc
  };
}

// ============================================================
// TEST SUITE
// ============================================================

describe('ProductService', () => {
  let service: ProductService;
  let mockFrom: ReturnType<typeof vi.fn>;
  let mockRpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const mock = createMockSupabase();
    service = new ProductService(mock.client);
    mockFrom = mock.mockFrom;
    mockRpc = mock.mockRpc;
  });

  // ----------------------------------------------------------
  // createProduct
  // ----------------------------------------------------------
  describe('createProduct', () => {
    it('doğru payload ile insert çağrısı yapmalı', async () => {
      const mockProduct = {
        id: 'prod-1',
        name: 'Test Ürün',
        description: 'Açıklama',
        category_id: 'cat-1',
        shop_id: 'shop-1',
        created_at: '2026-01-01T00:00:00Z',
        is_deleted: false
      };

      const qb = createQueryBuilder({ data: mockProduct, error: null });
      mockFrom.mockReturnValue(qb);

      const input = {
        name: 'Test Ürün',
        description: 'Açıklama',
        category_id: 'cat-1',
        shop_id: 'shop-1'
      };

      const result = await service.createProduct(input as any);

      // from('products') çağrıldı mı?
      expect(mockFrom).toHaveBeenCalledWith('products');

      // insert doğru payload ile çağrıldı mı?
      expect(qb.insert).toHaveBeenCalledWith({
        name: 'Test Ürün',
        description: 'Açıklama',
        category_id: 'cat-1',
        shop_id: 'shop-1'
      });

      // select() ve single() zincirlendi mi?
      expect(qb.select).toHaveBeenCalled();
      expect(qb.single).toHaveBeenCalled();

      // Sonuç doğru mu?
      expect(result).toEqual(mockProduct);
    });

    it('fazladan alanları payload\'a dahil etmemeli (DTO güvenliği)', async () => {
      const qb = createQueryBuilder({ data: { id: 'prod-2' }, error: null });
      mockFrom.mockReturnValue(qb);

      const dirtyInput = {
        name: 'Ürün',
        description: null,
        category_id: 'cat-1',
        shop_id: 'shop-1',
        // Bu alanlar payload'a GİRMEMELİ:
        hacker_field: 'malicious',
        role: 'admin'
      };

      await service.createProduct(dirtyInput as any);

      const insertedPayload = qb.insert.mock.calls[0][0];
      expect(insertedPayload).not.toHaveProperty('hacker_field');
      expect(insertedPayload).not.toHaveProperty('role');
      expect(Object.keys(insertedPayload)).toEqual([
        'name', 'description', 'category_id', 'shop_id'
      ]);
    });

    it('Supabase hata dönerse exception fırlatmalı', async () => {
      const qb = createQueryBuilder({
        data: null,
        error: { code: '42501', message: 'RLS violation' }
      });
      mockFrom.mockReturnValue(qb);

      await expect(
        service.createProduct({ name: 'X', shop_id: 'shop-1' } as any)
      ).rejects.toEqual({ code: '42501', message: 'RLS violation' });
    });
  });

  // ----------------------------------------------------------
  // getProductsWithVariants
  // ----------------------------------------------------------
  describe('getProductsWithVariants', () => {
    it('silinmiş varyantları filtrelemeli', async () => {
      const mockData = [
        {
          id: 'prod-1',
          name: 'Ürün A',
          is_deleted: false,
          product_variants: [
            { id: 'v1', is_deleted: false, colors: { name: 'Kırmızı' }, sizes: { name: 'M' } },
            { id: 'v2', is_deleted: true, colors: { name: 'Mavi' }, sizes: { name: 'L' } }
          ],
          categories: { id: 'cat-1', name: 'Giyim' }
        }
      ];

      const qb = createQueryBuilder({ data: mockData, error: null });
      mockFrom.mockReturnValue(qb);

      const result = await service.getProductsWithVariants();

      // Sadece 1 aktif varyant kalmalı
      expect(result[0].product_variants).toHaveLength(1);
      expect(result[0].product_variants[0].id).toBe('v1');
    });

    it('varyant dizisi boş ise boş dizi dönmeli', async () => {
      const mockData = [
        { id: 'prod-2', name: 'Ürün B', is_deleted: false, product_variants: null, categories: null }
      ];
      const qb = createQueryBuilder({ data: mockData, error: null });
      mockFrom.mockReturnValue(qb);

      const result = await service.getProductsWithVariants();
      expect(result[0].product_variants).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // smartSearch
  // ----------------------------------------------------------
  describe('smartSearch', () => {
    const mockProducts = [
      {
        id: 'p1', name: 'Pamuklu Gömlek', is_deleted: false,
        categories: { id: 'c1', name: 'Giyim' },
        product_variants: [
          { id: 'v1', sku: 'PG-001', is_deleted: false, colors: { name: 'Beyaz' }, sizes: { name: 'M' } },
          { id: 'v2', sku: 'PG-002', is_deleted: false, colors: { name: 'Siyah' }, sizes: { name: 'L' } }
        ]
      },
      {
        id: 'p2', name: 'Deri Cüzdan', is_deleted: false,
        categories: { id: 'c2', name: 'Aksesuar' },
        product_variants: [
          { id: 'v3', sku: 'DC-001', is_deleted: false, colors: { name: 'Kahverengi' }, sizes: { name: 'STD' } }
        ]
      },
      {
        id: 'p3', name: 'Spor Ayakkabı', is_deleted: false,
        categories: { id: 'c1', name: 'Giyim' },
        product_variants: [
          { id: 'v4', sku: 'SA-042', is_deleted: false, colors: { name: 'Kırmızı' }, sizes: { name: '42' } }
        ]
      }
    ];

    // Her test öncesi getProductsWithVariants mocklanır
    function setupSmartSearchMock() {
      const qb = createQueryBuilder({ data: mockProducts, error: null });
      mockFrom.mockReturnValue(qb);
    }

    it('ürün adına göre filtrelemeli', async () => {
      setupSmartSearchMock();
      const result = await service.smartSearch('gömlek');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Pamuklu Gömlek');
    });

    it('kategori adına göre filtrelemeli', async () => {
      setupSmartSearchMock();
      const result = await service.smartSearch('aksesuar');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Deri Cüzdan');
    });

    it('varyant renk adına göre filtrelemeli', async () => {
      setupSmartSearchMock();
      const result = await service.smartSearch('kahverengi');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p2');
    });

    it('varyant beden adına göre filtrelemeli', async () => {
      setupSmartSearchMock();
      const result = await service.smartSearch('42');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Spor Ayakkabı');
    });

    it('SKU koduna göre filtrelemeli', async () => {
      setupSmartSearchMock();
      const result = await service.smartSearch('DC-001');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Deri Cüzdan');
    });

    it('büyük/küçük harf duyarsız olmalı', async () => {
      setupSmartSearchMock();
      const result = await service.smartSearch('GÖMLEK');
      expect(result).toHaveLength(1);
    });

    it('boş sorgu tüm ürünleri döndürmeli', async () => {
      setupSmartSearchMock();
      const result = await service.smartSearch('');
      expect(result).toHaveLength(3);
    });

    it('eşleşme yoksa boş dizi döndürmeli', async () => {
      setupSmartSearchMock();
      const result = await service.smartSearch('xyz_bulunamaz_123');
      expect(result).toHaveLength(0);
    });

    it('"Giyim" araması birden fazla ürün döndürebilmeli', async () => {
      setupSmartSearchMock();
      const result = await service.smartSearch('giyim');
      expect(result).toHaveLength(2);
      expect(result.map(r => r.name)).toContain('Pamuklu Gömlek');
      expect(result.map(r => r.name)).toContain('Spor Ayakkabı');
    });
  });

  // ----------------------------------------------------------
  // deleteVariant (RPC)
  // ----------------------------------------------------------
  describe('deleteVariant', () => {
    it('soft_delete_variant RPC fonksiyonunu doğru parametre ile çağırmalı', async () => {
      const qb = createQueryBuilder({ data: null, error: null });
      mockRpc.mockReturnValue(qb);

      await service.deleteVariant('variant-123');

      expect(mockRpc).toHaveBeenCalledWith('soft_delete_variant', {
        p_variant_id: 'variant-123'
      });
    });

    it('RPC hata dönerse exception fırlatmalı', async () => {
      const qb = createQueryBuilder({
        data: null,
        error: { code: 'P0001', message: 'Varyant bulunamadı' }
      });
      mockRpc.mockReturnValue(qb);

      await expect(
        service.deleteVariant('invalid-id')
      ).rejects.toEqual({ code: 'P0001', message: 'Varyant bulunamadı' });
    });
  });

  // ----------------------------------------------------------
  // deleteProduct
  // ----------------------------------------------------------
  describe('deleteProduct', () => {
    it('Supabase hata dönerse anlamlı bir Error fırlatmalı', async () => {
      const qb = createQueryBuilder({
        data: null,
        error: { message: 'Aktif varyantı olan ürün silinemez' }
      });
      mockFrom.mockReturnValue(qb);

      await expect(
        service.deleteProduct('prod-1')
      ).rejects.toThrow('Aktif varyantı olan ürün silinemez');
    });
  });
});
