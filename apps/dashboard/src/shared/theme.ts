export const THEMES = {
  savanna: 'Savanna',
  glacier: 'Glacier',
} as const;

export type ThemeName = keyof typeof THEMES;
export type ThemeLabel = (typeof THEMES)[ThemeName];

export const AVAILABLE_THEMES = Object.keys(THEMES) as ThemeName[];
export const THEME_LABELS = THEMES;

export const THEME_MODE = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;
export type ThemeMode = (typeof THEME_MODE)[keyof typeof THEME_MODE];

export const DEFAULT_THEME: ThemeName = 'savanna';
export const DEFAULT_MODE: ThemeMode = THEME_MODE.DARK;

export const THEME_STORAGE_KEY = 'twai_theme';
export const MODE_STORAGE_KEY = 'twai_mode';

export const THEME_INIT_SCRIPT = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var m=localStorage.getItem(${JSON.stringify(MODE_STORAGE_KEY)});
var d=document.documentElement;
d.setAttribute('data-theme', t || '${DEFAULT_THEME}');
if(m===null){ if('${DEFAULT_MODE}'==='dark') d.classList.add('dark'); }
else if(m==='dark') d.classList.add('dark');
}catch(e){}})();`;
