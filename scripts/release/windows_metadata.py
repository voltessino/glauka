"""Stage Windows EXE/installer metadata from one release manifest value.

The source checkout stays untouched: both developer and public artifacts may be
compiled from the same commit without carrying the wrong edition into Explorer.
"""
import json
import re


def stage_windows_distribution_metadata(desktop, version, developer=False):
    match = re.fullmatch(r'(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?', version)
    if not match:
        raise ValueError('Invalid Windows version string')
    numeric = [int(v) for v in match.groups()[:3]]
    suffix = match.group(4) or ''
    numeric.append(int(suffix.rsplit('.', 1)[-1]) if re.search(r'\.\d+$', suffix) else 0)
    if any(v > 65535 for v in numeric):
        raise ValueError('Windows resource version component out of range')
    parts = dict(zip(('Major', 'Minor', 'Patch', 'Build'), numeric))
    edition = 'Glauka Developer' if developer else 'Glauka'
    for relative, description in (
        ('versioninfo.json', 'Glauka Desktop'),
        ('setup/versioninfo.json', 'Glauka Setup'),
    ):
        file = desktop / relative
        metadata = json.loads(file.read_text(encoding='utf-8'))
        for label in ('FileVersion', 'ProductVersion'):
            metadata['FixedFileInfo'][label] = parts.copy()
            metadata['StringFileInfo'][label] = version
        metadata['StringFileInfo']['ProductName'] = edition
        metadata['StringFileInfo']['FileDescription'] = (
            description + (' Developer' if developer else '')
        )
        file.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + '\n',
                        encoding='utf-8')

    script = desktop / 'setup/install_ui.ps1'
    source = script.read_text(encoding='utf-8-sig')
    source, code = re.subn(
        r"(?m)^(\$script:installerVersion=)'[^']*'$",
        lambda m: m.group(1) + "'" + version + "'", source)
    source, label = re.subn(
        r'Text="\d+\.\d+\.\d+(?:-[0-9A-Za-z.+-]+)?"',
        lambda _: 'Text="' + version + '"', source)
    if (code, label) != (1, 1):
        raise ValueError('Installer version label or assignment missing')
    script.write_text(source, encoding='utf-8-sig', newline='\n')

    installer = desktop / 'setup/main.go'
    source = installer.read_text(encoding='utf-8')
    source, updated = re.subn(
        r'Glauka-Installer-[0-9A-Za-z.+-]+\.log',
        lambda _: 'Glauka-Installer-' + version + '.log', source)
    if updated != 1:
        raise ValueError('Installer log version stamp missing')
    installer.write_text(source, encoding='utf-8', newline='\n')

    # "Developer" in the shared editor source must not leak into public builds.
    html = desktop / 'resources/index.html'
    source = html.read_text(encoding='utf-8')
    source, updated = re.subn(
        r"NM_PRODUCT_VERSION='[0-9][^']*'",
        lambda _: "NM_PRODUCT_VERSION='" + version +
                  (" Developer" if developer else "") + "'", source)
    if updated != 1:
        raise ValueError('Desktop product version label missing or ambiguous')
    html.write_text(source, encoding='utf-8', newline='\n')
