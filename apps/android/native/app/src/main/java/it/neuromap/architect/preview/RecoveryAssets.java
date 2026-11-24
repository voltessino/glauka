package it.neuromap.architect.preview;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.*;

/** Immutable, private recovery media. Portable exports still contain their images. */
final class RecoveryAssets {
    private static final Pattern IMAGES=Pattern.compile("\"data:image/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]{16384,}\"");
    private static final Pattern RESERVED=Pattern.compile("\"glauka-recovery:[^\"\\\\]*\"");
    private static final Pattern REFERENCES=Pattern.compile("\"glauka-recovery:image:([a-f0-9]{64})\"");
    private static final Pattern LITERALS=Pattern.compile("\"glauka-recovery:literal:([A-Za-z0-9+/=]+)\"");
    private final File root,directory;
    RecoveryAssets(File root){this.root=root;directory=new File(root,"assets");}
    private static String hash(byte[] data)throws Exception{
        byte[] digest=MessageDigest.getInstance("SHA-256").digest(data);StringBuilder value=new StringBuilder(64);
        for(byte b:digest)value.append(String.format(Locale.ROOT,"%02x",b&255));return value.toString();
    }
    private byte[] read(String key)throws Exception{
        File f=new File(directory,key);
        if(!f.isFile()||Files.isSymbolicLink(f.toPath())||f.length()>WorkspaceRecoveryStore.LIMIT)throw new IOException("Recovery image unavailable");
        byte[] bytes=Files.readAllBytes(f.toPath());if(!key.equals(hash(bytes)))throw new IOException("Recovery image checksum mismatch");return bytes;
    }
    private void put(String key,byte[] bytes)throws Exception{
        try{read(key);return;}catch(Exception ignored){}
        if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Recovery media directory unavailable");
        long size=0;File[] files=directory.listFiles();if(files==null)throw new IOException("Recovery media unavailable");
        for(File f:files)size+=f.length();if(size+bytes.length>6L*WorkspaceRecoveryStore.LIMIT)throw new IOException("Recovery media capacity exceeded; export a backup");
        File temporary=new File(directory,"asset.tmp");
        try{
            try(FileOutputStream out=new FileOutputStream(temporary)){out.write(bytes);out.getFD().sync();}
            Files.move(temporary.toPath(),new File(directory,key).toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
        }finally{Files.deleteIfExists(temporary.toPath());}
    }
    private interface Replacement {String apply(Matcher match)throws Exception;}
    private String transform(String input,Pattern pattern,Replacement replacement)throws Exception{
        Matcher matcher=pattern.matcher(input);StringBuffer result=new StringBuffer();
        while(matcher.find()){
            String value=replacement.apply(matcher);
            matcher.appendReplacement(result,Matcher.quoteReplacement(value));
            if(result.length()>WorkspaceRecoveryStore.LIMIT)throw new IOException("Recovery expansion limit");
        }
        matcher.appendTail(result);if(result.length()>WorkspaceRecoveryStore.LIMIT)throw new IOException("Recovery expansion limit");return result.toString();
    }
    String pack(String json)throws Exception{
        String escaped=transform(json,RESERVED,m->"\"glauka-recovery:literal:"+Base64.getEncoder().encodeToString(m.group().substring(1,m.group().length()-1).getBytes(StandardCharsets.UTF_8))+"\"");
        return transform(escaped,IMAGES,m->{byte[] bytes=m.group().substring(1,m.group().length()-1).getBytes(StandardCharsets.UTF_8);String key=hash(bytes);put(key,bytes);return "\"glauka-recovery:image:"+key+"\"";});
    }
    String unpack(String json)throws Exception{
        String expanded=transform(json,REFERENCES,m->"\""+new String(read(m.group(1)),StandardCharsets.UTF_8)+"\"");
        return transform(expanded,LITERALS,m->"\""+new String(Base64.getDecoder().decode(m.group(1)),StandardCharsets.UTF_8)+"\"");
    }
    void prune(){
        try{
            Set<String> keep=new HashSet<>();
            for(String name:new String[]{"current","previous","current.damaged","previous.damaged"}){
                File f=new File(root,name);if(!f.exists())continue;
                if(name.endsWith(".damaged")||!f.isFile()||f.length()>WorkspaceRecoveryStore.LIMIT+40L)return;
                Matcher refs=REFERENCES.matcher(new String(Files.readAllBytes(f.toPath()),StandardCharsets.UTF_8));while(refs.find())keep.add(refs.group(1));
            }
            File[] files=directory.listFiles();if(files==null)return;
            for(File f:files)if(f.getName().matches("[a-f0-9]{64}")&&!keep.contains(f.getName()))Files.deleteIfExists(f.toPath());
            if(directory.list().length==0)Files.deleteIfExists(directory.toPath());
        }catch(Exception ignored){/* A cleanup failure must not invalidate a committed snapshot. */}
    }
}
