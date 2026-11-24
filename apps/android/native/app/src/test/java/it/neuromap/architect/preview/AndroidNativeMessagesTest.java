package it.neuromap.architect.preview;

import org.junit.Test;
import static org.junit.Assert.*;

public class AndroidNativeMessagesTest {
    @Test public void allSupportedLocalesHaveEveryNativeRecoveryMessage() {
        assertEquals(8,AndroidNativeMessages.languages());
        for(String lang:new String[]{"it","en","de","es","fr","pt","ar","zh-CN"}){
            for(String key:new String[]{
                "recoverTitle","rendererLost","loadFailed","retry","close",
                "exportTitle","exportPending","exportCorrupt","later","discard",
                "exportSaved","exportWriteFailed","backTitle","backBody","exit",
                "stay","repeatedCrash"
            }){
                String text=AndroidNativeMessages.text(lang,key);
                assertNotNull(lang+": "+key,text);
                assertFalse(lang+": "+key,text.trim().isEmpty());
            }
        }
    }
    @Test public void unsupportedSystemLanguageDefaultsToEnglish() {
        assertEquals(AndroidNativeMessages.text("en","retry"),
                     AndroidNativeMessages.text("unsupported","retry"));
    }
}
