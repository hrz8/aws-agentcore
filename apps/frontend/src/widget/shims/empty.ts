const noop = (): void => undefined;
const asyncNoop = async (): Promise<Record<string, never>> => ({});

export const createHighlighter = asyncNoop;
export const createHighlighterCore = asyncNoop;
export const createJavaScriptRegexEngine = noop;
export const bundledLanguages: Record<string, never> = {};
export const bundledLanguagesInfo: never[] = [];
export const bundledThemes: Record<string, never> = {};
export const bundledThemesInfo: never[] = [];
export const codeToHtml = (): string => '';
export const codeToTokens = (): { tokens: never[]; fg: string; bg: string } => ({ tokens: [], fg: '', bg: '' });
export const codeToHast = (): { type: string; children: never[] } => ({ type: 'root', children: [] });
export const codeToTokensBase = (): never[] => [];
export const codeToTokensWithThemes = (): { tokens: never[]; themes: Record<string, never> } => ({ tokens: [], themes: {} });
export const getSingletonHighlighter = asyncNoop;
export const getSingletonHighlighterCore = asyncNoop;

export default {} as Record<string, never>;
