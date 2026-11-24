package it.neuromap.architect.preview;
import org.junit.*;import org.junit.rules.TemporaryFolder;import java.io.*;import java.nio.file.*;import java.util.*;import static org.junit.Assert.*;
public class RecoveryAssetsTest{
 @Rule public TemporaryFolder temporary=new TemporaryFolder();
 private String doc(String label,String image){return "{\"tabs\":[{\"root\":{\"text\":\""+label+"\"},\"images\":[{\"src\":\"data:image/png;base64,"+image.repeat(20000)+"\"}]}]}";}
 private WorkspaceRecoveryStore store(File directory){return new WorkspaceRecoveryStore(directory,json->json.startsWith("{\"tabs\":["));}
 @Test public void largeImagesAreStoredOnceAndNotRewrittenWhenTextChanges()throws Exception{
  File dir=temporary.newFolder();WorkspaceRecoveryStore store=store(dir);store.write(doc("A","A"));File[] files=new File(dir,"assets").listFiles();assertEquals(1,files.length);long modified=files[0].lastModified();assertTrue(new File(dir,"current").length()<1000);
  store.write(doc("B","A"));assertEquals(modified,files[0].lastModified());assertEquals(doc("B","A"),store.read().json);
 }
 @Test public void missingOrCorruptImageFallsBackToPreviousSnapshot()throws Exception{
  for(boolean missing:new boolean[]{true,false}){
   File dir=temporary.newFolder();WorkspaceRecoveryStore store=store(dir);store.write(doc("A","A"));Set<String> old=new HashSet<>(Arrays.asList(new File(dir,"assets").list()));store.write(doc("B","B"));
   for(File f:new File(dir,"assets").listFiles())if(!old.contains(f.getName())){if(missing)Files.delete(f.toPath());else Files.write(f.toPath(),new byte[]{1});}
   assertTrue(store.read().previous);assertEquals(doc("A","A"),store.read().json);
  }
 }
 @Test public void obsoleteImagesAreRemovedOnlyAfterBothGenerationsStopUsingThem()throws Exception{
  File dir=temporary.newFolder();WorkspaceRecoveryStore store=store(dir);for(String v:new String[]{"A","B","C"})store.write(doc(v,v));assertEquals(2,new File(dir,"assets").list().length);store.discard();assertNull(store.read());assertFalse(new File(dir,"assets").exists());
 }
 @Test public void reservedLiteralTextSurvivesWithoutAssetLookups()throws Exception{
  File dir=temporary.newFolder();WorkspaceRecoveryStore store=store(dir);for(String text:new String[]{"glauka-recovery:image:"+"a".repeat(64),"glauka-recovery:literal:abcd"}){String json=doc(text,"A");store.write(json);assertEquals(json,store.read().json);}
 }
 @Test public void v1InlineSnapshotRemainsReadable()throws Exception{
  File dir=temporary.newFolder();String json=doc("legacy","A");byte[] bytes=json.getBytes(java.nio.charset.StandardCharsets.UTF_8);try(DataOutputStream out=new DataOutputStream(new FileOutputStream(new File(dir,"current")))){out.writeInt(0x474c4b31);out.writeInt(bytes.length);out.write(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));out.write(bytes);}assertEquals(json,store(dir).read().json);
 }
}
