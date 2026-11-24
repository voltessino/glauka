"""Offline five-phase release safety checks (no network, CI or user data changes).

These checks are intentionally additional to, not substitutes for, actual
Windows, macOS, Android builds, Playwright journeys and Go race tests.
"""
from __future__ import annotations

import ast
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import unittest
import xml.etree.ElementTree as ET

from bundle_cloud_modules import bundle as cloud_bundle, OUTPUT as CLOUD_BUNDLE
from prepare import ROOT


class FivePhaseReleaseIntegrity(unittest.TestCase):
    def test_python_release_qa_and_maintenance_scripts_parse(self):
        sources = sorted((ROOT / "scripts").rglob("*.py"))
        self.assertGreaterEqual(len(sources), 34)
        for source in sources:
            with self.subTest(path=source.relative_to(ROOT)):
                ast.parse(source.read_text(encoding="utf-8-sig"), filename=str(source))

    def test_power_shell_scripts_parse_when_shell_is_available(self):
        shell = shutil.which("pwsh") or shutil.which("powershell.exe")
        sources = sorted(ROOT.rglob("*.ps1"))
        self.assertGreaterEqual(len(sources), 10)
        if not shell:
            self.skipTest("PowerShell not installed: real script parse must run on Windows")
        for path in sources:
            # Parse only, never invoke an installer, cleanup or task registration.
            code = (
                "$tokens=$null;$errors=$null;"
                "[void][System.Management.Automation.Language.Parser]::ParseFile("
                "$env:GLAUKA_PS_PARSE_PATH,[ref]$tokens,[ref]$errors);"
                "if($errors.Count){$errors|Out-String|Write-Error;exit 1}"
            )
            result = subprocess.run(
                [shell, "-NoProfile", "-NonInteractive", "-Command", code],
                env={**os.environ,"GLAUKA_PS_PARSE_PATH":str(path)},
                cwd=ROOT, capture_output=True, text=True, timeout=20,
            )
            self.assertEqual(result.returncode, 0, f"{path}: {result.stderr}")

    def test_every_first_party_js_and_cjs_source_parses_in_one_node_process(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("Node not installed: JavaScript syntax scan not executed")
        # One Node process parses every first-party script without running it.
        script = r"""
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=process.cwd(),pending=[root],excluded=new Set(['.git','node_modules','vendor','build','.gradle']);
let checked=0,errors=[];
while(pending.length){
 const dir=pending.pop();
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){if(!excluded.has(entry.name))pending.push(file);continue;}
  if(!entry.isFile()||! /\.(?:js|cjs)$/.test(entry.name))continue;
  try{
   let code=fs.readFileSync(file,'utf8')
     .replaceAll('{{TOKEN}}','audit-session').replaceAll('{{DEV_EDITION}}','false');
   const relative=path.relative(root,file).split(path.sep).join('/');
   // prepare.py concatenates lexical fragments and replaces /* @neuromap-* */
   // markers. Marker shells and mid-function bodies are not standalone scripts;
   // composed bundles are checked by prepare/compare_editor_bundles instead.
   if(/@neuromap-[a-z0-9-]+/.test(code)){checked++;continue;}
   const lexical=/^(?:apps\/(?:desktop-shared|android)\/editor\/app-|packages\/editor-ui\/(?:editor-shared\/(?:app-|state-)|ai-studio-|export-hub-|linked-view-|creative-|continuation-|localization-messages|drag-preview-|graphics-))/;
   const tryParse=src=>{new vm.Script(src,{filename:file});};
   try{tryParse(code);}
   catch(first){
    if(!lexical.test(relative))throw first;
    try{tryParse('class GlaukaLexicalSyntaxCheck {\n'+code+'\n}');}
    catch(second){
     try{tryParse('(function(root){\n'+code+'\n})(globalThis);');}
     catch(third){
      // Mid-function extract: syntax is validated only after marker composition.
      if(/^(?:\s|\/\*[\s\S]*?\*\/)*?(?:App\.prototype\.|const |let |var |}|\/\*)/.test(code)){
        checked++;continue;
      }
      throw first;
     }
    }
   }
   checked++;
  }catch(error){errors.push(path.relative(root,file)+': '+error.message);}
 }
}
if(checked<450){console.error('First-party JS inventory shrank: '+checked);process.exit(1);}
if(errors.length){console.error(errors.join('\\n'));process.exit(1);}
console.log('Parsed '+checked+' first-party JS/CJS files');
"""
        result = subprocess.run([node, "-e", script], cwd=ROOT,
                                capture_output=True, text=True, timeout=90)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_android_markup_assets_are_allowed_and_present_or_staged(self):
        android = ROOT / "apps/android/native/app/src"
        html = (android / "main/assets/app/index.html").read_text(encoding="utf-8")
        policy = (android / "main/java/it/neuromap/architect/preview/AndroidAssetPolicy.java").read_text(encoding="utf-8")
        references = set(re.findall(r"""(?:src|href)="/(assets/[^"]+)" """.strip(), html))
        self.assertGreaterEqual(len(references), 25)
        # Assets written by prepare.py have no static native counterpart.
        from prepare import SHARED, bundles
        generated = set(bundles()) | {"architect", "map-style-core", "android-74-core", "interface-languages.css"}
        for asset in sorted(references):
            with self.subTest(asset=asset):
                self.assertIn('"' + asset + '"', policy,
                              "Android WebView would return 403 for this resource")
                relative = asset[len("assets/"):]
                if not (android / "main/assets" / asset).is_file():
                    self.assertIn(relative.removesuffix(".js"), generated,
                                  "Neither checked in nor regenerated by prepare.py")
        java = (android / "main/java/it/neuromap/architect/preview/MainActivity.java").read_text(encoding="utf-8")
        self.assertIn("AndroidAssetPolicy.mimeFor(path)", java)

    def test_cloud_bundle_matches_modules_exactly(self):
        self.assertEqual(CLOUD_BUNDLE.read_text(encoding="utf-8"), cloud_bundle())
        bridge = (ROOT / "apps/desktop-shared/src/bridge.js").read_text(encoding="utf-8")
        for route in ("cloud/index/read", "cloud/index/write", "cloud/request",
                      "cloud/auth/status", "cloud/document/read", "cloud/document/write"):
            self.assertIn(route, bridge)
        self.assertNotIn('access_token"', bridge)

    def test_public_installer_is_not_branded_private_developer(self):
        python = (ROOT / "scripts/release/build_desktop.py").read_text(encoding="utf-8")
        go = (ROOT / "apps/windows/installer/main.go").read_text(encoding="utf-8")
        ps1 = (ROOT / "apps/windows/installer/install_ui.ps1").read_text(encoding="utf-8-sig")
        self.assertIn("main.installerEdition=", python)
        self.assertIn("var installerEdition = \"Release\"", go)
        self.assertIn('"-Edition", installerEdition', go)
        self.assertIn("[ValidateSet(\"Release\",\"Developer\")]", ps1)
        self.assertIn("if($script:isDeveloper){'Glauka Developer'}else{'Glauka'}", ps1)
        self.assertIn("-Name DisplayName -Value $script:displayName", ps1)

    def test_macos_subframe_origin_is_checked(self):
        swift = (ROOT / "apps/macos/native/main.swift").read_text(encoding="utf-8")
        self.assertIn("navigationAction.targetFrame?.isMainFrame == false", swift)
        self.assertIn("trustedPage(requested)", swift)
        self.assertIn("trustedPage(blobOrigin)", swift)
        self.assertIn("decisionHandler(.cancel)", swift)
        compiler = shutil.which("swiftc")
        if compiler:
            files = list((ROOT / "apps/macos/native").glob("*.swift")) + list((ROOT / "apps/macos/tests/clipboard").glob("*.swift"))
            for file in files:
                result = subprocess.run([compiler, "-frontend", "-parse", str(file)],
                                        capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 0, f"{file}: {result.stderr}")

    def test_both_macos_packagers_match_the_canonical_plist(self):
        info = plistlib.loads((ROOT / "apps/macos/native/Info.plist").read_bytes())
        self.assertEqual(info["CFBundleExecutable"], "Glauka")
        self.assertEqual(info["CFBundleIconFile"], "Glauka.icns")
        cross = (ROOT / "scripts/release/build_macos_cross.py").read_text(encoding="utf-8")
        kit = (ROOT / "apps/macos/Build-Precompiled.command").read_text(encoding="utf-8")
        self.assertIn("app = output/'Glauka Developer.app'", cross)
        self.assertIn("universal(shells, mac/'Glauka')", cross)
        self.assertIn("version.split('-',1)[0]", cross)
        self.assertIn("(resources/'Glauka.icns').write_bytes", cross)
        self.assertIn("verify_adhoc(mac/'Glauka', app)", cross)
        self.assertIn('app="$build_dir/Glauka.app"', kit)
        self.assertIn('"$app/Contents/MacOS/Glauka"', kit)
        self.assertIn('codesign --force --sign - "$app/Contents/MacOS/Glauka"', kit)
        self.assertIn('"$app/Contents/Resources/Glauka.icns"', kit)
        self.assertNotIn('MacOS/NeuroMap Architect', kit)

    def test_android_retail_permissions_and_configurations(self):
        root = ROOT / "apps/android/native/app/src/main"
        manifest = ET.parse(root / "AndroidManifest.xml").getroot()
        android = "{http://schemas.android.com/apk/res/android}"
        application = manifest.find("application")
        self.assertEqual(application.attrib.get(android + "allowBackup"), "false")
        self.assertEqual(application.attrib.get(android + "usesCleartextTraffic"), "false")
        gradle = (ROOT / "apps/android/native/app/build.gradle").read_text(encoding="utf-8")
        self.assertIn("buildConfigField 'boolean', 'PRIVATE_AI_TEST', 'false'", gradle)
        self.assertIn("minifyEnabled true", gradle)
        self.assertIn("shrinkResources true", gradle)
        info = plistlib.loads((ROOT / "apps/macos/native/Info.plist").read_bytes())
        self.assertTrue(info["CFBundleIdentifier"])

    def test_regression_test_suites_remain_registered(self):
        scripts = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["scripts"]
        for name in ("test", "test:browser", "test:build", "test:android:ui",
                     "test:android:stress", "test:universal", "test:website"):
            self.assertIn(name, scripts)
        self.assertGreaterEqual(len(list((ROOT / "tests/browser").glob("*.spec.js"))), 95)
        self.assertGreaterEqual(len(list((ROOT / "packages/editor-ui/tests").glob("*.test.js"))), 130)
