import { Moon, Sun } from 'lucide-react';

import { m } from '#/paraglide/messages.js';
import { Button } from '#/components/ui/button';
import { AVAILABLE_THEMES, THEME_MODE, type ThemeName } from '#/shared/theme';
import { useTheme } from '#/shared/use-theme';
import { cn } from '#/shared/utils';

const THEME_LABEL: Record<ThemeName, () => string> = {
  savanna: () => m.theme_savanna(),
  glacier: () => m.theme_glacier(),
};

export function ThemeSwitcher() {
  const { theme, mode, setTheme, toggleMode } = useTheme();
  const isDark = mode === THEME_MODE.DARK;

  return (
    <div className="flex items-center gap-2">
      <div
        role="radiogroup"
        aria-label={m.theme_group_label()}
        className="inline-flex items-center gap-0.5 rounded-md border border-border p-0.5"
      >
        {AVAILABLE_THEMES.map((name) => (
          <Button
            key={name}
            type="button"
            size="sm"
            variant={theme === name ? 'default' : 'ghost'}
            role="radio"
            aria-checked={theme === name}
            onClick={() => setTheme(name)}
            className={cn('h-6 px-2 text-xs', theme === name && 'pointer-events-none')}
          >
            {THEME_LABEL[name]()}
          </Button>
        ))}
      </div>

      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={toggleMode}
        aria-label={isDark ? m.theme_switch_to_light() : m.theme_switch_to_dark()}
        title={isDark ? m.theme_mode_dark() : m.theme_mode_light()}
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </Button>
    </div>
  );
}
