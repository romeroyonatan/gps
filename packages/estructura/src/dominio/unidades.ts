import type { Unidad } from './modelos'
import { RAMAS, type Rama, ramaDelCatalogo } from './ramas'

/** Como la pantalla nombra una unidad: el tipo que le da su rama, su nombre
 *  propio y su sexo. Vive en el dominio y no en cada pantalla por la misma
 *  razon que etiquetaDeEdades: es presentacion del dominio, y dos copias
 *  divergen sin que nadie se entere.
 *
 *  Un grupo con una sola unidad de la rama suele llamarla como su tipo -"la
 *  Manada"-, y ese es el nombre que le puso la migracion a las que venian de
 *  `ramas_del_grupo`: cuando el nombre propio ya es el tipo, no se repite.
 *
 *  Una unidad de una rama que ya no esta en el catalogo cae en el nombre
 *  propio solo: no rompe, igual que ramaDelCatalogo devuelve undefined. */
export function nombreDeLaUnidad(unidad: Pick<Unidad, 'rama' | 'nombre' | 'sexo'>): string {
  const tipo = ramaDelCatalogo(unidad.rama)?.unidad
  const nombre =
    tipo === undefined || tipo === unidad.nombre ? unidad.nombre : `${tipo} ${unidad.nombre}`
  return `${nombre} · ${unidad.sexo}`
}

/** Las ramas que el grupo tiene abiertas, que son las de sus unidades sin
 *  repetir. Dos tropas scout son una sola rama abierta.
 *
 *  Recorre el catalogo en vez de las unidades para ordenar y filtrar de una:
 *  el orden es el de edad y no el de insercion, y una rama que ya no esta en
 *  RAMAS no se cuela hasta el enum de GraphQL. Importa porque `ramas: [Rama!]!`
 *  es no nulo hasta arriba, asi que un id viejo anularia la query entera. */
export function ramasDeLasUnidades(unidades: readonly Pick<Unidad, 'rama'>[]): Rama[] {
  const abiertas = new Set<string>(unidades.map((unidad) => unidad.rama))
  return RAMAS.map((rama) => rama.id).filter((id) => abiertas.has(id))
}
