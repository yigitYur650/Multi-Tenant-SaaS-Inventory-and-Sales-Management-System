import { describe, it, expect } from 'vitest';
import i18n from '../src/i18n';

describe('i18n Configuration & Fallback Integrity', () => {
  it('should initialize and have fallbackLng set to en', () => {
    const fallbackLng = i18n.options.fallbackLng;
    if (Array.isArray(fallbackLng)) {
      expect(fallbackLng).toContain('en');
    } else if (typeof fallbackLng === 'object' && fallbackLng !== null) {
      expect((fallbackLng as any).default).toContain('en');
    } else {
      expect(fallbackLng).toBe('en');
    }
  });

  it('should fallback to en translations when language is set to an unsupported key', async () => {
    // Switch to a language that is not loaded/supported (e.g. 'zz')
    await i18n.changeLanguage('zz');
    
    // Query a key that exists in 'en' (the fallback language)
    const translation = i18n.t('common.welcome');
    
    // In en.json, "common.welcome" translates to "Welcome"
    expect(translation).toBe('Welcome');
  });

  it('should resolve translations correctly in primary language (tr)', async () => {
    await i18n.changeLanguage('tr');
    const translation = i18n.t('common.welcome');
    expect(translation).toBe('Hoş Geldiniz');
  });

  it('should resolve translations correctly in fallback language (en)', async () => {
    await i18n.changeLanguage('en');
    const translation = i18n.t('common.welcome');
    expect(translation).toBe('Welcome');
  });
});
