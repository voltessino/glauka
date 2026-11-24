import hashlib
import os
from pathlib import Path
import struct
import tempfile
import unittest

from macos_artifacts import thin_slices, universal, verify_adhoc, png_icns


def signed_thin(cpu, minimum=12 << 16):
    limit, cdsize, sigsize = 4096, 77, 97
    commands = struct.pack('<6I', 0x32, 24, 1, minimum, 14 << 16, 0)
    commands += struct.pack('<4I', 0x1D, 16, limit, sigsize)
    body = struct.pack('<8I', 0xFEEDFACF, cpu, 3 if cpu == 0x1000007 else 0, 2, 2, len(commands), 0, 0)+commands
    body += bytes(limit-len(body))
    cd = struct.pack('>9I4B', 0xFADE0C02, cdsize, 0x20001, 2, 45, 40, 0, 1, limit, 32, 2, 0, 12)
    cd += b'test\0'+hashlib.sha256(body).digest()
    return body+struct.pack('>5I', 0xFADE0CC0, sigsize, 1, 0, 20)+cd


class UniversalArtifactTests(unittest.TestCase):
    def fixture(self, directory, minimum=12 << 16):
        inputs = [Path(directory)/'intel', Path(directory)/'arm']
        for p, cpu in zip(inputs, (0x1000007, 0x100000C)):
            p.write_bytes(signed_thin(cpu, minimum))
        output = Path(directory)/'universal'
        universal(inputs, output)
        return inputs, output

    def test_universal_preserves_both_architectures_and_execute_mode(self):
        with tempfile.TemporaryDirectory() as d:
            inputs, output = self.fixture(d)
            self.assertEqual(thin_slices(output.read_bytes()), [p.read_bytes() for p in inputs])
            # Windows filesystems do not retain Unix execute bits after chmod.
            if os.name != 'nt':
                self.assertEqual(output.stat().st_mode & 0o777, 0o755)

    def test_duplicate_architectures_are_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            inputs, _ = self.fixture(d)
            with self.assertRaisesRegex(ValueError, 'Exactly one'):
                universal([inputs[0], inputs[0]], Path(d)/'bad')

    def test_slice_metadata_cannot_point_outside_the_file(self):
        with tempfile.TemporaryDirectory() as d:
            _, output = self.fixture(d)
            data = bytearray(output.read_bytes())
            struct.pack_into('>I', data, 16, len(data)+16384)
            with self.assertRaises(ValueError):
                thin_slices(data)

    def test_sha256_ad_hoc_integrity_for_both_architectures(self):
        with tempfile.TemporaryDirectory() as d:
            _, output = self.fixture(d)
            results = verify_adhoc(output)
            self.assertEqual([r['signedPages'] for r in results], [1, 1])
            self.assertEqual([r['minimumMacOS'] for r in results], ['12.0.0', '12.0.0'])

    def test_changed_executable_page_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            _, output = self.fixture(d)
            data = bytearray(output.read_bytes())
            data[16384+100] ^= 1
            output.write_bytes(data)
            with self.assertRaisesRegex(ValueError, 'page hash mismatch'):
                verify_adhoc(output)

    def test_newer_minimum_os_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            _, output = self.fixture(d, 13 << 16)
            with self.assertRaisesRegex(ValueError, 'deployment target'):
                verify_adhoc(output)

    def test_main_executable_must_seal_bundle_resources(self):
        with tempfile.TemporaryDirectory() as d:
            _, output = self.fixture(d)
            with self.assertRaisesRegex(ValueError, 'seal bundle metadata'):
                verify_adhoc(output, Path(d))


class IconTests(unittest.TestCase):
    def test_icon_chunk_matches_real_pixel_dimensions(self):
        for size, kind in [(256,b'ic08'), (512,b'ic09'), (1024,b'ic10')]:
            png = b'\x89PNG\r\n\x1a\n'+bytes(8)+struct.pack('>II',size,size)
            icon = png_icns(png)
            self.assertEqual(icon[8:12],kind)
            self.assertEqual(struct.unpack_from('>I',icon,4)[0],len(icon))
            self.assertEqual(icon[16:],png)
    def test_invalid_icon_is_rejected(self):
        for png in [b'',b'not png',b'\x89PNG\r\n\x1a\n'+bytes(8)+struct.pack('>II',256,512)]:
            with self.assertRaises(ValueError):png_icns(png)
