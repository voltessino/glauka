# Android WebView JavascriptInterface is called through reflection.
# R8 must retain Java methods exposed to bundled web content.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# No broad keep-all rules: retain only native-to-JavaScript entry points.
# Keep callback target class names if referenced by Android framework.
-keep class it.neuromap.architect.preview.MainActivity { *; }
