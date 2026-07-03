import { describe, expect, it } from 'vitest';

import { SLUG_REGEX, UUID_REGEX, VERSION_REGEX } from '../src/index.ts';

describe('registry public api smoke', () => {
  it('exports domain regexes usable at runtime', () => {
    expect(SLUG_REGEX.test('valid-slug')).toBe(true);
    expect(UUID_REGEX.test('00000000-0000-4000-8000-000000000000')).toBe(true);
    expect(VERSION_REGEX.test('1.0.0')).toBe(true);
  });

  it('rejects invalid inputs', () => {
    expect(SLUG_REGEX.test('Invalid_Slug')).toBe(false);
    expect(UUID_REGEX.test('not-a-uuid')).toBe(false);
  });
});
