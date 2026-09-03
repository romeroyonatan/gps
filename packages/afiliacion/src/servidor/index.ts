import type { Module } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas } from '@gps/personas/dominio'
import { migraciones } from './migraciones'
import { registrarSchema } from './schema'
import { crearServicioDeAfiliacion, type ServicioDeAfiliacion } from './servicio'

// Publica los servicios de este modulo en el contexto de GraphQL.
// Asi es como un modulo alcanza a otro: ctx.<nombre>, nunca por import.
declare module '@gps/core' {
  interface Context {
    readonly afiliacion: ServicioDeAfiliacion
  }
}

export const afiliacion: Module<
  ServicioDeAfiliacion,
  { personas: Personas; estructura: Estructura }
> = {
  name: 'afiliacion',
  // Las dos por lectura y ninguna por escritura: este modulo no toca ni una
  // persona ni un grupo.
  dependencies: ['personas', 'estructura'],
  migraciones,
  createServices: (core, dependencias) =>
    crearServicioDeAfiliacion(core, dependencias.personas, dependencias.estructura),
  registerSchema: registrarSchema,
}

export type { ServicioDeAfiliacion } from './servicio'
export { FechaInvalida, NadaQueDeclarar, YaDeclaroHoy } from './servicio'
