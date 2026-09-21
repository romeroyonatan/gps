// La referencia es necesaria porque quien importa este archivo desde otro
// paquete (el backend, via @gps/salidas/servidor) no incluye sql.d.ts en su
// propio tsconfig: sin esta linea tsc no sabe que tipo tiene el import de abajo
// fuera de este paquete.
/// <reference path="./sql.d.ts" />
import type { Migracion } from '@gps/core'
import inicial from '../../migraciones/0000_inicial.sql' with { type: 'text' }
import direccion from '../../migraciones/0001_direccion.sql' with { type: 'text' }
import responsable from '../../migraciones/0002_responsable.sql' with { type: 'text' }
import telefonoYHuella from '../../migraciones/0003_telefono-y-huella.sql' with { type: 'text' }
import expediente from '../../migraciones/0004_expediente.sql' with { type: 'text' }

/** Las migraciones del modulo, en orden. Agregar una es generarla con
 *  `bunx drizzle-kit generate --name <x>` y sumarle una linea a esta lista. */
export const migraciones: readonly Migracion[] = [
  { nombre: '0000_inicial', sql: inicial },
  { nombre: '0001_direccion', sql: direccion },
  { nombre: '0002_responsable', sql: responsable },
  { nombre: '0003_telefono-y-huella', sql: telefonoYHuella },
  { nombre: '0004_expediente', sql: expediente },
]
