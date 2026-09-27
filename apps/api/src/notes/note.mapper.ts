import { ChangeLog, Prisma } from '@prisma/client';
import type { ChangeDto, JsonObject, NoteDto } from '@sticky-notes/contracts';

export const noteInclude = {
  tags: { include: { tag: true } },
} satisfies Prisma.NoteInclude;

export type NoteWithTags = Prisma.NoteGetPayload<{ include: typeof noteInclude }>;

export function toNoteDto(note: NoteWithTags): NoteDto {
  return {
    id: note.id,
    title: note.title,
    content: note.content as JsonObject,
    plainText: note.plainText,
    isPinned: note.isPinned,
    isArchived: note.isArchived,
    deletedAt: note.deletedAt?.toISOString() ?? null,
    version: note.version,
    tags: note.tags.map(({ tag }) => ({ id: tag.id, name: tag.name, color: tag.color })),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export function toChangeDto(change: ChangeLog): ChangeDto {
  return {
    cursor: change.cursor.toString(),
    entityType: change.entityType,
    entityId: change.entityId,
    operation: change.operation,
    version: change.version,
    changedAt: change.changedAt.toISOString(),
  };
}
