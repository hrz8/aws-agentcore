import robotsParserModule from 'robots-parser';

import { safeHttpGetText } from '@repo/kit/http.server';

type Robots = {
  isAllowed: (url: string, ua: string) => boolean | undefined;
  getSitemaps: () => string[];
  getCrawlDelay: (ua: string) => number | undefined;
};
const robotsParser = robotsParserModule as unknown as (url: string, body: string) => Robots;

const USER_AGENT_NAME = 'agentcore-bot';
// TODO: bound growth — LRU + TTL. Currently unbounded across process lifetime.
const cache = new Map<string, Promise<Robots | null>>();

const ROBOTS_MAX_BYTES = 512 * 1024;

function robotsUrlFor(targetUrl: string): { origin: string; robotsUrl: string } {
  const u = new URL(targetUrl);
  return {
    origin: u.origin,
    robotsUrl: `${u.origin}/robots.txt`,
  };
}

async function loadRobots(_origin: string, robotsUrl: string): Promise<Robots | null> {
  try {
    const body = await safeHttpGetText(robotsUrl, {
      timeoutMs: 5_000,
      userAgent: USER_AGENT_NAME,
      maxBytes: ROBOTS_MAX_BYTES,
    });
    return robotsParser(robotsUrl, body);
  } catch {
    return null;
  }
}

function robotsFor(targetUrl: string): Promise<Robots | null> {
  const { origin, robotsUrl } = robotsUrlFor(targetUrl);
  let pending = cache.get(origin);
  if (!pending) {
    pending = loadRobots(origin, robotsUrl);
    cache.set(origin, pending);
  }
  return pending;
}

export async function isAllowed(targetUrl: string): Promise<boolean> {
  const robots = await robotsFor(targetUrl);
  if (!robots) {
    return true;
  }
  return robots.isAllowed(targetUrl, USER_AGENT_NAME) ?? true;
}

export async function sitemapUrls(targetUrl: string): Promise<string[]> {
  const robots = await robotsFor(targetUrl);
  return robots?.getSitemaps() ?? [];
}

export async function crawlDelay(targetUrl: string): Promise<number | undefined> {
  const robots = await robotsFor(targetUrl);
  return robots?.getCrawlDelay(USER_AGENT_NAME);
}
