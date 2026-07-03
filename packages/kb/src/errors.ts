export class EmptyContentError extends Error {
  constructor(url: string) {
    super(`empty content at ${url}`);
    this.name = 'EmptyContentError';
  }
}

export class KbNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KbNotConfiguredError';
  }
}

export class KbValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KbValidationError';
  }
}

export class KbScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KbScopeError';
  }
}

export class KbNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KbNotFoundError';
  }
}

export class KbConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KbConflictError';
  }
}

export class WebIngestRejectedError extends Error {
  readonly reason: string;
  constructor(url: string, reason: string) {
    super(`web ingest rejected for ${url}: ${reason}`);
    this.name = 'WebIngestRejectedError';
    this.reason = reason;
  }
}
