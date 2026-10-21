# Validación de funcionalidades y móvil

## Portada con rotación de cimas — 21 de octubre de 2026

La portada alterna automáticamente cada 30 segundos entre Pedraforca, Puigmal, Sant Jeroni, Canigó, Matagalls y Puigsacalm, sin botones. Las imágenes entrantes se decodifican antes de sustituir la actual y se mezclan durante 900 ms; nombre, altura y comarca corresponden a la imagen mostrada. El texto vuelve a disponer de todo el ancho de la imagen, también en móvil.

La rotación se detiene cuando la portada queda fuera de pantalla o la pestaña está oculta, y continúa aunque el ratón esté sobre la imagen. La preferencia de movimiento reducido mantiene la imagen estática.

Compilación de producción con TypeScript correcta. `scripts/hero-rotation-check.cjs` comprueba que no hay botones, que la imagen se conserva antes de los 30 segundos, el avance automático y retorno al inicio de los seis perfiles, la pausa fuera de pantalla y el movimiento reducido a 320, 390 y 1280 px. Sin desbordamientos ni infracciones en las reglas axe WCAG A/AA ejecutadas. La prueba controla el reloj de los temporizadores y deja avanzar el renderizado para IntersectionObserver. Las pruebas usan únicamente el catálogo público y no modifican cuentas ni cuadernos.

## Ilustraciones de terreno real — 21 de octubre de 2026

Se sustituyen los perfiles aleatorios por 522 SVG calculados a partir de las elevaciones alrededor de cada cima. 463 utilizan ICGC MET de 15 m y 111 utilizan Mapzen Terrarium; 52 combinan ambas fuentes en los límites de cobertura. Se conservan la composición por capas y la paleta de la web. Se ajustan las vistas de montañas características, incluidos los dos Pollegons y la enforcadura del Pedraforca. Son interpretaciones estilizadas con escala vertical adaptada; no se afirma que todos los pequeños accidentes sean reconocibles a esta resolución. No se añade nieve ni caminos inventados.

Las tarjetas cargan SVG locales y las fichas públicas y del mapa comparten el selector de ilustración/fotografía. Cada ilustración muestra orientación y atribución; `/fonts#relleu` explica las fuentes, licencia y transformaciones. El generador funciona fuera de la aplicación y conserva procedencia y hashes. El navegador no solicita mosaicos de elevaciones; los SVG con nombre por contenido se cachean un año. El lector sin conexión no incorpora imágenes ni información privada.

Compilación de producción con TypeScript correcta y 540 páginas generadas. Las 13 pruebas unitarias verifican también la decodificación Terrarium, la validación de rejillas ICGC, el relieve de dos cimas, la independencia del nombre y la cobertura, integridad y atribución de los 522 archivos. `scripts/product-check.cjs` completa 66 comprobaciones, incluidas 63 con axe-core 4.14.0 y los flujos privados simulados, sin infracciones detectadas ni errores JavaScript. Comprueba alternar ilustración y fotografía a 320, 390 y 1280 px.

`scripts/mountain-art-check.cjs` verifica siete perfiles, incluido un cerro costero bajo, con capturas y comprobaciones de imágenes decodificadas, orientación, créditos, cabeceras de caché y ausencia de desbordamientos o peticiones a ICGC/Mapzen desde el navegador. Las pruebas del cuaderno pasan en 320, 375, 390, 768 y 1280 px. Se revisan visualmente los perfiles y la ficha del Pedraforca en móvil y escritorio. No se modifican tablas ni datos personales.

La prueba de navegación detectó que el reinicio del scroll de Next.js podía sobrescribir la posición del catálogo mientras se desmontaba la página anterior. Se ignoran los eventos de scroll después del cambio de ruta. `scripts/improvements-check.cjs` confirma volver al bloque ampliado de 96 tarjetas y recuperar la posición, filtros y mapa, además de abrir, recargar y eliminar fichas sin conexión. La prueba espera también las fuentes y la comprobación de visibilidad del enlace antes de medir la posición de salida.

## Producto y uso diario — 21 de octubre de 2026

Identidad e iconos SVG compartidos, cabecera y pie coherentes, páginas de proyecto, ayuda, fuentes, privacidad y contacto. Se publica el responsable Marc Gonzalez Tarrio y el correo marcgonzaleztarrio@gmail.com, facilitados por el propietario. Se mantienen Fraunces y Hanken Grotesk, servidas desde la propia web.

