MathJax 3.2.2, `es5/tex-svg-full.js`, vendored without modification from the
`mathjax@3.2.2` npm package (https://www.npmjs.com/package/mathjax/v/3.2.2).
Upstream source: https://github.com/mathjax/MathJax/tree/3.2.2
License: Apache-2.0, reproduced in LICENSE.

Used offline for TeX → SVG. `prepare.py` sets `fontCache: 'none'` so each saved
formula contains its own vector glyphs. Automatic typesetting, menus and dynamic
TeX packages such as `require`, `autoload` and HTML links are not enabled.
The same engine is embedded in the desktop HTML and bundled in Android assets.
