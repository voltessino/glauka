import Cocoa

let board = NSPasteboard.general
let original = (board.pasteboardItems ?? []).map { item in
    item.types.compactMap { type -> (NSPasteboard.PasteboardType, Data)? in
        guard let data = item.data(forType: type) else { return nil }
        return (type, data)
    }
}
defer {
    board.clearContents()
    let items = original.map { values -> NSPasteboardItem in
        let item = NSPasteboardItem()
        for (type, data) in values { item.setData(data, forType: type) }
        return item
    }
    if !items.isEmpty { board.writeObjects(items) }
}
for text in ["Unicode α é 中文 🧠\nSecond line", String(repeating: "# Markdown α\n- Concept\n", count: 20000), ""] {
    precondition(NeuroMapClipboard.write(text), "Native clipboard write failed")
    precondition(NeuroMapClipboard.read() == text, "Native clipboard round-trip changed the payload")
}
print("Native NSPasteboard: Unicode, multiline, large Markdown and empty text passed")
