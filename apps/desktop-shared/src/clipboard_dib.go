package main

import (
    "encoding/binary"
    "errors"
    "image"
    "image/color"
)

// The PNG decoder already limits input to 40 million pixels, but validate
// again at the Win32 boundary before allocating the native HGLOBAL buffer.
func clipboardDIBSize(bounds image.Rectangle) (int, error) {
    width, height := int64(bounds.Dx()), int64(bounds.Dy())
    if width < 1 || height < 1 || width > 8192 || height > 8192 ||
        width*height > 40_000_000 {
        return 0, errors.New("Dimensioni degli appunti non valide")
    }
    return int(124 + width*height*4), nil
}

// Encode the Windows BITMAPV5HEADER and BGRA pixels directly into the caller's
// buffer. The Windows implementation uses the locked HGLOBAL memory itself;
// no extra ~160 MB Go bitmap copy is needed for large PNGs.
func encodeClipboardDIBV5(dst []byte, img image.Image) error {
    bounds := img.Bounds()
    size, err := clipboardDIBSize(bounds)
    if err != nil { return err }
    if len(dst) < size { return errors.New("Buffer appunti insufficiente") }
    width, height := bounds.Dx(), bounds.Dy()
    header := dst[:124]
    clear(header)
    put := func(offset int, value uint32) {
        binary.LittleEndian.PutUint32(header[offset:], value)
    }
    put(0, 124)
    put(4, uint32(width))
    put(8, uint32(int32(-height))) // top-down DIB, no Y-axis reversal
    binary.LittleEndian.PutUint16(header[12:], 1)
    binary.LittleEndian.PutUint16(header[14:], 32)
    put(16, 3) // BI_BITFIELDS
    put(20, uint32(width*height*4))
    put(40, 0x00ff0000)
    put(44, 0x0000ff00)
    put(48, 0x000000ff)
    put(52, 0xff000000)
    put(56, 0x73524742) // LCS_sRGB
    pixels := dst[124:size]
    if src, ok := img.(*image.NRGBA); ok {
        for y:=0; y<height; y++ {
            for x:=0; x<width; x++ {
                j:=src.PixOffset(bounds.Min.X+x, bounds.Min.Y+y)
                i:=(y*width+x)*4
                pixels[i],pixels[i+1],pixels[i+2],pixels[i+3] =
                    src.Pix[j+2],src.Pix[j+1],src.Pix[j],src.Pix[j+3]
            }
        }
        return nil
    }
    for y:=0; y<height; y++ {
        for x:=0; x<width; x++ {
            c:=color.NRGBAModel.Convert(img.At(bounds.Min.X+x,bounds.Min.Y+y)).(color.NRGBA)
            i:=(y*width+x)*4
            pixels[i],pixels[i+1],pixels[i+2],pixels[i+3]=c.B,c.G,c.R,c.A
        }
    }
    return nil
}
