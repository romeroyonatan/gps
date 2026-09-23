## Purpose

Conservar y consultar un rastro confiable y legible de quién realizó cada cambio relevante, para investigar actividad y resolver ediciones en conflicto sin duplicar secretos ni datos innecesarios.

## ADDED Requirements

### Requirement: Toda escritura realizada por una persona es auditable
El sistema MUST registrar cada escritura exitosa iniciada por una persona con el actor, instante, módulo, acción, uso de elevación, entidad afectada y grupo cuando la acción pertenezca a uno. Una escritura interna sin una persona detrás MUST identificar su origen interno cuando resulte auditable y MUST NOT atribuirse a una persona ficticia.

#### Scenario: Escritura ordinaria exitosa
- **WHEN** una persona ejecuta correctamente una acción que modifica datos
- **THEN** queda un evento que permite identificar quién actuó, qué acción realizó, sobre qué entidad, en qué módulo, en qué grupo y cuándo

#### Scenario: Escritura ordinaria rechazada
- **WHEN** una escritura ordinaria falla por validación, autorización o cualquier otro error
- **THEN** no queda registrada como una modificación realizada

#### Scenario: Reacción interna
- **WHEN** una escritura interna auditable se produce como consecuencia de otra acción, como la generación de una deuda por una declaración
- **THEN** el evento identifica el origen interno y conserva la relación de negocio disponible sin atribuírselo a otra persona

### Requirement: El detalle conserva sólo lo necesario para explicar el cambio
El sistema MUST guardar los valores anteriores y nuevos de cada campo relevante en una edición. Para altas, anulaciones, firmas y otras acciones discretas MUST guardar un resumen estructurado de la acción. MUST NOT copiar indiscriminadamente argumentos o resultados de GraphQL ni guardar secretos, tokens, enlaces privados, bytes de archivos o trazos de firma en la auditoría.

#### Scenario: Edición de una selección
- **WHEN** una persona reemplaza el responsable o las unidades de un permiso
- **THEN** el evento muestra la selección anterior y la nueva

#### Scenario: Acción discreta
- **WHEN** una persona crea, anula, emite o firma una entidad
- **THEN** el evento contiene un resumen identificable de la acción sin inventar un estado anterior y posterior

#### Scenario: Entrada sensible
- **WHEN** una acción recibe un secreto, un archivo o trazos de firma
- **THEN** la auditoría registra la acción y sus referencias permitidas sin copiar ese contenido sensible

### Requirement: La auditoría es consistente y de sólo agregado
El evento de una escritura exitosa MUST confirmarse en la misma transacción que el cambio auditado. Los eventos confirmados MUST ser permanentes y el sistema MUST NOT ofrecer operaciones para editarlos o borrarlos, ni siquiera a una persona administradora.

#### Scenario: Falla del cambio
- **WHEN** una transacción que modifica datos falla
- **THEN** ni el cambio ni su evento de auditoría quedan confirmados

#### Scenario: Falla del registro
- **WHEN** no puede guardarse el evento obligatorio de una escritura
- **THEN** la modificación tampoco queda confirmada

#### Scenario: Intento de alterar el historial
- **WHEN** cualquier persona intenta editar o borrar un evento confirmado mediante la aplicación
- **THEN** no existe una operación que lo permita

### Requirement: Las acciones sensibles rechazadas también dejan rastro
El sistema MUST registrar los intentos rechazados de elevación, recuperación de identidad, reasignación administrativa y escritura elevada. El evento MUST distinguir un intento rechazado de una modificación exitosa y MUST excluir credenciales y secretos. Los errores ordinarios de formularios MUST NOT producir eventos fallidos.

#### Scenario: Intento de elevación rechazado
- **WHEN** una persona intenta elevar una sesión y la comprobación es rechazada
- **THEN** queda un evento de seguridad con el actor identificable, la acción, el instante y el resultado rechazado, sin credenciales

#### Scenario: Error ordinario de formulario
- **WHEN** una escritura no sensible falla por datos inválidos
- **THEN** la auditoría no agrega un evento de intento fallido

### Requirement: La consulta respeta el ámbito y la elevación
Jefatura y Secretaría SHALL poder consultar únicamente los eventos pertenecientes a sus grupos vigentes. El administrador MUST tener elevación vigente para consultar eventos de toda la diócesis. Perder la función o vencer la elevación MUST retirar el acceso en el pedido siguiente.

#### Scenario: Secretaría consulta su grupo
- **WHEN** una integrante vigente de Secretaría consulta la auditoría de su grupo
- **THEN** recibe los eventos de ese grupo y ningún evento de otros ámbitos

#### Scenario: Jefatura intenta consultar otro grupo
- **WHEN** un jefe solicita eventos de un grupo fuera de sus funciones vigentes
- **THEN** el sistema no devuelve esos eventos

#### Scenario: Administrador elevado consulta toda la diócesis
- **WHEN** la persona administradora tiene elevación vigente y consulta la auditoría sin limitarla a un grupo
- **THEN** recibe eventos de todos los módulos y ámbitos

#### Scenario: Elevación vencida
- **WHEN** vence la elevación administrativa
- **THEN** el siguiente pedido deja de tener acceso global a la auditoría

### Requirement: Los eventos pueden filtrarse y leerse como acciones de negocio
La consulta SHALL admitir filtros combinables por intervalo de fechas, grupo, actor, módulo y acción, y SHALL ordenar los resultados del más reciente al más antiguo. Cada resultado MUST presentar nombres de negocio legibles junto con sus identificadores estables y el detalle permitido.

#### Scenario: Filtros combinados
- **WHEN** una persona autorizada elige un período, un grupo, un actor, un módulo y una acción
- **THEN** la consulta devuelve únicamente los eventos que cumplen todos los filtros dentro de su alcance

#### Scenario: Historial sin filtros opcionales
- **WHEN** una persona autorizada abre la auditoría sin filtros opcionales
- **THEN** recibe primero los eventos más recientes que puede consultar

### Requirement: La actividad existente se consulta desde un registro unificado
Los cambios de autoridad y los eventos de seguridad existentes MUST aparecer en la misma consulta que las demás acciones, conservando su actor, objetivo, ámbito e instante disponibles. La incorporación de la auditoría general MUST NOT descartar el historial ya registrado.

#### Scenario: Cambio de autoridad previo
- **WHEN** se consulta un nombramiento o remoción registrado antes de incorporar la auditoría general
- **THEN** aparece en el historial unificado con los datos históricos disponibles

#### Scenario: Evento de seguridad previo
- **WHEN** se consulta una elevación, invitación o recuperación ya registrada
- **THEN** aparece en el historial unificado sin revelar secretos

### Requirement: Auditoría y Plantel viven bajo Más en navegación angosta
En mobile y web angosta, la navegación del grupo MUST conservar cinco destinos: Principal, Nómina, Salidas, Tesorería y Más. Más SHALL abrir una pantalla completa con entradas para Plantel y Auditoría, y SHALL permanecer seleccionado al navegar a cualquiera de ellas. En escritorio, Plantel y Auditoría SHALL permanecer disponibles directamente en la navegación lateral.

#### Scenario: Abrir Auditoría desde un teléfono
- **WHEN** una persona toca Más y luego Auditoría
- **THEN** se abre la auditoría del grupo como una pantalla normal y la barra inferior conserva Más seleccionado

#### Scenario: Navegación de escritorio
- **WHEN** una persona autorizada usa la aplicación en una pantalla de escritorio
- **THEN** puede entrar directamente a Plantel o Auditoría sin pasar por una pantalla Más
