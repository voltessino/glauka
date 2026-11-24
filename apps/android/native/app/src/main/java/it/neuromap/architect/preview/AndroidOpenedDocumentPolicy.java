package it.neuromap.architect.preview;

import java.util.Locale;
import java.util.regex.Pattern;

/** Pure Java rules for opaque Android Storage Access Framework document handles. */
final class AndroidOpenedDocumentPolicy {
    private static final Pattern DOC_ID = Pattern.compile(
        "doc_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    private static final Pattern SAFE_CHARS = Pattern.compile("[^a-zA-Z0-9._\\- ]");
    static final int MAX_RECENT_PERSISTED = 20;

    private AndroidOpenedDocumentPolicy() {}

    static boolean acceptsDocId(String id) {
        return id != null && DOC_ID.matcher(id).matches();
    }

    static boolean supportsDirectOverwrite(String filename) {
        if (filename == null) return false;
        String lower = filename.trim().toLowerCase(Locale.ROOT);
        return lower.endsWith(".gk")
            || lower.endsWith(".glk")
            || lower.endsWith(".neuromap")
            || lower.endsWith(".json");
    }

    static String safeDisplayName(String raw, String fallback) {
        String cleanFallback = (fallback == null || fallback.isEmpty()) ? "mappa.gk" : fallback;
        if (raw == null) return cleanFallback;
        String tail = raw.replace('\\', '/');
        int slash = tail.lastIndexOf('/');
        if (slash >= 0) tail = tail.substring(slash + 1);
        tail = SAFE_CHARS.matcher(tail).replaceAll("_").trim();
        if (tail.isEmpty() || ".".equals(tail) || "..".equals(tail)) return cleanFallback;
        if (tail.length() > 140) tail = tail.substring(0, 140);
        return tail;
    }
}
