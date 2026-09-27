const DB_NAME = '100cims-cat';
const DB_VERSION = 1;
const STORE = 'ascents';
const CATALOG_URL = './data/summits.json';
const TARGET = 100;

const ui = {
  grid: document.querySelector('#summit-grid'), search: document.querySelector('#search'),
  sort: document.querySelector('#sort'), filters: [...document.querySelectorAll('.filter')],
  input: document.querySelector('#photo-input'), toast: document.querySelector('#toast'),
};

let summits = [];
let ascents = new Map();
let currentFilter = 'all';
let pendingPhotoId = null;
let toastTimer;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'summitId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const dbPromise = openDatabase();

async function readAllAscents() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveAscent(ascent) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(ascent);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteAscent(summitId) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(summitId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2500);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function getVisibleSummits() {
  const term = ui.search.value.trim().toLocaleLowerCase('ca');
  return summits.filter(summit => {
    const ascent = ascents.get(summit.id);
    const isDone = Boolean(ascent?.doneAt);
    if (currentFilter === 'pending' && isDone) return false;
    if (currentFilter === 'done' && !isDone) return false;
    if (currentFilter === 'essential' && !summit.essential) return false;
    if (term && !`${summit.name} ${summit.region}`.toLocaleLowerCase('ca').includes(term)) return false;
    return true;
  }).sort((a, b) => ui.sort.value === 'height'
    ? b.height - a.height || a.name.localeCompare(b.name, 'ca')
    : a.name.localeCompare(b.name, 'ca'));
}

function cardMarkup(summit) {
  const ascent = ascents.get(summit.id);
  const isDone = Boolean(ascent?.doneAt);
  const hasPhoto = Boolean(ascent?.photo);
  const photoUrl = hasPhoto ? URL.createObjectURL(ascent.photo) : '';
  const region = summit.region.replace(/\s*,\s*/g, ' · ');
  return `<article class="card" data-id="${escapeHtml(summit.id)}">
    <div class="thumb"><span class="mountain-icon" aria-hidden="true">⌃</span>${photoUrl ? `<div class="photo-preview" style="background-image:url('${photoUrl}')"></div>` : ''}</div>
    <div class="card-body">
      <div class="card-meta">${summit.essential ? '<span class="essential-tag">✦ Essencial</span>' : ''}${isDone ? '<span class="done-tag">✓ Fet</span>' : ''}</div>
      <h3 title="${escapeHtml(summit.name)}">${escapeHtml(summit.name)}</h3>
      <div class="card-detail">${summit.height.toLocaleString('ca-ES')} m · ${escapeHtml(region)}</div>
      <div class="card-actions">
        <button class="mark-button ${isDone ? 'is-done' : ''}" data-action="toggle">${isDone ? '✓ Assolit' : '+ Marcar fet'}</button>
        <button class="photo-button ${hasPhoto ? 'has-photo' : ''}" data-action="photo">${hasPhoto ? '▣ Foto' : '＋ Foto'}</button>
      </div>
    </div>
  </article>`;
}

function render() {
  const visible = getVisibleSummits();
  document.querySelector('#visible-count').textContent = visible.length;
  document.querySelector('#results-label').textContent = `${visible.length} ${visible.length === 1 ? 'muntanya' : 'muntanyes'} al catàleg`;
  ui.grid.innerHTML = visible.length ? visible.map(cardMarkup).join('') : '<div class="empty">No hem trobat cap cim amb aquests filtres.</div>';

  const completed = [...ascents.values()].filter(item => item.doneAt);
  const essentialCount = completed.filter(item => item.essential).length;
  const photoCount = completed.filter(item => item.photo).length;
  const progress = Math.min(100, Math.round((completed.length / TARGET) * 100));
  document.querySelector('#done-count').textContent = completed.length;
  document.querySelector('#total-done').textContent = completed.length;
  document.querySelector('#essentials-done').innerHTML = `${essentialCount}<span class="stat-total"> / 100</span>`;
  document.querySelector('#photos-count').textContent = photoCount;
  document.querySelector('#progress-fill').style.width = `${progress}%`;
  document.querySelector('#progress-percent').textContent = `${progress}%`;
  document.querySelector('#progress-caption').textContent = completed.length
    ? `Ja tens ${completed.length} ${completed.length === 1 ? 'cim al teu quadern' : 'cims al teu quadern'}. El pròxim pas t’espera.`
    : 'Encara no has registrat cap ascensió. Tot comença amb el primer pas.';
}

ui.grid.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const card = button.closest('.card');
  const summit = summits.find(item => item.id === card.dataset.id);
  const existing = ascents.get(summit.id) || { summitId: summit.id, essential: summit.essential };
  if (button.dataset.action === 'photo') {
    pendingPhotoId = summit.id;
    ui.input.click();
    return;
  }
  if (existing.doneAt) {
    existing.doneAt = null;
    existing.essential = summit.essential;
    if (!existing.photo) {
      await deleteAscent(summit.id);
      ascents.delete(summit.id);
    } else {
      await saveAscent(existing);
      ascents.set(summit.id, existing);
    }
    showToast(`${summit.name}: ascensió desmarcada.`);
  } else {
    existing.doneAt = new Date().toISOString().slice(0, 10);
    existing.essential = summit.essential;
    await saveAscent(existing);
    ascents.set(summit.id, existing);
    showToast(`${summit.name}: afegit al teu quadern.`);
  }
  render();
});

ui.input.addEventListener('change', async () => {
  const file = ui.input.files?.[0];
  const summit = summits.find(item => item.id === pendingPhotoId);
  if (!file || !summit) return;
  if (!file.type.startsWith('image/')) {
    showToast('Tria un fitxer d’imatge.');
    ui.input.value = '';
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    showToast('La imatge ha de pesar menys de 12 MB.');
    ui.input.value = '';
    return;
  }
  const previous = ascents.get(summit.id) || { summitId: summit.id, essential: summit.essential };
  previous.photo = file;
  previous.photoName = file.name;
  previous.essential = summit.essential;
  previous.doneAt ||= new Date().toISOString().slice(0, 10);
  await saveAscent(previous);
  ascents.set(summit.id, previous);
  ui.input.value = '';
  showToast(`Foto guardada per a ${summit.name}.`);
  render();
});

ui.search.addEventListener('input', render);
ui.sort.addEventListener('change', render);
ui.filters.forEach(button => button.addEventListener('click', () => {
  currentFilter = button.dataset.filter;
  ui.filters.forEach(filter => filter.classList.toggle('active', filter === button));
  render();
}));

async function init() {
  try {
    const [catalogResponse, saved] = await Promise.all([fetch(CATALOG_URL), readAllAscents()]);
    if (!catalogResponse.ok) throw new Error('No s’ha pogut carregar el catàleg.');
    summits = await catalogResponse.json();
    ascents = new Map(saved.map(item => [item.summitId, item]));
    document.querySelector('#all-badge').textContent = summits.length;
    document.querySelector('.catalog-count b').textContent = summits.length;
    render();
  } catch (error) {
    ui.grid.innerHTML = `<div class="empty">${escapeHtml(error.message)} Obre la pàgina des d’un servidor local i torna-ho a provar.</div>`;
    console.error(error);
  }
}

init();

