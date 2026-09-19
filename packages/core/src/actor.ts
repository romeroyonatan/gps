/** Las funciones que la autorizacion conoce. Es un catalogo y no solo una
 *  union de tipos porque ademas de tipar el codigo tiene que viajar al cliente
 *  como enum de GraphQL: si `rol` saliera como String, el tipo se pierde justo
 *  en la frontera donde el cliente compara contra el.
 *
 *  No son cargos ni equipos: son la funcion que unos y otros conceden. El
 *  cargo `director` concede `directorDeGrupo`, y el equipo `secretaria`
 *  concede `secretariaDeGrupo`; la traduccion la hace personas. */
export const ROLES = [
  'dirigente',
  'jefeDeGrupo',
  'secretariaDeGrupo',
  'directorDeGrupo',
  'comisionadoDeDistrito',
  'autoridadDeDistrito',
  'jefeScoutDiocesano',
  'administracionDiocesana',
  'tesoreriaDiocesana',
] as const

export type Rol = (typeof ROLES)[number]

/** Contra que entidad apunta una funcion. Mismo catalogo que el ambito de un
 *  cargo, que es de donde sale la mayoria. */
export const AMBITOS = ['grupo', 'distrito', 'diocesis'] as const

export type AmbitoDeRol = (typeof AMBITOS)[number]

export interface RolConAmbito {
  readonly rol: Rol
  readonly ambito: {
    readonly tipo: AmbitoDeRol
    readonly id: string | null
  }
}

/** Quien hace el pedido. La identidad interna es una Persona: no hay un
 *  Usuario separado. Ser el administrador designado no concede acceso global;
 *  eso ocurre solamente mientras `estaElevado` sea verdadero. */
export interface Actor {
  readonly personaId: string
  readonly roles: readonly RolConAmbito[]
  readonly esAdministradorDesignado: boolean
  readonly estaElevado: boolean
}

/** Lo que el actor puede alcanzar, ya expandido. Lo deriva el modulo
 *  estructura, que conoce la jerarquia. Todo camino de consulta o escritura
 *  iniciado por un usuario lo recibe como primer parametro obligatorio: una
 *  consulta que se olvide de filtrar no compila.
 *
 *  Lleva adentro al actor porque las dos preguntas viajan siempre juntas: que
 *  filas se ven -gruposVisibles- y que puede hacer quien pregunta -las
 *  politicas por operacion, que son puras sobre Actor-. Separarlas obligaria a
 *  dos parametros en cada firma y a que alguna se olvidara. */
export interface Alcance {
  readonly actor: Actor
  readonly gruposVisibles: readonly string[]
  readonly distritosVisibles: readonly string[]
  readonly esAdministrador: boolean
}
