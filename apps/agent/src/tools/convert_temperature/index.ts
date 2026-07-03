import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

const ConvertTemperatureInputSchema = z.object({
  value: z.number().describe('The temperature value to convert'),
  from: z.enum(['celsius', 'fahrenheit']).describe('The source unit'),
});

const ConvertTemperatureResultSchema = z.object({
  input: z.number(),
  from: z.enum(['celsius', 'fahrenheit']),
  result: z.number(),
  to: z.enum(['celsius', 'fahrenheit']),
});

export type ConvertTemperatureResult = z.infer<typeof ConvertTemperatureResultSchema>;

export const convertTemperatureTool = tool({
  name: 'convert_temperature',
  description: 'Convert a temperature value between Celsius and Fahrenheit.',
  inputSchema: ConvertTemperatureInputSchema,
  callback: (input): ConvertTemperatureResult => {
    if (input.from === 'celsius') {
      return {
        input: input.value,
        from: 'celsius',
        result: Math.round((input.value * 9 / 5 + 32) * 100) / 100,
        to: 'fahrenheit',
      };
    }
    return {
      input: input.value,
      from: 'fahrenheit',
      result: Math.round(((input.value - 32) * 5 / 9) * 100) / 100,
      to: 'celsius',
    };
  },
});
