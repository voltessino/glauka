#!/usr/bin/env python3
"""Compose offline editor bundles and stage native sources outside the checkout."""
from pathlib import Path
import argparse
import base64
import json
import plistlib
import re
from macos_version import macos_bundle_build
import shutil
import subprocess
from pdfjs_vendor import stage as stage_pdfjs
from ocr_vendor import stage as stage_ocr
import interface_locales

ROOT = Path(__file__).resolve().parents[2]
UI = ROOT / 'packages/editor-ui'
SHARED = ('theme-picker', 'localization', 'ai-workflows', 'graphics',
          'drag-preview', 'lifecycle', 'continuation-layout', 'creative-core')
CREATIVE = ('ui', 'formulas', 'boundaries', 'drawing', 'inspector', 'formatting', 'settings', 'markers', 'help', 'tools')
MATH_CONFIG = "globalThis.MathJax={startup:{typeset:false},options:{enableMenu:false},tex:{packages:['base','ams','newcommand','noundefined','color','boldsymbol','mathtools'],maxBuffer:10000,maxMacros:1000},svg:{fontCache:'none'}};\n"


def read(path):
    return path.read_text(encoding='utf-8')


def replace_once(text, marker, value):
    if text.count(marker) != 1:
        raise ValueError(f'Expected exactly one bundle marker: {marker}')
    return text.replace(marker, value)


def editor_source_path(folder, name):
    """Resolve explicit shared slices without allowing arbitrary paths."""
    if not isinstance(name, str) or not re.fullmatch(r'(?:shared/)?[a-z0-9][a-z0-9-]*\.js', name):
        raise ValueError(f'Unsafe editor source: {name!r}')
    return UI / 'editor-shared' / name[7:] if name.startswith('shared/') else folder / name


def editor_sources(platform):
    """Concatenate in the declared order, retaining one shared lexical scope."""
    folder = ROOT / ('apps/android/editor' if platform == 'android'
                     else 'apps/desktop-shared/editor')
    files = json.loads(read(folder / 'sources.json'))
    source = ''.join(read(editor_source_path(folder, name)) for name in files)
    shared_app_fragments = {
        'app-hit-testing.js',
        'app-image-drag.js',
        'app-node-mutations.js',
    }
    for marker, file in (
        ('app-tabs', 'app-tabs.js'),
        ('app-camera-status', 'app-camera-status.js'),
        ('app-hit-testing', 'app-hit-testing.js'),
        ('app-selection-clipboard', 'app-selection-clipboard.js'),
        ('app-image-drag', 'app-image-drag.js'),
        ('app-inline-edit', 'app-inline-edit.js'),
        ('app-node-mutations', 'app-node-mutations.js'),
        ('app-import', 'app-import.js'),
        ('app-persist', 'app-persist.js'),
        ('app-summary-image', 'app-summary-image.js'),
        ('app-context-find', 'app-context-find.js'),
        ('app-bind-ui', 'app-bind-ui.js'),
        ('desktop-controls-native', 'desktop-controls-native.js'),
        ('desktop-controls-selection', 'desktop-controls-selection.js'),
        ('desktop-controls-bind', 'desktop-controls-bind.js'),
    ):
        if f'/* @neuromap-{marker} */\n' in source:
            fragment_path = (UI / 'editor-shared' / file
                             if file in shared_app_fragments else folder / file)
            source = replace_once(source, f'/* @neuromap-{marker} */\n',
                                  read(fragment_path))
    home_marker = '/* @neuromap-shell-home */\n'
    if home_marker in source:
        source = replace_once(source, home_marker, read(folder / 'shell-home.js'))
    state_rel_marker = '/* @neuromap-state-relationships-summary */\n'
    if state_rel_marker in source:
        source = replace_once(
            source, state_rel_marker,
            read(UI / 'editor-shared' / 'state-relationships-summary.js'))
    state_style_marker = '/* @neuromap-state-node-style */\n'
    if state_style_marker in source:
        source = replace_once(
            source, state_style_marker,
            read(UI / 'editor-shared' / 'state-node-style.js'))
    knowledge_marker = '/* @neuromap-knowledge-ui-draw */\n'
    if knowledge_marker in source:
        source = replace_once(source, knowledge_marker, read(folder / 'knowledge-ui-draw.js'))
    learn_marker = '/* @neuromap-learn-ui-session */\n'
    if learn_marker in source:
        source = replace_once(source, learn_marker, read(folder / 'learn-ui-session.js'))
    source = replace_once(source, '/* @neuromap-editor-colors */',
                          read(UI / 'editor-colors.js'))
    share_marker = '/* @neuromap-map-share-core */\n'
    if share_marker in source:
        source = replace_once(
            source, share_marker,
            read(ROOT / 'packages/map-sharing/core.js') + '\n' +
            read(ROOT / 'packages/map-sharing/transfer.js') + '\n')
    return source


