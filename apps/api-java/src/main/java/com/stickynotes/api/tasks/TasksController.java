package com.stickynotes.api.tasks;

import com.stickynotes.api.auth.AuthInterceptor;
import com.stickynotes.api.contract.Dtos.TaskDto;
import com.stickynotes.api.contract.Dtos.TaskStatus;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "tasks")
@RestController
@RequestMapping("/api/tasks")
public class TasksController {

    private final TasksService tasksService;

    public TasksController(TasksService tasksService) {
        this.tasksService = tasksService;
    }

    @GetMapping
    public List<TaskDto> list(HttpServletRequest request, @RequestParam(required = false) TaskStatus status) {
        return tasksService.list(AuthInterceptor.currentUser(request).id(), status);
    }

    @PostMapping
    public TaskDto create(HttpServletRequest request, @Valid @RequestBody TaskDtos.CreateTaskRequest input) {
        return tasksService.create(AuthInterceptor.currentUser(request).id(), input);
    }

    @PatchMapping("/{id}")
    public TaskDto update(HttpServletRequest request, @PathVariable String id,
                          @Valid @RequestBody TaskDtos.UpdateTaskRequest input) {
        return tasksService.update(AuthInterceptor.currentUser(request).id(), id, input);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(HttpServletRequest request, @PathVariable String id) {
        tasksService.remove(AuthInterceptor.currentUser(request).id(), id);
        return ResponseEntity.noContent().build();
    }
}
