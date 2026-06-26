import { Agent } from '@strands-agents/sdk';

import { loadModel } from '../models/index.js';
import { convertTemperatureTool } from '../tools/temperature.js';

const SIMPLE_AGENT_SYSTEM_PROMPT = `You are a helpful assistant. Keep replies concise and friendly.

When the user asks to convert a temperature between Celsius and Fahrenheit, use the convert_temperature tool — do not compute it from memory.`;

export function createSimpleAgent(): Agent {
  return new Agent({
    model: loadModel(),
    systemPrompt: SIMPLE_AGENT_SYSTEM_PROMPT,
    tools: [convertTemperatureTool],
  });
}
