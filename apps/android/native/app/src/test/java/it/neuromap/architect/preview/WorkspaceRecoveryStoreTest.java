package it.neuromap.architect.preview;
import org.junit.*;
import org.junit.rules.TemporaryFolder;
import static org.junit.Assert.*;
import java.io.*;
import java.nio.file.Files;

public final class WorkspaceRecoveryStoreTest {
 @Rule public TemporaryFolder temporary=new TemporaryFolder();
 private File directory;
 private WorkspaceRecoveryStore store;
 @Before public void setup() throws Exception {directory=temporary.newFolder();store=new WorkspaceRecoveryStore(directory,json->json.startsWith("{\"tabs\":["));}
 private String doc(String label){return "{\"tabs\":[{\"root\":{\"text\":\""+label+"\"}}]}";}
 @Test public void freshInstallIsEmpty() throws Exception {assertNull(store.read());}
 @Test public void durableWritePreservesUnicodeAndPreviousGeneration() throws Exception {
  store.write(doc("Primo • العربية"));store.write(doc("Secondo 中文"));
  assertEquals(doc("Secondo 中文"),store.read().json);assertFalse(store.read().previous);
  Files.write(new File(directory,"current").toPath(),new byte[]{1,2});
  assertEquals(doc("Primo • العربية"),store.read().json);assertTrue(store.read().previous);
 }
 @Test public void identicalCheckpointDoesNotRotateAwayTheUsefulPrevious() throws Exception {
  store.write(doc("A"));store.write(doc("B"));store.write(doc("B"));
  Files.write(new File(directory,"current").toPath(),new byte[]{0});assertEquals(doc("A"),store.read().json);
 }
 @Test public void tamperedContentFailsDigestAndFallsBack() throws Exception {
  store.write(doc("A"));store.write(doc("B"));File file=new File(directory,"current");byte[] bytes=Files.readAllBytes(file.toPath());bytes[bytes.length-4]^=1;Files.write(file.toPath(),bytes);
  assertTrue(store.read().previous);assertEquals(doc("A"),store.read().json);
 }
 @Test public void unreadableGenerationsNeverLookLikeANewInstall() throws Exception {
  store.write(doc("A"));Files.write(new File(directory,"current").toPath(),new byte[]{1});
  try{store.read();fail("corrupt recovery accepted");}catch(IOException expected){}
 }
 @Test public void interruptedTemporaryWriteIsIgnored() throws Exception {
  store.write(doc("A"));Files.write(new File(directory,"next.tmp").toPath(),new byte[]{1});assertEquals(doc("A"),store.read().json);
  store.write(doc("B"));assertEquals(doc("B"),store.read().json);assertFalse(new File(directory,"next.tmp").exists());
 }
 @Test public void invalidOrOversizedWriteKeepsLastGoodCopy() throws Exception {
  store.write(doc("A"));
  try{store.write("broken");fail();}catch(IOException expected){}
  try{store.write("x".repeat(WorkspaceRecoveryStore.LIMIT+1));fail();}catch(IOException expected){}
  assertEquals(doc("A"),store.read().json);
 }
 @Test public void newWriteAfterFallbackRetainsPreviousValidGeneration() throws Exception {
  store.write(doc("A"));store.write(doc("B"));Files.write(new File(directory,"current").toPath(),new byte[]{0});
  store.write(doc("C"));Files.write(new File(directory,"current").toPath(),new byte[]{0});assertEquals(doc("A"),store.read().json);
 }
 @Test public void discardRemovesBothGenerationsAndTemporaryFiles() throws Exception {
  store.write(doc("A"));store.write(doc("B"));assertTrue(store.discard());assertNull(store.read());assertEquals(0,directory.list().length);
 }
 @Test public void preservesDamagedCopiesBeforeResumingAfterAFailure()throws Exception {
  store.write(doc("A"));File current=new File(directory,"current");byte[] broken=new byte[]{1,2,3};Files.write(current.toPath(),broken);
  store.write(doc("Resumed"));assertArrayEquals(broken,Files.readAllBytes(new File(directory,"current.damaged").toPath()));assertEquals(doc("Resumed"),store.read().json);
 }
}
