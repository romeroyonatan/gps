import type { Archivos } from '@gps/archivos/dominio'
import type { Module } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas } from '@gps/personas/dominio'
import { migraciones } from './migraciones'
import { registrarSchema } from './schema'
import { crearServicioDeSalidas, type ServicioDeSalidas } from './servicio'

// Publica los servicios de este modulo en el contexto de GraphQL.
// Asi es como un modulo alcanza a otro: ctx.<nombre>, nunca por import.
declare module '@gps/core' {
  interface Context {
    readonly salidas: ServicioDeSalidas
  }
}

interface Dependencias {
  readonly personas: Personas
  readonly estructura: Estructura
  readonly archivos: Archivos
}

export const salidas: Module<ServicioDeSalidas, Dependencias> = {
  name: 'salidas',
  // personas por los participantes y los firmantes; estructura por el grupo y
  // su distrito; archivos por el PDF, los escaneos y los adjuntos.
  dependencies: ['personas', 'estructura', 'archivos'],
  migraciones,
  createServices: (core, dependencias) =>
    crearServicioDeSalidas(
      core,
      dependencias.personas,
      dependencias.estructura,
      dependencias.archivos,
    ),
  registerSchema: registrarSchema,
}

export type { ServicioDeSalidas } from './servicio'
export { FirmaInvalida, PermisoInvalido, PermisoNoEditable } from './servicio'
