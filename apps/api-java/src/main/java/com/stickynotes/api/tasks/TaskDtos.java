package com.stickynotes.api.tasks;

import com.stickynotes.api.contract.Dtos.TaskPriority;
import com.stickynotes.api.contract.Dtos.TaskStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class TaskDtos {

    private static final String UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

    private TaskDtos() {
    }

    public record CreateTaskRequest(
            @Pattern(regexp = UUID_PATTERN) String id,
            @NotBlank @Size(max = 255) String title,
            @Size(max = 10_000) String description,
            TaskStatus status,
            TaskPriority priority,
            String dueAt,
            @Pattern(regexp = UUID_PATTERN) String sourceNoteId) {
    }

    public record UpdateTaskRequest(
            @NotNull @Min(1) Integer baseVersion,
            @Size(max = 255) String title,
            @Size(max = 10_000) String description,
            TaskStatus status,
            TaskPriority priority,
            String dueAt) {

        public boolean hasDueAt() {
            return dueAt != null;
        }
    }
}
