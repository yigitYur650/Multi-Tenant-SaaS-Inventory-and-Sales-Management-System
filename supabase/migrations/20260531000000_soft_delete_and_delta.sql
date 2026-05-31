-- Add is_deleted column to categories, products, and product_variants
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Add check constraint to ensure stock_quantity is non-negative
ALTER TABLE public.product_variants ADD CONSTRAINT chk_stock_quantity_non_negative CHECK (stock_quantity >= 0);

-- Drop the protection trigger that prevents direct updates to stock_quantity
DROP TRIGGER IF EXISTS tr_protect_stock_quantity ON public.product_variants;

-- Create or replace RPC function for soft deleting variants
CREATE OR REPLACE FUNCTION public.soft_delete_variant(p_variant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.product_variants
    SET is_deleted = true
    WHERE id = p_variant_id;
END;
$$;

-- Create or replace RPC function for relative stock updates via delta
CREATE OR REPLACE FUNCTION public.update_variant_stock_delta(p_variant_id UUID, p_delta INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.product_variants
    SET stock_quantity = stock_quantity + p_delta
    WHERE id = p_variant_id;
END;
$$;

-- Create failed_syncs table if not exists, and add correlation_id
CREATE TABLE IF NOT EXISTS public.failed_syncs (
    id SERIAL PRIMARY KEY,
    payload JSONB NOT NULL,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    correlation_id VARCHAR(255)
);

ALTER TABLE public.failed_syncs ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);
