import robotsParserModule from 'robots-parser';

type Robots = {
  isAllowed: (url: string, ua: string) => boolean | undefined;
  getSitemaps: () => string[];
  getCrawlDelay: (ua: string) => number | undefined;
};
const robotsParser = robotsParserModule as unknown as (url: string, body: string) => Robots;

import { httpGetText } from '../http/client.js';

const USER_AGENT_NAME = 'agentcore-bot';

const cache = new Map<string, Promise<Robots | null>>();

function robotsUrlFor(targetUrl: string): { origin: string; robotsUrl: string } {
  const u = new URL(targetUrl);
  return { origin: u.origin, robotsUrl: `${u.origin}/robots.txt` };
}

async function loadRobots(_origin: string, robotsUrl: string): Promise<Robots | null> {
  try {
    const body = await httpGetText(robotsUrl, { timeoutMs: 5_000, userAgent: USER_AGENT_NAME });
    return robotsParser(robotsUrl, body);
  } catch {
    // Missing/unreachable robots.txt = no restrictions.
    return null;
  }
}

export async function isAllowed(targetUrl: string): Promise<boolean> {
  const { origin, robotsUrl } = robotsUrlFor(targetUrl);
  let pending = cache.get(origin);
  if (!pending) {
    pending = loadRobots(origin, robotsUrl);
    cache.set(origin, pending);
  }
  const robots = await pending;
  if (!robots) return true;
  return robots.isAllowed(targetUrl, USER_AGENT_NAME) ?? true;
}

export async function sitemapUrls(targetUrl: string): Promise<string[]> {
  const { origin, robotsUrl } = robotsUrlFor(targetUrl);
  let pending = cache.get(origin);
  if (!pending) {
    pending = loadRobots(origin, robotsUrl);
    cache.set(origin, pending);
  }
  const robots = await pending;
  return robots?.getSitemaps() ?? [];
}

export async function crawlDelay(targetUrl: string): Promise<number | undefined> {
  const { origin, robotsUrl } = robotsUrlFor(targetUrl);
  let pending = cache.get(origin);
  if (!pending) {
    pending = loadRobots(origin, robotsUrl);
    cache.set(origin, pending);
  }
  const robots = await pending;
  return robots?.getCrawlDelay(USER_AGENT_NAME);
}
