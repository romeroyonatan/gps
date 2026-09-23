## 1. Registro central y módulo

- [x] 1.1 Agregar a `Core` el contrato mínimo del registrador de auditoría, incluyendo evento estructurado y ejecutor transaccional, y verificar tipos y registro con tests de core.
- [x] 1.2 Crear `@gps/auditoria` con modelos, política de acceso, tabla append-only, índices, migraciones, servicio y `Module`, registrarlo en `services/backend/src/modules.ts` y verificar compilación y migración desde una base vacía.
- [x] 1.3 Migrar las filas existentes de `eventos_de_autoridad` y `eventos_de_seguridad` al registro central sin borrar las tablas de origen, y verificar actor, objetivo, ámbito, instante y detalles tanto desde una base con historia como al repetir el arranque.
- [x] 1.4 Implementar el registrador conectado por la raíz de composición y verificar que usa `Core.reloj`, `Core.nuevoId` y la transacción recibida, y que una falla del evento revierte el cambio de datos.

## 2. Consulta y autorización

- [x] 2.1 Implementar la política pura que limita Jefatura y Secretaría a sus grupos y exige elevación vigente para el alcance global, verificando grupo propio, grupo ajeno, administrador ordinario, administrador elevado y elevación vencida.
- [x] 2.2 Implementar la consulta paginada por cursor con orden descendente y filtros combinables de fechas, grupo, actor, módulo y acción, verificando páginas estables, intersección de filtros y ausencia de filas fuera del alcance.
- [x] 2.3 Exponer tipos y consulta GraphQL con ids y nombres legibles de actor, grupo y entidad cuando estén disponibles, sin mutations de edición o borrado, y verificar autorización y nulabilidad con tests de esquema.

## 3. Seguridad y autoridad

- [x] 3.1 Cambiar `personas` para registrar asignaciones y revocaciones de cargos y equipos en el registro central dentro de sus transacciones, conservando actor, objetivo y ámbito, y verificar que no duplica eventos en las tablas anteriores.
- [x] 3.2 Cambiar los eventos exitosos de identidades, invitaciones, recuperación, sesiones, elevación y reasignación administrativa de `auth` al registro central, verificando que ids de sesión permitidos pueden aparecer pero secretos, URLs, PKCE y tokens nunca se guardan.
- [x] 3.3 Registrar como rechazados los intentos sensibles de elevación, recuperación, reasignación y mutations marcadas con intención elevada cuya autorización venció, verificando que la marca no concede permisos, que los eventos sobreviven al rechazo y que errores ordinarios no crean eventos fallidos.
- [x] 3.4 Retirar el interceptor anterior `crearInterceptorDeEscriturasElevadas` cuando todos sus caminos estén cubiertos y verificar que una escritura elevada produce un único evento exitoso con acción, objetivo e instante.

## 4. Escrituras de negocio

- [x] 4.1 Auditar las escrituras de Afiliación y las deudas generadas o reconciliadas por Tesorería, distinguiendo actor de origen interno y verificando atomicidad, grupo, entidad, importe o resumen relevante.
- [x] 4.2 Auditar definición de cuotas, registro y anulación de pagos en Tesorería, verificando resúmenes de altas/anulaciones y que no se creen eventos ante operaciones fallidas.
- [x] 4.3 Auditar solicitud y confirmación de archivos con sus referencias permitidas, verificando que nombre y metadatos necesarios pueden describir la acción pero bytes, token de subida y URL privada no se copian.
- [x] 4.4 Auditar creación, emisión, anulación y reemisión de permisos de salida con grupo, entidad y resumen estructurado, verificando que cambio y evento se confirman o revierten juntos.
- [x] 4.5 Auditar responsable, unidades, participantes y adjuntos de un permiso con valores anteriores y nuevos, verificando diffs de reemplazo, agregado y remoción.
- [x] 4.6 Auditar firmas en app y papel con permiso, persona, cargo y modalidad, verificando que trazos, sellos y bytes del escaneo no aparezcan en el detalle.
- [x] 4.7 Mantener un inventario probado de todos los campos `Mutation` y su clasificación auditable, incluyendo auth, personas, afiliación, tesorería, archivos y salidas, de modo que agregar una mutation sin declarar cobertura haga fallar el test.

## 5. API y pantalla web

- [x] 5.1 Regenerar `schema.gql` y el cliente `@gps/api`, agregar hooks de consulta paginada y filtros, y verificar `bun run schema` y `bun run --filter @gps/api codegen` sin diferencias pendientes.
- [x] 5.2 Implementar en web la pantalla de auditoría mobile-first con filtros permitidos, filas legibles, detalle anterior/nuevo, estados de carga/vacío/error y carga de páginas anteriores, verificando que Jefatura y Secretaría no puedan elegir grupos ajenos y que el administrador elevado pueda consultar toda la diócesis.
- [x] 5.3 Reorganizar la navegación web angosta a Principal, Nómina, Salidas, Tesorería y Más; crear la pantalla completa Más con Plantel y Auditoría; mantener ambos accesos directos en escritorio y verificar estado activo y rutas profundas.

## 6. Pantalla mobile y cierre

- [x] 6.1 Implementar en mobile la pantalla Más y cambiar la barra inferior al mismo orden de cinco destinos que web, usando icono de elipsis con etiqueta accesible “Más”, y verificar objetivos táctiles, ruta profunda y estado activo dentro de Plantel y Auditoría.
- [x] 6.2 Implementar en mobile la pantalla de auditoría con la misma jerarquía, filtros, detalles y paginación que web, omitiendo el selector de grupo cuando sólo uno está permitido y verificando paridad a 375 px y modo oscuro.
- [x] 6.3 Actualizar `docs/arquitectura.md`, `docs/crear-un-modulo.md`, `CLAUDE.md` y los README de interfaz afectados para documentar el registro obligatorio, la privacidad de detalles y la navegación Más, verificando que no queden afirmaciones que describan auditoría como futura o limitada a `sudo`.
- [ ] 6.4 Ejecutar `bun run check` y una prueba manual en demo de escritura ordinaria, edición con diff, acción sensible rechazada, filtros por grupo/actor/módulo/acción y navegación web/mobile; corregir cualquier falla antes de dar el cambio por terminado.