Las fichas públicas y las ventanas del mapa comparten una consulta de contexto restringida a los identificadores del catálogo. Wikidata debe coincidir en nombre y coordenadas (a menos de 1 km), sin ambigüedad y con altitud compatible cuando esté disponible. Solo se muestran fotos de Commons con autor y licencia permitida; las demás fichas mantienen una ilustración. Se ha comprobado también la respuesta real de Canigó, Q6650, con foto de Robert66 en dominio público. No se afirma que los 522 cims dispongan de fotografía. La antigua búsqueda abierta de imágenes se retira.

Formulario único de fecha, notas y foto opcional, con previsualización, compresión y confirmación al descartar cambios. Un error de foto después de guardar la visita mantiene el formulario y el archivo para reintentar sobre el mismo registro. Si falla el enlace del archivo al registro, se solicita eliminar el archivo recién subido. La galería privada incorpora todas las visitas, filtro por año, visor con flechas, edición y renovación de enlaces temporales. Las fotos privadas se cargan directamente desde Storage, sin pasar por el optimizador público de imágenes de Next.js.

Mapa con agrupación en coordenadas de pantalla para separar los controles de selección. La barra de zoom se sitúa fuera del área de puntos; las cimas individuales permiten abrir la ficha con Enter o espacio. Los grupos que persisten con el zoom máximo ofrecen una lista de cimas. Se corrige asimismo el guardado de búsquedas al recargar inmediatamente y se conservan idioma y tema en la página 404.

Compilación de producción con TypeScript correcta (540 páginas generadas); ocho pruebas unitarias correctas. `scripts/product-check.cjs` realiza 60 comprobaciones automáticas con axe-core 4.14.0 sobre portada, ajustes, acceso, mapas, fichas, páginas informativas, 404, formulario, galería y visor a 320, 390 y 1280 px, incluyendo tema oscuro y recuperación de fotos. Sin infracciones detectadas en las reglas WCAG A/AA ejecutadas ni desbordamientos. Esto no constituye una auditoría manual completa de accesibilidad.

El mismo script verifica fallos de subida y de enlace de foto, limpieza del archivo de prueba, reintento sin duplicados, dos visitas con fotos independientes, filtro anual, navegación, actualización de URL y restauración del foco. La cuenta y los servicios privados son simulados; no se modifican datos personales reales. Los informes y capturas están en `.next/product-check`. Esta versión no cambia tablas, permisos ni migraciones de Supabase.

`scripts/improvements-check.cjs` vuelve a comprobar fuentes reales, bloques de 48/96 tarjetas, metadatos, restauración de filtros/scroll/mapa, 528 entradas del sitemap y descargas públicas con la red desactivada. `scripts/browser-check.cjs` cubre el cuaderno completo en 320, 375, 390, 768 y 1280 px. No se cachean credenciales, notas, API ni fotos privadas en el lector sin conexión.

