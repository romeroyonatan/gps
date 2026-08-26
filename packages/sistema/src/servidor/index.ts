import type { Module } from '@gps/core'
import { registrarSchema } from './schema'
import { crearServicioDeSistema, type ServicioDeSistema } from './servicio'

// Publica los servicios de este modulo en el contexto de GraphQL.
// Asi es como un modulo alcanza a otro: ctx.<nombre>, nunca por import.
declare module '@gps/core' {
  interface Context {
    readonly sistema: ServicioDeSistema
  }
}

export const sistema: Module<ServicioDeSistema> = {
  name: 'sistema',
  dependencies: [],
  createServices: (core) => crearServicioDeSistema(core),
  registerSchema: registrarSchema,
}

export type { ServicioDeSistema } from './servicio'
