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
  return builder
}

export type Builder = ReturnType<typeof crearBuilder>
