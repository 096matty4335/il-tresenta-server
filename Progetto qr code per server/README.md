# Documentazione rack di rete

Applicazione web statica per visualizzare rack, apparati, patch panel, switch e collegamenti. È realizzata soltanto con HTML, CSS, JavaScript vanilla e JSON; non usa database, framework o backend.

## Fasi 1–2 · Architettura e cartelle

La home legge l'elenco dei rack da `data/racks.json`. La pagina `rack.html` è unica: il parametro `?id=` stabilisce quale file caricare. Per esempio:

```text
rack.html?id=rack-principale
rack.html?id=rack-fwa
```

Struttura del progetto:

```text
network-rack/
├── index.html
├── rack.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   └── rack.js
├── data/
│   ├── racks.json
│   ├── rack-principale.json
│   └── rack-magazzino.json
└── assets/
    ├── icons/
    └── logo/
```

Le cartelle `assets` sono già predisposte per eventuali immagini future. Il progetto attuale non scarica font, icone o librerie esterne, quindi è veloce e non dipende da servizi di terze parti durante l'uso.

## Fasi 3–9 · File dell'applicazione

- `index.html`: home responsive e contenitore delle card.
- `css/style.css`: tema scuro, rack 19", porte, tabella, modal e stile di stampa.
- `data/racks.json`: indice generale dei rack.
- `rack.html`: vista comune a tutti i rack.
- `js/app.js`: crea automaticamente le card della home.
- `js/rack.js`: carica e controlla i dati, disegna il rack, gestisce ricerca, filtri, collegamenti, modal e stampa.
- `data/rack-principale.json`: disposizione reale del rack principale, con 46 connessioni rete e 9 cavi telecamere.
- `data/rack-magazzino.json`: disposizione reale del Rack Secondario / Magazzino FWA, con patch panel da 16 porte.

Tutti questi file sono già presenti e completi. Non occorre copiare codice da questo documento.

## Fase 10 · Prova sul PC

Non aprire `index.html` con un doppio clic: usando un indirizzo `file://`, il browser può bloccare la lettura dei JSON.

### Metodo A: Python

1. Apri PowerShell nella cartella del progetto.
2. Esegui:

```powershell
python -m http.server 8000
```

3. Apri nel browser `http://localhost:8000/`.
4. Per fermare il server torna in PowerShell e premi `Ctrl+C`.

Se il comando `python` non viene riconosciuto, prova:

```powershell
py -m http.server 8000
```

Questo server serve solo per il test sul PC. Non sarà necessario su GitHub Pages o Cloudflare Pages.

### Metodo B: Visual Studio Code

1. Installa Visual Studio Code.
2. Apri la cartella del progetto con **File → Apri cartella**.
3. Installa l'estensione **Live Server**.
4. Fai clic destro su `index.html` e scegli **Open with Live Server**.

### Controlli manuali consigliati

1. La home deve mostrare due card.
2. Apri entrambi i rack e verifica nome, posizione e unità.
3. Tocca `PP1-01`: deve comparire il dettaglio e deve evidenziarsi `SW1-08`.
4. Cerca `garage`, `EAP610`, `192.168.20.25`, `PP1-12` e `VLAN 20`.
5. Combina due filtri e poi usa **Azzera filtri**.
6. Apri la dorsale in fibra.
7. Prova **Stampa** e seleziona **Salva come PDF**.
8. Dal browser riduci la finestra o usa la modalità dispositivo per simulare uno smartphone.

## Fase 11 · Gestione degli errori

L'applicazione mostra un messaggio leggibile se:

- manca `racks.json` o il JSON del rack;
- l'indirizzo non contiene un ID;
- l'ID non esiste;
- il JSON non è valido;
- il numero di unità non è valido;
- un apparato supera la capacità del rack;
- un componente, una porta o una connessione fa riferimento a un ID inesistente;
- il numero dichiarato di porte non coincide con quelle presenti.

