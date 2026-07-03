import { describe, expect, it } from 'vitest';

import { BranchError, RegistryValidationError } from '../src/index.ts';

describe('BranchError', () => {
  it('preserves message + status + name', () => {
    const err = new BranchError('target exists', 409);
    expect(err.message).toBe('target exists');
    expect(err.status).toBe(409);
    expect(err.name).toBe('BranchError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BranchError);
  });

  it('discriminates by name from other errors', () => {
    const err: unknown = new BranchError('x', 400);
    if (err instanceof BranchError) {
      // TS narrows here; sanity check
      expect(err.status).toBeTypeOf('number');
    } else {
      throw new Error('expected BranchError instance');
    }
  });
});

describe('RegistryValidationError', () => {
  it('preserves message + name', () => {
    const err = new RegistryValidationError('bad shape');
    expect(err.message).toBe('bad shape');
    expect(err.name).toBe('RegistryValidationError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RegistryValidationError);
  });

  it('is distinguishable from BranchError', () => {
    const branch: unknown = new BranchError('x', 400);
    const validation: unknown = new RegistryValidationError('y');
    expect(branch instanceof RegistryValidationError).toBe(false);
    expect(validation instanceof BranchError).toBe(false);
  });
});
