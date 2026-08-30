import { sql } from 'drizzle-orm'
import type { Core } from './core'
import type { Module } from './module'

/** Una migracion de un modulo. `sql` es el contenido del archivo que genera
 *  drizzle-kit adentro del paquete del modulo. */
export interface Migracion {
  readonly nombre: string
  readonly sql: string
}

/** Marcador con el que drizzle-kit separa las sentencias de un archivo. Hay
 *  que ejecutarlas de a una: sqlite prepara una sentencia por vez. */
const SEPARADOR = '--> statement-breakpoint'

/** Aplica las migraciones pendientes de cada modulo, en el orden en que
 *  vienen. Vive en core y no en el backend a proposito: recibe el SQL ya
 *  resuelto y habla por `core.bd`, sin tocar el sistema de archivos ni el
 *  driver, asi que el runner sirve igual adentro del telefono.
 *
 *  Como consigue cada modulo el texto de sus migraciones, en cambio, es un
 *  detalle de plataforma, y hoy no es portable: `estructura` lo importa con
 *  `with { type: 'text' }`, que es una extension de Bun que Metro no soporta.
 *  El dia que exista `packages/local` va a haber que resolverlo ahi -un
 *  transformer de Metro, o pasar las migraciones de otra forma-, pero es un
 *  cambio en los modulos, no en esta funcion. */
// biome-ignore lint/suspicious/noExplicitAny: el runner es agnostico del tipo de servicios
export function aplicarMigraciones(core: Core, modulos: readonly Module<any, any>[]): void {
  core.bd.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS migraciones (
      modulo TEXT NOT NULL,
      nombre TEXT NOT NULL,
      aplicada_en INTEGER NOT NULL,
      PRIMARY KEY (modulo, nombre)
    )`),
  )

  // Para todo lo que SQLite no soporta con ALTER (borrar una columna, cambiar
  // un tipo, agregar una restriccion) drizzle-kit emite el baile de recreacion
  // de tabla: CREATE __new_x, INSERT...SELECT, DROP TABLE x, RENAME. Con las
  // foreign keys prendidas el DROP falla. El archivo trae su propio
  // `PRAGMA foreign_keys=OFF`, pero adentro de una transaccion ese pragma es un
  // no-op, asi que hay que apagarlas aca afuera, alrededor del loop entero.
  core.bd.run(sql.raw('PRAGMA foreign_keys = OFF'))
  try {
    for (const modulo of modulos) {
      for (const migracion of modulo.migraciones ?? []) {
        const yaEsta = core.bd.get(
          sql`SELECT 1 FROM migraciones
              WHERE modulo = ${modulo.name} AND nombre = ${migracion.nombre}`,
        )
        if (yaEsta) continue

        // Las sentencias y su registro van en la misma transaccion: si el SQL
        // falla a la mitad, la migracion no queda anotada como aplicada y la
        // proxima corrida la reintenta desde cero.
        core.bd.transaction((tx) => {
          for (const sentencia of migracion.sql.split(SEPARADOR)) {
            if (sentencia.trim()) tx.run(sql.raw(sentencia))
          }
          tx.run(
            sql`INSERT INTO migraciones (modulo, nombre, aplicada_en)
                VALUES (${modulo.name}, ${migracion.nombre}, ${core.reloj.ahora().getTime()})`,
          )
        })
      }
    }

    // Con las foreign keys apagadas el INSERT...SELECT del baile de recreacion
    // no valida nada: sin este chequeo, una migracion mal escrita deja filas
    // huerfanas en silencio y el error aparece meses despues.
    const huerfanas = core.bd.all(sql.raw('PRAGMA foreign_key_check'))
    if (huerfanas.length > 0) {
      throw new Error(
        `Las migraciones dejaron filas huerfanas: ${JSON.stringify(huerfanas)}. ` +
          'Revisa el INSERT...SELECT de la ultima migracion.',
      )
    }
  } finally {
    core.bd.run(sql.raw('PRAGMA foreign_keys = ON'))
  }
}
