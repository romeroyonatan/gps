## Context

Motivación y alcance en `proposal.md`; comportamiento en `specs/`. Estado actual relevante:

- `personas` guarda cargos en la tabla `cargos` con `grupo_id NOT NULL`, y su catálogo
  `TIPOS_DE_CARGO` sólo tiene cargos de grupo.
- `estructura` tiene distritos y grupos; la diócesis no es entidad (una por instancia).
- `Core` expone `config`, `logger`, `reloj`, `bd`, `nuevoId`. No hay hash, ni almacenamiento.
- `Module` sólo aporta GraphQL y migraciones. El backend (`services/backend/src/server.ts`)
  sirve `/graphql`, `/health` y la web con `Bun.serve`.
- La spec de arquitectura (§9) ya fijó `archivos` como módulo, `Almacenamiento` en `Core`,
  la subida en tres pasos y la autorización de descarga delegada en el dueño.
- No hay `auth`: todas las operaciones las hace un usuario ficticio. Quien firma queda
  determinado por el cargo, no por quién está logueado.

## Goals / Non-Goals

**Goals:**
- Que el diseño de sellos y de firmas sobreviva sin migrar datos a la llegada de `auth` y
  de la firma con certificado.
- Web y mobile con el mismo formato de trazos y el mismo PDF.

**Non-Goals:**
- Verificar la identidad de quien firma (llega con `auth`).
- Firma con certificado (PAdES) — ver Decisión 6.
- Aprobación de la asociación dentro del sistema: el trámite termina en `firmado`.
- Proporción de dirigentes por beneficiarios; planificación obligatoria.
- Almacenamiento S3/R2: sólo disco local.
- Firmar sin conexión.

## Decisions

### 1. Estados y congelamiento

```
 borrador --emitir--> emitido --3/3 firmas--> firmado
                         |                       |
                         +-------> anulado <-----+
                                      |
                                      +--re-emitir--> borrador nuevo (reemplazaA = id)
```

Emitir copia a `participantes_emitidos` la fotografía de cada persona (mismo patrón que
`Afiliado`) y guarda el PDF v0 en `archivos` con su sha256 (`H0`) en la fila del permiso.
Editar un emitido está prohibido; cambiar algo es anular y re-emitir. Se prefirió a
versionar el permiso porque cada versión necesitaría sus propias firmas y el usuario ya
piensa en "anular y hacer otro".

El permiso guarda qué unidades participan (change `unidades`, que va antes): los candidatos
salen de ellas y el PDF las lista. Los participantes del borrador se guardan sólo como
`personaId` + marca; la fotografía se
toma al emitir, no al agregar, para que el PDF refleje los datos del día de la emisión.

### 2. Firmantes resueltos por cargo, no por usuario

La fila `firmas` se crea al registrar la firma, no al emitir: los firmantes pendientes se
calculan (grupo → jefe de grupo y director; `estructura` → distrito del grupo →
comisionado). Al firmar se resuelve la persona que ocupa el cargo **ese día** y se guarda
su fotografía. Así un cambio de comisionado entre la emisión y la firma no deja firmas
pendientes a nombre de alguien que ya no es.

Si hay más de una persona en el cargo ese día (la tabla no lo impide), se toma la primera
por `desde` y se registra un warning en el log. `ponytail:` elegir cuál firma cuando haya
`auth`: será la persona logueada.

Pide a `personas.publico.ts` un método nuevo:
`ocupantesDelCargo(cargo, ambitoId | null, fecha)`.

### 3. Cargos con ámbito

`TIPOS_DE_CARGO` suma `ambito` por entrada. La tabla `cargos` reemplaza `grupo_id` por
`ambito_id` nullable (el ámbito no se guarda: sale del tipo de cargo en el catálogo, que es
la única fuente). SQLite no altera nullability: la migración recrea la tabla copiando los
datos. El UNIQUE pasa a `(persona_id, ambito_id, cargo, desde)`; para diócesis `ambito_id`
es NULL y SQLite trata NULLs como distintos en UNIQUE, así que el duplicado exacto de un
jefe scout diocesano no se ataja en la base: se valida en el servicio.

Alternativa descartada: columnas `grupo_id` y `distrito_id` separadas. Una tercera columna
por ámbito futuro no escala y obliga a un CHECK de "exactamente una".

### 4. Sello HMAC con clave rotable

```
sello = HMAC-SHA256(clave[claveId],
          H0 | cargo | personaId | fecha | trazosCanonicos)
```

`Core` suma `sellador` con `sellar(datos) -> { sello, claveId }` y
`verificar(datos, sello, claveId) -> boolean` (devuelve `false` si la clave no existe). Va en
`Core` porque `/servidor` no puede importar `node:crypto` y `crypto.subtle` no existe en
Hermes.

Las claves **no** entran en `Config`: las lee el backend de variables de entorno y se las
pasa a `crearCore`, igual que la ruta de la base (ver el comentario de `leerRutaDeBd`).
Ningún módulo las lee —usan el `sellador` ya construido—, así que meterlas en `Config` sólo
las expondría a todos. Lo mismo vale para el directorio de archivos.

