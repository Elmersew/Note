package com.stickynotes.api.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stickynotes.api.auth.AuthInterceptor;
import com.stickynotes.api.contract.Dtos.AiResult;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.Map;
import java.util.function.Consumer;

@Tag(name = "ai")
@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiService aiService;
    private final ObjectMapper objectMapper;

    public AiController(AiService aiService, ObjectMapper objectMapper) {
        this.aiService = aiService;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/transform")
    public AiResult transform(HttpServletRequest request, @Valid @RequestBody AiDtos.AiTransformRequest input) {
        return aiService.transform(AuthInterceptor.currentUser(request).id(), input);
    }

    @PostMapping("/ask")
    public AiResult ask(HttpServletRequest request, @Valid @RequestBody AiDtos.AiAskRequest input) {
        return aiService.ask(AuthInterceptor.currentUser(request).id(), input);
    }

    @PostMapping("/transform/stream")
    public void streamTransform(HttpServletRequest request, @Valid @RequestBody AiDtos.AiTransformRequest input,
                                HttpServletResponse response) throws IOException {
        writeStream(response, delta -> aiService.streamTransform(userId(request), input, delta));
    }

    @PostMapping("/ask/stream")
    public void streamAsk(HttpServletRequest request, @Valid @RequestBody AiDtos.AiAskRequest input,
                          HttpServletResponse response) throws IOException {
        writeStream(response, delta -> aiService.streamAsk(userId(request), input, delta));
    }

    private String userId(HttpServletRequest request) {
        return AuthInterceptor.currentUser(request).id();
    }

    private void writeStream(HttpServletResponse response, Consumer<Consumer<String>> producer) throws IOException {
        response.setStatus(200);
        response.setContentType(MediaType.TEXT_EVENT_STREAM_VALUE + ";charset=utf-8");
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.setHeader("Connection", "keep-alive");
        response.flushBuffer();
        PrintWriter writer = response.getWriter();
        try {
            producer.accept(delta -> {
                try {
                    writer.write("data: " + objectMapper.writeValueAsString(Map.of("delta", delta)) + "\n\n");
                    writer.flush();
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            });
            writer.write("data: [DONE]\n\n");
        } catch (Exception e) {
            String message = e instanceof IllegalStateException && e.getCause() != null ? e.getCause().getMessage() : e.getMessage();
            writer.write("event: error\ndata: " + objectMapper.writeValueAsString(Map.of("message", message == null ? "AI 请求失败" : message)) + "\n\n");
        } finally {
            writer.flush();
        }
    }
}