def ui_source(name):
    """Expand reviewed lexical fragments before CSS/font substitutions."""
    source = read(UI / f'{name}.js')
    fragments = {
        'creative-settings': [
            ('settings-values', 'creative-settings-values.js'),
            ('creative-settings-mount-body', 'creative-settings-mount-body.js'),
            ('creative-settings-organize', 'creative-settings-organize.js'),
        ],
        'creative-tools': [
            ('creative-tools-object-dialog', 'creative-tools-object-dialog.js'),
            ('creative-tools-library-dialog', 'creative-tools-library-dialog.js'),
            ('creative-tools-mount', 'creative-tools-mount.js'),
            ('creative-tools-sync', 'creative-tools-sync.js'),
        ],
        'creative-formatting': [
            ('creative-formatting-values', 'creative-formatting-values.js'),
        ],
        'caption-editor': [
            ('caption-editor-buttons', 'caption-editor-buttons.js'),
            ('caption-editor-layout', 'caption-editor-layout.js'),
        ],
        'creative-drawing': [
            ('creative-drawing-dialogs', 'creative-drawing-dialogs.js'),
            ('creative-drawing-toolbar', 'creative-drawing-toolbar.js'),
            ('creative-drawing-library', 'creative-drawing-library.js'),
        ],
        'navigation-experience': [
            ('navigation-experience-styles', 'navigation-experience-styles.js'),
            ('navigation-experience-ui', 'navigation-experience-ui.js'),
            ('navigation-experience-focus', 'navigation-experience-focus.js'),
            ('navigation-experience-render', 'navigation-experience-render.js'),
        ],
        'linked-views': [
            ('linked-view-decorations', 'linked-view-decorations.js'),
            ('linked-view-styles', 'linked-view-styles.js'),
            ('linked-view-project', 'linked-view-project.js'),
            ('linked-view-camera-workspace', 'linked-view-camera-workspace.js'),
            ('linked-view-ensure', 'linked-view-ensure.js'),
            ('linked-view-toolbars', 'linked-view-toolbars.js'),
            ('linked-view-export', 'linked-view-export.js'),
            ('linked-view-runtime', 'linked-view-runtime.js'),
        ],
        'creative-markers': [
            ('creative-markers-catalog', 'creative-markers-catalog.js'),
            ('creative-markers-actions', 'creative-markers-actions.js'),
            ('creative-markers-mount', 'creative-markers-mount.js'),
        ],
    }
    nested = {
        'creative-tools-mount.js': [
            ('creative-tools-mount-bind',
             'creative-tools-mount-bind.js'),
            ('creative-tools-mount-panel',
             'creative-tools-mount-panel.js'),
        ],
        'creative-settings-mount-body.js': [
            ('creative-settings-mount-builders',
             'creative-settings-mount-builders.js'),
            ('creative-settings-mount-handlers',
             'creative-settings-mount-handlers.js'),
        ],
        'linked-view-camera-workspace.js': [
            ('linked-view-camera-kanban', 'linked-view-camera-kanban.js'),
            ('linked-view-camera-workspace-panels',
             'linked-view-camera-workspace-panels.js'),
        ],
        'linked-view-ensure.js': [
            ('linked-view-ensure-chrome', 'linked-view-ensure-chrome.js'),
            ('linked-view-ensure-zoom', 'linked-view-ensure-zoom.js'),
            ('linked-view-ensure-toolbars', 'linked-view-ensure-toolbars.js'),
            ('linked-view-ensure-dual', 'linked-view-ensure-dual.js'),
        ],
        'linked-view-toolbars.js': [
            ('linked-view-toolbars-network', 'linked-view-toolbars-network.js'),
            ('linked-view-toolbars-flow', 'linked-view-toolbars-flow.js'),
        ],
        'linked-view-export.js': [
            ('linked-view-export-pdf', 'linked-view-export-pdf.js'),
            ('linked-view-export-raster', 'linked-view-export-raster.js'),
            ('linked-view-export-view', 'linked-view-export-view.js'),
        ],
        'linked-view-runtime.js': [
            ('linked-view-runtime-sync', 'linked-view-runtime-sync.js'),
            ('linked-view-runtime-dual', 'linked-view-runtime-dual.js'),
            ('linked-view-runtime-render', 'linked-view-runtime-render.js'),
        ],
    }
    for marker, file in fragments.get(name, []):
        body = read(UI / file)
        for nested_marker, nested_file in nested.get(file, []):
            body = replace_once(body, f'/* @neuromap-{nested_marker} */\n',
                                read(UI / nested_file))
        source = replace_once(source, f'/* @neuromap-{marker} */\n', body)
    return source


