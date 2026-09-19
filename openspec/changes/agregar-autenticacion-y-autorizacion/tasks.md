## 1. Fundamentos de identidad y alcance

- [x] 1.1 Cambiar `Actor` para identificar `personaId`, completar roles/ámbitos y separar administrador designado de elevación efectiva; verificar con `bun run --filter @gps/core compile` y tests de tipos/políticas.
- [x] 1.2 Agregar a `Core` la generación portable de secretos criptográficos que necesitan sesiones, PKCE e invitaciones, con implementación real y falsa determinista; verificar tests de entropía/formato y portabilidad.
- [x] 1.3 Extender la configuración validada con orígenes, audiencias y credenciales de Google/Apple sin valores inseguros por defecto en producción; verificar tests de arranque válido e inválido.

## 2. Cargos, equipos y autoridad organizativa

- [x] 2.1 Generalizar `cargos` a ámbitos de grupo y diocesano, incorporar revocación instantánea y migrar cada cargo existente conservando grupo, fechas y marcas; verificar con tests de migración y conteos antes/después.
- [x] 2.2 Modelar Secretaría, Administración diocesana y Tesorería diocesana con equipos, integrantes, vigencia y revocación; verificar restricciones e historial mediante tests de dominio y migración.
- [x] 2.3 Implementar altas y remociones de plantel de grupo, permitiendo varios secretarios, vacancia de jefatura y nombramiento de jefes por Jefatura o Secretaría; verificar casos autorizados, fuera de ámbito y pérdida inmediata de acceso.
- [x] 2.4 Implementar transiciones entre jefatura scout y Administración diocesanas y gestión de Tesorería por ambas; verificar tests de nombramiento, remoción y recuperación de una autoridad vacante.
- [x] 2.5 Publicar desde `personas/dominio/publico.ts` sólo las consultas necesarias para existencia, pertenencia y funciones vigentes de una persona; verificar que `auth` pueda depender de esa interfaz sin importar `/servidor`.
- [x] 2.6 Publicar en `estructura` la expansión de ámbitos diocesanos/distritales a grupos y construir `Alcance`; verificar tests con personas que reúnen funciones de varios ámbitos.
- [x] 2.7 Registrar actor, objetivo, ámbito e instante en cada cambio de cargo o equipo dentro de la misma transacción; verificar que una escritura fallida no deje auditoría huérfana.

## 3. Módulo auth y sesiones

- [x] 3.1 Crear `packages/auth` como módulo dependiente de `personas`, registrarlo en `services/backend/src/modules.ts` y verificar orden de composición, lint y tipos.
- [x] 3.2 Crear tablas y migraciones para identidades externas, sesiones, invitaciones, administrador único y eventos de seguridad, incluyendo unicidad de identidades activas e historial; verificar migraciones desde una base vacía y una ya migrada.
- [x] 3.3 Implementar emisión, hash, resolución, vencimiento, cierre y revocación de sesiones opacas de 30 días; verificar tests con reloj falso para sesión válida, vencida y revocada.
- [x] 3.4 Implementar adaptadores OIDC de Google y Apple con Authorization Code, PKCE, state, nonce y validación JOSE de emisor/audiencia/firma; verificar con proveedores HTTP falsos los éxitos y cada rechazo de validación.
- [x] 3.5 Implementar inicio de sesión y vinculación de un segundo proveedor sin correlacionar correos y sin permitir reutilizar un `subject` histórico; verificar tests para Google, Apple, vínculo doble y conflicto entre personas.
- [x] 3.6 Rehacer `crearContexto` por request para resolver cookie o bearer, funciones vigentes y alcance una sola vez; verificar integración GraphQL para request anónimo, autenticado y sesión revocada.

## 4. Invitaciones y recuperación

- [x] 4.1 Implementar invitaciones de activación con secreto almacenado como hash, vencimiento de siete días, revocación y consumo único; verificar concurrencia/doble consumo y enlaces inválidos.
- [x] 4.2 Aplicar al emitir invitaciones las autoridades de grupo, diócesis y administrador elevado; verificar que Jefatura y Secretaría no puedan invitar fuera de su grupo.
- [x] 4.3 Implementar recuperación asistida atómica por proveedor: desactivar identidad anterior, vincular la nueva, conservar otros proveedores y revocar todas las sesiones; verificar rollback completo ante conflicto o error.
- [x] 4.4 Implementar reemplazo autónomo de un proveedor desde una sesión reciente autenticada con el otro; verificar que no requiera invitación y que preserve cargos, equipos e historial.
- [x] 4.5 Registrar emisión, revocación, consumo y recuperación con emisor/consumidor e instante, conservando identidades desactivadas; verificar consultas de auditoría en tests.

## 5. Sudo y recuperación operativa

