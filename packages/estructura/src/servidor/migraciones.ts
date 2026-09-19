// La referencia es necesaria porque quien importa este archivo desde otro
// paquete (el backend, via @gps/estructura/servidor) no incluye sql.d.ts en
// su propio tsconfig: sin esta linea tsc no sabe que tipo tiene el import de
// abajo fuera de este paquete.
/// <reference path="./sql.d.ts" />
import type { Migracion } from '@gps/core'
import inicial from '../../migraciones/0000_inicial.sql' with { type: 'text' }
import cierre from '../../migraciones/0001_cierre.sql' with { type: 'text' }
import unidades from '../../migraciones/0002_unidades.sql' with { type: 'text' }
import bajaRamasDelGrupo from '../../migraciones/0003_baja_ramas_del_grupo.sql' with {
  type: 'text',
}

/** Las migraciones del modulo, en orden. Agregar una es generarla con
 *  `bunx drizzle-kit generate --name <x>` y sumarle una linea a esta lista. */
export const migraciones: readonly Migracion[] = [
  { nombre: '0000_inicial', sql: inicial },
  { nombre: '0001_cierre', sql: cierre },
  { nombre: '0002_unidades', sql: unidades },
  { nombre: '0003_baja_ramas_del_grupo', sql: bajaRamasDelGrupo },
]
