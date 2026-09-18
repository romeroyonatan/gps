## 1. Core: sellador y almacenamiento

- [x] 1.1 Leer claves de sello y directorio de archivos del entorno en `services/backend` (no en `Config`, igual que la ruta de la base), con valores fijos en desarrollo/demo/prueba y error si faltan en producción; verificar con test de cada lectura
- [x] 1.2 Sumar `sellador` (`sellar`, `verificar`) a `Core` con implementación HMAC-SHA256 en `services/backend` y en demo; verificar con tests: sella y verifica, datos alterados no verifican, clave anterior verifica, clave inexistente devuelve false
- [x] 1.3 Sumar `Almacenamiento` (`guardar`, `leer`, `eliminar`) a `Core`, con implementación en disco en backend y en memoria en demo; verificar con test de ida y vuelta de bytes
- [x] 1.4 Sumar `conversorDeImagenes.aJpeg` a `Core` con `heic-convert` en backend; verificar con test que convierte una foto HEIC real a un JPEG legible y rechaza bytes inválidos
- [x] 1.5 Verificar que `bun run check` pasa y que la regla de portabilidad sigue sin excepciones

## 2. Personas: cargos con ámbito

- [x] 2.1 Sumar `ambito` a cada entrada de `TIPOS_DE_CARGO` y los cargos `comisionadoDeDistrito` y `jefeScoutDiocesano`; verificar con test del catálogo
- [x] 2.2 Cambiar `cargos.grupo_id` por `ambito_id` nullable y generar la migración que recrea la tabla copiando datos; verificar con test que aplica la migración sobre una base con cargos de grupo y los conserva
- [x] 2.3 Validar en el servicio que el ámbito del cargo coincide con la entidad (grupo abierto, distrito abierto, ninguna) y el duplicado de diócesis; verificar con los escenarios de `specs/cargos`
- [x] 2.4 Sumar `ocupantesDelCargo(cargo, ambitoId, fecha)` a `publico.ts` y al servicio; verificar con escenarios de ocupado, último día y vacante
- [x] 2.5 Actualizar esquema GraphQL de cargos, pantallas de cargos en web y mobile y la siembra de demo (un comisionado por distrito, un jefe scout diocesano); verificar `bun run schema` sin diferencias inesperadas y la demo navegando a mano

## 3. Archivos

- [x] 3.1 Crear `packages/archivos` desde `sistema`, con tabla y migración inicial; verificar que el backend arranca con el módulo registrado
- [x] 3.2 Poner tipos y tamaños admitidos en `archivos/dominio` e implementar `solicitarSubida` (valida tipo, tamaño, dueño; devuelve id y URL con token de vencimiento) y `confirmarSubida` (valida tamaño, convierte HEIC/HEIF a JPEG y guarda sha256 del resultado); verificar con escenarios de `specs/archivos`
- [x] 3.3 Sumar rutas `PUT /archivos/:id` y `GET /archivos/:id` en `services/backend`, con registro de autorizadores por módulo armado en la composición; verificar con test HTTP de subida completa, URL vencida, dueño que autoriza y dueño no registrado

> Depende del change `unidades`: los participantes se eligen por unidad.

## 4. Salidas: dominio

- [x] 4.1 Crear `packages/salidas` con `dominio/modelos.ts` (permiso, participante, participante emitido, firma, adjunto, estados) y `dominio/config.ts` con `DIAS_DE_ANTICIPACION`; verificar tipos con `bun run check`
- [x] 4.2 `dominio/permisos.ts`: validación de fechas, marca por categoría, mínimo un dirigente, transiciones de estado y candidatos a participante según las unidades elegidas; verificar con test unitario de cada regla
- [x] 4.3 `dominio/anticipacion.ts`: el aviso a partir de la fecha de emisión y la de inicio; verificar con test de los dos escenarios de "Aviso de anticipación"
- [x] 4.4 `dominio/firmas.ts`: firmantes requeridos a partir del grupo y su distrito, y `mensajeASellar`; verificar con test de que los tres cargos salen con su ámbito y de que el mensaje es estable
- [x] 4.5 `dominio/trazos.ts`: tipo de trazos normalizados y serialización canónica (redondeo a 4 decimales); verificar con test de que dos representaciones equivalentes dan la misma cadena

