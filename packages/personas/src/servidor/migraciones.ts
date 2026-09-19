// La referencia es necesaria porque quien importa este archivo desde otro
// paquete (el backend, via @gps/personas/servidor) no incluye sql.d.ts en su
// propio tsconfig: sin esta linea tsc no sabe que tipo tiene el import de abajo
// fuera de este paquete.
/// <reference path="./sql.d.ts" />
import type { Migracion } from '@gps/core'
import inicial from '../../migraciones/0000_inicial.sql' with { type: 'text' }
import pertenenciasYCargos from '../../migraciones/0001_pertenencias_y_cargos.sql' with {
  type: 'text',
}
import pertenenciaEnUnidad from '../../migraciones/0002_pertenencia_en_unidad.sql' with {
  type: 'text',
}
import bajaRamaDePertenencia from '../../migraciones/0003_baja_rama_de_pertenencia.sql' with {
  type: 'text',
}
import cargoConAmbito from '../../migraciones/0004_cargo_con_ambito.sql' with { type: 'text' }
import bajaGrupoDeCargo from '../../migraciones/0005_baja_grupo_de_cargo.sql' with { type: 'text' }
import equiposYRevocacion from '../../migraciones/0006_equipos_y_revocacion.sql' with {
  type: 'text',
}
import eventosDeAutoridad from '../../migraciones/0007_eventos_de_autoridad.sql' with {
  type: 'text',
}

/** Las migraciones del modulo, en orden. Agregar una es generarla con
 *  `bunx drizzle-kit generate --name <x>` y sumarle una linea a esta lista.
 *
 *  Ojo con `with { type: 'text' }`: es una extension de Bun que Metro no
 *  soporta. Es deuda conocida, la misma que tiene estructura; ver
 *  docs/crear-un-modulo.md. */
export const migraciones: readonly Migracion[] = [
  { nombre: '0000_inicial', sql: inicial },
  { nombre: '0001_pertenencias_y_cargos', sql: pertenenciasYCargos },
  { nombre: '0002_pertenencia_en_unidad', sql: pertenenciaEnUnidad },
  { nombre: '0003_baja_rama_de_pertenencia', sql: bajaRamaDePertenencia },
  { nombre: '0004_cargo_con_ambito', sql: cargoConAmbito },
  { nombre: '0005_baja_grupo_de_cargo', sql: bajaGrupoDeCargo },
  { nombre: '0006_equipos_y_revocacion', sql: equiposYRevocacion },
  { nombre: '0007_eventos_de_autoridad', sql: eventosDeAutoridad },
]
