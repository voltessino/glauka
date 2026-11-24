package it.neuromap.architect.preview;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Android-only Cloud OAuth vault. No JavaScript bridge is exposed by this class.
 *
 * Future OAuth code can store/retrieve credentials here from native Android
 * code only. The AES-GCM key is non-exportable from AndroidKeyStore; ciphertext
 * is stored in MODE_PRIVATE preferences with Android backup disabled by the
 * application's manifest. Never log any token or raw provider response.
 */
final class GlaukaCloudSecureVault {
    private static final String ALIAS = "it.glauka.cloud.oauth.aesgcm.v1";
    private static final String STORAGE = "glauka_cloud_private_v1";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final int MAX_TOKEN_CHARS = 8192;
    private final SharedPreferences preferences;

    static final class Entry {
        final String accessToken;
        final String refreshToken;
        final String clientId;
        final long expiresAtMillis;
        Entry(String access, String refresh, String client, long expiry) {
            accessToken=access;
            refreshToken=refresh;
            clientId=client;
            expiresAtMillis=expiry;
        }
    }

    GlaukaCloudSecureVault(Context context) {
        preferences=context.getApplicationContext().getSharedPreferences(
            STORAGE,Context.MODE_PRIVATE);
    }

    private static String validProvider(String provider) {
        if (!"google".equals(provider) && !"dropbox".equals(provider))
            throw new IllegalArgumentException("Unsupported cloud provider");
        return provider;
    }

    private static void validate(Entry value) {
        if (value==null || value.accessToken==null || value.refreshToken==null ||
            value.clientId==null || value.accessToken.isEmpty() ||
            value.refreshToken.isEmpty() || value.clientId.isEmpty() ||
            value.accessToken.length()>MAX_TOKEN_CHARS ||
            value.refreshToken.length()>MAX_TOKEN_CHARS ||
            value.clientId.length()>256 || value.expiresAtMillis<=0)
            throw new IllegalArgumentException("Invalid cloud credentials");
    }

    private static SecretKey existingKey() throws GeneralSecurityException {
        try {
            KeyStore store=KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            KeyStore.Entry value=store.getEntry(ALIAS,null);
            if (!(value instanceof KeyStore.SecretKeyEntry))
                throw new GeneralSecurityException("Cloud secret key unavailable");
            return ((KeyStore.SecretKeyEntry)value).getSecretKey();
        } catch (GeneralSecurityException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new GeneralSecurityException("AndroidKeyStore unavailable",exception);
        }
    }

    private static synchronized SecretKey keyForWrite() throws GeneralSecurityException {
        try {
            return existingKey();
        } catch (GeneralSecurityException missing) {
            // Only generate an initial key if no key exists. A stale encrypted
            // token is NEVER silently re-encrypted with a new, unrelated key.
            KeyStore store;
            try {
                store=KeyStore.getInstance("AndroidKeyStore");
                store.load(null);
                if (store.containsAlias(ALIAS))
                    throw new GeneralSecurityException("Existing cloud key invalid",missing);
                KeyGenerator generator=KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
                generator.init(new KeyGenParameterSpec.Builder(ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256).build());
                return generator.generateKey();
            } catch (GeneralSecurityException exception) {
                throw exception;
            } catch (Exception exception) {
                throw new GeneralSecurityException("Cannot create cloud key",exception);
            }
        }
    }

