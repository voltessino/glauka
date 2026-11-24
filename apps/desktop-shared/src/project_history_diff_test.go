package main

import (
 "archive/zip"
 "bytes"
 "os"
 "path/filepath"
 "strings"
 "testing"
)

func buildTestXMind(t *testing.T, files map[string]string) []byte {
 t.Helper()
 var buf bytes.Buffer
 zw := zip.NewWriter(&buf)
 for name, body := range files {
  w, err := zw.Create(name)
  if err != nil {
   t.Fatal(err)
  }
  if _, err := w.Write([]byte(body)); err != nil {
   t.Fatal(err)
  }
 }
 if err := zw.Close(); err != nil {
  t.Fatal(err)
 }
 return buf.Bytes()
}

func TestProjectHistoryDiffSummary(t *testing.T) {
 old:=[]byte(`{"root":{"id":"r","text":"map","children":[{"id":"a","text":"old","children":[]},{"id":"b","text":"to remove"}]},"images":[{}]}`)
 current:=[]byte(`{"root":{"id":"r","text":"map","children":[{"id":"a","text":"new","children":[]},{"id":"c","text":"created"}]},"images":[{},{}]}`)
 got:=compareProjectHistory(old,current)
 if !got.Supported||got.Added!=1||got.Removed!=1||got.Modified!=1{
  t.Fatalf("diff is wrong: %+v",got)
 }
 if got.Before!=3||got.Now!=3||got.ImagesBefore!=1||got.ImagesNow!=2{
  t.Fatalf("counts wrong: %+v",got)
 }
 if compareProjectHistory([]byte("PK\x03\x04"),current).Supported{
  t.Fatal("XMind binary must never be labeled as comparable JSON")
 }
 if compareProjectHistory(old,old).Modified!=0{
  t.Fatal("identity should produce no modifications")
 }
}

func TestProjectHistorySupportsAllGlaukaReadableFormats(t *testing.T) {
 oldXMind := buildTestXMind(t, map[string]string{
  "content.json": `[{"id":"s1","class":"sheet","title":"Istologia","rootTopic":{"id":"rt","title":"Tessuto","children":{"attached":[{"id":"n1","title":"Epitelio"},{"id":"n2","title":"Connettivo"}]}}}]`,
 })
 newXMind := buildTestXMind(t, map[string]string{
  "content.json": `[{"id":"s1","class":"sheet","title":"Istologia","rootTopic":{"id":"rt","title":"Tessuto","children":{"attached":[{"id":"n1","title":"Epitelio aggiornato"},{"id":"n3","title":"Muscolare"}]}}}]`,
  "resources/img1.png": "PNG",
 })
 xdiff := compareProjectHistory(oldXMind, newXMind)
 if !xdiff.Supported || xdiff.Added != 1 || xdiff.Removed != 1 || xdiff.Modified != 1 || xdiff.ImagesNow != 1 {
  t.Fatalf("xmind content.json diff failed: %+v", xdiff)
 }

 legacyOld := buildTestXMind(t, map[string]string{
  "content.xml": `<xmap-content><sheet id="s1"><topic id="r"><title>Root</title><children><topics type="attached"><topic id="t1"><title>Old</title></topic></topics></children></topic></sheet></xmap-content>`,
 })
 legacyNew := buildTestXMind(t, map[string]string{
  "content.xml": `<xmap-content><sheet id="s1"><topic id="r"><title>Root</title><children><topics type="attached"><topic id="t1"><title>Renamed</title></topic><topic id="t2"><title>Added</title></topic></topics></children></topic></sheet></xmap-content>`,
 })
 legacyDiff := compareProjectHistory(legacyOld, legacyNew)
 if !legacyDiff.Supported || legacyDiff.Added != 1 || legacyDiff.Modified != 1 {
  t.Fatalf("legacy xmind content.xml diff failed: %+v", legacyDiff)
 }

 opmlOld := []byte(`<opml version="2.0"><body><outline text="Root"><outline text="Alfa"/></outline></body></opml>`)
 opmlNew := []byte(`<opml version="2.0"><body><outline text="Root"><outline text="Alfa"/><outline text="Beta"/></outline></body></opml>`)
 opmlDiff := compareProjectHistory(opmlOld, opmlNew)
 if !opmlDiff.Supported || opmlDiff.Added != 1 || opmlDiff.Removed != 0 {
  t.Fatalf("opml diff failed: %+v", opmlDiff)
 }

 mdOld := []byte("<!-- NeuroMap-Markdown-v2 -->\n# Anatomia\n- Cuore\n- Polmoni\n")
 mdNew := []byte("<!-- NeuroMap-Markdown-v2 -->\n# Anatomia\n- Cuore\n- Fegato\n")
 mdDiff := compareProjectHistory(mdOld, mdNew)
 if !mdDiff.Supported || mdDiff.Added != 1 || mdDiff.Removed != 1 {
  t.Fatalf("markdown diff failed: %+v", mdDiff)
 }
}

func TestHistoryCompressionPinnedAndLegacyRoundTrip(t *testing.T) {
 home:=t.TempDir();cfg:=filepath.Join(home,"cfg")
 file:=filepath.Join(home,"subject.gk")
 original:=[]byte(`{"root":{"id":"r","text":"`+strings.Repeat("Anatomia del cuore",1000)+`"}}`)
 if err:=os.WriteFile(file,original,0600);err!=nil{t.Fatal(err)}
 id,err:=stageProjectRevision(cfg,file,[]byte("new content"))
 if err!=nil{t.Fatal(err)}
 folder,_:=projectHistoryDir(cfg,file)
 disk,err:=os.ReadFile(filepath.Join(folder,id))
 if err!=nil{t.Fatal(err)}
 if len(disk)>=len(original){t.Fatal("expected compressed snapshot to be smaller than original")}
 if !bytes.Equal(disk[:2],[]byte{0x1f,0x8b}){t.Fatal("expected gzip magic bytes")}
 restored,err:=readProjectRevision(cfg,file,id)
 if err!=nil||!bytes.Equal(restored,original){t.Fatalf("compressed roundtrip: %v",err)}
 if err:=setProjectRevisionPinned(cfg,file,id,true);err!=nil{t.Fatal(err)}
 versions,err:=listProjectRevisions(cfg,file)
 if err!=nil||len(versions)!=1||!versions[0].Pinned{t.Fatalf("pinned flag: %+v %v",versions,err)}
 if err:=pruneProjectRevisions(cfg,file);err!=nil{t.Fatal(err)}
 restored,err=readProjectRevision(cfg,file,id)
 if err!=nil||!bytes.Equal(restored,original){t.Fatalf("pinned snapshot damaged: %v",err)}
 if err:=setProjectRevisionPinned(cfg,file,id,false);err!=nil{t.Fatal(err)}
 versions,err=listProjectRevisions(cfg,file)
 if err!=nil||versions[0].Pinned{t.Fatalf("unpin failed: %+v %v",versions,err)}
 // Older uncompressed .snap files are still valid.
 if err:=os.WriteFile(filepath.Join(folder,id),original,0600);err!=nil{t.Fatal(err)}
 restored,err=readProjectRevision(cfg,file,id)
 if err!=nil||!bytes.Equal(restored,original){t.Fatalf("legacy read: %v",err)}
}
