import type { Module } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
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

export const personas: Module<ServicioDePersonas, { estructura: Estructura }> = {
  name: 'personas',
  // Personas depende de Estructura, al reves de lo que suponia la spec base:
  // los cargos viven aca, asi que la flecha va en esta direccion.
  dependencies: ['estructura'],
  migraciones,
  createServices: (core, dependencias) => crearServicioDePersonas(core, dependencias.estructura),
  registerSchema: registrarSchema,
}

export type { ServicioDePersonas } from './servicio'
export { DatosInvalidos, DocumentoDuplicado, GrupoInexistente } from './servicio'
