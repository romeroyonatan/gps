import type { AccesoAlModulo } from '@gps/core'

/** Publico por definicion: es el modulo con el que se consigue una sesion.
 *  Lo que exige sesion dentro de auth -vincular un proveedor, elevarse- lo
 *  controla cada operacion, no esta capa. */
export const accesoAlModulo: AccesoAlModulo = { porDefecto: 'publico', permitidos: [] }
