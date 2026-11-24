package it.neuromap.architect.preview;
import java.io.IOException;
import java.io.OutputStream;

/** A save is acknowledged only after the document provider closes successfully. */
final class NativeExportWriter {
    private NativeExportWriter() {}
    static void write(OutputStream stream,byte[] bytes)throws IOException {
        if(stream==null)throw new IOException("Archivio non accessibile");
        try(OutputStream out=stream){out.write(bytes);out.flush();}
    }
}
