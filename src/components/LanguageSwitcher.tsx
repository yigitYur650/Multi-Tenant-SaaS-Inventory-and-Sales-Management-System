import React from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from './ui/Select';

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
    <div className="relative">
      <Select
        value={current.code}
        onValueChange={handleChange}
        items={languages.map((l) => ({
          value: l.code,
          label: `${l.flag} ${l.name}`,
        }))}
        placeholder={t('layout.switcher.title')}
        className="bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-lg rounded-2xl text-slate-700"
      />
    </div>
  );
}
