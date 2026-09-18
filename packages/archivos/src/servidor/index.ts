import type { Module } from '@gps/core'
import { migraciones } from './migraciones'
import { registrarSchema } from './schema'
import { type Autorizador, crearServicioDeArchivos, type ServicioDeArchivos } from './servicio'

// Publica los servicios de este modulo en el contexto de GraphQL.
// Asi es como un modulo alcanza a otro: ctx.<nombre>, nunca por import.
declare module '@gps/core' {
  interface Context {
    readonly archivos: ServicioDeArchivos
  }
}

/** Quien autoriza la descarga de los archivos de cada modulo. Lo llena la raiz
 *  de composicion despues de construir los servicios, y no `dependencies`,
 *  porque la relacion va al reves: `archivos` no puede depender de sus dueños
 *  -seria un ciclo-, asi que los dueños se registran aca.
 *
 *  Es un objeto mutable a proposito: se construye vacio con el modulo y se
 *  llena cuando los demas servicios ya existen. */
export const autorizadores: Record<string, Autorizador> = {}

export const archivos: Module<ServicioDeArchivos> = {
  name: 'archivos',
  dependencies: [],
  migraciones,
  createServices: (core) => crearServicioDeArchivos(core, autorizadores),
  registerSchema: registrarSchema,
}

export type { Autorizador, ServicioDeArchivos } from './servicio'
export { SinAutorizador, SubidaInvalida, SubidaNoAutorizada } from './servicio'
