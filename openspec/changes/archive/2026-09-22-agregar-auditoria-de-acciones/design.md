## Context

Hoy hay tres mecanismos incompletos: `personas` guarda cambios de autoridad en `eventos_de_autoridad`, `auth` guarda eventos de seguridad en `eventos_de_seguridad`, y un plugin de Yoga registra cualquier operación GraphQL iniciada mientras `actor.estaElevado`. Este último corre antes del resolver, conoce el nombre de la operación y no la mutation ejecutada, no distingue éxito de fracaso y no puede obtener el grupo, la entidad ni un cambio anterior/nuevo.

Los módulos escriben SQLite mediante `Core.bd`; varias operaciones ya abren transacciones propias. `Core` también aporta reloj e ids y es la única plomería compartida permitida. Los servicios privados de un módulo no pueden importarse desde otro, y hacer que todos dependan de `auditoria` impediría que ésta dependiera de `personas` y `estructura` para resolver nombres y ámbitos.

La navegación de grupo ya tiene cinco destinos fijos en mobile y web angosta. Plantel ocupa hoy uno de ellos. Web de escritorio reutiliza la misma lista en una barra lateral.

## Goals / Non-Goals

**Goals:**

- Hacer atómico el registro de una escritura con su cambio de datos.
- Exigir detalles explícitos y mínimos por acción, sin convertir argumentos GraphQL en un log.
- Mantener un único modelo consultable aunque el historial nazca en módulos distintos.
- Aplicar alcance en el servidor y paginar una historia que crece sin límite.
- Conservar paridad entre mobile y web angosta.

**Non-Goals:**

- Auditar lecturas ordinarias; una futura auditoría de datos especialmente sensibles tendrá otro volumen y otra política.
- Capturar cada sentencia SQL o permitir reconstruir toda la base reproduciendo eventos.
- Proveer restauración automática, deshacer cambios o resolución automática de conflictos.
- Volver el registro criptográficamente inalterable frente a alguien con acceso directo a SQLite. En esta etapa es append-only desde la aplicación.
- Agregar retención, exportación, almacenamiento externo o un bus nuevo.

## Decisions

### 1. `auditoria` será un módulo y el registrador será plomería de `Core`

El nuevo paquete `@gps/auditoria` poseerá tabla, migraciones, políticas, servicio de consulta y esquema GraphQL. Dependerá de las interfaces públicas mínimas de `personas` y `estructura` para presentar nombres actuales junto con ids estables; también se ordenará después de `auth` para migrar su historial existente.

La escritura transversal se expondrá como una capacidad pequeña de `Core`: recibe un evento estructurado y el ejecutor de base que debe usar. Los módulos no importan `/servidor` de auditoría ni agregan una dependencia circular; la raíz de composición conecta esa capacidad con la tabla poseída por el módulo.

Se descarta hacer depender todos los módulos del servicio `auditoria`: obligaría a ubicar auditoría antes que sus fuentes de nombres y haría circular la dependencia. También se descarta publicar la tabla para que otros módulos la importen: rompería la privacidad de `/servidor`.

### 2. Los eventos de negocio se escriben explícitamente dentro de la transacción

Cada caso de uso que modifica datos construirá el evento con nombres de negocio y lo insertará usando la misma transacción que el cambio. Las operaciones que hoy son una sola sentencia incorporarán una transacción corta para confirmar cambio y evento juntos. El reloj y el id se tomarán una sola vez desde `Core`.

El evento tendrá, como mínimo:

- id e instante;
- actor persona o un origen interno explícito;
- módulo y acción;
- resultado `exitoso` o `rechazado`;
- marca de elevación;
- grupo opcional;
- tipo e id de entidad opcionales;
- objetivo persona opcional;
- resumen estructurado;
- cambios opcionales como lista de `{ campo, anterior, nuevo }`.

Los intentos sensibles rechazados se insertan después de revertir o rechazar la operación, en una transacción independiente: precisamente deben sobrevivir al fallo que describen. Los errores ordinarios no llaman al registrador.

El cliente enviará `x-gps-intencion-elevada: 1` únicamente en mutations mientras su sesión cacheada figure elevada. La cabecera no concede ningún permiso: el servidor sigue reconstruyendo `Actor` desde la sesión. Sólo permite reconocer la carrera en que el cliente inició una acción global y la elevación venció antes de que el servidor la autorizara; si la respuesta es `SIN_PERMISO`, se registra el intento rechazado. Una cabecera sin sesión administrativa no produce autoridad ni atribución.

Se descarta usar el plugin GraphQL como escritor principal: ocurre fuera de las transacciones de negocio y no conoce estados anterior/nuevo. El plugin anterior de `sudo` se reducirá a observar intentos elevados expresos rechazados; las escrituras exitosas y los caminos HTTP sensibles registran eventos en sus casos de uso. La cobertura se sostendrá con un inventario probado de mutations y tests de servicio que exijan el evento correspondiente; agregar una mutation sin clasificar deberá romper ese control.

