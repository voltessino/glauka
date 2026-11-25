"""Regression gates for the single Glauka site mark and document associations.

Run locally: python -m unittest scripts.release.test_glauka_brand_documents
No network, registry mutations or GitHub Actions.
"""
from __future__ import annotations
import plistlib
from pathlib import Path
import struct
import unittest
import xml.etree.ElementTree as ET
import zlib

ROOT=Path(__file__).resolve().parents[2]
read=lambda path:(ROOT/path).read_bytes()
text=lambda path:(ROOT/path).read_text(encoding="utf-8")

PNG_SIG=b"\x89PNG\r\n\x1a\n"
SVG="packages/brand/glauka-mark.svg"
SITE="apps/website/assets/glauka-mark.svg"
PNG=[
    "apps/desktop-shared/src/resources/icon.png",
    "apps/windows/installer/binaries/icon.png",
    "apps/windows/installer/binaries/brand.png",
    "apps/android/native/app/src/main/res/drawable/app_icon.png",
]
ICO=[
    "apps/desktop-shared/src/resources/icon.ico",
    "apps/windows/installer/binaries/icon.ico",
]

def png_info(data):
    assert data.startswith(PNG_SIG), "Missing PNG signature"
    offset=8
    collected=[]
    width=height=0
    while offset<len(data):
        assert offset+12<=len(data), "Truncated PNG chunk"
        count=struct.unpack_from(">I",data,offset)[0]
        kind=data[offset+4:offset+8]
        body=data[offset+8:offset+8+count]
        stored=struct.unpack_from(">I",data,offset+8+count)[0]
        assert zlib.crc32(kind+body)&0xffffffff==stored, "PNG CRC mismatch"
        offset+=12+count
        if kind==b"IHDR":
            width,height,depth,color=struct.unpack_from(">IIBB",body)
            assert (depth,color)==(8,6), "Expected RGBA PNG"
        elif kind==b"IDAT":
            collected.append(body)
        elif kind==b"IEND":
            break
    pixels=zlib.decompress(b"".join(collected))
    assert len(pixels)==height*(1+width*4), "Invalid PNG pixel length"
    # PNG scanlines are filtered; raw IDAT bytes are not RGBA pixels.
    rgba=bytearray()
    previous=bytearray(width*4)
    def paeth(a,b,c):
        predictor=a+b-c
        distances=(abs(predictor-a),abs(predictor-b),abs(predictor-c))
        return (a,b,c)[distances.index(min(distances))]
    for y in range(height):
        start=y*(1+width*4)
        kind=pixels[start]
        row=bytearray(pixels[start+1:start+1+width*4])
        assert kind in range(5), "Invalid PNG filter"
        for x in range(len(row)):
            left=row[x-4] if x>=4 else 0
            above=previous[x]
            upper_left=previous[x-4] if x>=4 else 0
            predictor=(0,left,above,(left+above)//2,paeth(left,above,upper_left))[kind]
            row[x]=(row[x]+predictor)&255
        rgba.extend(row)
        previous=row
    return width,height,bytes(rgba)

class GlaukaBrandDocuments(unittest.TestCase):
    def test_website_svg_is_native_master(self):
        self.assertEqual(read(SVG),read(SITE))
        root=ET.fromstring(read(SVG))
        self.assertEqual(root.attrib["viewBox"],"0 0 30 30")
        self.assertEqual(root.attrib["stroke"],"#6441df")
        self.assertEqual(root.find("{http://www.w3.org/2000/svg}path").attrib["d"],
                         "M5.76 8.28h5.88v5.88H5.76zM18.36 4.08h5.88v5.88h-5.88zM18.36 19.2h5.88v5.88h-5.88zM11.64 10.8l6.72-4.2m-6.72 4.2 6.72 10.92")
        self.assertNotIn("owl",text(SITE).lower())

    def test_png_assets_are_identical_and_decodable(self):
        files=[read(p) for p in PNG]
        self.assertTrue(all(x==files[0] for x in files))
        w,h,pixels=png_info(files[0])
        self.assertEqual((w,h),(256,256))
        self.assertTrue(any(pixels[i:i+3]==bytes((100,65,223)) for i in range(0,len(pixels)-3,4)),
                        "Native icon lacks Glauka purple")
        purple=[(i//4%w,i//4//w) for i in range(0,len(pixels),4)
                if pixels[i:i+4]==bytes((100,65,223,255))]
        self.assertTrue(purple)
        self.assertGreaterEqual(min(x for x,y in purple),24)
        self.assertGreaterEqual(min(y for x,y in purple),24)
        self.assertLessEqual(max(x for x,y in purple),w-25)
        self.assertLessEqual(max(y for x,y in purple),h-25)
        opaque=[(i//4%w,i//4//w) for i in range(0,len(pixels),4) if pixels[i+3]>0]
        self.assertTrue(opaque)
        # Preserve macOS/Windows Dock safe padding around the rounded icon tile.
        self.assertGreaterEqual(min(x for x,y in opaque),20)
        self.assertGreaterEqual(min(y for x,y in opaque),20)
        self.assertLessEqual(max(x for x,y in opaque),w-21)
        self.assertLessEqual(max(y for x,y in opaque),h-21)

    def test_ico_has_real_multi_resolution_png_images(self):
        left,right=map(read,ICO)
        self.assertEqual(left,right)
        self.assertEqual(left[:4],b"\x00\x00\x01\x00")
        count=struct.unpack_from("<H",left,4)[0]
        self.assertEqual(count,7)
        sizes=[]
        for i in range(count):
            start=6+16*i
            width=left[start] or 256
            length,offset=struct.unpack_from("<II",left,start+8)
            size=(width,width)
            self.assertEqual(png_info(left[offset:offset+length])[:2],size)
            sizes.append(width)
        self.assertEqual(sizes,[16,24,32,48,64,128,256])

    def test_explorer_registration_preserves_user_choice(self):
        installer=text("apps/windows/installer/install_files.ps1")
        ui=text("apps/windows/installer/install_ui.ps1")
        for name in (".gk",".glk",".neuromap","OpenWithProgids","DefaultIcon",
                     "Glauka.Developer.Project","Glauka.Project","SHChangeNotify"):
            self.assertIn(name,installer)
        self.assertIn("Install-GlaukaFileAssociations -Executable $exe -Icon $ico -Edition $Edition",ui)
        self.assertNotIn("Remove-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts'",installer)
        self.assertIn("if($eligible){Set-Item -Path $extensionKey -Value $progId}",installer)
        cleanup=text("apps/desktop-shared/src/uninstall_windows.go")
        self.assertNotIn("unregisterGlaukaAssociations(current)",cleanup)
        self.assertIn("registeredUninstallOwnsExecutable(current,registryName)",cleanup)
        self.assertIn("cleanupWindowsFiles",cleanup)
        script=text("apps/desktop-shared/src/uninstall_files.ps1")
        self.assertIn("Remove-OwnedRegistration",script)

    def test_web_mac_android_release_wiring(self):
        self.assertIn('assets/glauka-mark.svg',text("apps/website/home-review/index.html"))
        self.assertIn('assets/glauka-mark.svg',text("apps/website/home-review/home-en.html"))
        self.assertIn('assets/glauka-mark.svg',text("apps/website/index.html"))
        self.assertIn('glauka-mark.svg',text("scripts/release/build_anteprima_update.py"))
        plist=plistlib.loads(read("apps/macos/native/Info.plist"))
        self.assertEqual(plist["CFBundleIconFile"],"Glauka.icns")
        self.assertTrue({"gk","glk","neuromap"}.issubset(
            set(plist["CFBundleDocumentTypes"][0]["CFBundleTypeExtensions"])))
        self.assertIn('android:icon="@drawable/app_icon"',
                      text("apps/android/native/app/src/main/AndroidManifest.xml"))
        self.assertIn("'apps/android/native/app/src/main/res/drawable/app_icon.png'",
                      text("scripts/dev/build-glauka-icons.cjs"))

if __name__=="__main__":
    unittest.main()
