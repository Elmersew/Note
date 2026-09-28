import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteEntityOperations, deleteOutboxRecord, enqueueOperation, getOutbox, rebaseEntityOperations, type OutboxRecord } from './offline-db';

const userId = 'sync-race-user';
const entityId = '11111111-1111-4111-8111-111111111111';

function operation(idempotencyKey: string, title: string, baseVersion: number | null): OutboxRecord {
  return {
    userId,
    idempotencyKey,
    entityType: 'NOTE',
    entityId,
    operation: 'UPSERT',
    baseVersion,
    payload: { title, content: { type: 'doc', content: [] } },
    createdAt: new Date().toISOString(),
  };
}

afterEach(async () => {
  await deleteEntityOperations(userId, entityId);
});

describe('offline outbox', () => {
  it('keeps edits queued during creation and rebases them to the server version', async () => {
    await enqueueOperation(operation('11111111-1111-4111-8111-111111111112', '', null));
    await enqueueOperation(operation('11111111-1111-4111-8111-111111111113', '正文已更新', 0));

    expect(await getOutbox(userId)).toHaveLength(2);
    await deleteOutboxRecord('11111111-1111-4111-8111-111111111112');
    expect(await rebaseEntityOperations(userId, entityId, 1)).toBe(true);

    const [pending] = await getOutbox(userId);
    expect(pending?.baseVersion).toBe(1);
    expect(pending?.payload?.title).toBe('正文已更新');
  });
});
