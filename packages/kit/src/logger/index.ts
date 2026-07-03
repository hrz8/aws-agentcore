export const LogLevel = {
  Trace: 'trace',
  Debug: 'debug',
  Info: 'info',
  Warn: 'warn',
  Error: 'error',
  Fatal: 'fatal',
} as const;
export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

export interface Logger {
  debug(msg: string, kv?: Record<string, unknown>): void;
  info(msg: string, kv?: Record<string, unknown>): void;
  warn(msg: string, kv?: Record<string, unknown>): void;
  error(msg: string, kv?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

class ConsoleLogger implements Logger {
  constructor(private readonly bindings: Record<string, unknown> = {}) {}

  debug(msg: string, kv?: Record<string, unknown>): void {
    console.info('[debug]', msg, { ...this.bindings, ...kv });
  }
  info(msg: string, kv?: Record<string, unknown>): void {
    console.info(msg, { ...this.bindings, ...kv });
  }
  warn(msg: string, kv?: Record<string, unknown>): void {
    console.warn(msg, { ...this.bindings, ...kv });
  }
  error(msg: string, kv?: Record<string, unknown>): void {
    console.error(msg, { ...this.bindings, ...kv });
  }
  child(bindings: Record<string, unknown>): Logger {
    return new ConsoleLogger({ ...this.bindings, ...bindings });
  }
}

let currentLogger: Logger = new ConsoleLogger();

// Late-binding proxy so callers that cached getLogger()/.child() still see
// swaps done later via setLogger() (boot order + Vite HMR).
class LoggerProxy implements Logger {
  private readonly bindings: Record<string, unknown>;

  constructor(bindings: Record<string, unknown> = {}) {
    this.bindings = bindings;
  }

  private bound(): Logger {
    return Object.keys(this.bindings).length === 0
      ? currentLogger
      : currentLogger.child(this.bindings);
  }

  debug(msg: string, kv?: Record<string, unknown>): void {
    this.bound().debug(msg, kv);
  }
  info(msg: string, kv?: Record<string, unknown>): void {
    this.bound().info(msg, kv);
  }
  warn(msg: string, kv?: Record<string, unknown>): void {
    this.bound().warn(msg, kv);
  }
  error(msg: string, kv?: Record<string, unknown>): void {
    this.bound().error(msg, kv);
  }
  child(bindings: Record<string, unknown>): Logger {
    return new LoggerProxy({ ...this.bindings, ...bindings });
  }
}

const ROOT_PROXY: Logger = new LoggerProxy();

export function getLogger(): Logger {
  return ROOT_PROXY;
}

export function setLogger(logger: Logger): void {
  currentLogger = logger;
}
