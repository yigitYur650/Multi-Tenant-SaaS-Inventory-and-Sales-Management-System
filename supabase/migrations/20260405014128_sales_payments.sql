-- 1. Enum Tipler
CREATE TYPE sale_status AS ENUM ('completed', 'cancelled');
CREATE TYPE payment_type AS ENUM ('CASH', 'CARD', 'DEBT');

-- 2. Tabloların Oluşturulması
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID, -- Eğer ileride customers tablosu açılırsa buraya bağlanacak
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status sale_status NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    type payment_type NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. RLS (Row Level Security) Aktifleştirme
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Politikalarının Tanımlanması
-- Sales
CREATE POLICY "Kullanıcılar mağazasındaki satışları görebilir (Select)" ON public.sales FOR SELECT USING ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar mağazasına satış ekleyebilir (Insert)" ON public.sales FOR INSERT WITH CHECK ( shop_id = public.get_current_shop_id() );

-- Sale Items
CREATE POLICY "Kullanıcılar satış kalemlerini görebilir (Select)" ON public.sale_items FOR SELECT USING ( EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.shop_id = public.get_current_shop_id()) );
CREATE POLICY "Kullanıcılar satış kalemi ekleyebilir (Insert)" ON public.sale_items FOR INSERT WITH CHECK ( EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.shop_id = public.get_current_shop_id()) );

-- Payments
CREATE POLICY "Kullanıcılar ödemeleri görebilir (Select)" ON public.payments FOR SELECT USING ( EXISTS (SELECT 1 FROM public.sales s WHERE s.id = payments.sale_id AND s.shop_id = public.get_current_shop_id()) );
CREATE POLICY "Kullanıcılar ödeme ekleyebilir (Insert)" ON public.payments FOR INSERT WITH CHECK ( EXISTS (SELECT 1 FROM public.sales s WHERE s.id = payments.sale_id AND s.shop_id = public.get_current_shop_id()) );

-- 5. Trigger & Function: Satış kaleminden stok otomatik düşme otomasyonu
CREATE OR REPLACE FUNCTION public.after_sale_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Satış kalemindeki veriye göre stock_movements tablosuna "OUT" hareketi atar
    -- O tabloya eklenen bu kayıt da otomatik olarak stock_quantity değerini düşürecektir.
    INSERT INTO public.stock_movements (id, variant_id, shop_id, type, quantity, reason, created_at)
    VALUES (
        gen_random_uuid(),
        NEW.variant_id,
        (SELECT shop_id FROM public.sales WHERE id = NEW.sale_id),
        'OUT',
        NEW.quantity,
        'Satış: ' || NEW.sale_id,
        now()
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_after_sale_item_insert
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.after_sale_item_insert();

-- 6. RPC Function (Atomik İşlem İçin REST API Desteği)
CREATE OR REPLACE FUNCTION public.process_sale(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_id uuid;
    v_shop_id uuid;
    v_item jsonb;
    v_payment jsonb;
BEGIN
    v_shop_id := public.get_current_shop_id();

    -- Satışı Oluştur
    INSERT INTO public.sales (id, shop_id, customer_id, total_amount, discount_amount, status, created_at)
    VALUES (
        COALESCE((payload->>'id')::uuid, gen_random_uuid()),
        v_shop_id,
        (payload->>'customer_id')::uuid,
        (payload->>'total_amount')::numeric,
        (payload->>'discount_amount')::numeric,
        COALESCE((payload->>'status')::sale_status, 'completed'),
        COALESCE((payload->>'created_at')::timestamp with time zone, now())
    ) RETURNING id INTO v_sale_id;

    -- Kalemleri Ekle
    FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
    LOOP
        INSERT INTO public.sale_items (id, sale_id, variant_id, quantity, unit_price, total_price)
        VALUES (
            COALESCE((v_item->>'id')::uuid, gen_random_uuid()),
            v_sale_id,
            (v_item->>'variant_id')::uuid,
            (v_item->>'quantity')::int,
            (v_item->>'unit_price')::numeric,
            (v_item->>'total_price')::numeric
        );
    END LOOP;

    -- Ödemeleri Ekle
    FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
    LOOP
        INSERT INTO public.payments (id, sale_id, type, amount, created_at)
        VALUES (
            COALESCE((v_payment->>'id')::uuid, gen_random_uuid()),
            v_sale_id,
            (v_payment->>'type')::payment_type,
            (v_payment->>'amount')::numeric,
            COALESCE((v_payment->>'created_at')::timestamp with time zone, now())
        );
    END LOOP;

    RETURN v_sale_id;
END;
$$;