`trazosCanonicos` es la serialización JSON de los trazos con coordenadas redondeadas a 4
decimales: sin eso, un re-guardado que cambie la representación del número rompería sellos
válidos.

Se eligió HMAC y no un sha256 pelado porque sin secreto quien accede a la base recalcula los
sellos. Mismo costo.

**Rotación preventiva:** agregar clave nueva a `clavesDeSello`, cambiar
`claveDeSelloActiva`, desplegar. Las firmas viejas verifican con su `claveId`. Para retirar
una clave: re-sellado que verifica con la vieja y sólo si cierra sella con la nueva; nunca
re-sellar sin verificar. El re-sellado no se construye ahora (no hay clave que retirar).

**Clave filtrada:** se rota igual; las firmas con esa `claveId` se consideran no confiables
y no se re-sellan. Si el permiso sigue vigente se anula y re-emite. No se construye ahora.

### 5. Trazos

`{ ancho: number, alto: number, trazos: [[x, y], ...][] }` con x, y normalizados a 0..1
respecto del lienzo. El mismo tipo en `salidas/dominio` para web y mobile. Web: `<canvas>`
con pointer events, sin librería. Mobile: `react-native-svg` +
`react-native-gesture-handler` (el primero ya suele venir con Expo; verificar) antes que una
librería de firma basada en WebView.

### 6. PDF con `pdf-lib`, en el servidor

`pdf-lib` es JS puro: corre en Bun y dejaría la puerta abierta a generarlo en el teléfono.
Se genera en `salidas/servidor` a partir de datos congelados, así que es determinista salvo
metadatos: se fijan `CreationDate`/`ModDate` a la fecha de emisión (de `core.reloj` al
emitir) y se omite `Producer` variable, para que regenerar dé los mismos bytes.

Sólo el PDF v0 se guarda en `archivos` (es el que ancla `H0`). El PDF para imprimir y el
firmado se generan al pedirlos: v0 + firmas estampadas (trazos dibujados como paths) +
páginas con los escaneos. No guardarlos evita que haya dos verdades.

**El firmado se compone; el escaneo no es el documento.** El caso que lo obliga es el orden
real: el sacerdote firma el papel cuando se lo cruzan, que puede ser antes de que firmen en
la app. Si el escaneo fuera el documento final, mostraría dos líneas vacías que en el
sistema ya están firmadas. Componiendo, la página principal siempre refleja el estado actual
—trazos dibujados para las firmas en la app, "Firmado en papel — ver anexo" para las de
papel— y el escaneo va como página anexa, como prueba de lo que se firmó en papel ese día.

No se recorta el dibujo del escaneo para estamparlo en la línea: pide detectar la zona de la
firma y se rompe con cualquier foto torcida. La marca con remisión al anexo es lo que hacen
las plataformas de firma con documentos firmados fuera del sistema.

Al imprimir se avisa que conviene registrar antes las firmas en la app, sin bloquear: el
papel no siempre se puede volver a pedir.

La firma con certificado (futura) firmará el PDF firmado generado, que para entonces se
guardará.

### 7. `archivos`: módulo + rutas HTTP en el backend

`archivos` posee la tabla (`id, nombre, tipo, tamano, sha256, modulo, recursoId,
confirmado, creadoEn`) y las mutations `solicitarSubida` / `confirmarSubida`. Los bytes no
pasan por GraphQL: el backend suma `PUT /archivos/:id?token=` y `GET /archivos/:id`.

Las rutas viven en `services/backend` y llaman a `ctx.archivos`; no se extiende `Module`
con rutas HTTP (un solo consumidor). `ponytail:` si un segundo módulo necesita rutas propias,
agregar `routes` a `Module`.

El token de subida es un HMAC del id + vencimiento con el mismo `sellador` (otra clave
lógica no hace falta: el prefijo del mensaje separa los usos).

Autorización de descarga: `archivos` recibe en `createServices` un registro de
autorizadores `{ [modulo]: (recursoId, actor) => Promise<boolean> }`. Como `archivos` no
puede depender de `salidas` (ciclo), el registro se arma en la composición del backend a
partir de los servicios construidos. Hoy `salidas` autoriza todo (no hay `auth`); la firma
de la función ya recibe `actor` para no cambiarla después.

HEIC/HEIF se convierte a JPEG en `confirmarSubida`: el tamaño se valida contra los bytes
recibidos, y el hash, el tipo y el tamaño registrados son los del JPEG; el original se
descarta. La conversión es una capacidad de `Core` (`conversorDeImagenes.aJpeg(bytes)`),
implementada en backend con `heic-convert` (libheif en JS/wasm, sin binarios nativos; `sharp`
precompilado no decodifica HEIC). Va en el servidor y no en los clientes porque el caso que
los clientes no cubren es la web desde una Mac, que sube el `.heic` tal cual. `ponytail:`
convertir en el request tarda 1-2 s por foto de 12 MP; pasar a una cola si pesa.

