import { Database } from 'bun:sqlite'
import type { Bd } from '@gps/core'
import { drizzle } from 'drizzle-orm/bun-sqlite'

/** Unico archivo del proyecto que conoce el driver de la base. Cambiarlo por
 *  expo-sqlite es todo lo que hace falta para correr los modulos adentro del
 *  telefono: ningun modulo lo importa. */
export function crearBd(ruta: string): Bd {
  const base = new Database(ruta)
  // SQLite viene con las foreign keys apagadas y es por conexion, no por base:
  // sin esta linea las referencias de las migraciones no rechazan nada.
  base.exec('PRAGMA foreign_keys = ON')
  return drizzle(base)
}
