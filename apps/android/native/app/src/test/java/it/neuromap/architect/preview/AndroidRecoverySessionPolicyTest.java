package it.neuromap.architect.preview;

import org.junit.Test;
import static org.junit.Assert.*;

/** JVM-only security regression; no WebView or emulator required. */
public final class AndroidRecoverySessionPolicyTest {
    @Test public void acceptsOnlyCurrentLiveRenderer() {
        assertTrue(AndroidRecoverySessionPolicy.canAccess(2L, 2L, true));
        assertFalse(AndroidRecoverySessionPolicy.canAccess(1L, 2L, true));
        assertFalse(AndroidRecoverySessionPolicy.canAccess(2L, 2L, false));
        assertFalse(AndroidRecoverySessionPolicy.canAccess(0L, 0L, true));
    }

    @Test public void oldBridgeDoesNotRegainAccessAfterActivityRecreation() {
        long old=7L, replacement=8L;
        assertTrue(AndroidRecoverySessionPolicy.canAccess(old,old,true));
        assertFalse(AndroidRecoverySessionPolicy.canAccess(old,old,false));
        assertFalse(AndroidRecoverySessionPolicy.canAccess(old,replacement,true));
        assertTrue(AndroidRecoverySessionPolicy.canAccess(replacement,replacement,true));
    }
}
