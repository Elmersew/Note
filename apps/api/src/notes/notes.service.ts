import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ChangeOperation, EntityType, Prisma } from '@prisma/client';
import type { ChangeDto, NoteDto, TagDto } from '@sticky-notes/contracts';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { normalizePlainText } from '../common/note-content';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { noteInclude, toChangeDto, toNoteDto } from './note.mapper';
import type { CreateNoteDto, ListNotesQueryDto, ShareNoteDto, UpdateNoteDto } from './notes.dto';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(userId: string, query: ListNotesQueryDto): Promise<NoteDto[]> {
    const where: Prisma.NoteWhereInput = {
      userId,
      deletedAt: query.trash ? { not: null } : null,
      ...(query.archived !== undefined ? { isArchived: query.archived } : query.trash ? {} : { isArchived: false }),
    };

    if (query.tag) where.tags = { some: { tag: { name: query.tag } } };
    const search = query.q?.trim();
    if (search) {
      if (search.length >= 2) {
        const deletedCondition = query.trash ? Prisma.sql`deleted_at IS NOT NULL` : Prisma.sql`deleted_at IS NULL`;
        const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id FROM notes
          WHERE user_id = ${userId}
            AND ${deletedCondition}
            AND MATCH(title, plain_text) AGAINST (${search} IN NATURAL LANGUAGE MODE)
          ORDER BY is_pinned DESC, updated_at DESC
          LIMIT 200
        `);
        where.id = { in: rows.map(({ id }) => id) };
      } else {
        where.OR = [{ title: { contains: search } }, { plainText: { contains: search } }];
      }
    }

    const notes = await this.prisma.note.findMany({
      where,
      include: noteInclude,
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });
    return notes.map(toNoteDto);
  }

  async listTags(userId: string): Promise<TagDto[]> {
    return this.prisma.tag.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
  }

  async get(userId: string, id: string): Promise<NoteDto> {
    const note = await this.prisma.note.findFirst({ where: { id, userId }, include: noteInclude });
    if (!note) throw new NotFoundException('便签不存在');
    return toNoteDto(note);
  }

  async create(userId: string, input: CreateNoteDto): Promise<NoteDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const note = await tx.note.create({
        data: {
          id: input.id ?? randomUUID(),
          userId,
          title: input.title.trim(),
          content: input.content as Prisma.InputJsonObject,
          plainText: normalizePlainText(input.content),
          isPinned: input.isPinned ?? false,
          isArchived: input.isArchived ?? false,
        },
      });
      await this.replaceTags(tx, userId, note.id, input.tags ?? []);
      const complete = await tx.note.findUniqueOrThrow({ where: { id: note.id }, include: noteInclude });
      const change = await tx.changeLog.create({
        data: { userId, entityType: EntityType.NOTE, entityId: note.id, operation: ChangeOperation.UPSERT, version: note.version },
      });
      return { note: toNoteDto(complete), change: toChangeDto(change) };
    });
    this.realtime.emitChange(userId, result.change);
    return result.note;
  }

  async update(userId: string, id: string, input: UpdateNoteDto): Promise<NoteDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.note.findFirst({ where: { id, userId } });
      if (!current) throw new NotFoundException('便签不存在');
      if (current.version !== input.baseVersion) throw new ConflictException({ message: '便签已在其他设备更新', serverVersion: current.version });

      const updateResult = await tx.note.updateMany({
        where: { id, userId, version: input.baseVersion },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.content !== undefined
            ? { content: input.content as Prisma.InputJsonObject, plainText: normalizePlainText(input.content) }
            : {}),
          ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
          ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
          version: { increment: 1 },
        },
      });
      if (updateResult.count !== 1) throw new ConflictException('便签已在其他设备更新');
      if (input.tags !== undefined) await this.replaceTags(tx, userId, id, input.tags);

      const note = await tx.note.findUniqueOrThrow({ where: { id }, include: noteInclude });
      const change = await tx.changeLog.create({
        data: { userId, entityType: EntityType.NOTE, entityId: id, operation: ChangeOperation.UPSERT, version: note.version },
      });
      return { note: toNoteDto(note), change: toChangeDto(change) };
    });
    this.realtime.emitChange(userId, result.change);
    return result.note;
  }

  async softDelete(userId: string, id: string, baseVersion?: number): Promise<void> {
    await this.setDeletedState(userId, id, true, baseVersion);
  }

  async restore(userId: string, id: string, baseVersion: number): Promise<NoteDto> {
    return this.setDeletedState(userId, id, false, baseVersion);
  }

  async permanentlyDelete(userId: string, id: string): Promise<void> {
    const change = await this.prisma.$transaction(async (tx) => {
      const note = await tx.note.findFirst({ where: { id, userId, deletedAt: { not: null } } });
      if (!note) throw new NotFoundException('回收站中不存在该便签');
      await tx.note.delete({ where: { id } });
      return tx.changeLog.create({
        data: { userId, entityType: EntityType.NOTE, entityId: id, operation: ChangeOperation.DELETE, version: note.version + 1 },
      });
    });
    this.realtime.emitChange(userId, toChangeDto(change));
  }

  async createShare(userId: string, noteId: string, input: ShareNoteDto): Promise<{ token: string; expiresAt: string | null }> {
    const note = await this.prisma.note.findFirst({ where: { id: noteId, userId, deletedAt: null } });
    if (!note) throw new NotFoundException('便签不存在');
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) throw new ConflictException('过期时间必须晚于当前时间');

    const token = randomBytes(32).toString('base64url');
    await this.prisma.noteShare.create({
      data: { noteId, tokenHash: this.hashToken(token), expiresAt },
    });
    return { token, expiresAt: expiresAt?.toISOString() ?? null };
  }

  async revokeShares(userId: string, noteId: string): Promise<void> {
    const note = await this.prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) throw new NotFoundException('便签不存在');
    await this.prisma.noteShare.updateMany({ where: { noteId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async getShared(token: string): Promise<NoteDto> {
    const share = await this.prisma.noteShare.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        note: { deletedAt: null },
      },
      include: { note: { include: noteInclude } },
    });
    if (!share) throw new NotFoundException('分享链接不存在或已失效');
    return toNoteDto(share.note);
  }

  private async setDeletedState(userId: string, id: string, deleted: boolean, baseVersion?: number): Promise<NoteDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.note.findFirst({ where: { id, userId } });
      if (!current) throw new NotFoundException('便签不存在');
      if (baseVersion !== undefined && current.version !== baseVersion) throw new ConflictException('便签已在其他设备更新');
      const note = await tx.note.update({
        where: { id },
        data: { deletedAt: deleted ? new Date() : null, version: { increment: 1 } },
        include: noteInclude,
      });
      const change = await tx.changeLog.create({
        data: {
          userId,
          entityType: EntityType.NOTE,
          entityId: id,
          operation: deleted ? ChangeOperation.DELETE : ChangeOperation.UPSERT,
          version: note.version,
        },
      });
      return { note: toNoteDto(note), change: toChangeDto(change) };
    });
    this.realtime.emitChange(userId, result.change);
    return result.note;
  }

  private async replaceTags(tx: Prisma.TransactionClient, userId: string, noteId: string, names: string[]): Promise<void> {
    const normalized = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(0, 20);
    const tags = [];
    for (const name of normalized) {
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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
