/** Las ramas en que la asociacion divide a sus miembros por edad. Es un
 *  conjunto cerrado, por eso es una constante y no una tabla: no hay siembra
 *  ni migracion que mantener, y al vivir en /dominio la comparten el servidor
 *  y las pantallas sin traducirla.
 *
 *  `hasta` es exclusivo y coincide con el `desde` de la rama siguiente.
 *  `hasta: null` en Adultos es la rama abierta hacia arriba: esta pensada
 *  para el mayor de 21 que participa como beneficiario y no quiere chicos a
 *  cargo, que es lo que la distingue de ser dirigente.
 *
 *  Agregar una rama es cambio solo de codigo. Sacar o renombrar una NO lo es:
 *  `ramas_del_grupo` sigue guardando el id viejo, y la fila queda invisible
 *  (el servicio filtra lo que no esta en el catalogo). Hay que migrar los
 *  datos en la misma entrega. */
export const RAMAS = [
  { id: 'castores', nombre: 'Castores', desde: 5, hasta: 7 },
  { id: 'lobatos', nombre: 'Lobatos', desde: 7, hasta: 10 },
  { id: 'scouts', nombre: 'Scouts', desde: 10, hasta: 14 },
  { id: 'raiders', nombre: 'Raiders', desde: 14, hasta: 17 },
  { id: 'rovers', nombre: 'Rovers', desde: 17, hasta: 21 },
  { id: 'adultos', nombre: 'Adultos', desde: 21, hasta: null },
] as const

export type Rama = (typeof RAMAS)[number]['id']

/** Como la pantalla nombra el tramo de edad: "7–10", o "21+" para la rama
 *  abierta hacia arriba. Vive en el dominio y no en cada pantalla porque es
 *  presentacion del dominio, no del DOM ni de React Native: dos copias
 *  divergen y nadie se entera hasta que una dice otra cosa. */
export function etiquetaDeEdades(rama: (typeof RAMAS)[number]): string {
  return rama.hasta === null ? `${rama.desde}+` : `${rama.desde}–${rama.hasta}`
}

const RAMA_POR_ID = new Map(RAMAS.map((rama) => [rama.id, rama]))

/** Busca la entrada del catalogo por id. Vive en el dominio y no en cada
 *  pantalla por la misma razon que etiquetaDeEdades: es presentacion del
 *  dominio, y dos copias divergen sin que nadie se entere -que es justo lo que
 *  paso: cuatro pantallas hacian este mismo lookup, cada una a su manera. */
export function ramaDelCatalogo(id: Rama): (typeof RAMAS)[number] | undefined {
  return RAMA_POR_ID.get(id)
}
