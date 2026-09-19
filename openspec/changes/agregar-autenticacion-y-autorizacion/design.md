## Context

GPS ya tiene `Actor` y `Alcance` en `@gps/core`, pero `ctx.actor` siempre es `null`, los servicios consultan SQLite sin alcance y las operaciones GraphQL son anónimas. `personas` posee las pertenencias y cargos de grupo; `estructura` conoce la jerarquía distrito-grupo. La composición ocurre una vez al arrancar y el contexto actual es constante.

Las apps web y mobile comparten `packages/api`; mobile persiste datos con TanStack Query y deberá guardar la sesión fuera de AsyncStorage. Los módulos deben seguir siendo portables: reloj, identificadores y secretos aleatorios entran por `Core`, nunca por APIs de Bun o Node dentro de `src/`.

Este diseño reemplaza la suposición anterior de una tabla `usuarios`: una persona existente es la única identidad interna.

## Goals / Non-Goals

**Goals:**

- Fallar cerrado en servidor sin depender de que cada resolver recuerde filtrar.
- Separar autenticación, hechos organizativos, expansión del ámbito y políticas de cada módulo.
- Revocar acceso por cambio de cargo, equipo, sesión o identidad sin reemitir tokens con roles.
- Mantener historial y auditoría de todos los cambios que conceden autoridad.
- Conservar `bun run demo` y tests sin depender de Google o Apple reales.

**Non-Goals:**

- Contraseñas, OTP o correo de recuperación.
- Un editor genérico de permisos o roles asignados manualmente.
- Implementar el módulo Tesorería; se fija el contrato que deberá cumplir.
- Sincronización offline completa, cifrado de datos de salud o auditoría general de lecturas.
- Equipos arbitrarios creados por usuarios: esta iteración incorpora sólo Secretaría, Administración diocesana y Tesorería diocesana.

## Decisions

### 1. `Persona` reemplaza a `Usuario`

`Actor` llevará `personaId`, roles con ámbito y el estado de elevación; no habrá `usuarioId` ni tabla `usuarios`. `auth` guardará únicamente autenticadores y sesiones vinculados a `personaId`:

- `identidades_externas`: proveedor, `subject` estable, persona, alta y desactivación;
- `sesiones`: hash del secreto, persona, identidad usada, vencimiento, revocación y elevación;
- `invitaciones`: activación o recuperación, persona, proveedor a reemplazar cuando corresponda, hash del secreto, emisor, vencimiento, consumo y revocación;
- `administrador_del_sistema`: una única fila que apunta a la persona designada;
- eventos de seguridad para vínculos, recuperaciones, sesiones y cambios de administrador.

No se usarán correos para correlacionar identidades. Se conservarán las identidades desactivadas y `proveedor + subject` no podrá reasignarse a otra persona.

**Alternativa descartada:** mantener `usuarios` además de `personas`. Duplica identidad, exige sincronización y no aporta nada mientras todo operador de GPS deba ser una persona cargada.

### 2. OAuth/OIDC con código, PKCE y adaptadores de proveedor

Google y Apple usarán Authorization Code con PKCE, `state` y `nonce`. El backend validará emisor, audiencia, firma y nonce antes de confiar en `subject`; una biblioteca estándar de JOSE verificará JWT/JWK en vez de implementar criptografía propia. Las credenciales y audiencias llegarán por configuración validada al arrancar.

Web completará el flujo en el mismo origen y recibirá una cookie `HttpOnly`, `Secure` y `SameSite=Lax`. Mobile abrirá el navegador del sistema, volverá mediante deep link y guardará el secreto opaco de sesión en `expo-secure-store`; `Transporte` lo enviará como bearer. El backend guardará sólo el hash del secreto.

Una sesión normal durará 30 días y será revocable. Los roles nunca se incluirán en la sesión: el contexto los reconstruirá para cada request. Vincular un segundo proveedor exigirá una sesión reciente y completar la autenticación del proveedor nuevo.

**Alternativas descartadas:** usar tokens de Google/Apple como sesión propia, porque complica revocación y acopla cada request al proveedor; guardar bearer tokens web en `localStorage`, por exposición ante XSS.

### 3. Enlaces de invitación y recuperación son secretos de un solo uso

Una invitación contendrá un secreto aleatorio de alta entropía; sólo su hash se persistirá. Vencerá a los siete días y podrá revocarse. El enlace se entregará para compartir por WhatsApp, sin servicio de correo.

Activación y recuperación son operaciones distintas:

