package main

import (
    "bytes"
    "encoding/binary"
    "image"
    "image/color"
    "testing"
)

func TestClipboardDIBV5PixelLayoutAndHeader(t *testing.T) {
    img := image.NewNRGBA(image.Rect(4, 7, 6, 8))
    img.SetNRGBA(4, 7, color.NRGBA{R: 0x11, G: 0x22, B: 0x33, A: 0x44})
    img.SetNRGBA(5, 7, color.NRGBA{R: 0x77, G: 0x88, B: 0x99, A: 0xff})
    size, err := clipboardDIBSize(img.Bounds())
    if err != nil || size != 124+8 { t.Fatalf("size: %d %v", size, err) }
    buffer := make([]byte, size)
    if err := encodeClipboardDIBV5(buffer, img); err != nil { t.Fatal(err) }
    if binary.LittleEndian.Uint32(buffer[:4]) != 124 ||
       binary.LittleEndian.Uint32(buffer[4:8]) != 2 ||
       int32(binary.LittleEndian.Uint32(buffer[8:12])) != -1 ||
       binary.LittleEndian.Uint32(buffer[16:20]) != 3 {
        t.Fatal("invalid Windows BITMAPV5 header")
    }
    if !bytes.Equal(buffer[124:], []byte{0x33,0x22,0x11,0x44,0x99,0x88,0x77,0xff}) {
        t.Fatalf("BGRA pixel order: %x", buffer[124:])
    }
}

func TestClipboardDIBV5GenericImageUsesCorrectTopDownPixels(t *testing.T) {
    img := image.NewRGBA(image.Rect(0,0,1,2))
    img.SetRGBA(0,0,color.RGBA{R:0xf0,G:0x40,B:0x20,A:0xff})
    img.SetRGBA(0,1,color.RGBA{R:0x10,G:0x50,B:0x90,A:0xff})
    buf := make([]byte,124+8)
    if err:=encodeClipboardDIBV5(buf,img);err!=nil{t.Fatal(err)}
    if !bytes.Equal(buf[124:],[]byte{0x20,0x40,0xf0,0xff,0x90,0x50,0x10,0xff}){
        t.Fatalf("pixel rows reversed or channels wrong: %x",buf[124:])
    }
}

func TestClipboardDIBV5RejectsOversizeOrShortBuffers(t *testing.T) {
    for _, rect := range []image.Rectangle{
        image.Rect(0,0,0,1),image.Rect(0,0,8193,1),
        image.Rect(0,0,8000,8000),
    } {
        if _,err:=clipboardDIBSize(rect);err==nil{
            t.Fatalf("accepted invalid dimensions %v",rect)
        }
    }
    img:=image.NewNRGBA(image.Rect(0,0,2,2))
    if err:=encodeClipboardDIBV5(make([]byte,124),img);err==nil {
        t.Fatal("short HGLOBAL buffer accepted")
    }
}
