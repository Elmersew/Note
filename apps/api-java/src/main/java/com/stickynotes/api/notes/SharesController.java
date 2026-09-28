package com.stickynotes.api.notes;

import com.stickynotes.api.contract.Dtos.NoteDto;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "shares")
@RestController
@RequestMapping("/api/shares")
public class SharesController {

    private final NotesService notesService;

    public SharesController(NotesService notesService) {
        this.notesService = notesService;
    }

    @GetMapping("/{token}")
    public NoteDto get(@PathVariable String token) {
        return notesService.getShared(token);
    }
}
