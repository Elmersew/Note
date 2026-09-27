import { describe, expect, it } from 'vitest';
import { normalizeContentText } from './content';

describe('normalizeContentText', () => {
  it('flattens structured editor content', () => {
    expect(normalizeContentText({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '你好' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '世界' }] },
      ],
    })).toBe('你好 世界');
  });
});
