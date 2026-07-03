import * as React from 'react';

import {
  AVAILABLE_THEMES,
  DEFAULT_MODE,
  DEFAULT_THEME,
  MODE_STORAGE_KEY,
  THEME_MODE,
  THEME_STORAGE_KEY,
  type ThemeMode,
  type ThemeName,
} from './theme';

function isThemeName(value: string | null): value is ThemeName {
  return value !== null && (AVAILABLE_THEMES as readonly string[]).includes(value);
}

export function useTheme() {
  const [theme, setThemeState] = React.useState<ThemeName>(DEFAULT_THEME);
  const [mode, setModeState] = React.useState<ThemeMode>(DEFAULT_MODE);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeName(storedTheme)) setThemeState(storedTheme);
    const storedMode = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (storedMode === THEME_MODE.DARK || storedMode === THEME_MODE.LIGHT) {
      setModeState(storedMode);
    }
  }, []);

  const setTheme = React.useCallback((next: ThemeName) => {
    setThemeState(next);
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  const setMode = React.useCallback((next: ThemeMode) => {
    setModeState(next);
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', next === THEME_MODE.DARK);
    window.localStorage.setItem(MODE_STORAGE_KEY, next);
  }, []);

  const toggleMode = React.useCallback(() => {
    setModeState((current) => {
      const next = current === THEME_MODE.DARK ? THEME_MODE.LIGHT : THEME_MODE.DARK;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === THEME_MODE.DARK);
        window.localStorage.setItem(MODE_STORAGE_KEY, next);
      }
      return next;
    });
  }, []);

  return { theme, mode, setTheme, setMode, toggleMode } as const;
}
