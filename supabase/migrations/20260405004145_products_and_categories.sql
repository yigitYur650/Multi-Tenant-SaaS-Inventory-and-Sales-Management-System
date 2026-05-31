-- 1. Tabloların Oluşturulması

-- categories tablosu
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
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
  size TEXT,
  color TEXT,
  wholesale_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  retail_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0
);

-- 2. RLS (Row Level Security) Aktifleştirme
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;


-- 3. RLS Politikalarının Tanımlanması

-- categories tablosu politikaları
CREATE POLICY "Kullanıcılar kendi mağazalarındaki kategorileri görebilir (Select)" 
ON public.categories FOR SELECT 
USING ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar kendi mağazalarındaki kategorileri ekleyebilir (Insert)" 
ON public.categories FOR INSERT 
WITH CHECK ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar mağazasındaki kategorileri güncelleyebilir (Update)" 
ON public.categories FOR UPDATE 
USING ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar mağazasındaki kategorileri silebilir (Delete)" 
ON public.categories FOR DELETE 
USING ( shop_id = public.get_current_shop_id() );


-- products tablosu politikaları
CREATE POLICY "Kullanıcılar kendi mağazalarındaki ürünleri görebilir (Select)" 
ON public.products FOR SELECT 
USING ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar kendi mağazalarındaki ürünleri ekleyebilir (Insert)" 
ON public.products FOR INSERT 
WITH CHECK ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar mağazasındaki ürünleri güncelleyebilir (Update)" 
ON public.products FOR UPDATE 
USING ( shop_id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar mağazasındaki ürünleri silebilir (Delete)" 
ON public.products FOR DELETE 
USING ( shop_id = public.get_current_shop_id() );


-- product_variants tablosu politikaları
-- Variants tablosunda shop_id olmadığı için, products tablosunu JOIN (EXISTS) ile kontrol ediyoruz.
CREATE POLICY "Kullanıcılar kendi mağazalarındaki varyantları görebilir (Select)" 
ON public.product_variants FOR SELECT 
USING ( EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_variants.product_id 
    AND p.shop_id = public.get_current_shop_id()
) );

CREATE POLICY "Kullanıcılar kendi mağazalarındaki varyantları ekleyebilir (Insert)" 
ON public.product_variants FOR INSERT 
WITH CHECK ( EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_variants.product_id 
    AND p.shop_id = public.get_current_shop_id()
) );

CREATE POLICY "Kullanıcılar mağazasındaki varyantları güncelleyebilir (Update)" 
ON public.product_variants FOR UPDATE 
USING ( EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_variants.product_id 
    AND p.shop_id = public.get_current_shop_id()
) );

CREATE POLICY "Kullanıcılar mağazasındaki varyantları silebilir (Delete)" 
ON public.product_variants FOR DELETE 
USING ( EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_variants.product_id 
    AND p.shop_id = public.get_current_shop_id()
) );