- activación vincula el primer proveedor a una persona todavía no vinculada;
- una persona autenticada puede agregar o reemplazar otro proveedor por sí misma;
- recuperación asistida fija persona y proveedor al emitir el enlace y, al consumirlo, desactiva el vínculo anterior de ese proveedor, crea el nuevo y revoca todas las sesiones en una transacción;
- los demás proveedores y todos los hechos del negocio permanecen intactos.

La invitación no concede permisos. El cargo o equipo debe existir como hecho independiente, aunque la interfaz pueda ofrecer nombrar e invitar en un mismo recorrido.

**Alternativa descartada:** borrar la identidad anterior. Impediría auditar una toma de cuenta o explicar qué credencial fue reemplazada.

### 4. Cargos estatutarios y equipos son hechos distintos

`personas` seguirá siendo dueño de ambos porque vinculan personas con funciones y vigencia. `cargos` generalizará `grupo_id` a ámbito tipo/id para incorporar `jefeScoutDiocesano`. Los equipos conocidos serán:

- Secretaría, con ámbito de grupo;
- Administración diocesana;
- Tesorería diocesana.

`equipos` representa tipo y ámbito; `integrantes_de_equipo` conserva membresías e historial. No habrá unicidad por función: un grupo admite varios secretarios. Secretaría exige pertenencia vigente al mismo grupo.

Los períodos de calendario existentes continúan siendo inclusivos. Para que una remoción quite acceso inmediatamente sin falsear ese historial, cargos y membresías tendrán una marca de revocación instantánea además de `desde/hasta`; la autorización exige período vigente y ausencia de revocación.

**Alternativa descartada:** modelar Secretaría como `secretario_id` en grupo o como un rol manual de auth. No permite varios integrantes y separa el permiso del hecho organizativo que lo origina.

### 5. El contexto compone identidad, roles y alcance por request

La raíz de composición dejará de construir un contexto constante. Por request:

1. `auth` valida cookie o bearer y devuelve persona, sesión y elevación;
2. `personas` devuelve cargos y equipos vigentes de esa persona;
3. `estructura` expande ámbitos diocesanos o distritales a ids concretos;
4. el backend construye `Actor` y `Alcance` y los agrega a los servicios ya creados.

La dependencia queda `auth -> personas -> estructura`; el backend orquesta sin introducir hooks genéricos. `Context` expondrá `actor: Actor | null` y `alcance: Alcance | null`.

Los tipos técnicos `Actor`, `RolConAmbito` y `Alcance` siguen en `@gps/core`; los catálogos y reglas de cargos/equipos viven en `personas/dominio`.

### 6. Las políticas fallan cerrado en tres capas

Cada módulo tendrá `dominio/politicas.ts` con acceso al módulo y funciones puras por operación/campo. El servidor aplicará las mismas políticas y las apps podrán usarlas para ocultar acciones, pero la interfaz nunca será una barrera de seguridad.

Todo camino de consulta o escritura iniciado por un usuario recibirá `Alcance` como primer parámetro antes de tocar la base. Las operaciones internas explícitas, como el barrido programado de Afiliación, no simularán un usuario administrador: conservarán nombres de caso de uso internos y no serán alcanzables directamente desde GraphQL.

Matriz inicial:

| Función | Ámbito | Personas/plantel/afiliación | Cuenta corriente | Registrar pagos |
|---|---|---|---|---|
| Jefatura de grupo | su grupo | administrar | leer | no |
| Secretaría | su grupo | administrar | leer | no |
| Tesorería diocesana | diócesis | no | leer | sí |
| Jefatura scout / Administración diocesana | diócesis | administrar equipos diocesanos | sin concesión implícita | no |
| Administrador elevado | global | administrar | leer | sí |

El acceso no listado se deniega. `/health`, el flujo de autenticación y la versión del sistema permanecen públicos.

En Salidas, Jefatura y Secretaría administran y descargan permisos/PDF de su grupo. Las firmas en la app exigen que `Actor.personaId` sea el ocupante vigente del cargo requerido: jefe y director en el grupo, comisionado en su distrito. Esos firmantes pueden leer el permiso y sus archivos para firmarlo; Jefatura y Secretaría pueden cargar firmas en papel. `archivos` delega la autorización al dueño del recurso y recibe el actor/alcance, por lo que una URL no evita el filtro de Salidas.

### 7. La autoridad se administra dentro de su ámbito

- Jefatura de grupo administra su plantel, incluida otra jefatura y Secretaría.
- Cualquier integrante de Secretaría puede nombrar o remover jefes de su grupo individualmente.
- Se permite remover al último jefe; Secretaría puede cubrir la vacancia.
- Jefatura scout y Administración diocesana administran sus transiciones y Tesorería diocesana.
- El administrador elevado es la recuperación final.

