import type { JsonObject } from '@sticky-notes/contracts';

export function contentText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(contentText).filter(Boolean).join(' ');
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return [typeof record.text === 'string' ? record.text : '', contentText(record.content)].filter(Boolean).join(' ');
}

export function normalizeContentText(content: JsonObject): string {
  return contentText(content).replace(/\s+/g, ' ').trim();
}
