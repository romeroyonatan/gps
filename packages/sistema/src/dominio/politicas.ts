import type { AccesoAlModulo } from '@gps/core'

/** Publico: la version es lo que un cliente consulta antes de tener sesion
 *  -para saber si tiene que actualizarse- y /health depende de lo mismo. */
export const accesoAlModulo: AccesoAlModulo = { porDefecto: 'publico', permitidos: [] }
