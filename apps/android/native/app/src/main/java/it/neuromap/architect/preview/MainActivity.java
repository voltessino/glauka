package it.neuromap.architect.preview;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import android.os.Bundle;
import android.os.Build;
import android.content.Intent;
import android.content.ClipData;
import android.net.Uri;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.graphics.Color;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Toast;
import android.util.Base64;
import android.util.Log;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import org.json.JSONArray;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayInputStream;
import java.net.URL;
import java.net.HttpURLConnection;
import java.io.ByteArrayOutputStream;
import org.json.JSONObject;
import java.util.Set;
import java.util.HashSet;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;
import java.util.regex.Pattern;

/** Private preview wrapper. The content is the Free web edition, not the Developer desktop build. */
public final class MainActivity extends ComponentActivity {
    private static final String TAG="NeuroMapAndroid";
    private static final String APP_HOST="appassets.androidplatform.net";
    private static final int OPEN_FILES=4101;
    private static final int OPEN_PROJECT_DOC=4102;
    private static final int MAX_SAVE_BYTES=32*1024*1024;
    // Reject oversized Base64 before allocating the decoded byte array.
    private static final int MAX_SAVE_DATA_URI_CHARS=((MAX_SAVE_BYTES+2)/3)*4+256;
    private static final int MAX_RECOVERY_TABS=512, MAX_IMPORT_FILES=30;
    private static final Pattern SAFE_NAME=Pattern.compile("[^a-zA-Z0-9._\\- ]");
    // Read by JavaScript interface / background I/O workers; only the UI thread mutates it.
    private volatile WebView web;
    private volatile TextToSpeech ttsEngine;
    private volatile boolean ttsReady;
    private volatile boolean ttsInitializing;
    private volatile boolean ttsFailed;
    private volatile PendingTtsSpeech pendingTtsSpeech;
    private final Object ttsLock=new Object();
    private static final class PendingTtsSpeech {
        final String text, langTag, utteranceId;
        final float rate;
        final long session;
        PendingTtsSpeech(String text,String langTag,float rate,String utteranceId,long session){
            this.text=text;this.langTag=langTag;this.rate=rate;this.utteranceId=utteranceId;this.session=session;
        }
    }
    private ValueCallback<Uri[]> pendingChooser;
    private String pendingSaveRequest;
    private PendingAndroidExportStore pendingExportStore;
    private androidx.activity.result.ActivityResultLauncher<Intent> exportLauncher;
    private android.app.AlertDialog exportPrompt;
    private volatile long rendererSession;
    private boolean closeInProgress;
    private long closeAttempt;
    private final android.os.Handler closeHandler=new android.os.Handler(android.os.Looper.getMainLooper());
    private Runnable closeWatchdog;
    private boolean closePromptVisible;
    private android.app.AlertDialog closePrompt;
    private long pendingSaveSession=-1;
    private boolean webRecoveryOpen;
    private int webRendererCrashes;
    private final java.util.concurrent.ExecutorService recoveryExecutor=java.util.concurrent.Executors.newSingleThreadExecutor();
    private WorkspaceRecoveryStore recoveryStore;
    private static final class OpenedDoc {
        final Uri uri;
        final String name;
        final boolean writable;
        final boolean persistent;
        OpenedDoc(Uri uri,String name,boolean writable,boolean persistent){
            this.uri=uri;this.name=name;this.writable=writable;this.persistent=persistent;
        }
    }
    private final java.util.concurrent.ConcurrentHashMap<String,OpenedDoc> openedDocs=new java.util.concurrent.ConcurrentHashMap<>();
    private boolean validRecovery(String json) {
        try (android.util.JsonReader reader=new android.util.JsonReader(new java.io.StringReader(json))) {
            reader.setLenient(false);reader.beginObject();boolean found=false;int count=0;
            while(reader.hasNext()) {
                if(!"tabs".equals(reader.nextName())){reader.skipValue();continue;}
                if(found)return false;found=true;reader.beginArray();
                while(reader.hasNext()) {
                    if(++count>MAX_RECOVERY_TABS)return false;
                    reader.beginObject();boolean rootValid=false,rootSeen=false;
                    while(reader.hasNext()) {
                        String key=reader.nextName();
                        if("root".equals(key)) {
                            if(rootSeen||reader.peek()!=android.util.JsonToken.BEGIN_OBJECT)return false;
                            rootSeen=true;reader.beginObject();
                            boolean hasText=false,hasChildren=false;
                            while(reader.hasNext()) {
                                String field=reader.nextName();
                                if("text".equals(field)) {
                                    if(hasText||reader.peek()!=android.util.JsonToken.STRING)return false;
                                    reader.nextString();hasText=true;
                                }else if("children".equals(field)) {
                                    if(hasChildren||(reader.peek()!=android.util.JsonToken.BEGIN_ARRAY&&reader.peek()!=android.util.JsonToken.NULL))return false;
                                    hasChildren=true;reader.skipValue();
                                }else reader.skipValue();
                            }
                            reader.endObject();rootValid=hasText;
                        }else if("images".equals(key)||"relationships".equals(key)){
                            if(reader.peek()!=android.util.JsonToken.BEGIN_ARRAY&&reader.peek()!=android.util.JsonToken.NULL)return false;
                            reader.skipValue();
                        }else reader.skipValue();
                    }
                    reader.endObject();if(!rootValid)return false;
                }
                reader.endArray();
            }
            reader.endObject();return found&&count>0&&reader.peek()==android.util.JsonToken.END_DOCUMENT;
        }catch(Exception e){return false;}
    }
    private final class RecoveryBridge {
        private final long session;
        RecoveryBridge(long rendererSession){session=rendererSession;}
        private boolean isCurrentRenderer() {
            return AndroidRecoverySessionPolicy.canAccess(session,rendererSession,web!=null);
        }
        private boolean validRequestId(String id) {
            return id!=null&&id.matches("recovery_[a-zA-Z0-9-]{1,80}");
        }
        private void respond(String id,boolean ok,String value) {
            if(!validRequestId(id))return;
            runOnUiThread(()->{if(web!=null&&rendererSession==session)web.evaluateJavascript("window.NeuroMapRecovery?.nativeResult("+JSONObject.quote(id)+","+ok+","+value+")",null);});
        }
        @JavascriptInterface public void read(String id) {
            if(!validRequestId(id)||!isCurrentRenderer())return;
            recoveryExecutor.execute(()->{
            if(!isCurrentRenderer())return;
            try { WorkspaceRecoveryStore.Snapshot snapshot=recoveryStore.read();
                String value=snapshot==null?"null":new JSONObject().put("json",snapshot.json).put("previous",snapshot.previous).toString();
                respond(id,true,value);
            }catch(Exception e){respond(id,false,"null");}
        });}
        @JavascriptInterface public void write(String json,String id) {
            if(!validRequestId(id)||!isCurrentRenderer())return;
            // Reject oversized/untrusted JS bridge payloads before queuing I/O.
            if(json==null||json.length()>WorkspaceRecoveryStore.LIMIT){
                respond(id,false,"null");return;
            }
            recoveryExecutor.execute(()->{
            if(!isCurrentRenderer())return;
            try { respond(id,recoveryStore.write(json),"true"); }catch(Exception e){respond(id,false,"null");}
        });}
        @JavascriptInterface public void discard(String id) {
            if(!validRequestId(id)||!isCurrentRenderer())return;
            recoveryExecutor.execute(()->{
            if(!isCurrentRenderer())return;
            try { respond(id,recoveryStore.discard(),"true"); }catch(Exception e){respond(id,false,"null");}
        });}
    }