- [ ] 5.1 Implementar designación de una única persona administradora y elevación de diez minutos tras reautenticar una identidad ya vinculada; verificar que la sesión ordinaria no sea global y que una persona ajena no pueda elevarse.
- [ ] 5.2 Incorporar un interceptor de GraphQL que audite toda escritura ejecutada con alcance global, sin habilitar sudo en el transporte local; verificar mutation elevada, mutation ordinaria e intento offline.
- [ ] 5.3 Implementar `bun run admin asignar --persona <id>` fuera de la API para reemplazar al administrador y registrar el evento; verificar persona inexistente, reasignación correcta y ausencia de mutation equivalente.

## 6. Autorización de módulos existentes

- [ ] 6.1 Hacer obligatoria la declaración `accesoAlModulo` con denegación por defecto y configurar autorización Pothos por operación/campo; verificar que un módulo o campo sin política no quede publicado accidentalmente.
- [ ] 6.2 Crear políticas puras de Estructura, Personas, Afiliación y Salidas para Jefatura, Secretaría, firmantes vigentes y elevación global, manteniendo `/health`, autenticación y versión públicas; verificar tests unitarios de la matriz permitida/denegada.
- [ ] 6.3 Pasar `Alcance` como primer parámetro de todos los caminos de persistencia iniciados por usuario y filtrar grupos antes de leer o escribir, incluidas las descargas que Archivos delega a Salidas; verificar tests cruzados donde un actor del grupo A no observa ni modifica permisos o archivos del B.
- [ ] 6.4 Mantener separados los casos internos como el barrido programado de Afiliación, sin exponerlos por GraphQL ni fabricar un administrador; verificar que el trabajo programado sigue cubriendo todos los grupos.
- [ ] 6.5 Declarar en dominio el contrato futuro de Tesorería: Jefatura/Secretaría leen sólo su grupo y Tesorería diocesana registra pagos de toda la diócesis, sin crear todavía el módulo; verificar tests de las funciones puras de política.

## 7. API, web y mobile

- [ ] 7.1 Exponer operaciones/rutas mínimas para iniciar y completar OAuth, consultar la persona actual, cerrar sesión, vincular proveedor, elevarse, invitar y recuperar; regenerar `schema.gql` y el cliente con `bun run schema` y `bun run --filter @gps/api codegen`.
- [ ] 7.2 Adaptar `Transporte` para cookie web y bearer mobile, y manejar errores distinguibles de no autenticado/sin permiso; verificar tests HTTP de headers, credenciales y mensajes.
- [ ] 7.3 Implementar login web con Google/Apple y cookie HttpOnly, más cierre de sesión y retorno al destino original; verificar manualmente el flujo con proveedor falso/local.
- [ ] 7.4 Implementar login mobile con navegador del sistema, deep link y sesión en `expo-secure-store`, nunca AsyncStorage; verificar retorno exitoso, cancelación y reinicio de la app.
- [ ] 7.5 Particionar el cache persistido por `personaId` y purgarlo al cerrar sesión, recuperar identidad o cambiar de persona; verificar que dos sesiones consecutivas no compartan datos cacheados.
- [ ] 7.6 Implementar en web y mobile la gestión mínima de plantel/equipos, creación/revocación de enlaces y compartir por Share API o copiar enlace; verificar a 375 px los flujos de Jefatura, Secretaría y autoridad diocesana.
- [ ] 7.7 Implementar activación y recuperación desde deep link mostrando persona y ámbito antes de confirmar; verificar enlace usado, vencido, revocado y recuperación que obliga a iniciar una sesión nueva.
- [ ] 7.8 Implementar activación visual de sudo, cuenta regresiva y salida automática del modo elevado; verificar que las acciones globales desaparezcan y sean rechazadas al vencer.

## 8. Demo, documentación y verificación final

- [ ] 8.1 Implementar el proveedor interno `demo`, sembrar perfiles de Jefatura, Secretaría, Tesorería diocesana y administrador, y ofrecer login y reautenticación sudo de un clic; verificar que `bun run demo` crea sesiones reales con permisos distintos, que sudo sigue venciendo y auditándose, y que fuera de `ENTORNO=demo` no existe la ruta y el servicio rechaza su uso.
- [ ] 8.2 Actualizar `docs/arquitectura.md`, la spec base y `CLAUDE.md` para reemplazar `Usuario`, documentar equipos/recuperación/sudo y retirar las notas que afirman que auth no existe; verificar que no queden contradicciones con `rg`.
- [ ] 8.3 Ejecutar pruebas de seguridad integradas para token manipulado, replay de invitación, identidad duplicada, recuperación concurrente, sesión revocada y acceso cruzado de grupos; verificar que todas fallen cerradas.
- [ ] 8.4 Ejecutar `bun run schema`, codegen y `bun run check`, corregir cualquier diferencia generada y verificar que el árbol de trabajo sólo contenga cambios esperados.
