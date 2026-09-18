## Purpose

Guardar archivos subidos por usuarios —escaneos, planificaciones— con un dueño desde el
momento en que nacen, y autorizar su descarga preguntándole a ese dueño.

## ADDED Requirements

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
admitida (imágenes JPEG, PNG, HEIC y HEIF, y PDF) y cualquier tamaño por encima del máximo
configurado.

#### Scenario: Tipo no admitido
- **WHEN** se solicita subir un archivo `application/zip`
- **THEN** el sistema rechaza la solicitud

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
