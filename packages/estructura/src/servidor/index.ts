import type { Module } from '@gps/core'
import { migraciones } from './migraciones'
import { registrarSchema } from './schema'
import { crearServicioDeEstructura, type ServicioDeEstructura } from './servicio'

// Publica los servicios de este modulo en el contexto de GraphQL.
// Asi es como un modulo alcanza a otro: ctx.<nombre>, nunca por import.
declare module '@gps/core' {
  interface Context {
    readonly estructura: ServicioDeEstructura
  }
}

export const estructura: Module<ServicioDeEstructura> = {
  name: 'estructura',
  dependencies: [],
  migraciones,
  createServices: (core) => crearServicioDeEstructura(core),
  registerSchema: registrarSchema,
}

export type { ServicioDeEstructura } from './servicio'
