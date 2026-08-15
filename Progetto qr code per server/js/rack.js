/*
 * Pagina rack: carica i JSON, disegna l'armadio, collega le porte e genera
 * ricerca, filtri, tabella e finestre di dettaglio senza dipendenze esterne.
 */
(function () {
  'use strict';

  const STATUS = {
    used: 'Utilizzata', free: 'Libera', reserved: 'Riservata', fault: 'Guasta',
    unavailable: 'Non disponibile', unknown: 'Da rilevare', poe: 'PoE attivo', uplink: 'Uplink', fiber: 'Fibra / SFP'
  };
  const EMPTY = '—';
  const state = {
    catalogEntry: null, data: null, components: new Map(), ports: new Map(),
    connectionsByPort: new Map(), logicalConnections: new Map(), outletRows: [], warnings: []
  };

  const elements = {
    pageStatus: document.querySelector('#page-status'), pageError: document.querySelector('#page-error'),
    rackContent: document.querySelector('#rack-content'), rackFrame: document.querySelector('#rack-frame'),
    legend: document.querySelector('#port-legend'), tableBody: document.querySelector('#outlet-table-body'),
    emptyTable: document.querySelector('#empty-table'), tableCount: document.querySelector('#table-count'),
    filterResult: document.querySelector('#filter-result'), warnings: document.querySelector('#data-warnings'),
    detailDialog: document.querySelector('#detail-dialog'), infoDialog: document.querySelector('#info-dialog')
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    bindStaticActions();
    const rackId = new URLSearchParams(location.search).get('id');
    if (!rackId) return showFatalError('Nessun rack specificato nell’indirizzo. Torna alla home e scegli un rack.');

    try {
      const catalog = await fetchJson('data/racks.json');
      if (!Array.isArray(catalog)) throw new Error('data/racks.json non contiene un elenco valido.');
      state.catalogEntry = catalog.find((item) => item && item.id === rackId);
      if (!state.catalogEntry) return showFatalError(`Il rack “${rackId}” non esiste nell’elenco data/racks.json.`);

      const safeFile = String(state.catalogEntry.file || '').replace(/^data[\\/]/, '');
      if (!safeFile || safeFile.includes('..')) throw new Error('Il nome del file dati del rack non è valido.');
      state.data = await fetchJson(`data/${safeFile}`);
      validateAndIndexData();
      renderPage();
      elements.pageStatus.hidden = true;
      elements.rackContent.hidden = false;
      document.title = `${state.data.rack.nome} · Home rete`;
    } catch (error) {
      console.error(error);
      showFatalError(`Impossibile caricare i dati del rack. ${error.message}`);
    }
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`File “${path}” non disponibile (errore ${response.status}).`);
    try { return await response.json(); }
    catch { throw new Error(`Il file “${path}” contiene JSON non valido.`); }
  }

  function validateAndIndexData() {
    const data = state.data;
    if (!data || typeof data !== 'object' || !data.rack) throw new Error('La sezione “rack” è mancante.');
    if (!data.rack.nome) throw new Error('Il nome del rack è mancante.');
    const hasLayout = Array.isArray(data.layout) && data.layout.length > 0;
    data.layout = hasLayout ? data.layout : [];
    if (!hasLayout) {
      data.rack.unita = Number(data.rack.unita);
      if (!Number.isInteger(data.rack.unita) || data.rack.unita < 1 || data.rack.unita > 60) {
        throw new Error('Il numero di unità rack deve essere un intero compreso tra 1 e 60.');
      }
    }

    data.apparati = Array.isArray(data.apparati) ? data.apparati : [];
    data.patchPanels = Array.isArray(data.patchPanels) ? data.patchPanels : [];
    data.switches = Array.isArray(data.switches) ? data.switches : [];
    data.connessioni = Array.isArray(data.connessioni) ? data.connessioni : [];
    data.collegamentiEsterni = Array.isArray(data.collegamentiEsterni) ? data.collegamentiEsterni : [];
    data.collegamentiLogici = Array.isArray(data.collegamentiLogici) ? data.collegamentiLogici : [];
    data.configurazioneConnessioni = data.configurazioneConnessioni && typeof data.configurazioneConnessioni === 'object'
      ? data.configurazioneConnessioni : {};

    for (const logical of data.collegamentiLogici) {
      if (!logical.id) { state.warnings.push('È presente un collegamento logico senza ID.'); continue; }
      if (state.logicalConnections.has(logical.id)) state.warnings.push(`ID logico duplicato: ${logical.id}.`);
      state.logicalConnections.set(logical.id, logical);
    }

    for (const component of [...data.patchPanels, ...data.switches]) {
      if (!component.id) { state.warnings.push('È presente un componente senza ID: non verrà collegato.'); continue; }
      if (state.components.has(component.id)) state.warnings.push(`ID componente duplicato: ${component.id}.`);
      state.components.set(component.id, component);
      component.porte = Array.isArray(component.porte) ? component.porte : [];
      for (const port of component.porte) {
        if (!port.id) { state.warnings.push(`Porta senza ID in ${component.id}.`); continue; }
        const key = portKey(component.id, port.id);
        if (state.ports.has(key)) state.warnings.push(`Porta duplicata: ${component.id} / ${port.id}.`);
        state.ports.set(key, { component, port });
      }
      const declared = Number(component.numeroPorte);
      if (declared && declared !== component.porte.length) {
        state.warnings.push(`${component.nome || component.id}: dichiarate ${declared} porte, ma trovate ${component.porte.length}.`);
      }
    }

    for (const component of data.patchPanels) {
      component.porte.forEach((port) => {
        const logicalId = port.collegamentoId || port.riferimentoMigrato;
        if (logicalId && !state.logicalConnections.has(logicalId)) {
          state.warnings.push(`${component.nome}: riferimento logico “${logicalId}” inesistente.`);
        }
      });
    }

    for (const logical of data.collegamentiLogici) {
      const panel = state.components.get(logical.patchPanel);
      if (!panel || !data.patchPanels.includes(panel)) {
        state.warnings.push(`${logical.id}: patch panel attuale “${logical.patchPanel || ''}” inesistente.`);
        continue;
      }
      if (logical.portaFisica !== null && logical.portaFisica !== undefined) {
        const physical = panel.porte.find((port) => Number(port.numero) === Number(logical.portaFisica));
        if (!physical) state.warnings.push(`${logical.id}: porta fisica ${logical.portaFisica} inesistente su ${panel.nome}.`);
        else if (physical.collegamentoId !== logical.id) state.warnings.push(`${logical.id}: la porta fisica indicata è associata a “${physical.collegamentoId || 'nessun collegamento'}”.`);
      } else if (!logical.migrato) {
        state.warnings.push(`${logical.id}: porta fisica non specificata senza indicazione di migrazione.`);
      }
      if (logical.switchId) {
        const switchComponent = state.components.get(logical.switchId);
        if (!switchComponent || !data.switches.includes(switchComponent)) {
          state.warnings.push(`${logical.id}: switch “${logical.switchId}” inesistente.`);
        } else if (logical.portaSwitch !== null && logical.portaSwitch !== undefined &&
          !switchComponent.porte.some((port) => Number(port.numero) === Number(logical.portaSwitch))) {
          state.warnings.push(`${logical.id}: porta switch ${logical.portaSwitch} inesistente su ${switchComponent.nome}.`);
        }
      }
    }

    for (const device of data.apparati) {
      if (hasLayout) continue;
      const position = Number(device.posizioneU);
      const height = Number(device.altezzaU || 1);
      if (!device.id || !Number.isInteger(position) || !Number.isInteger(height) || height < 1 || position < 1 || position + height - 1 > data.rack.unita) {
        state.warnings.push(`Apparato “${device.nome || 'senza nome'}” con posizione o altezza non valida.`);
      }
      if (device.componente && !state.components.has(device.componente)) {
        state.warnings.push(`${device.nome}: componente “${device.componente}” inesistente.`);
      }
    }

    if (hasLayout) validateLayoutReferences();

    for (const connection of data.connessioni) {
      const fromKey = endpointKey(connection.da);
      const toKey = endpointKey(connection.a);
      if (!fromKey || !state.ports.has(fromKey)) {
        state.warnings.push(`Connessione ${connection.id || 'senza ID'}: porta di origine inesistente.`);
        continue;
      }
      if (!toKey || !state.ports.has(toKey)) {
        state.warnings.push(`Connessione ${connection.id || 'senza ID'}: porta di destinazione inesistente.`);
        continue;
      }
      state.connectionsByPort.set(fromKey, { connection, otherKey: toKey });
      state.connectionsByPort.set(toKey, { connection, otherKey: fromKey });
    }
    state.outletRows = buildOutletRows();
  }

  function buildOutletRows() {
    if (state.data.collegamentiLogici.length) {
      return state.data.collegamentiLogici.map((logical) => {
        const panel = state.components.get(logical.patchPanel) || null;
        const physicalPort = panel && logical.portaFisica !== null && logical.portaFisica !== undefined
          ? panel.porte.find((port) => Number(port.numero) === Number(logical.portaFisica))
          : null;
        const outlet = {
          ...logical,
          presaMuro: physicalLocation(logical),
          stato: logical.stato || 'used'
        };
        const switchComponent = logical.switchId ? state.components.get(logical.switchId) || null : null;
        const switchPort = switchComponent && logical.portaSwitch !== null && logical.portaSwitch !== undefined
          ? switchComponent.porte.find((port) => Number(port.numero) === Number(logical.portaSwitch)) || null
          : null;
        const connectedToSwitch = isLogicalConnectedToSwitch(logical);
        const row = {
          key: physicalPort ? portKey(panel.id, physicalPort.id) : '',
          panel, physicalPort, logical, port: outlet, connection: null,
          switchComponent, switchPort, connectedToSwitch,
          switchFilterId: switchComponent?.id || (connectedToSwitch ? 'non-documentato' : '')
        };
        row.searchText = normalizeText([
          logical.id, logical.numeroLogico, logical.gruppo, logical.destinazione,
          logical.patchPanel, logical.portaFisica, physicalLocation(logical),
          logical.posizioneOriginale, logical.migrato ? 'migrato' : '', logical.note,
          switchComponent?.id, switchComponent?.nome,
          connectedToSwitch ? 'collegato switch' : '',
          switchComponent && !switchPort ? 'porta switch non specificata' : '', switchPort?.id
        ].join(' '));
        return row;
      });
    }
    const rows = [];
    for (const panel of state.data.patchPanels) {
      for (const port of panel.porte) {
        const key = portKey(panel.id, port.id);
        const link = state.connectionsByPort.get(key);
        const other = link ? state.ports.get(link.otherKey) : null;
        const switchComponent = other && state.data.switches.find((item) => item.id === other.component.id);
        const row = {
          key, panel, port, connection: link?.connection || null,
          switchComponent: switchComponent || null, switchPort: switchComponent ? other.port : null,
          connectedToSwitch: Boolean(switchComponent), switchFilterId: switchComponent?.id || ''
        };
        row.searchText = normalizeText([
          panel.id, panel.nome, port.id, port.numero, port.destinazione, port.presaMuro,
          port.dispositivo, port.poe, port.vlan, port.vlan ? `VLAN ${port.vlan}` : '', port.ip, port.tipoCollegamento, port.stato,
          port.note, switchComponent?.id, switchComponent?.nome, other?.port?.id,
          other?.port?.numero, link?.connection?.tipoCavo, link?.connection?.note
        ].join(' '));
        rows.push(row);
      }
    }
    return rows;
  }

  function validateLayoutReferences() {
    const deviceIds = new Set(state.data.apparati.map((device) => device.id));
    state.data.layout.forEach((item, index) => {
      if (['patchPanel', 'switch'].includes(item.type) && !state.components.has(item.component)) {
        state.warnings.push(`Layout ${index + 1}: componente “${item.component || ''}” inesistente.`);
      }
      if ((item.type === 'device' || item.type === 'pdu') && !deviceIds.has(item.device)) {
        state.warnings.push(`Layout ${index + 1}: apparato “${item.device || ''}” inesistente.`);
      }
      if (item.type === 'shelf') {
        (item.devices || []).forEach((id) => {
          if (!deviceIds.has(id)) state.warnings.push(`Layout ${index + 1}: apparato ripiano “${id}” inesistente.`);
        });
        (item.items || []).forEach((entry) => {
          if (entry.type === 'device' && !deviceIds.has(entry.id)) state.warnings.push(`Layout ${index + 1}: apparato ripiano “${entry.id}” inesistente.`);
          if (entry.type === 'switch' && !state.components.has(entry.component)) state.warnings.push(`Layout ${index + 1}: switch ripiano “${entry.component}” inesistente.`);
        });
      }
    });
  }

  function renderPage() {
    const rack = state.data.rack;
    setText('#nav-rack-name', rack.nome);
    setText('#rack-title', rack.nome);
    setText('#rack-description', rack.descrizione || 'Nessuna descrizione disponibile.');
    setText('#rack-location', rack.posizione || EMPTY);
    if (rack.dimensioni) {
      setText('#rack-size-label', 'Dimensioni');
      setText('#rack-units', `${rack.dimensioni.larghezza} × ${rack.dimensioni.profondita} × ${rack.dimensioni.altezza} cm`);
    } else {
      setText('#rack-size-label', 'Capacità');
      setText('#rack-units', `${rack.unita}U`);
    }
    setText('#rack-updated', formatDate(rack.ultimoAggiornamento));
    renderWarnings();
    renderRack();
    renderLegend();
    renderExternalLinks();
    populateFilters();
    applyFilters();
    renderPrintEquipment();
  }

  function renderWarnings() {
    if (!state.warnings.length) return;
    elements.warnings.hidden = false;
    elements.warnings.innerHTML = `<strong>Alcuni dati richiedono attenzione:</strong><ul>${state.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>`;
  }

  function renderRack() {
    if (state.data.layout.length) {
      renderLayoutRack();
      return;
    }
    const units = state.data.rack.unita;
    elements.rackFrame.style.gridTemplateRows = `repeat(${units}, var(--rack-unit))`;
    elements.rackFrame.setAttribute('aria-label', `${state.data.rack.nome}, ${units} unità`);

    for (let unit = units; unit >= 1; unit -= 1) {
      const row = units - unit + 1;
      const left = createElement('span', 'rack-unit-label left', `U${unit}`);
      const space = createElement('span', 'rack-unit-space');
      const right = createElement('span', 'rack-unit-label right', `U${unit}`);
      [left, space, right].forEach((element) => { element.style.gridRow = String(row); });
      elements.rackFrame.append(left, space, right);
    }

    const devices = [...state.data.apparati].sort((a, b) => Number(b.posizioneU) - Number(a.posizioneU));
    for (const device of devices) {
      const position = Number(device.posizioneU);
      const height = Number(device.altezzaU || 1);
      if (!Number.isInteger(position) || !Number.isInteger(height) || position < 1 || height < 1 || position + height - 1 > units) continue;
      const topUnit = position + height - 1;
      const row = units - topUnit + 1;
      const element = renderDevice(device);
      element.style.gridRow = `${row} / span ${height}`;
      elements.rackFrame.append(element);
    }
  }

  function renderLayoutRack() {
    elements.rackFrame.classList.add('layout-mode');
    elements.rackFrame.setAttribute('aria-label', `${state.data.rack.nome}, disposizione fisica dall’alto verso il basso`);
    state.data.layout.forEach((item, index) => {
      const rendered = renderLayoutItem(item);
      if (rendered) {
        rendered.dataset.layoutOrder = String(index + 1);
        elements.rackFrame.append(rendered);
      }
    });
  }

  function renderLayoutItem(item) {
    if (item.type === 'fans') {
      const fans = createElement('article', 'rack-device layout-device rack-fans');
      const fanCount = Math.max(1, Math.min(6, Number(item.quantita) || 3));
      fans.innerHTML = `<div class="rack-device-header"><span class="device-light"></span><strong>${escapeHtml(item.name || 'Ventole rack')}</strong><span>${fanCount} ventole</span></div><div class="fan-bank" aria-hidden="true">${'<span></span>'.repeat(fanCount)}</div>`;
      return fans;
    }
    if (item.type === 'cableManager') {
      const manager = createElement('article', 'rack-device layout-device layout-cable-manager');
      manager.dataset.type = 'organizer';
      manager.innerHTML = `<div class="rack-device-header"><span class="device-light"></span><strong>${escapeHtml(item.name || 'Passacavi')}</strong><span>Organizzazione cavi</span></div>`;
      return manager;
    }
    if (item.type === 'patchPanel' || item.type === 'switch') {
      const component = state.components.get(item.component);
      if (!component) return null;
      const device = createElement('article', 'rack-device layout-device');
      device.dataset.type = item.type === 'patchPanel' ? 'patch-panel' : 'switch';
      device.dataset.componentId = component.id;
      if (component.poe) device.classList.add('is-poe-device');
      const suffix = component.numeroPortePoe
        ? `${component.numeroPorte} porte · ${component.numeroPortePoe} PoE / ${component.numeroPorte - component.numeroPortePoe} LAN`
        : component.poe ? `${component.numeroPorte} porte · PoE` : `${component.numeroPorte} porte`;
      device.innerHTML = `<div class="rack-device-header"><span class="device-light"></span><strong>${escapeHtml(component.nome)}</strong><span>${escapeHtml(suffix)}</span></div>`;
      device.append(renderPortBank(component, device.dataset.type));
      if (component.avviso) device.append(createElement('p', 'component-note', component.avviso));
      (component.collegamentiSenzaPosizione || []).forEach((logicalId) => {
        const logical = state.logicalConnections.get(logicalId);
        if (!logical) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'migrated-link';
        button.dataset.logicalId = logicalId;
        button.textContent = `${logicalId} · migrato, posizione fisica da specificare`;
        button.addEventListener('click', () => openLogicalDetails(logical));
        device.append(button);
      });
      return device;
    }
    if (item.type === 'shelf') return renderShelf(item);
    if (item.type === 'device' || item.type === 'pdu') {
      const device = state.data.apparati.find((entry) => entry.id === item.device);
      return device ? renderStandaloneDevice(device, item.type === 'pdu') : null;
    }
    return null;
  }

  function renderShelf(item) {
    const shelf = createElement('article', 'rack-device layout-device rack-shelf');
    shelf.dataset.type = 'shelf';
    const entries = item.items || (item.devices || []).map((id) => ({ type: 'device', id }));
    shelf.innerHTML = `<div class="rack-device-header"><span class="device-light"></span><strong>${escapeHtml(item.name || 'Ripiano')}</strong><span>${escapeHtml(`${entries.length} apparati`)}</span></div>`;
    const devices = createElement('div', 'shelf-devices');
    devices.style.setProperty('--shelf-columns', String(Math.max(1, entries.length)));
    entries.forEach((entry) => {
      if (entry.type === 'switch') {
        const component = state.components.get(entry.component);
        if (!component) return;
        const switchBox = createElement('div', 'shelf-device shelf-switch');
        switchBox.dataset.componentId = component.id;
        switchBox.innerHTML = `<div class="shelf-switch-title"><span aria-hidden="true">⇄</span><strong>${escapeHtml(component.nome)}</strong><small>${escapeHtml(component.descrizione || `${component.numeroPorte} porte`)}</small></div>`;
        switchBox.append(renderPortBank(component, 'switch'));
        if (component.avviso) switchBox.append(createElement('p', 'component-note', component.avviso));
        devices.append(switchBox);
        return;
      }
      const device = state.data.apparati.find((candidate) => candidate.id === entry.id);
      if (!device) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shelf-device';
      button.innerHTML = `<span aria-hidden="true">${deviceIcon(device.tipo)}</span><strong>${escapeHtml(device.nome)}</strong><small>${escapeHtml(device.descrizione || labelForType(device.tipo))}</small>`;
      if (Array.isArray(device.connessioni) && device.connessioni.length) {
        const links = createElement('span', 'device-links');
        links.textContent = device.connessioni.map((connection) => `${connection.porta}: ${connection.collegamentoId}`).join(' · ');
        button.append(links);
      }
      button.addEventListener('click', () => openDeviceDetails(device));
      devices.append(button);
    });
    shelf.append(devices, createElement('div', 'shelf-edge', 'RIPIANO'));
    return shelf;
  }

  function renderStandaloneDevice(device, isPdu) {
    const wrapper = createElement('article', 'rack-device layout-device standalone-device');
    wrapper.dataset.type = device.tipo || 'generic';
    wrapper.innerHTML = `<div class="rack-device-header"><span class="device-light"></span><strong>${escapeHtml(device.nome)}</strong><span>${escapeHtml(isPdu ? `${device.numeroPrese || 0} prese` : labelForType(device.tipo))}</span></div>`;
    if (isPdu) {
      const sockets = createElement('div', 'power-sockets');
      (device.prese || []).forEach((socket) => {
        const visual = createElement('span', 'power-socket', padPort(socket.numero));
        visual.title = `${socket.id}: presa elettrica ${socket.stato || 'non specificata'}`;
        sockets.append(visual);
      });
      wrapper.append(sockets);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'device-open compact';
    button.textContent = device.descrizione || 'Apri dettagli apparato';
    button.addEventListener('click', () => openDeviceDetails(device));
    wrapper.append(button);
    return wrapper;
  }

  function renderDevice(device) {
    const wrapper = createElement('article', 'rack-device');
    wrapper.dataset.type = device.tipo || 'generic';
    wrapper.dataset.deviceId = device.id || '';
    wrapper.setAttribute('aria-label', `${device.nome}, U${device.posizioneU}${Number(device.altezzaU) > 1 ? `–U${Number(device.posizioneU) + Number(device.altezzaU) - 1}` : ''}`);
    const header = document.createElement('div');
    header.className = 'rack-device-header';
    header.innerHTML = `<span class="device-light" aria-hidden="true"></span><strong>${escapeHtml(device.nome || 'Apparato')}</strong><span>${escapeHtml(`${device.altezzaU || 1}U`)}</span>`;
    wrapper.append(header);

    const component = device.componente ? state.components.get(device.componente) : null;
    if (component && (device.tipo === 'patch-panel' || device.tipo === 'switch')) {
      wrapper.append(renderPortBank(component, device.tipo));
    } else {
      const button = document.createElement('button');
      button.className = 'device-open';
      button.type = 'button';
      button.innerHTML = `<p class="device-description">${escapeHtml(device.descrizione || device.modello || labelForType(device.tipo))}</p>`;
      button.addEventListener('click', () => openDeviceDetails(device));
      wrapper.append(button);
    }
    return wrapper;
  }

  function renderPortBank(component, type) {
    const bank = document.createElement('div');
    bank.className = 'port-bank';
    const count = component.porte.length;
    bank.style.setProperty('--port-columns', String(count <= 8 ? count : count <= 16 ? 8 : count <= 24 ? 12 : 16));
    component.porte.forEach((port) => {
      const button = document.createElement('button');
      const key = portKey(component.id, port.id);
      const logical = state.logicalConnections.get(port.collegamentoId || port.riferimentoMigrato || '');
      const displayData = logical ? { ...logical, ...port, stato: port.stato || logical.stato } : port;
      button.className = 'port';
      button.type = 'button';
      button.dataset.portKey = key;
      button.dataset.status = visualStatus(displayData, type);
      button.textContent = padPort(port.numero);
      const identifier = logical?.id || port.id;
      const description = logical?.destinazione || STATUS[button.dataset.status] || port.stato || 'Stato non indicato';
      button.title = `${identifier}: ${description}`;
      button.setAttribute('aria-label', `${identifier}, ${description}`);
      button.addEventListener('click', () => openPortDetails(component, port));
      bank.append(button);
    });
    return bank;
  }

  function renderLegend() {
    const entries = [
      ['used', 'Utilizzata'], ['free', 'Libera'], ['reserved', 'Riservata'],
      ['fault', 'Guasta'], ['unavailable', 'Non disponibile'], ['unknown', 'Da rilevare'], ['poe', 'PoE attivo'],
      ['uplink', 'Uplink'], ['fiber', 'Fibra / SFP']
    ];
    entries.forEach(([status, label]) => {
      const item = createElement('span', 'legend-item');
      item.innerHTML = `<span class="status-dot" data-status="${status}" aria-hidden="true"></span>${label}`;
      elements.legend.append(item);
    });
  }

  function renderExternalLinks() {
    if (!state.data.collegamentiEsterni.length) return;
    document.querySelector('#external-links-section').hidden = false;
    const container = document.querySelector('#external-links');
    state.data.collegamentiEsterni.forEach((link) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'connection-card';
      button.innerHTML = `<span class="connection-icon" aria-hidden="true">⌁</span><span><strong>${escapeHtml(link.nome || 'Collegamento esterno')}</strong><small>${escapeHtml(link.origine || EMPTY)} → ${escapeHtml(link.destinazione || EMPTY)}</small></span><span class="connection-arrow" aria-hidden="true">→</span>`;
      button.addEventListener('click', () => openExternalLink(link));
      container.append(button);
    });
  }

  function populateFilters() {
    fillSelect('#filter-room', uniqueValues(state.outletRows.map((row) => row.port.destinazione)));
    fillSelect('#filter-device', uniqueValues(state.outletRows.map((row) => row.port.dispositivo)));
    fillSelect('#filter-vlan', uniqueValues(state.outletRows.map((row) => row.port.vlan).filter(Boolean).map(String)), 'VLAN ');
    fillSelect('#filter-status', uniqueValues(state.outletRows.map((row) => row.port.stato)), '', (value) => STATUS[value] || value);
    fillSelect('#filter-switch', uniqueValues(state.outletRows.map((row) => row.switchFilterId)), '', (value) => {
      if (value === 'non-documentato') return 'Collegato · switch non documentato';
      return state.components.get(value)?.nome || value;
    });
  }

  function fillSelect(selector, values, prefix = '', labelFormatter = (value) => value) {
    const select = document.querySelector(selector);
    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = normalizeText(value);
      option.textContent = `${prefix}${labelFormatter(value)}`;
      select.append(option);
    });
  }

  function bindStaticActions() {
    const filterElements = ['#search-input', '#filter-room', '#filter-device', '#filter-vlan', '#filter-poe', '#filter-status', '#filter-switch'];
    filterElements.forEach((selector) => document.querySelector(selector).addEventListener('input', applyFilters));
    document.querySelector('#reset-filters').addEventListener('click', () => {
      filterElements.forEach((selector) => { document.querySelector(selector).value = ''; });
      applyFilters();
      document.querySelector('#search-input').focus();
    });
    document.querySelector('#print-button').addEventListener('click', () => window.print());
    document.querySelector('#info-button').addEventListener('click', () => showDialog(elements.infoDialog));
    elements.detailDialog.addEventListener('close', clearHighlights);
    elements.detailDialog.addEventListener('click', closeOnBackdrop);
    elements.infoDialog.addEventListener('click', closeOnBackdrop);
  }

  function applyFilters() {
    if (!state.data) return;
    const filters = {
      query: normalizeText(document.querySelector('#search-input').value),
      room: document.querySelector('#filter-room').value,
      device: document.querySelector('#filter-device').value,
      vlan: document.querySelector('#filter-vlan').value,
      poe: document.querySelector('#filter-poe').value,
      status: document.querySelector('#filter-status').value,
      switchId: document.querySelector('#filter-switch').value
    };
    const visibleRows = state.outletRows.filter((row) => {
      const poe = normalizeText(row.port.poe);
      return (!filters.query || row.searchText.includes(filters.query)) &&
        (!filters.room || normalizeText(row.port.destinazione) === filters.room) &&
        (!filters.device || normalizeText(row.port.dispositivo) === filters.device) &&
        (!filters.vlan || normalizeText(row.port.vlan) === filters.vlan) &&
        (!filters.poe || poe === filters.poe) &&
        (!filters.status || normalizeText(row.port.stato) === filters.status) &&
        (!filters.switchId || normalizeText(row.switchFilterId) === filters.switchId);
    });
    renderTable(visibleRows);
    updateRackFiltering(visibleRows, filters);
    const total = state.outletRows.length;
    elements.filterResult.textContent = `${visibleRows.length} prese visualizzate su ${total}`;
    elements.tableCount.textContent = `${visibleRows.length} / ${total}`;
  }

  function updateRackFiltering(visibleRows, filters) {
    const filtering = Object.values(filters).some(Boolean);
    const visiblePatchKeys = new Set(visibleRows.map((row) => row.key).filter(Boolean));
    const visibleLogicalIds = new Set(visibleRows.map((row) => row.logical?.id).filter(Boolean));
    const visibleAllKeys = new Set(visiblePatchKeys);
    visiblePatchKeys.forEach((key) => {
      const link = state.connectionsByPort.get(key);
      if (link) visibleAllKeys.add(link.otherKey);
    });
    document.querySelectorAll('.port').forEach((button) => {
      button.classList.toggle('is-filtered-out', filtering && !visibleAllKeys.has(button.dataset.portKey));
    });
    document.querySelectorAll('.migrated-link').forEach((button) => {
      button.classList.toggle('is-filtered-out', filtering && !visibleLogicalIds.has(button.dataset.logicalId));
    });
  }

  function renderTable(rows) {
    elements.tableBody.replaceChildren();
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.tabIndex = 0;
      tr.innerHTML = [
        `<td class="table-port">${escapeHtml(row.port.id)}</td>`,
        `<td>${value(row.port.destinazione)}</td>`, `<td>${value(row.port.presaMuro)}</td>`,
        `<td>${row.switchComponent ? escapeHtml(row.switchComponent.nome) : (row.connectedToSwitch ? 'Collegato · non documentato' : EMPTY)}</td>`,
        `<td>${row.switchPort ? escapeHtml(padPort(row.switchPort.numero)) : (row.switchComponent && row.connectedToSwitch ? 'Da specificare' : EMPTY)}</td>`,
        `<td>${value(row.port.dispositivo)}</td>`, `<td>${value(row.port.poe)}</td>`,
        `<td>${value(row.port.vlan, 'VLAN ')}</td>`, `<td>${value(row.port.ip)}</td>`,
        `<td><span class="table-status"><span class="status-dot" data-status="${escapeHtml(row.port.stato || 'free')}"></span>${escapeHtml(STATUS[row.port.stato] || row.port.stato || 'Non indicato')}</span></td>`,
        `<td>${value(row.port.note)}</td>`
      ].join('');
      tr.addEventListener('click', () => openOutletRow(row));
      tr.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openOutletRow(row); }
      });
      elements.tableBody.append(tr);
    });
    elements.emptyTable.hidden = rows.length !== 0;
  }

  function openPortDetails(component, port) {
    clearHighlights();
    const key = portKey(component.id, port.id);
    const link = state.connectionsByPort.get(key);
    const other = link ? state.ports.get(link.otherKey) : null;
    const logical = state.logicalConnections.get(port.collegamentoId || port.riferimentoMigrato || '');
    const logicalSwitch = logical?.switchId ? state.components.get(logical.switchId) : null;
    const connectedToSwitch = logical ? isLogicalConnectedToSwitch(logical) : false;
    highlightPort(key, 'is-selected');
    if (link) highlightPort(link.otherKey, 'is-related');
    if (logicalSwitch && (logical?.portaSwitch === null || logical?.portaSwitch === undefined)) highlightSwitchDevice(logicalSwitch.id);

    setText('#dialog-kicker', component.nome || component.id);
    setText('#dialog-title', logical?.id || port.id || `Porta ${port.numero}`);
    const details = logical ? { ...logical, ...port, stato: port.stato || logical.stato } : port;
    const logicalNotes = logical ? [logical.note, port.note].filter(Boolean).join(' · ') : port.note;
    const fields = componentKind(component) === 'patch' ? [
      ['Identificativo logico', logical?.id || port.id], ['Numero logico', logical?.numeroLogico],
      ['Posizione fisica', `${component.nome} · posizione ${padPort(port.numero)}`],
      ['Destinazione', details.destinazione], ['Presa a muro', details.presaMuro],
      ['Dispositivo collegato', details.dispositivo], ['Tipo collegamento', details.tipoCollegamento],
      ['PoE', details.poe], ['VLAN', details.vlan ? `VLAN ${details.vlan}` : ''], ['Indirizzo IP', details.ip],
      ['Migrato', logical?.migrato ? 'SÌ' : 'NO'], ['Posizione originale', logical?.posizioneOriginale],
      ['Switch collegato', logicalSwitch?.nome || (connectedToSwitch ? 'Collegato · switch non documentato' : '')],
      ['Porta switch', logical?.portaSwitch !== null && logical?.portaSwitch !== undefined ? padPort(logical.portaSwitch) : (logicalSwitch ? 'Da specificare' : '')],
      ['Stato fisico', STATUS[details.stato] || details.stato], ['Note', logicalNotes, true]
    ] : [
      ['Numero porta', port.id], ['Etichetta', port.etichetta], ['Tipo porta', port.tipo],
      ['Velocità', port.velocita], ['PoE', port.poe], ['VLAN', port.vlan ? `VLAN ${port.vlan}` : ''],
      ['Stato', STATUS[visualStatus(port, 'switch')] || port.stato], ['Note', port.note, true]
    ];
    let html = detailList(fields);
    if (link && other) {
      html += `<div class="connection-callout"><p><strong>${escapeHtml(port.id)} → ${escapeHtml(other.port.id)}</strong></p><small>${escapeHtml(other.component.nome || other.component.id)} · ${escapeHtml(link.connection.tipoCavo || 'Cavo non indicato')}</small></div>`;
    } else if (logicalSwitch) {
      html += `<div class="connection-callout"><p><strong>Collegato a ${escapeHtml(logicalSwitch.nome)}</strong></p><small>${logical.portaSwitch !== null && logical.portaSwitch !== undefined ? `Porta switch ${escapeHtml(padPort(logical.portaSwitch))}` : 'Porta switch non ancora specificata'}</small></div>`;
    } else if (connectedToSwitch) {
      html += '<div class="connection-callout"><p><strong>Collegato a uno switch</strong></p><small>Switch e porta non ancora documentati: il collegamento fisico esiste ma la distribuzione è attualmente casuale.</small></div>';
    } else if (logical) {
      html += '<div class="connection-callout"><p><strong>Associazione allo switch non documentata</strong></p><small>Lo switch e la relativa porta potranno essere aggiunti nel JSON quando saranno noti.</small></div>';
    } else {
      html += '<div class="connection-callout"><p><strong>Nessun collegamento associato</strong></p><small>Per aggiungerlo, modifica la sezione “connessioni” nel JSON del rack.</small></div>';
    }
    document.querySelector('#dialog-content').innerHTML = html;
    showDialog(elements.detailDialog);
  }

  function openOutletRow(row) {
    if (row.logical) {
      if (row.panel && row.physicalPort) openPortDetails(row.panel, row.physicalPort);
      else openLogicalDetails(row.logical);
      return;
    }
    openPortDetails(row.panel, row.port);
  }

  function openLogicalDetails(logical) {
    clearHighlights();
    const panel = state.components.get(logical.patchPanel);
    const port = panel && logical.portaFisica !== null && logical.portaFisica !== undefined
      ? panel.porte.find((entry) => Number(entry.numero) === Number(logical.portaFisica))
      : null;
    if (panel && port) highlightPort(portKey(panel.id, port.id), 'is-selected');
    const logicalSwitch = logical.switchId ? state.components.get(logical.switchId) : null;
    const connectedToSwitch = isLogicalConnectedToSwitch(logical);
    if (logicalSwitch && (logical.portaSwitch === null || logical.portaSwitch === undefined)) highlightSwitchDevice(logicalSwitch.id);
    setText('#dialog-kicker', logical.gruppo === 'telecamere' ? 'Cavi telecamere' : 'Connessione rete');
    setText('#dialog-title', logical.id);
    document.querySelector('#dialog-content').innerHTML = detailList([
      ['Identificativo logico', logical.id], ['Numero logico', logical.numeroLogico],
      ['Destinazione', logical.destinazione], ['Posizione fisica attuale', physicalLocation(logical)],
      ['Posizione originale', logical.posizioneOriginale], ['Migrato', logical.migrato ? 'SÌ' : 'NO'],
      ['Dispositivo', logical.dispositivo], ['PoE', logical.poe],
      ['VLAN', logical.vlan ? `VLAN ${logical.vlan}` : ''], ['Indirizzo IP', logical.ip],
      ['Switch collegato', logicalSwitch?.nome || (connectedToSwitch ? 'Collegato · switch non documentato' : '')],
      ['Porta switch', logical.portaSwitch !== null && logical.portaSwitch !== undefined ? padPort(logical.portaSwitch) : (logicalSwitch ? 'Da specificare' : '')],
      ['Stato', STATUS[logical.stato] || logical.stato], ['Note', logical.note, true]
    ]);
    showDialog(elements.detailDialog);
  }

  function openDeviceDetails(device) {
    clearHighlights();
    setText('#dialog-kicker', labelForType(device.tipo));
    setText('#dialog-title', device.nome || 'Apparato');
    document.querySelector('#dialog-content').innerHTML = detailList([
      ['ID', device.id], ['Tipo', labelForType(device.tipo)], ['Posizione', state.data.layout.length ? layoutLocationForDevice(device.id) : unitLabel(device)],
      ['Altezza', state.data.layout.length ? '' : `${device.altezzaU || 1}U`], ['Produttore', device.produttore], ['Modello', device.modello],
      ['Indirizzo IP', device.ip], ['Connessione rete / Home Assistant', device.connessioneRete],
      ['Collegamenti', formatDeviceConnections(device), true], ['Descrizione', device.descrizione, true], ['Note', device.note, true]
    ]);
    showDialog(elements.detailDialog);
  }

  function openExternalLink(link) {
    setText('#dialog-kicker', 'Collegamento tra rack');
    setText('#dialog-title', link.nome || 'Dorsale');
    document.querySelector('#dialog-content').innerHTML = detailList([
      ['Origine', link.origine], ['Destinazione', link.destinazione], ['Tipo cavo', link.tipoCavo],
      ['Fibra utilizzata', link.numeroFibra], ['Colore fibra', link.coloreFibra],
      ['Connettore', link.connettore], ['Apparato / porta origine', link.portaOrigine],
      ['Apparato / porta destinazione', link.portaDestinazione], ['Note', link.note, true]
    ]);
    showDialog(elements.detailDialog);
  }

  function renderPrintEquipment() {
    const list = document.querySelector('#print-equipment');
    state.data.apparati.forEach((device) => {
      const item = document.createElement('li');
      const position = state.data.layout.length ? layoutLocationForDevice(device.id) : unitLabel(device);
      item.textContent = `${device.nome} — ${position} — ${device.descrizione || labelForType(device.tipo)}`;
      list.append(item);
    });
  }

  function physicalLocation(logical) {
    if (logical.migrato && (logical.portaFisica === null || logical.portaFisica === undefined)) {
      const panel = state.components.get(logical.patchPanel);
      return `${panel?.nome || logical.patchPanel || 'Pannello non specificato'} · porta da specificare`;
    }
    const panel = state.components.get(logical.patchPanel);
    return panel && logical.portaFisica !== null && logical.portaFisica !== undefined
      ? `${panel.nome} · ${padPort(logical.portaFisica)}`
      : 'Non specificata';
  }

  function isLogicalConnectedToSwitch(logical) {
    if (!logical) return false;
    if (logical.switchId) return true;
    return Boolean(state.data.configurazioneConnessioni?.[logical.gruppo]?.tutteCollegateASwitch);
  }

  function layoutLocationForDevice(deviceId) {
    const index = state.data.layout.findIndex((item) => item.device === deviceId || (item.devices || []).includes(deviceId) ||
      (item.items || []).some((entry) => entry.type === 'device' && entry.id === deviceId));
    if (index < 0) return 'Non specificata';
    const item = state.data.layout[index];
    return `${index + 1}° elemento dall’alto${item.name ? ` · ${item.name}` : ''}`;
  }

  function deviceIcon(type) {
    return ({ router: '⌁', nvr: '◉', server: '▤', controller: '⌂', ups: 'ϟ', monitor: '▣', storage: '▥', 'poe-injector': 'ϟ' })[type] || '■';
  }

  function formatDeviceConnections(device) {
    return Array.isArray(device.connessioni) && device.connessioni.length
      ? device.connessioni.map((connection) => `${connection.porta}: ${connection.collegamentoId}${connection.destinazione ? ` (${connection.destinazione})` : ''}`).join(' · ')
      : '';
  }

  function detailList(fields) {
    return `<dl class="detail-list">${fields.map(([label, rawValue, wide]) => `<div${wide ? ' class="detail-wide"' : ''}><dt>${escapeHtml(label)}</dt><dd>${value(rawValue)}</dd></div>`).join('')}</dl>`;
  }

  function highlightPort(key, className) {
    const button = document.querySelector(`[data-port-key="${cssEscape(key)}"]`);
    if (button) button.classList.add(className);
  }
  function highlightSwitchDevice(componentId) {
    const device = document.querySelector(`[data-component-id="${cssEscape(componentId)}"]`);
    if (device) device.classList.add('is-related-device');
  }
  function clearHighlights() {
    document.querySelectorAll('.port.is-selected, .port.is-related').forEach((button) => button.classList.remove('is-selected', 'is-related'));
    document.querySelectorAll('.is-related-device').forEach((device) => device.classList.remove('is-related-device'));
  }
  function closeOnBackdrop(event) { if (event.target === event.currentTarget) event.currentTarget.close(); }
  function showDialog(dialog) { if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); }
  function showFatalError(message) {
    elements.pageStatus.hidden = true;
    elements.pageError.hidden = false;
    elements.pageError.innerHTML = `<strong>Pagina non disponibile.</strong><br>${escapeHtml(message)} <a href="index.html">Torna alla home</a>.`;
  }

  function endpointKey(endpoint) { return endpoint && endpoint.apparato && endpoint.porta ? portKey(endpoint.apparato, endpoint.porta) : ''; }
  function portKey(componentId, portId) { return `${componentId}::${portId}`; }
  function componentKind(component) { return state.data.patchPanels.includes(component) ? 'patch' : 'switch'; }
  function visualStatus(port, type) {
    if (port.stato === 'fault' || port.stato === 'unavailable' || port.stato === 'reserved' || port.stato === 'free' || port.stato === 'unknown') return port.stato;
    if (type === 'switch' && /sfp|fibra/i.test(`${port.tipo || ''} ${port.ruolo || ''}`)) return 'fiber';
    if (type === 'switch' && normalizeText(port.ruolo) === 'uplink') return 'uplink';
    if (type === 'switch' && normalizeText(port.poe) === 'si') return 'poe';
    return port.stato || 'free';
  }
  function unitLabel(device) {
    const start = Number(device.posizioneU || 0), end = start + Number(device.altezzaU || 1) - 1;
    return end > start ? `U${start}–U${end}` : `U${start}`;
  }
  function labelForType(type) {
    return ({ router: 'Router', ups: 'UPS', pdu: 'PDU', organizer: 'Passacavi', fiber: 'Fibra ottica', shelf: 'Ripiano', nvr: 'NVR', nas: 'NAS', storage: 'Archivio', server: 'Server', monitor: 'Monitor', controller: 'Controller', modem: 'Modem / FWA', 'poe-injector': 'PoE injector', generic: 'Apparato generico' })[type] || type || 'Apparato generico';
  }
  function formatDate(date) {
    if (!date) return 'Non indicato';
    const parsed = new Date(`${date}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? String(date) : new Intl.DateTimeFormat('it-IT', { dateStyle: 'long' }).format(parsed);
  }
  function uniqueValues(values) { return [...new Set(values.filter((value) => value !== undefined && value !== null && String(value).trim() !== ''))].sort((a, b) => String(a).localeCompare(String(b), 'it', { numeric: true })); }
  function normalizeText(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  function padPort(number) { const parsed = Number(number); return Number.isFinite(parsed) ? String(parsed).padStart(2, '0') : String(number || '?'); }
  function createElement(tag, className = '', text = '') { const element = document.createElement(tag); element.className = className; if (text) element.textContent = text; return element; }
  function setText(selector, text) { document.querySelector(selector).textContent = text ?? ''; }
  function value(rawValue, prefix = '') { return rawValue === undefined || rawValue === null || rawValue === '' ? EMPTY : escapeHtml(`${prefix}${rawValue}`); }
  function escapeHtml(valueToEscape) { return String(valueToEscape ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
  function cssEscape(valueToEscape) { return window.CSS?.escape ? CSS.escape(valueToEscape) : valueToEscape.replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
}());
