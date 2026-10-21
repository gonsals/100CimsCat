# Validación de funcionalidades y móvil

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
