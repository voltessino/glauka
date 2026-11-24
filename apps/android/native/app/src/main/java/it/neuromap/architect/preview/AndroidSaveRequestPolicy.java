package it.neuromap.architect.preview;

import java.util.regex.Pattern;

/** Only acknowledge native save requests carrying a canonical UUID. */
final class AndroidSaveRequestPolicy {
    private static final Pattern REQUEST = Pattern.compile(
        "save_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    private AndroidSaveRequestPolicy() {}
    static boolean accepts(String id) {
        return id != null && REQUEST.matcher(id).matches();
    }
}
