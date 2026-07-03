import { initPinoLogger } from '@repo/kit/logger.server';

import { LOG_CONFIG } from '#/server/config';

export function initServerLogger(): void {
  initPinoLogger(LOG_CONFIG);
}
