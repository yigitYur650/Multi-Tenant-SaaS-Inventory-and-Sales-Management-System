import React from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from './ui/Select';
import { ErrorBoundary } from './ErrorBoundary';
import { Globe } from 'lucide-react';

// Define language options based on i18n resources
const languages = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = languages.find((l) => l.code === i18n.language) || languages[0];

  const handleChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  return (
    <ErrorBoundary>
      <div className="relative">
        <Select
          value={current.code}
          onValueChange={handleChange}
          items={languages.map((l) => ({
            value: l.code,
            label: `${l.flag} ${l.name}`,
          }))}
          placeholder={t('layout.switcher.title')}
          icon={<Globe className="w-4 h-4 text-white dark:text-foreground shrink-0" />}
          className="bg-slate-900/80 dark:bg-background/80 backdrop-blur-md border border-white/20 dark:border-border/50 text-white dark:text-foreground hover:bg-slate-800/80 hover:border-white/40 hover:scale-[1.02] active:scale-95 transition-all rounded-2xl shadow-xl font-bold"
        />
      </div>
    </ErrorBoundary>
  );
}