`Almacenamiento` en `Core`: `guardar`, `leer`, `eliminar` sobre claves. Implementación de
disco en `services/backend`, con el directorio leído del entorno igual que la ruta de la
base; en demo, en memoria.
`urlDeSubida` de la spec §9.1 no entra: con rutas propias la URL la arma `archivos`. Entra
cuando llegue S3.

### 8. Dependencias

Requiere el change `unidades` aplicado: sin unidades, "qué tropa va" no se puede expresar.

```
 salidas --> personas --> estructura
    |    \--> estructura
    +------> archivos
```

`salidas` usa `archivos` para guardar el PDF v0, escaneos y adjuntos. Los escaneos y
adjuntos los sube el cliente con `modulo: 'salidas'`, `recursoId: permisoId`; `salidas`
valida al asociarlos que el archivo esté confirmado y sea suyo.

### 9. Anticipación

`salidas/src/dominio/config.ts`: `DIAS_DE_ANTICIPACION = 15` provisorio. `emitir` devuelve
`{ permiso, avisos: Aviso[] }`; el aviso lo calcula una función pura del dominio que usan
también las pantallas antes de apretar "emitir".

### 10. Dónde vive cada cosa

`/dominio` decide con datos recibidos por parámetro; `/servidor` orquesta efectos en
archivos con nombre del negocio; `servicio.ts` es contrato y composición.

```
 salidas/src/dominio/
   modelos.ts        Permiso, Participante, Firma, Adjunto, estados
   permisos.ts       transiciones, minimo un dirigente, candidatos segun unidades
   anticipacion.ts   el aviso; lo usan tambien las pantallas
   firmas.ts         firmantes requeridos (grupo + distrito -> tres cargos con ambito)
                     y mensajeASellar(H0, cargo, personaId, fecha, trazos)
   trazos.ts         tipo y serializacion canonica
   config.ts         DIAS_DE_ANTICIPACION

 salidas/src/servidor/
   borradores.ts     crear, editar, unidades participantes, participantes
   emision.ts        emitir, anular, re-emitir; toca reloj, ids y archivos
   firmas.ts         registrar firma en app y en papel, sellar y verificar con Core
   pdf.ts            armado con pdf-lib
   consultas.ts      listados
   servicio.ts       contrato + composicion
```

Tres reglas que podrían parecer del servidor viven en `/dominio` porque deciden con
parámetros y las pantallas las necesitan igual: quiénes son los firmantes requeridos, qué
candidatos hay según las unidades elegidas, y qué mensaje se sella. Del sello, sólo el HMAC
necesita `Core`.

**El PDF se queda en `/servidor` aunque `pdf-lib` sea isomorfo y no toque la plataforma.**
`/dominio` lo importa el navegador, y un import de valor a `pdf-lib` entraría al bundle de
mobile, donde Metro no hace tree-shaking. Es el mismo argumento por el que `@gps/core` tiene
tres puertas.

`archivos` no se parte: solicitar, confirmar y descargar son orquestación de efectos sin
decisión separable, y quedan en su `servicio.ts`. Lo único puro —tipos y tamaños admitidos—
va a su `/dominio`.

## Risks / Trade-offs

- [Sin `auth` cualquiera firma por cualquiera] → Aceptado por ser prototipo; la firma
  guarda la fotografía del ocupante, y `auth` sólo suma la validación "sos vos".
- [La firma en papel no se verifica] → Se declara quién firmó al subir; queda el escaneo
  como respaldo. Con `auth`, se registra quién lo declaró.
- [Recrear `cargos` en SQLite pierde datos si falla a mitad] → La migración corre en
  transacción (como las demás) y tiene test con datos previos.
- [Determinismo del PDF depende de `pdf-lib`] → Test que genera dos veces y compara bytes;
  si una versión nueva de `pdf-lib` rompe esto, el hash guardado sigue siendo el de v0 en
  `archivos`, que no se regenera.
- [Una clave de sello en variable de entorno se filtra con el entorno] → Aceptado en
  prototipo. Está en la lista de cosas a revisar antes de datos reales.
- [`pdf-lib` no lee HEIC] → `archivos` convierte a JPEG al confirmar (Decisión 7); nada
  que no sea JPEG, PNG o PDF queda guardado.
- [Decodificar HEIC en JS consume memoria y CPU en el request] → Aceptado para subidas de a
  una; test con una foto real de iPhone para medir.

## Migration Plan

1. Migración de `personas` (recrear `cargos`) al arrancar, como las demás.
2. Migraciones iniciales de `archivos` y `salidas`.
3. Nuevas variables de entorno, leídas por el backend (no por `Config`): claves de sello y
   directorio de archivos. El backend falla al arrancar si faltan fuera de
   `desarrollo`/`demo`/`prueba`, que usan valores fijos.
4. Rollback: no hay datos reales; se restaura la base anterior.

## Open Questions

- Cantidad real de días de anticipación (hoy 15, provisorio).
- Si el jefe scout diocesano puede firmar en lugar del comisionado cuando el distrito no
  tiene uno (hoy no).
