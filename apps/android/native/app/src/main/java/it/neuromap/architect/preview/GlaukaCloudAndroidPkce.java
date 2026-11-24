package it.neuromap.architect.preview;

import android.net.Uri;
import android.os.SystemClock;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * Native Android OAuth PKCE callback validator.
 *
 * Not exported to JavaScript. This is a gated primitive, not an enabled login:
 * register/verify an HTTPS App Link in AndroidManifest + assetlinks.json,
 * configure the real OAuth Android client, exchange the code in a native
 * background thread, then persist tokens with GlaukaCloudSecureVault.
 *
 * OAuth challenges remain in memory; after process death a new authorization
 * must be started. No custom scheme or Android loopback redirect is accepted.
 */
final class GlaukaCloudAndroidPkce {
    private static final long MAX_AGE_MILLIS = 5L*60*1000;
    private static final SecureRandom RNG = new SecureRandom();

    private Pending pending;

    static final class Authorization {
        final String provider;
        final String authorizationUrl;
        Authorization(String provider, String url) {
            this.provider=provider;
            this.authorizationUrl=url;
        }
    }

    static final class VerifiedCode {
        final String provider;
        final String clientId;
        final String redirectUri;
        final String code;
        final String verifier;
        VerifiedCode(String provider, String clientId, String redirectUri,
                     String code, String verifier) {
            this.provider=provider;
            this.clientId=clientId;
            this.redirectUri=redirectUri;
            this.code=code;
            this.verifier=verifier;
        }
    }

    private static final class Pending {
        String provider,clientId,redirectUri,state,verifier;
        long startedAt;
    }

    private static String nonce(int bytes) {
        byte[] random=new byte[bytes];
        RNG.nextBytes(random);
        return Base64.encodeToString(random,
            Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);
    }

    private static Uri requireVerifiedRedirect(String redirect) {
        if(redirect==null)throw new IllegalArgumentException("Missing verified Android App Link");
        Uri u=Uri.parse(redirect);
        // The caller must additionally prove ownership using assetlinks.json
        // and an Android intent-filter with autoVerify=true.
        if(!"https".equals(u.getScheme())||u.getHost()==null||
           u.getHost().isEmpty()||u.getPort()!=-1||u.getUserInfo()!=null||
           u.getEncodedQuery()!=null||u.getFragment()!=null||
           !"/oauth/android".equals(u.getPath()))
            throw new IllegalArgumentException("An exact verified HTTPS App Link is required");
        return u;
    }

    synchronized Authorization begin(String provider, String clientId, String verifiedRedirect) {
        Uri uri=requireVerifiedRedirect(verifiedRedirect);
        if(clientId==null||!clientId.matches("[A-Za-z0-9._-]{6,250}"))
            throw new IllegalArgumentException("Unconfigured Android OAuth public client ID");
        final String authorizationEndpoint,scope;
        if("google".equals(provider)){
            authorizationEndpoint="https://accounts.google.com/o/oauth2/v2/auth";
            scope="https://www.googleapis.com/auth/drive.file";
        }else if("dropbox".equals(provider)){
            authorizationEndpoint="https://www.dropbox.com/oauth2/authorize";
            scope="files.content.read files.content.write files.metadata.read files.metadata.write";
        }else throw new IllegalArgumentException("Unsupported Cloud OAuth provider");

        if(pending!=null&&SystemClock.elapsedRealtime()-pending.startedAt<MAX_AGE_MILLIS)
            throw new IllegalStateException("Authorization already in progress");
        Pending next=new Pending();
        next.provider=provider;
        next.clientId=clientId;
        next.redirectUri=uri.toString();
        next.state=nonce(32);
        next.verifier=nonce(48);
        next.startedAt=SystemClock.elapsedRealtime();
        pending=next;

        try{
            byte[] digest=MessageDigest.getInstance("SHA-256")
                .digest(next.verifier.getBytes(StandardCharsets.US_ASCII));
            String challenge=Base64.encodeToString(digest,
                Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);
            Uri.Builder b=Uri.parse(authorizationEndpoint).buildUpon()
                .appendQueryParameter("client_id",clientId)
                .appendQueryParameter("response_type","code")
                .appendQueryParameter("redirect_uri",next.redirectUri)
                .appendQueryParameter("scope",scope)
                .appendQueryParameter("state",next.state)
                .appendQueryParameter("code_challenge_method","S256")
                .appendQueryParameter("code_challenge",challenge);
            if("google".equals(provider)){
                b.appendQueryParameter("access_type","offline");
                b.appendQueryParameter("prompt","consent");
            }else b.appendQueryParameter("token_access_type","offline");
            return new Authorization(provider,b.build().toString());
        }catch(Exception ex){
            pending=null;
            throw new IllegalStateException("Android PKCE SHA-256 unavailable",ex);
        }
    }

    synchronized VerifiedCode consume(Uri callback) {
        Pending current=pending;
        pending=null; // exactly one attempt can consume the nonce
        if(current==null||callback==null)
            throw new IllegalStateException("No pending OAuth authorization");
        if(SystemClock.elapsedRealtime()-current.startedAt<0||
           SystemClock.elapsedRealtime()-current.startedAt>MAX_AGE_MILLIS)
            throw new IllegalStateException("OAuth challenge expired");
        Uri expected=Uri.parse(current.redirectUri);
        if(!expected.getScheme().equals(callback.getScheme())||
           !expected.getHost().equals(callback.getHost())||
           callback.getPort()!=-1||
           !expected.getPath().equals(callback.getPath())||
           callback.getFragment()!=null||callback.getUserInfo()!=null)
            throw new IllegalArgumentException("Untrusted OAuth callback destination");
        String state=callback.getQueryParameter("state");
        if(state==null||state.length()!=current.state.length()||
           !MessageDigest.isEqual(state.getBytes(StandardCharsets.US_ASCII),
               current.state.getBytes(StandardCharsets.US_ASCII)))
            throw new IllegalArgumentException("OAuth CSRF state mismatch");
        if(callback.getQueryParameter("error")!=null)
            throw new IllegalStateException("OAuth authorization cancelled or denied");
        String code=callback.getQueryParameter("code");
        if(code==null||code.length()<4||code.length()>4096)
            throw new IllegalArgumentException("Invalid OAuth authorization code");
        return new VerifiedCode(current.provider,current.clientId,
            current.redirectUri,code,current.verifier);
    }

    synchronized void cancel(){pending=null;}
}
