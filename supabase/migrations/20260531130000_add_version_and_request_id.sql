-- Add version and request_id columns to public.sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS request_id VARCHAR(255);

-- Add version and request_id columns to public.stock_movements
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS request_id VARCHAR(255);
