#!/usr/bin/env python3
"""Compare the composed editor JS from two Git revisions without changing files.

This checks editor_sources() (including editor-colors), not the full release
bundle, CSS, native code, or runtime behavior. Use it for extraction-only
refactors; deliberate source changes will correctly report a difference.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
MARKER = '/* @neuromap-editor-colors */'
PLATFORMS = ('desktop', 'android')


class SourceContractError(ValueError):
    """The revision cannot be assembled using the current staging contract."""


def editor_path(platform):
    if platform not in PLATFORMS:
        raise SourceContractError(f'Unsupported platform: {platform}')
    return 'apps/android/editor' if platform == 'android' else 'apps/desktop-shared/editor'


def assemble_from_reader(read, platform):
    """Mirror prepare.editor_sources(), including its single color marker."""
    folder = editor_path(platform)
    try:
        entries = json.loads(read(f'{folder}/sources.json'))
    except (ValueError, TypeError) as exc:
        raise SourceContractError(f'{folder}/sources.json is invalid: {exc}') from exc
    if not isinstance(entries, list) or not entries:
        raise SourceContractError(f'{folder}/sources.json must contain source names')
    if any(not isinstance(name, str) or
           not re.fullmatch(r'(?:shared/)?[a-z0-9][a-z0-9-]*\.js', name) for name in entries):
        raise SourceContractError(f'{folder}/sources.json contains an unsafe filename')
    if len(set(entries)) != len(entries):
        raise SourceContractError(f'{folder}/sources.json contains duplicate files')
    if entries[0] != 'prelude.js' or entries[-1] != 'startup.js':
        raise SourceContractError(f'{folder}/sources.json changed its bootstrap order')
    source = ''.join(read('packages/editor-ui/editor-shared/' + name[7:]
                          if name.startswith('shared/') else f'{folder}/{name}')
                     for name in entries)
    shared_app_fragments = {
        'app-hit-testing.js',
        'app-image-drag.js',
        'app-node-mutations.js',
        'state-relationships-summary.js',
        'state-node-style.js',
    }
    for fragment, filename in (
        ('/* @neuromap-app-tabs */\n', 'app-tabs.js'),
        ('/* @neuromap-app-camera-status */\n', 'app-camera-status.js'),
        ('/* @neuromap-app-hit-testing */\n', 'app-hit-testing.js'),
        ('/* @neuromap-app-selection-clipboard */\n', 'app-selection-clipboard.js'),
        ('/* @neuromap-app-image-drag */\n', 'app-image-drag.js'),
        ('/* @neuromap-app-inline-edit */\n', 'app-inline-edit.js'),
        ('/* @neuromap-app-node-mutations */\n', 'app-node-mutations.js'),
        ('/* @neuromap-app-import */\n', 'app-import.js'),
        ('/* @neuromap-app-persist */\n', 'app-persist.js'),
        ('/* @neuromap-app-summary-image */\n', 'app-summary-image.js'),
        ('/* @neuromap-app-context-find */\n', 'app-context-find.js'),
        ('/* @neuromap-app-bind-ui */\n', 'app-bind-ui.js'),
        ('/* @neuromap-desktop-controls-native */\n', 'desktop-controls-native.js'),
        ('/* @neuromap-desktop-controls-selection */\n', 'desktop-controls-selection.js'),
        ('/* @neuromap-desktop-controls-bind */\n', 'desktop-controls-bind.js'),
        ('/* @neuromap-shell-home */\n', 'shell-home.js'),
        ('/* @neuromap-state-relationships-summary */\n',
         'state-relationships-summary.js'),
        ('/* @neuromap-state-node-style */\n', 'state-node-style.js'),
        ('/* @neuromap-knowledge-ui-draw */\n', 'knowledge-ui-draw.js'),
        ('/* @neuromap-learn-ui-session */\n', 'learn-ui-session.js'),
    ):
        if fragment in source:
            if source.count(fragment) != 1:
                raise SourceContractError(
                    f'{platform} editor has duplicate markers for {filename}')
            if filename in shared_app_fragments:
                shared = f'packages/editor-ui/editor-shared/{filename}'
                try:
                    body = read(shared)
                except SourceContractError:
                    body = read(f'{folder}/{filename}')
            else:
                body = read(f'{folder}/{filename}')
            source = source.replace(fragment, body)
    if source.count(MARKER) != 1:
        raise SourceContractError(f'{platform} editor requires exactly one color marker')
    composed = source.replace(MARKER, read('packages/editor-ui/editor-colors.js'))
    share_marker = '/* @neuromap-map-share-core */\n'
    if share_marker in composed:
        if composed.count(share_marker) != 1:
            raise SourceContractError(f'{platform} editor has duplicate map-share markers')
        composed = composed.replace(
            share_marker,
            read('packages/map-sharing/core.js') + '\n' +
            read('packages/map-sharing/transfer.js') + '\n')
    return entries, composed


def compare_sources(read_before, read_after, platforms=PLATFORMS):
    results = []
    for platform in platforms:
        before_files, before = assemble_from_reader(read_before, platform)
        after_files, after = assemble_from_reader(read_after, platform)
        first = next((i for i, (a, b) in enumerate(zip(before, after)) if a != b),
                     min(len(before), len(after)))
        equal = before == after
        results.append({
            'platform': platform,
            'identical': equal,
            'before_sha256': hashlib.sha256(before.encode('utf-8')).hexdigest(),
            'after_sha256': hashlib.sha256(after.encode('utf-8')).hexdigest(),
            'before_characters': len(before),
            'after_characters': len(after),
            'first_difference_at': None if equal else first,
            'added_sources': [p for p in after_files if p not in before_files],
            'removed_sources': [p for p in before_files if p not in after_files],
        })
    return results


UI_FRAGMENTS = {
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
    'creative-drawing': [
        ('creative-drawing-dialogs', 'creative-drawing-dialogs.js'),
        ('creative-drawing-toolbar', 'creative-drawing-toolbar.js'),
        ('creative-drawing-library', 'creative-drawing-library.js'),
    ],
    'creative-formatting': [
        ('creative-formatting-values', 'creative-formatting-values.js'),
    ],
    'caption-editor': [
        ('caption-editor-buttons', 'caption-editor-buttons.js'),
        ('caption-editor-layout', 'caption-editor-layout.js'),
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


_UI_NESTED_FRAGMENTS = {
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


def assemble_ui_from_reader(read, name):
    """Compare the complete lexical closure, before unchanged style substitutions."""
    if name not in UI_FRAGMENTS:
        raise SourceContractError(f'Unsupported shared UI source: {name}')
    source = read(f'packages/editor-ui/{name}.js')
    for marker_name, file in UI_FRAGMENTS[name]:
        marker = f'/* @neuromap-{marker_name} */\n'
        if marker in source:
            if source.count(marker) != 1:
                raise SourceContractError(f'{name} has duplicate fragment markers')
            body = read(f'packages/editor-ui/{file}')
            nested_specs = _UI_NESTED_FRAGMENTS.get(file, [])
            nested_present = [
                (nested_name, nested_file)
                for nested_name, nested_file in nested_specs
                if f'/* @neuromap-{nested_name} */\n' in body
            ]
            if nested_present and len(nested_present) != len(nested_specs):
                raise SourceContractError(
                    f'{file} has incomplete nested fragment markers')
            for nested_name, nested_file in nested_present:
                nested = f'/* @neuromap-{nested_name} */\n'
                if body.count(nested) != 1:
                    raise SourceContractError(
                        f'{file} needs one nested marker for {nested_file}')
                body = body.replace(nested, read(f'packages/editor-ui/{nested_file}'))
            source = source.replace(marker, body)
    return source


def compare_ui_sources(read_before, read_after):
    results = []
    for name in UI_FRAGMENTS:
        before = assemble_ui_from_reader(read_before, name)
        after = assemble_ui_from_reader(read_after, name)
        equal = before == after
        first = next((i for i, (a, b) in enumerate(zip(before, after)) if a != b),
                     min(len(before), len(after)))
        results.append({
            'platform': f'shared/{name}', 'identical': equal,
            'before_sha256': hashlib.sha256(before.encode('utf-8')).hexdigest(),
            'after_sha256': hashlib.sha256(after.encode('utf-8')).hexdigest(),
            'before_characters': len(before), 'after_characters': len(after),
            'first_difference_at': None if equal else first,
            'added_sources': [], 'removed_sources': [],
        })
    return results


def run_git(repo, *arguments):
    try:
        result = subprocess.run(['git', *arguments], cwd=repo, capture_output=True,
                                check=True)
    except (OSError, subprocess.CalledProcessError) as exc:
        raise SourceContractError(f'Git read failed for {arguments!r}: {exc}') from exc
    return result.stdout.decode('utf-8').replace('\r\n', '\n').replace('\r', '\n').strip()


def resolve_revision(repo, revision):
    return run_git(repo, 'rev-parse', '--verify', '--end-of-options',
                   f'{revision}^{{commit}}')


def revision_reader(repo, commit):
    def read(path):
        try:
            result = subprocess.run(['git', 'show', f'{commit}:{path}'], cwd=repo,
                                    capture_output=True, check=True)
        except (OSError, subprocess.CalledProcessError) as exc:
            raise SourceContractError(f'Missing {path} in {commit[:12]}') from exc
        return result.stdout.decode('utf-8').replace('\r\n', '\n').replace('\r', '\n')
    return read


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', required=True, help='Commit before a structural refactor')
    parser.add_argument('--head', default='HEAD', help='Commit after a structural refactor')
    parser.add_argument('--repo', type=Path, default=ROOT)
    parser.add_argument('--platform', choices=(*PLATFORMS, 'both'), default='both')
    parser.add_argument('--json', action='store_true', help='Machine-readable comparison')
    parser.add_argument('--include-ui-fragments', action='store_true',
                        help='Also compare settings and linked-view closures with their fragments')
    args = parser.parse_args(argv)
    try:
        base = resolve_revision(args.repo, args.base)
        head = resolve_revision(args.repo, args.head)
        platforms = PLATFORMS if args.platform == 'both' else (args.platform,)
        results = compare_sources(revision_reader(args.repo, base),
                                  revision_reader(args.repo, head), platforms)
        if args.include_ui_fragments:
            results += compare_ui_sources(revision_reader(args.repo, base),
                                          revision_reader(args.repo, head))
    except (SourceContractError, UnicodeError) as exc:
        parser.exit(2, f'Cannot compare editor bundles: {exc}\n')
    if args.json:
        print(json.dumps({'base': base, 'head': head, 'results': results}, indent=2))
    else:
        for result in results:
            label = 'IDENTICAL' if result['identical'] else 'DIFFERENT'
            print(f"{result['platform']}: {label}; "
                  f"{result['before_characters']} -> {result['after_characters']} chars; "
                  f"first difference: {result['first_difference_at']}")
            if result['added_sources'] or result['removed_sources']:
                print(f"  + {result['added_sources']} / - {result['removed_sources']}")
    return 0 if all(item['identical'] for item in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
