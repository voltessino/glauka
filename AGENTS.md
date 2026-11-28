# Glauka Open Source — note for contributors

This repository is the **public Open Source Core** (`voltessino/glauka`).

- Prefer the smallest change that preserves saved maps, Undo/Redo, IDs and offline data.
- Do not commit secrets, signing keys, personal home paths, or private download URLs.
- Before proposing a release sync from the private monorepo, run:

```bash
python3 scripts/qa/scan_public_leakage.py --mode public
```

Commercial AI Studio / Pro modules are not part of this tree. See `README.md` and `TRADEMARK.md`.
