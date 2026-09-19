## Purpose

El permiso de salida: el trámite con el que un grupo pide a la asociación habilitar una
salida o un acampe, con sus participantes y las firmas del jefe de grupo, el director y el
comisionado de distrito.

## ADDED Requirements

### Requirement: Cargar un permiso en borrador
El sistema SHALL permitir crear un permiso de salida para un grupo abierto, con lugar,
fecha de inicio, fecha de fin, y opcionalmente una descripción de cómo se viaja. Un permiso
nuevo SHALL nacer en estado `borrador`, y sus datos SHALL poderse editar mientras siga en
ese estado. La fecha de fin MUST ser igual o posterior a la de inicio.

#### Scenario: Alta de un borrador
- **WHEN** se crea un permiso para un grupo abierto con lugar y fechas válidas
- **THEN** el permiso queda en estado `borrador` con esos datos

#### Scenario: Fechas invertidas
- **WHEN** se crea o edita un permiso con la fecha de fin anterior a la de inicio
- **THEN** el sistema rechaza la operación con un error de validación

#### Scenario: Grupo cerrado
- **WHEN** se crea un permiso para un grupo cerrado o inexistente
- **THEN** el sistema rechaza la operación

### Requirement: Participantes
Mientras el permiso esté en `borrador`, el sistema SHALL permitir agregar y quitar
participantes elegidos entre las personas con pertenencia vigente a alguna de las unidades
participantes a la fecha de inicio, más los dirigentes y adherentes del grupo. Cada participante SHALL quedar marcado como `dirigente` o `beneficiario`,
según su categoría: `activo` es dirigente y el resto es beneficiario. Una persona MUST NOT
figurar dos veces en el mismo permiso.

#### Scenario: Agregar un integrante de una unidad participante
- **WHEN** se agrega una persona con pertenencia vigente a una unidad participante en la fecha de inicio
- **THEN** figura como participante con la marca que corresponde a su categoría

#### Scenario: Persona de otro grupo
- **WHEN** se agrega una persona que no pertenece al grupo del permiso en la fecha de inicio
- **THEN** el sistema rechaza la operación

#### Scenario: Integrante de una unidad que no va
- **WHEN** se agrega una persona cuya unidad no está entre las participantes
- **THEN** el sistema rechaza la operación

#### Scenario: Quitar a quien no va
- **WHEN** se quita de la lista a un integrante de una unidad participante
- **THEN** deja de figurar como participante y la unidad sigue participando

#### Scenario: Persona repetida
- **WHEN** se agrega una persona que ya es participante
- **THEN** el sistema rechaza la operación

### Requirement: Unidades que participan
El permiso SHALL registrar qué unidades del grupo participan de la salida, elegidas entre
las unidades abiertas de ese grupo, y SHALL guardar su nombre para mostrar al emitir, junto
con la fotografía de los participantes.

#### Scenario: Una sola tropa
- **WHEN** se elige la Tropa scout "Santa Juana" de un grupo que tiene dos tropas scout
- **THEN** el permiso registra esa unidad y no la otra

#### Scenario: Unidad de otro grupo
- **WHEN** se elige una unidad que no es del grupo del permiso
- **THEN** el sistema rechaza la operación

#### Scenario: Las unidades quedan en el emitido
- **WHEN** después de emitir se le cambia el nombre a una unidad participante
- **THEN** el permiso sigue mostrando el nombre que la unidad tenía al emitirse

### Requirement: Emitir un permiso
El sistema SHALL permitir emitir un permiso en `borrador`. Emitir MUST requerir al menos un
participante `dirigente`. Al emitir, el sistema SHALL congelar los datos del permiso y una
fotografía de cada participante (nombres, apellidos, tipo y número de documento, marca),
generar el PDF del permiso con las líneas de firma vacías, guardar su hash, y pasar el
permiso a `emitido`. Un permiso emitido MUST NOT poder editarse.

#### Scenario: Emisión válida
- **WHEN** se emite un borrador con al menos un dirigente
- **THEN** el permiso pasa a `emitido`, tiene PDF y sus datos quedan congelados

#### Scenario: Sin dirigentes
- **WHEN** se emite un borrador sin ningún participante `dirigente`
- **THEN** el sistema rechaza la emisión

#### Scenario: Editar un emitido
- **WHEN** se intenta cambiar datos o participantes de un permiso `emitido`
- **THEN** el sistema rechaza la operación

#### Scenario: La fotografía no cambia
- **WHEN** después de emitir se corrige el apellido de un participante en personas
- **THEN** el permiso y su PDF siguen mostrando el apellido que tenía al emitirse

### Requirement: Aviso de anticipación
Al emitir, si entre el día de la emisión y la fecha de inicio hay menos días que la
anticipación configurada, el sistema SHALL emitir igual e informar un aviso junto con el
resultado.

