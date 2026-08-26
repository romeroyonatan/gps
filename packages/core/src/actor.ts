export type Rol = 'dirigente' | 'jefeDeGrupo' | 'autoridadDeDistrito' | 'administradorDiocesano'

export interface RolConAmbito {
  readonly rol: Rol
  readonly ambito: {
    readonly tipo: 'grupo' | 'distrito' | 'diocesano'
    readonly id: string | null
  }
}

/** Quien hace el pedido. Lo resuelve el modulo auth, que todavia no existe. */
export interface Actor {
  readonly usuarioId: string
  readonly roles: readonly RolConAmbito[]
}

/** Lo que el actor puede alcanzar, ya expandido. Lo deriva el modulo
 *  estructura, que conoce la jerarquia. Los repositorios lo reciben como
 *  primer parametro obligatorio. */
export interface Alcance {
  readonly gruposVisibles: readonly string[]
  readonly distritosVisibles: readonly string[]
  readonly esAdministrador: boolean
}
