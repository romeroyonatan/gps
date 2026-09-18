import type { Marcas } from '@gps/core'
import type { TipoAdmitido } from './archivos'

/** Un archivo subido por alguien. La fila nace en `solicitarSubida`, antes de
 *  que existan los bytes: hasta que se confirma, `confirmado` es false y no se
 *  puede descargar ni asociar a nada.
 *
 *  Nace con dueño y no se le pone despues: un archivo sin dueño no se puede
 *  autorizar retroactivamente, porque no hay a quien preguntarle (spec base
 *  §9.4). */
export interface Archivo extends Marcas {
  readonly id: string
  readonly nombre: string
  /** El del contenido guardado, que no es siempre el declarado: un HEIC queda
   *  registrado como image/jpeg porque eso es lo que se guardo. */
  readonly tipo: TipoAdmitido
  /** En bytes, los del contenido guardado. */
  readonly tamano: number
  /** Del contenido guardado. Sirve para detectar que alguien cambio el archivo
   *  por debajo, que es lo que el sello de una firma ancla. */
  readonly sha256: string
  /** Que modulo es el dueño, y que recurso suyo. `archivos` no conoce ninguna
   *  regla de permisos: para autorizar una descarga le pregunta al dueño. */
  readonly modulo: string
  readonly recursoId: string
  readonly confirmado: boolean
}
