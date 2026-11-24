# Assistente AI: voce e trasformazioni della mappa

Il pulsante AI della barra laterale apre un pannello dedicato, riducibile per
vedere la mappa mentre si detta. Le funzioni rispettano l'accesso AI dell'edizione:
desktop Developer e Android private test mantengono i rispettivi controlli nativi.
Non viene attivato Pro automaticamente.

## Configurazione

- **Modelli e chiave per i testi**: configurazione esistente, usata per creare,
  tradurre, riordinare e dividere i concetti. Non serve una chiave per ogni azione.
- **Voce: modello e chiave API**: Groq con `whisper-large-v3-turbo` predefinito;
  in alternativa OpenAI con `whisper-1`. È possibile usare la chiave dei testi
  soltanto se il provider coincide, oppure una chiave voce separata.
- La chiave voce rimane in memoria per la sessione. Provider, modello e lingua
  parlata si possono conservare come preferenze; progetti e backup non contengono
  la chiave voce. Non inserire chiavi nelle issue o nei test.

## Voce e registrazioni

**Detta e crea** richiede il permesso del microfono soltanto quando viene premuto.
Si può iniziare una nuova scheda oppure continuare quella attiva. Circa ogni
20 secondi viene chiuso un file audio autonomo e trascritto; il modello testuale
genera il primo titolo e i concetti, poi aggiunge i successivi ai genitori pertinenti.
I nodi già presenti conservano identità, contenuto e stile. Le aggiunte hanno Undo;
il testo riconosciuto viene conservato nelle note della radice.

**Finisci dettatura** elabora anche l'ultimo blocco. **Ferma / Annulla**, chiusura
del pannello, cambio scheda o app in secondo piano fermano il microfono e annullano
le operazioni pendenti. Una modifica alla mappa durante una richiesta impedisce
di applicare una risposta ormai superata. La coda è limitata: se il servizio non
sta al passo, la registrazione si ferma e i blocchi già acquisiti rimangono
scaricabili singolarmente. Non si concatenano frammenti WebM privi di intestazione.
La sessione si ferma a circa 25 MB di audio conservato; una nuova dettatura azzera
l'elenco precedente, quindi scaricare prima i blocchi che si vogliono conservare.

**Trascrivi registrazione** accetta flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav e
webm, entro **25 MiB per file**. La scelta del file non avvia un invio. Dopo la
trascrizione si può correggere il testo e premere **Prepara mappa dal testo**:
l'anteprima crea una nuova scheda solo quando viene applicata. I testi lunghi sono
letti in segmenti da 15.000 caratteri e riassunti in un massimo di 180 concetti;
il testo completo rimane nelle note (massimo 500.000 caratteri). La dettatura
incrementale si ferma a 300 concetti: continuare in una nuova mappa.

Audio e contenuto vengono inviati ai provider configurati per le azioni richieste.
Nessun audio viene caricato durante l'apertura del pannello.

## Disponibilità e limiti

Il pannello mostra separatamente modello voce e modello testuale, i valori di
`x-ratelimit-remaining-*`, i ripristini `x-ratelimit-reset-*` e `Retry-After` se
comunicati. I contatori scaduti diventano "da aggiornare": non rappresentano una
nuova quota garantita. Dopo HTTP 429 la dettatura si ferma e non riprova da sola;
quando è noto un blocco temporaneo, nuove operazioni rispettano quel termine.

I piani Groq possono cambiare: l'app **non inventa** minuti disponibili o orari
di ripristino mancanti. Se il servizio non espone i secondi audio, il saldo resta
"non comunicato" e il collegamento a Groq Console permette di controllare il
piano. La durata letta dai metadati del file è informativa, non una misura del
credito residuo. Il provider può rifiutare file validi per l'app in base al piano.

## Trasformazioni con anteprima

- **Traduci tutta la mappa** include titoli, note, titoli dei recinti, etichette
  delle relazioni, didascalie e testo nei disegni, anche raggruppati. Formule,
  frammenti di codice, URL e collegamenti rimangono invariati. La lingua scelta
  prevale su quella dell'interfaccia. Tutti i segmenti devono essere validi:
  nessuna traduzione parziale viene applicata dopo un errore.
- **Metti in ordine** riorganizza un ramo o tutta la mappa (massimo 200 concetti
  per richiesta). Il piano deve contenere esattamente gli ID originali, senza
  cicli. Nodi, immagini e collegamenti non sono ricreati. Sintesi e argomenti
  liberi hanno vincoli di parentela che il modello non può violare.
- **Dividi il ramo in concetti** propone un titolo breve e nuovi figli, mantenendo
  ID, stile e figli esistenti. Il testo originale viene aggiunto alle note.
- Espansione, spiegazione, verifica della struttura e schede di ripasso restano
  accessibili da **Studia e approfondisci**.

Applicare un'anteprima è un'unica operazione annullabile. Una risposta obsoleta,
incompleta, duplicata o applicata due volte non può sovrascrivere un'altra scheda.

## Integrazione e limiti di verifica

`ai-studio-core` valida dati e quote; `ai-studio-audio` gestisce registrazione e
trascrizione; `ai-studio-actions` prepara trasformazioni su copie; `ai-studio`
gestisce il pannello. La preparazione distribuisce lo stesso bundle sui tre editor.
Windows e macOS condividono esattamente l'HTML generato.

Il bridge nativo converte l'audio base64 in multipart soltanto verso gli endpoint
di trascrizione Groq/OpenAI, con limiti su dimensione, modello e nome file.
Annullamento e timeout interrompono la rete anche su Android. Il microfono Android
richiede sia il permesso del sistema sia l'origine HTTPS interna; WebKit macOS
ammette solo la pagina locale principale e richiede il consenso del sistema.

La distribuzione pubblica Pro usa un server licenze esterno: per la trascrizione
quel server deve supportare il campo `audio` dell'involucro AI, convertirlo in
multipart e restituire le intestazioni di quota. Il server non è in questo repo;
questa integrazione pubblica non è verificata dalle build private locali.

I test automatici usano risposte simulate: non certificano accuratezza delle
trascrizioni, qualità delle gerarchie o disponibilità del piano di un utente.
Restano da provare con una chiave inserita nell'app: Groq reale, permessi su un
telefono, microfono Windows e build nativa Swift/WebKit su macOS.
