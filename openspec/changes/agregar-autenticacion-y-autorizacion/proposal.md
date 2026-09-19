## Why

GPS hoy expone datos y operaciones sin identificar a quien llama ni limitarlo por su función y ámbito. La asociación necesita acceso sin contraseñas propias, con permisos que sigan automáticamente los cargos y equipos vigentes en vez de mantener roles manuales por usuario.

## What Changes

- Autenticar personas existentes mediante Google y Apple, sin tabla de usuarios ni contraseñas locales, permitiendo varias identidades externas por persona y sesiones revocables.
- Activar cuentas mediante enlaces de invitación de un solo uso compartidos manualmente, emitidos sólo por autoridades del ámbito correspondiente.
- Recuperar el acceso reemplazando una identidad externa perdida mediante una invitación especial, conservando las demás identidades y revocando las sesiones anteriores.
- Derivar roles y ámbitos de cargos, pertenencias a equipos y su vigencia: jefatura y Secretaría de grupo, jefatura scout y Administración diocesanas, y Tesorería diocesana.
- Aplicar autorización por módulo, registro, campo y operación. Secretaría y jefatura podrán administrar su grupo y leer su cuenta corriente; sólo Tesorería diocesana podrá registrar pagos.
- Incorporar un único administrador del sistema con elevación temporal tipo `sudo`, acceso global durante la elevación, auditoría obligatoria y recuperación operativa mediante CLI.
- **BREAKING**: las operaciones GraphQL existentes dejarán de ser anónimas y los servicios/repositorios deberán recibir y aplicar el alcance autorizado.
- **BREAKING**: `Actor.usuarioId` pasará a identificar directamente una `Persona`, porque no habrá entidad `Usuario` separada.
- Diferir el acceso por OTP y el correo de recuperación a una iteración posterior.

## Capabilities

### New Capabilities

- `autenticacion-federada`: inicio de sesión con Google y Apple, vinculación de identidades externas, sesiones y elevación administrativa temporal.
- `invitaciones-y-recuperacion`: activación y recuperación de acceso mediante enlaces manuales de un solo uso y revocación segura.
- `autorizacion-organizativa`: derivación de roles y ámbitos desde cargos y equipos, políticas por operación y administración delegada de planteles.

### Modified Capabilities

No hay especificaciones OpenSpec existentes que modificar.

## Impact

- Nuevo módulo `auth`, sus tablas, migraciones, esquema GraphQL y composición en el backend.
- Cambios en `@gps/core` para `Actor`, `Alcance` y el contexto por request.
- Nuevos cargos, equipos, vigencias y operaciones de plantel en `personas`, con consultas de jerarquía en `estructura`.
- Políticas y filtrado obligatorio en los módulos actuales, incluidos Personas, Estructura, Afiliación, Tesorería, Salidas y las descargas de Archivos.
- Login, almacenamiento seguro de sesión y pantallas de invitación/recuperación en web y mobile.
- Configuración y credenciales operativas de Google y Apple, además de un comando Bun para designar al administrador de emergencia.
