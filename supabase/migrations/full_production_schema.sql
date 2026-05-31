-- =========================================================================
-- SAAS TEXTILE ERP - FULL PRODUCTION SCHEMA
-- =========================================================================

-- 1. ENUM TİPLER
CREATE TYPE movement_type AS ENUM ('IN', 'OUT', 'WASTE', 'RETURN');
CREATE TYPE sale_status AS ENUM ('completed', 'cancelled');
CREATE TYPE payment_type AS ENUM ('CASH', 'CARD', 'DEBT');


-- 2. TABLOLARIN OLUŞTURULMASI

-- shops tablosu
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- profiles tablosu
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role SMALLINT NOT NULL CHECK (role IN (1, 2, 3)), -- 1: Çalışan, 2: Müdür, 3: Patron
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- categories tablosu
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE
);

-- colors tablosu [NEW]
CREATE TABLE public.colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  hex_code TEXT,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE
);

-- sizes tablosu [NEW]
CREATE TABLE public.sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE
);

-- products tablosu
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- product_variants tablosu
CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT,
  size_id UUID REFERENCES public.sizes(id) ON DELETE RESTRICT,
  color_id UUID REFERENCES public.colors(id) ON DELETE RESTRICT,
  wholesale_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  retail_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0
);

-- stock_movements tablosu
CREATE TABLE public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    type movement_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- sales tablosu
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID, 
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status sale_status NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- sale_items tablosu
CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL
);

-- payments tablosu
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    type payment_type NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- 3. YETKİLENDİRME FONKSİYONLARI
CREATE OR REPLACE FUNCTION public.get_current_shop_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid();
$$;


-- 4. RLS (ROW LEVEL SECURITY) AKTİFLEŞTİRME
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;


-- 5. RLS POLİTİKALARI

-- shops
CREATE POLICY "Kullanıcılar kendi mağazalarını görebilir (Select)" ON public.shops FOR SELECT USING ( id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar kendi mağazalarını güncelleyebilir (Update)" ON public.shops FOR UPDATE USING ( id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar kendi mağazalarını silebilir (Delete)" ON public.shops FOR DELETE USING ( id = public.get_current_shop_id() );

-- profiles
CREATE POLICY "Kullanıcılar kendi mağazalarındaki profilleri görebilir (Select)" ON public.profiles FOR SELECT USING ( shop_id = public.get_current_shop_id() OR id = auth.uid() );
CREATE POLICY "Kullanıcılar kendi profillerini ekleyebilir (Insert)" ON public.profiles FOR INSERT WITH CHECK ( id = auth.uid() );
CREATE POLICY "Kullanıcılar mağazasındaki profilleri güncelleyebilir (Update)" ON public.profiles FOR UPDATE USING ( shop_id = public.get_current_shop_id() OR id = auth.uid() );
CREATE POLICY "Kullanıcılar mağazasındaki profilleri silebilir (Delete)" ON public.profiles FOR DELETE USING ( shop_id = public.get_current_shop_id() OR id = auth.uid() );

-- categories
CREATE POLICY "Kullanıcılar kendi mağazalarındaki kategorileri görebilir (Select)" ON public.categories FOR SELECT USING ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar kendi mağazalarındaki kategorileri ekleyebilir (Insert)" ON public.categories FOR INSERT WITH CHECK ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar mağazasındaki kategorileri güncelleyebilir (Update)" ON public.categories FOR UPDATE USING ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar mağazasındaki kategorileri silebilir (Delete)" ON public.categories FOR DELETE USING ( shop_id = public.get_current_shop_id() );

-- colors [NEW]
CREATE POLICY "Kullanıcılar kendi mağazalarındaki renkleri görebilir (Select)" ON public.colors FOR SELECT USING ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar kendi mağazalarındaki renkleri ekleyebilir (Insert)" ON public.colors FOR INSERT WITH CHECK ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar mağazasındaki renkleri güncelleyebilir (Update)" ON public.colors FOR UPDATE USING ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar mağazasındaki renkleri silebilir (Delete)" ON public.colors FOR DELETE USING ( shop_id = public.get_current_shop_id() );

-- sizes [NEW]
CREATE POLICY "Kullanıcılar kendi mağazalarındaki bedenleri görebilir (Select)" ON public.sizes FOR SELECT USING ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar kendi mağazalarındaki bedenleri ekleyebilir (Insert)" ON public.sizes FOR INSERT WITH CHECK ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar mağazasındaki bedenleri güncelleyebilir (Update)" ON public.sizes FOR UPDATE USING ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar mağazasındaki bedenleri silebilir (Delete)" ON public.sizes FOR DELETE USING ( shop_id = public.get_current_shop_id() );

-- products
CREATE POLICY "Kullanıcılar kendi mağazalarındaki ürünleri görebilir (Select)" ON public.products FOR SELECT USING ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar kendi mağazalarındaki ürünleri ekleyebilir (Insert)" ON public.products FOR INSERT WITH CHECK ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar mağazasındaki ürünleri güncelleyebilir (Update)" ON public.products FOR UPDATE USING ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar mağazasındaki ürünleri silebilir (Delete)" ON public.products FOR DELETE USING ( shop_id = public.get_current_shop_id() );

-- product_variants
CREATE POLICY "Kullanıcılar kendi mağazalarındaki varyantları görebilir (Select)" ON public.product_variants FOR SELECT USING ( EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.shop_id = public.get_current_shop_id()) );
CREATE POLICY "Kullanıcılar kendi mağazalarındaki varyantları ekleyebilir (Insert)" ON public.product_variants FOR INSERT WITH CHECK ( EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.shop_id = public.get_current_shop_id()) );
CREATE POLICY "Kullanıcılar mağazasındaki varyantları güncelleyebilir (Update)" ON public.product_variants FOR UPDATE USING ( EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.shop_id = public.get_current_shop_id()) );
CREATE POLICY "Kullanıcılar mağazasındaki varyantları silebilir (Delete)" ON public.product_variants FOR DELETE USING ( EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.shop_id = public.get_current_shop_id()) );

