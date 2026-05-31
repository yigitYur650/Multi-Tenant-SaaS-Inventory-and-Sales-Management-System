-- 1. Tabloların Oluşturulması

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

-- 2. RLS (Row Level Security) Aktifleştirme
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Yetkilendirme Fonksiyonları
-- Profil sorgularında "infinite recursion" (sonsuz döngü) olmaması için Security Definer kullandık.
CREATE OR REPLACE FUNCTION public.get_current_shop_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid();
$$;


-- 4. RLS Politikalarının Tanımlanması

-- shops tablosu politikaları
-- Her kullanıcı sadece kendi mağazasını görebilir ve üzerinde işlem yapabilir
CREATE POLICY "Kullanıcılar kendi mağazalarını görebilir (Select)" 
ON public.shops FOR SELECT 
USING ( id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar kendi mağazalarını güncelleyebilir (Update)" 
ON public.shops FOR UPDATE 
USING ( id = public.get_current_shop_id() );

CREATE POLICY "Kullanıcılar kendi mağazalarını silebilir (Delete)" 
ON public.shops FOR DELETE 
USING ( id = public.get_current_shop_id() );


-- profiles tablosu politikaları
-- Sorguyu yapan kişi kendi profili ise VEYA aynı şirket altındalar ise okuyabilir
CREATE POLICY "Kullanıcılar kendi mağazalarındaki profilleri görebilir (Select)" 
ON public.profiles FOR SELECT 
USING ( shop_id = public.get_current_shop_id() OR id = auth.uid() );

-- Sadece kendi profillerini (veya hook'lar ile) insert edebilirler
CREATE POLICY "Kullanıcılar kendi profillerini ekleyebilir (Insert)" 
ON public.profiles FOR INSERT 
WITH CHECK ( id = auth.uid() );

-- Kişi kendi profilini VEYA aynı mağazaya sahip (örn: patronlar vs.) kişiyi güncelleyebilir
-- Detaylı role check mantığı eklenebilir, şu an sadece mağaza eşleşmesi baz alınıyor
CREATE POLICY "Kullanıcılar mağazasındaki profilleri güncelleyebilir (Update)" 
ON public.profiles FOR UPDATE 
USING ( shop_id = public.get_current_shop_id() OR id = auth.uid() );

CREATE POLICY "Kullanıcılar mağazasındaki profilleri silebilir (Delete)" 
ON public.profiles FOR DELETE 
USING ( shop_id = public.get_current_shop_id() OR id = auth.uid() );
