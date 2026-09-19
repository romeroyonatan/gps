import type { SesionAutenticada } from './modelos'

/** La parte de autenticación que usa la raíz de composición por request. */
export interface Auth {
  resolverSesion(secreto: string): Promise<SesionAutenticada | null>
  esAdministradorDesignado(personaId: string): Promise<boolean>
}
