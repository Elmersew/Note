package com.stickynotes.api.tasks;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.stickynotes.api.common.ApiException;
import com.stickynotes.api.contract.Dtos.ChangeOperation;
import com.stickynotes.api.contract.Dtos.EntityType;
import com.stickynotes.api.contract.Dtos.TaskDto;
import com.stickynotes.api.contract.Dtos.TaskPriority;
import com.stickynotes.api.contract.Dtos.TaskStatus;
import com.stickynotes.api.entity.TaskEntity;
import com.stickynotes.api.mapper.TaskMapper;
import com.stickynotes.api.notes.NotesService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class TasksService {

    private final TaskMapper taskMapper;
    private final NotesService notesService;

    public TasksService(TaskMapper taskMapper, NotesService notesService) {
        this.taskMapper = taskMapper;
        this.notesService = notesService;
    }

    public List<TaskDto> list(String userId, TaskStatus status) {
        QueryWrapper<TaskEntity> query = new QueryWrapper<>();
        query.eq("user_id", userId).isNull("deleted_at");
        if (status != null) {
            query.eq("status", status.name());
        }
        query.orderByAsc("status").orderByAsc("due_at").orderByDesc("updated_at").last("LIMIT 300");
        return taskMapper.selectList(query).stream().map(TasksService::toDto).toList();
    }

    @Transactional
    public TaskDto create(String userId, TaskDtos.CreateTaskRequest input) {
        if (input.sourceNoteId() != null) {
            notesService.findOwnedActive(userId, input.sourceNoteId());
        }
        TaskEntity task = new TaskEntity();
        task.setId(input.id() != null ? input.id() : UUID.randomUUID().toString());
        task.setUserId(userId);
        task.setTitle(input.title().trim());
        task.setDescription(input.description() == null ? "" : input.description());
        task.setStatus(input.status() == null ? TaskStatus.TODO : input.status());
        task.setPriority(input.priority() == null ? TaskPriority.MEDIUM : input.priority());
        task.setDueAt(parseInstant(input.dueAt()));
        task.setSourceNoteId(input.sourceNoteId());
        task.setVersion(1);
        Instant now = Instant.now();
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        taskMapper.insert(task);
        notesService.emit(userId, EntityType.TASK, task.getId(), ChangeOperation.UPSERT, 1);
        return toDto(task);
    }

    @Transactional
    public TaskDto update(String userId, String id, TaskDtos.UpdateTaskRequest input) {
        TaskEntity current = findOwned(userId, id);
        if (!Objects.equals(current.getVersion(), input.baseVersion())) {
            throw ApiException.conflict("任务已在其他设备更新");
        }
        UpdateWrapper<TaskEntity> update = new UpdateWrapper<>();
        update.eq("id", id).eq("user_id", userId).eq("version", input.baseVersion());
        update.set("version", current.getVersion() + 1).set("updated_at", Instant.now());
        if (input.title() != null) {
            update.set("title", input.title().trim());
        }
        if (input.description() != null) {
            update.set("description", input.description());
        }
        if (input.status() != null) {
            update.set("status", input.status().name());
        }
        if (input.priority() != null) {
            update.set("priority", input.priority().name());
        }
        if (input.dueAt() != null) {
            update.set("due_at", input.dueAt().isBlank() ? null : parseInstant(input.dueAt()));
        }
        if (taskMapper.update(null, update) != 1) {
            throw ApiException.conflict("任务已在其他设备更新");
        }
        TaskDto dto = toDto(taskMapper.selectById(id));
        notesService.emit(userId, EntityType.TASK, id, ChangeOperation.UPSERT, dto.version());
        return dto;
    }

    @Transactional
    public void remove(String userId, String id) {
        TaskEntity current = findOwned(userId, id);
        UpdateWrapper<TaskEntity> update = new UpdateWrapper<>();
        update.eq("id", id)
                .set("deleted_at", Instant.now())
                .set("version", current.getVersion() + 1)
                .set("updated_at", Instant.now());
        taskMapper.update(null, update);
        notesService.emit(userId, EntityType.TASK, id, ChangeOperation.DELETE, current.getVersion() + 1);
    }

    private TaskEntity findOwned(String userId, String id) {
        TaskEntity task = taskMapper.selectOne(new QueryWrapper<TaskEntity>()
                .eq("id", id).eq("user_id", userId).isNull("deleted_at").last("LIMIT 1"));
        if (task == null) {
            throw ApiException.notFound("任务不存在");
        }
        return task;
    }

    private static Instant parseInstant(String value) {
        return value == null || value.isBlank() ? null : Instant.parse(value);
    }

    static TaskDto toDto(TaskEntity task) {
        return new TaskDto(task.getId(), task.getTitle(), task.getDescription(), task.getStatus(), task.getPriority(),
                task.getDueAt(), task.getSourceNoteId(), task.getVersion() == null ? 1 : task.getVersion(),
                task.getCreatedAt(), task.getUpdatedAt());
    }
}
