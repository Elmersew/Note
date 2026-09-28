package com.stickynotes.api.events;

import com.stickynotes.api.auth.AuthInterceptor;
import com.stickynotes.api.contract.Dtos.CalendarEventDto;
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

@Tag(name = "events")
@RestController
@RequestMapping("/api/events")
public class EventsController {

    private final EventsService eventsService;

    public EventsController(EventsService eventsService) {
        this.eventsService = eventsService;
    }

    @GetMapping
    public List<CalendarEventDto> list(HttpServletRequest request,
                                       @RequestParam(required = false) String from,
                                       @RequestParam(required = false) String to) {
        return eventsService.list(AuthInterceptor.currentUser(request).id(), from, to);
    }

    @PostMapping
    public CalendarEventDto create(HttpServletRequest request, @Valid @RequestBody EventDtos.CreateEventRequest input) {
        return eventsService.create(AuthInterceptor.currentUser(request).id(), input);
    }

    @PatchMapping("/{id}")
    public CalendarEventDto update(HttpServletRequest request, @PathVariable String id,
                                   @Valid @RequestBody EventDtos.UpdateEventRequest input) {
        return eventsService.update(AuthInterceptor.currentUser(request).id(), id, input);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(HttpServletRequest request, @PathVariable String id) {
        eventsService.remove(AuthInterceptor.currentUser(request).id(), id);
        return ResponseEntity.noContent().build();
    }
}
