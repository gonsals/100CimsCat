# 100CimsCat

Quadern personal per seguir les ascensions del repte dels 100 Cims de la FEEC i guardar una fotografia per cim.

## Estat d'aquesta primera versió

- Catàleg FEEC local amb 522 cims i la distinció de 100 cims essencials.
- Cerca per nom o comarca, filtres de pendents/fets/essencials i ordenació per altitud.
- Seguiment de cims assolits i fotos personals desades al navegador amb IndexedDB.
- La foto és opcional i es conserva també si després es desmarca l'ascensió.

Les dades del catàleg es van obtenir del fitxer de dades de [mcmontseny/backend-100-cims-feec](https://github.com/mcmontseny/backend-100-cims-feec), derivat del catàleg oficial de la [FEEC](https://www.feec.cat/activitats/100-cims/). Es conserva l'atribució de la font i l'enllaç a la FEEC.

## Executar

Obre aquesta carpeta amb qualsevol servidor estàtic local. Per exemple, des de l'arrel del projecte:

```sh
npx serve .
```

La pàgina utilitza `fetch()` per llegir el catàleg i, per tant, no funciona si s'obre directament com a fitxer `file://`.

## Emmagatzematge

La versió inicial guarda l'estat i les imatges localment al navegador. No hi ha encara comptes ni sincronització entre dispositius. El catàleg és independent de les dades de progrés personals.

## Origen de les dades

La FEEC indica que el catàleg actual està format per 522 cims, dels quals cadascú en pot triar 100 per completar el repte. El fitxer `data/summits.json` és una còpia normalitzada del catàleg de 522 registres. Consulta la FEEC per verificar possibles actualitzacions futures.

