import { convertTemperatureTool } from './temperature.js';

export const BUILTIN_TOOLS = {
  convert_temperature: convertTemperatureTool,
} as const;

export type BuiltinToolName = keyof typeof BUILTIN_TOOLS;
