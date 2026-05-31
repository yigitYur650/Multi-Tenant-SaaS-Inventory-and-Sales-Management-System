import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { ICategoryService } from './interfaces/IServices';

type CategoryRow = Database['public']['Tables']['categories']['Row'];
type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export class CategoryService implements ICategoryService {
  constructor(private supabase: any) {}

  /**
   * Tüm kategorileri getirir (RLS sayesinde sadece ilgili mağazanınkiler gelir).
   */
  async getAllCategories(): Promise<CategoryRow[]> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('is_deleted', false)
      .order('name');
      
    if (error) throw error;
    return data || [];
  }

  /**
   * Silinmiş (Çöp kutusundaki) kategorileri getirir.
   */
  async getDeletedCategories(): Promise<CategoryRow[]> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('is_deleted', true)
      .order('name');
      
    if (error) throw error;
    return data || [];
  }

  /**
   * Yeni bir kategori oluşturur (Clean Payload/DTO).
   */
  async createCategory(category: CategoryInsert): Promise<CategoryRow> {
    const payload: CategoryInsert = {
      name: category.name,
      shop_id: category.shop_id,
      parent_id: category.parent_id
    };

    const { data, error } = await this.supabase
      .from('categories')
      .insert(payload)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  /**
   * Kategoriyi günceller (Clean Payload/DTO - Sadece tanımlı alanlar).
   */
  async updateCategory(id: string, category: CategoryUpdate): Promise<CategoryRow> {
    const payload: CategoryUpdate = {};
    if (category.name !== undefined) payload.name = category.name;
    if (category.parent_id !== undefined) payload.parent_id = category.parent_id;
    if (category.shop_id !== undefined) payload.shop_id = category.shop_id;

    const { data, error } = await this.supabase
      .from('categories')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  /**
   * Kategoriyi yumuşak silme (Soft Delete) ile işaretler.
   */
  async softDeleteCategory(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('categories')
      .update({ is_deleted: true } as any)
      .eq('id', id);
      
    if (error) throw error;
  }

  /**
   * Silinmiş kategoriyi geri yükler.
   */
  async restoreCategory(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('categories')
      .update({ is_deleted: false } as any)
      .eq('id', id);
      
    if (error) throw error;
  }

  /**
   * Kategoriyi kalıcı olarak siler.
   */
  async forceDeleteCategory(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('categories')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
  }
}
