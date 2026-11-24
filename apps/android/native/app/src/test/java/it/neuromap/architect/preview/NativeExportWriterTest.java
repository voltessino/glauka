package it.neuromap.architect.preview;
import org.junit.Test;
import static org.junit.Assert.*;
import java.io.*;

public class NativeExportWriterTest {
 @Test public void writesFlushesAndClosesBeforeReturning()throws Exception {
  final boolean[] closed={false},flushed={false};
  ByteArrayOutputStream out=new ByteArrayOutputStream(){public void flush(){flushed[0]=true;}public void close(){closed[0]=true;}};
  byte[] bytes={0,1,2,(byte)255};NativeExportWriter.write(out,bytes);
  assertArrayEquals(bytes,out.toByteArray());assertTrue(flushed[0]);assertTrue(closed[0]);
 }
 @Test public void failedCloseMustNeverBeAcknowledgedAsSaved()throws Exception {
  ByteArrayOutputStream out=new ByteArrayOutputStream(){public void close()throws IOException{throw new IOException("Provider failed on close");}};
  try{NativeExportWriter.write(out,new byte[]{1});fail("failed close acknowledged");}catch(IOException expected){assertTrue(expected.getMessage().contains("close"));}
 }
 @Test public void failedWriteStillClosesTheProvider()throws Exception {
  final boolean[] closed={false};OutputStream out=new OutputStream(){public void write(int value)throws IOException{throw new IOException("No space left");}public void close(){closed[0]=true;}};
  try{NativeExportWriter.write(out,new byte[]{1});fail();}catch(IOException expected){assertTrue(closed[0]);}
 }
}
