export class BranchError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'BranchError';
  }
}

export class RegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryValidationError';
  }
}
