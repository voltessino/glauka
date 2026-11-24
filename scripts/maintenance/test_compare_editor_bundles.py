"""Offline contract tests for the read-only structural refactor comparator."""
import json
import unittest

from compare_editor_bundles import (MARKER, SourceContractError,
                                    assemble_from_reader, compare_sources,
                                    assemble_ui_from_reader, compare_ui_sources)


class CompareEditorBundlesTests(unittest.TestCase):
    def sources(self, parts, *, platform='desktop'):
        folder = 'apps/desktop-shared/editor' if platform == 'desktop' else 'apps/android/editor'
        return {
            f'{folder}/sources.json': json.dumps(list(parts)),
            'packages/editor-ui/editor-colors.js': '/* color rules */',
            **{f'{folder}/{name}': source for name, source in parts.items()},
        }

    def reader(self, files):
        return files.__getitem__

    def test_byte_preserving_extraction_is_identical(self):
        before = self.sources({'prelude.js': 'const x = 1;\n' + MARKER + '\n',
                               'startup.js': 'start(x);'})
        after = self.sources({'prelude.js': 'const x = 1;\n',
                              'helper.js': MARKER + '\n',
                              'startup.js': 'start(x);'})
        result = compare_sources(self.reader(before), self.reader(after), ('desktop',))[0]
        self.assertTrue(result['identical'])
        self.assertIsNone(result['first_difference_at'])
        self.assertEqual(result['added_sources'], ['helper.js'])

    def test_behavioral_change_is_reported_not_mislabeled(self):
        before = self.sources({'prelude.js': MARKER + '\nconst x = 1;',
                               'startup.js': 'start(x);'})
        after = self.sources({'prelude.js': MARKER + '\nconst x = 2;',
                              'startup.js': 'start(x);'})
        result = compare_sources(self.reader(before), self.reader(after), ('desktop',))[0]
        self.assertFalse(result['identical'])
        self.assertIsInstance(result['first_difference_at'], int)
        self.assertNotEqual(result['before_sha256'], result['after_sha256'])

    def test_reordered_sources_are_reported(self):
        before = self.sources({'prelude.js': MARKER,
                               'a.js': 'first();', 'b.js': 'second();',
                               'startup.js': ''})
        after = dict(before)
        folder = 'apps/desktop-shared/editor'
        after[f'{folder}/sources.json'] = json.dumps(
            ['prelude.js', 'b.js', 'a.js', 'startup.js'])
        self.assertFalse(compare_sources(self.reader(before), self.reader(after),
                                         ('desktop',))[0]['identical'])

    def test_unsafe_or_duplicate_manifest_is_rejected(self):
        data = self.sources({'prelude.js': MARKER, 'startup.js': ''})
        key = 'apps/desktop-shared/editor/sources.json'
        for entries in (['prelude.js', '../secret.js', 'startup.js'],
                        ['prelude.js', 'prelude.js', 'startup.js']):
            broken = dict(data, **{key: json.dumps(entries)})
            with self.assertRaises(SourceContractError):
                assemble_from_reader(self.reader(broken), 'desktop')

    def test_missing_marker_and_bad_platform_fail_closed(self):
        data = self.sources({'prelude.js': 'const x=1;', 'startup.js': ''})
        with self.assertRaises(SourceContractError):
            assemble_from_reader(self.reader(data), 'desktop')
        with self.assertRaises(SourceContractError):
            assemble_from_reader(self.reader(data), 'macos')

    def test_android_manifest_is_supported(self):
        data = self.sources({'prelude.js': MARKER, 'startup.js': 'go();'},
                            platform='android')
        entries, output = assemble_from_reader(self.reader(data), 'android')
        self.assertEqual(entries, ['prelude.js', 'startup.js'])
        self.assertEqual(output, '/* color rules */go();')

    def test_shared_slice_preserves_bytes_and_resolves_only_the_shared_root(self):
        before = self.sources({'prelude.js': MARKER, 'helper.js': 'shared();',
                               'startup.js': 'go();'})
        after = dict(before)
        after['apps/desktop-shared/editor/sources.json'] = json.dumps(
            ['prelude.js', 'shared/helper.js', 'startup.js'])
        after['packages/editor-ui/editor-shared/helper.js'] = after.pop(
            'apps/desktop-shared/editor/helper.js')
        self.assertTrue(compare_sources(self.reader(before), self.reader(after),
                                        ('desktop',))[0]['identical'])
        for name in ['shared/../helper.js', 'shared/nested/helper.js', '/helper.js',
                     'shared/../../secret.js', 'shared\\helper.js']:
            after['apps/desktop-shared/editor/sources.json'] = json.dumps(
                ['prelude.js', name, 'startup.js'])
            with self.assertRaises(SourceContractError):
                assemble_from_reader(self.reader(after), 'desktop')

    def test_class_body_fragment_preserves_order_and_rejects_duplicate_marker(self):
        before = self.sources({'prelude.js': MARKER,
                              'app.js': 'class App {tabs(){}clipboard(){}render(){}}', 'startup.js': ''})
        after = dict(before)
        tab = '/* @neuromap-app-tabs */\n'
        clip = '/* @neuromap-app-selection-clipboard */\n'
        after['apps/desktop-shared/editor/app.js'] = 'class App {' + tab + clip + 'render(){}}'
        after['apps/desktop-shared/editor/app-tabs.js'] = 'tabs(){}'
        after['apps/desktop-shared/editor/app-selection-clipboard.js'] = 'clipboard(){}'
        self.assertTrue(compare_sources(self.reader(before), self.reader(after), ('desktop',))[0]['identical'])
        after['apps/desktop-shared/editor/app.js'] += tab
        with self.assertRaises(SourceContractError):
            assemble_from_reader(self.reader(after), 'desktop')


    def test_shared_closures_cover_extraction_and_detect_real_changes(self):
        before = {
            'packages/editor-ui/creative-settings.js': '(function(){function value(){}mount()})();',
            'packages/editor-ui/creative-tools.js': '(function(){function objectDialog(){}mount()})();',
            'packages/editor-ui/creative-drawing.js': '(function(){function chartDialog(){}toolbar()})();',
            'packages/editor-ui/navigation-experience.js': '(function(){function ui(){}install()})();',
            'packages/editor-ui/creative-formatting.js': '(function(){function clean(){}write()})();',
            'packages/editor-ui/caption-editor.js': '(function(){function syncButtons(){}sync()})();',
            'packages/editor-ui/linked-views.js': '(function(){function exportView(){}install()})();',
            'packages/editor-ui/creative-markers.js': '(function(){function marker(){}install()})();',
        }
        after = dict(before)
        after['packages/editor-ui/creative-settings.js'] = '(function(){/* @neuromap-settings-values */\nmount()})();'
        after['packages/editor-ui/creative-settings-values.js'] = 'function value(){}'
        after['packages/editor-ui/creative-tools.js'] = '(function(){/* @neuromap-creative-tools-object-dialog */\nmount()})();'
        after['packages/editor-ui/creative-tools-object-dialog.js'] = 'function objectDialog(){}'
        after['packages/editor-ui/creative-drawing.js'] = '(function(){/* @neuromap-creative-drawing-dialogs */\ntoolbar()})();'
        after['packages/editor-ui/creative-drawing-dialogs.js'] = 'function chartDialog(){}'
        after['packages/editor-ui/linked-views.js'] = '(function(){/* @neuromap-linked-view-export */\ninstall()})();'
        after['packages/editor-ui/linked-view-export.js'] = 'function exportView(){}'
        results = compare_ui_sources(self.reader(before), self.reader(after))
        self.assertTrue(all(r['identical'] for r in results))
        after['packages/editor-ui/linked-view-export.js'] = 'function exportView(){changed()}'
        linked = next(r for r in compare_ui_sources(self.reader(before), self.reader(after))
                      if r['platform'] == 'shared/linked-views')
        self.assertFalse(linked['identical'])
        after['packages/editor-ui/creative-settings.js'] += '/* @neuromap-settings-values */\n'
        with self.assertRaises(SourceContractError):
            assemble_ui_from_reader(self.reader(after), 'creative-settings')


if __name__ == '__main__':
    unittest.main()
