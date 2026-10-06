# 100CimsCat

Quadern personal per seguir les ascensions del repte dels 100 Cims de la FEEC, amb una foto privada per cim i progrés sincronitzat al teu compte.

## Funcions

- Catàleg FEEC de 522 cims, incloent-hi els 150 essencials; el repte es completa amb 100 essencials.
- Cerca per nom o comarca, filtres de cims pendents/fets/essencials i ordenació per altitud.
- Inici de sessió amb enllaç màgic de correu i seguiment personal sincronitzat amb Supabase.
- Fotos privades a Supabase Storage, amb accés restringit al seu propietari.
- Abans de pujar-la, cada foto es redimensiona fins a 1.800 px, es converteix a WebP (o JPEG si el navegador no pot) i s'ajusta la qualitat per mirar de quedar per sota d'1,5 MB. Es treuen les metadades originals i el bucket rebutja fitxers de més de 6 MB.

## Configuració local

Requereix Node.js 20.9 o posterior. Copia `.env.example` a `.env.local` i afegeix-hi la URL i la clau publicable del teu projecte Supabase. Els retorns d'autenticació es construeixen amb l'origen del navegador on s'ha iniciat la sessió, tant en local com a Vercel.

```sh
npm install
npm run dev
```

Obre `http://localhost:3000`. La migració `supabase/migrations/20260927200000_catalog_and_private_ascent_tracking.sql` crea el catàleg, les taules de seguiment, les polítiques RLS i el bucket privat de fotos. El projecte Supabase ja té la migració aplicada.

Per fer servir l'enllaç màgic o Google en un domini publicat, afegeix `https://el-teu-domini/auth/callback` als URL de redirecció permesos a Supabase Auth i configura l'URL del lloc amb el domini de producció.

## Catàleg

Les dades normalitzades del catàleg s'inclouen a `data/summits.json` i també es carreguen a `public.summits`. La font és [mcmontseny/backend-100-cims-feec](https://github.com/mcmontseny/backend-100-cims-feec), derivada del catàleg oficial de la [FEEC](https://www.feec.cat/activitats/100-cims/). La [normativa FEEC](https://www.feec.cat/activitats/100-cims/normativa-i-funcionament/) defineix el repte dels 100 cims essencials.


