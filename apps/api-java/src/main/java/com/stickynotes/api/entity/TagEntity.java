package com.stickynotes.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;
import java.util.UUID;

@TableName("tags")
public class TagEntity {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String userId;
    private String name;
    private String color;
    private Instant createdAt;

    public static TagEntity of(String userId, String name) {
        TagEntity tag = new TagEntity();
        tag.setId(UUID.randomUUID().toString());
        tag.setUserId(userId);
        tag.setName(name);
        tag.setColor("#6d5dfc");
        tag.setCreatedAt(Instant.now());
        return tag;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
