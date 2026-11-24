package it.neuromap.architect.preview;

import org.junit.Test;
import static org.junit.Assert.*;

public class AndroidSaveRequestPolicyTest {
    @Test public void acceptsCanonicalSaveUUIDForProjectsAndExports() {
        assertTrue(AndroidSaveRequestPolicy.accepts("save_550e8400-e29b-41d4-a716-446655440000"));
        assertTrue(AndroidSaveRequestPolicy.accepts("save_550E8400-E29B-41D4-A716-446655440000"));
    }
    @Test public void rejectsWrongPrefixMalformedOrOversizedRequests() {
        for (String value : new String[]{
            "", "export_550e8400-e29b-41d4-a716-446655440000",
            "save_" + "a".repeat(32), "save_" + "-".repeat(36),
            "save_550e8400-e29b-41d4-a716-446655440000;run", "save_foobar"
        }) assertFalse(value, AndroidSaveRequestPolicy.accepts(value));
        assertFalse(AndroidSaveRequestPolicy.accepts(null));
    }
}
