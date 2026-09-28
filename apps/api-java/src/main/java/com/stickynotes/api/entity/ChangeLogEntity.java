package com.stickynotes.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.stickynotes.api.contract.Dtos.ChangeOperation;
import com.stickynotes.api.contract.Dtos.EntityType;

import java.time.Instant;

@TableName("change_log")
public class ChangeLogEntity {

    @TableId(type = IdType.AUTO)
    private Long cursor;
    private String userId;
    private EntityType entityType;
    private String entityId;
    private ChangeOperation operation;
    private Integer version;
    private Instant changedAt;

    public static ChangeLogEntity of(String userId, EntityType entityType, String entityId, ChangeOperation operation, int version) {
        ChangeLogEntity change = new ChangeLogEntity();
        change.setUserId(userId);
        change.setEntityType(entityType);
        change.setEntityId(entityId);
        change.setOperation(operation);
        change.setVersion(version);
        change.setChangedAt(Instant.now());
        return change;
    }

    public Long getCursor() {
        return cursor;
    }

    public void setCursor(Long cursor) {
        this.cursor = cursor;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public EntityType getEntityType() {
        return entityType;
    }

    public void setEntityType(EntityType entityType) {
        this.entityType = entityType;
    }

    public String getEntityId() {
        return entityId;
    }

    public void setEntityId(String entityId) {
        this.entityId = entityId;
    }

    public ChangeOperation getOperation() {
        return operation;
    }

    public void setOperation(ChangeOperation operation) {
        this.operation = operation;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    public Instant getChangedAt() {
        return changedAt;
    }

    public void setChangedAt(Instant changedAt) {
        this.changedAt = changedAt;
    }
}
