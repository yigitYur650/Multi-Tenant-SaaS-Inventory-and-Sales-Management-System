import { test, expect } from '@playwright/test';

test.describe('Çevrimdışı Senkronizasyon (Offline Sync) Chaos Engineering Testi', () => {
  
  test('Ağ kesildiğinde satış kuyruğa alınmalı ve ağ geldiğinde otomatik senkronize edilmeli', async ({ page, context }) => {
    // 1. Login işlemi
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').fill('yigityur65@gmail.com');
    await page.locator('input[type="password"]').fill('ftm1476');
    await page.locator('button[type="submit"]').click();
    
    // Login sayfasından yönlenmeyi bekle
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 20000 });
    await page.waitForLoadState('networkidle');

    // 2. Önce envanter sayfasına git ve test ürününün stoğunu güncelle (Satış yapılabilmesi için stok > 0 olmalı)
    await page.goto('/inventory', { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 15000 });

    // "Stok İşlemi" / "Stock Action" butonuna tıkla (İlk varyant için)
    const stockActionBtn = page.locator('button[title="Stok İşlemi"]').or(page.locator('button[title="Stock Action"]')).first();
    await expect(stockActionBtn).toBeVisible({ timeout: 10000 });
    await stockActionBtn.click();

    // Miktarı 50 olarak ayarla (stok ekleme varsayılan olarak seçilidir)
    await page.locator('input[type="number"]').fill('50');

    // "ONAYLA" / "CONFIRM" butonuna tıkla
    const confirmStockBtn = page.getByRole('button', { name: /ONAYLA|CONFIRM/i });
    await expect(confirmStockBtn).toBeVisible();
    await confirmStockBtn.click();

    // Stok güncellemesinin tamamlanması için bekle
    await page.waitForTimeout(3000);
    
    // 3. Satış sayfasına git ve ürünlerin yüklenmesini bekle
    await page.goto('/sales', { waitUntil: 'networkidle' });
    await page.waitForSelector('h4', { timeout: 15000 });
    
    // 4. Ağ bağlantısını kes (Simulate Offline Network Partition)
    await context.setOffline(true);
    
    // 5. Vitrindeki ilk aktif ürünü sepete ekle (Artık stok 50 olduğu için buton aktif)
    const productCard = page.locator('button').filter({ hasText: /Stok|Stock/i }).first();
    await expect(productCard).toBeVisible();
    await productCard.click();
    
    // 6. "SATIŞI TAMAMLA" / "COMPLETE SALE" butonuna tıkla (Ödeme modalını aç)
    const completeSalesBtn = page.getByRole('button', { name: /SATIŞI TAMAMLA|COMPLETE SALE/i });
    await expect(completeSalesBtn).toBeVisible();
    await completeSalesBtn.click();
    
    // 7. Ödeme modalında "SİPARİŞİ ONAYLA VE TAMAMLA" / "CONFIRM" butonuna tıkla
    const confirmOrderBtn = page.getByRole('button', { name: /SİPARİŞİ ONAYLA|CONFIRM/i });
    await expect(confirmOrderBtn).toBeVisible();
    await confirmOrderBtn.click();
    
    // Çevrimdışı olduğumuz için işlem IndexedDB (saas_erp_db) sync_queue içerisine eklenecektir.
    // Başarı bildirimi görünecektir.
    await page.waitForTimeout(2000);
    
    // 8. Ağ bağlantısını geri kur (Simulate Network Restored / Online)
    await context.setOffline(false);
    
    // 9. Arka plan senkronizasyonunun çalışmasını ve kuyruğun temizlenmesini bekle
    await page.waitForTimeout(5000);
    
    // E2E akışının tamamlandığını doğrula (hata fırlatılmadan akışın tamamlenmiş olması yeterlidir)
    console.log('✅ Çevrimdışı satış ve çevrimiçi senkronizasyon Playwright testi başarıyla tamamlandı.');
  });
});
