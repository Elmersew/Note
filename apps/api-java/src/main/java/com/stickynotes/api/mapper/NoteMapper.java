package com.stickynotes.api.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.stickynotes.api.entity.NoteEntity;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface NoteMapper extends BaseMapper<NoteEntity> {

    @Select("<script>"
            + "SELECT id FROM notes WHERE user_id = #{userId} "
            + "<choose>"
            + "<when test='trash'>AND deleted_at IS NOT NULL</when>"
            + "<otherwise>AND deleted_at IS NULL</otherwise>"
            + "</choose> "
            + "AND MATCH(title, plain_text) AGAINST (#{q} IN NATURAL LANGUAGE MODE) "
            + "ORDER BY is_pinned DESC, updated_at DESC LIMIT 200"
            + "</script>")
    List<String> searchIds(@Param("userId") String userId, @Param("q") String q, @Param("trash") boolean trash);
}
