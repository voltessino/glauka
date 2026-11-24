package it.neuromap.architect.preview;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Pure validation and sentence-splitting rules for Android TextToSpeech calls. */
final class AndroidTtsPolicy {
    static final int MAX_TOTAL_CHARS = 16000;
    static final int DEFAULT_CHUNK_CHARS = 3500;
    private static final Pattern LANG_TAG = Pattern.compile("^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8}){0,2}$");
    private static final Pattern UTTERANCE_ID = Pattern.compile("^[a-zA-Z0-9_\\-]{1,64}$");

    private AndroidTtsPolicy() {}

    static float clampRate(float rate) {
        if (Float.isNaN(rate) || Float.isInfinite(rate)) return 1.0f;
        if (rate < 0.6f) return 0.6f;
        if (rate > 1.8f) return 1.8f;
        return Math.round(rate * 100.0f) / 100.0f;
    }

    static String normalizeLanguageTag(String raw, String fallback) {
        String safeFallback = fallback != null && LANG_TAG.matcher(fallback.trim()).matches()
            ? fallback.trim() : "it-IT";
        if (raw == null) return safeFallback;
        String candidate = raw.trim().replace('_', '-');
        if (candidate.isEmpty() || "auto".equalsIgnoreCase(candidate)) return safeFallback;
        return LANG_TAG.matcher(candidate).matches() ? candidate : safeFallback;
    }

    static boolean isValidUtteranceId(String id) {
        return id != null && UTTERANCE_ID.matcher(id).matches();
    }

    static List<String> splitForTts(String rawText, int maxChunkChars) {
        List<String> out = new ArrayList<>();
        if (rawText == null) return out;
        String normalized = rawText.replaceAll("\\s+", " ").trim();
        if (normalized.isEmpty()) return out;
        if (normalized.length() > MAX_TOTAL_CHARS) {
            normalized = normalized.substring(0, MAX_TOTAL_CHARS).trim();
        }
        int limit = Math.max(80, Math.min(DEFAULT_CHUNK_CHARS, maxChunkChars));
        String rest = normalized;
        while (rest.length() > limit) {
            int cut = findBreak(rest, limit);
            if (cut <= 0) cut = limit;
            String head = rest.substring(0, cut).trim();
            if (!head.isEmpty()) out.add(head);
            rest = rest.substring(cut).trim();
        }
        if (!rest.isEmpty()) out.add(rest);
        return out;
    }

    private static int findBreak(String text, int limit) {
        int minBreak = Math.max(1, (limit * 35) / 100);
        for (String sep : new String[]{". ", "! ", "? ", "; ", ": ", ", ", " "}) {
            int idx = text.lastIndexOf(sep, limit);
            if (idx >= minBreak) return idx + sep.length();
        }
        return -1;
    }
}
