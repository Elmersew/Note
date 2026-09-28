package com.stickynotes.api.common;

import java.util.List;
import java.util.Map;

public final class NoteContent {

    private static final int MAX_DEPTH = 40;

    private NoteContent() {
    }

    public static String normalizePlainText(Object value) {
        String text = extract(value, 0).replaceAll("\\s+", " ").trim();
        return text.length() > 1_000_000 ? text.substring(0, 1_000_000) : text;
    }

    @SuppressWarnings("unchecked")
    private static String extract(Object value, int depth) {
        if (depth > MAX_DEPTH || value == null) {
            return "";
        }
        if (value instanceof String text) {
            return text;
        }
        if (value instanceof List<?> list) {
            StringBuilder builder = new StringBuilder();
            for (Object item : list) {
                String part = extract(item, depth + 1);
                if (!part.isEmpty()) {
                    if (builder.length() > 0) {
                        builder.append(' ');
                    }
                    builder.append(part);
                }
            }
            return builder.toString();
        }
        if (!(value instanceof Map)) {
            return "";
        }
        Map<String, Object> record = (Map<String, Object>) value;
        String ownText = record.get("text") instanceof String text ? text : "";
        String childText = extract(record.get("content"), depth + 1);
        if (ownText.isEmpty()) {
            return childText;
        }
        return childText.isEmpty() ? ownText : ownText + " " + childText;
    }
}