    synchronized void save(String provider, Entry value) throws GeneralSecurityException {
        final String slot=validProvider(provider);
        validate(value);
        if(preferences.contains(slot)) {
            // Refuse to overwrite a corrupted vault: no silent token loss.
            read(slot);
        }
        byte[] plain=null;
        try {
            JSONObject json=new JSONObject();
            json.put("access",value.accessToken);
            json.put("refresh",value.refreshToken);
            json.put("clientId",value.clientId);
            json.put("expiresAt",value.expiresAtMillis);
            plain=json.toString().getBytes(StandardCharsets.UTF_8);
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,keyForWrite());
            cipher.updateAAD(slot.getBytes(StandardCharsets.UTF_8));
            byte[] encrypted=cipher.doFinal(plain),iv=cipher.getIV();
            if (iv==null||iv.length!=IV_BYTES)
                throw new GeneralSecurityException("Unsafe Android GCM IV");
            byte[] result=new byte[iv.length+encrypted.length];
            System.arraycopy(iv,0,result,0,iv.length);
            System.arraycopy(encrypted,0,result,iv.length,encrypted.length);
            // commit() must succeed before any code marks an account connected.
            if(!preferences.edit().putString(slot,Base64.encodeToString(
                result,Base64.NO_WRAP)).commit())
                throw new GeneralSecurityException("Cloud credentials not persisted");
            Arrays.fill(encrypted,(byte)0);
            Arrays.fill(result,(byte)0);
        } catch (GeneralSecurityException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new GeneralSecurityException("Cloud credential encryption failed",exception);
        } finally {
            if(plain!=null)Arrays.fill(plain,(byte)0);
        }
    }

    synchronized Entry read(String provider) throws GeneralSecurityException {
        final String slot=validProvider(provider);
        final String encoded=preferences.getString(slot,null);
        if(encoded==null)return null;
        byte[] combined=null,plaintext=null;
        try {
            combined=Base64.decode(encoded,Base64.DEFAULT);
            if(combined.length<IV_BYTES+TAG_BITS/8)
                throw new GeneralSecurityException("Cloud vault truncated");
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,existingKey(),
                new GCMParameterSpec(TAG_BITS,combined,0,IV_BYTES));
            cipher.updateAAD(slot.getBytes(StandardCharsets.UTF_8));
            plaintext=cipher.doFinal(combined,IV_BYTES,combined.length-IV_BYTES);
            JSONObject data=new JSONObject(new String(plaintext,StandardCharsets.UTF_8));
            Entry entry=new Entry(data.getString("access"),data.getString("refresh"),
                data.getString("clientId"),data.getLong("expiresAt"));
            validate(entry);
            return entry;
        } catch (GeneralSecurityException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new GeneralSecurityException("Cloud vault validation failed",exception);
        } finally {
            if(combined!=null)Arrays.fill(combined,(byte)0);
            if(plaintext!=null)Arrays.fill(plaintext,(byte)0);
        }
    }

    synchronized boolean disconnect(String provider) {
        return preferences.edit().remove(validProvider(provider)).commit();
    }

    // Separate, authenticated encryption slots for user-owned AI API keys.
    // AAD binds each secret to its exact host; the existing non-exportable
    // KeyStore AES key and MODE_PRIVATE storage are reused.
    private static String aiSlot(String host) {
        if(host==null||!AndroidAiHostPolicy.isAllowed("https://"+host+"/"))
            throw new IllegalArgumentException("Unsupported AI key host");
        return "ai:"+host.toLowerCase(java.util.Locale.ROOT);
    }

    synchronized void saveAIKey(String host,String value) throws GeneralSecurityException {
        final String slot=aiSlot(host);
        if(value==null||value.isEmpty()||value.length()>MAX_TOKEN_CHARS||
            value.indexOf('\n')>=0||value.indexOf('\r')>=0)
            throw new GeneralSecurityException("Invalid AI credential");
        if(preferences.contains(slot))readAIKey(host); // never replace corrupt records silently
        byte[] plain=value.getBytes(StandardCharsets.UTF_8),ciphertext=null,encrypted=null;
        try{
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,keyForWrite());
            cipher.updateAAD(slot.getBytes(StandardCharsets.UTF_8));
            ciphertext=cipher.doFinal(plain);
            byte[] iv=cipher.getIV();
            if(iv==null||iv.length!=IV_BYTES)
                throw new GeneralSecurityException("Invalid AI key IV");
            encrypted=new byte[iv.length+ciphertext.length];
            System.arraycopy(iv,0,encrypted,0,iv.length);
            System.arraycopy(ciphertext,0,encrypted,iv.length,ciphertext.length);
            if(!preferences.edit().putString(slot,
                Base64.encodeToString(encrypted,Base64.NO_WRAP)).commit())
                throw new GeneralSecurityException("AI key not durably saved");
        }catch(GeneralSecurityException err){throw err;}
        catch(Exception err){throw new GeneralSecurityException("AI key encryption failed");}
        finally{
            Arrays.fill(plain,(byte)0);
            if(ciphertext!=null)Arrays.fill(ciphertext,(byte)0);
            if(encrypted!=null)Arrays.fill(encrypted,(byte)0);
        }
    }

    synchronized String readAIKey(String host) throws GeneralSecurityException {
        final String slot=aiSlot(host),encoded=preferences.getString(slot,null);
        if(encoded==null)return null;
        byte[] combined=null,plain=null;
        try{
            combined=Base64.decode(encoded,Base64.DEFAULT);
            if(combined.length<IV_BYTES+TAG_BITS/8)
                throw new GeneralSecurityException("AI vault truncated");
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,existingKey(),
                new GCMParameterSpec(TAG_BITS,combined,0,IV_BYTES));
            cipher.updateAAD(slot.getBytes(StandardCharsets.UTF_8));
            plain=cipher.doFinal(combined,IV_BYTES,combined.length-IV_BYTES);
            if(plain.length<1||plain.length>MAX_TOKEN_CHARS)
                throw new GeneralSecurityException("AI key corrupt");
            return new String(plain,StandardCharsets.UTF_8);
        }catch(GeneralSecurityException err){throw err;}
        catch(Exception err){throw new GeneralSecurityException("AI key cannot be decrypted");}
        finally{
            if(combined!=null)Arrays.fill(combined,(byte)0);
            if(plain!=null)Arrays.fill(plain,(byte)0);
        }
    }

    synchronized boolean hasAIKey(String host) {
        try {return readAIKey(host)!=null;}
        catch(Exception err){return false;}
    }

    synchronized boolean deleteAIKey(String host) {
        return preferences.edit().remove(aiSlot(host)).commit();
    }

}
