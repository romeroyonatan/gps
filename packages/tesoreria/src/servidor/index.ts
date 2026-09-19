import type { Afiliacion } from '@gps/afiliacion/dominio'
import type { Module } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import { migraciones } from './migraciones'
import { registrarSchema } from './schema'
import { crearServicioDeTesoreria, type ServicioDeTesoreria } from './servicio'

declare module '@gps/core' {
  interface Context {
    readonly tesoreria: ServicioDeTesoreria
  }
}

export const tesoreria: Module<
  ServicioDeTesoreria,
  { afiliacion: Afiliacion; estructura: Estructura }
> = {
  name: 'tesoreria',
  dependencies: ['afiliacion', 'estructura'],
  migraciones,
  createServices: (core, dependencias) =>
    crearServicioDeTesoreria(core, dependencias.afiliacion, dependencias.estructura),
  registerSchema: registrarSchema,
}

export type { ServicioDeTesoreria } from './servicio'
export { CuotaUtilizada, DatosDePagoInvalidos, PagoNoAnulable } from './servicio'
