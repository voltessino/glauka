package it.neuromap.architect.preview;

import android.util.AtomicFile;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Private crash-resistant staging for ACTION_CREATE_DOCUMENT.
 *
 * Android may kill the activity while the system document picker is visible.
 * Keep the exact bytes until the provider has acknowledged a complete write,
 * or the user explicitly cancels/discards the pending export.
 */
final class PendingAndroidExportStore {
    static final int MAX_BYTES = 32 * 1024 * 1024;
    private static final int MAX_META = 4096;
    private final File folder;
    private final AtomicFile payload;
    private final AtomicFile metadata;

    static final class Info {
        final String requestId;
        final String filename;
        final long length;
        final String checksum;
        Info(String requestId, String filename, long length, String checksum) {
            this.requestId=requestId;
            this.filename=filename;
            this.length=length;
            this.checksum=checksum;
        }
    }
    static final class Snapshot {
        final String requestId;
        final String filename;
        final byte[] bytes;
        Snapshot(String requestId, String filename, byte[] bytes) {
            this.requestId = requestId;
            this.filename = filename;
            this.bytes = bytes;
        }
    }

    PendingAndroidExportStore(File directory) {
        folder = directory;
        payload = new AtomicFile(new File(folder, "pending.bytes"));
        metadata = new AtomicFile(new File(folder, "pending.json"));
    }

    private static String sha256(byte[] bytes) throws Exception {
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(bytes);
        StringBuilder hex = new StringBuilder(hash.length * 2);
        for (byte value : hash) hex.append(String.format(java.util.Locale.ROOT, "%02x", value & 0xff));
        return hex.toString();
    }

    private static byte[] readBounded(AtomicFile file, int limit) throws Exception {
        try (InputStream input = file.openRead();
             ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
            byte[] block = new byte[16 * 1024];
            int amount;
            while ((amount = input.read(block)) != -1) {
                if (buffer.size() + amount > limit)
                    throw new IllegalArgumentException("File temporaneo oltre il limite");
                buffer.write(block, 0, amount);
            }
            return buffer.toByteArray();
        }
    }

    private static void writeAtomic(AtomicFile file, byte[] content) throws Exception {
        FileOutputStream output = null;
        try {
            output = file.startWrite();
            output.write(content);
            file.finishWrite(output);
            output = null;
        } catch (Exception error) {
            if (output != null) file.failWrite(output);
            throw error;
        }
    }

    synchronized boolean hasPending() {
        return metadata.getBaseFile().exists() ||
            new File(metadata.getBaseFile().getPath() + ".bak").exists();
    }

    synchronized void stage(String id, String filename, byte[] content) throws Exception {
        if (!AndroidSaveRequestPolicy.accepts(id) || filename == null ||
            filename.length() > 160 || filename.isEmpty() ||
            filename.contains("/") || filename.contains("\\") ||
            content == null || content.length > MAX_BYTES)
            throw new IllegalArgumentException("Richiesta di esportazione non valida");
        if (hasPending()) throw new IllegalStateException("Completa prima il salvataggio sospeso");
        if (!folder.isDirectory() && !folder.mkdirs())
            throw new IllegalStateException("Archivio temporaneo non disponibile");

        // Write data first, metadata last: a partial stage never becomes a
        // resumable export that points at incomplete data.
        writeAtomic(payload, content);
        JSONObject manifest = new JSONObject();
        manifest.put("request", id);
        manifest.put("filename", filename);
        manifest.put("length", content.length);
        manifest.put("sha256", sha256(content));
        manifest.put("createdAt", System.currentTimeMillis());
        writeAtomic(metadata, manifest.toString().getBytes(StandardCharsets.UTF_8));
    }

    /** Read only the tiny manifest on the UI thread; never hash 32 MB here. */
    synchronized Info info() throws Exception {
        if(!hasPending())return null;
        byte[] meta=readBounded(metadata,MAX_META);
        JSONObject parsed=new JSONObject(new String(meta,StandardCharsets.UTF_8));
        String id=parsed.getString("request"), filename=parsed.getString("filename");
        long length=parsed.getLong("length");
        String checksum=parsed.getString("sha256");
        if(!AndroidSaveRequestPolicy.accepts(id)||filename.isEmpty()||
           filename.length()>160||filename.contains("/")||filename.contains("\\")||
           length<0||length>MAX_BYTES||!checksum.matches("[0-9a-f]{64}"))
            throw new IllegalStateException("Metadati temporanei non validi");
        return new Info(id,filename,length,checksum);
    }

    /** Read and validate the payload only on the background I/O executor. */
    synchronized Snapshot snapshot() throws Exception {
        Info manifest=info();
        if(manifest==null)return null;
        byte[] bytes=readBounded(payload,MAX_BYTES);
        if(bytes.length!=manifest.length||!MessageDigest.isEqual(
            manifest.checksum.getBytes(StandardCharsets.US_ASCII),
            sha256(bytes).getBytes(StandardCharsets.US_ASCII)))
            throw new IllegalStateException("Integrità del file temporaneo non verificata");
        return new Snapshot(manifest.requestId,manifest.filename,bytes);
    }

    synchronized void clear() {
        metadata.delete();
        payload.delete();
    }
}
