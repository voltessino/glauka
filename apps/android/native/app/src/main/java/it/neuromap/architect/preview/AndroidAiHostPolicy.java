package it.neuromap.architect.preview;

/** Open Source edition: cloud AI endpoints are disabled. */
final class AndroidAiHostPolicy {
    private AndroidAiHostPolicy() {}
    static boolean isAllowed(String endpoint) { return false; }
}
