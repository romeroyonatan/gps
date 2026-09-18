# archivos

## Purpose

Guardar archivos subidos por usuarios —escaneos, planificaciones— con un dueño desde el
momento en que nacen, y autorizar su descarga preguntándole a ese dueño.

## Requirements

### Requirement: Subida en tres pasos
El sistema SHALL subir archivos en tres pasos: solicitar la subida declarando nombre, tipo
MIME, tamaño, módulo dueño y recurso dueño, y recibir un id y una URL de subida con
vencimiento; enviar los bytes a esa URL; y confirmar la subida. Un archivo no confirmado
MUST NOT poder descargarse ni asociarse a nada.

#### Scenario: Subida completa
- **WHEN** se solicita una subida, se envían los bytes a la URL y se confirma
- **THEN** el archivo queda registrado con su dueño, tamaño y hash

#### Scenario: URL vencida
- **WHEN** se envían los bytes a una URL de subida vencida
- **THEN** el sistema rechaza el envío

#### Scenario: Tamaño distinto al declarado
- **WHEN** se confirma una subida cuyos bytes no coinciden con el tamaño declarado
- **THEN** el sistema rechaza la confirmación

### Requirement: Tipos y tamaños admitidos
El sistema SHALL rechazar al solicitar la subida cualquier tipo MIME fuera de la lista
admitida y cualquier tamaño por encima del máximo configurado. La lista SHALL incluir
imágenes (JPEG, PNG, HEIC, HEIF), PDF y documentos de oficina (Word, Excel y sus
equivalentes de LibreOffice). El sistema MUST NOT admitir tipos que el navegador ejecute al
mostrarlos, como HTML o SVG.

El sistema no decide para qué sirve cada archivo: el módulo dueño restringe más cuando lo
necesita.

#### Scenario: Tipo no admitido
- **WHEN** se solicita subir un archivo `application/zip`
- **THEN** el sistema rechaza la solicitud, diciendo qué tipo se rechazó

#### Scenario: Una planificación en Word
- **WHEN** se solicita subir un `.docx`
- **THEN** el sistema acepta la solicitud

#### Scenario: Demasiado grande
- **WHEN** se solicita subir un archivo más grande que el máximo
- **THEN** el sistema rechaza la solicitud

### Requirement: Conversión de HEIC
Al confirmar la subida de una imagen HEIC o HEIF, el sistema SHALL convertirla a JPEG y
guardar sólo el JPEG, con su tipo, tamaño y hash. El original MUST NOT conservarse.

#### Scenario: Foto de iPhone
- **WHEN** se sube y confirma una imagen `image/heic`
- **THEN** el archivo registrado es `image/jpeg` y su descarga devuelve un JPEG

#### Scenario: HEIC ilegible
- **WHEN** se confirma una subida declarada `image/heic` cuyos bytes no se pueden decodificar
- **THEN** el sistema rechaza la confirmación

### Requirement: Todo archivo tiene dueño
Cada archivo SHALL registrarse con el módulo y el recurso al que pertenece desde la
solicitud de subida. El sistema MUST NOT aceptar una solicitud sin dueño.

#### Scenario: Sin dueño
- **WHEN** se solicita una subida sin módulo o sin recurso dueño
- **THEN** el sistema rechaza la solicitud

### Requirement: Descarga autorizada por el dueño
Para descargar un archivo, el sistema SHALL preguntar al módulo dueño si el pedido está
autorizado, y MUST rechazar la descarga si el dueño no lo autoriza o no está registrado.

#### Scenario: Dueño autoriza
- **WHEN** se pide descargar un escaneo cuyo módulo dueño autoriza el pedido
- **THEN** se devuelven los bytes con su tipo MIME

#### Scenario: Dueño no registrado
- **WHEN** se pide descargar un archivo cuyo módulo dueño no está registrado
- **THEN** el sistema rechaza la descarga

### Requirement: La descarga lleva el nombre del archivo
Al entregar un archivo, el sistema SHALL informar su nombre original, y SHALL permitir
pedirlo para bajar en vez de para mostrar. Un nombre que pueda romper la forma de esa
respuesta SHALL entregarse saneado.

#### Scenario: Guardar no deja el id como nombre
- **WHEN** se descarga un archivo llamado "escaneo.jpg"
- **THEN** la respuesta informa ese nombre y no el identificador interno

#### Scenario: Pedirlo para bajar
- **WHEN** se pide el archivo indicando que se quiere descargar
- **THEN** la respuesta indica que se baje en vez de mostrarse

#### Scenario: Un nombre con comillas
- **WHEN** se descarga un archivo cuyo nombre tiene comillas
- **THEN** la respuesta sigue siendo válida y el nombre va sin ellas

### Requirement: Borrar un archivo
El sistema SHALL permitir al módulo dueño borrar uno de sus archivos, indicando además de
qué recurso suyo es. El sistema MUST NOT borrar un archivo a pedido de un módulo que no es
su dueño, ni de otro recurso del mismo módulo. Borrar SHALL quitar el registro y el
contenido.

#### Scenario: El dueño borra
- **WHEN** el módulo dueño borra un archivo de su recurso
- **THEN** el archivo deja de existir y su contenido tampoco se puede descargar

#### Scenario: Otro módulo no puede
- **WHEN** un módulo que no es el dueño pide borrar el archivo
- **THEN** el archivo sigue existiendo

#### Scenario: Otro recurso del mismo módulo tampoco
- **WHEN** el módulo dueño pide borrarlo declarando otro recurso
- **THEN** el archivo sigue existiendo

#### Scenario: Borrar algo que no existe
- **WHEN** se pide borrar un archivo inexistente
- **THEN** la operación informa que no borró nada, sin fallar
