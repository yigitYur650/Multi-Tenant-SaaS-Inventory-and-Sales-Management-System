-- =========================================================================
-- MIGRATION: FIX STAFF PROFILE CREATION RLS AND SOFT DELETE UNIQUE INDEXES
-- =========================================================================

-- 1. Create create_staff_profile RPC function (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.create_staff_profile(
    p_user_id UUID,
    p_shop_id UUID,
    p_role INTEGER,
    p_full_name TEXT,
    p_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Rol Kontrolü: Yalnızca müdür (2) veya patron (3) personel oluşturabilir.
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN (2, 3)
    ) THEN
        RAISE EXCEPTION 'Yetkisiz işlem: Yalnızca müdürler veya patronlar personel ekleyebilir.';
    END IF;

    -- Mağaza İzolasyon Kontrolü: Ekleyen kişinin mağazası ile hedef mağaza aynı olmalıdır.
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND shop_id = p_shop_id
    ) THEN
        RAISE EXCEPTION 'Yetkisiz işlem: Yalnızca kendi mağazanıza personel ekleyebilirsiniz.';
    END IF;

    INSERT INTO public.profiles (id, shop_id, role, full_name, email)
    VALUES (p_user_id, p_shop_id, p_role, p_full_name, p_email);
END;
$$;

-- 2. Create register_tenant RPC function (if not exists / rebuild for consistency)
CREATE OR REPLACE FUNCTION public.register_tenant(
    p_shop_name TEXT,
    p_full_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shop_id UUID;
BEGIN
    -- 1. Mağaza Oluştur
    INSERT INTO public.shops (name, type)
    VALUES (p_shop_name, 'RETAIL')
    RETURNING id INTO v_shop_id;

    -- 2. Profil Oluştur
    INSERT INTO public.profiles (id, shop_id, role, full_name, email)
    VALUES (
        auth.uid(), 
        v_shop_id, 
        3, 
        p_full_name, 
        (SELECT email FROM auth.users WHERE id = auth.uid())
    );
END;
$$;

-- 3. Adjust product_variants unique constraints to be partial indexes (excluding soft-deleted rows)
-- Drop potential existing unique constraints/indexes to prevent conflicts
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_sku_key;
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_product_id_color_id_size_id_key;
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS unique_sku;
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS unique_variant_combination;

DROP INDEX IF EXISTS public.product_variants_sku_idx;
DROP INDEX IF EXISTS public.product_variants_comb_idx;
DROP INDEX IF EXISTS public.product_variants_sku_active_idx;
DROP INDEX IF EXISTS public.product_variants_comb_active_idx;

-- Create partial unique indexes (ensuring uniqueness only among active variants)
CREATE UNIQUE INDEX product_variants_sku_active_idx ON public.product_variants (sku) WHERE (is_deleted = false);
CREATE UNIQUE INDEX product_variants_comb_active_idx ON public.product_variants (product_id, color_id, size_id) WHERE (is_deleted = false);
