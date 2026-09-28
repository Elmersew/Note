package com.stickynotes.api.sync;

import com.stickynotes.api.contract.Dtos.ChangeOperation;
import com.stickynotes.api.contract.Dtos.EntityType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public final class SyncDtos {

    private static final String UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

    private SyncDtos() {
    }

    public record SyncOperationRequest(
            @Pattern(regexp = UUID_PATTERN) String idempotencyKey,
            @NotNull EntityType entityType,
            @Pattern(regexp = UUID_PATTERN) String entityId,
            @NotNull ChangeOperation operation,
            @Min(0) Integer baseVersion,
            Map<String, Object> payload) {
    }

    public record SyncPushRequest(@NotNull @Size(max = 100) List<@Valid SyncOperationRequest> operations) {
    }
}
