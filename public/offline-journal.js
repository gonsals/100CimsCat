import {
  getOwner,
  listPending,
  putPending,
  removePending,
} from './journal-store.js'
const language = document.documentElement.lang,
  index = language === 'es' ? 1 : language === 'en' ? 2 : 0
const t = (key) =>
  ({
    title: ['Visites pendents', 'Visitas pendientes', 'Pending visits'],
    activate: [
      'Activa el registre sense cobertura des del teu compte amb connexió.',
      'Activa el registro sin cobertura desde tu cuenta con conexión.',
      'Enable offline recording from your account while online.',
    ],
    intro: [
      'Les visites es desen en aquest navegador. Torna a obrir la web amb connexió i el mateix compte per sincronitzar-les.',
      'Las visitas se guardan en este navegador. Vuelve a abrir la web con conexión y la misma cuenta para sincronizarlas.',
      'Visits stay in this browser. Reopen the app online with the same account to sync them.',
    ],
    summit: ['Cim', 'Cima', 'Summit'],
    date: ['Data', 'Fecha', 'Date'],
    notes: [
      'Notes (màxim 4.000 caràcters)',
      'Notas (máximo 4.000 caracteres)',
      'Notes (up to 4,000 characters)',
    ],
    save: ['Desar pendent', 'Guardar pendiente', 'Save pending'],
    remove: ['Eliminar pendent', 'Eliminar pendiente', 'Remove pending'],
    saved: [
      'Visita pendent desada.',
      'Visita pendiente guardada.',
      'Pending visit saved.',
    ],
    error: [
      'No s’ha pogut desar. Revisa la data, les notes i l’espai del navegador.',
      'No se ha podido guardar. Revisa la fecha, las notas y el espacio del navegador.',
      'Could not save. Check the date, notes and browser storage.',
    ],
    privacy: [
      'Les fitxes són públiques. Les notes pendents són privades i es desen en aquest dispositiu fins a sincronitzar-les.',
      'Las fichas son públicas. Las notas pendientes son privadas y se guardan en este dispositivo hasta sincronizarlas.',
      'Summit cards are public. Pending notes are private and stay on this device until synced.',
    ],
  })[key][index]
const section = document.createElement('section')
section.id = 'pending-journal'
const heading = document.createElement('h2')
heading.textContent = t('title')
section.append(heading)
const status = document.createElement('p')
status.setAttribute('role', 'status')
section.append(status)
document
  .getElementById('offline-main')
  .insertBefore(section, document.querySelector('footer'))
const node = (tag, value) => {
  const element = document.createElement(tag)
  element.textContent = value
  return element
}
const localDate = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
try {
  const owner = await getOwner()
  if (!owner) status.textContent = t('activate')
  else {
    document.getElementById('storage-note').textContent = t('privacy')
    section.append(node('p', t('intro')))
    const response = await fetch('/summits-catalog.json')
    if (!response.ok) throw new Error('Catalog unavailable')
    const summits = await response.json()
    const form = document.createElement('form'),
      summit = document.createElement('select'),
      date = document.createElement('input'),
      notes = document.createElement('textarea'),
      button = node('button', t('save')),
      list = document.createElement('ul')
    for (const item of summits) {
      const option = node('option', item.name)
      option.value = item.id
      summit.append(option)
    }
    date.type = 'date'
    date.required = true
    date.max = localDate()
    date.value = localDate()
    notes.maxLength = 4000
    notes.rows = 3
    button.type = 'submit'
    for (const [key, control] of [
      ['summit', summit],
      ['date', date],
      ['notes', notes],
    ]) {
      const label = node('label', t(key))
      label.style.display = 'block'
      control.setAttribute('aria-label', t(key))
      Object.assign(control.style, {
        display: 'block',
        width: '100%',
        font: 'inherit',
        padding: '10px',
        margin: '8px 0 16px',
      })
      label.append(control)
      form.append(label)
    }
    form.append(button)
    section.append(form, list)
    async function render() {
      list.replaceChildren()
      for (const item of await listPending(owner)) {
        const li = node(
            'li',
            `${summits.find((s) => s.id === item.summit_id)?.name || item.summit_id} · ${item.completed_at}`,
          ),
          remove = node('button', t('remove'))
        remove.type = 'button'
        remove.onclick = () =>
          void removePending(item.id)
            .then(render)
            .catch(() => {
              status.textContent = t('error')
            })
        li.append(remove)
        list.append(li)
      }
    }
    form.onsubmit = async (event) => {
      event.preventDefault()
      status.textContent = ''
      button.disabled = true
      try {
        const value = date.value,
          parsed = new Date(`${value}T12:00:00Z`)
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(parsed.getTime()) ||
          parsed.toISOString().slice(0, 10) !== value ||
          value > localDate() ||
          notes.value.length > 4000
        )
          throw new Error('Date invalid')
        if ((await getOwner()) !== owner) throw new Error('Account changed')
        await putPending({
          id: crypto.randomUUID(),
          owner,
          summit_id: summit.value,
          completed_at: value,
          notes: notes.value,
        })
        notes.value = ''
        status.textContent = t('saved')
        await render()
      } catch {
        status.textContent = t('error')
      } finally {
        button.disabled = false
      }
    }
    await render()
  }
} catch {
  status.textContent = t('error')
}
