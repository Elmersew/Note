import { describe, expect, it } from 'vitest';
import { randomId } from './random-id';

describe('randomId', () => {
  it('returns a UUID v4', () => {
    expect(randomId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
