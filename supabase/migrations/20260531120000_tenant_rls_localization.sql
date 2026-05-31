-- 1. shops tablosuna yeni kolonlar ekleme
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'TRY';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'tr-TR';

-- 2. Yetki Rolü Kontrolü (is_admin_or_manager)
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- JWT claims kontrolü (app_metadata veya user_metadata)
  v_role := COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );
  
  -- String veya numerik rollerin kontrolü (3: PATRON/ADMIN, 2: MUDUR/MANAGER)
  IF v_role IN ('ADMIN', 'MANAGER', 'PATRON', '3', '2') THEN
    RETURN TRUE;
  END IF;
  
  -- Fallback: profiles tablosundan kontrol
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN (2, 3)
  );
END;
$$;

-- 3. Mağaza Kimliği Çıkarma (get_current_shop_id)
CREATE OR REPLACE FUNCTION public.get_current_shop_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_shop_id TEXT;
BEGIN
  -- JWT claims kontrolü (app_metadata veya user_metadata)
  v_shop_id := COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'shop_id',
    auth.jwt() -> 'user_metadata' ->> 'shop_id'
  );
  
  IF v_shop_id IS NOT NULL THEN
    RETURN v_shop_id::uuid;
  END IF;
  
  -- Fallback: profiles tablosundan kontrol
  RETURN (SELECT shop_id FROM public.profiles WHERE id = auth.uid());
EXCEPTION
  WHEN OTHERS THEN
    RETURN (SELECT shop_id FROM public.profiles WHERE id = auth.uid());
END;
$$;

-- 4. RLS POLİTİKALARINI GÜNCELLEME

-- ESKİ POLİTİKALARI KALDIR
DROP POLICY IF EXISTS "Kullanıcılar kendi mağazalarındaki kategorileri görebilir (Select)" ON public.categories;
DROP POLICY IF EXISTS "Kullanıcılar kendi mağazalarındaki kategorileri ekleyebilir (Insert)" ON public.categories;
DROP POLICY IF EXISTS "Kullanıcılar mağazasındaki kategorileri güncelleyebilir (Update)" ON public.categories;
DROP POLICY IF EXISTS "Kullanıcılar mağazasındaki kategorileri silebilir (Delete)" ON public.categories;

DROP POLICY IF EXISTS "Kullanıcılar kendi mağazalarındaki ürünleri görebilir (Select)" ON public.products;
DROP POLICY IF EXISTS "Kullanıcılar kendi mağazalarındaki ürünleri ekleyebilir (Insert)" ON public.products;
DROP POLICY IF EXISTS "Kullanıcılar mağazasındaki ürünleri güncelleyebilir (Update)" ON public.products;
DROP POLICY IF EXISTS "Kullanıcılar mağazasındaki ürünleri silebilir (Delete)" ON public.products;

DROP POLICY IF EXISTS "Kullanıcılar mağazasındaki satışları görebilir (Select)" ON public.sales;
DROP POLICY IF EXISTS "Kullanıcılar mağazasına satış ekleyebilir (Insert)" ON public.sales;
DROP POLICY IF EXISTS "Kullanıcılar mağazasındaki satışları güncelleyebilir (Update)" ON public.sales;
DROP POLICY IF EXISTS "Kullanıcılar mağazasındaki satışları silebilir (Delete)" ON public.sales;


-- YENİ STRIKT RLS POLİTİKALARI (categories)
CREATE POLICY "Kullanıcılar kendi mağazalarındaki kategorileri görebilir (Select)" ON public.categories 
  FOR SELECT USING ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar kendi mağazalarındaki kategorileri ekleyebilir (Insert)" ON public.categories 
  FOR INSERT WITH CHECK ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar mağazasındaki kategorileri güncelleyebilir (Update)" ON public.categories 
  FOR UPDATE USING ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar mağazasındaki kategorileri silebilir (Delete)" ON public.categories 
  FOR DELETE USING ( shop_id = public.get_current_shop_id() AND public.is_admin_or_manager() );


-- YENİ STRIKT RLS POLİTİKALARI (products)
CREATE POLICY "Kullanıcılar kendi mağazalarındaki ürünleri görebilir (Select)" ON public.products 
  FOR SELECT USING ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar kendi mağazalarındaki ürünleri ekleyebilir (Insert)" ON public.products 
  FOR INSERT WITH CHECK ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar mağazasındaki ürünleri güncelleyebilir (Update)" ON public.products 
  FOR UPDATE USING ( shop_id = public.get_current_shop_id() )
  WITH CHECK (
    shop_id = public.get_current_shop_id() AND
    (
      -- Eğer is_deleted = true yapılıyorsa (soft delete), ADMIN veya MANAGER olmalı
      (is_deleted IS NOT DISTINCT FROM FALSE) OR 
      (is_deleted = TRUE AND public.is_admin_or_manager())
    )
  );

CREATE POLICY "Kullanıcılar mağazasındaki ürünleri silebilir (Delete)" ON public.products 
  FOR DELETE USING ( shop_id = public.get_current_shop_id() AND public.is_admin_or_manager() );


-- YENİ STRIKT RLS POLİTİKALARI (sales)
CREATE POLICY "Kullanıcılar mağazasındaki satışları görebilir (Select)" ON public.sales 
  FOR SELECT USING ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar mağazasına satış ekleyebilir (Insert)" ON public.sales 
  FOR INSERT WITH CHECK ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar mağazasındaki satışları güncelleyebilir (Update)" ON public.sales 
  FOR UPDATE USING ( shop_id = public.get_current_shop_id() AND public.is_admin_or_manager() );

CREATE POLICY "Kullanıcılar mağazasındaki satışları silebilir (Delete)" ON public.sales 
  FOR DELETE USING ( shop_id = public.get_current_shop_id() AND public.is_admin_or_manager() );


-- 5. RPC FONKSİYONUNU GÜNCELLEME (soft_delete_variant)
CREATE OR REPLACE FUNCTION public.soft_delete_variant(p_variant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Rol Kontrolü
    IF NOT public.is_admin_or_manager() THEN
        RAISE EXCEPTION 'Yetkisiz işlem: Bu işlem için yönetici veya müdür yetkisi gereklidir.';
    END IF;

    UPDATE public.product_variants
    SET is_deleted = true
    WHERE id = p_variant_id;
END;
$$;
