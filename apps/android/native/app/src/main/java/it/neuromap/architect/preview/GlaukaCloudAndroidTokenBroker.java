package it.neuromap.architect.preview;

import android.content.Context;
import android.os.Looper;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Android-only OAuth token exchange/refresh. This class is deliberately NOT a
 * JavascriptInterface and cannot start authorization: that must come from an
 * explicitly verified Android App Link and GlaukaCloudAndroidPkce.
 *
 * No OAuth token is returned to WebView. OAuth HTTPS work is forbidden on the
 * UI thread; all credentials live exclusively in GlaukaCloudSecureVault.
 */
final class GlaukaCloudAndroidTokenBroker {
    private static final int MAX_JSON = 16 * 1024;
    private static final int TIMEOUT_MS = 20000;
    private final GlaukaCloudSecureVault vault;

    GlaukaCloudAndroidTokenBroker(Context context) {
        vault = new GlaukaCloudSecureVault(context);
    }

    private static void requireWorkerThread() {
        if (Looper.myLooper() == Looper.getMainLooper())
            throw new IllegalStateException("OAuth HTTPS cannot run on Android UI thread");
    }

    private static String tokenEndpoint(String provider) {
        if ("google".equals(provider))
            return "https://oauth2.googleapis.com/token";
        if ("dropbox".equals(provider))
            return "https://api.dropboxapi.com/oauth2/token";
        throw new IllegalArgumentException("Unsupported OAuth provider");
    }

    private static String form(Map<String,String> values) throws Exception {
        StringBuilder b = new StringBuilder();
        for (Map.Entry<String,String> value : values.entrySet()) {
            if (b.length() > 0) b.append('&');
            b.append(URLEncoder.encode(value.getKey(),"UTF-8"));
            b.append('=');
            b.append(URLEncoder.encode(value.getValue(),"UTF-8"));
        }
        return b.toString();
    }

    private static JSONObject post(String provider, Map<String,String> values)
            throws GeneralSecurityException {
        requireWorkerThread();
        HttpURLConnection conn=null;
        try {
            URL address=new URL(tokenEndpoint(provider));
            conn=(HttpURLConnection)address.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(TIMEOUT_MS);
            conn.setReadTimeout(TIMEOUT_MS);
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type","application/x-www-form-urlencoded");
            conn.setRequestProperty("Accept","application/json");
            byte[] data=form(values).getBytes(StandardCharsets.UTF_8);
            if (data.length>8192)
                throw new GeneralSecurityException("OAuth request exceeded size limit");
            conn.setFixedLengthStreamingMode(data.length);
            try(OutputStream out=conn.getOutputStream()) {out.write(data);}
            if(conn.getResponseCode()!=HttpURLConnection.HTTP_OK)
                throw new GeneralSecurityException("OAuth provider returned an error");
            try(InputStream in=conn.getInputStream();
                ByteArrayOutputStream output=new ByteArrayOutputStream()){
                byte[] block=new byte[2048];int n;
                while((n=in.read(block))!=-1){
                    if(output.size()+n>MAX_JSON)
                        throw new GeneralSecurityException("OAuth response too large");
                    output.write(block,0,n);
                }
                return new JSONObject(output.toString("UTF-8"));
            }
        }catch(GeneralSecurityException error){
            throw error;
        }catch(Exception error){
            // Provider bodies, access tokens and refresh tokens are never logged.
            throw new GeneralSecurityException("Secure OAuth exchange unavailable");
        }finally{
            if(conn!=null)conn.disconnect();
        }
    }

    private static long expiry(JSONObject json) throws GeneralSecurityException {
        long seconds=json.optLong("expires_in",0);
        if(seconds<=0||seconds>86400)
            throw new GeneralSecurityException("Invalid OAuth expiry");
        return System.currentTimeMillis()+seconds*1000L;
    }

    private static void checkBearer(JSONObject json) throws GeneralSecurityException {
        String type=json.optString("token_type","Bearer");
        if(!"Bearer".equalsIgnoreCase(type))
            throw new GeneralSecurityException("Invalid OAuth token type");
    }

    synchronized void exchange(GlaukaCloudAndroidPkce.VerifiedCode code)
            throws GeneralSecurityException {
        requireWorkerThread();
        if(code==null||code.code==null||code.clientId==null||
           code.verifier==null||code.redirectUri==null)
            throw new GeneralSecurityException("PKCE authorization missing");
        LinkedHashMap<String,String> payload=new LinkedHashMap<>();
        payload.put("grant_type","authorization_code");
        payload.put("client_id",code.clientId);
        payload.put("code",code.code);
        payload.put("code_verifier",code.verifier);
        payload.put("redirect_uri",code.redirectUri);
        JSONObject result=post(code.provider,payload);
        checkBearer(result);
        String access=result.optString("access_token","");
        String refresh=result.optString("refresh_token","");
        if(access.isEmpty()||refresh.isEmpty())
            throw new GeneralSecurityException("Offline OAuth grant missing");
        vault.save(code.provider,new GlaukaCloudSecureVault.Entry(
            access,refresh,code.clientId,expiry(result)));
    }

    synchronized boolean isConnected(String provider) {
        try {return vault.read(provider)!=null;}
        catch(Exception error){return false;}
    }

    synchronized boolean disconnect(String provider) {
        // Native revocation is a separate operation; do not falsely claim that
        // removing local credentials revokes provider authorization.
        return vault.disconnect(provider);
    }

    synchronized GlaukaCloudSecureVault.Entry authorizedToken(String provider)
            throws GeneralSecurityException {
        requireWorkerThread();
        GlaukaCloudSecureVault.Entry original=vault.read(provider);
        if(original==null)
            throw new GeneralSecurityException("Cloud account not connected");
        if(System.currentTimeMillis()+60000L<original.expiresAtMillis)
            return original; // native only: NEVER return this entry to the WebView
        LinkedHashMap<String,String> payload=new LinkedHashMap<>();
        payload.put("grant_type","refresh_token");
        payload.put("client_id",original.clientId);
        payload.put("refresh_token",original.refreshToken);
        JSONObject refreshed=post(provider,payload);
        checkBearer(refreshed);
        String access=refreshed.optString("access_token","");
        String refresh=refreshed.optString("refresh_token",original.refreshToken);
        if(access.isEmpty()||refresh.isEmpty())
            throw new GeneralSecurityException("OAuth refresh incomplete");
        GlaukaCloudSecureVault.Entry current=new GlaukaCloudSecureVault.Entry(
            access,refresh,original.clientId,expiry(refreshed));
        vault.save(provider,current);
        return current;
    }
}
