import Cocoa

// Shared by the native host and its real NSPasteboard integration test.
enum NeuroMapClipboard {
    static func writePNG(_ encoded: String) -> Bool {
        guard encoded.utf8.count <= 44 * 1024 * 1024,
              let data = Data(base64Encoded: encoded),
              data.starts(with: [137,80,78,71,13,10,26,10]),
              let image = NSBitmapImageRep(data: data), image.pixelsWide > 0, image.pixelsHigh > 0,
              image.pixelsWide <= 8192, image.pixelsHigh <= 8192,
              image.pixelsWide * image.pixelsHigh <= 40_000_000 else { return false }
        NSPasteboard.general.clearContents()
        return NSPasteboard.general.setData(data, forType: .png)
    }
    static func read() -> String { NSPasteboard.general.string(forType: .string) ?? "" }
    static func write(_ text: String) -> Bool {
        NSPasteboard.general.clearContents()
        return NSPasteboard.general.setString(text, forType: .string)
    }
}
