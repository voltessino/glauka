"""Separate private Developer app identity while retaining historic public data.

Public Glauka.app keeps its original CFBundleIdentifier and user-data locations.
A Developer build uses a distinct bundle ID, WebKit profile and Go storage.
Never attempt an implicit data or Keychain migration during package creation.
"""
import plistlib

PUBLIC_BUNDLE_ID = "com.neuromap.architect.macbeta"
DEVELOPER_BUNDLE_ID = PUBLIC_BUNDLE_ID + ".developer"


def stage_macos_edition(mac_directory, developer=False):
    info_path = mac_directory / "Info.plist"
    data = plistlib.loads(info_path.read_bytes())
    if data.get("CFBundleIdentifier") != PUBLIC_BUNDLE_ID:
        raise ValueError("Unexpected macOS public bundle identifier; refusing automatic migration")
    data["CFBundleIdentifier"] = DEVELOPER_BUNDLE_ID if developer else PUBLIC_BUNDLE_ID
    data["CFBundleDisplayName"] = "Glauka Developer" if developer else "Glauka"
    info_path.write_bytes(plistlib.dumps(data))
    return data["CFBundleIdentifier"]
