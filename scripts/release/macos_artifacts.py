"""Mach-O universal packaging and ad-hoc integrity checks; no native execution."""
import hashlib
import math
from pathlib import Path
import struct

ARCHES = {0x1000007, 0x100000C}


def thin_slices(data):
    if data[:4] == b'\xcf\xfa\xed\xfe':
        return [data]
    if data[:4] != b'\xca\xfe\xba\xbe':
        raise ValueError('Expected a 64-bit Mach-O or universal binary')
    count = struct.unpack_from('>I', data, 4)[0]
    if not 1 <= count <= 8:
        raise ValueError('Invalid architecture count')
    parts, ranges = [], []
    for i in range(count):
        cpu, subtype, offset, size, alignment = struct.unpack_from('>IIIII', data, 8 + 20*i)
        if alignment > 20 or offset % (1 << alignment) or offset < 8+20*count or offset+size > len(data):
            raise ValueError('Invalid universal slice bounds/alignment')
        if any(offset < end and offset+size > start for start, end in ranges):
            raise ValueError('Overlapping universal slices')
        part = data[offset:offset+size]
        if part[:4] != b'\xcf\xfa\xed\xfe' or struct.unpack_from('<II', part, 4) != (cpu, subtype):
            raise ValueError('Universal architecture does not match slice')
        parts.append(part)
        ranges.append((offset, offset+size))
    return parts


def universal(inputs, output):
    parts = [Path(p).read_bytes() for p in inputs]
    cpus = [struct.unpack_from('<I', p, 4)[0] for p in parts]
    if len(parts) != 2 or set(cpus) != ARCHES:
        raise ValueError('Exactly one Intel and one Apple Silicon binary are required')
    if any(p[:4] != b'\xcf\xfa\xed\xfe' for p in parts):
        raise ValueError('Expected thin 64-bit Mach-O inputs')
    header, chunks, offset = struct.pack('>II', 0xCAFEBABE, 2), [], 16384
    for part in parts:
        cpu, subtype = struct.unpack_from('<II', part, 4)
        header += struct.pack('>IIIII', cpu, subtype, offset, len(part), 14)
        chunks.append((offset, part))
        offset = (offset+len(part)+16383) & ~16383
    with Path(output).open('wb') as stream:
        stream.write(header)
        for offset, part in chunks:
            stream.seek(offset)
            stream.write(part)
    Path(output).chmod(0o755)
    if thin_slices(Path(output).read_bytes()) != parts:
        raise ValueError('Universal packing changed an input slice')


def verify_adhoc(binary, bundle=None):
    """Check every signed page, deployment target, system dependency and special slot.

    Ad-hoc signatures deliberately have no CMS certificate. This verifies their
    CodeDirectory integrity, not Apple trust, notarization or execution on macOS.
    """
    results = []
    for data in thin_slices(Path(binary).read_bytes()):
        cpu = struct.unpack_from('<I', data, 4)[0]
        count, commands_size = struct.unpack_from('<II', data, 16)
        pos, signature, minimum = 32, None, None
        dependencies = []
        for _ in range(count):
            command, length = struct.unpack_from('<II', data, pos)
            if length < 8 or pos+length > 32+commands_size or pos+length > len(data):
                raise ValueError('Invalid Mach-O command bounds')
            if command == 0x1D:
                start, size = struct.unpack_from('<II', data, pos+8)
                signature = data[start:start+size]
            if command in (0x32, 0x24):
                minimum = struct.unpack_from('<I', data, pos+(12 if command == 0x32 else 8))[0]
            if command in (0xC, 0x80000018, 0x8000001C):
                offset = struct.unpack_from('<I', data, pos+8)[0]
                name = data[pos+offset:pos+length].split(b'\0')[0].decode()
                if not name.startswith(('/usr/lib/', '/System/Library/')):
                    raise ValueError('Non-system dependency/rpath: '+name)
                dependencies.append(name)
            pos += length
        if cpu not in ARCHES or minimum is None or minimum > (12 << 16) or not signature:
            raise ValueError('Unsupported architecture, deployment target or missing signature')
        magic, total, count = struct.unpack_from('>III', signature)
        if magic != 0xFADE0CC0 or total > len(signature):
            raise ValueError('Invalid signature superblob')
        blobs = {}
        for i in range(count):
            slot, offset = struct.unpack_from('>II', signature, 12+8*i)
            length = struct.unpack_from('>I', signature, offset+4)[0]
            if offset+length > total:
                raise ValueError('Invalid signature blob bounds')
            blobs[slot] = signature[offset:offset+length]
        cd = blobs[0]
        flags, hashoff, _ = struct.unpack_from('>III', cd, 12)
        special, slots, limit = struct.unpack_from('>III', cd, 24)
        hashsize, hashtype, _, exponent = cd[36:40]
        if not flags & 2 or hashtype != 2 or hashsize != 32 or exponent > 20:
            raise ValueError('Expected SHA-256 ad-hoc CodeDirectory')
        if limit > len(data) or slots != math.ceil(limit/(1 << exponent)):
            raise ValueError('Invalid signed page count/limit')
        for i in range(slots):
            page = data[i*(1 << exponent):min((i+1)*(1 << exponent), limit)]
            if hashlib.sha256(page).digest() != cd[hashoff+i*hashsize:hashoff+(i+1)*hashsize]:
                raise ValueError('Signed Mach-O page hash mismatch')
        expected = {2: blobs[2]} if 2 in blobs else {}
        if bundle:
            if special < 3:
                raise ValueError('Main executable does not seal bundle metadata')
            expected.update({1: (Path(bundle)/'Contents/Info.plist').read_bytes(),
                             3: (Path(bundle)/'Contents/_CodeSignature/CodeResources').read_bytes()})
        for slot, value in expected.items():
            if special >= slot and hashlib.sha256(value).digest() != cd[hashoff-slot*hashsize:hashoff-(slot-1)*hashsize]:
                raise ValueError('Bundle/requirements signature hash mismatch')
        results.append({'cpuType': cpu, 'minimumMacOS': '.'.join(str((minimum >> n) & 255) for n in (16, 8, 0)),
                        'signedPages': slots, 'cdhash': hashlib.sha256(cd).digest()[:20].hex(),
                        'dependencies': dependencies})
    if {r['cpuType'] for r in results} != ARCHES:
        raise ValueError('Both Mac architectures must be signed')
    return results


def png_icns(png):
    """Keep the actual branded PNG dimensions in the correct ICNS chunk."""
    if len(png) < 24 or png[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Invalid PNG icon')
    width, height = struct.unpack_from('>II', png, 16)
    kind = {256: b'ic08', 512: b'ic09', 1024: b'ic10'}.get(width)
    if width != height or kind is None:
        raise ValueError('Unsupported PNG icon dimensions')
    return b'icns'+struct.pack('>I', len(png)+16)+kind+struct.pack('>I', len(png)+8)+png