Gli errori critici bloccano la pagina; le incongruenze non critiche vengono mostrate in un riquadro giallo e il resto del rack rimane utilizzabile.

## Fase 12 · Pubblicazione su GitHub Pages

> **Avvertenza:** la procedura seguente pubblica il contenuto su Internet. Non usare dati reali sensibili se il sito non sarà protetto come spiegato nella sezione privacy.

### 1. Creare un account

1. Vai su [github.com](https://github.com/).
2. Seleziona **Sign up**.
3. Inserisci email, password e nome utente, poi completa la verifica.
4. Conferma l'indirizzo email.

### 2. Creare il repository

1. Dopo l'accesso, seleziona il simbolo **+** in alto e poi **New repository**.
2. Usa come nome `network-rack`.
3. Per GitHub Pages gratuito seleziona **Public**.
4. Puoi lasciare disattivate le opzioni che aggiungono README o altri file, perché esistono già.
5. Seleziona **Create repository**.

### 3. Caricare i file dal sito GitHub

1. Nel repository seleziona **Add file → Upload files**.
2. Trascina soltanto `index.html`, `rack.html`, `README.md`, `.nojekyll`, `.gitignore` e le cartelle `css`, `js`, `data`, `assets`.
3. **Non caricare PDF, fogli Excel o file che iniziano con `~$`**: possono contenere dati reali e non fanno parte del sito. Con Git da terminale vengono esclusi automaticamente da `.gitignore`, ma il caricamento manuale dal browser non applica necessariamente questa protezione.
4. Controlla che `index.html` sia nella radice, non dentro una cartella aggiuntiva.
5. Nel campo del commit scrivi `Prima versione documentazione rack`.
6. Seleziona **Commit changes**.

### 4. Attivare Pages

1. Apri **Settings** del repository.
2. Nel menu laterale apri **Pages**.
3. In **Build and deployment**, imposta **Source** su **Deploy from a branch**.
4. Seleziona il branch `main` e la cartella `/(root)`.
5. Seleziona **Save**.
6. Attendi qualche minuto e ricarica la pagina delle impostazioni.

Questi sono i passaggi indicati dalla [documentazione ufficiale di GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). L'indirizzo finale sarà normalmente:

```text
https://NOMEUTENTE.github.io/network-rack/
```

I link specifici saranno:

```text
https://NOMEUTENTE.github.io/network-rack/rack.html?id=rack-principale
https://NOMEUTENTE.github.io/network-rack/rack.html?id=rack-fwa
```

### Aggiornamenti successivi tramite il sito GitHub

1. Apri il file da modificare nel repository.
2. Seleziona l'icona della matita.
3. Modifica il contenuto.
4. Seleziona **Commit changes**, scrivi una breve descrizione e conferma.
5. GitHub Pages ricostruirà automaticamente il sito. Attendi normalmente qualche minuto e ricarica la pagina.

### Alternativa tramite Git

Se in futuro installerai Git, dalla cartella del progetto puoi usare:

```powershell
git init
git add .
git commit -m "Prima versione documentazione rack"
git branch -M main
git remote add origin https://github.com/NOMEUTENTE/network-rack.git
git push -u origin main
```

Per gli aggiornamenti:

```powershell
git add .
git commit -m "Aggiorna mappatura rack"
git push
```

## Fase 13 · Creazione dei QR code

Pubblica prima il sito e prova gli indirizzi finali. Puoi quindi usare la funzione QR integrata nel browser, se disponibile:

1. Apri l'indirizzo da trasformare in QR.
2. In Chrome o Edge fai clic destro sulla pagina.
3. Scegli **Crea codice QR per questa pagina** o la voce equivalente.
4. Scarica l'immagine PNG.
5. Stampa il QR e prova la scansione prima di applicarlo al rack.

Usa il link della home per il QR generale e i link con `?id=` per le etichette dei singoli rack. Se cambi nome utente GitHub o nome del repository, dovrai ristampare i QR.

## Fase 14 · Privacy e autenticazione

### Cosa non protegge il sito

- Un URL lungo o difficile da indovinare non è una protezione.
- `robots.txt` e `noindex` limitano soltanto l'indicizzazione; non bloccano l'accesso.
- Una password scritta in HTML o JavaScript può essere letta o aggirata.
- Rendere privato il repository non rende automaticamente privata una normale pubblicazione web.

GitHub avverte che i siti Pages sono normalmente pubblici anche quando, su piani compatibili, il repository di origine è privato. Il controllo di visibilità privata di Pages è una funzione legata a specifiche configurazioni enterprise; consulta [Creating a GitHub Pages site](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/creating-a-github-pages-site).

### Soluzione consigliata: repository privato + Cloudflare Pages + Access

Questa soluzione mantiene il progetto statico e non richiede un server domestico. Cloudflare agisce da barriera di autenticazione prima di consegnare HTML e JSON.

1. Su GitHub crea il repository come **Private** e autorizza soltanto i tuoi account.
2. Crea un account Cloudflare.
3. In Cloudflare apri **Workers & Pages → Create → Pages → Connect to Git**.
4. Collega GitHub e autorizza soltanto il repository privato interessato.
5. Seleziona il repository e configura:
   - production branch: `main`;
   - framework preset: nessuno;
   - build command: vuoto oppure `exit 0`;
   - output directory: la radice del progetto (`.`), se il pannello la richiede.
6. Avvia il deploy. Cloudflare assegnerà un indirizzo `nomesito.pages.dev` e distribuirà automaticamente i commit successivi. Il flusso senza framework è documentato nella [guida Git di Cloudflare Pages](https://developers.cloudflare.com/pages/get-started/git-integration/) e nella [guida Static HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/).
7. Nel progetto Pages apri **Settings → General → Enable access policy**.
8. Apri la policy creata in **Zero Trust → Access controls → Applications** e configura un'applicazione Access per l'intero hostname.
9. Crea una regola **Allow** limitata al tuo indirizzo email o ai membri del tuo account. Access è un proxy consapevole dell'identità e controlla ogni richiesta prima di inoltrarla, come spiega la [documentazione delle applicazioni web](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/).
10. Usa l'identity provider Cloudflare oppure configura l'invio di un codice monouso all'email autorizzata. La procedura OTP è nella [documentazione Cloudflare](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/).
11. Verifica in una finestra anonima che siano protetti sia `index.html` sia direttamente un JSON, per esempio `data/rack-principale.json`.

**Controllo importante:** la semplice opzione Access di Pages protegge inizialmente le preview, non necessariamente il dominio di produzione. Per coprire anche `progetto.pages.dev`, Cloudflare indica di aprire l'app Access creata e togliere il carattere jolly dal campo del sottodominio. Segui la procedura aggiornata nella pagina ufficiale [Known issues: Enable Access on pages.dev](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain). Prova sempre l'URL `pages.dev` direttamente in navigazione anonima.

Se usi un dominio personale, aggiungilo in **Pages → Custom domains**, proteggi anche quell'hostname con Access e poi impedisci che `pages.dev` resti una via alternativa pubblica. La [documentazione dei domini personalizzati](https://developers.cloudflare.com/pages/configuration/custom-domains/) descrive anche come reindirizzare o disabilitare l'accesso pratico al sottodominio Pages.

Costi e limiti possono cambiare: controlla il piano mostrato nel pannello prima di confermare. Cloudflare dichiara gratuite e illimitate le richieste agli asset statici sui piani Free e Paid nella sua [pagina prezzi Pages](https://developers.cloudflare.com/pages/functions/pricing/); eventuali dominio, funzioni o funzionalità Zero Trust avanzate possono avere costi propri.

### Altre possibilità

- **GitHub Enterprise Cloud con Pages privato:** adatto soprattutto a organizzazioni già dotate del piano; generalmente eccessivo per un progetto domestico.
- **VPN/Tailscale e dispositivo domestico:** offre buona privacy ma richiede un host sempre acceso, in contrasto con il requisito di non avere un server domestico.
- **Cifratura dei dati nel browser:** possibile, ma introduce gestione delle chiavi e può lasciare metadati o codice visibili. Non è una sostituzione ideale di Access.

Per dati reali di rete, la raccomandazione è non pubblicare la versione sensibile su GitHub Pages pubblico. Mantieni eventualmente una copia dimostrativa pubblica e la copia reale in un repository privato dietro Cloudflare Access.

## Fase 15 · Manutenzione dei dati

### Struttura dei rack basati su `layout`

Entrambi i rack separano volutamente i **collegamenti logici** dalle **posizioni fisiche**:

- `collegamentiLogici` contiene `RETE-01…RETE-46` e `TLC-01…TLC-09` nel Rack Principale, `MAG-01…MAG-16` nel Rack Secondario;
- `patchPanels[].porte` descrive le posizioni fisiche dei pannelli;
- ogni porta fisica usa `collegamentoId` per indicare quale collegamento logico ospita;
- `layout` stabilisce l'ordine grafico degli apparati dall'alto verso il basso.

Per cambiare soltanto una destinazione, modifica l'oggetto corrispondente in `collegamentiLogici`:

```json
{
  "id": "RETE-07",
  "numeroLogico": 7,
  "gruppo": "rete",
  "destinazione": "Access Point soggiorno P1",
  "patchPanel": "pp1",
  "portaFisica": 7,
  "posizioneOriginale": "PP1-07",
  "migrato": false,
  "stato": "used",
  "note": ""
}
```

Gli ID dei due gruppi devono restare distinti: `RETE-01` e `TLC-01` sono due collegamenti diversi e non devono mai essere rinominati entrambi come `01`.

`configurazioneConnessioni.rete.tutteCollegateASwitch` indica che tutte le 46 connessioni di rete arrivano a uno switch anche quando la distribuzione precisa non è documentata. Quando lo switch è noto, il relativo collegamento contiene:

```json
"switchId": "switch-1",
"portaSwitch": null
```

`portaSwitch: null` significa che lo switch è conosciuto ma il numero della porta non è ancora stato rilevato. Non sostituire `null` con un numero casuale: inserisci il numero soltanto dopo una verifica fisica.

La connessione `RETE-26` è un esempio di migrazione fisica. Conserva `portaFisica: null` finché non sarà noto il numero effettivo sul Patch Panel Telecamere. `PP2-26` rimane una posizione fisica vuota con `riferimentoMigrato: "RETE-26"`.

Per cambiare l'ordine fisico, sposta gli oggetti nell'array `layout`. I riferimenti `component` puntano a patch panel o switch; `device` punta a un apparato. Un ripiano può usare `items` per contenere apparati e switch nello stesso livello. Non è necessario modificare HTML o JavaScript.

### Modificare un collegamento del Rack Secondario

Modifica la voce corrispondente in `data/rack-magazzino.json`. Per esempio:

```json
{
  "id": "MAG-09",
  "numeroLogico": 9,
  "gruppo": "magazzino",
  "destinazione": "AP MAGAZZINO",
  "patchPanel": "pp-magazzino",
  "portaFisica": 9,
  "switchId": "switch-rete-ap",
  "portaSwitch": null,
  "poe": "SI",
  "stato": "used"
}
```

`portaSwitch: null` conserva l'associazione allo switch senza inventare il numero fisico. Le porte 3 e 15 sono invece documentate come collegamenti dell'injector FWA. La connessione rete/Home Assistant dell'ESP32 si compila nel campo `connessioneRete` dell'apparato `domotica-esp32`.

### Modificare il collegamento patch → switch

Nella sezione `connessioni` del JSON cerca la connessione interessata:

```json
{
  "id": "c-pp1-01",
  "da": { "apparato": "pp1", "porta": "PP1-01" },
  "a": { "apparato": "sw1", "porta": "SW1-08" },
  "tipoCavo": "Patch Cat.6 verde",
  "note": ""
}
```

Per spostare la presa sulla porta 12 dello switch, cambia soltanto `SW1-08` in `SW1-12`. Entrambi gli ID devono esistere nelle rispettive liste `porte`.

### Modificare una porta switch

Trova la porta in `switches[].porte` e aggiorna stato, PoE, VLAN, ruolo o etichetta. Per lo switch sono riconosciuti anche:

- `ruolo: "uplink"` per il colore uplink;
- `tipo: "SFP"` o `ruolo: "fibra"` per una porta ottica;
- `stato: "fault"` per una porta guasta.

### Aggiungere un apparato

Inserisci un oggetto in `apparati`:

```json
{
  "id": "dev-nas",
  "nome": "NAS",
  "tipo": "nas",
  "posizioneU": 5,
  "altezzaU": 2,
  "produttore": "Esempio",
  "modello": "NAS 4 bay",
  "ip": "192.168.10.50",
  "descrizione": "Archivio di rete",
  "note": "Backup settimanale"
}
```

`posizioneU` è l'unità inferiore occupata. Un dispositivo con `posizioneU: 5` e `altezzaU: 2` occupa U5–U6. Non sovrapporlo ad altri apparati.

Nel Rack Principale, che usa `layout`, `posizioneU` non serve: aggiungi l'apparato a `apparati` e poi inserisci il suo ID in un elemento `device` o `shelf` dell'array `layout`.

Tipi pronti: `patch-panel`, `switch`, `router`, `fiber`, `ups`, `pdu`, `organizer`, `shelf`, `nvr`, `nas`, `controller`, `modem` e `generic`. Usa `generic` per qualsiasi elemento non previsto.

Patch panel e switch richiedono anche un oggetto nella rispettiva sezione e il campo `componente`, per esempio `"componente": "pp2"`.

### Aggiungere un collegamento in fibra tra rack

Inserisci un oggetto in `collegamentiEsterni` con origine, destinazione, cavo, fibra, colore, connettore e porte. È una scheda informativa e non richiede che l'altro rack sia caricato nello stesso momento.

### Aggiungere un nuovo rack

1. Copia uno dei JSON esistenti, per esempio come `data/rack-terzo.json`.
2. Cambia `rack.id`, nome, posizione, capacità e contenuto.
3. Aggiungi una voce a `data/racks.json`:

```json
{
  "id": "rack-terzo",
  "nome": "Rack 3",
  "descrizione": "Descrizione del nuovo rack",
  "posizione": "Nuova posizione",
  "icona": "▥",
  "numeroApparati": 0,
  "numeroPrese": 0,
  "file": "rack-terzo.json"
}
```

4. Salva, prova localmente e pubblica il commit. La nuova card apparirà automaticamente nella home.

### Regole JSON importanti

- Usa doppi apici, non apici singoli.
- Separa gli elementi con una virgola, ma non mettere una virgola dopo l'ultimo elemento.
- Ogni ID di apparato e porta deve essere univoco nel proprio rack.
- Aggiorna `ultimoAggiornamento` nel formato `AAAA-MM-GG`.
- Dopo una modifica ricarica forzatamente la pagina con `Ctrl+F5` se il browser mostra ancora dati vecchi.
- Prima della pubblicazione puoi controllare la sintassi incollando il JSON in un validatore, evitando però servizi online se contiene informazioni riservate.

## Limiti intenzionali della prima versione

Il sito è in sola lettura: per modificare i dati si interviene sui JSON. Questa scelta mantiene il progetto semplice, portabile e compatibile con hosting statici. Un editor direttamente nel browser richiederebbe un sistema sicuro di salvataggio e autenticazione, quindi non è stato aggiunto alla versione statica.
