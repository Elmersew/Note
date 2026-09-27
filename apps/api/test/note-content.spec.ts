import { describe, expect, it } from 'vitest';
import { extractPlainText, normalizePlainText } from '../src/common/note-content';

describe('note content extraction', () => {
  it('extracts text from a Tiptap document', () => {
    const document = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '第一段' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'text', text: '事项' }] }] },
      ],
    };

    expect(normalizePlainText(document)).toBe('第一段 事项');
  });

  it('ignores non-text scalar values', () => {
    expect(extractPlainText({ attrs: { level: 2 }, content: null })).toBe('');
  });
});
