import type { Language } from '@/lib/tracker'

export const mountainHelp: Record<Language, [string, string][]> = {
  ca: [
    [
      'Visites sense cobertura',
      'Activa el registre al teu compte abans de sortir. A Descàrregues podràs desar data i notes sense xarxa, fins a 100 visites pendents. Torna a obrir la web amb connexió i el mateix compte per sincronitzar-les. Esborrar les dades del navegador elimina les visites pendents. Les fotos i els mapes necessiten connexió.',
    ],
    [
      'Còpies i rutes',
      'Des del quadern pots descarregar un ZIP amb visites, notes, preferits, fotos, GPX, llistes i objectius. La restauració mostra una previsualització i conserva les dades existents; reintenta amb el mateix ZIP si falten adjunts. Límit: 350 MB i 10.000 visites. Les rutes GPX són privades i mostren distància i desnivell aproximats, sense validar la seguretat del recorregut.',
    ],
    [
      'Objectius, calendari i sortides',
      'Defineix un objectiu anual de visites, cims diferents o essencials. El calendari agrupa totes les visites del dia. Pots compartir una còpia del nom, la data i els cims d’una llista: l’enllaç dura 30 dies, es pot desactivar i no inclou notes, fotos ni GPX. Els canvis de la llista es publiquen en tornar a actualitzar l’enllaç.',
    ],
  ],
  es: [
    [
      'Visitas sin cobertura',
      'Activa el registro en tu cuenta antes de salir. En Descargas podrás guardar fecha y notas sin red, hasta 100 visitas pendientes. Abre de nuevo la web con conexión y la misma cuenta para sincronizarlas. Borrar los datos del navegador elimina las visitas pendientes. Las fotos y los mapas necesitan conexión.',
    ],
    [
      'Copias y rutas',
      'Desde el cuaderno puedes descargar un ZIP con visitas, notas, favoritos, fotos, GPX, listas y objetivos. La restauración muestra una vista previa y conserva los datos existentes; reintenta con el mismo ZIP si faltan adjuntos. Límite: 350 MB y 10.000 visitas. Las rutas GPX son privadas y muestran distancia y desnivel aproximados, sin validar la seguridad del recorrido.',
    ],
    [
      'Objetivos, calendario y salidas',
      'Define un objetivo anual de visitas, cimas diferentes o esenciales. El calendario agrupa todas las visitas del día. Puedes compartir una copia del nombre, la fecha y las cimas de una lista: el enlace dura 30 días, se puede desactivar y no incluye notas, fotos ni GPX. Los cambios de la lista se publican al actualizar de nuevo el enlace.',
    ],
  ],
  en: [
    [
      'Offline visits',
      'Enable recording in your account before setting out. Downloads lets you save dates and notes offline, up to 100 pending visits. Reopen the app online with the same account to sync. Clearing browser storage deletes pending visits. Photos and maps need a connection.',
    ],
    [
      'Backups and routes',
      'Download a ZIP from your journal with visits, notes, favorites, photos, GPX, lists and goals. Restore previews the backup and preserves existing data; retry with the same ZIP if attachments are pending. Limit: 350 MB and 10,000 visits. Private GPX routes show approximate distance and elevation without verifying route safety.',
    ],
    [
      'Goals, calendar and trips',
      'Set an annual target for visits, unique summits or essential summits. The calendar groups all visits for each day. Share a snapshot of a list’s title, date and summits: links last 30 days, can be revoked and exclude notes, photos and GPX. Publish again to update a shared snapshot after editing its list.',
    ],
  ],
}
export const mountainPrivacy: Record<Language, [string, string][]> = {
  ca: [
    [
      'Registre pendent i còpies locals',
      'Si actives les visites sense cobertura, desem l’identificador del compte, dates i notes pendents en aquest navegador fins a sincronitzar-les o eliminar-les. Tancar sessió desactiva el registre local i conserva els pendents per al mateix compte. Esborrar el compte elimina també els pendents d’aquest navegador; en altres dispositius cal eliminar-los localment. Les còpies ZIP contenen dades privades: guarda-les en un lloc segur i elimina-les quan ja no les necessitis.',
    ],
    [
      'Compartició voluntària',
      'Les rutes GPX, els objectius i les llistes es desen al teu compte amb accés restringit al propietari. Si publiques una sortida, qualsevol persona amb l’enllaç podrà veure el nom, la data i els cims durant 30 dies. Pots desactivar l’enllaç. Les notes, fotos i GPX no es publiquen. Una persona que hagi guardat una còpia del contingut compartit pot conservar-la.',
    ],
  ],
  es: [
    [
      'Registro pendiente y copias locales',
      'Si activas las visitas sin cobertura, guardamos el identificador de cuenta, fechas y notas pendientes en este navegador hasta sincronizarlas o eliminarlas. Cerrar sesión desactiva el registro local y conserva los pendientes para la misma cuenta. Borrar la cuenta elimina también los pendientes de este navegador; en otros dispositivos debes eliminarlos localmente. Los ZIP contienen datos privados: guárdalos en un lugar seguro y elimínalos cuando ya no los necesites.',
    ],
    [
      'Compartición voluntaria',
      'Los GPX, los objetivos y las listas se guardan en tu cuenta con acceso restringido al propietario. Si publicas una salida, cualquier persona con el enlace podrá ver el nombre, la fecha y las cimas durante 30 días. Puedes desactivar el enlace. Las notas, fotos y GPX no se publican. Una persona que haya guardado una copia del contenido compartido puede conservarla.',
    ],
  ],
  en: [
    [
      'Pending recording and local backups',
      'If you enable offline visits, this browser stores your account identifier, dates and pending notes until synced or removed. Signing out disables local recording and preserves pending visits for the same account. Deleting your account also removes pending visits in this browser; remove them locally on other devices. ZIP backups contain private data: store them securely and delete them when no longer needed.',
    ],
    [
      'Optional sharing',
      'GPX routes, goals and lists are stored in your account with access restricted to the owner. Publishing a trip lets anyone with its link view its title, date and summits for 30 days. You can revoke the link. Notes, photos and GPX are excluded. Someone who saved a copy of shared content may keep it.',
    ],
  ],
}
