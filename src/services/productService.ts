import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { IProductService } from './interfaces/IServices';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

type VariantRow = Database['public']['Tables']['product_variants']['Row'];
type VariantInsert = Database['public']['Tables']['product_variants']['Insert'];
type VariantUpdate = Database['public']['Tables']['product_variants']['Update'];

// --- JOIN Tipleri ---
export interface JoinedVariant extends VariantRow {
  colors: { name: string } | null;
  sizes: { name: string } | null;
}

export interface JoinedProduct extends ProductRow {
  product_variants: JoinedVariant[];
  categories: { id: string; name: string } | null;
}

export class ProductService implements IProductService {
  constructor(private supabase: any) {}

  /**
   * Ürünleri ve onlara bağlı varyantları (ve kategori bilgilerini) getirir. (Deep Join)
   */
  async getProductsWithVariants(): Promise<JoinedProduct[]> {
    const { data, error } = await this.supabase
      .from('products')
      .select(`
        *,
        product_variants (*, colors(name), sizes(name)),
        categories (id, name)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Aktif ürünlerin içindeki silinmiş varyantları da temizleyelim
    const products = (data as unknown) as JoinedProduct[];
    return products.map(p => ({
      ...p,
      product_variants: p.product_variants?.filter((v: any) => !v.is_deleted) || []
    }));
  }

  /**
   * Sadece ürünleri ve ilgili kategori bilgilerini getirir.
   */
  async getProducts(): Promise<ProductRow[]> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data || [];
  }

  /**
   * Yeni bir ürün oluşturur (Clean Payload/DTO).
   */
  async createProduct(product: ProductInsert): Promise<ProductRow> {
    const payload: ProductInsert = {
      name: product.name,
      description: product.description,
      category_id: product.category_id,
      shop_id: product.shop_id
    };

    const { data, error } = await this.supabase
      .from('products')
      .insert(payload)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  /**
   * Ürünü günceller (Clean Payload/DTO - Sadece tanımlı alanlar).
   */
  async updateProduct(id: string, product: any): Promise<ProductRow> {
    const payload: any = {};
    if (product.name !== undefined) payload.name = product.name;
    if (product.description !== undefined) payload.description = product.description;
    if (product.category_id !== undefined && product.category_id !== '') payload.category_id = product.category_id;
    if (product.shop_id !== undefined && product.shop_id !== '') payload.shop_id = product.shop_id;
    if (product.version !== undefined) payload.version = product.version;

    if (Object.keys(payload).length === 0) return {} as ProductRow;

    console.log("updateProduct ID:", id, "Payload:", payload);
    const { data, error } = await this.supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error("🔥 Supabase Update Error:", error);
      throw error;
    }
    return data;
  }

  /**
   * Ürünü siler (Soft Delete). 
   * Güvenlik Kontrolü: Veritabanındaki trigger aracılığıyla,
   * aktif (silinmemiş) varyantı olan ürünler silinemez.
   */
  async deleteProduct(id: string): Promise<void> {
    const { error: deleteError } = await this.supabase
      .from('products')
      .update({ is_deleted: true } as any)
      .eq('id', id);
      
    if (deleteError) {
      console.error("Supabase Delete Error:", deleteError);
      throw new Error(deleteError.message || 'Ürün silinirken bir hata oluştu.');
    }
  }

  // --- VARIANT METOTLARI ---

  /**
   * Belirli bir ürüne ait varyantları getirir.
   */
  async getProductVariants(productId: string): Promise<VariantRow[]> {
    const { data, error } = await this.supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Yeni bir ürün varyantı oluşturur (Clean Payload/DTO).
   */
  async createVariant(variant: VariantInsert): Promise<VariantRow> {
    const payload: VariantInsert = {
      product_id: variant.product_id,
      sku: variant.sku,
      color_id: variant.color_id,
      size_id: variant.size_id,
      stock_quantity: variant.stock_quantity,
      low_stock_threshold: variant.low_stock_threshold,
      wholesale_price: variant.wholesale_price,
      retail_price: variant.retail_price
    };

    const { data, error } = await this.supabase
      .from('product_variants')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Varyant bilgisini günceller (Clean Payload/DTO - Sadece tanımlı alanlar).
   */
  async updateVariant(id: string, variant: VariantUpdate): Promise<VariantRow> {
    const payload: VariantUpdate = {};
    if (variant.sku !== undefined) payload.sku = variant.sku;
    if (variant.color_id !== undefined) payload.color_id = variant.color_id;
    if (variant.size_id !== undefined) payload.size_id = variant.size_id;
    if (variant.stock_quantity !== undefined) payload.stock_quantity = variant.stock_quantity;
    if (variant.low_stock_threshold !== undefined) payload.low_stock_threshold = variant.low_stock_threshold;
    if (variant.wholesale_price !== undefined) payload.wholesale_price = variant.wholesale_price;
    if (variant.retail_price !== undefined) payload.retail_price = variant.retail_price;

    const { data, error } = await this.supabase
      .from('product_variants')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Varyantı siler (Soft Delete via RPC - RLS bypass).
   */
  async deleteVariant(id: string): Promise<void> {
    console.log(`🗑️ DeleteVariant attempt - ID: ${id}`);
    // @ts-ignore
    const { error } = await this.supabase.rpc('soft_delete_variant', {
      p_variant_id: id
    });
    if (error) {
      console.error("❌ DeleteVariant error:", error);
      throw error;
    }
  }

  /**
   * Akıllı arama işlemi (Join verilere göre).
   */
  async smartSearch(query: string): Promise<JoinedProduct[]> {
    const products = await this.getProductsWithVariants();
    if (!query) return products;
    const lq = query.toLowerCase();
    
    return products.filter((p: JoinedProduct) => 
      p.name?.toLowerCase().includes(lq) || 
      p.categories?.name?.toLowerCase().includes(lq) ||
      p.product_variants?.some((v: JoinedVariant) => 
        v.colors?.name?.toLowerCase().includes(lq) || 
        v.sizes?.name?.toLowerCase().includes(lq) ||
        v.sku?.toLowerCase().includes(lq)
      )
    );
  }
}
