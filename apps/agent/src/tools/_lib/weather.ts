export const VAR_GEOCODING_BASE_URL = 'WEATHER_GEOCODING_BASE_URL';
export const VAR_FORECAST_BASE_URL = 'WEATHER_FORECAST_BASE_URL';
export const VAR_ZIP_BASE_URL = 'WEATHER_ZIP_BASE_URL';

export const WEATHER_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
].join(',');

export const ZIP_CODE_PATTERN = /^\d{5}(?:-\d{4})?$/;

export type Period = 'morning' | 'afternoon' | 'evening' | 'night';
export const PERIOD_HOURS: Record<Period, [start: number, end: number]> = {
  morning: [6, 12],
  afternoon: [12, 18],
  evening: [18, 24],
  night: [0, 6],
};

const WMO_WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

export const describeWeatherCode = (code: number): string => WMO_WEATHER_CODES[code] ?? 'Unknown';

export function computeForecastDays(date: string): number {
  const target = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(diffDays + 1, 16));
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
