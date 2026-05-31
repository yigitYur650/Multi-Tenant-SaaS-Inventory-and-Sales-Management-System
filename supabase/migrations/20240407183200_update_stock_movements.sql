-- stock_movements tablosuna detaylı loglama kolonları ekleme
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS previous_stock INTEGER;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS new_stock INTEGER;

-- Opsiyonel: Mevcut RLS politikaları zaten shop_id bazlı olduğu için yeni kolonlar otomatik kapsam dahilindedir.
