export type Entorno = 'desarrollo' | 'produccion' | 'prueba'

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

/** Lo que el core le provee a todo modulo. Es la unica via de un modulo
 *  hacia la plataforma: ver la regla de portabilidad en AGENT.md. */
export interface Core {
  readonly config: Config
  readonly logger: Logger
  readonly reloj: Reloj
  /** Nombres de los modulos registrados, en orden de dependencias. */
  readonly modulos: readonly string[]
}
