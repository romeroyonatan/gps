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