### 3. El detalle será permitido por acción, no una copia genérica

Cada módulo decide qué resumen y qué campos cambiaron. Los valores se serializan como JSON estable, pero el contrato público expone una estructura tipada y legible. No se persisten variables o respuestas GraphQL completas.

Referencias como `archivoId`, `permisoId` o `sesionId` pueden guardarse; bytes, secretos de sesión o invitación, URLs secretas, PKCE, tokens OIDC y trazos de firma quedan excluidos. En una firma se registra firmante, cargo, modalidad y permiso, no el dibujo ni el sello.

Se descarta una lista global de campos enmascarados: depende de que todos recuerden nombrar correctamente cada secreto y duplicaría datos personales que la auditoría no necesita.

### 4. Un registro central recibirá el historial anterior

La migración de `auditoria` creará `eventos_de_auditoria` y copiará las filas existentes de `eventos_de_autoridad` y `eventos_de_seguridad`, conservando ids, actor, objetivo, ámbito, instante y detalles disponibles. Las tablas anteriores no se borrarán en el mismo cambio para mantener un rollback seguro, pero sus escritores pasarán al registro central y la consulta leerá únicamente éste.

No se inventarán datos que antes no existían: por ejemplo, una antigua `sudo.escritura` puede conservar sólo el nombre de operación disponible y marcar sus campos desconocidos como nulos.

### 5. Consulta por cursor, filtros indexados y autorización antes de devolver filas

La consulta aceptará intervalo de fechas, grupo, actor, módulo y acción, todos combinables, y un cursor para pedir páginas anteriores ordenadas por `(ocurrido_en, id)` descendente. Los índices cubrirán el orden temporal y los filtros principales de grupo, actor y módulo/acción.

La política pura permitirá:

- a Jefatura y Secretaría, eventos cuyo `grupoId` pertenece a sus funciones vigentes de grupo;
- al administrador elevado, cualquier evento;
- a nadie más, aunque conozca un id o filtro.

El servidor intersectará siempre los filtros solicitados con ese alcance. Un filtro omitido no amplía permisos. Los eventos diocesanos o sin grupo sólo serán visibles globalmente al administrador elevado.

### 6. Una pantalla compartirá forma, no implementación, entre web y mobile

En navegación angosta la barra quedará así: Principal, Nómina, Salidas, Tesorería y Más. Más será una ruta normal `/grupos/:id/mas`, no un modal, y mostrará dos filas: Plantel y Auditoría. El destino Más se considerará activo en esas tres rutas. En escritorio, la barra lateral listará Plantel y Auditoría directamente y omitirá el paso intermedio.

La auditoría del grupo vivirá en `/grupos/:id/auditoria`. Para Jefatura o Secretaría el grupo queda implícito y no se dibuja un selector inútil. Con elevación, la pantalla permite quitar ese recorte o elegir otro grupo. Los demás filtros y la carga de páginas usan las piezas existentes de campos, filtros, filas y estados vacíos; no se crea una tabla compleja para mobile.

## Risks / Trade-offs

- [Una mutation nueva puede olvidar registrar su evento] → Mantener un inventario verificable de todas las mutations y tests que fallen cuando una no tenga clasificación y cobertura de auditoría.
- [El JSON de detalle puede crecer o filtrar datos] → Definir resúmenes por acción, probar exclusiones sensibles y no aceptar objetos GraphQL completos en la API del registrador.
- [Resolver nombres históricos con datos actuales puede mostrar un nombre cambiado] → Conservar ids como identidad autoritativa; si se incorpora edición de nombres, esa propia edición deberá guardar anterior/nuevo y se evaluará una etiqueta histórica sin ampliar ahora el modelo.
- [La tabla crecerá indefinidamente] → Consultar siempre por páginas e índices; agregar archivado sólo cuando el volumen real lo justifique.
- [Las filas migradas tienen menos detalle que las nuevas] → Presentar únicamente lo conocido y no fabricar diffs retroactivos.
- [Una falla sensible anónima puede no tener actor] → Registrar el origen y los identificadores no secretos disponibles; nunca atribuirla a una persona sin identidad comprobada.

## Migration Plan

1. Incorporar el módulo y crear la tabla central con sus índices.
2. Copiar en la migración los eventos de autoridad y seguridad existentes, sin borrar las tablas de origen.
3. Cambiar los escritores existentes y después el resto de los casos de uso, manteniendo tests de atomicidad y contenido sensible.
4. Publicar la consulta y regenerar esquema y cliente.
5. Incorporar las pantallas y reorganizar la navegación angosta en ambas apps.
6. Retirar el interceptor anterior de escrituras elevadas cuando el inventario completo esté cubierto.

Rollback: el código anterior puede volver a usar sus tablas conservadas. La tabla central se deja intacta para no perder historial; un despliegue posterior puede retomar desde ella. No se revierten ni borran eventos ya confirmados.
