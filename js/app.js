/* Home: legge l'indice JSON e crea automaticamente una card per ogni rack. */
(async function initHome() {
  const list = document.querySelector('#rack-list');
  const status = document.querySelector('#home-status');
  const count = document.querySelector('#rack-count');

  try {
    const response = await fetch('data/racks.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const racks = await response.json();
    if (!Array.isArray(racks) || racks.length === 0) {
      throw new Error('Il file non contiene alcun rack.');
    }

    const validRacks = racks.filter((rack) => rack && rack.id && rack.nome && rack.file);
    if (validRacks.length === 0) throw new Error('Nessuna voce rack è valida.');

    validRacks.forEach((rack) => list.append(createRackCard(rack)));
    count.textContent = `${validRacks.length} ${validRacks.length === 1 ? 'rack' : 'rack'}`;
    status.hidden = true;
  } catch (error) {
    console.error('Impossibile caricare i rack:', error);
    status.className = 'alert alert-error';
    status.innerHTML = '<strong>Impossibile caricare l’elenco dei rack.</strong><br>Controlla <code>data/racks.json</code> e apri il progetto tramite un server locale, non con <code>file://</code>.';
  }

  function createRackCard(rack) {
    const link = document.createElement('a');
    link.className = 'rack-card';
    link.href = `rack.html?id=${encodeURIComponent(rack.id)}`;
    link.setAttribute('aria-label', `Apri ${rack.nome}`);

    const icon = document.createElement('span');
    icon.className = 'rack-card-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = rack.icona || '▥';

    const body = document.createElement('div');
    body.className = 'rack-card-body';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = rack.posizione || 'Posizione non indicata';
    const title = document.createElement('h2');
    title.textContent = rack.nome;
    const description = document.createElement('p');
    description.textContent = rack.descrizione || 'Apri il rack per vedere apparati e connessioni.';
    body.append(eyebrow, title, description);

    const meta = document.createElement('div');
    meta.className = 'rack-card-meta';
    meta.innerHTML = `<span><strong>${safeNumber(rack.numeroApparati)}</strong> apparati</span><span><strong>${safeNumber(rack.numeroPrese)}</strong> prese</span>`;

    const arrow = document.createElement('span');
    arrow.className = 'rack-card-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    link.append(icon, body, meta, arrow);
    return link;
  }

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : '—';
  }
}());
