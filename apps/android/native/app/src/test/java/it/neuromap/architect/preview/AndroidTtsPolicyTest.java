package it.neuromap.architect.preview;

import org.junit.Test;
import java.util.List;
import static org.junit.Assert.*;

public class AndroidTtsPolicyTest {
    @Test
    public void clampsRateWithinSafeBounds() {
        assertEquals(1.0f, AndroidTtsPolicy.clampRate(Float.NaN), 0.001f);
        assertEquals(0.6f, AndroidTtsPolicy.clampRate(0.1f), 0.001f);
        assertEquals(1.8f, AndroidTtsPolicy.clampRate(5.0f), 0.001f);
        assertEquals(1.25f, AndroidTtsPolicy.clampRate(1.25f), 0.001f);
    }

    @Test
    public void normalizesLanguageTagsSafely() {
        assertEquals("it-IT", AndroidTtsPolicy.normalizeLanguageTag(null, "it-IT"));
        assertEquals("en-US", AndroidTtsPolicy.normalizeLanguageTag("en_US", "it-IT"));
        assertEquals("it-IT", AndroidTtsPolicy.normalizeLanguageTag("auto", "it-IT"));
        assertEquals("it-IT", AndroidTtsPolicy.normalizeLanguageTag("bad tag! <script>", "it-IT"));
    }

    @Test
    public void splitsLongSpeechAtSentenceBoundaries() {
        String text = "Prima frase della mappa. " + "Parola ".repeat(90) + "Ultima frase conclusiva.";
        List<String> parts = AndroidTtsPolicy.splitForTts(text, 200);
        assertTrue(parts.size() >= 3);
        for (String part : parts) {
            assertTrue("Chunk exceeds limit: " + part.length(), part.length() <= 200);
            assertFalse(part.isEmpty());
        }
    }

    @Test
    public void validatesUtteranceIdsStrictly() {
        assertTrue(AndroidTtsPolicy.isValidUtteranceId("tts_1_0"));
        assertFalse(AndroidTtsPolicy.isValidUtteranceId("bad\nid"));
        assertFalse(AndroidTtsPolicy.isValidUtteranceId("x".repeat(65)));
    }
}
