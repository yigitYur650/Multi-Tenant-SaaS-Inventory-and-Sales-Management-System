import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { createTestI18n } from '../../test/i18nTestHelper';
import { LanguageSwitcher } from '../LanguageSwitcher';

// ---------------------------------------------------------------------------
// Mock: @radix-ui/react-select — Radix Portal ve pointer capture API'leri
// jsdom'da bulunmuyor. Tamamen hafif bir native <select> ile değiştiriyoruz.
// Bu sayede Select etkileşim testlerini jsdom'da güvenle çalıştırabiliyoruz.
// ---------------------------------------------------------------------------
vi.mock('../../components/ui/Select', () => ({
  Select: ({
    value,
    onValueChange,
    items,
    placeholder,
    className,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    items: { value: string; label: string }[];
    placeholder?: string;
    className?: string;
  }) => (
    <select
      data-testid="language-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      aria-label={placeholder}
      className={className}
    >
      {items.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderWithI18n(lng = 'tr') {
  const i18n = createTestI18n(lng);
  return {
    i18n,
    ...render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>
    ),
  };
}

// ---------------------------------------------------------------------------
// HAPPY PATH TESTLERİ
// ---------------------------------------------------------------------------
describe('LanguageSwitcher — Happy Path', () => {
  it('LS-HP-01: varsayılan dil olarak Türkçe seçili gösterilir', () => {
    renderWithI18n('tr');
    const select = screen.getByTestId('language-select') as HTMLSelectElement;
    expect(select.value).toBe('tr');
  });

  it('LS-HP-02: İngilizce seçiliyken doğru değer gösterilir', () => {
    renderWithI18n('en');
    const select = screen.getByTestId('language-select') as HTMLSelectElement;
    expect(select.value).toBe('en');
  });

  it('LS-HP-03: select elementi render edilir ve etkileşime açıktır', () => {
    renderWithI18n('tr');
    const select = screen.getByTestId('language-select');
    expect(select).toBeInTheDocument();
    expect(select).not.toBeDisabled();
  });

  it('LS-HP-04: 7 dil seçeneğinin tamamı listelenir', () => {
    renderWithI18n('tr');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(7);

    const expectedFlags = ['🇹🇷', '🇺🇸', '🇩🇪', '🇪🇸', '🇫🇷', '🇯🇵', '🇮🇹'];
    expectedFlags.forEach((flag) => {
      expect(screen.getByText(new RegExp(flag))).toBeInTheDocument();
    });
  });

  it('LS-HP-05: dil seçildiğinde aktif dil değişir', async () => {
    const user = userEvent.setup();
    const { i18n } = renderWithI18n('tr');

    // Başlangıçta Türkçe
    expect(i18n.language).toBe('tr');

    const select = screen.getByTestId('language-select');
    await user.selectOptions(select, 'en');

    // onValueChange → handleChange → i18n.changeLanguage('en')
    // i18n instance'ının dilinin değişmiş olması gerekir
    expect(i18n.language).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// EDGE CASE / UÇ DURUM TESTLERİ
// ---------------------------------------------------------------------------
describe('LanguageSwitcher — Edge Cases', () => {
  it('LS-EC-01: bilinmeyen dil kodu (zh) olduğunda fallback olarak Türkçe gösterilir', () => {
    const i18n = createTestI18n('en');
    Object.defineProperty(i18n, 'language', { value: 'zh', writable: true });

    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>
    );

    // Bilinmeyen dil kodu: languages.find() undefined döner → || languages[0] → 'tr'
    const select = screen.getByTestId('language-select') as HTMLSelectElement;
    expect(select.value).toBe('tr');
  });

  it('LS-EC-02: i18n.language undefined olduğunda bileşen çökmez', () => {
    const i18n = createTestI18n('en');
    Object.defineProperty(i18n, 'language', { value: undefined, writable: true });

    expect(() => {
      render(
        <I18nextProvider i18n={i18n}>
          <LanguageSwitcher />
        </I18nextProvider>
      );
    }).not.toThrow();

    // Fallback: languages[0] = 'tr'
    const select = screen.getByTestId('language-select') as HTMLSelectElement;
    expect(select.value).toBe('tr');
  });

  it('LS-EC-03: her option benzersiz bir value değerine sahiptir (veri bütünlüğü)', () => {
    renderWithI18n('tr');
    const options = screen.getAllByRole('option') as HTMLOptionElement[];
    const values = options.map((opt) => opt.value);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('LS-EC-04: bileşen birden fazla kez mount/unmount edildiğinde hata üretmez', () => {
    const { unmount } = renderWithI18n('tr');
    unmount();

    const { unmount: unmount2 } = renderWithI18n('en');
    unmount2();

    const { unmount: unmount3 } = renderWithI18n('de');
    expect(screen.getByTestId('language-select')).toBeInTheDocument();
    unmount3();
  });

  it('LS-EC-05: placeholder olarak i18n çeviri anahtarı kullanılır', () => {
    renderWithI18n('tr');
    const select = screen.getByTestId('language-select');
    // aria-label olarak t('layout.switcher.title') = 'Dili Değiştir' atanır
    expect(select).toHaveAttribute('aria-label', 'Dili Değiştir');
  });
});
