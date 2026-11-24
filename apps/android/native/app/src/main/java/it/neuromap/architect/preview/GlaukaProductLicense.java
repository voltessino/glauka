package it.neuromap.architect.preview;

import android.content.Context;

/** Open Source edition: no commercial license verification. */
final class GlaukaProductLicense {
    GlaukaProductLicense(Context c) {}
    String statusJson() { return "{\"plan\":\"open\"}"; }
    String activateJson(String key) { return "{\"plan\":\"open\"}"; }
    String logoutJson() { return "{\"plan\":\"open\"}"; }
    String previewModeJson(String mode) { return "{\"plan\":\"open\"}"; }
    boolean isPro() { return false; }
}