    private static boolean validLocale(String code){return code!=null&&code.matches("it|en|de|es|fr|pt|ar|zh-CN");}
    private String interfaceLocale(){
        String saved=getSharedPreferences("glauka-interface",MODE_PRIVATE).getString("locale","");
        if(validLocale(saved))return saved;
        String code=Locale.getDefault().getLanguage();
        if("zh".equals(code))return "zh-CN";
        return validLocale(code)?code:"en";
    }
    private JSONObject localeAliases,localeMessages;
    private String loadedLocale;
    private JSONObject readLocaleAsset(String name)throws Exception{
        try(InputStream input=getAssets().open("app/locales/"+name+".json")){
            ByteArrayOutputStream output=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;
            while((n=input.read(buffer))!=-1){if(output.size()+n>2*1024*1024)throw new IllegalArgumentException("Catalog too large");output.write(buffer,0,n);}
            return new JSONObject(output.toString("UTF-8"));
        }
    }
    private synchronized String nativeText(String text){
        if(text==null)return "";
        try{
            if(localeAliases==null)localeAliases=readLocaleAsset("source").getJSONObject("aliases");
            String code=interfaceLocale();
            if(!code.equals(loadedLocale)){localeMessages=readLocaleAsset(code);loadedLocale=code;}
            String trimmed=text.trim(),id=localeAliases.optString(trimmed,"");
            if(!id.isEmpty()&&localeMessages.has(id))return text.replace(trimmed,localeMessages.getString(id));
        }catch(Exception ignored){}
        return text;
    }

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        // Activity Result Registry restores the pending SAF result after
        // Activity recreation instead of relying on a transient request code.
        exportLauncher=registerForActivityResult(
            new androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult(),
            result->handleSaveResult(result.getResultCode(),result.getData()));
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        recoveryStore=new WorkspaceRecoveryStore(new File(getFilesDir(),"glauka-recovery"),this::validRecovery);
        pendingExportStore=new PendingAndroidExportStore(new File(getFilesDir(),"glauka-pending-export"));
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){
            @Override public void handleOnBackPressed(){handleAndroidBack();}
        });
        initializeWebView();
        // If Android recreated the Activity while the SAF picker was visible,
        // onActivityResult may arrive first. Prompt only if data is still staged.
        getWindow().getDecorView().postDelayed(this::offerPendingExport,2500);
    }
    private void initializeWebView(){
        // Debug inspector is forbidden in production even if OS defaults change.
        if(!BuildConfig.DEBUG)WebView.setWebContentsDebuggingEnabled(false);
        rendererSession++;
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        web.setDefaultFocusHighlightEnabled(false);
        web.setLayoutParams(new ViewGroup.LayoutParams(-1,-1));
        web.setVerticalScrollBarEnabled(false);web.setHorizontalScrollBarEnabled(false);
        setContentView(web);
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        // No file: URL or nested frame may expand the privileged JS bridge.
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        if(Build.VERSION.SDK_INT>=29)settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        if(Build.VERSION.SDK_INT>=33)settings.setAlgorithmicDarkeningAllowed(false);
        settings.setSafeBrowsingEnabled(true);
        // Local offline content has a stable HTTPS origin, so localStorage works reliably.
        web.addJavascriptInterface(new AndroidExport(),"NMAndroid");
        web.addJavascriptInterface(new RecoveryBridge(rendererSession),"GlaukaRecovery");
        // Local-only crash-safe cloud queue. OAuth tokens never enter WebView JS.
        web.addJavascriptInterface(new CloudLocalStorage(),"GlaukaCloudLocal");
        // BYOK bridge exists in both editions; every AI operation checks the native license.
        web.addJavascriptInterface(new AiBridge(),"NMAndroidAI");
        web.addJavascriptInterface(new TtsBridge(rendererSession),"GlaukaTts");
        web.addJavascriptInterface(new LanPairBridge(rendererSession),"GlaukaLanPair");
        web.setWebViewClient(new SafeClient());
        web.setWebChromeClient(new FileClient());
        web.loadUrl("https://"+APP_HOST+"/app/index.html");
    }

    private void showWebRecovery(boolean rendererGone) {
        if(isFinishing()||isDestroyed()||webRecoveryOpen)return;
        webRecoveryOpen=true;
        String language=interfaceLocale();
        String message=AndroidNativeMessages.text(language,rendererGone?"rendererLost":"loadFailed");
        if(rendererGone && webRendererCrashes>=3)
            message += "\n"+AndroidNativeMessages.text(language,"repeatedCrash");
        new android.app.AlertDialog.Builder(this)
            .setTitle(AndroidNativeMessages.text(language,"recoverTitle"))
            .setMessage(message)
            .setCancelable(false)
            .setPositiveButton(AndroidNativeMessages.text(language,"retry"),(dialog,which)->{
                webRecoveryOpen=false;
                if(rendererGone)initializeWebView();
                else if(web!=null)web.reload();
                getWindow().getDecorView().postDelayed(this::offerPendingExport,1800);
            })
            .setNegativeButton(AndroidNativeMessages.text(language,"close"),(dialog,which)->{
                webRecoveryOpen=false;finish();
            })
            .show();
    }
    private WebResourceResponse resource(String asset,String mime){
        try {InputStream input=getAssets().open(asset);
            WebResourceResponse res=new WebResourceResponse(mime,"UTF-8",input);
            res.setResponseHeaders(java.util.Collections.singletonMap("Cache-Control","no-store"));
            return res;
        }catch(Exception error){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
    }
    private static WebResourceResponse freeStatus(){
        return new WebResourceResponse("application/json","UTF-8",200,"OK",java.util.Collections.singletonMap("Cache-Control","no-store"),
            new ByteArrayInputStream("{\"plan\":\"free\",\"developer\":false,\"perpetual\":false}".getBytes(StandardCharsets.UTF_8)));
    }
    private WebResourceResponse blocked(){
        return new WebResourceResponse("application/json","UTF-8",403,"Forbidden",java.util.Collections.emptyMap(),
            new ByteArrayInputStream(("{\"message\":"+JSONObject.quote(nativeText("Funzione Pro non disponibile nella beta Android Free."))+"}").getBytes(StandardCharsets.UTF_8)));
    }
    private static WebResourceResponse denied(){
        return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
    }
    private final class SafeClient extends WebViewClient {
        @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
            Uri u=request.getUrl();String scheme=u.getScheme(),host=u.getHost(),path=u.getEncodedPath();
            if(!"https".equalsIgnoreCase(scheme))return denied();
            if(APP_HOST.equalsIgnoreCase(host)){
                if(path==null||u.getPort()!=-1||u.getUserInfo()!=null)return denied();
                if("/api/status".equals(path))return freeStatus();
                if(path.startsWith("/api/"))return blocked();
                String mime=AndroidAssetPolicy.mimeFor(path);
                if(mime!=null)return resource("/".equals(path)?"app/index.html":path.substring(1),mime);
                return denied();
            }
            // Remote content required for the free illustration search. No remote JS is loaded.
            if(("api.iconify.design".equalsIgnoreCase(host)||"api.mymemory.translated.net".equalsIgnoreCase(host))&&
               u.getPort()==-1&&u.getUserInfo()==null)return null;
            return denied();
        }
        @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
            Uri u=request.getUrl();return !APP_HOST.equalsIgnoreCase(u.getHost()) || !"https".equalsIgnoreCase(u.getScheme()) || u.getPort()!=-1 || u.getUserInfo()!=null;
        }
        @Override public void onReceivedError(WebView view,WebResourceRequest request,android.webkit.WebResourceError error){
            if(request.isForMainFrame() && view==web){
                Log.e(TAG,"Main document failed (details omitted)");
                runOnUiThread(()->showWebRecovery(false));
            }
        }
        @Override public boolean onRenderProcessGone(WebView view,android.webkit.RenderProcessGoneDetail detail){
            if(view!=web)return true;
            Log.e(TAG,"WebView renderer exited; recovering native shell");
            webRendererCrashes++;
            // No old AI/export callback may be delivered to the replacement
            // renderer: its JavaScript promises belong to a different session.
            for(AIJob job:aiJobs.values())job.cancel();
            closeHandler.removeCallbacksAndMessages(null);
            if(closePrompt!=null){closePrompt.dismiss();closePrompt=null;}
            if(exportPrompt!=null){exportPrompt.dismiss();exportPrompt=null;}
            closeWatchdog=null;closePromptVisible=false;closeInProgress=false;closeAttempt++;
            pendingSaveSession=-1;
            if(pendingChooser!=null){pendingChooser.onReceiveValue(null);pendingChooser=null;}
            if(pendingMicrophone!=null){pendingMicrophone.deny();pendingMicrophone=null;}
            web=null;
            android.view.ViewParent parent=view.getParent();
            if(parent instanceof ViewGroup)((ViewGroup)parent).removeView(view);
            view.destroy();
            showWebRecovery(true);
            return true;
        }
    }
    private android.webkit.PermissionRequest pendingMicrophone;
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){
        super.onRequestPermissionsResult(code,permissions,results);
        if(code==719&&pendingMicrophone!=null){
            android.webkit.PermissionRequest request=pendingMicrophone;pendingMicrophone=null;
            if(results.length>0&&results[0]==android.content.pm.PackageManager.PERMISSION_GRANTED&&web!=null)request.grant(new String[]{android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE});else request.deny();
        }
    }
    private final class FileClient extends WebChromeClient {
        @Override public void onPermissionRequest(android.webkit.PermissionRequest request){
            runOnUiThread(()->{
                Uri origin=request.getOrigin();
                if(!"https".equals(origin.getScheme())||!APP_HOST.equals(origin.getHost())||origin.getPort()!=-1||request.getResources().length!=1||!android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(request.getResources()[0])){request.deny();return;}
                if(checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)==android.content.pm.PackageManager.PERMISSION_GRANTED){request.grant(new String[]{android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE});return;}
                if(pendingMicrophone!=null)pendingMicrophone.deny();pendingMicrophone=request;
                requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO},719);
            });
        }
        @Override public void onPermissionRequestCanceled(android.webkit.PermissionRequest request){runOnUiThread(()->{if(pendingMicrophone==request)pendingMicrophone=null;});}
        @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
            if(pendingChooser!=null)pendingChooser.onReceiveValue(null);
            pendingChooser=callback;
            Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            // Custom .gk/.neuromap providers may report octet-stream or an unknown
            // MIME type, so do not hide projects behind a narrow global filter.
            String[] accept=params.getAcceptTypes();
            boolean imagesOnly=accept!=null && accept.length==1 && accept[0]!=null
                && accept[0].startsWith("image/");
            intent.setType(imagesOnly?"image/*":"*/*");
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
            try{startActivityForResult(intent,OPEN_FILES);}
            catch(Exception e){pendingChooser=null;callback.onReceiveValue(null);toast("Impossibile aprire il selettore file");}
            return true;
        }
        @Override public boolean onConsoleMessage(android.webkit.ConsoleMessage message){
            // Console errors can accidentally contain pasted document text or API
            // keys. Log the failure category, never arbitrary WebView strings.
            if(message.messageLevel()==android.webkit.ConsoleMessage.MessageLevel.ERROR)
                Log.w(TAG,"WebView JavaScript error (message omitted)");
            return true;
        }
    }
    private void toast(String text){runOnUiThread(()->Toast.makeText(this,nativeText(text),Toast.LENGTH_LONG).show());}
    private static final class AIJob {volatile boolean cancelled;volatile HttpURLConnection connection;void cancel(){cancelled=true;if(connection!=null)connection.disconnect();}}
    private static final int MAX_CONCURRENT_AI=4;
    private final AndroidAiJobLimiter aiSlots=new AndroidAiJobLimiter(MAX_CONCURRENT_AI);
    private final java.util.concurrent.ConcurrentHashMap<String,AIJob> aiJobs=new java.util.concurrent.ConcurrentHashMap<>();
    private static byte[] audioMultipart(JSONObject audio,String boundary)throws Exception{
        String encoded=audio.optString("base64"),model=audio.optString("model"),name=audio.optString("filename"),language=audio.optString("language");
        if(encoded.length()>34952536||!model.matches("[a-zA-Z0-9._/-]{1,128}")||(!language.isEmpty()&&!language.matches("[a-z]{2,3}")))throw new IllegalArgumentException("Audio non valido");
        name=name.replace('\\','/');name=name.substring(name.lastIndexOf('/')+1);
        if(name.length()>180||name.contains("\r")||name.contains("\n")||!name.toLowerCase(Locale.ROOT).matches(".+\\.(flac|mp3|mp4|mpeg|mpga|m4a|ogg|wav|webm)"))throw new IllegalArgumentException("Formato audio non supportato");
        byte[] bytes=Base64.decode(encoded,Base64.NO_WRAP);if(bytes.length==0||bytes.length>25*1024*1024)throw new IllegalArgumentException("Limite audio: 25 MB");
        ByteArrayOutputStream out=new ByteArrayOutputStream();
        out.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\""+name.replace("\"","_")+"\"\r\nContent-Type: application/octet-stream\r\n\r\n").getBytes(StandardCharsets.UTF_8));out.write(bytes);out.write("\r\n".getBytes(StandardCharsets.UTF_8));
        JSONObject fields=new JSONObject();fields.put("model",model);fields.put("response_format","verbose_json");fields.put("temperature","0");if(!language.isEmpty())fields.put("language",language);
        for(java.util.Iterator<String> it=fields.keys();it.hasNext();){String key=it.next();out.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\""+key+"\"\r\n\r\n"+fields.getString(key)+"\r\n").getBytes(StandardCharsets.UTF_8));}
        out.write(("--"+boundary+"--\r\n").getBytes(StandardCharsets.UTF_8));return out.toByteArray();
    }
    private void notifyTtsCallback(long session,String utteranceId,String eventName,String detail){
        if(!AndroidTtsPolicy.isValidUtteranceId(utteranceId))return;
        final String js="window.GlaukaTtsCallback?.("+JSONObject.quote(utteranceId)+","+JSONObject.quote(eventName)+","+JSONObject.quote(detail==null?"":detail)+")";
        runOnUiThread(()->{
            if(web!=null&&rendererSession==session){
                web.evaluateJavascript(js,null);
            }
        });
    }
    private void ensureTtsInitialized(){
        synchronized(ttsLock){
            if(ttsReady||ttsInitializing||ttsFailed)return;
            ttsInitializing=true;
        }
        runOnUiThread(()->{
            try{
                final TextToSpeech[] holder=new TextToSpeech[1];
                holder[0]=new TextToSpeech(MainActivity.this,status->{
                    PendingTtsSpeech queued=null;
                    synchronized(ttsLock){
                        ttsInitializing=false;
                        if(status==TextToSpeech.SUCCESS&&holder[0]!=null&&!isDestroyed()){
                            ttsEngine=holder[0];
                            ttsReady=true;
                            ttsFailed=false;
                            ttsEngine.setOnUtteranceProgressListener(new UtteranceProgressListener(){
                                @Override public void onStart(String id){
                                    if(id!=null&&!id.contains("__sub_"))notifyTtsCallback(rendererSession,id,"start","");
                                }
                                @Override public void onDone(String id){
                                    if(id!=null){
                                        int sep=id.indexOf("__sub_");
                                        if(sep<0)notifyTtsCallback(rendererSession,id,"done","");
                                    }
                                }
                                @Override public void onError(String id){
                                    if(id!=null){
                                        String base=id.contains("__sub_")?id.substring(0,id.indexOf("__sub_")):id;
                                        notifyTtsCallback(rendererSession,base,"error","tts_error");
                                    }
                                }
                                @Override public void onError(String id,int errorCode){
                                    onError(id);
                                }
                            });
                            queued=pendingTtsSpeech;
                            pendingTtsSpeech=null;
                        }else{
                            ttsReady=false;
                            ttsFailed=true;
                            queued=pendingTtsSpeech;
                            pendingTtsSpeech=null;
                            if(holder[0]!=null){try{holder[0].shutdown();}catch(Exception ignored){}}
                        }
                    }
                    if(queued!=null){
                        if(ttsReady&&queued.session==rendererSession){
                            dispatchTtsSpeak(queued);
                        }else if(queued.session==rendererSession){
                            notifyTtsCallback(queued.session,queued.utteranceId,"error","tts_unavailable");
                        }
                    }
                });
            }catch(Exception err){
                PendingTtsSpeech failedReq;
                synchronized(ttsLock){ttsInitializing=false;ttsReady=false;ttsFailed=true;failedReq=pendingTtsSpeech;pendingTtsSpeech=null;}
                if(failedReq!=null)notifyTtsCallback(failedReq.session,failedReq.utteranceId,"error","tts_init_failed");
            }
        });
    }
    private void dispatchTtsSpeak(PendingTtsSpeech req){
        synchronized(ttsLock){
            if(!ttsReady||ttsEngine==null){
                notifyTtsCallback(req.session,req.utteranceId,"error","tts_unavailable");
                return;
            }
            try{
                String fallbackTag="en".equalsIgnoreCase(interfaceLocale())?"en-US":"it-IT";
                Locale targetLocale=Locale.forLanguageTag(AndroidTtsPolicy.normalizeLanguageTag(req.langTag,fallbackTag));
                int avail=ttsEngine.isLanguageAvailable(targetLocale);
                if(avail>=TextToSpeech.LANG_AVAILABLE)ttsEngine.setLanguage(targetLocale);
                else ttsEngine.setLanguage(Locale.getDefault());
                ttsEngine.setSpeechRate(AndroidTtsPolicy.clampRate(req.rate));
                java.util.List<String> parts=AndroidTtsPolicy.splitForTts(req.text,AndroidTtsPolicy.DEFAULT_CHUNK_CHARS);
                if(parts.isEmpty()){
                    notifyTtsCallback(req.session,req.utteranceId,"done","");
                    return;
                }
                for(int i=0;i<parts.size();i++){
                    int queueMode=i==0?TextToSpeech.QUEUE_FLUSH:TextToSpeech.QUEUE_ADD;
                    // Only the final sub-chunk emits the un-suffixed completion ID.
                    String partId=(i==parts.size()-1)?req.utteranceId:(req.utteranceId+"__sub_"+i);
                    ttsEngine.speak(parts.get(i),queueMode,null,partId);
                }
            }catch(Exception err){
                notifyTtsCallback(req.session,req.utteranceId,"error","tts_speak_failed");
            }
        }
    }
    private void stopTtsPlayback(){
        synchronized(ttsLock){
            pendingTtsSpeech=null;
            if(ttsReady&&ttsEngine!=null){
                try{ttsEngine.stop();}catch(Exception ignored){}
            }
        }
    }
    private void shutdownTts(){
        synchronized(ttsLock){
            pendingTtsSpeech=null;
            ttsReady=false;
            ttsInitializing=false;
            if(ttsEngine!=null){
                try{ttsEngine.stop();}catch(Exception ignored){}
                try{ttsEngine.shutdown();}catch(Exception ignored){}
                ttsEngine=null;
            }
        }
    }
    private final class TtsBridge {
        private final long session;
        TtsBridge(long rendererSession){session=rendererSession;}
        @JavascriptInterface public boolean isSupported(){return true;}
        @JavascriptInterface public void speak(String text,String langTag,float rate,String utteranceId){
            if(!AndroidRecoverySessionPolicy.canAccess(session,rendererSession,web!=null))return;
            if(!AndroidTtsPolicy.isValidUtteranceId(utteranceId))return;
            PendingTtsSpeech req=new PendingTtsSpeech(text==null?"":text,langTag,rate,utteranceId,session);
            synchronized(ttsLock){
                if(ttsReady&&ttsEngine!=null){
                    pendingTtsSpeech=null;
                    dispatchTtsSpeak(req);
                    return;
                }
                if(ttsFailed){
                    notifyTtsCallback(session,utteranceId,"error","tts_unavailable");
                    return;
                }
                pendingTtsSpeech=req;
            }
            ensureTtsInitialized();
        }
        @JavascriptInterface public void stop(){
            if(!AndroidRecoverySessionPolicy.canAccess(session,rendererSession,web!=null))return;
            stopTtsPlayback();
        }
    }
    private final class AiBridge {
        @JavascriptInterface public String productStatus(){return "{\"plan\":\"open\"}";}
        @JavascriptInterface public String productActivate(String token){return "{\"plan\":\"open\"}";}
        @JavascriptInterface public String productLogout(){return "{\"plan\":\"open\"}";}
        @JavascriptInterface public String productPreviewMode(String mode){return "{\"plan\":\"open\"}";}
        @JavascriptInterface public boolean isPrivatePreview(){return false;}
        @JavascriptInterface public boolean saveAIKey(String host,String key){return false;}
        @JavascriptInterface public boolean hasAIKey(String host){return false;}
        @JavascriptInterface public boolean deleteAIKey(String host){return false;}
        @JavascriptInterface public void cancelAI(String id){}
        @JavascriptInterface public void requestAI(String endpoint, String headerJSON, String body, String requestId){}
    }

    /** Ephemeral pinned-TLS Wi-Fi LAN pairing bridge for local PC <-> Phone map transfer.
     * Strictly refuses non-RFC1918 public hosts and validates paths (/f11/v1/*). */
    private final class LanPairBridge {
        private final long bridgeSession;
        LanPairBridge(long bridgeSession){this.bridgeSession=bridgeSession;}
        private String readLanBody(InputStream in,int limit)throws Exception{
            ByteArrayOutputStream out=new ByteArrayOutputStream();
            byte[] buf=new byte[8192];int n;
            while((n=in.read(buf))!=-1){
                if(out.size()+n>limit)throw new IllegalArgumentException("Risposta troppo grande");
                out.write(buf,0,n);
            }
            return out.toString("UTF-8");
        }
        private boolean isPrivateIPv4(String host){
            if(host==null||!host.matches("^(\\d{1,3}\\.){3}\\d{1,3}$"))return false;
            try{
                String[] parts=host.split("\\.");
                int a=Integer.parseInt(parts[0]),b=Integer.parseInt(parts[1]),c=Integer.parseInt(parts[2]),d=Integer.parseInt(parts[3]);
                if(a<0||a>255||b<0||b>255||c<0||c>255||d<0||d>255)return false;
                if(a==10||a==127)return true;
                if(a==172&&b>=16&&b<=31)return true;
                if(a==192&&b==168)return true;
                return false;
            }catch(Exception ignored){return false;}
        }
        @JavascriptInterface public void request(String host,int port,String expectedPin,String path,String bodyJson,String callbackId){
            if(callbackId==null||!callbackId.matches("lan_[a-zA-Z0-9_-]{4,64}"))return;
            new Thread(()->{
                javax.net.ssl.HttpsURLConnection con=null;
                JSONObject reply=new JSONObject();
                try{
                    if(!isPrivateIPv4(host))throw new SecurityException("Solo indirizzi Wi-Fi locali consentiti");
                    if(port<1024||port>65535)throw new IllegalArgumentException("Porta non valida");
                    if(!"/f11/v1/hello".equals(path)&&!"/f11/v1/chunk".equals(path)&&!"/f11/v1/decision".equals(path))
                        throw new SecurityException("Percorso pairing non valido");
                    final String reqPin=expectedPin==null?"":expectedPin.trim().toLowerCase(Locale.ROOT);
                    if(!reqPin.isEmpty()&&!reqPin.matches("^[a-f0-9]{64}$"))throw new IllegalArgumentException("Pin certificato non valido");
                    final String[] observedPin=new String[]{""};
                    javax.net.ssl.TrustManager[] tm=new javax.net.ssl.TrustManager[]{
                        new javax.net.ssl.X509TrustManager(){
                            @Override public java.security.cert.X509Certificate[] getAcceptedIssuers(){return new java.security.cert.X509Certificate[0];}
                            @Override public void checkClientTrusted(java.security.cert.X509Certificate[] c,String a){}
                            @Override public void checkServerTrusted(java.security.cert.X509Certificate[] certs,String a)throws java.security.cert.CertificateException{
                                if(certs==null||certs.length==0)throw new java.security.cert.CertificateException("Certificato mancante");
                                try{
                                    byte[] digest=java.security.MessageDigest.getInstance("SHA-256").digest(certs[0].getEncoded());
                                    StringBuilder sb=new StringBuilder(64);
                                    for(byte byt:digest)sb.append(String.format(Locale.ROOT,"%02x",byt&0xff));
                                    String hex=sb.toString();
                                    if(!reqPin.isEmpty()&&!reqPin.equals(hex))throw new java.security.cert.CertificateException("Verifica certificato fallita");
                                    observedPin[0]=hex;
                                }catch(java.security.NoSuchAlgorithmException e){throw new java.security.cert.CertificateException(e);}
                            }
                        }
                    };
                    javax.net.ssl.SSLContext sc=javax.net.ssl.SSLContext.getInstance("TLS");
                    sc.init(null,tm,new java.security.SecureRandom());
                    URL url=new URL("https",host,port,path);
                    con=(javax.net.ssl.HttpsURLConnection)url.openConnection();
                    con.setSSLSocketFactory(sc.getSocketFactory());
                    con.setHostnameVerifier((hostname,session)->isPrivateIPv4(hostname));
                    con.setInstanceFollowRedirects(false);
                    con.setConnectTimeout(6000);
                    con.setReadTimeout(15000);
                    con.setRequestMethod("POST");
                    con.setDoOutput(true);
                    con.setRequestProperty("Content-Type","application/json");
                    byte[] payload=(bodyJson==null?"{}":bodyJson).getBytes(StandardCharsets.UTF_8);
                    if(payload.length>512*1024)throw new IllegalArgumentException("Payload troppo grande");
                    con.setFixedLengthStreamingMode(payload.length);
                    try(OutputStream os=con.getOutputStream()){os.write(payload);}
                    int status=con.getResponseCode();
                    InputStream stream=status<400?con.getInputStream():con.getErrorStream();
                    String respBody=stream==null?"":readLanBody(stream,512*1024);
                    reply.put("ok",status>=200&&status<300);
                    reply.put("status",status);
                    reply.put("certPin",observedPin[0]);
                    reply.put("body",respBody);
                }catch(Exception err){
                    try{reply.put("ok",false);reply.put("status",0);reply.put("message",nativeText(err.getMessage()));}catch(Exception ignored){}
                }finally{if(con!=null)con.disconnect();}
                final String outJson=reply.toString();
                runOnUiThread(()->{
                    if(web!=null&&rendererSession==bridgeSession)
                        web.evaluateJavascript("window.nmAndroidLanReply&&window.nmAndroidLanReply("+JSONObject.quote(callbackId)+","+JSONObject.quote(outJson)+")",null);
                });
            },"glauka-lan-pair").start();
        }
    }

    /** Crash-safe and path-isolated local staging for opt-in Cloud Sync.
     * No network access, credentials or generic file paths are exposed.
     * Runs on WebView's JavaScript bridge thread, not the UI thread.
     */
    private final class CloudLocalStorage {
        private final Pattern ids=Pattern.compile("^[A-Za-z0-9_-]{8,110}$");
        private final int indexLimit=2*1024*1024;
        private final int documentLimit=12*1024*1024;
        private File home(){return new File(getFilesDir(),"glauka-cloud");}
        private File documents(){return new File(home(),"documents");}
        private File document(String id){
            if(id==null||!ids.matcher(id).matches())throw new IllegalArgumentException("Invalid document ID");
            return new File(documents(),id+".json");
        }
        private String read(File file,int limit){
            // A process crash may leave only AtomicFile's .bak snapshot.
            File backup=new File(file.getPath()+".bak");
            if(!file.isFile()&&!backup.isFile())return null;
            if(file.length()>limit||backup.length()>limit)return null;
            // AtomicFile.openRead restores a backup left by interrupted writes.
            try(InputStream in=new AtomicFile(file).openRead();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] buf=new byte[8192];int n;
                while((n=in.read(buf))!=-1){
                    if(out.size()+n>limit)return null;
                    out.write(buf,0,n);
                }
                return out.toString("UTF-8");
            }catch(Exception err){return null;}
        }
        private boolean write(File path,String json,int limit){
            if(json==null||json.length()>limit)return false;
            final byte[] bytes=json.getBytes(StandardCharsets.UTF_8);
            if(bytes.length>limit||!path.getParentFile().mkdirs()&&!path.getParentFile().isDirectory())return false;
            AtomicFile atomic=new AtomicFile(path);FileOutputStream output=null;
            try{
                output=atomic.startWrite();output.write(bytes);atomic.finishWrite(output);
                return true;
            }catch(Exception err){if(output!=null)atomic.failWrite(output);return false;}
        }
        @JavascriptInterface public synchronized String readIndex(){
            return read(new File(home(),"index.json"),indexLimit);
        }
        @JavascriptInterface public synchronized boolean writeIndex(String json){
            // Check text length BEFORE parsing to avoid allocating a giant DOM.
            if(json==null||json.length()>indexLimit)return false;
            try{
                JSONObject payload=new JSONObject(json);
                if(payload.optInt("version")!=1||payload.optJSONObject("documents")==null||
                    payload.getJSONObject("documents").length()>1000)return false;
                java.util.Iterator<String> keys=payload.getJSONObject("documents").keys();
                while(keys.hasNext())if(!ids.matcher(keys.next()).matches())return false;
                return write(new File(home(),"index.json"),json,indexLimit);
            }catch(Exception e){return false;}
        }
        @JavascriptInterface public synchronized String listDocuments(){
            JSONArray result=new JSONArray();File[] files=documents().listFiles();
            if(files!=null)for(File file:files){
                String name=file.getName();
                if(file.isFile()&&name.endsWith(".json")){
                    String id=name.substring(0,name.length()-5);
                    if(ids.matcher(id).matches())result.put(id);
                }
            }
            return result.toString();
        }
        @JavascriptInterface public synchronized String readDocument(String id){
            try{return read(document(id),documentLimit);}catch(Exception e){return null;}
        }
        @JavascriptInterface public synchronized boolean writeDocument(String id,String json){
            if(json==null||json.length()>documentLimit)return false;
            try{
                JSONObject doc=new JSONObject(json);
                if(!doc.has("root")&&!doc.has("tabs"))return false;
                return write(document(id),json,documentLimit);
            }catch(Exception e){return false;}
        }
    }

    private final class AndroidExport {
        @JavascriptInterface public String getInterfaceLocale(){return interfaceLocale();}
        @JavascriptInterface public boolean setInterfaceLocale(String code){
            if(!validLocale(code))return false;
            return getSharedPreferences("glauka-interface",MODE_PRIVATE).edit().putString("locale",code).commit();
        }
        @JavascriptInterface public void openExternalURL(String raw){
            if(raw==null||raw.length()>8192||raw.matches("(?s).*[\\x00-\\x1f\\x7f].*"))return;
            Uri uri=Uri.parse(raw);
            if(!("https".equalsIgnoreCase(uri.getScheme())||"http".equalsIgnoreCase(uri.getScheme()))||uri.getHost()==null||uri.getUserInfo()!=null)return;
            runOnUiThread(()->{try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(android.content.ActivityNotFoundException e){Toast.makeText(MainActivity.this,nativeText("Browser non disponibile"),Toast.LENGTH_SHORT).show();}});
        }
        @JavascriptInterface public void finishClose(String attempt,boolean allowed){
            runOnUiThread(()->{
                if(!closeInProgress||!String.valueOf(closeAttempt).equals(attempt))return;
                closeHandler.removeCallbacksAndMessages(null);
                closeWatchdog=null;
                closePromptVisible=false;
                closeInProgress=false;
                if(allowed)finish();
            });
        }
        @JavascriptInterface public void pickProjectDocument(){
            final long activeSession=rendererSession;
            runOnUiThread(()->{
                if(web==null||rendererSession!=activeSession)return;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    |Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    |Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                try{startActivityForResult(intent,OPEN_PROJECT_DOC);}
                catch(Exception openErr){
                    toast("Impossibile aprire il selettore file");
                    notifyOpenedProject(activeSession,"{\"cancelled\":true}");
                }
            });
        }
        @JavascriptInterface public void reopenDocument(String docId){
            final long activeSession=rendererSession;
            if(!AndroidOpenedDocumentPolicy.acceptsDocId(docId)){
                notifyOpenedProject(activeSession,"{\"ok\":false,\"unavailable\":true}");
                return;
            }
            recoveryExecutor.execute(()->{
                OpenedDoc doc=lookupOpenedDoc(docId);
                if(doc==null){
                    notifyOpenedProject(activeSession,"{\"ok\":false,\"unavailable\":true}");
                    return;
                }
                deliverOpenedUri(doc.uri,docId,0,doc.persistent,activeSession);
            });
        }
        @JavascriptInterface public void overwriteProject(String docId,String dataUri,String filename,String requestId){
            if(!AndroidSaveRequestPolicy.accepts(requestId))return;
            try{
                if(dataUri==null||dataUri.length()>MAX_SAVE_DATA_URI_CHARS||!dataUri.startsWith("data:"))
                    throw new IllegalArgumentException("File non valido o troppo grande");
                int comma=dataUri.indexOf(',');
                if(comma<0||!dataUri.substring(0,comma).contains(";base64"))
                    throw new IllegalArgumentException("Formato non valido");
                byte[] bytes=Base64.decode(dataUri.substring(comma+1),Base64.DEFAULT);
                if(bytes.length>MAX_SAVE_BYTES)
                    throw new IllegalArgumentException("Massimo 32 MB per esportazione mobile");
                String safeName=AndroidOpenedDocumentPolicy.safeDisplayName(filename,"mappa.gk");
                final long activeSession=rendererSession;
                recoveryExecutor.execute(()->{
                    OpenedDoc entry=AndroidOpenedDocumentPolicy.acceptsDocId(docId)?lookupOpenedDoc(docId):null;
                    if(entry!=null&&entry.writable){
                        try(OutputStream stream=getContentResolver().openOutputStream(entry.uri,"wt")){
                            if(stream==null)throw new IllegalStateException("Stream non disponibile");
                            NativeExportWriter.write(stream,bytes);
                            toast(AndroidNativeMessages.text(interfaceLocale(),"exportSaved"));
                            if(activeSession==rendererSession)saveReply(requestId,true,true,docId,entry.name);
                            return;
                        }catch(Exception writeErr){
                            // Fall back to explicit Save As picker below without losing edits.
                        }
                    }
                    try{
                        pendingExportStore.stage(requestId,safeName,bytes);
                        runOnUiThread(()->{
                            if(web!=null&&rendererSession==activeSession)showSave(safeName,requestId,false);
                            else offerPendingExport();
                        });
                    }catch(Exception fallbackErr){
                        toast(nativeText("Errore salvataggio:")+" "+nativeText(fallbackErr.getMessage()));
                        saveReply(requestId,false);
                        runOnUiThread(()->offerPendingExport());
                    }
                });
            }catch(Exception error){
                toast(nativeText("Errore salvataggio:")+" "+nativeText(error.getMessage()));
                saveReply(requestId,false);
            }
        }
        @JavascriptInterface public void saveFile(String filename,String dataUri){saveData(filename,dataUri,null);}
        @JavascriptInterface public void saveProject(String filename,String dataUri,String requestId){
            if(!AndroidSaveRequestPolicy.accepts(requestId))return;
            saveData(filename,dataUri,requestId);
        }
        private void saveData(String filename,String dataUri,String requestId){
            try{
                if(dataUri==null||dataUri.length()>MAX_SAVE_DATA_URI_CHARS||!dataUri.startsWith("data:"))
                    throw new IllegalArgumentException("File non valido o troppo grande");
                int comma=dataUri.indexOf(',');
                if(comma<0||!dataUri.substring(0,comma).contains(";base64"))
                    throw new IllegalArgumentException("Formato non valido");
                byte[] bytes=Base64.decode(dataUri.substring(comma+1),Base64.DEFAULT);
                if(bytes.length>MAX_SAVE_BYTES)
                    throw new IllegalArgumentException("Massimo 32 MB per esportazione mobile");
                String name=SAFE_NAME.matcher(filename==null?"mappa.neuromap":filename).replaceAll("_");
                if(name.isEmpty())name="mappa.neuromap";
                final String safe=name;
                final String id=AndroidSaveRequestPolicy.accepts(requestId)?
                    requestId:"save_"+java.util.UUID.randomUUID();
                // Durable private snapshot BEFORE ACTION_CREATE_DOCUMENT opens:
                // no user data depends on Activity fields surviving process death.
                final long session=rendererSession;
                pendingExportStore.stage(id,safe,bytes);
                runOnUiThread(()->{
                    if(web!=null&&rendererSession==session)showSave(safe,id,false);
                    else offerPendingExport();
                });
            }catch(Exception error){
                toast(nativeText("Errore salvataggio:")+" "+nativeText(error.getMessage()));
                saveReply(requestId,false);
                runOnUiThread(()->offerPendingExport());
            }
        }
    }
    private void offerPendingExport(){
        if(isFinishing()||isDestroyed()||webRecoveryOpen||exportPrompt!=null||
           pendingSaveRequest!=null||
           pendingExportStore==null||!pendingExportStore.hasPending())return;
        PendingAndroidExportStore.Info data=null;
        try{data=pendingExportStore.info();}catch(Exception ignored){}
        if(data==null){
            android.app.AlertDialog dialog=new android.app.AlertDialog.Builder(this)
                .setTitle(AndroidNativeMessages.text(interfaceLocale(),"exportTitle"))
                .setMessage(AndroidNativeMessages.text(interfaceLocale(),"exportCorrupt"))
                .setPositiveButton(AndroidNativeMessages.text(interfaceLocale(),"discard"),(d,which)->{
                    recoveryExecutor.execute(()->pendingExportStore.clear());
                })
                .setNegativeButton(AndroidNativeMessages.text(interfaceLocale(),"later"),null)
                .create();
            exportPrompt=dialog;
            dialog.setOnDismissListener(d->{if(exportPrompt==dialog)exportPrompt=null;});
            dialog.show();
            return;
        }
        final String filename=data.filename, request=data.requestId;
        android.app.AlertDialog dialog=new android.app.AlertDialog.Builder(this)
            .setTitle(AndroidNativeMessages.text(interfaceLocale(),"exportTitle"))
            .setMessage(AndroidNativeMessages.text(interfaceLocale(),"exportPending"))
            .setPositiveButton(AndroidNativeMessages.text(interfaceLocale(),"retry"),(d,which)->
                showSave(filename,request,true))
            .setNegativeButton(AndroidNativeMessages.text(interfaceLocale(),"later"),null)
            .setNeutralButton(AndroidNativeMessages.text(interfaceLocale(),"discard"),(d,which)->
                recoveryExecutor.execute(()->pendingExportStore.clear()))
            .create();
        exportPrompt=dialog;
        dialog.setOnDismissListener(d->{if(exportPrompt==dialog)exportPrompt=null;});
        dialog.show();
    }
    private void notifyOpenedProject(long session,String jsonPayload){
        runOnUiThread(()->{
            if(web!=null&&rendererSession==session){
                web.evaluateJavascript("window.NeuroMapLifecycle?.androidOpenedProject?.("+jsonPayload+")",null);
            }
        });
    }
    private String resolveDisplayName(Uri uri,String fallback){
        String resolved=null;
        try(android.database.Cursor cursor=getContentResolver().query(uri,new String[]{android.provider.OpenableColumns.DISPLAY_NAME},null,null,null)){
            if(cursor!=null&&cursor.moveToFirst()){
                int col=cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
                if(col>=0)resolved=cursor.getString(col);
            }
        }catch(Exception ignored){}
        return AndroidOpenedDocumentPolicy.safeDisplayName(resolved,fallback);
    }
    private synchronized OpenedDoc lookupOpenedDoc(String docId){
        OpenedDoc mem=openedDocs.get(docId);
        if(mem!=null)return mem;
        try{
            String raw=getSharedPreferences("glauka-opened-docs",MODE_PRIVATE).getString("docs","{}");
            JSONObject all=new JSONObject(raw);
            JSONObject item=all.optJSONObject(docId);
            if(item==null)return null;
            String uriText=item.optString("uri","");
            if(uriText.isEmpty())return null;
            OpenedDoc restored=new OpenedDoc(Uri.parse(uriText),
                AndroidOpenedDocumentPolicy.safeDisplayName(item.optString("name","mappa.gk"),"mappa.gk"),
                item.optBoolean("writable",false),true);
            openedDocs.put(docId,restored);
            return restored;
        }catch(Exception ignored){return null;}
    }
    private synchronized void persistOpenedDoc(String docId,OpenedDoc doc){
        if(!doc.persistent)return;
        try{
            android.content.SharedPreferences prefs=getSharedPreferences("glauka-opened-docs",MODE_PRIVATE);
            JSONObject all=new JSONObject(prefs.getString("docs","{}"));
            JSONObject entry=new JSONObject();
            entry.put("uri",doc.uri.toString());
            entry.put("name",doc.name);
            entry.put("writable",doc.writable);
            entry.put("updatedAt",System.currentTimeMillis());
            all.put(docId,entry);
            while(all.length()>AndroidOpenedDocumentPolicy.MAX_RECENT_PERSISTED){
                String oldestKey=null;long oldestTime=Long.MAX_VALUE;
                for(java.util.Iterator<String> keys=all.keys();keys.hasNext();){
                    String k=keys.next();
                    long ts=all.optJSONObject(k)!=null?all.optJSONObject(k).optLong("updatedAt",0L):0L;
                    if(ts<=oldestTime){oldestTime=ts;oldestKey=k;}
                }
                if(oldestKey==null)break;
                all.remove(oldestKey);
            }
            prefs.edit().putString("docs",all.toString()).apply();
        }catch(Exception ignored){}
    }
    private void deliverOpenedUri(Uri uri,String existingDocId,int resultFlags,boolean alreadyPersisted,long activeSession){
        try{
            String filename=resolveDisplayName(uri,"mappa.gk");
            boolean canOverwrite=AndroidOpenedDocumentPolicy.supportsDirectOverwrite(filename);
            boolean persistent=alreadyPersisted;
            int modeFlags=Intent.FLAG_GRANT_READ_URI_PERMISSION|(canOverwrite?Intent.FLAG_GRANT_WRITE_URI_PERMISSION:0);
            if(!persistent){
                try{
                    int grantFlags=resultFlags==0?modeFlags:(resultFlags&modeFlags);
                    if((grantFlags&Intent.FLAG_GRANT_READ_URI_PERMISSION)!=0){
                        getContentResolver().takePersistableUriPermission(uri,grantFlags);
                        persistent=true;
                    }
                }catch(Exception ignored){}
            }
            byte[] bytes;
            try(InputStream in=getContentResolver().openInputStream(uri);ByteArrayOutputStream out=new ByteArrayOutputStream()){
                if(in==null)throw new IllegalStateException("File non leggibile");
                byte[] buf=new byte[8192];int n;
                while((n=in.read(buf))!=-1){
                    if(out.size()+n>MAX_SAVE_BYTES)throw new IllegalArgumentException("Massimo 32 MB per file mobile");
                    out.write(buf,0,n);
                }
                bytes=out.toByteArray();
            }
            String docId=AndroidOpenedDocumentPolicy.acceptsDocId(existingDocId)?existingDocId:"doc_"+java.util.UUID.randomUUID();
            OpenedDoc doc=new OpenedDoc(uri,filename,canOverwrite,persistent);
            openedDocs.put(docId,doc);
            if(persistent)persistOpenedDoc(docId,doc);
            JSONObject payload=new JSONObject();
            payload.put("ok",true);
            payload.put("docId",docId);
            payload.put("filename",filename);
            payload.put("writable",canOverwrite);
            payload.put("persistent",persistent);
            payload.put("base64",Base64.encodeToString(bytes,Base64.NO_WRAP));
            notifyOpenedProject(activeSession,payload.toString());
        }catch(Exception openFail){
            toast(nativeText("Impossibile aprire il file:")+" "+nativeText(openFail.getMessage()));
            notifyOpenedProject(activeSession,"{\"ok\":false,\"unavailable\":true}");
        }
    }
    private void saveReply(String requestId,boolean ok){
        saveReply(requestId,ok,false,null,null);
    }
    private void saveReply(String requestId,boolean ok,boolean overwritten,String docId,String filename){
        if(requestId==null)return;
        JSONObject info=new JSONObject();
        try{
            info.put("ok",ok);
            if(overwritten)info.put("overwritten",true);
            if(docId!=null)info.put("docId",docId);
            if(filename!=null)info.put("filename",filename);
        }catch(Exception ignored){}
        final String jsPayload=info.toString();
        runOnUiThread(()->{if(web!=null)web.evaluateJavascript("window.NeuroMapLifecycle.androidSaved("+JSONObject.quote(requestId)+","+jsPayload+")",null);});
    }
    private void showSave(String name,String requestId,boolean recovered){
        if(pendingSaveRequest!=null){toast("Completa prima il salvataggio in corso");saveReply(requestId,false);return;}
        if(pendingExportStore==null||!pendingExportStore.hasPending()){
            saveReply(requestId,false);return;
        }
        pendingSaveRequest=requestId;
        pendingSaveSession=recovered?-1:rendererSession;
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.setType("application/octet-stream");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.putExtra(Intent.EXTRA_TITLE,name);
        try{exportLauncher.launch(intent);}
        catch(Exception e){
            pendingSaveRequest=null;
            pendingSaveSession=-1;
            saveReply(requestId,false);
            toast("Salvataggio Android non disponibile");
            offerPendingExport();
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==OPEN_FILES){
            ArrayList<Uri> chosen=new ArrayList<>();
            if(result==RESULT_OK && data!=null){
                ClipData clip=data.getClipData();
                if(clip!=null && clip.getItemCount()>MAX_IMPORT_FILES){
                    // Never silently import a partial selection and mislead the user.
                    toast("Seleziona massimo 30 file per volta: nessun file è stato importato.");
                }else if(clip!=null){
                    for(int i=0;i<clip.getItemCount();i++)chosen.add(clip.getItemAt(i).getUri());
                }else if(data.getData()!=null)chosen.add(data.getData());
            }
            if(pendingChooser!=null){pendingChooser.onReceiveValue(chosen.isEmpty()?null:chosen.toArray(new Uri[0]));pendingChooser=null;}
        }else if(request==OPEN_PROJECT_DOC){
            final long activeSession=rendererSession;
            if(result==RESULT_OK&&data!=null&&data.getData()!=null){
                final Uri picked=data.getData();
                final int resultFlags=data.getFlags();
                recoveryExecutor.execute(()->deliverOpenedUri(picked,null,resultFlags,false,activeSession));
            }else{
                notifyOpenedProject(activeSession,"{\"cancelled\":true}");
            }
        }
    }
    private void handleSaveResult(int result,Intent data){
            final String callbackId=pendingSaveRequest;
            final long callbackSession=pendingSaveSession;
            final int resultFlags=data!=null?data.getFlags():0;
            pendingSaveRequest=null;
            pendingSaveSession=-1;
            if(result!=RESULT_OK||data==null||data.getData()==null){
                recoveryExecutor.execute(()->pendingExportStore.clear());
                if(callbackId!=null&&callbackSession==rendererSession)
                    saveReply(callbackId,false);
                return;
            }
            final Uri destination=data.getData();
            recoveryExecutor.execute(()->{
                boolean saved=false;
                String request=null;
                String createdDocId=null;
                String createdFilename=null;
                try{
                    PendingAndroidExportStore.Snapshot staged=pendingExportStore.snapshot();
                    if(staged==null)throw new IllegalStateException("Esportazione temporanea assente");
                    request=staged.requestId;
                    NativeExportWriter.write(getContentResolver().openOutputStream(destination,"wt"),staged.bytes);
                    pendingExportStore.clear();
                    saved=true;
                    String actualName=resolveDisplayName(destination,staged.filename);
                    if(AndroidOpenedDocumentPolicy.supportsDirectOverwrite(actualName)){
                        boolean persisted=false;
                        try{
                            int persistMask=resultFlags&(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                            if(persistMask==0)persistMask=Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
                            getContentResolver().takePersistableUriPermission(destination,persistMask);
                            persisted=true;
                        }catch(Exception ignored){}
                        createdDocId="doc_"+java.util.UUID.randomUUID();
                        createdFilename=actualName;
                        OpenedDoc savedEntry=new OpenedDoc(destination,actualName,true,persisted);
                        openedDocs.put(createdDocId,savedEntry);
                        if(persisted)persistOpenedDoc(createdDocId,savedEntry);
                    }
                }catch(Exception e){
                    toast(AndroidNativeMessages.text(interfaceLocale(),"exportWriteFailed"));
                }
                if(saved)toast(AndroidNativeMessages.text(interfaceLocale(),"exportSaved"));
                // The saved picker can return after Android has recreated WebView:
                // never mark an unrelated new JS session as successfully saved.
                if(callbackId!=null&&callbackSession==rendererSession)
                    saveReply(callbackId,saved&&callbackId.equals(request),false,createdDocId,createdFilename);
                if(!saved)runOnUiThread(this::offerPendingExport);
            });

    }
    private void cancelCloseWatchdog(){
        if(closeWatchdog!=null)closeHandler.removeCallbacks(closeWatchdog);
        closeWatchdog=null;
    }
    private void offerUnresponsiveClose(long attempt){
        if(!closeInProgress||closeAttempt!=attempt||isFinishing()||closePromptVisible)return;
        closePromptVisible=true;
        // Invalidate any late approval from the old JavaScript request.
        closeAttempt++;
        cancelCloseWatchdog();
        android.app.AlertDialog dialog=new android.app.AlertDialog.Builder(this)
            .setTitle(AndroidNativeMessages.text(interfaceLocale(),"backTitle"))
            .setMessage(AndroidNativeMessages.text(interfaceLocale(),"backBody"))
            .setCancelable(false)
            .setPositiveButton(AndroidNativeMessages.text(interfaceLocale(),"exit"),(clickedDialog,which)->{
                if(closePromptVisible&&closeInProgress){
                    closePromptVisible=false;closeInProgress=false;finish();
                }
            })
            // The safe default is to keep the editor and its recovery journal.
            .setNegativeButton(AndroidNativeMessages.text(interfaceLocale(),"stay"),(clickedDialog,which)->{
                closePromptVisible=false;
                closeInProgress=false;
            })
            .create();
        closePrompt=dialog;
        dialog.show();
    }
    private void handleAndroidBack(){
        if(web==null)return;
        if(closeInProgress){
            offerUnresponsiveClose(closeAttempt);
            return;
        }
        closeInProgress=true;
        final long attempt=++closeAttempt;
        closeWatchdog=()->offerUnresponsiveClose(attempt);
        closeHandler.postDelayed(closeWatchdog,90000);
        // One tagged request covers both dismissing an overlay and closing the
        // workspace. The native callback also resets the state on cancellation.
        String script="Promise.resolve(window.NeuroMapLifecycle.handleBack())"+
            ".then(value=>value==='closed'?false:window.NeuroMapLifecycle.requestClose())"+
            ".then(ok=>NMAndroid.finishClose("+JSONObject.quote(String.valueOf(attempt))+",!!ok))"+
            ".catch(()=>NMAndroid.finishClose("+JSONObject.quote(String.valueOf(attempt))+",false))";
        try{web.evaluateJavascript(script,null);}
        catch(RuntimeException error){offerUnresponsiveClose(attempt);}
    }
    @Override protected void onPause(){
        // Best-effort checkpoint; onPause is asynchronous and cannot guarantee
        // disk durability if the Android process is killed immediately.
        if(web!=null)web.evaluateJavascript("window.NeuroMapLifecycle?.flush().catch(()=>{})",null);
        super.onPause();
    }
    @Override protected void onStop(){
        if(web!=null)web.evaluateJavascript("window.NeuroMapLifecycle?.flush().catch(()=>{})",null);
        super.onStop();
    }
    @Override protected void onDestroy(){cancelCloseWatchdog();if(exportPrompt!=null){exportPrompt.dismiss();exportPrompt=null;}if(closePrompt!=null){closePrompt.dismiss();closePrompt=null;}recoveryExecutor.shutdown();for(AIJob job:aiJobs.values())job.cancel();aiJobs.clear();if(pendingMicrophone!=null){pendingMicrophone.deny();pendingMicrophone=null;}shutdownTts();if(web!=null){web.destroy();web=null;}super.onDestroy();}
}
