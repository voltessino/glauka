#!/usr/bin/env python3
"""Build a Linux QA backend with only the unavailable native picker substituted.

The editor, HTTP transport, filesystem reads, approvals and importers are real.
Never distribute this QA binary as the application. Production Win/Mac pickers
are neither edited nor replaced. No benchmark runs during this preparation.
"""
from pathlib import Path
import argparse,hashlib,json,os,subprocess,sys
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/release'))
import prepare

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();out=args.output.resolve()
    if out.exists() or out.is_relative_to(ROOT) or ROOT.is_relative_to(out):
        parser.error('Use a new directory outside the source checkout')
    out.mkdir(parents=True)
    stage=prepare.prepare('macos',out/'stage')/'desktop'
    original=stage/'dialog_file_other.go';replacement=out/'qa_dialog_file_other.go'
    replacement.write_text('''//go:build !windows && !darwin
package main
import("encoding/json";"errors";"os")
func desktopFileDialog(save bool,suggested string)(string,error){return "",errors.New("Single native picker unavailable in Linux QA probe")}
func desktopMultiOpenDialog()([]string,error){
 data,err:=os.ReadFile(os.Getenv("GLAUKA_QA_MULTI_SELECTION"));if err!=nil{return nil,err}
 var paths []string;err=json.Unmarshal(data,&paths);return paths,err
}
''')
    overlay=out/'overlay.json';overlay.write_text(json.dumps({'Replace':{str(original):str(replacement)}}))
    executable=out/'qa-backend'
    subprocess.run(['go','build','-buildvcs=false','-tags','developer','-overlay',str(overlay),'-o',str(executable),'.'],cwd=stage,check=True)
    revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    diff=subprocess.check_output(['git','diff','--binary','HEAD'],cwd=ROOT)
    manifest={'sourceRevision':revision,'sourceDiffSHA256':hashlib.sha256(diff).hexdigest(),'executable':str(executable),'binarySHA256':hashlib.sha256(executable.read_bytes()).hexdigest(),'host':sys.platform,'productionNativePickerTested':False,'substitution':'Linux picker boundary only; selected paths supplied by QA fixture file','distributionAllowed':False}
    (out/'probe-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('QA backend prepared; native Windows/macOS picker not exercised.')
if __name__=='__main__':main()