-- stock_movements
CREATE POLICY "Kullanıcılar kendi mağazalarındaki stok hareketlerini görebilir (Select)" ON public.stock_movements FOR SELECT USING ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar kendi mağazalarına stok hareketi ekleyebilir (Insert)" ON public.stock_movements FOR INSERT WITH CHECK ( shop_id = public.get_current_shop_id() );

-- sales
CREATE POLICY "Kullanıcılar mağazasındaki satışları görebilir (Select)" ON public.sales FOR SELECT USING ( shop_id = public.get_current_shop_id() );
CREATE POLICY "Kullanıcılar mağazasına satış ekleyebilir (Insert)" ON public.sales FOR INSERT WITH CHECK ( shop_id = public.get_current_shop_id() );

-- sale_items
CREATE POLICY "Kullanıcılar satış kalemlerini görebilir (Select)" ON public.sale_items FOR SELECT USING ( EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.shop_id = public.get_current_shop_id()) );
CREATE POLICY "Kullanıcılar satış kalemi ekleyebilir (Insert)" ON public.sale_items FOR INSERT WITH CHECK ( EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.shop_id = public.get_current_shop_id()) );

-- payments
CREATE POLICY "Kullanıcılar ödemeleri görebilir (Select)" ON public.payments FOR SELECT USING ( EXISTS (SELECT 1 FROM public.sales s WHERE s.id = payments.sale_id AND s.shop_id = public.get_current_shop_id()) );
CREATE POLICY "Kullanıcılar ödeme ekleyebilir (Insert)" ON public.payments FOR INSERT WITH CHECK ( EXISTS (SELECT 1 FROM public.sales s WHERE s.id = payments.sale_id AND s.shop_id = public.get_current_shop_id()) );


-- 6. TRIGGER & FONKSİYONLAR

-- update_stock_from_movement
CREATE OR REPLACE FUNCTION public.update_stock_from_movement()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.type IN ('IN', 'RETURN') THEN
        UPDATE public.product_variants SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.variant_id;
    ELSIF NEW.type IN ('OUT', 'WASTE') THEN
        UPDATE public.product_variants SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.variant_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_update_stock_after_movement
AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.update_stock_from_movement();

-- protect_stock_quantity_update
CREATE OR REPLACE FUNCTION public.protect_stock_quantity_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
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

-- after_sale_item_insert
CREATE OR REPLACE FUNCTION public.after_sale_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

-- process_sale RPC
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


-- 7. ANALYTICS VIEWS (Güncellenmiş)
CREATE OR REPLACE VIEW public.daily_sales_summary AS
SELECT
    s.shop_id,
    DATE(s.created_at) AS sale_date,
    SUM(si.total_price) AS total_revenue,
    SUM(si.total_price - (pv.wholesale_price * si.quantity)) AS net_profit,
    COUNT(DISTINCT s.id) AS total_sales
FROM public.sales s
JOIN public.sale_items si ON s.id = si.sale_id
JOIN public.product_variants pv ON si.variant_id = pv.id
WHERE s.status = 'completed' AND s.shop_id = public.get_current_shop_id()
GROUP BY s.shop_id, DATE(s.created_at);

CREATE OR REPLACE VIEW public.top_selling_variants AS
SELECT
    s.shop_id,
    pv.id AS variant_id,
    p.name AS product_name,
    c.name AS color_name,
    sz.name AS size_name,
    SUM(si.quantity) AS total_quantity_sold,
    SUM(si.total_price - (pv.wholesale_price * si.quantity)) AS total_profit
FROM public.sales s
JOIN public.sale_items si ON s.id = si.sale_id
JOIN public.product_variants pv ON si.variant_id = pv.id
JOIN public.products p ON pv.product_id = p.id
LEFT JOIN public.colors c ON pv.color_id = c.id
LEFT JOIN public.sizes sz ON pv.size_id = sz.id
WHERE s.status = 'completed' AND s.shop_id = public.get_current_shop_id()
GROUP BY s.shop_id, pv.id, p.name, c.name, sz.name;

CREATE OR REPLACE VIEW public.low_stock_alerts AS
SELECT
    p.shop_id,
    pv.id AS variant_id,
    p.name AS product_name,
    c.name AS color_name,
    sz.name AS size_name,
    pv.stock_quantity
FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
LEFT JOIN public.colors c ON pv.color_id = c.id
LEFT JOIN public.sizes sz ON pv.size_id = sz.id
WHERE pv.stock_quantity < 10 AND p.shop_id = public.get_current_shop_id();
