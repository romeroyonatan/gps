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
 *  estructura, que conoce la jerarquia. Los repositorios lo reciben como
 *  primer parametro obligatorio. */
export interface Alcance {
  readonly gruposVisibles: readonly string[]
  readonly distritosVisibles: readonly string[]
  readonly esAdministrador: boolean
}
