import { describe, expect, it } from 'vitest';

import {
  TenantVars,
  assertVarRefSyntax,
  extractVarRefs,
  type Var,
} from '../src/index.ts';

describe('extractVarRefs', () => {
  it('yields no names when no template blocks', () => {
    expect([...extractVarRefs('plain string')]).toEqual([]);
  });
  it('yields a single name', () => {
    expect([...extractVarRefs('{{ vars.foo }}')]).toEqual(['foo']);
  });
  it('yields multiple names, preserving order + duplicates', () => {
    expect([...extractVarRefs('{{ vars.a }} then {{ vars.b }} then {{ vars.a }}')])
      .toEqual(['a', 'b', 'a']);
  });
  it('tolerates whitespace variations', () => {
    expect([...extractVarRefs('{{vars.x}} {{  vars.y  }}')]).toEqual(['x', 'y']);
  });
  it('does not match blocks missing the vars. prefix', () => {
    expect([...extractVarRefs('{{ nope }}')]).toEqual([]);
  });

  it('accepts PascalCase names (identifier regex is case-insensitive)', () => {
    // `[a-zA-Z_][a-zA-Z0-9_]*` — mixed case is legal for a JS-style identifier.
    expect([...extractVarRefs('{{ vars.WithUpper }}')]).toEqual(['WithUpper']);
  });

  it('rejects names starting with a digit', () => {
    expect([...extractVarRefs('{{ vars.1bad }}')]).toEqual([]);
  });
});

describe('assertVarRefSyntax', () => {
  it('accepts plain strings', () => {
    expect(() => assertVarRefSyntax('hello world', 'loc')).not.toThrow();
  });
  it('accepts valid var refs', () => {
    expect(() => assertVarRefSyntax('{{ vars.foo }}', 'loc')).not.toThrow();
    expect(() => assertVarRefSyntax('start {{ vars.a }} mid {{ vars.b }} end', 'loc')).not.toThrow();
  });
  it('rejects malformed template blocks', () => {
    expect(() => assertVarRefSyntax('{{ notvars }}', 'loc')).toThrow(/loc/);
    expect(() => assertVarRefSyntax('{{ vars. }}', 'loc')).toThrow(/loc/);
    expect(() => assertVarRefSyntax('{{ vars.1bad }}', 'loc')).toThrow();
  });
  it('includes the location in the error message', () => {
    expect(() => assertVarRefSyntax('{{ bad }}', 'my-field')).toThrow(/my-field/);
  });
});

describe('TenantVars', () => {
  const vars: Record<string, Var> = {
    apiKey: { type: 'plain', value: 'secret-abc' },
    dbUrl: { type: 'plain', value: 'postgres://x' },
    upcoming: { type: 'secretmanager', secretId: 'not-yet-impl' },
  };

  it('resolves a plain var', () => {
    expect(new TenantVars(vars).resolve('apiKey')).toBe('secret-abc');
  });

  it('throws on unknown var, listing available names', () => {
    const err = () => new TenantVars(vars).resolve('missing');
    expect(err).toThrow(/missing/);
    expect(err).toThrow(/apiKey/);
    expect(err).toThrow(/dbUrl/);
  });

  it('throws a friendly message on secretmanager (not yet implemented)', () => {
    expect(() => new TenantVars(vars).resolve('upcoming')).toThrow(/secretmanager/);
    expect(() => new TenantVars(vars).resolve('upcoming')).toThrow(/not-yet-impl/);
  });

  it('lists no available vars when empty', () => {
    expect(() => new TenantVars({}).resolve('x')).toThrow(/none/);
  });

  it('interpolates a single ref', () => {
    expect(new TenantVars(vars).interpolate('{{ vars.apiKey }}')).toBe('secret-abc');
  });

  it('interpolates multiple refs in one string', () => {
    expect(new TenantVars(vars).interpolate('key={{ vars.apiKey }};url={{ vars.dbUrl }}'))
      .toBe('key=secret-abc;url=postgres://x');
  });

  it('interpolates the same ref multiple times', () => {
    expect(new TenantVars(vars).interpolate('{{ vars.apiKey }}/{{ vars.apiKey }}'))
      .toBe('secret-abc/secret-abc');
  });

  it('leaves literal text unchanged', () => {
    expect(new TenantVars(vars).interpolate('no template here')).toBe('no template here');
  });

  it('interpolateOptional passes undefined through', () => {
    expect(new TenantVars(vars).interpolateOptional(undefined)).toBeUndefined();
  });

  it('interpolateOptional resolves defined values', () => {
    expect(new TenantVars(vars).interpolateOptional('{{ vars.apiKey }}')).toBe('secret-abc');
  });
});
