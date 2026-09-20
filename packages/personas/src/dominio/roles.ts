import type { Actor, AmbitoDeRol, Rol, RolConAmbito } from '@gps/core'

/** Cómo se llama cada función en la asociación. `Rol` viaja como enum de
 *  GraphQL, así que el cliente recibe la clave; el nombre lo pone acá el
 *  dominio, que es quien habla el idioma del escultismo. */
const NOMBRES: Record<Rol, string> = {
  dirigente: 'Dirigente',
  jefeDeGrupo: 'Jefatura de grupo',
  secretariaDeGrupo: 'Secretaría de grupo',
  directorDeGrupo: 'Dirección de grupo',
  comisionadoDeDistrito: 'Comisionado/a de distrito',
  autoridadDeDistrito: 'Autoridad de distrito',
  jefeScoutDiocesano: 'Jefatura scout diocesana',
  administracionDiocesana: 'Administración diocesana',
  tesoreriaDiocesana: 'Tesorería diocesana',
}

export function nombreDelRol(rol: Rol): string {
  return NOMBRES[rol]
}

/** Identifica un rol con su ámbito, para recordar cuál está activo entre
 *  sesiones sin guardar el objeto entero. */
export function claveDelRol(funcion: RolConAmbito): string {
  return `${funcion.rol}@${funcion.ambito.tipo}:${funcion.ambito.id ?? ''}`
}

/** Las funciones entre las que vale la pena elegir.
 *
 *  Toda persona activa es `dirigente` de su grupo, así que quien además es su
 *  jefatura tiene dos roles en el mismo grupo y elegir entre ellos no lleva a
 *  ningún lado distinto: el más fuerte absorbe al otro. Por eso `dirigente` se
 *  cae cuando hay otra función en ese mismo grupo. Las demás conviven —quien
 *  es tesorería y administración diocesana hace dos trabajos distintos en el
 *  mismo ámbito— y se ofrecen las dos.
 *
 *  Con una sola función la pantalla no muestra el conmutador: no se ofrece un
 *  menú de una sola opción. */
export function rolesParaElegir(actor: Actor): readonly RolConAmbito[] {
  const elegibles = actor.roles.filter(
    (funcion) =>
      funcion.rol !== 'dirigente' ||
      !actor.roles.some(
        (otra) => otra.rol !== 'dirigente' && mismoAmbito(otra.ambito, funcion.ambito),
      ),
  )
  // Un cargo y un equipo pueden conceder la misma función en el mismo ámbito.
  const vistas = new Set<string>()
  return elegibles.filter((funcion) => {
    const clave = claveDelRol(funcion)
    if (vistas.has(clave)) return false
    vistas.add(clave)
    return true
  })
}

const mismoAmbito = (
  una: { tipo: AmbitoDeRol; id: string | null },
  otra: { tipo: AmbitoDeRol; id: string | null },
) => una.tipo === otra.tipo && una.id === otra.id