## 5. Salidas: servidor

- [x] 5.1 Tablas y migración (permisos, participantes, participantes emitidos, firmas, adjuntos) y registro en `modules.ts` con `dependencies: ['personas', 'estructura', 'archivos']`; verificar que el backend arranca y aplica migraciones
- [x] 5.2 `servidor/borradores.ts`: crear y editar el permiso, elegir unidades participantes, agregar y quitar participantes apoyándose en las reglas de `dominio/permisos.ts`; verificar con escenarios de "Cargar un permiso en borrador", "Unidades que participan" y "Participantes"
- [x] 5.3 `servidor/pdf.ts`: PDF v0 con `pdf-lib`, determinista; verificar con test que genera dos veces y compara bytes
- [x] 5.4 `servidor/emision.ts`: emitir con fotografía de participantes y unidades, PDF v0 a `archivos`, `H0` y avisos; verificar con escenarios de "Emitir un permiso" y "Aviso de anticipación"
- [x] 5.5 `servidor/firmas.ts`: firmar en la app resolviendo el ocupante del cargo y sellando con `Core`; rechazar repetida, vacía o vacante; verificar con escenarios de "Firmantes" y "Firma en la app"
- [x] 5.6 `servidor/firmas.ts`: verificación de sellos expuesta por firma; verificar con escenarios de "Verificación de sellos" alterando la base en el test
- [x] 5.7 `servidor/firmas.ts`: firma en papel con escaneo compartido y paso a `firmado` con la tercera; verificar con escenarios de "Firma en papel" y "Permiso firmado"
- [x] 5.8 `servidor/pdf.ts`: PDF para imprimir y PDF firmado compuestos del estado actual (trazos estampados, marca "ver anexo" en las de papel, escaneos como páginas anexas); verificar con test que firmar en papel primero y firmar en la app primero dan la misma página principal, y que el de imprimir cambia al registrar una firma
- [x] 5.9 `servidor/emision.ts` y `servidor/consultas.ts`: anular, re-emitir, adjuntos, autorizador de descarga y listado por grupo; verificar con los escenarios restantes de `specs/salidas`
- [x] 5.10 `servidor/servicio.ts` con el contrato y la composición de los archivos anteriores, esquema GraphQL y `bun run schema`; regenerar tipos del cliente; verificar `bun run check`

## 6. Web

- [x] 6.1 Listado de permisos del grupo y formulario de borrador con selector de unidades y de participantes, diseñado a 375px; verificar en `bun run demo`
- [x] 6.2 Emitir con aviso de anticipación visible antes de confirmar, y aviso de orden junto a imprimir; verificar en demo con una fecha cercana y con un permiso sin firmas
- [x] 6.3 Pad de firma en `<canvas>` y registro de firma por cargo; verificar firmando las tres en demo y descargando el PDF firmado
- [x] 6.4 Subida de escaneo asociando firmas, adjuntos, anular y re-emitir; verificar el flujo mixto completo en demo

## 7. Mobile

- [x] 7.1 Listado y formulario de borrador en Expo; verificar en simulador contra el backend demo
- [x] 7.2 Pad de firma con `react-native-svg` y gestos, mismo formato de trazos; verificar que una firma hecha en mobile se ve igual en el PDF que una hecha en web
- [x] 7.3 Escaneo con cámara o galería, sin conversión en el cliente, y adjuntos; verificar subiendo una foto desde el simulador

## 8. Cierre

- [x] 8.1 Sembrar permisos de ejemplo en demo en distintos estados; verificar `bun run demo`
- [x] 8.2 Actualizar `docs/arquitectura.md` (dependencias, `Core`) y `CLAUDE.md` (sacar archivos y cargos fuera de grupo de "qué NO existe", documentar rotación de claves); verificar leyendo el diff
- [x] 8.3 `bun run check` en verde y `docker compose up` arranca; verificar la salida de los dos
