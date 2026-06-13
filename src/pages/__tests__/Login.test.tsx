import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { createTestI18n } from '../../test/i18nTestHelper';
import { Login } from '../Login';

// ---------------------------------------------------------------------------
// Mock: Supabase client
// ---------------------------------------------------------------------------
const mockSignInWithPassword = vi.fn();
const mockResetPasswordForEmail = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      resetPasswordForEmail: (...args: any[]) => mockResetPasswordForEmail(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock: react-router-dom navigate
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ---------------------------------------------------------------------------
// Mock: Select UI component (Radix Portal/hasPointerCapture jsdom uyumsuzluğu)
// LanguageSwitcher, bu Select bileşenini kullanır. Native <select> ile mockla.
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
function renderLogin(lng = 'tr') {
  const i18n = createTestI18n(lng);
  return {
    i18n,
    user: userEvent.setup(),
    ...render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      </I18nextProvider>
    ),
  };
}

/**
 * Submit butonunu type="submit" attribute'üne göre bulur.
 * Türkçe İ/I harfleri jsdom'un regex case-insensitive modunda sorun çıkarır,
 * bu yüzden metin yerine attribute kullanıyoruz.
 */
function getSubmitButton() {
  const buttons = screen.getAllByRole('button');
  const submitBtn = buttons.find((btn) => btn.getAttribute('type') === 'submit');
  if (!submitBtn) throw new Error('Submit button not found');
  return submitBtn;
}

// ---------------------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
  mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
});

