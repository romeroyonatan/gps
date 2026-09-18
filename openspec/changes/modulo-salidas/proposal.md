## Why

Cada salida o acampe de un grupo necesita un permiso presentado ante la asociación, con la
lista de participantes y firmado por el jefe de grupo, el director del grupo y el
comisionado de distrito. Hoy ese papel se arma a mano, las firmas se juntan por fuera y no
queda registro. Es además el primer consumidor real de dos piezas que la arquitectura dejó
diseñadas y sin construir: los archivos subidos por usuarios y los cargos fuera del ámbito
del grupo.

## What Changes

- Módulo nuevo `salidas`: un grupo carga un permiso de salida (lugar, fechas, cómo se
  viaja, participantes elegidos entre sus miembros activos marcando dirigentes y
  beneficiarios) y lo emite. Emitir genera un PDF y congela los datos.
- Firmas mixtas por firmante: cada uno de los tres firmantes firma en la app dibujando la
  firma, o en papel sobre el PDF impreso, subiendo después el escaneo. Con las tres firmas
  el permiso queda firmado y se puede descargar el PDF final.
- Cada firma en la app se sella con un HMAC sobre el hash del PDF emitido, los trazos, el
  cargo, la persona y la fecha, con identificador de clave para poder rotarla.
- Anular un permiso emitido o firmado, y re-emitirlo como borrador nuevo con los datos
  copiados.
- Adjuntos opcionales (planificaciones) en cualquier estado.
- Aviso, sin bloqueo, cuando se emite con menos anticipación que la configurada.
- Módulo nuevo `archivos`: registro de archivos con dueño, subida en tres pasos y descarga
  autorizada por el módulo dueño.
- `personas`: los cargos pasan a tener ámbito (`grupo`, `distrito`, `diocesis`), con dos
  cargos nuevos: comisionado de distrito y jefe scout diocesano. **BREAKING** para el
  esquema de la tabla `cargos` (migración con datos) y para la API GraphQL de cargos, que
  hoy asume un grupo.
- `core`: capacidades nuevas de sellado (HMAC con claves rotables) y de almacenamiento de
  bytes.
- Pantallas en web y en mobile.

## Capabilities

### New Capabilities

- `salidas`: el trámite del permiso de salida, desde el borrador hasta el firmado,
  incluidos participantes, firmas, sellos, anulación, adjuntos y PDF.
- `archivos`: guardar, subir y descargar archivos con dueño y autorización delegada en el
  dueño.
- `cargos`: los cargos de las personas con su ámbito y su período, y la consulta de quién
  ocupaba un cargo un día dado.

### Modified Capabilities

(ninguna: no hay specs previas en `openspec/specs/`)

## Impact

- Paquetes nuevos: `packages/salidas`, `packages/archivos`.
- `packages/personas`: catálogo de cargos, tabla `cargos` y migración, `publico.ts`,
  esquema GraphQL y pantallas de cargos.
- `packages/core`: `Core` y `Config` suman sellado y almacenamiento; implementaciones en
  `services/backend` (y en demo).
- `services/backend`: rutas HTTP para subir y descargar bytes, junto a `/graphql`.
- `packages/demo`: siembra de cargos distritales y de permisos de ejemplo.
- `apps/web` y `apps/mobile`: pantallas del trámite, pad de firma, cámara o selector de
  archivos.
- Dependencias nuevas: generación de PDF (`pdf-lib`) y los paquetes de pad de firma y
  cámara en mobile.
- `schema.gql`, `docs/arquitectura.md` y `CLAUDE.md` (salen de "qué NO existe": archivos y
  cargos fuera del grupo).
