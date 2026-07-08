import handler from '@tanstack/react-start/server-entry';

import { ORIGIN_SECRET, RUN_IN_LAMBDA } from './server/config';
import { initServerLogger } from './server/_lib/init-logger.server';
import { paraglideMiddleware } from './paraglide/server.js';

initServerLogger();

function forbiddenIfBadOriginSecret(request: Request): Response | null {
  if (!RUN_IN_LAMBDA) return null;
  if (request.headers.get('x-origin-secret') !== ORIGIN_SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  return null;
}

export default {
  fetch(request: Request): Promise<Response> {
    const denied = forbiddenIfBadOriginSecret(request);
    if (denied) return Promise.resolve(denied);
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};
