# Glauka — Health Icons SVG gallery expansion

**Added:** 28 October 2026 · **Source:** https://github.com/resolvetosavelives/healthicons

## Permission and provenance

The **74 additional vector symbols** incorporated into Glauka originate from
Health Icons (Resolve to Save Lives / Health Icons community). The Health Icons
illustrations are published under **Creative Commons Zero 1.0 Universal (CC0)**:
https://creativecommons.org/publicdomain/zero/1.0/

The gallery stores verbatim SVG path geometry from the following project tree:
`public/icons/svg/filled/`. The paths have been recolored and placed on
subtle vector medallions. The new symbols are not AI-generated and do not
make HTTP requests at runtime.

Every added asset retains its exact original relative path in
`GlaukaObjectGalleryPack.ITEMS[].source`, e.g., `body/tooth` maps to
`public/icons/svg/filled/body/tooth.svg`. Individual assets are stored in
`packages/editor-ui/object-gallery-parts-*.js`. This is a traceable
source list, not a separately hosted CDN.

## New categories

| Category | New | Examples |
| --- | ---: | --- |
| Anatomy | 20 | Eye, ear, tooth, spine, skeleton, DNA, cell nuclei |
| Medical tools | 14 | Microscope, stethoscope, syringe, defibrillator, X-ray |
| Everyday objects | 12 | Book, laptop, umbrella, trophy, certificate |
| Nutrition | 7 | Fruit, vegetables, dairy, hot meal |
| Movement and activity | 6 | Running, yoga, swimming, bicycle |
| Science and ideas | 11 | Artificial intelligence, database, globe, fingerprint |
| Places | 4 | House, hospital, forest, city |
| **Total new** | **74** | **82 with the original 8 Glauka objects** |

**Design scope:** these are deliberately **schematic pictograms**.
They are appropriate for quick recognition, icons, and memory maps;
they are **not a medical anatomical atlas**, validated medical charts,
realistic photographs, or technical documentation of an instrument.
The original scroll, amphora and painting are more decorative and remain
separately available.

## Technical layout and compatibility

- Build script `scripts/release/prepare.py` embeds local category packs
  before `creative-core.js` for Windows, macOS and Android.
- The SVG renderer assembles one cached SVG from each known ID, with local
  SVG paths, a subtle vector frame and a 240x240 viewBox.
- Saving a project stores just `{id,size}` in `objectArt`;
  the catalog artwork is never copied into map JSON.
- The browser gallery initially creates up to **24** preview cards, with
  category filtering, search and progressive +24 steps.
- SVG export uses one shared definition per used asset ID rather than
  duplicating every SVG path throughout the exported document.
- No online services, analytics, remote SVG URLs or external assets are
  required while the application runs.

## Licensing note

CC0 permits commercial use; maintaining this attribution and source map is
voluntary but supports provenance review. Do not extrapolate the source
license to other content imported by the user.

For visual QA, inspect both light/dark themes and Android/desktop
at 25%, 100%, 300% zoom. All icon schematics must be judged on readability
and recognizable shape; untested visual quality should not be called
clinically validated or professionally illustrated.