#### Scenario: Emisión tardía
- **WHEN** se emite un permiso cuya fecha de inicio cae antes de la anticipación configurada
- **THEN** el permiso queda `emitido` y la respuesta incluye un aviso de anticipación

#### Scenario: Emisión a tiempo
- **WHEN** se emite con anticipación suficiente
- **THEN** la respuesta no incluye aviso

### Requirement: Firmantes
Un permiso emitido SHALL requerir exactamente tres firmas: la del jefe de grupo y la del
director del grupo del permiso, y la del comisionado del distrito al que pertenece ese
grupo. Para cada firma, el firmante SHALL ser la persona que ocupa ese cargo el día en que
se firma. El sistema SHALL guardar la fotografía de esa persona (nombres, apellidos,
documento) junto con la firma. Si el cargo no está ocupado ese día, esa firma MUST NOT
poder registrarse.

#### Scenario: Firmantes pendientes
- **WHEN** se consulta un permiso recién emitido
- **THEN** muestra tres firmas pendientes con el cargo y la persona que hoy ocupa cada uno

#### Scenario: Cargo vacante
- **WHEN** se intenta registrar la firma del comisionado y el distrito no tiene comisionado ese día
- **THEN** el sistema rechaza la firma

### Requirement: Firma en la app
El sistema SHALL permitir registrar una firma pendiente con el dibujo de la firma, guardado
como trazos vectoriales en coordenadas normalizadas. Junto con la firma, el sistema SHALL
guardar un sello calculado con una clave secreta sobre el hash del PDF emitido, los trazos,
el cargo, la persona y la fecha, y el identificador de la clave usada. Una firma registrada
MUST NOT poder modificarse.

#### Scenario: Firma dibujada
- **WHEN** se registra la firma del jefe de grupo con un dibujo
- **THEN** la firma queda registrada en modo `app`, con su sello y su identificador de clave

#### Scenario: Firma ya registrada
- **WHEN** se intenta registrar de nuevo una firma que ya está registrada
- **THEN** el sistema rechaza la operación

#### Scenario: Dibujo vacío
- **WHEN** se intenta registrar una firma sin trazos
- **THEN** el sistema rechaza la operación

### Requirement: Verificación de sellos
El sistema SHALL poder verificar el sello de una firma en la app usando la clave que indica
su identificador, y SHALL informar la firma como no verificada cuando el sello no coincide
o la clave ya no está disponible.

#### Scenario: Sello íntegro
- **WHEN** se verifica una firma cuyos datos no cambiaron
- **THEN** el resultado es verificada

#### Scenario: Datos alterados
- **WHEN** se verifica una firma cuyos trazos o cuyo hash de PDF fueron alterados en la base
- **THEN** el resultado es no verificada

#### Scenario: Clave rotada
- **WHEN** la clave activa cambió y se verifica una firma sellada con la clave anterior, que sigue configurada
- **THEN** el resultado es verificada

### Requirement: Firma en papel
El sistema SHALL permitir registrar una o más firmas pendientes en modo `papel` subiendo un
escaneo o foto del PDF impreso y firmado. Un mismo escaneo SHALL poder respaldar varias
firmas del mismo permiso.

#### Scenario: Director en papel
- **WHEN** se sube un escaneo y se lo asocia a la firma del director
- **THEN** la firma del director queda registrada en modo `papel` con ese escaneo

#### Scenario: Un escaneo, dos firmas
- **WHEN** se sube un escaneo y se lo asocia a las firmas del jefe de grupo y del director
- **THEN** las dos firmas quedan registradas en modo `papel` con el mismo escaneo

#### Scenario: Escanear con una impresora
- **WHEN** el escaneo que se sube es un PDF
- **THEN** la firma queda registrada igual que con una foto

#### Scenario: Un archivo que no se puede anexar
- **WHEN** se intenta respaldar una firma con un archivo que no es imagen ni PDF, como un documento de Word
- **THEN** el sistema rechaza la firma, diciendo que suba una foto o un PDF

### Requirement: Permiso firmado
Cuando las tres firmas estén registradas, el permiso SHALL pasar a `firmado`. El sistema
SHALL ofrecer el PDF firmado: el PDF emitido con las firmas en la app estampadas en su
línea, una referencia a los escaneos en las líneas firmadas en papel, y las imágenes de los
escaneos agregadas como páginas.

#### Scenario: Última firma
- **WHEN** se registra la tercera firma
- **THEN** el permiso pasa a `firmado` y el PDF firmado queda disponible

#### Scenario: Firma mixta
- **WHEN** el comisionado y el jefe de grupo firmaron en la app y el director en papel
- **THEN** el PDF firmado muestra dos firmas dibujadas y el escaneo del director como página adicional

#### Scenario: Un escaneo en PDF de varias páginas
- **WHEN** el escaneo de una firma es un PDF de dos páginas
- **THEN** las dos se anexan al PDF firmado, conservando su contenido

