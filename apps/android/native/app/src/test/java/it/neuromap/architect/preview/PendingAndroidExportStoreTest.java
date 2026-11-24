package it.neuromap.architect.preview;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.util.Arrays;

import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28, manifest = Config.NONE)
public class PendingAndroidExportStoreTest {
    private static final String ID = "save_550e8400-e29b-41d4-a716-446655440000";

    @Test public void stagedFileSurvivesActivityRecreationAndCanBeCleared() throws Exception {
        File directory=Files.createTempDirectory("glauka-android-export").toFile();
        try {
            byte[] content=new byte[128*1024];
            for(int i=0;i<content.length;i++)content[i]=(byte)(i%251);
            PendingAndroidExportStore first=new PendingAndroidExportStore(directory);
            first.stage(ID,"mappa.neuromap",content);
            assertTrue(first.hasPending());
            PendingAndroidExportStore replacement=new PendingAndroidExportStore(directory);
            PendingAndroidExportStore.Snapshot copy=replacement.snapshot();
            assertEquals(ID,copy.requestId);
            assertEquals("mappa.neuromap",copy.filename);
            assertArrayEquals(content,copy.bytes);
            replacement.clear();
            assertFalse(new PendingAndroidExportStore(directory).hasPending());
        }finally {
            File[] files=directory.listFiles();
            if(files!=null)for(File item:files)item.delete();
            directory.delete();
        }
    }

    @Test public void pendingExportCannotBeReplacedWithoutExplicitClear() throws Exception {
        File directory=Files.createTempDirectory("glauka-single-pending").toFile();
        try {
            PendingAndroidExportStore store=new PendingAndroidExportStore(directory);
            store.stage(ID,"first.json",new byte[]{1,2,3});
            try {
                store.stage(ID,"second.json",new byte[]{4,5,6});
                fail("A staged export must not be overwritten");
            }catch(IllegalStateException expected){}
            assertEquals("first.json",new PendingAndroidExportStore(directory).snapshot().filename);
        }finally {
            for(File item:directory.listFiles())item.delete();
            directory.delete();
        }
    }

    @Test public void corruptedBytesDoNotPassIntegrityCheck() throws Exception {
        File directory=Files.createTempDirectory("glauka-hash-check").toFile();
        try {
            PendingAndroidExportStore store=new PendingAndroidExportStore(directory);
            store.stage(ID,"safe.svg",new byte[]{1,2,3,4});
            try(FileOutputStream out=new FileOutputStream(new File(directory,"pending.bytes"))){
                out.write(new byte[]{9,8,7,6});
            }
            try {
                store.snapshot();
                fail("Corrupted export was accepted");
            }catch(IllegalStateException expected){}
            assertTrue(store.hasPending());
        }finally {
            for(File item:directory.listFiles())item.delete();
            directory.delete();
        }
    }

    @Test public void rejectsMalformedRequestIdAndUnsafeFilenames() throws Exception {
        File directory=Files.createTempDirectory("glauka-export-validation").toFile();
        try {
            PendingAndroidExportStore store=new PendingAndroidExportStore(directory);
            for(String name:Arrays.asList("../escape.json","dir\\map.json","/absolute.json")){
                try {store.stage(ID,name,new byte[]{1});fail("Unsafe name accepted: "+name);}
                catch(IllegalArgumentException expected){}
            }
            try {store.stage("export_550e8400-e29b-41d4-a716-446655440000","x.json",new byte[]{1});fail();}
            catch(IllegalArgumentException expected){}
            assertFalse(store.hasPending());
        }finally {
            for(File item:directory.listFiles())item.delete();
            directory.delete();
        }
    }
}
