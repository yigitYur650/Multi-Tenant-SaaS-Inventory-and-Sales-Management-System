-- 1. stock_movements Tablosu ve Enum
CREATE TYPE movement_type AS ENUM ('IN', 'OUT', 'WASTE', 'RETURN');

CREATE TABLE public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    type movement_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. RLS (Row Level Security) Aktifleştirme
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcılar kendi mağazalarındaki stok hareketlerini görebilir (Select)" 
ON public.stock_movements FOR SELECT 
USING ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar kendi mağazalarına stok hareketi ekleyebilir (Insert)" 
ON public.stock_movements FOR INSERT 
WITH CHECK ( shop_id = public.get_current_shop_id() );


-- 3. Trigger & Function: Stok Güncelleme Otomasyonu
CREATE OR REPLACE FUNCTION public.update_stock_from_movement()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.type IN ('IN', 'RETURN') THEN
        UPDATE public.product_variants
        SET stock_quantity = stock_quantity + NEW.quantity
        WHERE id = NEW.variant_id;
    ELSIF NEW.type IN ('OUT', 'WASTE') THEN
        UPDATE public.product_variants
        SET stock_quantity = stock_quantity - NEW.quantity
        WHERE id = NEW.variant_id;
    END IF;
    RETURN NEW;
END;
$$;

-- AFTER INSERT yapıyoruz çünkü veritabanına eklendiğinden emin olmalıyız.
CREATE TRIGGER tr_update_stock_after_movement
AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.update_stock_from_movement();


-- 4. Koruma Mekanizması: Doğrudan stock_quantity güncellenmesini engelleme
CREATE OR REPLACE FUNCTION public.protect_stock_quantity_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Eğer stock_quantity alanında bir değişiklik varsa:
    IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
        -- pg_trigger_depth() = 1 ise işlem doğrudan bir SQL veya Client update komutuyla tetiklenmiş demektir.
        -- Eğer depth > 1 ise, "update_stock_from_movement" trigger'ı üzerinden (yani stock_movements) gelmektedir.
        IF pg_trigger_depth() = 1 THEN
            RAISE EXCEPTION 'stock_quantity kolonuna doğrudan müdahale edilemez. Lütfen stock_movements tablosunu kullanın.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_protect_stock_quantity
BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.protect_stock_quantity_update();
