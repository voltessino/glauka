package it.neuromap.architect.preview;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Pure Java policy: no disk, network or Android API calls. */
final class AndroidAssetPolicy {
    private static final Set<String> SCRIPTS = new HashSet<>(Arrays.asList(
        "assets/mobile-touch-guidance.js","assets/mobile-map-polish.js","assets/mobile-app.js","assets/mobile-gestures.js","assets/map-style-core.js",
        "assets/creative-core.js","assets/creative-tools.js","assets/mathjax.js",
        "assets/continuation-layout.js","assets/map-core.js","assets/architect.js",
        "assets/mobile.js","assets/theme-picker.js","assets/localization.js",
        "assets/graphics.js","assets/ai-workflows.js","assets/drag-preview.js",
        "assets/lifecycle.js","assets/mobile-editor.js","assets/mobile-next.js",
        "assets/mobile-node-actions.js","assets/mobile-commands.js",
        "assets/map-style-core.js","assets/mobile-map-polish.js",
        "assets/smart-import-core.js","assets/android-74-core.js","assets/mobile-74.js",
        "assets/ocr-tools.js","assets/studio-tools.js",
        "assets/ocr/tesseract.min.js","assets/ocr/worker.min.js",
        "assets/ocr/host-worker.js","assets/ocr/tesseract-core-lstm.wasm.js",
        "assets/ocr/tesseract-core-simd-lstm.wasm.js",
        "assets/pdfjs/pdf.mjs","assets/pdfjs/pdf.worker.mjs",
        "assets/pdfjs/wasm/jbig2_nowasm_fallback.js","assets/pdfjs/wasm/openjpeg_nowasm_fallback.js"));
    private static final Set<String> STYLES = new HashSet<>(Arrays.asList(
        "assets/mobile-app.css","assets/interface-languages.css","assets/mobile-map-polish.css",
        "assets/mobile.css","assets/mobile-next.css","assets/mobile-ui-polish.css",
        "assets/mobile-commands.css","assets/mobile-74.css",
        "assets/mobile-map-polish.css"));
    private static final Set<String> IMAGES = new HashSet<>(Arrays.asList(
        "assets/icon-192.png","assets/icon-512.png"));
    private AndroidAssetPolicy() {}

    static String mimeFor(String encodedPath) {
        if (encodedPath==null||!encodedPath.startsWith("/")||
            encodedPath.indexOf('\\')>=0||encodedPath.indexOf('\0')>=0||
            encodedPath.indexOf('%')>=0||encodedPath.contains("..")||
            encodedPath.contains("//")||encodedPath.contains("?")||encodedPath.contains("#"))
            return null;
        String name="/".equals(encodedPath)?"app/index.html":encodedPath.substring(1);
        if(name.matches("app/locales/(it|en|de|es|fr|pt|ar|zh-CN)\\.json"))return "application/json";
        if(name.equals("app/index.html"))return "text/html";
        if(SCRIPTS.contains(name))return "text/javascript";
        if(STYLES.contains(name))return "text/css";
        if(IMAGES.contains(name))return "image/png";
        if(name.equals("assets/ocr/ita.traineddata"))return "application/octet-stream";
        if(name.equals("assets/pdfjs/wasm/jbig2.wasm")||name.equals("assets/pdfjs/wasm/openjpeg.wasm")||name.equals("assets/pdfjs/wasm/qcms_bg.wasm"))return "application/wasm";
        if(name.equals("manifest.webmanifest"))return "application/manifest+json";
        return null;
    }
}
