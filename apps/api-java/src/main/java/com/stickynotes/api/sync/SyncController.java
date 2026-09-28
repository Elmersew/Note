package com.stickynotes.api.sync;

import com.stickynotes.api.auth.AuthInterceptor;
import com.stickynotes.api.contract.Dtos.SyncOperationResult;
import com.stickynotes.api.contract.Dtos.SyncPullResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "sync")
@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private final SyncService syncService;

    public SyncController(SyncService syncService) {
        this.syncService = syncService;
    }

    @GetMapping
    public SyncPullResponse pull(HttpServletRequest request, @RequestParam(required = false) String cursor) {
        return syncService.pull(AuthInterceptor.currentUser(request).id(), cursor);
    }

    @PostMapping("/push")
    public List<SyncOperationResult> push(HttpServletRequest request,
                                          @Valid @RequestBody SyncDtos.SyncPushRequest input) {
        return syncService.push(AuthInterceptor.currentUser(request).id(), input.operations());
    }
}