#### Scenario: Un escaneo ilegible
- **WHEN** el escaneo de una firma no se puede leer
- **THEN** el PDF firmado se sigue pudiendo descargar, y el anexo dice que ese archivo no se pudo mostrar

### Requirement: El PDF firmado se compone
El PDF firmado SHALL componerse a partir del PDF emitido y del estado actual de las firmas,
y MUST NOT ser el escaneo subido. En la línea de cada firma en la app SHALL dibujarse sus
trazos; en la de cada firma en papel SHALL indicarse que se firmó en papel y remitir al
anexo. El resultado SHALL ser el mismo cualquiera sea el orden en que se firmó.

#### Scenario: El papel primero
- **WHEN** el director firma en papel y recién después firman en la app el jefe de grupo y el comisionado
- **THEN** la página principal del PDF firmado muestra las dos firmas dibujadas y la marca de firma en papel del director

#### Scenario: La app primero
- **WHEN** firman en la app el jefe de grupo y el comisionado y después el director en papel
- **THEN** la página principal del PDF firmado se ve igual que en el caso anterior

#### Scenario: El escaneo se conserva como anexo
- **WHEN** se descarga el PDF firmado de un permiso con una firma en papel
- **THEN** el escaneo aparece como página anexa, tal como se subió

### Requirement: PDF para imprimir
Para un permiso emitido, el sistema SHALL permitir descargar el PDF en su estado actual, con
las firmas en la app que ya estén registradas y el resto de las líneas vacías, para
imprimirlo y firmarlo en papel.

#### Scenario: Imprimir con una firma
- **WHEN** firmó solo el comisionado en la app y se descarga el PDF
- **THEN** el PDF tiene la firma del comisionado estampada y las otras dos líneas vacías

#### Scenario: Aviso de orden
- **WHEN** se ofrece imprimir un permiso al que le faltan firmas
- **THEN** se informa que conviene registrar primero las firmas en la app, sin impedir la descarga

### Requirement: Anular y re-emitir
El sistema SHALL permitir anular un permiso `emitido` o `firmado`, que pasa a `anulado` y
MUST NOT admitir nuevas firmas. El sistema SHALL permitir crear, a partir de un permiso
anulado, un borrador nuevo con sus mismos datos y participantes, sin firmas, que referencie
al permiso del que salió.

#### Scenario: Anular un emitido
- **WHEN** se anula un permiso `emitido`
- **THEN** pasa a `anulado` y se rechaza cualquier firma posterior

#### Scenario: Re-emitir
- **WHEN** se re-emite un permiso anulado
- **THEN** existe un borrador nuevo con los mismos datos y participantes, sin firmas, que referencia al anulado

#### Scenario: Anular un borrador
- **WHEN** se intenta anular un permiso en `borrador`
- **THEN** el sistema rechaza la operación

### Requirement: Adjuntos
El sistema SHALL permitir adjuntar archivos a un permiso en cualquier estado, y listarlos
con su nombre. Un adjunto no se anexa al PDF, así que SHALL poder ser cualquiera de los
tipos admitidos, incluida una planificación en Word. Los adjuntos MUST NOT formar parte del
PDF ni del hash que sellan las firmas.

#### Scenario: Adjuntar a un firmado
- **WHEN** se adjunta una planificación a un permiso `firmado`
- **THEN** el adjunto queda listado y las firmas siguen verificadas

#### Scenario: Una planificación en Word
- **WHEN** se adjunta un `.docx`
- **THEN** el adjunto queda listado

#### Scenario: Un archivo de otro permiso
- **WHEN** se intenta adjuntar un archivo que no es de este permiso
- **THEN** el sistema rechaza la operación

### Requirement: Quitar un adjunto
El sistema SHALL permitir quitar un adjunto de un permiso en cualquier estado, lo que
SHALL borrar también su archivo. Quitar un adjunto MUST NOT alterar las firmas ni los
escaneos que las respaldan. Un adjunto de otro permiso MUST NOT poder quitarse.

#### Scenario: Se cargó el archivo equivocado
- **WHEN** se quita un adjunto
- **THEN** deja de figurar y su archivo ya no se puede descargar

#### Scenario: Quitar de un permiso firmado
- **WHEN** se quita un adjunto de un permiso `firmado`
- **THEN** las tres firmas siguen verificadas

#### Scenario: El escaneo de una firma no es un adjunto
- **WHEN** se quita un adjunto de un permiso que además tiene una firma en papel
- **THEN** el escaneo de esa firma sigue existiendo

#### Scenario: Un adjunto de otro permiso
- **WHEN** se intenta quitar un adjunto que pertenece a otro permiso
- **THEN** el sistema rechaza la operación

### Requirement: Listar permisos de un grupo
El sistema SHALL listar los permisos de un grupo con su estado, lugar y fechas, del más
reciente al más antiguo por fecha de inicio.

#### Scenario: Listado
- **WHEN** se consultan los permisos de un grupo con tres permisos
- **THEN** se devuelven los tres ordenados por fecha de inicio descendente