def bundles():
    """One dependency order for both platforms; no remote scripts or new native URLs."""
    result = {name: read(UI / f'{name}.js') for name in SHARED}
    drag_preview = result['drag-preview']
    for drag_marker, drag_file in (
        ('drag-preview-resolve', 'drag-preview-resolve.js'),
        ('drag-preview-apply', 'drag-preview-apply.js'),
        ('drag-preview-preview', 'drag-preview-preview.js'),
    ):
        drag_preview = replace_once(
            drag_preview, f'/* @neuromap-{drag_marker} */\n',
            read(UI / drag_file))
    result['drag-preview'] = drag_preview
    graphics = result['graphics']
    for graphics_marker, graphics_file in (
        ('graphics-helpers', 'graphics-helpers.js'),
        ('graphics-install', 'graphics-install.js'),
    ):
        graphics = replace_once(
            graphics, f'/* @neuromap-{graphics_marker} */\n',
            read(UI / graphics_file))
    result['graphics'] = graphics
    localization_messages = replace_once(
        read(UI / 'localization-messages.js'),
        '/* @neuromap-localization-messages-main */\n',
        read(UI / 'localization-messages-main.js'))
    localization_messages = replace_once(
        localization_messages,
        '/* @neuromap-localization-messages-ranges */\n',
        read(UI / 'localization-messages-ranges.js'))
    result['localization'] = replace_once(
        result['localization'],
        '/* @neuromap-localization-messages */\n',
        localization_messages)
    result['continuation-layout'] = replace_once(
        result['continuation-layout'],
        '/* @neuromap-continuation-layout-mount */\n',
        read(UI / 'continuation-layout-mount.js'))
    brand_css = read(UI / 'glauka-brand.css')
    fonts = ''
    for weight in (400, 600):
        font = base64.b64encode((UI / f'vendor/fonts/dm-sans-{weight}.woff2').read_bytes()).decode('ascii')
        fonts += f'@font-face{{font-family:"Glauka Sans";src:url(data:font/woff2;base64,{font}) format("woff2");font-weight:{weight};font-display:block;}}\n'
    brand_css = replace_once(brand_css, '/* @glauka-fonts */', fonts + '\n/* '+read(UI / 'vendor/fonts/DM-Sans-OFL.txt').replace('*/', '* /')+' */\n')
    brand = replace_once(read(UI / 'glauka-brand.js'), '/* @glauka-mark */ ""', json.dumps(read(ROOT / 'packages/brand/glauka-mark.svg')))
    brand = replace_once(brand, '/* @glauka-brand-styles */ ""', json.dumps(brand_css))
    result['graphics'] = brand + '\n' + read(UI / 'node-text-core.js') + '\n' + result['graphics']
    # Compact offline art packs are shared by Windows, macOS and Android.
    # Insert before creative-core so the renderer can read the catalogue.
    art_parts = ('anatomy-a','anatomy-b','anatomy-c','medical-a','medical-b',
                 'objects-a','objects-b','food','movement','ideas-a','ideas-b','places','work','glauka','lucide-a','lucide-b','lucide-c','lucide-d','lucide-e','lucide-f','lucide-g','lucide-h','lucide-i','lucide-j','lucide-k','lucide-l','lucide-m','lucide-n','lucide-o','lucide-p','lucide-q','lucide-r','lucide-s','lucide-t','lucide-u')
    art = '\n'.join(read(UI / f'object-gallery-parts-{name}.js') for name in art_parts)
    art += '\n' + read(UI / 'object-gallery-healthicons.js')
    export_hub_core = read(UI / 'export-hub-core.js')
    for export_marker, export_file in (
        ('export-hub-core-writers', 'export-hub-core-writers.js'),
        ('export-hub-core-parsers', 'export-hub-core-parsers.js'),
        ('export-hub-core-render', 'export-hub-core-render.js'),
        ('export-hub-core-pdf', 'export-hub-core-pdf.js'),
    ):
        export_hub_core = replace_once(
            export_hub_core, f'/* @neuromap-{export_marker} */\n',
            read(UI / export_file))
    creative_core = replace_once(result['creative-core'],
        '/* @neuromap-creative-core-objects */\n',
        read(UI / 'creative-core-objects.js'))
    rich_caption = read(UI / 'rich-caption-core.js')
    for rich_marker, rich_file in (
        ('rich-caption-core-text', 'rich-caption-core-text.js'),
        ('rich-caption-core-render', 'rich-caption-core-render.js'),
        ('rich-caption-core-bind', 'rich-caption-core-bind.js'),
    ):
        rich_caption = replace_once(
            rich_caption, f'/* @neuromap-{rich_marker} */\n',
            read(UI / rich_file))
    result['creative-core'] = rich_caption + '\n' + art + '\n' + creative_core + '\n' + export_hub_core
    result['graphics'] += '\n' + replace_once(read(UI / 'gentle-motion.js'), '/* @neuromap-motion-styles */ ""',json.dumps(read(UI / 'gentle-motion.css')))
    result['graphics'] += '\n' + read(UI / 'canvas-premium.js')
    result['graphics'] += '\n' + read(UI / 'canvas-geometry.js')
    result['graphics'] += '\n' + read(UI / 'canvas-area-selection.js')
    result['graphics'] += '\n' + read(UI / 'camera-dynamics.js')
    result['graphics'] += '\n' + read(UI / 'camera-path-overlay.js')
    map_preview = read(UI / 'map-refinements-preview.js')
    for preview_marker, preview_file in (
        ('map-refinements-preview-life', 'map-refinements-preview-life.js'),
        ('map-refinements-preview-draw', 'map-refinements-preview-draw.js'),
    ):
        preview_body = read(UI / preview_file)
        if preview_file == 'map-refinements-preview-draw.js':
            for draw_marker, draw_file in (
                ('map-refinements-preview-draw-guides',
                 'map-refinements-preview-draw-guides.js'),
                ('map-refinements-preview-draw-hooks',
                 'map-refinements-preview-draw-hooks.js'),
            ):
                preview_body = replace_once(
                    preview_body, f'/* @neuromap-{draw_marker} */\n',
                    read(UI / draw_file))
        map_preview = replace_once(
            map_preview, f'/* @neuromap-{preview_marker} */\n',
            preview_body)
    map_refinements = replace_once(read(UI / 'map-refinements.js'),
        '/* @neuromap-map-refinements-helpers */\n',
        read(UI / 'map-refinements-helpers.js'))
    map_refinements = replace_once(map_refinements,
        '/* @neuromap-map-refinements-preview */\n', map_preview)
    result['graphics'] += '\n' + replace_once(map_refinements,
        '/* @neuromap-refinement-styles */ ""',
        json.dumps(read(UI / 'map-refinements.css')))
    result['lifecycle'] += '\n' + read(UI / 'workspace-recovery.js') + '\n' + read(UI / 'save-status.js')
    result['lifecycle'] += '\n' + read(UI / 'settings-center-core.js') + '\n' + read(UI / 'settings-center.js')
    result['lifecycle'] += '\n' + read(UI/'study-today.js') + '\n' + 'if(typeof document!=="undefined"){const s=document.createElement("style");s.textContent='+json.dumps(read(UI/'study-today.css'))+';document.head.append(s);}'
    result['ai-workflows'] = read(UI / 'ai-workflows.js')
    result['map-core'] = read(ROOT / 'packages/map-core/index.js')
    result['mathjax'] = MATH_CONFIG + read(UI / 'vendor/mathjax/tex-svg-full.js')
    creative = '\n'.join(ui_source(f'creative-{name}') for name in CREATIVE)
    creative = replace_once(creative, '/* @neuromap-formatting-styles */ ""',
                            json.dumps(read(UI / 'creative-formatting.css')))
    creative = replace_once(creative, '/* @neuromap-marker-styles */ ""',
                            json.dumps(read(UI / 'creative-markers.css')))
    marker_font = base64.b64encode((UI / 'vendor/markers/NeuroMapSymbols.ttf').read_bytes()).decode('ascii')
    marker_css = "@font-face{font-family:NeuroMapSymbols;src:url(data:font/ttf;base64,"+marker_font+") format('truetype');font-display:block;}"
    creative = replace_once(creative, '/* @neuromap-marker-font */ ""', json.dumps(marker_css))
    creative += '\n' + read(UI / 'ai-illustrations.js') + '\n' + read(UI / 'inline-smart-suggest.js')
    result['creative-tools'] = replace_once(creative, '/* @neuromap-creative-styles */ ""',
                                            json.dumps(read(UI / 'creative-tools.css')))
    export_panel = replace_once(read(UI / 'export-hub-ui-panel.js'),
        '/* @neuromap-export-hub-ui-panel-preview */\n',
        read(UI / 'export-hub-ui-panel-preview.js'))
    export_panel = replace_once(export_panel,
        '/* @neuromap-export-hub-ui-panel-chrome */\n',
        read(UI / 'export-hub-ui-panel-chrome.js'))
    export_hub_ui = replace_once(read(UI / 'export-hub-ui.js'),
        '/* @neuromap-export-hub-ui-panel */\n', export_panel)
    result['creative-tools'] += '\n' + replace_once(export_hub_ui,
                                                '/* @neuromap-export-css */ ""',
                                                json.dumps(read(UI / 'export-hub.css')))
    result['desktop-workflows'] = '\n'.join(ui_source(name) for name in
                                          ('desktop-workflows', 'media-core', 'caption-editor', 'desktop-media', 'menu-ux', 'view-core', 'flow-core', 'work-core', 'concept-network', 'guided-flow', 'view-picker', 'view-appearance-core', 'linked-views', 'workspace-locale', 'workspace-chrome', 'navigation-core', 'navigation-experience', 'presentation-experience', 'compare-core', 'compare-workspace', 'orbit-core', 'orbit-workspace', 'ui-skin-core', 'workspace-skins', 'first-steps', 'topbar-curation', 'map-style-core', 'map-style-gallery'))
    workspace_tools_js = replace_once(read(UI / 'workspace-tools.js'),
        '/* @neuromap-workspace-tools-curate */\n',
        read(UI / 'workspace-tools-curate.js'))
    result['desktop-workflows'] += '\n' + workspace_tools_js
    result['desktop-workflows'] += '\n' + read(UI / 'node-text-tools.js')
    workspace_tools = read(UI / 'workspace-layout-lists-tools.js')
    for tool_marker, tool_file in (
        ('workspace-layout-lists-mount', 'workspace-layout-lists-mount.js'),
        ('workspace-layout-lists-text', 'workspace-layout-lists-text.js'),
        ('workspace-layout-lists-insert', 'workspace-layout-lists-insert.js'),
        ('workspace-layout-lists-chrome', 'workspace-layout-lists-chrome.js'),
    ):
        workspace_tools = replace_once(
            workspace_tools, f'/* @neuromap-{tool_marker} */\n',
            read(UI / tool_file))
    workspace_lists = replace_once(read(UI / 'workspace-layout-lists.js'),
        '/* @neuromap-workspace-layout-lists-tools */\n', workspace_tools)
    workspace_layout = replace_once(read(UI / 'workspace-layout.js'),
        '/* @neuromap-workspace-layout-lists */\n', workspace_lists)
    result['desktop-workflows'] += '\n' + replace_once(workspace_layout,
        '/* @neuromap-workspace-layout-styles */ ""',json.dumps(read(UI / 'workspace-layout.css')))
    result['desktop-workflows'] = replace_once(result['desktop-workflows'],
        '/* @neuromap-orbit-desktop-styles */ ""',
        json.dumps(read(UI / 'orbit-workspace.css')))
    result['desktop-workflows'] = replace_once(result['desktop-workflows'],
        '/* @neuromap-luminous-chrome-styles */ ""',
        json.dumps(read(UI / 'luminous-chrome.css') + '\n' + read(UI / 'interface-theme.css')))
    return result


