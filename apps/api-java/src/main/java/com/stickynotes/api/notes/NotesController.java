package com.stickynotes.api.notes;

import com.stickynotes.api.auth.AuthInterceptor;
import com.stickynotes.api.contract.Dtos.NoteDto;
import com.stickynotes.api.contract.Dtos.SessionUser;
import com.stickynotes.api.contract.Dtos.TagDto;
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

@Tag(name = "notes")
@RestController
@RequestMapping("/api/notes")
public class NotesController {

    private final NotesService notesService;

    public NotesController(NotesService notesService) {
        this.notesService = notesService;
    }

    @GetMapping
    public List<NoteDto> list(HttpServletRequest request,
                              @RequestParam(required = false) String q,
                              @RequestParam(required = false) String tag,
                              @RequestParam(required = false) Boolean trash,
                              @RequestParam(required = false) Boolean archived) {
        return notesService.list(currentUserId(request), q, tag, trash, archived);
    }

    @GetMapping("/tags")
    public List<TagDto> listTags(HttpServletRequest request) {
        return notesService.listTags(currentUserId(request));
    }

    @GetMapping("/{id}")
    public NoteDto get(HttpServletRequest request, @PathVariable String id) {
        return notesService.get(currentUserId(request), id);
    }

    @PostMapping
    public NoteDto create(HttpServletRequest request, @Valid @RequestBody NoteDtos.CreateNoteRequest input) {
        return notesService.create(currentUserId(request), input);
    }

    @PatchMapping("/{id}")
    public NoteDto update(HttpServletRequest request, @PathVariable String id,
                          @Valid @RequestBody NoteDtos.UpdateNoteRequest input) {
        return notesService.update(currentUserId(request), id, input);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(HttpServletRequest request, @PathVariable String id,
                                       @RequestParam(required = false) Integer baseVersion) {
        notesService.softDelete(currentUserId(request), id, baseVersion);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/restore")
    public NoteDto restore(HttpServletRequest request, @PathVariable String id,
                           @Valid @RequestBody NoteDtos.NoteVersionRequest input) {
        return notesService.restore(currentUserId(request), id, input.baseVersion());
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Void> permanentlyDelete(HttpServletRequest request, @PathVariable String id) {
        notesService.permanentlyDelete(currentUserId(request), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/shares")
    public NoteDtos.ShareCreatedResponse createShare(HttpServletRequest request, @PathVariable String id,
                                                     @RequestBody(required = false) NoteDtos.ShareNoteRequest input) {
        return notesService.createShare(currentUserId(request), id, input == null ? new NoteDtos.ShareNoteRequest(null) : input);
    }

    @DeleteMapping("/{id}/shares")
    public ResponseEntity<Void> revokeShares(HttpServletRequest request, @PathVariable String id) {
        notesService.revokeShares(currentUserId(request), id);
        return ResponseEntity.noContent().build();
    }

    private static String currentUserId(HttpServletRequest request) {
        SessionUser user = AuthInterceptor.currentUser(request);
        return user.id();
    }
}
