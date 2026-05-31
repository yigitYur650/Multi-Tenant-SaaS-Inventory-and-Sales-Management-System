-- 1. Günlük Ciro ve Kar Özeti
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

-- 2. En Çok Satan Varyantlar
CREATE OR REPLACE VIEW public.top_selling_variants AS
SELECT
    s.shop_id,
    pv.id AS variant_id,
    p.name AS product_name,
    pv.color,
    pv.size,
    SUM(si.quantity) AS total_quantity_sold,
    SUM(si.total_price - (pv.wholesale_price * si.quantity)) AS total_profit
FROM public.sales s
JOIN public.sale_items si ON s.id = si.sale_id
JOIN public.product_variants pv ON si.variant_id = pv.id
JOIN public.products p ON pv.product_id = p.id
WHERE s.status = 'completed' AND s.shop_id = public.get_current_shop_id()
GROUP BY s.shop_id, pv.id, p.name, pv.color, pv.size;

-- 3. Düşük Stok Alarmları (Dashboard Eşiği: 10 adet)
CREATE OR REPLACE VIEW public.low_stock_alerts AS
SELECT
    p.shop_id,
    pv.id AS variant_id,
    p.name AS product_name,
    pv.color,
    pv.size,
    pv.stock_quantity
FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
WHERE pv.stock_quantity < 10 AND p.shop_id = public.get_current_shop_id();
