# Tenere aggiornata la repo pubblica `voltessino/glauka`

**Repo privata (completa):** `voltessino/neuromap-android`  
**Repo pubblica (nucleo Open Source):** `voltessino/glauka`  
**Strumento:** `scripts/release/export_open_source.py`

Non sono la stessa cosa e **non si aggiornano da sole**. La pubblica riceve solo il nucleo Free senza AI Pro, senza sito commerciale, senza Video Studio e senza pezzi Developer.

## Cosa entra e cosa no

| Entra in `glauka` | Non entra (restano solo privati) |
| --- | --- |
| Editor mappe, 7 viste, salvataggi, LAN, Cloud core, OCR locale | `apps/website/` (sito) |
| Android Free, packaging base | `tools/` (Video Studio, license-manager, …) |
| Guide utili al nucleo open | AI Studio / TTS neural / BYOK / licenze Pro |
| | Molti report QA e roadmap commerciali |

Quindi: una pulizia del **sito** o di **Video Studio** nella privata **non** richiede un sync pubblico. Una modifica a `packages/`, editor desktop/Android Free, o file di guida del nucleo **sì**.

## Quando sincronizzare

1. Dopo ogni modifica al **nucleo open** (editor, Android Free, guide del nucleo).
2. Prima di annunciare novità open source o una release Android Free pubblica.
3. Sito e Video Studio da soli **non** richiedono sync (restano privati).
4. Autorizzazione del proprietario (26 nov 2026): gli agenti aggiornano **direttamente** anche `voltessino/glauka`, non solo la privata.

## Procedura (locale, senza GitHub Actions)

Da un checkout pulito della **privata**, su `main` aggiornato:

```bash
# 1. Esporta fuori dal checkout (obbligatorio: cartella esterna)
python3 scripts/release/export_open_source.py --output /tmp/glauka-oss --force

# 2. Controlla a occhio README/LICENSE e che non compaiano pezzi Pro
# 3. Copia il contenuto esportato nella clone di voltessino/glauka
# 4. Commit + push su glauka, messaggio tipo:
#    sync: update Glauka Open Source Core from <sha-corta-main-privata>
```

Il messaggio storico sui commit pubblici usa già questa forma (`sync: update Glauka Open Source Core from …`).

## Gate di sicurezza

- L’export fallisce se trova token Pro/AI vietati nella cartella esportata.
- Non avviare workflow automatici: aggiornamento **manuale** dopo revisione.
- Non spingere segreti, chiavi, firme o asset Developer.

## Dopo la PR di revisione Zona A (#343)

Quasi tutto il lavoro sito + Video Studio è **escluso** dall’export.  
Un sync pubblico ha senso soprattutto quando si integra in `main` qualcosa del nucleo open (es. suggerimenti offline già sincronizzati il 26 nov), oppure se si vuole portare in pubblico solo le guide di manutenzione/FEATURE_MAP aggiornate.
