package it.neuromap.architect.preview;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;

/** Private, bounded two-generation journal. No project paths or credentials. */
final class WorkspaceRecoveryStore {
    static final int LIMIT = 32 * 1024 * 1024;
    private final File directory;
    interface Validator { boolean valid(String json); }
    private final Validator validator;
    static final class Snapshot {
        final String json; final boolean previous;
        Snapshot(String json, boolean previous) { this.json=json; this.previous=previous; }
    }
    WorkspaceRecoveryStore(File directory, Validator validator) { this.directory=directory; this.validator=validator; }
    private File file(String name) { return new File(directory,name); }
    private byte[] digest(byte[] data) throws Exception { return MessageDigest.getInstance("SHA-256").digest(data); }
    private Snapshot readFile(String name, boolean previous) {
        File f=file(name);
        if(!f.isFile()||f.length()<40||f.length()>LIMIT+40L)return null;
        try(DataInputStream in=new DataInputStream(new FileInputStream(f))) {
            int format=in.readInt();if(format!=0x474c4b31&&format!=0x474c4b32)return null;
            int length=in.readInt(); if(length<1||length>LIMIT||f.length()!=length+40L)return null;
            byte[] expected=new byte[32]; in.readFully(expected);
            byte[] data=new byte[length];in.readFully(data);
            if(!MessageDigest.isEqual(expected,digest(data)))return null;
            String json=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(data)).toString();
            if(format==0x474c4b32)json=new RecoveryAssets(directory).unpack(json);
            return validator.valid(json)?new Snapshot(json,previous):null;
        }catch(Exception ignored){return null;}
    }
    synchronized Snapshot read() throws IOException {
        Snapshot current=readFile("current",false);if(current!=null)return current;
        Snapshot previous=readFile("previous",true);if(previous!=null)return previous;
        if(file("current").exists()||file("previous").exists())throw new IOException("Recovery integrity check failed");
        return null;
    }
    private void replace(File temporary,File target) throws IOException {
        // Fail closed if atomic replacement is unavailable: never truncate a valid generation.
        Files.move(temporary.toPath(),target.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
    }
    private void archiveDamaged(String name) throws IOException {
        File source=file(name);if(!source.exists())return;
        if(!source.isFile()||source.length()>LIMIT+40L)throw new IOException("Damaged recovery exceeds archive limit");
        File temporary=file(name+".damaged.tmp");
        try {
            try(InputStream in=new FileInputStream(source);FileOutputStream out=new FileOutputStream(temporary)) {
                byte[] block=new byte[16384];int n;while((n=in.read(block))!=-1)out.write(block,0,n);out.getFD().sync();
            }
            replace(temporary,file(name+".damaged"));
        }finally{Files.deleteIfExists(temporary.toPath());}
    }
    synchronized boolean write(String json) throws Exception {
        if(json==null||json.length()>LIMIT||!validator.valid(json))throw new IOException("Invalid recovery workspace");
        byte[] bytes=json.getBytes(StandardCharsets.UTF_8);
        if(bytes.length>LIMIT)throw new IOException("Recovery exceeds 32 MB");
        if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Recovery directory unavailable");
        Snapshot current=readFile("current",false);
        if(current!=null&&current.json.equals(json))return true;
        if(current==null){archiveDamaged("current");if(readFile("previous",true)==null)archiveDamaged("previous");}
        bytes=new RecoveryAssets(directory).pack(json).getBytes(StandardCharsets.UTF_8);
        if(bytes.length>LIMIT)throw new IOException("Recovery exceeds 32 MB");
        File next=file("next.tmp"),backup=file("previous.tmp");
        try {
            try(FileOutputStream raw=new FileOutputStream(next);DataOutputStream out=new DataOutputStream(raw)) {
                out.writeInt(0x474c4b32);out.writeInt(bytes.length);out.write(digest(bytes));out.write(bytes);out.flush();raw.getFD().sync();
            }
            if(current!=null) {
                try(InputStream in=new FileInputStream(file("current"));FileOutputStream out=new FileOutputStream(backup)) {
                    byte[] block=new byte[16384];int n;while((n=in.read(block))!=-1)out.write(block,0,n);out.getFD().sync();
                }
                replace(backup,file("previous"));
            }
            // If current was corrupt, retain the verified previous generation.
            replace(next,file("current"));new RecoveryAssets(directory).prune();return true;
        }finally{Files.deleteIfExists(next.toPath());Files.deleteIfExists(backup.toPath());}
    }
    synchronized boolean discard() throws IOException {
        for(String name:new String[]{"current","previous","next.tmp","previous.tmp"})Files.deleteIfExists(file(name).toPath());
        new RecoveryAssets(directory).prune();
        return true;
    }
}
