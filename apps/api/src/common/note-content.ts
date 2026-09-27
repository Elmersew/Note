const MAX_CONTENT_DEPTH = 40;

export function extractPlainText(value: unknown, depth = 0): string {
  if (depth > MAX_CONTENT_DEPTH || value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => extractPlainText(item, depth + 1)).filter(Boolean).join(' ');
  if (typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  const ownText = typeof record.text === 'string' ? record.text : '';
  const childText = extractPlainText(record.content, depth + 1);
  return [ownText, childText].filter(Boolean).join(' ');
}

export function normalizePlainText(value: unknown): string {
  return extractPlainText(value).replace(/\s+/g, ' ').trim().slice(0, 1_000_000);
}
