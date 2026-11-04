// Only opt-in pending visits live here. No sessions, tokens or private photos.
const database = '100cimscat-pending-v1'
function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore('meta')
      const visits = db.createObjectStore('visits', { keyPath: 'id' })
      visits.createIndex('owner', 'owner')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function run(store, mode, action) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    let value
    const request = action(tx.objectStore(store))
    request.onsuccess = () => {
      value = request.result
    }
    tx.oncomplete = () => {
      db.close()
      resolve(value)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error || new Error('Storage unavailable'))
    }
  })
}
export const getOwner = () =>
  run('meta', 'readonly', (store) => store.get('owner'))
export const setOwner = (owner) =>
  run('meta', 'readwrite', (store) => store.put(owner, 'owner'))
export const listPending = (owner) =>
  run('visits', 'readonly', (store) => store.index('owner').getAll(owner))
export const removePending = (id) =>
  run('visits', 'readwrite', (store) => store.delete(id))
export async function clearPending(owner) {
  for (const visit of await listPending(owner)) await removePending(visit.id)
  if ((await getOwner()) === owner) await setOwner(null)
}
export async function putPending(visit) {
  if (
    !visit ||
    typeof visit.id !== 'string' ||
    typeof visit.owner !== 'string' ||
    typeof visit.summit_id !== 'string' ||
    typeof visit.notes !== 'string' ||
    visit.notes.length > 4000 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(visit.completed_at)
  )
    throw new Error('Invalid pending visit')
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('visits', 'readwrite'),
      store = tx.objectStore('visits')
    const count = store.index('owner').count(visit.owner)
    count.onsuccess = () => {
      if (count.result >= 100) {
        tx.abort()
        return
      }
      store.add({ ...visit, created_at: new Date().toISOString() })
    }
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error || new Error('Pending visit limit reached'))
    }
  })
}
