import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';

interface MasterDataContextType {
  categories: any[];
  colors: any[];
  sizes: any[];
  loading: boolean;
  refreshMasterData: () => Promise<void>;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export function MasterDataProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Load from Dexie (Cache) first
  useEffect(() => {
    async function loadFromCache() {
      if (!profile?.shop_id) return;
      try {
        const [cachedCats, cachedCols, cachedSzs] = await Promise.all([
          db.categories.where('shop_id').equals(profile.shop_id).toArray(),
          db.colors.where('shop_id').equals(profile.shop_id).toArray(),
          db.sizes.where('shop_id').equals(profile.shop_id).toArray()
        ]);

        if (cachedCats.length > 0) setCategories(cachedCats);
        if (cachedCols.length > 0) setColors(cachedCols);
        if (cachedSzs.length > 0) setSizes(cachedSzs);

        // If we have any cached data, stop the skeleton loader immediately
        if (cachedCats.length > 0 || cachedCols.length > 0 || cachedSzs.length > 0) {
          setLoading(false);
        }
      } catch (err) {
        console.error("Dexie Load Error:", err);
      }
    }
    loadFromCache();
  }, [profile?.shop_id]);

  // 2. Fetch from Supabase and Update Dexie (Sync)
  const fetchMasterData = useCallback(async () => {
    if (!profile?.shop_id) return;
    
    try {
      // Background sync - if we don't have cache, this will trigger the loader
      if (categories.length === 0) setLoading(true);

      const [cats, cols, szs] = await Promise.all([
        supabase.from('categories').select('*').eq('shop_id', profile.shop_id).eq('is_deleted', false).order('name'),
        supabase.from('colors').select('*').eq('shop_id', profile.shop_id).order('name'),
        supabase.from('sizes').select('*').eq('shop_id', profile.shop_id).order('name')
      ]);

      // Update State and Dexie
      if (cats.data) {
        setCategories(cats.data);
        await db.categories.where('shop_id').equals(profile.shop_id).delete();
        await db.categories.bulkAdd(cats.data);
      }
      if (cols.data) {
        setColors(cols.data);
        await db.colors.where('shop_id').equals(profile.shop_id).delete();
        await db.colors.bulkAdd(cols.data);
      }
      if (szs.data) {
        setSizes(szs.data);
        await db.sizes.where('shop_id').equals(profile.shop_id).delete();
        await db.sizes.bulkAdd(szs.data);
      }
    } catch (err) {
      console.error("Master Data Sync Error:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.shop_id, categories.length]);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  return (
    <MasterDataContext.Provider value={{ 
      categories, colors, sizes, loading, 
      refreshMasterData: fetchMasterData 
    }}>
      {children}
    </MasterDataContext.Provider>
  );
}

export function useMasterData() {
  const context = useContext(MasterDataContext);
  if (context === undefined) {
    throw new Error('useMasterData must be used within a MasterDataProvider');
  }
  return context;
}
