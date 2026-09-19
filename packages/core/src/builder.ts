import SchemaBuilder from '@pothos/core'
import type { Context } from './context'

/** Crea el builder compartido. El tipo Query se declara aca una sola vez
 *  para que los modulos puedan usar queryField sin pisarse.
 *
 *  `defaultFieldNullability: false` invierte el default de GraphQL, que es
 *  nullable en todos lados: sin esto, cada campo del esquema publico -el
 *  contrato que consumen web y mobile- seria opcional aunque el resolver
 *  nunca devuelva null, y eso obligaria a null-check en cada cliente para
 *  siempre. No lo saques pensando que es ruido. */
export function crearBuilder() {
  const builder = new SchemaBuilder<{
    Context: Context
    DefaultFieldNullability: false
  }>({ defaultFieldNullability: false })
  builder.queryType({})
  // Mutation se declara aca por la misma razon que Query: para que cada modulo
  // le agregue campos con builder.mutationField(...) sin competir por declarar
  // el tipo, y el orden de registro no importe.
  //
  // Ojo: GraphQL exige que un tipo tenga al menos un campo, asi que el esquema
  // no compone si ningun modulo registrado aporta una mutation. Hoy la aporta
  // personas.
  builder.mutationType({})
  return builder
}

export type Builder = ReturnType<typeof crearBuilder>

/** Los enums que ya declaro algun modulo, colgados del propio builder. No es
 *  una constante de modulo porque los tests arman varios builders y no tienen
 *  por que contaminarse entre si; y no es un WeakMap porque cada modulo puede
 *  recibir un envoltorio del builder -componerEsquema le pasa uno para anotar
 *  quien registra cada campo raiz- y todos tienen que compartir el registro. */
const REGISTRO = Symbol.for('gps.enums-compartidos')

type RegistroDeEnums = Map<
  string,
  { valores: readonly string[]; descripcion: string | undefined; ref: unknown }
>

function registroDe(builder: Builder): RegistroDeEnums {
  const conRegistro = builder as unknown as { [REGISTRO]?: RegistroDeEnums }
  const registro = conRegistro[REGISTRO] ?? new Map()
  conRegistro[REGISTRO] = registro
  return registro
}

export class ValoresDistintos extends Error {
  constructor(nombre: string, unos: readonly string[], otros: readonly string[]) {
    super(
      `Dos modulos declaran el enum "${nombre}" con valores distintos: ` +
        `[${unos.join(', ')}] y [${otros.join(', ')}].`,
    )
    this.name = 'ValoresDistintos'
  }
}

// Mismo motivo que ValoresDistintos: si dos modulos declaran el mismo enum con
// descripcion distinta, sin este chequeo gana en silencio el que se registra
// primero, y eso depende del orden de los modulos.
export class DescripcionesDistintas extends Error {
  constructor(nombre: string, una: string | undefined, otra: string | undefined) {
    super(
      `Dos modulos declaran el enum "${nombre}" con descripciones distintas: ` +
        `"${una ?? ''}" y "${otra ?? ''}".`,
    )
    this.name = 'DescripcionesDistintas'
  }
}

// El cast de `values` es el mismo que hacia estructura antes de este helper:
// Pothos no infiere el tipo del enum desde un readonly V[] que no sea literal.
function crearEnum<V extends string>(
  builder: Builder,
  nombre: string,
  valores: readonly V[],
  descripcion?: string,
) {
  return builder.enumType(nombre, {
    values: valores as unknown as readonly V[],
    description: descripcion,
  })
}

/** Un enum de GraphQL que declara mas de un modulo. El primero que lo pide lo
 *  crea; los demas reciben el mismo ref.
 *
 *  Existe porque Pothos tiene objectRef, inputRef e interfaceRef diferidos
 *  -se crean en un archivo y se implementan en otro- pero no tiene enumRef: un
 *  enum solo se crea con enumType, y crearlo dos veces con el mismo nombre
 *  aborta el esquema. Y `Rama` la necesitan estructura, que la define, y
 *  personas, que la usa en la pertenencia.
 *
 *  El catalogo NO sube a core: sigue viviendo en el /dominio del modulo que lo
 *  define, y los dos se lo pasan a este helper. Lo que vive aca es la plomeria
 *  de registrar una sola vez, que es lo que core es. */
export function enumCompartido<V extends string>(
  builder: Builder,
  nombre: string,
  valores: readonly V[],
  descripcion?: string,
): ReturnType<typeof crearEnum<V>> {
  const delBuilder = registroDe(builder)

  const registrado = delBuilder.get(nombre)
  if (registrado) {
    const iguales =
      registrado.valores.length === valores.length &&
      registrado.valores.every((valor, indice) => valor === valores[indice])
    if (!iguales) throw new ValoresDistintos(nombre, registrado.valores, valores)
    if (registrado.descripcion !== descripcion) {
      throw new DescripcionesDistintas(nombre, registrado.descripcion, descripcion)
    }
    return registrado.ref as ReturnType<typeof crearEnum<V>>
  }

  const ref = crearEnum(builder, nombre, valores, descripcion)
  delBuilder.set(nombre, { valores, descripcion, ref })
  return ref
}
