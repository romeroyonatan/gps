import type { Auth } from '@gps/auth/dominio'
import type { Module } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas } from '@gps/personas/dominio'
import { accesoAlModulo } from '../dominio'
import { migraciones } from './migraciones'
import { registrarSchema } from './schema'
import { crearServicioDeAuditoria, type ServicioDeAuditoria } from './servicio'

declare module '@gps/core' {
  interface Context {
    readonly auditoria: ServicioDeAuditoria
  }
}

export const auditoria: Module<
  ServicioDeAuditoria,
  { personas: Personas; estructura: Estructura; auth: Auth }
> = {
  name: 'auditoria',
  accesoAlModulo,
  dependencies: ['personas', 'estructura', 'auth'],
  migraciones,
  createServices: (core, dependencias) =>
    crearServicioDeAuditoria(core, dependencias.personas, dependencias.estructura),
  registerSchema: registrarSchema,
}

export { crearRegistroDeAuditoria } from './registro'
export type { ServicioDeAuditoria } from './servicio'
export { AuditoriaDenegada } from './servicio'
