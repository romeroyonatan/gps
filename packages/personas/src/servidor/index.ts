import type { Module } from '@gps/core'
import { migraciones } from './migraciones'
import { registrarSchema } from './schema'
import { crearServicioDePersonas, type ServicioDePersonas } from './servicio'

// Publica los servicios de este modulo en el contexto de GraphQL.
// Asi es como un modulo alcanza a otro: ctx.<nombre>, nunca por import.
declare module '@gps/core' {
  interface Context {
    readonly personas: ServicioDePersonas
  }
}

export const personas: Module<ServicioDePersonas> = {
  name: 'personas',
  dependencies: [],
  migraciones,
  createServices: (core) => crearServicioDePersonas(core),
  registerSchema: registrarSchema,
}

export type { ServicioDePersonas } from './servicio'
export { DatosInvalidos, DocumentoDuplicado } from './servicio'
