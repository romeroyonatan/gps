import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import type { BusDeEventos } from './eventos'

export type Entorno = 'desarrollo' | 'produccion' | 'prueba' | 'demo'

export interface Config {
  readonly version: string
  readonly entorno: Entorno
  readonly puerto: number
}

export interface Logger {
  info(mensaje: string, datos?: Record<string, unknown>): void
  error(mensaje: string, datos?: Record<string, unknown>): void
}

export interface Reloj {
  ahora(): Date
}

/** La base, sin atarse al driver: bun:sqlite en el servidor, expo-sqlite en el
 *  telefono. Quien la abre es la raiz de composicion; un modulo la recibe ya
 *  abierta y no sabe cual es. */
export type Bd = BaseSQLiteDatabase<'sync', unknown>

/** Lo que el core le provee a todo modulo. Es la unica via de un modulo
 *  hacia la plataforma: ver la regla de portabilidad en AGENT.md. */
export interface Core {
  readonly config: Config
  readonly logger: Logger
  readonly reloj: Reloj
  readonly bd: Bd
  readonly eventos: BusDeEventos
  /** Nombres de los modulos registrados, en orden de dependencias. */
  readonly modulos: readonly string[]
  /** Identificador nuevo para una entidad, con su prefijo:
   *      grupo_01a04035-7e28-7428-afbd-021d928ae01c
   *  El prefijo se guarda en la base, no se codifica: un id en un log dice de
   *  que entidad es sin ir a buscarlo. Es del dominio, asi que va en espanol y
   *  en singular. Va en Core por la misma razon que reloj.ahora(): generar un
   *  UUID es tocar la plataforma. */
  nuevoId(prefijo: string): string
}
