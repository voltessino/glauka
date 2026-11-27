from pathlib import Path
import tempfile
import json
import unittest
from unittest.mock import patch
from prepare import ROOT, prepare, editor_sources, editor_source_path, bundles, ui_source

class StagingTests(unittest.TestCase):
    def test_refactor_comparator_matches_production_composition(self):
        import sys
        sys.path.insert(0, str(ROOT/'scripts/maintenance'))
        from compare_editor_bundles import assemble_from_reader, assemble_ui_from_reader
        reader = lambda name: (ROOT/name).read_text(encoding='utf-8')
        for platform in ('desktop','android'):
            self.assertEqual(assemble_from_reader(reader, platform)[1], editor_sources(platform))
        for name in ('creative-settings','linked-views'):
            self.assertEqual(assemble_ui_from_reader(reader, name), ui_source(name))

    def test_lexical_fragments_expand_once_and_missing_marker_fails(self):
        shared_app={'app-hit-testing.js','app-image-drag.js','app-node-mutations.js'}
        for platform,folder in [('desktop','desktop-shared'),('android','android')]:
            app_fragments=(
                'app-tabs.js','app-camera-status.js','app-hit-testing.js',
                'app-selection-clipboard.js','app-image-drag.js','app-inline-edit.js',
                'app-node-mutations.js','app-import.js','app-persist.js',
                'app-summary-image.js','app-context-find.js','app-bind-ui.js',
            )
            source=editor_sources(platform)
            for name in app_fragments:
                fragment_path=(ROOT/'packages/editor-ui/editor-shared'/name
                               if name in shared_app
                               else ROOT/f'apps/{folder}/editor/{name}')
                fragment=fragment_path.read_text()
                self.assertEqual(source.count(fragment),1,name)
                self.assertNotIn(f'@neuromap-{name[:-3]}',source)
            if platform=='desktop':
                home=(ROOT/'apps/desktop-shared/editor/shell-home.js').read_text()
                self.assertEqual(source.count(home),1)
                self.assertNotIn('@neuromap-shell-home',source)
        source_read = __import__('prepare').read
        def broken(path):
            source=source_read(path)
            return source.replace('/* @neuromap-settings-values */','') if path.name=='creative-settings.js' else source
        with patch('prepare.read',side_effect=broken):
            with self.assertRaises(ValueError): ui_source('creative-settings')

    def test_ai_studio_mount_is_composed_in_place_before_css_injection(self):
        body=(ROOT/'packages/editor-ui/ai-studio-mount.js').read_text()
        panel=(ROOT/'packages/editor-ui/ai-studio-mount-panel.js').read_text()
        for marker, name in (
            ('ai-studio-mount-panel-form', 'ai-studio-mount-panel-form.js'),
            ('ai-studio-mount-panel-preview', 'ai-studio-mount-panel-preview.js'),
            ('ai-studio-mount-panel-tasks', 'ai-studio-mount-panel-tasks.js'),
        ):
            panel=panel.replace(f'/* @neuromap-{marker} */\n',
                                 (ROOT/'packages/editor-ui'/name).read_text())
        body=body.replace('/* @neuromap-ai-studio-mount-panel */\n', panel)
        body=body.replace('/* @neuromap-ai-studio-mount-connections */\n',
                          (ROOT/'packages/editor-ui/ai-studio-mount-connections.js').read_text())
        opened=(ROOT/'packages/editor-ui/ai-studio-open.js').read_text()
        methods=(ROOT/'packages/editor-ui/ai-studio-methods.js').read_text()
        for marker, name in (
            ('ai-studio-methods-shell', 'ai-studio-methods-shell.js'),
            ('ai-studio-methods-run', 'ai-studio-methods-run.js'),
            ('ai-studio-methods-audio', 'ai-studio-methods-audio.js'),
        ):
            methods_body=(ROOT/'packages/editor-ui'/name).read_text()
            if name=='ai-studio-methods-run.js':
                for run_marker, run_name in (
                    ('ai-studio-methods-run-sources', 'ai-studio-methods-run-sources.js'),
                    ('ai-studio-methods-run-preview', 'ai-studio-methods-run-preview.js'),
                ):
                    methods_body=methods_body.replace(
                        f'/* @neuromap-{run_marker} */\n',
                        (ROOT/'packages/editor-ui'/run_name).read_text())
            methods=methods.replace(f'/* @neuromap-{marker} */\n', methods_body)
        studio=(ROOT/'packages/editor-ui/ai-studio.js').read_text()
        self.assertEqual(studio.count('/* @neuromap-ai-studio-mount */\n'),1)
        self.assertEqual(studio.count('/* @neuromap-ai-studio-open */\n'),1)
        self.assertEqual(studio.count('/* @neuromap-ai-studio-methods */\n'),1)
        composed=bundles()['ai-workflows']
        self.assertNotIn('/* @neuromap-ai-studio-mount */',composed)
        self.assertNotIn('/* @neuromap-ai-studio-open */',composed)
        self.assertNotIn('/* @neuromap-ai-studio-methods */',composed)
        self.assertNotIn('/* @neuromap-ai-studio-styles */',composed)
        self.assertIn(opened.strip(),composed)
        self.assertIn(methods.strip()[:80],composed)
        self.assertIn('mount() {\n'+body.split('/* @neuromap-ai-studio-styles */')[0],composed)
        self.assertIn('this.timer = setInterval(',composed)

    def test_editor_source_paths_allow_only_local_or_explicit_shared_files(self):
        folder=ROOT/'apps/android/editor'
        self.assertEqual(editor_source_path(folder,'app.js'),folder/'app.js')
        self.assertEqual(editor_source_path(folder,'shared/navigation-flashcards.js'),
                         ROOT/'packages/editor-ui/editor-shared/navigation-flashcards.js')
        for name in ['../app.js','shared/../app.js','shared/nested/app.js',
                     '/app.js','shared\\app.js',None]:
            with self.assertRaises(ValueError):editor_source_path(folder,name)

    def setUp(self):
        # Unit-staging tests must not download a third-party package from the
        # internet. Vendor integrity/asset extraction have their own tests.
        def offline_pdfjs_bundle(dest):
            dest=Path(dest)
            dest.mkdir()
            (dest/'pdf.mjs').write_text('/* verified PDF.js display stub */',encoding='utf-8')
            (dest/'pdf.worker.mjs').write_text('/* verified PDF.js worker stub */',encoding='utf-8')
            (dest/'LICENSE.txt').write_text('Apache-2.0 fixture',encoding='utf-8')
            return dest
        patcher=patch('prepare.stage_pdfjs',side_effect=offline_pdfjs_bundle)
        patcher.start()
        self.addCleanup(patcher.stop)
        # Unit staging must also be independent of network availability for
        # OCR's pinned npm tarballs and Italian language model.
        def offline_ocr_bundle(dest):
            dest=Path(dest)
            dest.mkdir(parents=True)
            from ocr_vendor import ASSETS
            for name in ASSETS:
                (dest/name).write_bytes(('offline-ocr-fixture:'+name).encode())
            (dest/'manifest.json').write_text('{"language":"ita"}',encoding='utf-8')
            (dest/'MODEL-LICENSE.txt').write_text('offline fixture',encoding='utf-8')
            return dest
        ocr_patcher=patch('prepare.stage_ocr',side_effect=offline_ocr_bundle)
        ocr_patcher.start()
        self.addCleanup(ocr_patcher.stop)

    def test_desktop_ui_is_identical_on_windows_and_mac(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            windows = prepare('windows',root/'windows')
            mac = prepare('macos',root/'mac')
            self.assertEqual((windows/'desktop/resources/index.html').read_bytes(),(mac/'desktop/resources/index.html').read_bytes())
            self.assertIn('NeuroMapCore = api',(mac/'desktop/resources/index.html').read_text(encoding='utf-8'))
            self.assertIn('root.NeuroMapLocale=api',(mac/'desktop/resources/index.html').read_text(encoding='utf-8'))
            self.assertIn((ROOT/'packages/editor-ui/ai-workflows.js').read_text(encoding='utf-8'),(mac/'desktop/resources/index.html').read_text(encoding='utf-8'))
            composed=bundles()
            self.assertIn(composed['graphics'],(mac/'desktop/resources/index.html').read_text(encoding='utf-8'))
            self.assertIn(composed['drag-preview'],(mac/'desktop/resources/index.html').read_text(encoding='utf-8'))
            self.assertNotIn('data-neuromap-build="workspace"',(mac/'desktop/resources/index.html').read_text(encoding='utf-8'))
            self.assertIn(json.loads((ROOT/'versions.json').read_text())['windows']['version'],(windows/'desktop/setup/install_ui.ps1').read_text(encoding='utf-8-sig'))
            self.assertTrue((windows/'desktop/dialog_windows.go').exists())
            self.assertTrue((mac/'desktop/dialog_darwin.go').exists())
            with self.assertRaises(FileExistsError):prepare('macos',mac)
    def test_desktop_product_locale_modules_keep_runtime_order(self):
        order=json.loads((ROOT/'apps/desktop-shared/editor/sources.json').read_text(encoding='utf-8'))
        idx=order.index('shell-dictionary.js')
        self.assertEqual(order[idx:idx+3],
                         ['shell-dictionary.js','shell-product-locale.js','shell.js'])
        source=editor_sources('desktop')
        self.assertLess(source.index('const NM_DICT={'),source.index('const NM_I18N={'))
        self.assertLess(source.index('const NM_I18N={'),source.index('function nm6InjectShell()'))

    def test_shell_dictionary_and_product_locale_keep_platform_order(self):
        # Desktop and Android have separate local implementations; both compose
        # the same ordered lexical declarations before their Home functions.
        for platform,folder in (('desktop','desktop-shared'),('android','android')):
            order=json.loads((ROOT/f'apps/{folder}/editor/sources.json').read_text(encoding='utf-8'))
            marker=order.index('shell-dictionary.js')
            self.assertEqual(order[marker:marker+3],
                             ['shell-dictionary.js','shell-product-locale.js','shell.js'])
            source=editor_sources(platform)
            self.assertLess(source.index('const NM_PRODUCT_VERSION='),source.index('const NM_I18N={'))
            self.assertLess(source.index('const NM_DICT={'),source.index('const NM_I18N={'))
            self.assertLess(source.index('const NM_I18N={'),source.index('function nm6InjectShell()'))

    def test_layout_controller_slices_keep_staging_order(self):
        order=json.loads((ROOT/'apps/desktop-shared/editor/sources.json').read_text(encoding='utf-8'))
        expected=['layout-text-controls.js','layout-navigation.js','layout-tab-order.js',
                  'layout-ui-controls.js','layout-audit-import.js',
                  'layout-geometry.js','layout-menu-import.js','context-menu-refresh.js']
        index=order.index('layout-text-controls.js')
        self.assertEqual(order[index:index+len(expected)],expected)
        source=editor_sources('desktop')
        self.assertLess(source.index('const NM70_GAP_STORAGE'),source.index('const NM611 = {'))
        self.assertLess(source.index('const NM611 = {'),source.index('const NM612_NAV_STORAGE'))
        self.assertLess(source.index('const NM612_NAV_STORAGE'),source.index('const NM613 = {'))
        self.assertNotIn('const NM611 = {',editor_sources('android'))

    def test_native_version_history_after_atomic_save_module(self):
        order=json.loads((ROOT/'apps/desktop-shared/editor/sources.json').read_text(encoding='utf-8'))
        start=order.index('saving.js')
        self.assertEqual(order[start:start+2],['saving.js','version-history.js'])
        source=editor_sources('desktop')
        self.assertLess(source.index('const NM614 = {'),source.index('async function nm614OpenHistoryPanel(app)'))
        self.assertNotIn('version-history.js',
                         json.loads((ROOT/'apps/android/editor/sources.json').read_text(encoding='utf-8')))

    def test_desktop_view_metadata_precedes_controller(self):
        metadata=(ROOT/'apps/desktop-shared/editor/workspace-view-metadata.js').read_text(encoding='utf-8')
        desktop=editor_sources('desktop')
        android=editor_sources('android')
        self.assertIn('function nmCleanViewWorkspace(raw)',metadata)
        self.assertIn('function nmArchiveViewWorkspaces(raw,tabs=[])',metadata)
        self.assertLess(desktop.index('function nmCleanViewWorkspace(raw)'),
                        desktop.index('class NeuroMapApp'))
        self.assertLess(desktop.index('function nmArchiveViewWorkspaces(raw,tabs=[])'),
                        desktop.index('class NeuroMapApp'))
        self.assertNotIn('function nmArchiveViewWorkspaces(raw,tabs=[])',android)

    def test_source_lens_2_staged_only_for_desktop(self):
        desktop=editor_sources('desktop')
        android=editor_sources('android')
        self.assertIn('root.NeuroMapPdfText=api',desktop)
        self.assertIn('root.NeuroMapSourceUI=Object.freeze({draw(args)',desktop)
        self.assertLess(desktop.index('root.NeuroMapPdfText=api'),
                        desktop.index('root.NeuroMapSourceUI=Object.freeze({draw(args)'))
        self.assertNotIn('root.NeuroMapPdfText=api',android)

    def test_preview_first_document_import_stages_desktop_only(self):
        source=editor_sources('desktop')
        android=editor_sources('android')
        self.assertIn('root.NeuroMapDocumentImport=api',source)
        self.assertIn("app._nmDocumentImport={open:",source)
        self.assertLess(source.index('root.NeuroMapPdfText=api'),
                        source.index('root.NeuroMapDocumentImport=api'))
        self.assertLess(source.index('root.NeuroMapDocumentImport=api'),
                        source.index("app._nmDocumentImport={open:"))
        self.assertNotIn('root.NeuroMapDocumentImport=api',android)

    def test_quick_capture_desktop_only(self):
        source=editor_sources('desktop')
        self.assertIn('root.NeuroMapCaptureCore=api',source)
        self.assertIn('app._nmCapture={open,close}',source)
        self.assertLess(source.index('root.NeuroMapCaptureCore=api'),source.index('app._nmCapture={open,close}'))
        self.assertNotIn('root.NeuroMapCaptureCore=api',editor_sources('android'))

    def test_visual_learning_and_anki_desktop_only(self):
        desktop=editor_sources('desktop')
        android=editor_sources('android')
        for name in ['NeuroMapVisualStudyCore','NeuroMapAnkiTSV']:
            self.assertIn('root.'+name+'=api',desktop)
            self.assertNotIn('root.'+name+'=api',android)
        self.assertIn('studyHotspots:',desktop)
        self.assertIn('label:semanticKind',desktop)
        self.assertLess(desktop.index('root.NeuroMapVisualStudyCore=api'),
                        desktop.index('app._nmVisualStudy={open:'))
        self.assertLess(desktop.index('root.NeuroMapAnkiTSV=api'),
                        desktop.index('app._nmAnki={open:'))

    def test_v73_offline_export_modules_staged_only_on_desktop(self):
        desktop=editor_sources('desktop')
        mobile=editor_sources('android')
        for name in ['NeuroMapShareHTML','NeuroMapTaskCalendar']:
            self.assertIn('root.'+name+'=api',desktop)
            self.assertNotIn('root.'+name+'=api',mobile)
        self.assertIn('app._nmShare73={open,close:end}',desktop)
        self.assertLess(desktop.index('root.NeuroMapShareHTML=api'),
                        desktop.index('app._nmShare73={open,close:end}'))
        self.assertLess(desktop.index('root.NeuroMapTaskCalendar=api'),
                        desktop.index('app._nmShare73={open,close:end}'))
        go=(ROOT/'apps/desktop-shared/src/main.go').read_text()
        bridge=(ROOT/'apps/desktop-shared/src/bridge.js').read_text()
        for suffix,mime in [('html','text/html'),('ics','text/calendar')]:
            self.assertIn('".'+suffix+'": true',go)
        # The native export route now receives bytes directly. Actual format
        # payloads are exercised by desktop-export-native.test.js.
        self.assertIn("api('file/export'",bridge)
        self.assertIn("base64:encodeExportBytes(bytes)",bridge)
        self.assertIn('if !allowed[strings.ToLower(filepath.Ext(dest))]',go)
        self.assertNotIn('</script', (ROOT/'apps/desktop-shared/editor/share-html-core.js').read_text().lower())

    def test_v74_quality_center_staged_desktop_only(self):
        desktop=editor_sources('desktop')
        android=editor_sources('android')
        self.assertIn('root.NeuroMapQualityCore=api',desktop)
        self.assertIn('app._nmQuality74={open:',desktop)
        self.assertLess(desktop.index('root.NeuroMapQualityCore=api'),
                        desktop.index('app._nmQuality74={open:'))
        self.assertNotIn('root.NeuroMapQualityCore=api',android)

    def test_portable_exchange_available_only_desktop(self):
        desktop=editor_sources('desktop')
        android=editor_sources('android')
        self.assertIn('root.NeuroMapPortableExchange=api',desktop)
        self.assertIn('app._nmExchange={open:',desktop)
        self.assertLess(desktop.index('root.NeuroMapPortableExchange=api'),
                        desktop.index('app._nmExchange={open:'))
        self.assertNotIn('root.NeuroMapPortableExchange=api',android)

    def test_v75_knowledge_links_staged_on_desktop_and_android(self):
        desktop=editor_sources('desktop')
        self.assertIn('root.NeuroMapWikiLinks=api',desktop)
        self.assertIn('root.NeuroMapWikiUI=Object.freeze',desktop)
        self.assertLess(desktop.index('root.NeuroMapWikiLinks=api'),
                        desktop.index('root.NeuroMapWikiUI=Object.freeze'))
        self.assertNotIn('</script', (ROOT/'apps/desktop-shared/editor/wiki-links-core.js').read_text().lower())
        self.assertNotIn('</script', (ROOT/'apps/desktop-shared/editor/wiki-links-ui.js').read_text().lower())
        with tempfile.TemporaryDirectory() as temporary:
            folder=prepare('android',Path(temporary)/'android')
            assets=folder/'app/src/main/assets/assets'
            bundle=(assets/'android-74-core.js').read_text(encoding='utf-8')
            studio=(assets/'studio-tools.js').read_text(encoding='utf-8')
            self.assertIn('root.NeuroMapWikiLinks=api',bundle)
            self.assertIn('NeuroMapStudioToolsEnsure',bundle)
            self.assertNotIn('root.NeuroMapWikiUI=Object.freeze',bundle)
            self.assertIn('root.NeuroMapWikiUI=Object.freeze',studio)
            html=(folder/'app/src/main/assets/app/index.html').read_text(encoding='utf-8')
            self.assertLess(html.index('/assets/android-74-core.js'),
                            html.index('/assets/architect.js'))
            mobile=(assets/'mobile-74.js').read_text(encoding='utf-8')
            self.assertRegex(mobile,r"""\[\s*['"]wiki['"]\s*,\s*['"]↔['"]""")
            self.assertIn('NeuroMapStudioToolsEnsure',mobile)
            self.assertIn('editorSession?.hasUnsaved?.()',mobile)

    def test_v76_knowledge_db_bundle_and_cross_platform_metadata(self):
        desktop=editor_sources('desktop')
        self.assertIn('root.NeuroMapKnowledgeDB=api',desktop)
        self.assertIn('root.NeuroMapKnowledgeDBUI=Object.freeze',desktop)
        self.assertLess(desktop.index('root.NeuroMapKnowledgeDB=api'),
                        desktop.index('root.NeuroMapKnowledgeDBUI=Object.freeze'))
        for platform,composed in (('apps/desktop-shared',desktop),
                                  ('apps/android',editor_sources('android'))):
            state=(ROOT/platform/'editor/state.js').read_text(encoding='utf-8')
            self.assertIn('NeuroMapKnowledgeDB.normalize('+('source' if platform.endswith('android') else 'node')+'.knowledge)',state)
            self.assertIn('NeuroMapKnowledgeDB.normalize(topic.knowledge)',composed)
        with tempfile.TemporaryDirectory() as temp:
            folder=prepare('android',Path(temp)/'android')
            asset=(folder/'app/src/main/assets/assets/android-74-core.js').read_text(encoding='utf-8')
            studio=(folder/'app/src/main/assets/assets/studio-tools.js').read_text(encoding='utf-8')
            self.assertIn('root.NeuroMapKnowledgeDB=api',asset)
            self.assertIn('NeuroMapStudioToolsEnsure',asset)
            self.assertNotIn('root.NeuroMapKnowledgeDBUI=Object.freeze',asset)
            self.assertIn('root.NeuroMapKnowledgeDBUI=Object.freeze',studio)
            mobile=(folder/'app/src/main/assets/assets/mobile-74.js').read_text(encoding='utf-8')
            self.assertRegex(mobile,r"""\[\s*['"]database['"]\s*,\s*['"]▦['"]""")
            self.assertIn('NeuroMapStudioToolsEnsure',mobile)
            self.assertIn('editorSession?.hasUnsaved?.()',mobile)

    def test_android_bundles_only_free_web_core(self):
        with tempfile.TemporaryDirectory() as temporary:
            dest=prepare('android',Path(temporary)/'android')
            assets=dest/'app/src/main/assets/assets'
            # Compare decoded text so Windows CRLF checkouts match LF staging output.
            self.assertEqual((assets/'map-core.js').read_text(encoding='utf-8'),
                             (ROOT/'packages/map-core/index.js').read_text(encoding='utf-8'))
            self.assertTrue((assets/'localization.js').read_text(encoding='utf-8').startswith(
                bundles()['localization']))
            self.assertIn('globalThis.GlaukaMobile=true',(assets/'localization.js').read_text())
            self.assertIn('GlaukaAndroidLanguages',(assets/'localization.js').read_text())
            self.assertTrue((dest/'app/src/main/assets/app/locales/zh-CN.json').is_file())
            self.assertEqual((assets/'drag-preview.js').read_text(encoding='utf-8'),
                             bundles()['drag-preview'])
            self.assertNotIn('data-neuromap-build="workspace"',(dest/'app/src/main/assets/app/index.html').read_text(encoding='utf-8'))
            self.assertEqual((assets/'graphics.js').read_text(),bundles()['graphics']+'\n'+(ROOT/'apps/desktop-shared/editor/fast-canvas.js').read_text())
            self.assertIn('NeuroMapGentleMotion',(assets/'graphics.js').read_text())
            self.assertNotIn('/* @neuromap-motion-styles */',(assets/'graphics.js').read_text())
            self.assertEqual((assets/'ai-workflows.js').read_text(),bundles()['ai-workflows'])
            combined='\n'.join(p.read_text(encoding='utf-8') for p in assets.glob('*.js'))
            self.assertNotIn('mac-private-test-pro',combined)
            self.assertNotIn('developerEdition()',combined)
    def test_android_v74_portable_cores_are_local_and_ordered_before_editor_restore(self):
        with tempfile.TemporaryDirectory() as temporary:
            dest=prepare('android',Path(temporary)/'android')
            assets=dest/'app/src/main/assets/assets'
            core=(assets/'android-74-core.js').read_text(encoding='utf-8')
            markup=(dest/'app/src/main/assets/app/index.html').read_text(encoding='utf-8')
            for token in ['root.NeuroMapSourceCore=api','root.NeuroMapPdfText=api',
                          'root.NeuroMapDocumentImport=api','root.NeuroMapCaptureCore=api',
                          'root.NeuroMapVisualStudyCore=api','root.NeuroMapAnkiTSV=api',
                          'root.NeuroMapKnowledgeCore=api','root.NeuroMapQualityCore=api',
                          'root.NeuroMapShareHTML=api','root.NeuroMapTaskCalendar=api',
                          'root.NeuroMapPortableExchange=api',
                          'root.NeuroMapViewCore=api','root.NeuroMapFlowCore=api',
                          'root.NeuroMapConceptNetwork=api','NeuroMapLinkedViewsInstall']:
                self.assertIn(token,core)
            self.assertIn('GlaukaMobile',core)
            self.assertLess(core.index('root.NeuroMapViewCore=api'),
                            core.index('NeuroMapLinkedViewsInstall'))
            self.assertIn('NeuroMapOCREnsure',core)
            self.assertIn('NeuroMapStudioToolsEnsure',core)
            self.assertNotIn('root.NeuroMapOCR=Object.freeze',core)
            self.assertNotIn('root.NeuroMapWikiUI=Object.freeze',core)
            self.assertNotIn('root.NeuroMapDashboardUI82=Object.freeze',core)
            ocr=(assets/'ocr-tools.js').read_text(encoding='utf-8')
            self.assertIn('root.NeuroMapOCR=Object.freeze',ocr)
            self.assertIn('NeuroMapOCRUI',ocr)
            studio=(assets/'studio-tools.js').read_text(encoding='utf-8')
            self.assertIn('root.NeuroMapWikiUI=Object.freeze',studio)
            self.assertIn('root.NeuroMapKnowledgeDBUI=Object.freeze',studio)
            self.assertIn('root.NeuroMapDashboardUI82=Object.freeze',studio)
            self.assertLess(markup.index('/assets/android-74-core.js'),
                            markup.index('/assets/architect.js'))
            self.assertLess(markup.index('/assets/architect.js'),
                            markup.index('/assets/mobile-74.js'))
            self.assertIn('/assets/mobile-74.css',markup)
            self.assertEqual(core.count('root.NeuroMapSourceCore=api'),1)
            self.assertNotIn('mac-private-test-pro',core)
            self.assertNotIn('developerEdition()',core)
            self.assertIn('viewport-fit=cover',markup)

    def test_android_new_data_model_preserves_desktop_citations(self):
        state=(ROOT/'apps/android/editor/state.js').read_text(encoding='utf-8')
        app=editor_sources('android')
        self.assertIn('NeuroMapSourceCore.normalizeAll(source.sourceRefs)',state)
        self.assertIn('setNodeTaskDependencies(nodeId,dependsOn',state)
        self.assertIn('NeuroMapSourceCore.normalizeAll(topic.sourceRefs)',app)
        self.assertIn('studyHotspots:(img.studyHotspots||[])',app)
        self.assertIn('const ids=new Map(),pairs=',app)
        java=(ROOT/'apps/android/native/app/src/main/java/it/neuromap/architect/preview/MainActivity.java').read_text()
        self.assertIn('NeuroMapLifecycle.handleBack()',java)
        self.assertIn('root.NeuroMapAndroid74?.close()', (ROOT/'packages/editor-ui/lifecycle.js').read_text())

    def test_native_android_allows_every_bundled_script_and_stylesheet(self):
        import re
        with tempfile.TemporaryDirectory() as temporary:
            dest=prepare('android',Path(temporary)/'android')
            html=(dest/'app/src/main/assets/app/index.html').read_text()
            java=(dest/'app/src/main/java/it/neuromap/architect/preview/MainActivity.java').read_text()
            policy=(dest/'app/src/main/java/it/neuromap/architect/preview/AndroidAssetPolicy.java').read_text()
            self.assertIn('AndroidAssetPolicy.mimeFor(path)',java)
            for script in re.findall(r'<script[^>]+src="/([^"]+)"',html) + re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="/([^"]+)"',html):
                self.assertIn('"'+script+'"',policy,script+' would be blocked by the native host')
                self.assertTrue((dest/'app/src/main/assets'/script).is_file())
    def test_creative_bundle_is_shared_complete_and_styles_are_embedded(self):
        from prepare import bundles, replace_once
        assets=bundles()
        creative=assets['creative-tools']
        for name in ['formulas','boundaries','drawing','inspector']:
            self.assertIn('root.NeuroMapCreativeModules.'+name,creative)
        self.assertIn('#nm-drawing-toolbar',creative)
        self.assertNotIn('/* @neuromap-creative-styles */',creative)
        self.assertIn('ensureMathJax',creative)
        with self.assertRaises(ValueError):replace_once('missing','marker','value')
        with self.assertRaises(ValueError):replace_once('xx','x','value')

    def test_mathjax_is_staged_separately_and_not_inlined_at_startup(self):
        with tempfile.TemporaryDirectory() as temporary:
            desktop=prepare('windows',Path(temporary)/'windows')
            android=prepare('android',Path(temporary)/'android')
            page=(desktop/'desktop/resources/index.html').read_text(encoding='utf-8')
            mathjax=(desktop/'desktop/resources/mathjax/mathjax.js').read_text(encoding='utf-8')
            self.assertTrue(mathjax.startswith('globalThis.MathJax={startup:{typeset:false}'))
            self.assertGreater(len(mathjax),1_000_000)
            # Vendor fingerprint — creative-formulas only mentions tex2svgPromise by name.
            self.assertIn('MathJax.loader',mathjax)
            self.assertNotIn('MathJax.loader',page)
            self.assertNotIn(mathjax[:80],page)
            markup=(android/'app/src/main/assets/app/index.html').read_text(encoding='utf-8')
            self.assertNotIn('/assets/mathjax.js',markup)
            staged=(android/'app/src/main/assets/assets/mathjax.js').read_text(encoding='utf-8')
            self.assertEqual(staged,mathjax)

    def test_checkout_cannot_be_destination(self):
        with self.assertRaises(ValueError):prepare('android',ROOT)

    def test_editor_sources_are_complete_and_palette_is_shared(self):
        colors=(ROOT/'packages/editor-ui/editor-colors.js').read_text(encoding='utf-8')
        for platform,folder in [('desktop','apps/desktop-shared/editor'),('android','apps/android/editor')]:
            directory=ROOT/folder
            files=json.loads((directory/'sources.json').read_text())
            self.assertEqual(len(files),len(set(files)))
            # Lexical class fragments are spliced into app.js / state.js, not listed as scripts.
            shared_app={'app-hit-testing.js','app-image-drag.js','app-node-mutations.js',
                        'state-relationships-summary.js','state-node-style.js'}
            fragments={
                'app-tabs.js','app-camera-status.js',
                'app-selection-clipboard.js','app-inline-edit.js',
                'app-import.js','app-persist.js',
                'app-summary-image.js','app-context-find.js','app-bind-ui.js',
                'desktop-controls-native.js','desktop-controls-selection.js',
                'desktop-controls-bind.js',
            }
            if platform=='desktop':
                fragments=fragments|{'shell-home.js','knowledge-ui-draw.js','learn-ui-session.js'}
            self.assertEqual({f for f in files if not f.startswith('shared/')}|fragments,
                             {p.name for p in directory.glob('*.js')})
            for name in fragments|shared_app:
                self.assertNotIn(name,files)
                fragment_path=(ROOT/'packages/editor-ui/editor-shared'/name
                               if name in shared_app else directory/name)
                self.assertEqual(editor_sources(platform).count(fragment_path.read_text()),1,name)
            for name in files:self.assertTrue(editor_source_path(directory,name).is_file())
            source=editor_sources(platform)
            self.assertEqual(source.count(colors),1)
            for cls in ['MindMapStateMachine','OrganicLayoutEngine','OrganicCanvasRenderer','MindMapIOManager','NeuroMapApp','UniversalAIClient']:
                self.assertEqual(source.count('class '+cls+' {'),1)

    def test_staging_resolves_source_markers(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            desktop=prepare('windows',root/'desktop')
            android=prepare('android',root/'android')
            html=(desktop/'desktop/resources/index.html').read_text(encoding='utf-8')
            self.assertNotIn('/* @neuromap-',html)
            script=(android/'app/src/main/assets/assets/architect.js').read_text(encoding='utf-8')
            self.assertEqual(script,editor_sources('android'))
            self.assertNotIn('/* @neuromap-',script)


class VersionTests(unittest.TestCase):
    def test_release_versions_agree(self):
        import json,plistlib
        v=json.loads((ROOT/'versions.json').read_text(encoding='utf-8'))
        desktop=v['windows']['version']
        self.assertRegex(desktop,r'^\d+\.\d+\.\d+')
        self.assertNotIn('7.4.0',json.dumps(v))
        # versions.json is the single source of truth across package, desktop and macOS.
        self.assertEqual(v['editor'],desktop)
        self.assertEqual(json.loads((ROOT/'package.json').read_text())['version'],v['editor'])
        self.assertRegex(v['android']['version'],r'^\d+\.\d+\.\d+$')
        major,minor,patch=map(int,desktop.split('-')[0].split('.'))
        build=int(desktop.rsplit('.',1)[-1]) if '-' in desktop else 0
        expected_fixed={'Major':major,'Minor':minor,'Patch':patch,'Build':build}
        bundle=plistlib.loads((ROOT/'apps/macos/native/Info.plist').read_bytes())
        self.assertEqual(bundle['CFBundleVersion'],__import__('macos_version').macos_bundle_build(desktop))
        self.assertIn('window.title = version.isEmpty ? editionTitle : editionTitle + " — " + version',(ROOT/'apps/macos/native/main.swift').read_text())
        self.assertEqual(v['macos']['version'],desktop)
        self.assertIn("NM_PRODUCT_VERSION='"+desktop+"'",editor_sources('desktop'))
        self.assertIn("NM_PRODUCT_VERSION='"+v['android']['version']+"'",editor_sources('android'))
        self.assertNotIn('7.4.0',editor_sources('desktop').split('const NM_I18N',1)[0])
        self.assertEqual(plistlib.loads((ROOT/'apps/macos/native/Info.plist').read_bytes())['CFBundleShortVersionString'],desktop.split('-')[0])
        for path in ['apps/desktop-shared/src/versioninfo.json','apps/windows/installer/versioninfo.json']:
            metadata=json.loads((ROOT/path).read_text(encoding='utf-8'))
            for field in ['FileVersion','ProductVersion']:
                self.assertEqual(metadata['StringFileInfo'][field],desktop)
                self.assertEqual(metadata['FixedFileInfo'][field],expected_fixed)
        android=(ROOT/'apps/android/native/app/build.gradle').read_text(encoding='utf-8')
        self.assertIn('versionCode(androidVersion.version_code as int)',android)
        self.assertIn('versionName(androidVersion.version as String)',android)

    def test_linked_view_bundle_remains_desktop_only_and_identical(self):
        assets=bundles()
        linked=assets['desktop-workflows']
        self.assertIn('NeuroMapViewCore',linked)
        self.assertIn('NeuroMapFlowCore',linked)
        self.assertIn('NeuroMapWorkCore',linked)
        self.assertIn('NeuroMapConceptNetwork',linked)
        self.assertIn('NeuroMapGuidedFlow',linked)
        self.assertIn('NeuroMapLinkedViewsInstall',linked)
        self.assertIn('NeuroMapNavigationCore',linked)
        self.assertIn('NeuroMapNavigationInstall',linked)
        self.assertIn('NeuroMapPresentationInstall',linked)
        self.assertIn('NeuroMapComparisonCore',linked)
        self.assertIn('NeuroMapComparisonInstall',linked)
        self.assertIn('NeuroMapOrbitCore',linked)
        self.assertIn('NeuroMapOrbitInstall',linked)
        self.assertIn('#nm-orbit-command-overlay',linked)
        self.assertNotIn('/* @neuromap-orbit-desktop-styles */',linked)
        self.assertIn('root.NeuroMapViewPicker',linked)
        self.assertIn('linked-views', (ROOT/'scripts/release/prepare.py').read_text())
        with tempfile.TemporaryDirectory() as temporary:
            base=Path(temporary)
            win=prepare('windows',base/'win')/'desktop/resources/index.html'
            mac=prepare('macos',base/'mac')/'desktop/resources/index.html'
            self.assertEqual(win.read_bytes(),mac.read_bytes())
            for target in (win,mac):
                html=target.read_text(encoding='utf-8')
                self.assertIn('NeuroMapLinkedViewsInstall(NeuroMapApp,MindMapStateMachine)',html)
                self.assertIn('root.NeuroMapViewCore=api',html)
                self.assertIn('root.NeuroMapFlowCore=api',html)
                self.assertIn('root.NeuroMapWorkCore=api',html)
                self.assertIn('addFlowTransition',html)
                self.assertIn("picker.id='nm-view-picker'",html)

if __name__=='__main__':unittest.main()
