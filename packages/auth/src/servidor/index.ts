import type { Module } from '@gps/core'
import type { Personas } from '@gps/personas/dominio'
import { accesoAlModulo } from '../dominio'
import { crearProveedorDemo } from './demo'
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
    const proveedores: Partial<Record<'google' | 'apple' | 'demo', ProveedorOidc>> = {}
    if (config) {
      proveedores.google = crearProveedorGoogle(core, config.google, http)
      proveedores.apple = crearProveedorApple(core, config.apple, http)
    }
    // El de un clic existe unicamente en demo. El codigo entra al build igual
    // -no hay forma de sacarlo de un bundle de Bun sin partir el paquete- pero
    // sin esta linea no hay proveedor que resolver, asi que no hay ruta ni
    // servicio que lo acepte.
    if (core.config.entorno === 'demo') proveedores.demo = crearProveedorDemo(core)
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
