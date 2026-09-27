import { Injectable } from '@nestjs/common';
import { ChangeOperation, EntityType, Prisma } from '@prisma/client';
import type { JsonObject, SyncOperationResult, SyncPullResponse } from '@sticky-notes/contracts';
import { normalizePlainText } from '../common/note-content';
import { noteInclude, toChangeDto, toNoteDto } from '../notes/note.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { SyncOperationDto } from './sync.dto';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async pull(userId: string, cursorValue = '0'): Promise<SyncPullResponse> {
    const cursor = BigInt(cursorValue);
    const changes = await this.prisma.changeLog.findMany({
      where: { userId, cursor: { gt: cursor } },
      orderBy: { cursor: 'asc' },
      take: 500,
    });
    return {
      cursor: changes.at(-1)?.cursor.toString() ?? cursor.toString(),
      changes: changes.map(toChangeDto),
    };
  }

  async push(userId: string, operations: SyncOperationDto[]): Promise<SyncOperationResult[]> {
    const results: SyncOperationResult[] = [];
    for (const operation of operations) {
      if (operation.entityType !== EntityType.NOTE) {
        results.push({ idempotencyKey: operation.idempotencyKey, status: 'failed', message: '离线同步目前仅支持便签' });
        continue;
      }
      const applied = await this.applyNoteOperation(userId, operation);
      results.push(applied.result);
      if (applied.change) this.realtime.emitChange(userId, applied.change);
    }
    return results;
  }

  private async applyNoteOperation(
    userId: string,
    operation: SyncOperationDto,
  ): Promise<{ result: SyncOperationResult; change?: ReturnType<typeof toChangeDto> }> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.mutation.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: operation.idempotencyKey } },
      });
      if (previous) return { result: previous.response as unknown as SyncOperationResult };

      const current = await tx.note.findFirst({ where: { id: operation.entityId, userId }, include: noteInclude });
      let result: SyncOperationResult;
      let change: Awaited<ReturnType<typeof tx.changeLog.create>> | undefined;

      if (operation.operation === ChangeOperation.DELETE) {
        if (!current) {
          result = { idempotencyKey: operation.idempotencyKey, status: 'applied' };
        } else if (operation.baseVersion != null && current.version !== operation.baseVersion) {
          result = { idempotencyKey: operation.idempotencyKey, status: 'conflict', entity: toNoteDto(current), message: '服务端版本更新' };
        } else {
          const note = await tx.note.update({
            where: { id: current.id },
            data: { deletedAt: new Date(), version: { increment: 1 } },
            include: noteInclude,
          });
          change = await tx.changeLog.create({
            data: { userId, entityType: EntityType.NOTE, entityId: note.id, operation: ChangeOperation.DELETE, version: note.version },
          });
          result = { idempotencyKey: operation.idempotencyKey, status: 'applied', entity: toNoteDto(note) };
        }
      } else if (!current) {
        if (operation.baseVersion != null && operation.baseVersion !== 0) {
          result = { idempotencyKey: operation.idempotencyKey, status: 'conflict', message: '服务端不存在该便签' };
        } else {
          const payload = this.parsePayload(operation.payload);
          await tx.note.create({
            data: {
              id: operation.entityId,
              userId,
              title: payload.title,
              content: payload.content as Prisma.InputJsonObject,
              plainText: normalizePlainText(payload.content),
              isPinned: payload.isPinned,
              isArchived: payload.isArchived,
            },
          });
          await this.replaceTags(tx, userId, operation.entityId, payload.tags);
          const note = await tx.note.findUniqueOrThrow({ where: { id: operation.entityId }, include: noteInclude });
          change = await tx.changeLog.create({
            data: { userId, entityType: EntityType.NOTE, entityId: note.id, operation: ChangeOperation.UPSERT, version: note.version },
          });
          result = { idempotencyKey: operation.idempotencyKey, status: 'applied', entity: toNoteDto(note) };
        }
      } else if (operation.baseVersion !== current.version) {
        result = { idempotencyKey: operation.idempotencyKey, status: 'conflict', entity: toNoteDto(current), message: '服务端版本更新' };
      } else {
        const payload = this.parsePayload(operation.payload);
        await tx.note.update({
          where: { id: current.id },
          data: {
            title: payload.title,
            content: payload.content as Prisma.InputJsonObject,
            plainText: normalizePlainText(payload.content),
            isPinned: payload.isPinned,
            isArchived: payload.isArchived,
            deletedAt: null,
            version: { increment: 1 },
          },
        });
        await this.replaceTags(tx, userId, current.id, payload.tags);
        const note = await tx.note.findUniqueOrThrow({ where: { id: current.id }, include: noteInclude });
        change = await tx.changeLog.create({
          data: { userId, entityType: EntityType.NOTE, entityId: note.id, operation: ChangeOperation.UPSERT, version: note.version },
        });
        result = { idempotencyKey: operation.idempotencyKey, status: 'applied', entity: toNoteDto(note) };
      }

      await tx.mutation.create({
        data: {
          userId,
          idempotencyKey: operation.idempotencyKey,
          response: result as unknown as Prisma.InputJsonObject,
        },
      });
      return { result, ...(change ? { change: toChangeDto(change) } : {}) };
    });
  }

  private parsePayload(payload: Record<string, unknown> | undefined): {
    title: string;
    content: JsonObject;
    tags: string[];
    isPinned: boolean;
    isArchived: boolean;
  } {
    const title = typeof payload?.title === 'string' ? payload.title.trim().slice(0, 255) : '';
    const content = payload?.content;
    if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error('便签内容格式无效');
    const tags = Array.isArray(payload.tags)
      ? payload.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim().slice(0, 64)).filter(Boolean).slice(0, 20)
      : [];
    return {
      title,
      content: content as JsonObject,
      tags: [...new Set(tags)],
      isPinned: payload.isPinned === true,
      isArchived: payload.isArchived === true,
    };
  }

  private async replaceTags(tx: Prisma.TransactionClient, userId: string, noteId: string, names: string[]): Promise<void> {
    const tags = [];
    for (const name of names) {
      tags.push(
        await tx.tag.upsert({
          where: { userId_name: { userId, name } },
          update: {},
          create: { userId, name },
        }),
      );
    }
    await tx.noteTag.deleteMany({ where: { noteId } });
    if (tags.length) await tx.noteTag.createMany({ data: tags.map((tag) => ({ noteId, tagId: tag.id })) });
  }
}
