## Context

`packages/afiliacion/src/servidor/servicio.ts` contiene contrato, errores, consultas SQL, selección de nóminas, validación temporal, transacciones y ejecución de declaraciones pendientes. `packages/estructura/src/servidor/servicio.ts` también reúne todas sus operaciones, aunque allí casi todas son persistencia directa y el costo de separarlas sería mayor que la claridad obtenida.

El código bajo `/dominio` debe seguir siendo puro, isomorfo y sin estado. Drizzle, `Core`, reloj, IDs, logging y transacciones pertenecen a `/servidor`. Las interfaces públicas, GraphQL y el comportamiento actual no deben cambiar.

## Goals / Non-Goals

**Goals:**

- Hacer que las decisiones de negocio puedan encontrarse por su nombre bajo `/dominio`.
- Hacer que `servicio.ts` muestre el contrato y componga operaciones, en vez de implementar todo el módulo.
- Mantener juntos los efectos que necesitan compartir una transacción o coordinación.
- Dejar una convención explícita y proporcional para módulos futuros.

**Non-Goals:**

- Introducir capas genéricas de repositorio, puertos, adaptadores, comandos o handlers.
- Exigir un archivo por método o una estructura idéntica en todos los módulos.
- Cambiar APIs, tablas, consultas observables o reglas existentes.
- Preparar infraestructura para necesidades futuras como eventos, auth o almacenamiento local.

## Decisions

### 1. Separar decisiones puras de la ejecución del caso de uso

Afiliación tendrá una función pura de dominio que seleccione y agrupe las nóminas declarables a partir de miembros activos, grupos abiertos, grupos ya declarados y el grupo opcional solicitado. La función no leerá la base, el reloj ni generará IDs.

La validación temporal y el cálculo de períodos continuarán en las funciones puras ya existentes. La capa de servidor obtendrá sus entradas, invocará esas reglas y persistirá el resultado.

**Alternativa descartada:** mover `declarar` completo a `/dominio` mediante interfaces para repositorio, reloj, logger y unidad de trabajo. Agrega abstracciones con una sola implementación y complica la transacción sin volver más clara la regla central.

### 2. Organizar `/servidor` por comportamiento cohesivo, no por infraestructura genérica

Afiliación separará las operaciones de declaración de las consultas. Los archivos tendrán nombres del negocio; `servicio.ts` conservará `ServicioDeAfiliacion` y ensamblará ambos grupos de operaciones. `declarar`, `declararExtraordinaria` y `declararPendientes` permanecerán juntos cuando compartir cierres privados evite pasar una colección artificial de dependencias entre archivos.

Las consultas simples permanecerán juntas. La regla de cobro seguirá documentando que la cobertura es por persona y período en toda la asociación, no por grupo; sólo se extraerá una función pura adicional si expresa una decisión no trivial en vez de envolver un `filter` de una línea.

**Alternativa descartada:** un archivo, factory e interfaz por método. Multiplica navegación y composición sin aislar decisiones nuevas.

### 3. No fragmentar Estructura por simetría

Estructura conservará en `servicio.ts` las altas y consultas sencillas. La condición histórica de que un grupo está abierto durante todo el día de su cierre se extraerá a una función pura de dominio con nombre explícito y se usará desde `gruposAbiertosEn`.

`cerrarGrupo` no tendrá archivo propio mientras sólo sea una actualización atómica pequeña; separar persistencia no equivale a extraer una regla.

### 4. Documentar un criterio, no una plantilla obligatoria

`docs/arquitectura.md` explicará las tres responsabilidades:

```text
/dominio   decisiones puras y vocabulario del negocio
/servidor  orquestación de efectos y persistencia
servicio.ts contrato y composición; implementación local sólo si sigue siendo pequeña
```

`AGENT.md` indicará que un módulo nuevo no debe acumular por defecto todas las reglas en `servicio.ts`, pero tampoco debe crear capas vacías. Se extrae una regla cuando puede expresarse puramente y se separa un caso de uso cuando su nombre y cohesión mejoran la lectura.

## Risks / Trade-offs

- [Riesgo] La extracción puede convertirse en mero movimiento de líneas sin mejorar el vocabulario. -> Nombrar funciones por decisiones del negocio y mantener SQL fuera de ellas.
- [Riesgo] Demasiados archivos pequeños pueden empeorar la navegación. -> Separar sólo Afiliación donde existe complejidad real y una única regla histórica de Estructura.
- [Riesgo] Cambiar el orden de validaciones o consultas puede alterar casos límite. -> Conservar el flujo actual y ejecutar la suite completa; agregar tests directos sólo para las nuevas funciones puras.
- [Riesgo] Exportar helpers internos amplía accidentalmente la API del paquete. -> Exportarlos sólo desde sus archivos internos salvo que otro módulo tenga un consumidor real.

## Migration Plan

1. Extraer y probar las reglas puras sin cambiar los puntos de entrada públicos.
2. Reorganizar Afiliación detrás de la misma factory e interfaz de servicio.
3. Usar la regla histórica pura desde Estructura.
4. Actualizar la documentación y ejecutar `bun run check` y `bun run schema` para verificar que el schema no cambió.

El rollback consiste en revertir la reorganización: no hay migraciones de datos ni cambios de API.
