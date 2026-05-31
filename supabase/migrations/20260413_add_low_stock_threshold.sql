-- =========================================================================
-- ADD LOW_STOCK_THRESHOLD TO PRODUCT_VARIANTS
-- =========================================================================

ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10;

-- Bu kolonun analytics ve dashboard tarafında kullanılabilmesi için yorum ekliyoruz
COMMENT ON COLUMN public.product_variants.low_stock_threshold IS 'Kritik stok seviyesi uyarısı için eşik değer.';
