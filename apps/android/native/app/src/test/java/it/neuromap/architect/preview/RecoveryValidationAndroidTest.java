package it.neuromap.architect.preview;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.lang.reflect.Method;
import static org.junit.Assert.*;

/** Executes Android's real JsonReader in Robolectric; not a WebView/device test. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28,manifest=Config.NONE)
public class RecoveryValidationAndroidTest {
 private boolean valid(String json)throws Exception {
  MainActivity activity=Robolectric.buildActivity(MainActivity.class).get();
  Method method=MainActivity.class.getDeclaredMethod("validRecovery",String.class);method.setAccessible(true);
  return (boolean)method.invoke(activity,json);
 }
 @Test public void readsLargeUnicodeWorkspaceWithoutBuildingDuplicateJsonTrees()throws Exception {
  String json="{\"tabs\":[{\"root\":{\"text\":\"العربية 中文\",\"notes\":\""+"a".repeat(3_000_000)+"\"}}]}";
  assertTrue(valid(json));
 }
 @Test public void restoresWorkspacesAboveOldTwentyTabLimitAndRejectsOutOfBoundsCounts()throws Exception {
  StringBuilder doc=new StringBuilder("{\"tabs\":[");
  for(int i=0;i<512;i++){
   if(i>0)doc.append(',');
   doc.append("{\"root\":{\"text\":\"Map ").append(i).append("\"}}");
   if(i==20||i==511){
    assertTrue("Expected safe bound to include "+(i+1)+" tabs",valid(doc.toString()+"]}"));
   }
  }
  doc.append(",{\"root\":{\"text\":\"excess\"}}]}");
  assertFalse("513 tabs must be rejected without discarding a subset",valid(doc.toString()));
 }
 @Test public void rejectsMalformedMissingOrAmbiguousTabs()throws Exception {
  for(String json:new String[]{"{", "{}", "{\"tabs\":[]}","{\"tabs\":[null]}","{\"tabs\":[{\"root\":null}]}","{\"tabs\":[{\"root\":{}}],\"tabs\":[]}","{\"tabs\":[{\"root\":{}}]} trailing"})
   assertFalse(json,valid(json));
 }

 @Test public void rejectsStructurallyInvalidRootsAndTabMetadata()throws Exception {
  for(String json:new String[]{
   "{\"tabs\":[{\"root\":{}}]}",
   "{\"tabs\":[{\"root\":{\"text\":null}}]}",
   "{\"tabs\":[{\"root\":{\"text\":123}}]}",
   "{\"tabs\":[{\"root\":{\"text\":\"A\",\"children\":{}}}]}",
   "{\"tabs\":[{\"root\":{\"text\":\"A\"},\"images\":{}}]}",
   "{\"tabs\":[{\"root\":{\"text\":\"A\"},\"relationships\":\"invalid\"}]}",
   "{\"tabs\":[{\"root\":{\"text\":\"A\",\"text\":\"B\"}}]}"
  })assertFalse("Invalid recovery accepted: "+json,valid(json));
  assertTrue(valid("{\"tabs\":[{\"root\":{\"text\":\"A\",\"children\":[]},\"images\":[],\"relationships\":[]}]}"));
  assertTrue(valid("{\"tabs\":[{\"root\":{\"text\":\"Legacy\",\"children\":null},\"images\":null,\"relationships\":null}]}"));
 }
}
