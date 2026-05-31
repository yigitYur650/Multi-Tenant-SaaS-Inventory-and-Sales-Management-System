import { ICategoryService } from '../interfaces/IServices';
import { Database } from '../../types/database.types';
import { db } from '../../lib/db';

type CategoryRow = Database['public']['Tables']['categories']['Row'];
type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export class MockCategoryService implements ICategoryService {
  async getAllCategories(): Promise<CategoryRow[]> {
    const categories = await db.categories
      .filter(cat => !cat.is_deleted)
      .toArray();
    return categories as unknown as CategoryRow[];
  }

  async getDeletedCategories(): Promise<CategoryRow[]> {
    const categories = await db.categories
      .filter(cat => cat.is_deleted)
      .toArray();
    return categories as unknown as CategoryRow[];
  }

  async createCategory(category: CategoryInsert): Promise<CategoryRow> {
    const id = window.crypto.randomUUID();
    const newCat: CategoryRow = { 
      id,
      name: category.name,
      shop_id: category.shop_id,
      parent_id: category.parent_id || null,
      is_deleted: false
    };
    
    await db.categories.add(newCat as any);
    return newCat;
  }

  async updateCategory(id: string, category: CategoryUpdate): Promise<CategoryRow> {
    await db.categories.update(id, category as any);
    const updated = await db.categories.get(id);
    return updated as unknown as CategoryRow;
  }

  async softDeleteCategory(id: string): Promise<void> {
    await db.categories.update(id, { 
      is_deleted: true 
    } as any);
  }

  async restoreCategory(id: string): Promise<void> {
    await db.categories.update(id, { 
      is_deleted: false 
    } as any);
  }

  async forceDeleteCategory(id: string): Promise<void> {
    await db.categories.delete(id);
  }
}
