import { Profile } from '../context/AuthContext';

export interface ShopSettings {
  currencyCode: string;
  timezone: string;
  locale: string;
}

export function getShopSettings(profile: Profile | null): ShopSettings {
  const shop = profile?.shops;
  return {
    currencyCode: shop?.currency_code || 'TRY',
    timezone: shop?.timezone || 'Europe/Istanbul',
    locale: shop?.locale || 'tr-TR',
  };
}

export function formatCurrency(
  amount: number | string | undefined | null,
  profile: Profile | null
): string {
  if (amount === undefined || amount === null) return '';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '';
  const { currencyCode, locale } = getShopSettings(profile);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(num);
  } catch (e) {
    console.error("Format Currency Error:", e);
    return `${num.toLocaleString(locale || 'tr-TR')} ${currencyCode}`;
  }
}

export function formatDate(
  date: string | Date | undefined | null,
  profile: Profile | null,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const { timezone, locale } = getShopSettings(profile);
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    }).format(d);
  } catch (e) {
    console.error("Format Date Error:", e);
    return d.toLocaleString();
  }
}

export function formatDateOnly(
  date: string | Date | undefined | null,
  profile: Profile | null,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return formatDate(date, profile, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: undefined,
    minute: undefined,
    second: undefined,
    ...options
  });
}
