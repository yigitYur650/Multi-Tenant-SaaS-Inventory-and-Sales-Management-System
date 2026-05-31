import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const TEST_EMAIL = process.env.E2E_USER_EMAIL || '';
const TEST_PASSWORD = process.env.E2E_USER_PASSWORD || '';

test('debug: login ve inventory sayfası durumu', async ({ page }) => {
  // Login
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  
  await page.waitForTimeout(5000);
  
  console.log('🔍 Login sonrası URL:', page.url());
  await page.screenshot({ path: 'e2e/debug-after-login.png' });
  
  // Inventory'e git
  await page.goto('/inventory', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  
  console.log('🔍 Inventory URL:', page.url());
  
  // Sayfadaki tüm butonları listele
  const buttons = await page.locator('button').allTextContents();
  console.log('🔍 Sayfadaki butonlar:', JSON.stringify(buttons));
  
  // H1 başlığını kontrol et
  const h1 = await page.locator('h1').allTextContents();
  console.log('🔍 H1 başlıkları:', JSON.stringify(h1));
  
  await page.screenshot({ path: 'e2e/debug-inventory.png' });
});
