import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ChangeOperation, EntityType, Task } from '@prisma/client';
import type { TaskDto } from '@sticky-notes/contracts';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { toChangeDto } from '../notes/note.mapper';
import type { CreateTaskDto, ListTasksQueryDto, UpdateTaskDto } from './tasks.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(userId: string, query: ListTasksQueryDto): Promise<TaskDto[]> {
    const tasks = await this.prisma.task.findMany({
      where: { userId, deletedAt: null, ...(query.status ? { status: query.status } : {}) },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 300,
    });
    return tasks.map(this.toDto);
  }

  async create(userId: string, input: CreateTaskDto): Promise<TaskDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      if (input.sourceNoteId) {
        const source = await tx.note.findFirst({ where: { id: input.sourceNoteId, userId, deletedAt: null } });
        if (!source) throw new NotFoundException('来源便签不存在');
      }
      const task = await tx.task.create({
        data: {
          id: input.id ?? randomUUID(),
          userId,
          title: input.title.trim(),
          description: input.description ?? '',
          status: input.status,
          priority: input.priority,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          sourceNoteId: input.sourceNoteId ?? null,
        },
      });
      const change = await tx.changeLog.create({
        data: { userId, entityType: EntityType.TASK, entityId: task.id, operation: ChangeOperation.UPSERT, version: task.version },
      });
      return { task, change };
    });
    this.realtime.emitChange(userId, toChangeDto(result.change));
    return this.toDto(result.task);
  }

  async update(userId: string, id: string, input: UpdateTaskDto): Promise<TaskDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.task.findFirst({ where: { id, userId, deletedAt: null } });
      if (!current) throw new NotFoundException('任务不存在');
      if (current.version !== input.baseVersion) throw new ConflictException('任务已在其他设备更新');
      const updated = await tx.task.updateMany({
        where: { id, userId, version: input.baseVersion },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException('任务已在其他设备更新');
      const task = await tx.task.findUniqueOrThrow({ where: { id } });
      const change = await tx.changeLog.create({
        data: { userId, entityType: EntityType.TASK, entityId: id, operation: ChangeOperation.UPSERT, version: task.version },
      });
      return { task, change };
    });
    this.realtime.emitChange(userId, toChangeDto(result.change));
    return this.toDto(result.task);
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.task.findFirst({ where: { id, userId, deletedAt: null } });
      if (!current) throw new NotFoundException('任务不存在');
      const task = await tx.task.update({ where: { id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
      const change = await tx.changeLog.create({
        data: { userId, entityType: EntityType.TASK, entityId: id, operation: ChangeOperation.DELETE, version: task.version },
      });
      return { task, change };
    });
    this.realtime.emitChange(userId, toChangeDto(result.change));
  }

  private toDto(task: Task): TaskDto {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt?.toISOString() ?? null,
      sourceNoteId: task.sourceNoteId,
      version: task.version,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}