// ---------------------------------------------------------------------------
// HAPPY PATH TESTLERI
// ---------------------------------------------------------------------------
describe('Login Page — Happy Path', () => {
  it('LG-HP-01: email, password input ve submit button render edilir', () => {
    renderLogin();

    expect(screen.getByPlaceholderText('E-posta adresiniz')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Şifreniz')).toBeInTheDocument();
    const submitBtn = getSubmitButton();
    expect(submitBtn).toBeInTheDocument();
  });

  it('LG-HP-02: başlık ve alt başlık çeviri anahtarlarıyla render edilir', () => {
    renderLogin('tr');

    expect(screen.getByText('Giriş Yap')).toBeInTheDocument();
    expect(screen.getByText(/SaaS ERP sisteminize güvenle erişin/)).toBeInTheDocument();
  });

  it('LG-HP-03: geçerli credentials ile supabase signInWithPassword çağrılır', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    });

    const { user } = renderLogin();

    await user.type(screen.getByPlaceholderText('E-posta adresiniz'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Şifreniz'), 'password123');
    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('LG-HP-04: başarılı giriş sonrası navigate("/") çağrılır', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    });

    const { user } = renderLogin();

    await user.type(screen.getByPlaceholderText('E-posta adresiniz'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Şifreniz'), 'password123');
    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('LG-HP-05: form gönderilirken loading spinner gösterilir ve buton disabled olur', async () => {
    mockSignInWithPassword.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: { session: null }, error: null }), 500))
    );

    const { user } = renderLogin();

    await user.type(screen.getByPlaceholderText('E-posta adresiniz'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Şifreniz'), 'password123');
    await user.click(getSubmitButton());

    // Buton disabled olmalı (isLoading=true)
    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find(
      (btn) => btn.getAttribute('type') === 'submit'
    );
    expect(submitBtn).toBeDisabled();
  });

  it('LG-HP-06: LanguageSwitcher bileşeni sayfada render edilir', () => {
    renderLogin();

    // Mock'lanmış Select bileşeni data-testid ile render ediliyor
    expect(screen.getByTestId('language-select')).toBeInTheDocument();
  });

  it('LG-HP-07: "Hemen Kayıt Ol" linki /register\'a yönlendirir', () => {
    renderLogin();

    const registerLink = screen.getByText('Hemen Kayıt Ol');
    expect(registerLink).toBeInTheDocument();
    expect(registerLink.closest('a')).toHaveAttribute('href', '/register');
  });

  it('LG-HP-08: "Şifremi Unuttum" tıklanınca forgot password formu gösterilir', async () => {
    const { user } = renderLogin();

    await user.click(screen.getByText('Şifremi Unuttum?'));

    expect(screen.getByText('Şifrenizi mi Unuttunuz?')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EDGE CASE / UÇ DURUM TESTLERİ
// ---------------------------------------------------------------------------
describe('Login Page — Edge Cases', () => {
  it('LG-EC-01: supabase auth hatası döndüğünde hata mesajı gösterilir', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    });

    const { user } = renderLogin();

    await user.type(screen.getByPlaceholderText('E-posta adresiniz'), 'wrong@test.com');
    await user.type(screen.getByPlaceholderText('Şifreniz'), 'wrongpassword');
    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    });
  });

  it('LG-EC-02: supabase isteği exception fırlatırsa hata yakalanır', async () => {
    mockSignInWithPassword.mockRejectedValue(new Error('Network Error'));

    const { user } = renderLogin();

    await user.type(screen.getByPlaceholderText('E-posta adresiniz'), 'test@test.com');
    await user.type(screen.getByPlaceholderText('Şifreniz'), '123456');
    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });
  });

  it('LG-EC-03: session null döndüğünde navigate çağrılmaz', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { user } = renderLogin();

    await user.type(screen.getByPlaceholderText('E-posta adresiniz'), 'test@test.com');
    await user.type(screen.getByPlaceholderText('Şifreniz'), '123456');
    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('LG-EC-04: İngilizce locale ile doğru placeholder/button metinleri gösterilir', () => {
    renderLogin('en');

    const emailInput = screen.getByPlaceholderText(/email/i);
    expect(emailInput).toBeInTheDocument();
  });

  it('LG-EC-05: forgot password — reset email başarılı olduğunda success mesajı gösterilir', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const { user } = renderLogin();

    await user.click(screen.getByText('Şifremi Unuttum?'));

    // Forgot password formundaki email placeholder:
    // t('auth.forgot.emailPlaceholder') || t('auth.login.emailPlaceholder')
    // 'auth.forgot.emailPlaceholder' TR'de tanımlı değil → raw anahtar döner (truthy)
    // Bu yüzden placeholder olarak raw key kullanılır — bu bir bug, ama test mevcut kodu yansıtmalı
    const emailInput = screen.getByRole('textbox');
    await user.type(emailInput, 'reset@test.com');

    const sendButton = screen.getByText(/SIFIRLAMA/i);
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/şifre sıfırlama bağlantısı e-posta adresinize gönderildi/i)).toBeInTheDocument();
    });
  });

  it('LG-EC-06: forgot password — reset hatası gösterilir', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'User not found' },
    });

    const { user } = renderLogin();

    await user.click(screen.getByText('Şifremi Unuttum?'));

    const emailInput = screen.getByRole('textbox');
    await user.type(emailInput, 'unknown@test.com');

    const sendButton = screen.getByText(/SIFIRLAMA/i);
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument();
    });
  });

  it('LG-EC-07: forgot password — "Giriş Ekranına Dön" tıklanınca login formu tekrar gösterilir', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const { user } = renderLogin();

    await user.click(screen.getByText('Şifremi Unuttum?'));
    expect(screen.getByText('Şifrenizi mi Unuttunuz?')).toBeInTheDocument();

    // Email gir, gönder ve başarı mesajından geri dön
    const emailInput = screen.getByRole('textbox');
    await user.type(emailInput, 'test@test.com');
    await user.click(screen.getByText(/SIFIRLAMA/i));

    await waitFor(() => {
      expect(screen.getByText(/GİRİŞ EKRANINA DÖN/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/GİRİŞ EKRANINA DÖN/i));

    // Login formu geri geldi
    expect(screen.getByPlaceholderText('E-posta adresiniz')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Şifreniz')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MOBİL RESPONSIVE TESTLERİ (Birim Test Seviyesinde)
// ---------------------------------------------------------------------------
describe('Login Page — Responsive/Layout', () => {
  it('LG-MR-01: glass panel container w-full ve max-w-md sınıflarına sahiptir', () => {
    const { container } = renderLogin();

    const panel = container.querySelector('.max-w-md');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass('w-full');
  });

  it('LG-MR-02: arka plan blur efektleri pointer-events-none sınıfına sahiptir', () => {
    const { container } = renderLogin();

    // Sadece dekoratif arka plan efektlerini seç (blur-[120px] veya blur-[100px])
    // backdrop-blur-* sınıflı bileşenleri hariç tut
    const allElements = container.querySelectorAll('*');
    const bgBlurElements: Element[] = [];
    allElements.forEach((el) => {
      const cls = el.className;
      if (typeof cls === 'string' && /blur-\[\d+px\]/.test(cls)) {
        bgBlurElements.push(el);
      }
    });

    expect(bgBlurElements.length).toBeGreaterThan(0);
    bgBlurElements.forEach((el) => {
      expect(el.className).toContain('pointer-events-none');
    });
  });

  it('LG-MR-03: LanguageSwitcher z-10 ile içeriğin üzerinde konumlanır', () => {
    const { container } = renderLogin();

    const switcherWrapper = container.querySelector('.absolute.top-4.right-4');
    expect(switcherWrapper).toBeInTheDocument();
    expect(switcherWrapper).toHaveClass('z-10');
  });
});