def prepare(platform, destination):
    if platform not in ('android', 'windows', 'macos'):
        raise ValueError(f'Unknown platform: {platform}')
    dest = Path(destination).resolve()
    if dest == ROOT or dest.is_relative_to(ROOT) or ROOT.is_relative_to(dest):
        raise ValueError('Choose a fresh destination outside the checkout')
    if dest.exists():
        raise FileExistsError(f'Build destination already exists: {dest}')
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    version = json.loads(read(ROOT / 'versions.json'))['editor']
    stamp = f'data-neuromap-build="{revision}" data-neuromap-version="{version}"'
    assets = bundles()
    if platform == 'android':
        assets['lifecycle'] += '\n' + read(ROOT/'apps/desktop-shared/editor/workspace-save-queue.js')
        assets['graphics'] += '\n' + read(ROOT/'apps/desktop-shared/editor/fast-canvas.js')
        assets['creative-tools'] += '\n' + read(UI/'node-text-tools.js')
        assets['localization'] += '\n' + 'globalThis.GlaukaMobile=true;\n' + interface_locales.compose(UI) + '\n' + read(UI/'language-menu.js') + '\n' + read(UI/'android-languages.js')
        # One audited set of portable desktop cores, bundled for the WebView
        # from this same checkout; no remote JavaScript and no Developer UI.
        portables = (
            'stack-safe-json', 'source-lens-core', 'pdfjs-adapter', 'source-lens-pdf', 'document-import-core',
            'capture-core', 'visual-study-core', 'anki-tsv-core', 'knowledge-core', 'document-view-core',
            'share-html-core', 'quality-core', 'portable-exchange-core',
            'wiki-links-core', 'knowledge-db-core', 'dashboard-core',
        )
        studio_ui_modules = (
            'wiki-links-ui', 'knowledge-db-ui', 'dashboard-ui',
        )
        ocr_modules = (
            'ocr-core', 'ocr-image', 'ocr-quality', 'ocr-structure', 'ocr-runtime', 'ocr-ui',
        )
        # Linked views share the desktop engines; Android mounts a touch-first
        # chrome (no split pane) so alternate presentations stay exclusive.
        view_engines = (
            'view-core.js', 'flow-core.js', 'work-core.js', 'concept-network.js',
            'guided-flow.js', 'view-appearance-core.js', 'view-picker.js',
        )
        assets['android-74-core'] = '\n'.join(
            [read(UI / name) for name in view_engines] +
            [ui_source('linked-views')] +
            [read(ROOT / 'apps/desktop-shared/editor' / (name + '.js'))
             for name in portables] +
            [read(ROOT / 'apps/desktop-shared/editor/task-calendar-core.js')] +
            # Tiny loaders only — heavy Studio/OCR UI stays out of first paint.
            [read(UI / 'ocr-ensure.js'), read(UI / 'studio-tools-ensure.js')]
        )
        assets['ocr-tools'] = '\n'.join(
            read(ROOT / 'apps/desktop-shared/editor' / (name + '.js'))
            for name in ocr_modules
        )
        assets['studio-tools'] = '\n'.join(
            read(ROOT / 'apps/desktop-shared/editor' / (name + '.js'))
            for name in studio_ui_modules
        )
        shutil.copytree(ROOT / 'apps/android/native', dest,
                        ignore=shutil.ignore_patterns('build', '.gradle', 'local.properties'))
        # Android Gradle reads the canonical version after the native project is staged.
        shutil.copyfile(ROOT / 'versions.json', dest / 'versions.json')
        html = dest / 'app/src/main/assets/app/index.html'
        target = dest / 'app/src/main/assets/assets'
        interface_locales.stage(UI, html.parent/'locales')
        (target/'interface-languages.css').write_text(read(UI/'interface-languages.css')+'\n'+read(UI/'android-languages.css'))
        stage_pdfjs(target / 'pdfjs')
        stage_ocr(target / 'ocr')
        shutil.copyfile(ROOT/'apps/desktop-shared/ocr/host-worker.js',target/'ocr/host-worker.js')
        (target / 'architect.js').write_text(editor_sources('android'), encoding='utf-8', newline='\n')
        # Android style thumbnails and shape tools use precisely the desktop
        # preset definitions: refresh the native WebView asset on every APK build.
        (target / 'map-style-core.js').write_text(read(UI / 'map-style-core.js'), encoding='utf-8', newline='\n')
        for name, content in assets.items():
            if name != 'desktop-workflows':
                (target / f'{name}.js').write_text(content, encoding='utf-8', newline='\n')
        text = replace_once(read(html), '<!-- @glauka-mobile-logo -->', read(ROOT/'packages/brand/glauka-mark.svg'))
    else:
        assets['localization'] += '\n' + interface_locales.compose(UI) + '\n' + read(UI/'language-menu.js')
        shutil.copytree(ROOT / 'apps/desktop-shared/src', dest / 'desktop',
                        ignore=shutil.ignore_patterns('build', '*.exe'))
        # Go sources track only a README placeholder so source-only embeds compile.
        # Replace that placeholder with the verified PDF.js assets in staged output.
        pdf_bundle = dest / 'desktop/resources/pdfjs'
        if pdf_bundle.is_dir() and sorted(p.name for p in pdf_bundle.iterdir()) == ['README.txt']:
            (pdf_bundle / 'README.txt').unlink()
            pdf_bundle.rmdir()
        stage_pdfjs(pdf_bundle)
        mathjax_bundle = dest / 'desktop/resources/mathjax'
        if mathjax_bundle.is_dir():
            shutil.rmtree(mathjax_bundle)
        mathjax_bundle.mkdir(parents=True)
        (mathjax_bundle / 'mathjax.js').write_text(assets['mathjax'], encoding='utf-8',
                                                   newline='\n')
        ocr_bundle=dest/'desktop/resources/ocr'
        if ocr_bundle.is_dir():shutil.rmtree(ocr_bundle)
        stage_ocr(ocr_bundle)
        shutil.copyfile(ROOT/'apps/desktop-shared/ocr/host-worker.js',ocr_bundle/'host-worker.js')
        interface_locales.stage(UI,dest/'desktop/resources/locales')
        html = dest / 'desktop/resources/index.html'
        text = replace_once(read(html), '<!-- @glauka-startup-mark -->', read(ROOT/'packages/brand/glauka-mark.svg'))
        text = replace_once(text, '/* @neuromap-desktop-editor */', editor_sources('desktop'))
        text = replace_once(text, '/* @neuromap-desktop-styles */',
                            read(ROOT / 'apps/desktop-shared/editor/editor.css') + '\n' + read(UI/'interface-languages.css'))
        inline = {name: assets[name] for name in
                  ('theme-picker', 'localization', 'ai-workflows', 'graphics',
                   'drag-preview', 'lifecycle', 'desktop-workflows', 'continuation-layout')}
        # MathJax (~2.2 MB) stays a same-origin /mathjax/mathjax.js file and is
        # fetched only when formulas open; keep map/creative startup lean.
        inline['map-core'] = '\n'.join(assets[name] for name in
                                      ('map-core', 'creative-core', 'creative-tools'))
        for name, content in inline.items():
            text = replace_once(text, f'/* @neuromap-{name} */', content)
        if platform == 'macos':
            shutil.copytree(ROOT / 'apps/macos/native', dest / 'mac')
            # Use the release manifest for both Finder metadata and the native
            # title; App Store-style short versions cannot contain '-rc.1'.
            release = json.loads(read(ROOT / 'versions.json'))['macos']['version']
            bundle = dest / 'mac/Info.plist'
            info = plistlib.loads(bundle.read_bytes())
            info['GlaukaReleaseVersion'] = release
            info['CFBundleShortVersionString'] = release.split('-', 1)[0]
            info['CFBundleVersion'] = macos_bundle_build(release)
            bundle.write_bytes(plistlib.dumps(info))
        else:
            shutil.copytree(ROOT / 'apps/windows/installer', dest / 'desktop/setup',
                            ignore=shutil.ignore_patterns('*.exe', '*.syso'))
            interface_locales.installer(UI,ROOT/'apps/windows/installer/install_ui.ps1',dest/'desktop/setup/binaries/locales.json')
    text = replace_once(text, 'data-neuromap-build="workspace"', stamp)
    html.write_text(text, encoding='utf-8', newline='\n')
    return dest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('platform', choices=['android', 'macos', 'windows'])
    parser.add_argument('destination')
    args = parser.parse_args()
    print(prepare(args.platform, args.destination))
