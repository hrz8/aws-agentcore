import pino from 'pino';

import type { Logger, LogLevel } from './logger/index.js';
import { setLogger } from './logger/index.js';

export type PinoLoggerConfig = {
  level: LogLevel;
  pretty: boolean;
  base?: Record<string, unknown>;
};

class PinoLogger implements Logger {
  constructor(private readonly inner: pino.Logger) {}

  debug(msg: string, kv?: Record<string, unknown>): void {
    if (kv != null) this.inner.debug(kv, msg);
    else this.inner.debug(msg);
  }
  info(msg: string, kv?: Record<string, unknown>): void {
    if (kv != null) this.inner.info(kv, msg);
    else this.inner.info(msg);
  }
  warn(msg: string, kv?: Record<string, unknown>): void {
    if (kv != null) this.inner.warn(kv, msg);
    else this.inner.warn(msg);
  }
  error(msg: string, kv?: Record<string, unknown>): void {
    if (kv != null) this.inner.error(kv, msg);
    else this.inner.error(msg);
  }
  child(bindings: Record<string, unknown>): Logger {
    return new PinoLogger(this.inner.child(bindings));
  }
}

export function buildPinoLogger(cfg: PinoLoggerConfig): Logger {
  const opts: pino.LoggerOptions = {
    level: cfg.level,
    base: cfg.base ?? null,
  };
  if (cfg.pretty) {
    opts.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss.l' },
    };
  }
  return new PinoLogger(pino(opts));
}

export function initPinoLogger(cfg: PinoLoggerConfig): void {
  setLogger(buildPinoLogger(cfg));
}
