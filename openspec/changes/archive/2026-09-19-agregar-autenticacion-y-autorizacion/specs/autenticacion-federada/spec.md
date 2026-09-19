## Purpose

Permitir que una persona existente demuestre su identidad con proveedores externos y mantenga sesiones revocables sin que GPS almacene usuarios separados ni contraseñas.

## ADDED Requirements

### Requirement: La persona es la identidad interna
El sistema MUST vincular cada acceso autenticado directamente con una `Persona` existente y MUST NOT crear una entidad de usuario separada ni almacenar contraseñas locales.

#### Scenario: Persona inexistente
- **WHEN** una identidad externa válida no está vinculada a una persona mediante invitación o una sesión autorizada
- **THEN** el sistema rechaza el inicio de sesión y no crea una persona automáticamente

### Requirement: Inicio de sesión con Google y Apple
El sistema SHALL permitir iniciar sesión con Google y Apple y MUST identificar cada cuenta por el emisor y el identificador estable entregado por el proveedor, no por su correo electrónico.

#### Scenario: Identidad vinculada
- **WHEN** Google o Apple autentica correctamente una identidad externa activa y vinculada
- **THEN** el sistema crea una sesión para la persona correspondiente

#### Scenario: Correo coincidente sin vínculo
- **WHEN** una cuenta externa presenta el mismo correo que una persona o que otra identidad pero no existe un vínculo autorizado
- **THEN** el sistema no las une automáticamente

### Requirement: Varias identidades externas por persona
El sistema SHALL permitir que una persona vincule simultáneamente una identidad de Google y una de Apple desde una sesión autenticada, verificando el nuevo proveedor antes de guardar el vínculo.

#### Scenario: Vincular un segundo proveedor
- **WHEN** una persona autenticada completa la vinculación con un proveedor que todavía no tiene activo
- **THEN** ambas identidades quedan habilitadas para iniciar sesiones de esa misma persona

#### Scenario: Identidad externa ya utilizada
- **WHEN** se intenta vincular una identidad externa que pertenece o perteneció a otra persona
- **THEN** el sistema rechaza el vínculo

### Requirement: Proveedor exclusivo de demostración
En entorno demo, el sistema SHALL ofrecer un proveedor interno de un clic con personas sintéticas representativas de Jefatura, Secretaría, Tesorería diocesana y administración. Este proveedor MUST crear las mismas sesiones y recorrer la misma autorización que Google y Apple, y MUST estar ausente y ser rechazado en cualquier otro entorno.

#### Scenario: Inicio demo de un clic
- **WHEN** una persona elige uno de los perfiles sintéticos en entorno demo
- **THEN** el sistema crea una sesión normal para ese perfil y aplica sus cargos, equipos y ámbitos sembrados

#### Scenario: Proveedor demo fuera de demo
- **WHEN** se intenta usar el proveedor demo en cualquier otro entorno
- **THEN** la entrada no está publicada y el servicio rechaza el intento

#### Scenario: Sudo en demo
- **WHEN** el perfil administrador solicita elevarse en entorno demo
- **THEN** debe reautenticarse mediante otro clic demo y recibe la misma elevación temporal y auditable que un administrador real

### Requirement: Sesiones revocables y con vencimiento
El sistema SHALL emitir sesiones opacas, revocables y con vencimiento, MUST protegerlas en el almacenamiento seguro disponible en cada cliente y MUST resolver los cargos y equipos vigentes en cada request en vez de fijarlos dentro de la sesión.

#### Scenario: Cambio de función durante una sesión
- **WHEN** una persona pierde o adquiere un cargo o una pertenencia a equipo mientras conserva una sesión válida
- **THEN** su siguiente request utiliza los accesos derivados de la situación vigente

#### Scenario: Sesión revocada o vencida
- **WHEN** se presenta una sesión revocada o vencida
- **THEN** el sistema trata el request como no autenticado

### Requirement: Una persona sin función puede seguir autenticándose
El sistema SHALL conservar las identidades vinculadas cuando terminan los cargos o equipos de una persona, pero MUST denegarle las capacidades para las que ya no tenga función vigente.

#### Scenario: Fin de todas las funciones
- **WHEN** una persona autenticada deja de tener cargos o equipos con acceso
- **THEN** puede iniciar sesión pero no accede a módulos protegidos

### Requirement: Administrador único con elevación temporal
El sistema SHALL mantener una única persona designada como administradora y SHALL exigir una reautenticación reciente con una identidad externa vinculada antes de concederle acceso global temporal. La sesión normal de esa persona MUST seguir las mismas políticas que cualquier otra.

#### Scenario: Administrador sin elevar
- **WHEN** la persona administradora usa una sesión normal
- **THEN** sólo obtiene los permisos derivados de sus cargos y equipos vigentes

#### Scenario: Elevación correcta
- **WHEN** la persona designada vuelve a autenticarse con una de sus identidades vinculadas y solicita elevarse
- **THEN** obtiene acceso global durante un período breve y limitado

#### Scenario: Elevación ajena o vencida
- **WHEN** una persona no designada intenta elevarse o una elevación ya venció
- **THEN** el sistema deniega el acceso administrativo global

### Requirement: Administración elevada auditable y en línea
El sistema MUST permitir operaciones elevadas sólo contra el servidor y MUST registrar cada escritura elevada con la persona, la operación, el objetivo y el instante.

#### Scenario: Escritura con sudo
- **WHEN** el administrador elevado modifica cualquier dato
- **THEN** la operación se ejecuta con alcance global y queda registrada en la auditoría

#### Scenario: Dispositivo sin conexión
- **WHEN** se intenta ejecutar una acción administrativa elevada sin conexión al servidor
- **THEN** el sistema no la ejecuta localmente

### Requirement: Recuperación operativa del administrador
El sistema SHALL ofrecer un comando operativo fuera de la API pública para reemplazar a la persona administradora cuando ésta no pueda autenticarse.

#### Scenario: Reasignación por CLI
- **WHEN** un operador ejecuta el comando de recuperación con una persona existente
- **THEN** esa persona pasa a ser la única administradora designada y el cambio queda registrado
