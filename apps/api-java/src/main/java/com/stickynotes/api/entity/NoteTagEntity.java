package com.stickynotes.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

@TableName("note_tags")
public class NoteTagEntity {

    @TableId(type = IdType.INPUT)
    private String noteId;
    private String tagId;

    public NoteTagEntity() {
    }

    public NoteTagEntity(String noteId, String tagId) {
        this.noteId = noteId;
        this.tagId = tagId;
    }

    public String getNoteId() {
        return noteId;
    }

    public void setNoteId(String noteId) {
        this.noteId = noteId;
    }

    public String getTagId() {
        return tagId;
    }

    public void setTagId(String tagId) {
        this.tagId = tagId;
    }
}
