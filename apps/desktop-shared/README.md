# Desktop condiviso

`src/` contiene l'unico backend Go e l'unico editor usati da Windows e Mac. Le integrazioni native sono selezionate tramite build tag Go. Il modulo JavaScript `packages/map-core` viene composto nell'HTML da `scripts/release/prepare.py`.

Le patch storiche compresse 6.13, 6.14 e 6.15 non sono più nel checkout corrente: restano recuperabili tramite [SHA e commit Git originali](../../docs/maintenance/legacy-source-archives.json). Non erano input delle build attive.
