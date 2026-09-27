import type { JsonObject, NoteDto, SyncOperationResult } from '@sticky-notes/contracts';
import { syncApi } from './api';
import {
  deleteEntityOperations,
  deleteOutboxRecord,
  enqueueOperation,
  getOutbox,
  putCachedNote,
  removeCachedNote,
  type CachedNote,
  type OutboxRecord,
} from './offline-db';

export type SyncCallbacks = {
  onApplied: (note: NoteDto) => void;
  onConflict: (serverNote: NoteDto, localCopy: NoteDto) => void;
  onError: (message: string) => void;
};

export async function queueNoteUpsert(userId: string, note: NoteDto): Promise<void> {
  await putCachedNote(userId, note, true);
  await enqueueOperation({
    userId,
    idempotencyKey: crypto.randomUUID(),
    entityType: 'NOTE',
    entityId: note.id,
    operation: 'UPSERT',
    baseVersion: note.version || null,
    payload: {
      title: note.title,
      content: note.content,
      tags: note.tags.map(({ name }) => name),
      isPinned: note.isPinned,
      isArchived: note.isArchived,
    },
    createdAt: new Date().toISOString(),
  });
}

export async function queueNoteDelete(userId: string, note: NoteDto): Promise<void> {
  const pending = await getOutbox(userId);
  const createOperation = pending.find(({ entityId, operation, baseVersion }) => entityId === note.id && operation === 'UPSERT' && baseVersion == null);
  if (createOperation) {
    await deleteEntityOperations(userId, note.id);
    await removeCachedNote(userId, note.id);
    return;
  }
  await enqueueOperation({
    userId,
    idempotencyKey: crypto.randomUUID(),
    entityType: 'NOTE',
    entityId: note.id,
    operation: 'DELETE',
    baseVersion: note.version,
    createdAt: new Date().toISOString(),
  });
  await putCachedNote(userId, { ...note, deletedAt: new Date().toISOString() }, true);
}

export async function flushNoteOutbox(userId: string, callbacks: SyncCallbacks): Promise<void> {
  if (!navigator.onLine) return;
  const records = await getOutbox(userId);
  for (const record of records) {
    try {
      const [result] = await syncApi.push([stripLocalFields(record)]);
      if (!result) continue;
      await handleResult(userId, record, result, callbacks);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error.message : '同步失败');
      return;
    }
  }
}

async function handleResult(
  userId: string,
  record: OutboxRecord,
  result: SyncOperationResult,
  callbacks: SyncCallbacks,
): Promise<void> {
  if (result.status === 'failed') {
    callbacks.onError(result.message ?? '同步失败');
    return;
  }
  await deleteOutboxRecord(record.idempotencyKey);
  if (result.status === 'applied') {
    if (result.entity && 'content' in result.entity) {
      await putCachedNote(userId, result.entity, false);
      callbacks.onApplied(result.entity);
    } else if (record.operation === 'DELETE') {
      await removeCachedNote(userId, record.entityId);
    }
    return;
  }

  if (result.entity && 'content' in result.entity) {
    const local = await localConflictCopy(userId, record);
    await putCachedNote(userId, result.entity, false);
    callbacks.onConflict(result.entity, local);
  }
}

async function localConflictCopy(userId: string, record: OutboxRecord): Promise<NoteDto> {
  const payload = record.payload ?? {};
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const tagNames = Array.isArray(payload.tags) ? payload.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  const copy: NoteDto = {
    id,
    title: `${typeof payload.title === 'string' ? payload.title : '未命名便签'}（冲突副本）`,
    content: payload.content as JsonObject,
    plainText: '',
    isPinned: payload.isPinned === true,
    isArchived: payload.isArchived === true,
    deletedAt: null,
    version: 0,
    tags: tagNames.map((name) => ({ id: `local:${name}`, name, color: '#6d5dfc' })),
    createdAt: now,
    updatedAt: now,
  };
  await queueNoteUpsert(userId, copy);
  return copy;
}

function stripLocalFields(record: OutboxRecord): Omit<OutboxRecord, 'userId' | 'createdAt'> {
  const { userId: _userId, createdAt: _createdAt, ...operation } = record;
  return operation;
}

export function createLocalNote(): CachedNote {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return {
    cacheKey: id,
    userId: '',
    pending: true,
    id,
    title: '',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    plainText: '',
    isPinned: false,
    isArchived: false,
    deletedAt: null,
    version: 0,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}
