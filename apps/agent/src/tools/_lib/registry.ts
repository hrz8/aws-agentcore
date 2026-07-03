import type { Tool } from '@strands-agents/sdk';

import { TenantVars } from '@repo/registry';

import { convertTemperatureTool } from '../convert_temperature/index.js';
import { getCurrentDatetimeTool } from '../get_current_datetime/index.js';
import { createGetLocationTool } from '../get_location/index.js';
import { createGetWeatherForecastTool } from '../get_weather_forecast/index.js';

export type BuiltinTool = Tool | ((vars: TenantVars) => Tool);

export const BUILTIN_TOOLS: Record<string, BuiltinTool> = {
  convert_temperature: convertTemperatureTool,
  get_current_datetime: getCurrentDatetimeTool,
  get_location: createGetLocationTool,
  get_weather_forecast: createGetWeatherForecastTool,
};

export type BuiltinToolName = keyof typeof BUILTIN_TOOLS;
