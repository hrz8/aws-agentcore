import type { Tool } from '@strands-agents/sdk';

import { tool } from '@strands-agents/sdk';
import { httpGetJson } from '@repo/kit/http';
import { z } from 'zod';

import type { TenantVars } from '@repo/registry';

import {
  PERIOD_HOURS,
  VAR_FORECAST_BASE_URL,
  WEATHER_FIELDS,
  computeForecastDays,
  describeWeatherCode,
  errMsg,
} from '../_lib/weather.js';

type WeatherData = {
  time: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  weatherDescription: string;
  windSpeed: number;
  windDirection: number;
};

type OpenMeteoCurrentRaw = {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
};

type OpenMeteoHourlyRaw = {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  relative_humidity_2m: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
};

const GetWeatherForecastInputSchema = z.object({
  name: z.string().describe('Display name of the location'),
  country: z.string().describe('Country code of the location'),
  latitude: z.number().describe('Latitude of the location'),
  longitude: z.number().describe('Longitude of the location'),
  timezone: z.string().describe('Timezone of the location'),
  date: z.string().optional().describe('Date to fetch forecast for, YYYY-MM-DD. Omit for today.'),
  period: z.enum(['morning', 'afternoon', 'evening', 'night']).optional().describe(
    'Time of day filter (morning 6-12, afternoon 12-18, evening 18-24, night 0-6). Omit for full day.',
  ),
});

const WeatherForecastResultSchema = z.object({
  location: z.string(),
  coordinates: z.object({ latitude: z.number(), longitude: z.number() }),
  current: z.object({
    time: z.string(),
    temperature: z.number(),
    apparentTemperature: z.number(),
    humidity: z.number(),
    weatherDescription: z.string(),
    windSpeed: z.number(),
    windDirection: z.number(),
  }),
  hourly: z.array(z.object({
    time: z.string(),
    temperature: z.number(),
    apparentTemperature: z.number(),
    humidity: z.number(),
    weatherDescription: z.string(),
    windSpeed: z.number(),
    windDirection: z.number(),
  })),
  period: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
});

type WeatherForecastResult = z.infer<typeof WeatherForecastResultSchema>;

export function createGetWeatherForecastTool(vars: TenantVars): Tool {
  const forecastBase = vars.resolve(VAR_FORECAST_BASE_URL);

  return tool({
    name: 'get_weather_forecast',
    description:
      'Get the weather forecast for a resolved location. Requires latitude, longitude, and timezone from get_location. '
      + 'Supports up to 16 days ahead. Optionally filter by date and time-of-day.',
    inputSchema: GetWeatherForecastInputSchema,
    callback: async (input): Promise<WeatherForecastResult | string> => {
      try {
        const { period, date, name, country: _country, latitude, longitude, timezone } = input;
        const forecastDays = date ? computeForecastDays(date) : 1;

        const url = new URL(`${forecastBase}/forecast`);
        url.searchParams.set('latitude', String(latitude));
        url.searchParams.set('longitude', String(longitude));
        url.searchParams.set('current', WEATHER_FIELDS);
        url.searchParams.set('hourly', WEATHER_FIELDS);
        url.searchParams.set('timezone', timezone);
        url.searchParams.set('forecast_days', String(forecastDays));

        const raw = await httpGetJson<{ current: OpenMeteoCurrentRaw; hourly: OpenMeteoHourlyRaw }>(
          url.toString(),
        );

        const current: WeatherData = {
          time: raw.current.time,
          temperature: raw.current.temperature_2m,
          apparentTemperature: raw.current.apparent_temperature,
          humidity: raw.current.relative_humidity_2m,
          weatherDescription: describeWeatherCode(raw.current.weather_code),
          windSpeed: raw.current.wind_speed_10m,
          windDirection: raw.current.wind_direction_10m,
        };

        let hourly: WeatherData[] = raw.hourly.time.map((time, i) => ({
          time,
          temperature: raw.hourly.temperature_2m[i] ?? 0,
          apparentTemperature: raw.hourly.apparent_temperature[i] ?? 0,
          humidity: raw.hourly.relative_humidity_2m[i] ?? 0,
          weatherDescription: describeWeatherCode(raw.hourly.weather_code[i] ?? 0),
          windSpeed: raw.hourly.wind_speed_10m[i] ?? 0,
          windDirection: raw.hourly.wind_direction_10m[i] ?? 0,
        }));

        if (date) hourly = hourly.filter(h => h.time.startsWith(date));
        if (period) {
          const [start, end] = PERIOD_HOURS[period];
          hourly = hourly.filter(h => {
            const hour = new Date(h.time).getHours();
            return hour >= start && hour < end;
          });
        }

        return {
          location: name,
          coordinates: { latitude, longitude },
          current,
          hourly,
          ...(period ? { period } : {}),
        };
      } catch (err) {
        return `Failed to get weather: ${errMsg(err)}`;
      }
    },
  });
}
