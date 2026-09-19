import type { Module } from '@gps/core'
import type { Personas } from '@gps/personas/dominio'
import { accesoAlModulo } from '../dominio'
import { crearClienteHttp } from './http'
import { migraciones } from './migraciones'
import { crearProveedorApple, crearProveedorGoogle, type ProveedorOidc } from './oidc'
import { registrarSchema } from './schema'
import { crearServicioDeAuth, type ServicioDeAuth } from './servicio'

declare module '@gps/core' {
  interface Context {
    readonly auth: ServicioDeAuth
  }
}

export const auth: Module<ServicioDeAuth, { personas: Personas }> = {
  name: 'auth',
  accesoAlModulo,
  dependencies: ['personas'],
  migraciones,
  createServices: (core, dependencias) => {
    const config = core.config.auth
    const http = crearClienteHttp()
    const proveedores: Partial<Record<'google' | 'apple', ProveedorOidc>> = {}
    if (config) {
      proveedores.google = crearProveedorGoogle(core, config.google, http)
      proveedores.apple = crearProveedorApple(core, config.apple, http)
    }
    return crearServicioDeAuth(core, dependencias.personas, proveedores)
  },
  registerSchema: registrarSchema,
}

export type { Plataforma, ProveedorOidc } from './oidc'
export type { ServicioDeAuth } from './servicio'
export {
  AutoridadInsuficiente,
  ElevacionDenegada,
  IdentidadInvalida,
  IdentidadNoVinculada,
  InvitacionInvalida,
  ProveedorYaVinculado,
  TransaccionDeLoginInvalida,
} from './servicio'
