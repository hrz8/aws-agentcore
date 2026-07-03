import type { Tool } from '@strands-agents/sdk';

import { tool } from '@strands-agents/sdk';
import { httpGetJson } from '@repo/kit/http';
import { z } from 'zod';

import type { TenantVars } from '@repo/registry';

import {
  VAR_GEOCODING_BASE_URL,
  VAR_ZIP_BASE_URL,
  ZIP_CODE_PATTERN,
  errMsg,
} from '../_lib/weather.js';

const GetLocationInputSchema = z.object({
  query: z.string().min(1).describe(
    'Location to resolve — city name, state, country, or US zip code. '
    + 'Examples: "Kuala Lumpur", "Berlin", "90210".',
  ),
});

const LocationResultSchema = z.object({
  name: z.string(),
  country: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
});

type LocationResult = z.infer<typeof LocationResultSchema>;

export function createGetLocationTool(vars: TenantVars): Tool {
  const geocodingBase = vars.resolve(VAR_GEOCODING_BASE_URL);
  const zipBase = vars.resolve(VAR_ZIP_BASE_URL);

  return tool({
    name: 'get_location',
    description:
      'Resolve a location query into geographic coordinates. Accepts city names, US zip codes, or any place name. '
      + 'Returns the coordinates + timezone needed by the get_weather_forecast tool.',
    inputSchema: GetLocationInputSchema,
    callback: async (input): Promise<LocationResult | string> => {
      const q = input.query.trim();
      try {
        if (ZIP_CODE_PATTERN.test(q)) {
          const raw = await httpGetJson<{
            places?: Array<{
              'place name': string;
              'state abbreviation': string;
              latitude: string;
              longitude: string;
            }>;
            'country abbreviation': string;
          }>(`${zipBase}/us/${q}`);
          const place = raw.places?.[0];
          if (!place) return `No location found for zip code: ${q}`;
          return {
            name: `${place['place name']}, ${place['state abbreviation']}`,
            country: raw['country abbreviation'],
            latitude: Number.parseFloat(place.latitude),
            longitude: Number.parseFloat(place.longitude),
            timezone: 'auto',
          };
        }

        const url = new URL(`${geocodingBase}/search`);
        url.searchParams.set('name', q);
        url.searchParams.set('count', '1');
        url.searchParams.set('language', 'en');
        url.searchParams.set('format', 'json');
        const raw = await httpGetJson<{
          results?: Array<{
            name: string;
            country: string;
            country_code: string;
            admin1?: string;
            latitude: number;
            longitude: number;
            timezone?: string;
          }>;
        }>(url.toString());
        const r = raw.results?.[0];
        if (!r) return `No location found for: ${q}`;
        return {
          name: r.admin1 ? `${r.name}, ${r.admin1}, ${r.country}` : `${r.name}, ${r.country}`,
          country: r.country_code,
          latitude: r.latitude,
          longitude: r.longitude,
          timezone: r.timezone ?? 'auto',
        };
      } catch (err) {
        return `Failed to resolve location: ${errMsg(err)}`;
      }
    },
  });
}
