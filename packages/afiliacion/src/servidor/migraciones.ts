import type { Migracion } from '@gps/core'
import inicial from '../../migraciones/0000_inicial.sql' with { type: 'text' }

/** Las migraciones del modulo, en orden. Agregar una es generarla con
 *  `bunx drizzle-kit generate --name <x>` y sumarle una linea a esta lista.
 *
 *  Ojo con `with { type: 'text' }`: es una extension de Bun que Metro no
 *  soporta. Es deuda conocida, la misma que tienen estructura y personas. */
export const migraciones: readonly Migracion[] = [{ nombre: '0000_inicial', sql: inicial }]
