"""Unit tests for non-destructive Git tree accounting (no GitHub or network)."""
import unittest
from repository_footprint import analyze, category, parse_tree


class RepositoryFootprintTests(unittest.TestCase):
    def test_parse_tree_counts_blobs_not_submodules(self):
        data = (b'100644 blob deadbeef 4\tapps/project/file.js\0'
                b'100644 blob beaded00 12\tdocs/a file.md\0'
                b'160000 commit 0123456 -\tdependency\0')
        self.assertEqual(parse_tree(data), [
            {'path': 'apps/project/file.js', 'bytes': 4},
            {'path': 'docs/a file.md', 'bytes': 12},
        ])

    def test_accounting_totals_and_classification(self):
        files = [
            {'path': 'apps/windows/legacy/previous.zip', 'bytes': 100},
            {'path': 'docs/qa/evidence/previous.png', 'bytes': 80},
            {'path': 'packages/editor-ui/vendor/mathjax/foo.js', 'bytes': 20},
            {'path': 'apps/android/editor/app.js', 'bytes': 10},
            {'path': 'docs/screenshots/ui.png', 'bytes': 30},
            {'path': 'apps/website/index.html', 'bytes': 5},
        ]
        report = analyze(files, top=2)
        self.assertEqual(report['total_bytes'], 245)
        self.assertEqual(report['file_count'], 6)
        self.assertEqual(report['code_bytes'], 35)
        self.assertEqual(report['code_files'], 3)
        self.assertEqual(report['categories']['archivi_storici_da_rivedere']['bytes'], 100)
        self.assertEqual(len(report['historical_archives_review_only']), 1)
        self.assertEqual(len(report['largest_files']), 2)
        self.assertFalse(report['cleanup_performed'])

    def test_no_false_archive_deletion_for_active_vendor_or_media(self):
        self.assertEqual(category('apps/windows/legacy/build.zip'), 'archivi_storici_da_rivedere')
        self.assertEqual(category('apps/android/legacy/backup.tar.gz.b64'), 'archivi_storici_da_rivedere')
        self.assertNotEqual(category('apps/website/media/video.mp4'), 'archivi_storici_da_rivedere')
        self.assertNotEqual(category('packages/editor-ui/vendor/mathjax/tex-svg-full.js'), 'archivi_storici_da_rivedere')

    def test_invalid_metadata_is_rejected(self):
        with self.assertRaises(ValueError):
            parse_tree(b'invalid\0')
        with self.assertRaises(ValueError):
            analyze([{'path': 'bad', 'bytes': -1}])

    def test_empty_tree_is_supported_without_side_effects(self):
        report = analyze([])
        self.assertEqual(report['total_bytes'], 0)
        self.assertEqual(report['historical_archives_review_only'], [])
        self.assertFalse(report['cleanup_performed'])


if __name__ == '__main__':
    unittest.main()
