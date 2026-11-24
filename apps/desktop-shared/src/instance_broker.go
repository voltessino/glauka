package main

import (
 "bytes"
 "context"
 "crypto/subtle"
 "encoding/json"
 "errors"
 "fmt"
 "net/http"
 "os"
 "path/filepath"
 "strings"
 "time"
)

type instanceEndpoint struct {
 Port int `json:"port"`
 Token string `json:"token"`
}
func instanceRecordPath(dir string)string{
 name:="glauka-instance.json"
 if developerEdition(){name="glauka-developer-instance.json"}
 return filepath.Join(dir,name)
}

// This token has ONLY the right to submit a file-open request, never read or
// mutate projects or invoke the powerful desktop API. Never publish s.secret.
func writeInstanceEndpoint(dir string,port int,token string)error{
 if port<1||port>65535||len(token)<32{return errors.New("invalid Glauka instance endpoint")}
 if err:=os.MkdirAll(dir,0700);err!=nil{return err}
 data,err:=json.Marshal(instanceEndpoint{Port:port,Token:token})
 if err!=nil{return err}
 return atomicFile(instanceRecordPath(dir),data)
}
func removeInstanceEndpoint(dir,token string){
 data,err:=os.ReadFile(instanceRecordPath(dir))
 if err!=nil{return}
 var endpoint instanceEndpoint
 if json.Unmarshal(data,&endpoint)==nil&&endpoint.Token==token{
  _=os.Remove(instanceRecordPath(dir))
 }
}
func forwardedPaths(args []string) []string {
	if len(args) < 2 || strings.HasPrefix(args[1], "--") {
		return nil
	}
	paths := []string{}
	seen := map[string]bool{}
	for _, path := range args[1:] {
		if !projectExtension(path) {
			continue
		}
		key, err := approvedPathKey(path)
		if err != nil || seen[key] {
			continue
		}
		abs, err := filepath.Abs(path)
		if err != nil {
			continue
		}
		seen[key] = true
		paths = append(paths, filepath.Clean(abs))
	}
	return paths
}

type instanceSubmissionError struct{ status int }

func (e instanceSubmissionError) Error() string {
	return fmt.Sprintf("Glauka non ha accettato il documento (%d)", e.status)
}
func forwardPathsToRunningInstance(dir string, paths []string) (int, error) {
	if len(paths) == 0 {
		return 0, forwardToRunningInstance(dir, "")
	}
	sent := 0
	var failed []error
	for i, path := range paths {
		if err := forwardToRunningInstance(dir, path); err != nil {
			failed = append(failed, fmt.Errorf("%s: %w", filepath.Base(path), err))
			var rejected instanceSubmissionError
			if !errors.As(err, &rejected) {
				if i+1 < len(paths) {
					failed = append(failed, fmt.Errorf("Altri %d documenti non inviati: istanza non raggiungibile", len(paths)-i-1))
				}
				break
			}
		} else {
			sent++
		}
	}
	return sent, errors.Join(failed...)
}

// The secondary process cannot spawn another browser. A bounded retry covers
// first-start races between obtaining the mutex and writing the endpoint.
func forwardToRunningInstance(dir,path string)error{
 client:=&http.Client{Timeout:700*time.Millisecond,Transport:&http.Transport{Proxy:nil}}
 defer client.CloseIdleConnections()
 var last error
 for attempt:=0;attempt<50;attempt++{
  data,err:=os.ReadFile(instanceRecordPath(dir))
  if err==nil{
   var endpoint instanceEndpoint
   if json.Unmarshal(data,&endpoint)==nil&&endpoint.Port>0&&endpoint.Port<=65535&&len(endpoint.Token)>=32{
    body,_:=json.Marshal(map[string]string{"path":path})
    ctx,cancel:=context.WithTimeout(context.Background(),700*time.Millisecond)
    url:=fmt.Sprintf("http://127.0.0.1:%d/__desktop/external/submit",endpoint.Port)
    req,reqErr:=http.NewRequestWithContext(ctx,http.MethodPost,url,bytes.NewReader(body))
    if reqErr==nil{
     req.Host=fmt.Sprintf("127.0.0.1:%d",endpoint.Port)
     req.Header.Set("Content-Type","application/json")
     req.Header.Set("X-Glauka-IPC",endpoint.Token)
     res,sendErr:=client.Do(req)
     if sendErr==nil{
      _=res.Body.Close()
      cancel()
      if res.StatusCode==http.StatusOK{return nil}
      if res.StatusCode==http.StatusBadRequest||res.StatusCode==http.StatusTooManyRequests{
       return instanceSubmissionError{res.StatusCode}
      }
      last=fmt.Errorf("Risposta Glauka %d",res.StatusCode)
     }else{last=sendErr;cancel()}
    }else{last=reqErr;cancel()}
   }
  }else{last=err}
  time.Sleep(100*time.Millisecond)
 }
 return fmt.Errorf("Glauka è già in esecuzione ma non risponde. Verifica la finestra aperta e riprova: %v",last)
}
func (s *service) acceptInstanceSubmission(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", 405)
		return
	}
	token := r.Header.Get("X-Glauka-IPC")
	if len(s.ipcToken) < 32 || len(token) != len(s.ipcToken) || subtle.ConstantTimeCompare([]byte(token), []byte(s.ipcToken)) != 1 {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	var q struct {
		Path string `json:"path"`
	}
	if !readJSON(w, r, &q, 4096) {
		return
	}
	if q.Path != "" {
		abs, err := filepath.Abs(q.Path)
		if err != nil || !filepath.IsAbs(q.Path) || !projectExtension(abs) {
			responseJSON(w, 400, response{Message: "Tipo di progetto non valido"})
			return
		}
		fi, err := os.Stat(abs)
		if err != nil || !fi.Mode().IsRegular() || fi.Size() > 100<<20 {
			responseJSON(w, 400, response{Message: "Il progetto non è accessibile"})
			return
		}
		s.mu.Lock()
		seen := false
		incoming, _ := approvedPathKey(abs)
		for _, existing := range s.externalQueue {
			key, _ := approvedPathKey(existing)
			if key == incoming {
				seen = true
				break
			}
		}
		if !seen && len(s.externalQueue) >= 64 {
			s.mu.Unlock()
			responseJSON(w, 429, response{Message: "Troppe richieste di apertura"})
			return
		}
		if !seen {
			s.externalQueue = append(s.externalQueue, abs)
		}
		s.mu.Unlock()
	}
	responseJSON(w, 200, response{OK: true})
}
