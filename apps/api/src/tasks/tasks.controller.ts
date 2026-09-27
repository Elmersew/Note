import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { SessionUser, TaskDto } from '@sticky-notes/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTaskDto, ListTasksQueryDto, UpdateTaskDto } from './tasks.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiCookieAuth()
@UseGuards(AuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(@CurrentUser() user: SessionUser, @Query() query: ListTasksQueryDto): Promise<TaskDto[]> {
    return this.tasksService.list(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body() input: CreateTaskDto): Promise<TaskDto> {
    return this.tasksService.create(user.id, input);
  }

  @Patch(':id')
  update(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() input: UpdateTaskDto): Promise<TaskDto> {
    return this.tasksService.update(user.id, id, input);
  }

  @HttpCode(204)
  @Delete(':id')
  async remove(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<void> {
    await this.tasksService.remove(user.id, id);
  }
}