Las mismas autoridades pueden emitir activaciones y recuperaciones para personas de su ámbito. Cada cambio de autoridad guarda actor, objetivo, ámbito e instante en la misma transacción que el cambio.

### 8. Un único administrador usa elevación tipo `sudo`

La persona administradora inicia con alcance ordinario. Para elevarse debe repetir un flujo de Google o Apple con un `subject` ya vinculado; la elevación dura diez minutos, vive en la sesión y sólo es válida en línea. Durante ella `Alcance.esAdministrador` es verdadero y todas las escrituras se auditan mediante un interceptor de GraphQL, además de las auditorías de dominio.

Transferir la administración requiere elevación. Si la única persona administradora pierde todas sus identidades, `bun run admin asignar --persona <id>` reemplaza la fila única y registra el evento; no habrá mutation pública equivalente.

**Alternativas descartadas:** administrador siempre privilegiado, porque una sesión robada tendría acceso global permanente; varios administradores, porque el modelo acordado busca una única responsabilidad con elevación explícita.

### 9. Cache y demo no pueden mezclar identidades

El cache persistido de TanStack Query se particionará por persona y se purgará al cerrar sesión, recuperar identidad o cambiar de persona. La sesión mobile no irá a AsyncStorage. El servidor seguirá filtrando siempre; el cache offline sólo contendrá datos previamente autorizados para esa persona.

En `demo`, datos e identidades serán sintéticos y `demo` funcionará como un proveedor interno de un clic. La pantalla ofrecerá perfiles sembrados para Jefatura, Secretaría, Tesorería diocesana y administrador designado; elegir uno creará una sesión normal mediante el mismo servicio y recorrerá la misma derivación de roles y políticas que Google o Apple. El perfil administrador deberá reautenticarse con otro clic demo para activar `sudo`.

La ruta del proveedor sólo se registrará cuando `config.entorno === 'demo'`, la interfaz sólo la mostrará en ese entorno y el servicio también rechazará su uso fuera de demo como defensa adicional. El código puede formar parte del build, pero no habrá endpoint ni forma de activarlo en desarrollo o producción. Los tests reutilizarán este adaptador con reloj y secretos deterministas mediante `Core`, sin llamadas reales a Google o Apple.

## Risks / Trade-offs

- [Un enlace de WhatsApp reenviado permite reclamar la identidad prevista] -> Mostrar persona y ámbito antes de confirmar, usar expiración, revocación y un solo uso, y auditar emisor y consumidor.
- [Una autoridad puede intentar recuperar una identidad para suplantar a otra persona] -> Limitar por ámbito, revocar sesiones, conservar el vínculo anterior y registrar toda recuperación; el administrador puede investigar y reparar mediante sudo.
- [El único administrador puede quedar bloqueado] -> Permitir varias identidades por persona y mantener el comando CLI fuera de la API.
- [Consultar roles en cada request agrega lecturas] -> Resolver una vez por request; agregar cache sólo si mediciones muestran necesidad, con invalidación por cambios organizativos.
- [Datos autorizados pueden permanecer en el cache de un teléfono después de una revocación] -> Purga al cerrar sesión y partición por persona; la minimización y cifrado offline completos quedan para su cambio específico.
- [La migración de `cargos` puede afectar historial existente] -> Migrar cada `grupo_id` a ámbito `grupo`, verificar conteos y vigencias antes de activar políticas.
- [Google y Apple difieren entre web y mobile] -> Encapsular intercambio y validación por proveedor, manteniendo sesión e invitaciones independientes de esas diferencias.

## Migration Plan

1. Agregar modelos y migraciones de equipos, ámbitos de cargos y auth sin activar todavía la denegación global.
2. Implementar proveedores falsos, sesiones, invitaciones, recuperación, administrador y derivación de alcance; migrar tests y demo.
3. Incorporar políticas y parámetros de alcance módulo por módulo —incluidos Salidas y las descargas de Archivos—, verificando que toda consulta GraphQL protegida falle cerrada.
4. Agregar login, almacenamiento seguro, partición de cache y pantallas organizativas en web/mobile.
5. Configurar Google y Apple, ejecutar la CLI para designar al primer administrador y recién entonces exigir autenticación en producción.

Rollback: antes del paso 5 se puede revertir código conservando las tablas nuevas. Después de activar autenticación, el rollback debe deshabilitar la exigencia de sesión junto con el despliegue anterior; las identidades y auditorías se conservan y no se revierten destructivamente.
