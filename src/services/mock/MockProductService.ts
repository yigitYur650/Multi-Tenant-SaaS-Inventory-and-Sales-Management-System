import { IProductService } from '../interfaces/IServices';
import { Database } from '../../types/database.types';
import { db } from '../../lib/db';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

type VariantRow = Database['public']['Tables']['product_variants']['Row'];
type VariantInsert = Database['public']['Tables']['product_variants']['Insert'];
type VariantUpdate = Database['public']['Tables']['product_variants']['Update'];

export class MockProductService implements IProductService {
  async getProductsWithVariants(): Promise<any[]> {
    const products = await db.products.filter(p => !p.is_deleted).toArray();
    const variants = await db.product_variants.filter(v => !v.is_deleted).toArray();
    const categories = await db.categories.filter(c => !c.is_deleted).toArray();

    return products.map(prod => {
      const prodVariants = variants.filter(v => v.product_id === prod.id);
      const category = categories.find(c => c.id === prod.category_id);
      return {
        ...prod,
        product_variants: prodVariants,
        categories: category ? { id: category.id, name: category.name } : null
      };
    });
  }

  async getProducts(): Promise<ProductRow[]> {
    const products = await db.products.filter(p => !p.is_deleted).toArray();
    return products as unknown as ProductRow[];
  }

  async createProduct(product: ProductInsert): Promise<ProductRow> {
    const id = window.crypto.randomUUID();
    const newProduct = { 
      ...product, 
      id, 
      is_deleted: false,
      created_at: new Date().toISOString() 
    } as unknown as ProductRow;
    
    await db.products.add(newProduct as any);
    return newProduct;
  }

  async updateProduct(id: string, product: ProductUpdate): Promise<ProductRow> {
    await db.products.update(id, product as any);
    const updated = await db.products.get(id);
    return updated as unknown as ProductRow;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.products.update(id, { is_deleted: true } as any);
    // Soft delete variants
    const variants = await db.product_variants.where({ product_id: id }).toArray();
    for (const v of variants) {
      await db.product_variants.update(v.id, { is_deleted: true });
    }
  }

  async getProductVariants(productId: string): Promise<VariantRow[]> {
    const variants = await db.product_variants.where({ product_id: productId }).filter(v => !v.is_deleted).toArray();
    return variants as unknown as VariantRow[];
  }

  async createVariant(variant: VariantInsert): Promise<VariantRow> {
    const id = window.crypto.randomUUID();
    const newVariant = { 
      ...variant, 
      id, 
      is_deleted: false,
      created_at: new Date().toISOString() 
    } as unknown as VariantRow;
    
    await db.product_variants.add(newVariant as any);
    return newVariant;
  }

  async updateVariant(id: string, variant: VariantUpdate): Promise<VariantRow> {
    await db.product_variants.update(id, variant as any);
    const updated = await db.product_variants.get(id);
    return updated as unknown as VariantRow;
  }

  async deleteVariant(id: string): Promise<void> {
    await db.product_variants.update(id, { is_deleted: true });
  }

  async smartSearch(query: string): Promise<any[]> {
    const products = await this.getProductsWithVariants();
    if (!query || query.trim() === '') return products;
    
    const lowerQuery = query.toLowerCase();
    
    return products.filter(p => {
      const matchName = p.name?.toLowerCase().includes(lowerQuery);
      const matchCategory = p.categories?.name?.toLowerCase().includes(lowerQuery);
      
      if (matchName || matchCategory) return true;

      if (p.product_variants) {
        return p.product_variants.some((v: any) => 
          v.color?.toLowerCase().includes(lowerQuery) ||
          v.size?.toLowerCase().includes(lowerQuery) ||
          v.sku?.toLowerCase().includes(lowerQuery)
        );
      }
      return false;
    });
  }
}
