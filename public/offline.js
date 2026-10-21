/* Public summit reader: works independently of Next.js and its network bundles. */
(() => {
  const key = '100cimscat-offline-v1'
  let language = 'ca'
  try { language = localStorage.getItem('100cimscat-language') || 'ca' } catch { /* defaults */ }
  const copy = {
    ca: { title: 'Els teus cims sense cobertura', all: 'Fitxes descarregades', intro: 'Dades desades en aquest dispositiu. Els mapes, els enllaços i el quadern privat necessiten connexió.', warning: 'Les coordenades són orientatives. Aquesta fitxa no substitueix un mapa topogràfic ni la planificació de la ruta.', empty: 'Encara no has descarregat cap fitxa. Obre una cima amb connexió i prem «Desar sense cobertura».', missing: 'Aquesta cima no està descarregada.', error: 'No podem llegir les fitxes. Revisa els permisos d’emmagatzematge del navegador.', remove: 'Treure descàrrega', essential: '✦ Cim essencial', saved: 'Desada el', coordinates: 'Coordenades', source: 'Fitxa FEEC (amb connexió)', noCoordinates: 'Sense coordenades disponibles.' },
    es: { title: 'Tus cimas sin cobertura', all: 'Fichas descargadas', intro: 'Datos guardados en este dispositivo. Los mapas, enlaces y el cuaderno privado necesitan conexión.', warning: 'Las coordenadas son orientativas. Esta ficha no sustituye un mapa topográfico ni la planificación de la ruta.', empty: 'Todavía no has descargado fichas. Abre una cima con conexión y pulsa «Guardar sin cobertura».', missing: 'Esta cima no está descargada.', error: 'No podemos leer las fichas. Revisa los permisos de almacenamiento del navegador.', remove: 'Quitar descarga', essential: '✦ Cima esencial', saved: 'Guardada el', coordinates: 'Coordenadas', source: 'Ficha FEEC (con conexión)', noCoordinates: 'Sin coordenadas disponibles.' },
    en: { title: 'Your offline summits', all: 'Downloaded summits', intro: 'Data saved on this device. Maps, links and your private journal need a connection.', warning: 'Coordinates are for reference. This page does not replace a topographic map or route planning.', empty: 'No downloaded summits yet. Open a summit while online and choose “Save for offline”.', missing: 'This summit has not been downloaded.', error: 'Could not read saved summits. Check your browser storage permissions.', remove: 'Remove download', essential: '✦ Essential summit', saved: 'Saved on', coordinates: 'Coordinates', source: 'FEEC page (online)', noCoordinates: 'No coordinates available.' },
  }
  const t = copy[language] || copy.ca
  const navigation = language === 'es' ? { catalogue: 'Explorar', 'footer-note': 'Proyecto independiente', 'storage-note': 'Solo se guardan datos públicos de las cimas en este dispositivo.', help: 'Ayuda con conexión' } : language === 'en' ? { catalogue: 'Explore', 'footer-note': 'Independent project', 'storage-note': 'Only public summit data is saved on this device.', help: 'Help while online' } : { catalogue: 'Explorar', 'footer-note': 'Projecte independent', 'storage-note': 'Només es desen dades públiques de les cimes en aquest dispositiu.', help: 'Ajuda amb connexió' }
  for (const [id, text] of Object.entries(navigation)) document.getElementById(id).textContent = text
  document.documentElement.lang = copy[language] ? language : 'ca'
  for (const id of ['title', 'all', 'intro', 'warning']) document.getElementById(id).textContent = t[id]
  const container = document.getElementById('summits')
  const status = document.getElementById('status')
  const requested = new URLSearchParams(location.search).get('cim') || (location.pathname.startsWith('/cims/') ? decodeURIComponent(location.pathname.split('/')[2]) : null)
  const text = (tag, value, className) => { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node }
  function render() {
    container.replaceChildren()
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '[]')
      if (!Array.isArray(stored)) throw new Error('Invalid saved summits')
      const all = stored.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.region === 'string' && Number.isFinite(item.height))
      const items = requested ? all.filter(item => item.id === requested) : all
      status.textContent = items.length ? '' : requested ? t.missing : t.empty
      for (const item of items) {
        const card = document.createElement('article')
        card.append(text('h2', item.name), text('p', `${item.height.toLocaleString()} m · ${item.region}`))
        if (item.essential) card.append(text('p', t.essential, 'essential'))
        const point = item.coordinate
        card.append(text('p', point && Number.isFinite(point.lat) && Number.isFinite(point.lng) ? `${t.coordinates}: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : t.noCoordinates))
        const saved = new Date(item.savedAt)
        if (!Number.isNaN(saved.getTime())) card.append(text('p', `${t.saved}: ${saved.toLocaleDateString(document.documentElement.lang)}`, 'hint'))
        const actions = document.createElement('div'); actions.className = 'actions'
        try { const url = new URL(item.url); if (url.protocol === 'https:' && (url.hostname === 'www.feec.cat' || url.hostname === 'feec.cat')) { const link = text('a', t.source); link.href = url.href; actions.append(link) } } catch { /* Invalid external URL is not linked. */ }
        const remove = text('button', t.remove); remove.type = 'button'
        remove.addEventListener('click', () => { try { localStorage.setItem(key, JSON.stringify(all.filter(other => other.id !== item.id))); render() } catch { status.textContent = t.error } })
        actions.append(remove); card.append(actions); container.append(card)
      }
    } catch { status.textContent = t.error; status.className = 'error' }
  }
  render()
})()
