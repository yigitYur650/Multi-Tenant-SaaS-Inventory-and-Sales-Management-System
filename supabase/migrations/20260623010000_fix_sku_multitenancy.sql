-- MIGRATION: SCOPE VARIANT SKU UNIQUENESS PER SHOP/TENANT
-- Drop the global unique SKU index
DROP INDEX IF EXISTS public.product_variants_sku_active_idx;

-- Create a unique SKU index scoped by shop_id and sku
CREATE UNIQUE INDEX product_variants_shop_sku_active_idx ON public.product_variants (shop_id, sku) WHERE (is_deleted = false);
