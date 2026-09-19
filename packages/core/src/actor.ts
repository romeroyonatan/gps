export type Rol =
  | 'dirigente'
  | 'jefeDeGrupo'
  | 'secretariaDeGrupo'
  | 'directorDeGrupo'
  | 'comisionadoDeDistrito'
  | 'autoridadDeDistrito'
  | 'jefeScoutDiocesano'
  | 'administracionDiocesana'
  | 'tesoreriaDiocesana'

export interface RolConAmbito {
  readonly rol: Rol
  readonly ambito: {
    readonly tipo: 'grupo' | 'distrito' | 'diocesis'
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
