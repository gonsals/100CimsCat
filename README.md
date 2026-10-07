# 100CimsCat

Quadern personal per seguir les ascensions del repte dels 100 Cims de la FEEC, amb una foto privada per cim i progrés sincronitzat al teu compte.

## Funcions

- Catàleg FEEC de 522 cims, incloent-hi els 150 essencials; el repte es completa amb 100 essencials.
- Cerca per nom o comarca, filtres de cims pendents/fets/essencials i ordenació per altitud.
- Inici de sessió amb enllaç màgic de correu i seguiment personal sincronitzat amb Supabase.
- Fotos privades a Supabase Storage, amb accés restringit al seu propietari.
- Cada foto es redimensiona fins a 1.440 px, es converteix a WebP (o JPEG si cal) i es comprimeix per sota de 512 KB. Es treuen les metadades originals; el límit també s'aplica al bucket. Quota per compte: 280 MB, amb un màxim global de 900 MB per no superar la quota gratuïta.
- La fitxa de cada cim enllaça amb informació de la FEEC, obre una cerca a OpenStreetMap i cerca fotos de Wikimedia Commons amb autoria, llicència i font visibles. Cal confirmar que el mapa i les imatges corresponen exactament a la cima.
- Pots compartir una targeta gràfica del progrés creada al navegador. Les fotos i dades personals no es publiquen.
- Des de Configuració pots esborrar el compte, les ascensions i les fotos privades.

## Quadern i planificació

- Filtres combinables: pendent/fet, essencial, preferit, comarca i interval d’altitud. Cerca tolerant als accents i ordenació per nom, altitud ascendent/descendent o distància.
- Preferits privats sincronitzats amb el compte, disponibles també al mapa.
- Formulari d’ascensió amb data editable i notes privades (fins a 4.000 caràcters). No es permeten dates futures. Editar el registre o canviar la foto conserva la resta del quadern.
- Historial amb filtre per any, estadístiques anuals i progrés per comarca. Les cimes compartides es compten a cada comarca.
- Exportació CSV amb ascensions, notes i preferits; les fotos no s’inclouen. S’escapen els camps que poden interpretar-se com a fórmules de full de càlcul.
- Distàncies en línia recta des de la ubicació autoritzada al navegador o des d’un cim de referència; no representen la longitud d’una ruta.
- Desmarcar una cima requereix confirmar l’eliminació de la data, les notes i la foto. Els diàlegs retenen el focus i impedeixen desplaçar el fons.
- Disseny adaptat al telèfon: controls tàctils, formularis sense zoom automàtic i una columna en pantalles de menys de 380 px.

Les migracions `journal_notes_and_favorites` i `restrict_favorite_privileges` afegeixen les notes i els preferits amb RLS i permisos limitats al propietari. Cal aplicar-les en qualsevol entorn nou abans d’utilitzar el quadern.

Verificació de lògica: `node --test tests/tracker.test.cjs`. Verificació del navegador: `node scripts/browser-check.cjs` amb Playwright instal·lat (o `PLAYWRIGHT_MODULE` apuntant al paquet) i `CHECK_URL` apuntant al servidor. Les proves del navegador simulen el compte i el quadern sense modificar dades personals; generen captures i un informe a `.next/browser-check`.

## Configuració local

Requereix Bun i Node.js 20.9 o posterior. Copia `.env.example` a `.env.local` i afegeix-hi la URL i la clau publicable del teu projecte Supabase. Per activar l'esborrat del compte, configura `SUPABASE_SERVICE_ROLE_KEY` només com a variable de servidor local/Vercel; no la pugis al repo. Els retorns d'autenticació es construeixen amb l'origen del navegador.

```sh
bun install
bun run dev
```

Obre `http://localhost:3000`. Les migracions de `supabase/migrations/` creen el catàleg, el seguiment, les polítiques RLS i el bucket privat. Aplica també la migració de quota gratuïta de fotos abans de desplegar aquesta versió.

Per fer servir l'enllaç màgic o Google en un domini publicat, afegeix `https://el-teu-domini/auth/callback` als URL de redirecció permesos a Supabase Auth i configura l'URL del lloc amb el domini de producció.

## Catàleg

Les dades normalitzades del catàleg s'inclouen a `data/summits.json` i també es carreguen a `public.summits`. La font és [mcmontseny/backend-100-cims-feec](https://github.com/mcmontseny/backend-100-cims-feec), derivada del catàleg oficial de la [FEEC](https://www.feec.cat/activitats/100-cims/). La [normativa FEEC](https://www.feec.cat/activitats/100-cims/normativa-i-funcionament/) defineix el repte dels 100 cims essencials.
