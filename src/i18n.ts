import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Dil dosyaları
import tr from './locales/tr.json';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import it from './locales/it.json';

i18n
  .use(LanguageDetector) // Tarayıcı dilini algıla
  .use(initReactI18next) // react-i18next entegrasyonu
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
      de: { translation: de },
      es: { translation: es },
      fr: { translation: fr },
      ja: { translation: ja },
      it: { translation: it }
    },
    fallbackLng: 'en', // Dil bulunamazsa varsayılan dil
    debug: false,
    interpolation: {
      escapeValue: false // React XSS'e karşı korumalı olduğu için false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'] // Seçilen dili hafızada tut
    }
  });

export default i18n;
