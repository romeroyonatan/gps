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
 *  `unidad` es como se llama la subdivision del grupo que da esa rama: la
 *  Manada de lobatos, la Tropa scout. Es el tipo, no el nombre propio -ese lo
 *  pone cada grupo-, y por eso vive en el catalogo y no en la tabla: se deriva
 *  de la rama y no lo elige nadie. Scouts y raiders llevan la rama en el tipo
 *  porque a las tres se les dice tropa.
 *
 *  Agregar una rama es cambio solo de codigo. Sacar o renombrar una NO lo es:
 *  `unidades` sigue guardando el id viejo, y la fila queda invisible
 *  (el servicio filtra lo que no esta en el catalogo). Hay que migrar los
 *  datos en la misma entrega. */
export const RAMAS = [
  { id: 'castores', nombre: 'Castores', desde: 5, hasta: 7, unidad: 'Colonia' },
  { id: 'lobatos', nombre: 'Lobatos', desde: 7, hasta: 10, unidad: 'Manada' },
  { id: 'scouts', nombre: 'Scouts', desde: 10, hasta: 14, unidad: 'Tropa scout' },
  { id: 'raiders', nombre: 'Raiders', desde: 14, hasta: 17, unidad: 'Tropa raider' },
  { id: 'rovers', nombre: 'Rovers', desde: 17, hasta: 21, unidad: 'Clan' },
  {
    id: 'adultos',
    nombre: 'Adultos',
    desde: 21,
    hasta: null,
    unidad: 'Tropa Scout Adultos',
  },
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

/** Que rama le corresponde a una edad. `hasta` es exclusivo -el de 10 ya es
 *  scout, no lobato- y Adultos esta abierta hacia arriba.
 *
 *  Es lo que deja que el alta proponga la unidad en vez de pedirla: la edad ya
 *  dice a donde va, y elegirla a mano es corregir una sugerencia, no completar
 *  un campo vacio. Vive en el dominio porque es la misma regla que el grupo
 *  aplica en el mundo, y la van a querer las dos apps.
 *
 *  Undefined por debajo de castores: el de 3 anios no entra en ninguna rama, y
 *  devolver la primera seria inventar que si. */
export function ramaParaEdad(edad: number): (typeof RAMAS)[number] | undefined {
  return RAMAS.find((rama) => edad >= rama.desde && (rama.hasta === null || edad < rama.hasta))
}
