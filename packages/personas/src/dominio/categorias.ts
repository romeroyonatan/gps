/** Las tres categorias de miembro de un grupo scout. Conjunto cerrado, por eso
 *  es una constante y no una tabla: no hay siembra ni migracion que mantener, y
 *  al vivir en /dominio la comparten el servidor y las pantallas sin traducirla.
 *
 *  Beneficiarios son los que pertenecen a una rama: los chicos, y tambien los
 *  adultos de la rama Adultos, que participan como beneficiarios y no tienen
 *  chicos a cargo -que es justo lo que los distingue de ser dirigentes-.
 *  Activos son los dirigentes, que estan a cargo de las ramas y tambien
 *  pertenecen a una. Adherentes son los adultos a cargo de otras tareas -el
 *  cocinero, el capellan, el director-: no tienen chicos a cargo y no
 *  pertenecen a ninguna rama.
 *
 *  Agregar una entrada es cambio solo de codigo. Sacar o renombrar una NO lo
 *  es: la tabla pertenencias sigue guardando el id viejo. */
export const CATEGORIAS = [
  { id: 'beneficiario', nombre: 'Beneficiario' },
  { id: 'activo', nombre: 'Activo' },
  { id: 'adherente', nombre: 'Adherente' },
] as const

export type Categoria = (typeof CATEGORIAS)[number]['id']
