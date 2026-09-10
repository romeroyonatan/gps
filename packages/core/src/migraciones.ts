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
      contenido TEXT,
      PRIMARY KEY (modulo, nombre)
    )`),
  )

  // Compatibilidad con bases creadas antes de registrar el contenido. Guardarlo
  // permite detectar que alguien edito una migracion que ya fue aplicada.
  const columnas = core.bd.all<{ name: string }>(sql.raw('PRAGMA table_info(migraciones)'))
  if (!columnas.some((columna) => columna.name === 'contenido')) {
    core.bd.run(sql.raw('ALTER TABLE migraciones ADD COLUMN contenido TEXT'))
  }

  const huerfanasExistentes = core.bd.all(sql.raw('PRAGMA foreign_key_check'))
  if (huerfanasExistentes.length > 0) {
    throw new Error(
      `La base ya tiene filas huerfanas: ${JSON.stringify(huerfanasExistentes)}. ` +
        'Restaurala o corregila antes de migrar.',
    )
  }

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
        const aplicada = core.bd.values<[string | null]>(
          sql`SELECT contenido FROM migraciones
              WHERE modulo = ${modulo.name} AND nombre = ${migracion.nombre}`,
        )[0]
        if (aplicada) {
          const [contenido] = aplicada
          // La primera corrida con este runner completa las filas historicas;
          // desde entonces cualquier cambio en el SQL hace fallar el arranque.
          if (contenido === null) {
            core.bd.run(
              sql`UPDATE migraciones SET contenido = ${migracion.sql}
                  WHERE modulo = ${modulo.name} AND nombre = ${migracion.nombre}`,
            )
          } else if (contenido !== migracion.sql) {
            throw new Error(
              `La migracion "${modulo.name}/${migracion.nombre}" fue modificada despues de aplicarse.`,
            )
          }
          continue
        }

        // Las sentencias, el chequeo de integridad y el registro van en la
        // misma transaccion. Si algo falla, no queda ni el cambio ni su marca.
        core.bd.transaction((tx) => {
          for (const sentencia of migracion.sql.split(SEPARADOR)) {
            if (sentencia.trim()) tx.run(sql.raw(sentencia))
          }

          // Con las foreign keys apagadas el INSERT...SELECT del baile de
          // recreacion no valida nada. Chequear antes del INSERT al registro
          // permite revertir la migracion entera si dejo una fila huerfana.
          const huerfanas = tx.all(sql.raw('PRAGMA foreign_key_check'))
          if (huerfanas.length > 0) {
            throw new Error(
              `La migracion "${modulo.name}/${migracion.nombre}" dejo filas huerfanas: ` +
                `${JSON.stringify(huerfanas)}.`,
            )
          }

          tx.run(
            sql`INSERT INTO migraciones (modulo, nombre, aplicada_en, contenido)
                VALUES (
                  ${modulo.name}, ${migracion.nombre},
                  ${core.reloj.ahora().getTime()}, ${migracion.sql}
                )`,
          )
        })
      }
    }
  } finally {
    core.bd.run(sql.raw('PRAGMA foreign_keys = ON'))
  }
}
