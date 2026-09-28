package com.stickynotes.api.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.stickynotes.api.entity.TagEntity;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

public interface TagMapper extends BaseMapper<TagEntity> {

    @Select("<script>"
            + "SELECT nt.note_id AS noteId, t.id AS id, t.name AS name, t.color AS color "
            + "FROM note_tags nt JOIN tags t ON t.id = nt.tag_id "
            + "WHERE nt.note_id IN "
            + "<foreach collection='noteIds' item='n' open='(' separator=',' close=')'>#{n}</foreach>"
            + "</script>")
    List<Map<String, Object>> selectByNoteIds(@Param("noteIds") List<String> noteIds);
}
