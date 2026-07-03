import { Languages } from 'lucide-react';

import { getLocale, setLocale } from '#/paraglide/runtime.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select';
import { isLocale, LOCALE_NAMES, LOCALES, type Locale } from '#/shared/i18n/locale';

export function LanguageSwitcher() {
  const raw = getLocale();
  const current: Locale = isLocale(raw) ? raw : 'en-US';

  return (
    <Select
      value={current}
      onValueChange={(next) => {
        if (!isLocale(next) || next === current) {
          return;
        }
        setLocale(next);
      }}
    >
      <SelectTrigger
        className="h-8 w-40 gap-2"
        aria-label={LOCALE_NAMES[current]}
        title={LOCALE_NAMES[current]}
      >
        <Languages className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((code) => (
          <SelectItem key={code} value={code}>
            {LOCALE_NAMES[code]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
