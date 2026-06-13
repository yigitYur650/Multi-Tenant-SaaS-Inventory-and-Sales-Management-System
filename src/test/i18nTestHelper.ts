/**
 * Test ortamında kullanılacak minimal i18n instance.
 * Gerçek locale JSON'larını yükler, böylece çeviri anahtarları testlerde doğrulanabilir.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tr from '../locales/tr.json';
import en from '../locales/en.json';

export function createTestI18n(lng = 'tr') {
  const instance = i18n.createInstance();
  instance.use(initReactI18next).init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  return instance;
}