En la primera comprobación publicada, la consulta del servidor de Vercel devolvía 502 aunque las fuentes respondían correctamente desde el navegador. Se incorpora una recuperación mediante [CORS anónimo de MediaWiki](https://www.mediawiki.org/wiki/API:Cross-site_requests), con las mismas validaciones, sin cookies ni cabeceras de autorización y con un tiempo límite de 20 segundos. La prueba fuerza el fallo del servidor y comprueba una foto real de Canigó, su autoría y licencia; también simula la caída de ambas vías y el reintento. La privacidad menciona las consultas a Wikidata y Wikimedia.

## Revisión tipográfica — 21 de octubre de 2026

Fraunces en títulos y cursivas, combinada con Hanken Grotesk en textos, controles y cifras. Ajustados pesos, tamaños e interletrado de portada, marca, catálogo, fichas y diálogos. Fuentes servidas desde la propia web. Compilación de producción correcta y carga real de ambas familias verificada. Las pruebas del navegador pasan en 320, 375, 390, 768 y 1280 px sin desbordamientos ni errores de JavaScript; revisadas las capturas de portada y catálogo en escritorio y móvil.

## Catálogo, fichas e historial — 21 de octubre de 2026

Aplicadas las siete mejoras: fuentes DM Sans y Manrope servidas localmente; acceso a explorar desde la primera pantalla móvil y progreso de invitado compacto; catálogo en bloques de 48 con búsqueda global; 522 fichas públicas estáticas con URL canónica y sitemap; visitas repetidas con fecha, notas y foto independientes; restauración de filtros, posición y mapa en la pestaña; fichas públicas descargables con un lector independiente que funciona sin red.

`npm test`: siete pruebas correctas. Compilación con TypeScript correcta, con 535 páginas estáticas generadas. `scripts/browser-check.cjs` verifica el cuaderno con respuestas simuladas en 320, 375, 390, 768 y 1280 px: visitas repetidas, fotos independientes, borrado aislado, progreso de cimas únicas, favoritos, CSV, recuperación de errores, mapa, idiomas y tema oscuro. No hay desbordamientos ni errores de JavaScript.

`scripts/improvements-check.cjs` confirma la carga real de ambas fuentes, 48/96 tarjetas, búsqueda global, fichas con contenido y metadatos en HTML, restauración del scroll y zoom del mapa, 523 entradas del sitemap y 404 para cimas inexistentes. En modo sin conexión verifica abrir y recargar una ficha guardada, avisar de una cima sin descargar y eliminar una descarga. La caché contiene únicamente el lector público, su script y el icono; no se guardan sesiones, API, fotos ni notas privadas.

La migración `20261021093140_repeated_summit_visits.sql` está aplicada en Supabase. Las primeras ascensiones se conservan y las visitas adicionales se guardan con RLS en `ascent_visits`. Las pruebas SQL verifican que dos visitas a la misma cima se conservan, que editar o borrar una no modifica la otra, y que otras identidades y visitantes anónimos no acceden a ellas. También rechazan fechas futuras, notas excesivas y rutas de fotos ajenas. Las transacciones terminan en ROLLBACK.

La comprobación de cuotas utiliza una copia temporal de la función desplegada y tablas temporales: permite reemplazar tanto fotos originales como de visitas repetidas al alcanzar el límite, y rechaza cargas adicionales, sustituciones sin registro y accesos anónimos. La prueba previa de permisos de Storage continúa pasando. Los asesores de seguridad mantienen los avisos anteriores, sin hallazgos nuevos. Las capturas e informes están en `.next/browser-check` y `.next/improvements-check`.

Las pruebas del cuaderno usan respuestas simuladas; las pruebas SQL comprueban los permisos reales sin conservar datos de prueba. El modo sin conexión permite consultar fichas públicas, no mapas topográficos ni editar el cuaderno.

Verificación posterior al despliegue en `https://100-cims-cat.vercel.app`: fuentes, bloques de 48/96 tarjetas, fichas y metadatos, restauración de navegación y mapa, sitemap, 404 y lectura de descargas con la red desactivada correctos. Sin errores de JavaScript. La prueba espera a que Next.js termine de actualizar los metadatos al navegar entre páginas.

## Iconos y metadatos — 20 de octubre de 2026

Añadidos favicon ICO (16, 32 y 48 px), SVG, icono Apple de 180 px y manifest con iconos de 192 y 512 px. La tarjeta Open Graph de 1200 × 630 px también se utiliza en Twitter. La URL canónica y el sitemap usan el dominio de producción ya referenciado en la aplicación. `robots.txt` permite la portada y excluye las rutas de API y autenticación.

Compilación de producción con TypeScript y los cinco tests existentes correctos. Chromium verifica las etiquetas generadas, las respuestas HTTP de todos los iconos y la tarjeta social, las dimensiones de las imágenes, el manifest, robots y sitemap. La búsqueda de invitado funciona a 320, 390 y 1280 px, sin desbordamiento horizontal ni errores de JavaScript. Revisados visualmente el icono y la tarjeta social. Las capturas están en `.next/metadata-check/`.

Esta revisión es local; no se ha desplegado ni se han probado cuentas o datos privados.

## Corrección de subida de fotos — 13 de octubre de 2026

La política INSERT rechazaba la comprobación previa de Supabase Storage: en ese momento `metadata.size` todavía no existe, aunque la llamada de cuota desde el navegador permita la foto. Se reprodujo el rechazo usando una copia temporal de `storage.objects` con la política real y el rol `authenticated`.

La migración `20261013191912_fix_photo_upload_permission_probe.sql`, aplicada en Supabase, usa `metadata.size`, después `metadata.contentLength` y finalmente una reserva conservadora de 512 KiB cuando falta el tamaño. Se mantienen el bucket privado, la restricción por propietario y los límites de almacenamiento.

`tests/photo-upload-policy.sql` verifica la política aplicada: cinco casos válidos aceptados y siete inválidos rechazados, incluyendo otra cuenta, otro bucket, archivos vacíos, exceso de tamaño y ausencia de usuario. Las pruebas usan una tabla temporal y terminan con ROLLBACK; no modifican cuentas, ascensiones ni archivos reales. Los cinco tests de `npm test` también pasan. Los asesores de seguridad mantienen los mismos avisos anteriores, sin nuevos hallazgos.

Esta comprobación valida la regla de permisos contra Supabase; no realiza una subida real desde una sesión de usuario.

## Validación anterior

Fecha: 7 de octubre de 2026.

## Resultado

Compilación de producción (`next build`) y comprobación de TypeScript correctas. Los cinco tests de lógica (`npm test`) pasan. `git diff --check` no encuentra errores de espacios.

La interfaz se ha probado en Chrome con Playwright, usando una cuenta y respuestas de datos simuladas. Las pruebas de base de datos se han ejecutado por separado contra el proyecto Supabase del repositorio y con transacciones revertidas; no se han conservado registros de prueba.

| Anchura | Sin desbordamiento horizontal | Registro, edición, favoritos y CSV | Mapa con mosaicos cargados | Tema oscuro e inglés |
| --- | --- | --- | --- | --- |
| 320 px | Sí | Sí | Sí | Sí |
| 375 px | Sí | Sí | Sí | Sí |
| 390 px | Sí | Sí | Sí | Sí |
| 768 px | Sí | Sí | Sí | Sí |
| 1280 px | Sí | Sí | Sí | Sí |

Se han revisado visualmente las capturas del editor, catálogo y mapa en móvil. Los diálogos y formularios caben en pantalla; los controles principales tienen una altura mínima de 44 px. Las capturas y el informe JSON se generan en `.next/browser-check/`.

## Flujos comprobados

- Búsqueda sin acentos y combinación de pendientes, esenciales, favoritos, comarca y altitud.
- Registro de ascensiones anteriores y edición de fecha y notas. Validación de fechas reales y rechazo de fechas futuras.
- Subida de una imagen de prueba, conversión en el navegador y actualización del registro conservando fecha y notas.
- Adición de favoritos y exportación de ascensiones, notas y favoritos pendientes a CSV. Escapado de texto multilínea y protección frente a fórmulas de hojas de cálculo.
- Cancelación y confirmación del borrado de una ascensión con foto.
- Ordenación por distancia desde una cima de referencia y desde la ubicación autorizada al navegador. Las distancias son en línea recta.
- Cambio de idioma a inglés y tema oscuro.
- Apertura de fichas desde el catálogo y cierre con Escape. El invitado puede acceder al formulario de inicio de sesión desde una ficha.
- Recuperación tras un error de carga: se impiden las escrituras hasta recuperar el cuaderno. Un error de guardado mantiene el formulario abierto y conserva las notas introducidas.

## Base de datos

Las migraciones locales coinciden con las aplicadas en Supabase:

- `20261007092325_journal_notes_and_favorites.sql`: notas privadas y tabla de favoritos con RLS, referencias con borrado en cascada e índice por cima.
- `20261007093615_restrict_favorite_privileges.sql`: eliminación de los permisos heredados y concesión explícita de SELECT, INSERT y DELETE a usuarios autenticados.

Las consultas de verificación confirman que el propietario puede guardar y leer favoritos y notas; otra identidad no ve sus favoritos. Las transacciones de prueba terminaron con ROLLBACK.

La revisión de asesores no detecta avisos de seguridad nuevos para las tablas modificadas. Mantiene avisos previos sobre las [funciones de cuota con SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), cuyo código limita los datos al usuario autenticado, y la [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), desactivada en el proyecto. El acceso de esta aplicación usa enlaces de correo y Google. Los [índices de referencias aún sin uso registrado](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) se conservan para las referencias y operaciones de borrado en cascada.

## Alcance

Las pruebas del navegador comprueban el flujo de la interfaz con respuestas simuladas; no envían correos de acceso, no utilizan cuentas personales ni suben fotos a almacenamiento real. Se ha verificado el esquema y el acceso real de Supabase mediante SQL. No se ha realizado un despliegue ni una prueba física en Safari/iOS.

El servidor de desarrollo existente se mantiene. Para las pruebas se utilizó un servidor de producción independiente, cerrado al terminar.
