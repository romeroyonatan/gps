import type { Context } from '@gps/core'

/** Contexto por request. Hoy es constante; cuando exista auth, aca se
 *  resuelve el actor a partir del token del pedido. */
export function crearContexto(base: Context): () => Context {
  return () => base
}
