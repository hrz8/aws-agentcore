import type { JSONValue } from '@strands-agents/sdk';

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

export const getCurrentDatetimeTool = tool({
  name: 'get_current_datetime',
  description:
    'Get the current date and time. Optionally provide an IANA timezone to get local date/time for a specific location. '
    + 'Useful for resolving relative dates like "tomorrow" or "next Monday".',
  inputSchema: z.object({
    timezone: z.string().optional().describe(
      'IANA timezone identifier (e.g. "Asia/Tokyo", "America/New_York"). Defaults to UTC if omitted.',
    ),
  }),
  callback: (input): JSONValue => {
    const tz = input.timezone || 'UTC';
    const now = new Date();
    const formatted = now.toLocaleString('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const [date, time] = formatted.split(', ');
    const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' });
    return { date: date!, time: time!, dayOfWeek, timezone: tz };
  },
});
