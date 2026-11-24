# Installazione e firma Windows

`NeuroMap-Architect-Setup-…exe` installa il programma. Il file `Portable-…exe`
si avvia direttamente: non presenta una procedura di installazione.

## Situazione attuale

Gli EXE distribuiti per questi test privati sono **non firmati**. Non è stato
fornito un certificato di firma del codice associato a un'identità verificata.
Il nuovo processo supporta la firma, ma non può inventare quell'identità.
Un certificato autofirmato non risolve l'avviso sui computer degli utenti.

## Come ottenere una firma riconosciuta

1. Scegliere un servizio di firma del codice che verifichi l'identità dell'editore:
   [Microsoft Artifact Signing](https://learn.microsoft.com/azure/artifact-signing/overview)
   oppure un certificato Authenticode di un'autorità riconosciuta da Windows.
   Verificare requisiti di paese, persona/azienda, costi e conservazione della
   chiave prima dell'acquisto. La chiave può risiedere su token hardware o servizio
   cloud: non condividerla in chat e non inserirla nel repository.
2. Completare la verifica dell'identità e predisporre la chiave su un PC Windows.
   Per la procedura integrata qui, il certificato deve comparire in
   `Cert:\CurrentUser\My` e avere una chiave privata utilizzabile tramite CSP/KSP.
   Installare SignTool dal Windows SDK e gli eventuali driver del fornitore.
3. Dal checkout completo, su Windows, eseguire (sostituire percorsi e impronta):

   ```powershell
   Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
     Select-Object Subject, Thumbprint, NotAfter, HasPrivateKey
   python scripts/release/build_desktop.py windows C:\NeuroMapBuild\signed `
     --windows-sign-thumbprint IMPRONTA_DI_40_CARATTERI_ESADICIMALI `
     --signtool 'C:\percorso\signtool.exe'
   ```

   Il builder firma prima l'app, quindi la incorpora nel Setup; infine firma il
   Setup. Usa SHA-256 e una marca temporale RFC 3161. Verifica entrambe le firme;
   se la firma o la verifica fallisce interrompe la build. ZIP e SHA-256 vengono
   calcolati dopo la firma. Il manifest dichiara esplicitamente `unsigned` oppure
   `verified`. Non usare il certificato di test/autofirmato per la distribuzione.

Microsoft Artifact Signing usa un'integrazione diversa (SignTool con la libreria
Dlib e i metadati dell'account); **non** si seleziona tramite l'opzione thumbprint.
Seguire la [guida Microsoft per SignTool](https://learn.microsoft.com/azure/artifact-signing/how-to-signing-integrations)
e mantenere lo stesso ordine app → incorporamento → Setup. Questa integrazione
cloud non è ancora configurata nel builder e richiede un account autorizzato.

## Firma valida e SmartScreen sono due controlli distinti

La firma valida identifica l'editore e permette di verificare integrità e fiducia.
SmartScreen considera anche la reputazione: un'app nuova può ancora mostrare un
avviso anche se correttamente firmata; neppure un certificato EV ne garantisce
l'assenza. Mantenere la stessa identità dell'editore nelle versioni successive,
distribuire da un canale stabile e sottoporre eventuali falsi positivi al
[portale Microsoft](https://www.microsoft.com/wdsi/filesubmission).
Non proporre agli utenti di disattivare le protezioni di Windows.

La firma effettiva e il test dell'installazione devono essere completati su
Windows. I test Linux del builder verificano comandi e gestione degli errori,
non attestano una firma che non è stata apposta.
