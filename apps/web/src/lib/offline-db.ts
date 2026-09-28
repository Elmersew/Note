import type { NoteDto, SyncOperation } from '@sticky-notes/contracts';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface CachedNote extends NoteDto {
  cacheKey: string;
  userId: string;
  pending: boolean;
}

export interface OutboxRecord extends SyncOperation {
  userId: string;
  createdAt: string;
}

interface StickyNotesDb extends DBSchema {
  notes: {
    key: string;
    value: CachedNote;
    indexes: { userId: string };
  };
  outbox: {
    key: string;
    value: OutboxRecord;
    indexes: { userId: string; entity: [string, string] };
  };
  meta: {
    key: string;
    value: { key: string; value: string };
  };
}

let databasePromise: Promise<IDBPDatabase<StickyNotesDb>> | undefined;

function database(): Promise<IDBPDatabase<StickyNotesDb>> {
  databasePromise ??= openDB<StickyNotesDb>('sticky-notes-web', 1, {
    upgrade(db) {
      const notes = db.createObjectStore('notes', { keyPath: 'cacheKey' });
      notes.createIndex('userId', 'userId');
      const outbox = db.createObjectStore('outbox', { keyPath: 'idempotencyKey' });
      outbox.createIndex('userId', 'userId');
      outbox.createIndex('entity', ['userId', 'entityId']);
      db.createObjectStore('meta', { keyPath: 'key' });
    },
  });
  return databasePromise;
}

export async function getCachedNotes(userId: string): Promise<CachedNote[]> {
  return (await database()).getAllFromIndex('notes', 'userId', userId);
}

export async function putCachedNote(userId: string, note: NoteDto, pending = false): Promise<void> {
  await (await database()).put('notes', { ...note, cacheKey: `${userId}:${note.id}`, userId, pending });
}

export async function removeCachedNote(userId: string, noteId: string): Promise<void> {
  await (await database()).delete('notes', `${userId}:${noteId}`);
}

export async function cacheServerNotes(userId: string, notes: NoteDto[]): Promise<void> {
  const db = await database();
  const tx = db.transaction(['notes', 'outbox'], 'readwrite');
  const pending = await tx.objectStore('outbox').index('userId').getAll(userId);
  const pendingIds = new Set(pending.map(({ entityId }) => entityId));
  for (const note of notes) {
    if (!pendingIds.has(note.id)) await tx.objectStore('notes').put({ ...note, cacheKey: `${userId}:${note.id}`, userId, pending: false });
  }
  await tx.done;
}

export async function enqueueOperation(operation: OutboxRecord): Promise<void> {
  await (await database()).put('outbox', operation);
}

export async function getOutbox(userId: string): Promise<OutboxRecord[]> {
  const records = await (await database()).getAllFromIndex('outbox', 'userId', userId);
  return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deleteOutboxRecord(idempotencyKey: string): Promise<void> {
  await (await database()).delete('outbox', idempotencyKey);
}

export async function rebaseEntityOperations(userId: string, entityId: string, baseVersion: number): Promise<boolean> {
  const db = await database();
  const tx = db.transaction('outbox', 'readwrite');
  const records = await tx.store.index('entity').getAll([userId, entityId]);
  for (const record of records) await tx.store.put({ ...record, baseVersion });
  await tx.done;
  return records.length > 0;
}

export async function updateCachedNoteVersion(userId: string, noteId: string, version: number): Promise<void> {
  const db = await database();
  const key = `${userId}:${noteId}`;
  const note = await db.get('notes', key);
  if (note) await db.put('notes', { ...note, version, pending: true });
}

export async function deleteEntityOperations(userId: string, entityId: string): Promise<void> {
  const db = await database();
  const tx = db.transaction('outbox', 'readwrite');
  const records = await tx.store.index('entity').getAll([userId, entityId]);
  for (const record of records) await tx.store.delete(record.idempotencyKey);
  await tx.done;
}

export async function getSyncCursor(userId: string): Promise<string> {
  return (await (await database()).get('meta', `${userId}:cursor`))?.value ?? '0';
}

export async function setSyncCursor(userId: string, value: string): Promise<void> {
  await (await database()).put('meta', { key: `${userId}:cursor`, value });
}

export async function clearAccountCache(userId: string): Promise<void> {
  const db = await database();
  const tx = db.transaction(['notes', 'outbox', 'meta'], 'readwrite');
  for (const note of await tx.objectStore('notes').index('userId').getAll(userId)) await tx.objectStore('notes').delete(note.cacheKey);
  for (const item of await tx.objectStore('outbox').index('userId').getAll(userId)) await tx.objectStore('outbox').delete(item.idempotencyKey);
  await tx.objectStore('meta').delete(`${userId}:cursor`);
  await tx.done;
}
