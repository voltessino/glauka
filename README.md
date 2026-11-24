# Glauka (Open Source Core Edition · AGPLv3)

**Glauka** is a fast, offline-first mind-mapping and knowledge workspace for
Desktop (Windows/macOS/Linux Go + WebView) and Android Free.

## What is included in this repository

- **7 synchronized workspace views**: Canvas, Outline, Kanban, Flowchart, Network, Story, and Presentation.
- **Encrypted map storage & peer-to-peer transfer**: AES-256-GCM `.glk` files and encrypted LAN `PC ↔ Phone` handoff over QR + 6-digit pairing.
- **Document & Study tools**: On-device OCR, PDF viewing, flashcards, OPML/XMind/Markdown import & export, and recovery snapshots.
- **Zero telemetry / Offline-first**: Works completely offline on your device.

## Glauka Pro & AI Edition (Dual-Licensed)

The commercial **AI Studio** suite (LLM map generation/expansion, document Q&A,
neural/cloud text-to-speech, VoiceStudio connector, dictation, and Pro licensing)
is **not** part of this repository and remains proprietary under **Glauka Pro**
([glauka.it](https://glauka.it) / Microsoft Store).

## Development & Verification

```bash
npm test
npm run test:structure
cd apps/desktop-shared/src && go test ./...
```

## License

This Open Source Core is licensed under **GNU AGPLv3** ([LICENSE](LICENSE)).
Commercial licensing & trademark rules are detailed in [TRADEMARK.md](TRADEMARK.md) and [CLA.md](CLA.md).
