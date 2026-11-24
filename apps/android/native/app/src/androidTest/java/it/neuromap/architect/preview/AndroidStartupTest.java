package it.neuromap.architect.preview;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.view.ViewGroup;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Run with gradle connectedDebugAndroidTest on a locally started emulator. */
@RunWith(AndroidJUnit4.class)
public class AndroidStartupTest {
    private static final class Request implements WebResourceRequest {
        private final Uri url;
        Request(String raw){url=Uri.parse(raw);}
        @Override public Uri getUrl(){return url;}
        @Override public boolean isForMainFrame(){return false;}
        @Override public boolean isRedirect(){return false;}
        @Override public boolean hasGesture(){return false;}
        @Override public String getMethod(){return "GET";}
        @Override public Map<String,String> getRequestHeaders(){return Collections.emptyMap();}
    }

    @Test public void appLoadsBundledHtmlAndDeniesUnknownHost() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            AtomicReference<String> path=new AtomicReference<>();
            AtomicReference<WebResourceResponse> blocked=new AtomicReference<>();
            for(int attempt=0;attempt<20;attempt++){
                CountDownLatch latch=new CountDownLatch(1);
                scenario.onActivity(activity->{
                    ViewGroup root=activity.findViewById(android.R.id.content);
                    WebView web=(WebView)root.getChildAt(0);
                    assertNotNull("WebView missing",web);
                    assertNotNull("SafeClient missing",web.getWebViewClient());
                    blocked.set(web.getWebViewClient().shouldInterceptRequest(
                        web,new Request("https://untrusted.example.invalid/payload.js")));
                    web.evaluateJavascript("document.location.pathname",value->{
                        path.set(value);latch.countDown();
                    });
                });
                latch.await(2,TimeUnit.SECONDS);
                if("\"/app/index.html\"".equals(path.get()))break;
                Thread.sleep(350); // bounded wait for asynchronous offline WebView load
            }
            assertEquals("Unexpected app entrypoint","\"/app/index.html\"",path.get());
            assertNotNull("Unexpected host should be rejected",blocked.get());
            assertEquals(403,blocked.get().getStatusCode());
        }
    }
}
