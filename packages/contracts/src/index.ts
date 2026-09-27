export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export interface SessionUser {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
}

export interface TagDto {
  id: string;
  name: string;
  color: string;
}

export interface NoteDto {
  id: string;
  title: string;
  content: JsonObject;
  plainText: string;
  isPinned: boolean;
  isArchived: boolean;
  deletedAt: string | null;
  version: number;
  tags: TagDto[];
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TaskDto {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  sourceNoteId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventDto {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  isAllDay: boolean;
  location: string | null;
  sourceNoteId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type EntityType = 'NOTE' | 'TASK' | 'EVENT';
export type ChangeOperation = 'UPSERT' | 'DELETE';

export interface ChangeDto {
  cursor: string;
  entityType: EntityType;
  entityId: string;
  operation: ChangeOperation;
  version: number;
  changedAt: string;
}

export interface SyncOperation {
  idempotencyKey: string;
  entityType: EntityType;
  entityId: string;
  operation: ChangeOperation;
  baseVersion: number | null;
  payload?: JsonObject;
}

export interface SyncOperationResult {
  idempotencyKey: string;
  status: 'applied' | 'conflict' | 'failed';
  entity?: NoteDto | TaskDto | CalendarEventDto;
  message?: string;
}

export interface SyncPullResponse {
  cursor: string;
  changes: ChangeDto[];
}

export type AiOperation = 'POLISH' | 'SUMMARIZE' | 'CONTINUE' | 'KEY_POINTS' | 'CLASSIFY';

export interface AiResult {
  content: string;
  suggestedTags?: string[];
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}
