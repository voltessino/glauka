> Nota storica della 6.15. Per lo stato corrente 6.15.1 e Android 0.4 vedere [PLATFORM_PARITY.md](../PLATFORM_PARITY.md) e [DEVELOPMENT.md](../DEVELOPMENT.md).

# NeuroMap Architect 6.15 Developer — verifica

Nuove richieste: conservare ordine dei rami XMind in senso orario partendo da alto-destra; distinguere l’ordine originario da quello visivo; evitare ordinamenti per altezza del sottoalbero. Prevedere titolo sul recinto, dialogo di anteprima e dimensione delle mappe grandi selezionabile, catalogo modelli basato su ID API, temi di sfondo, menu EN completi, slider distribuzione a passi 25%, modifica dei controlli macOS.

Test del client browser: sequenza dei quattro rami sui quattro quadranti, importazione XMind con lati bloccati, suddivisione di 301 nodi in 3 mappe a soglia 125 oppure 4 mappe a soglia 80, etichetta persistente dei recinti, selezione sfondo. Test Go del desktop e compilazione locale Windows amd64 passati.

L'installer sperimentale Windows 6.15 è stato costruito da una copia privata della base 6.14. Non rilasciare da questo ramo prima dell'integrazione del codice e dei test GitHub Actions. Nessun artefatto firmato è stato pubblicato qui.
