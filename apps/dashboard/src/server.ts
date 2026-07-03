import handler from '@tanstack/react-start/server-entry';

import { initServerLogger } from './server/_lib/init-logger.server';
import { paraglideMiddleware } from './paraglide/server.js';

initServerLogger();

export default {
  fetch(request: Request): Promise<Response> {
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};
