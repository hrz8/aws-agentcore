import * as cheerio from 'cheerio';

import { EmptyContentError } from '../errors.js';
import { safeHttpGetText } from '@repo/kit/http.server';

const MAX_CONTENT_CHARS = 50_000;

export type FetchedPage = {
  url: string;
  title: string;
  text: string;
  contentHash: string;
  fetchedAt: string;
};

const PAGE_MAX_BYTES = 5 * 1024 * 1024;

export async function fetchPage(url: string): Promise<FetchedPage> {
  const html = await safeHttpGetText(url, {
    headers: { accept: 'text/html,*/*;q=0.9' },
    maxBytes: PAGE_MAX_BYTES,
  });
  const { title, text } = extractText(html);
  if (!text.trim()) {
    throw new EmptyContentError(url);
  }
  const capped = text.length > MAX_CONTENT_CHARS ? text.slice(0, MAX_CONTENT_CHARS) : text;
  const contentHash = await sha256(capped);
  return { url, title, text: capped, contentHash, fetchedAt: new Date().toISOString() };
}

function extractText(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);
  $('script, style, noscript').remove();

  const title =
    $('title').first().text().trim() || $('h1').first().text().trim() || '';

  const candidates = [
    'main', 'article', '[role="main"]', '#main', '.main',
    '#content', '.content', '.post', '.entry',
  ];
  let root = $();
  for (const sel of candidates) {
    const found = $(sel).first();
    if (found.length) {
      root = found; break;
    }
  }
  if (!root.length) {
    $('nav, header, footer, aside').remove();
    root = $('body');
  }
  if (!root.length) {
    return { title, text: '' };
  }

  const text = root.text().split('\n').map((line) => line.trim()).filter(Boolean).join('\n');
  return { title, text };
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
