package it.neuromap.architect.preview;

/** Pure-Java session check for the privileged WebView-to-disk recovery bridge. */
final class AndroidRecoverySessionPolicy {
    private AndroidRecoverySessionPolicy() {}

    /**
     * A queued request from an old/crashed renderer must never read, overwrite,
     * or discard a new renderer's private workspace checkpoint.
     */
    static boolean canAccess(long boundSession, long currentSession, boolean rendererAlive) {
        return rendererAlive && boundSession > 0 && boundSession == currentSession;
    }
}
