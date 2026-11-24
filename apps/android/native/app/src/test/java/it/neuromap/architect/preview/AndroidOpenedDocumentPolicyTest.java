package it.neuromap.architect.preview;

import org.junit.Test;
import static org.junit.Assert.*;

public class AndroidOpenedDocumentPolicyTest {
    @Test public void acceptsOnlyCanonicalDocumentUUIDs() {
        assertTrue(AndroidOpenedDocumentPolicy.acceptsDocId("doc_550e8400-e29b-41d4-a716-446655440000"));
        assertTrue(AndroidOpenedDocumentPolicy.acceptsDocId("doc_550E8400-E29B-41D4-A716-446655440000"));
        for (String bad : new String[]{
            null, "", "save_550e8400-e29b-41d4-a716-446655440000",
            "doc_../etc/passwd", "content://com.google.android.apps.docs/file/1"
        }) {
            assertFalse(String.valueOf(bad), AndroidOpenedDocumentPolicy.acceptsDocId(bad));
        }
    }

    @Test public void onlyDirectGlaukaJsonFormatsAllowInPlaceOverwrite() {
        assertTrue(AndroidOpenedDocumentPolicy.supportsDirectOverwrite("Anatomia.gk"));
        assertTrue(AndroidOpenedDocumentPolicy.supportsDirectOverwrite("map.GLK"));
        assertTrue(AndroidOpenedDocumentPolicy.supportsDirectOverwrite("backup.neuromap"));
        assertTrue(AndroidOpenedDocumentPolicy.supportsDirectOverwrite("Istologia.json"));
        assertFalse(AndroidOpenedDocumentPolicy.supportsDirectOverwrite("lezione.xmind"));
        assertFalse(AndroidOpenedDocumentPolicy.supportsDirectOverwrite("appunti.md"));
        assertFalse(AndroidOpenedDocumentPolicy.supportsDirectOverwrite("struttura.opml"));
        assertFalse(AndroidOpenedDocumentPolicy.supportsDirectOverwrite(null));
    }

    @Test public void sanitizesDisplayNamesWithoutExposingDirectoryPaths() {
        assertEquals("Mappa Drive.gk", AndroidOpenedDocumentPolicy.safeDisplayName("../../Mappa Drive.gk", "fallback.gk"));
        assertEquals("Mappa_Drive.gk", AndroidOpenedDocumentPolicy.safeDisplayName("folder/sub\\Mappa:Drive.gk", "fallback.gk"));
        assertEquals("fallback.gk", AndroidOpenedDocumentPolicy.safeDisplayName("..", "fallback.gk"));
        assertEquals("fallback.gk", AndroidOpenedDocumentPolicy.safeDisplayName(null, "fallback.gk"));
    }
}
