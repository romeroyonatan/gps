import type { Core } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas } from '@gps/personas/dominio'
import { eq, max } from 'drizzle-orm'
import type { Declaracion } from '../dominio/modelos'
import { armarNominasDeclarables } from '../dominio/nominas'
import { fechasOrdinariasDelPeriodo, periodoDe } from '../dominio/periodos'
import { validarFecha } from '../dominio/validaciones'
import { afiliados, declaraciones } from './tablas'

/** La fecha de la declaracion no sirve: futura, mal formada, o anterior a la
 * ultima ya emitida. Las tres condiciones son sobre el mismo campo y el
 * consumidor las trata igual. */
export class FechaInvalida extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'FechaInvalida'
  }
}

/** Se pidio una declaracion extraordinaria de un grupo que no tiene a nadie
 * activo, o que esta cerrado. */
export class NadaQueDeclarar extends Error {
  constructor(grupoId: string) {
    super('El grupo no tiene miembros activos para declarar, o está cerrado.')
    this.name = 'NadaQueDeclarar'
    this.grupoId = grupoId
  }
  readonly grupoId: string
}

/** El grupo ya tiene una declaracion con la fecha de hoy. Lo impide tambien el
 * UNIQUE(fecha, grupo_id). */
export class YaDeclaroHoy extends Error {
  constructor(grupoId: string) {
    super('Este grupo ya declaró su afiliación hoy.')
    this.name = 'YaDeclaroHoy'
    this.grupoId = grupoId
  }
  readonly grupoId: string
}

/** Casos de uso que emiten declaraciones. Comparten helpers porque la
 * extraordinaria debe completar primero las ordinarias pendientes. */
export function crearOperacionesDeDeclaracion(
  core: Core,
  personas: Personas,
  estructura: Estructura,
) {
  /** La fecha mas reciente de toda la asociacion. Global a proposito: la
   * afiliacion pertenece a la persona con la asociacion, no con un grupo. */
  function ultimaFecha(): string | null {
    return (
      core.bd
        .select({ fecha: max(declaraciones.fecha) })
        .from(declaraciones)
        .get()?.fecha ?? null
    )
  }

  /** Los grupos que ya tienen una declaracion con esa fecha. */
  function yaDeclararon(fecha: string): ReadonlySet<string> {
    return new Set(
      core.bd
        .select({ grupoId: declaraciones.grupoId })
        .from(declaraciones)
        .where(eq(declaraciones.fecha, fecha))
        .all()
        .map((fila) => fila.grupoId),
    )
  }

  async function declarar(fecha: string, grupoId?: string): Promise<readonly Declaracion[]> {
    const gruposAbiertos = await estructura.gruposAbiertosEn(fecha)
    const miembrosActivos = await personas.miembrosActivos(fecha)
    const nominas = armarNominasDeclarables(
      miembrosActivos,
      gruposAbiertos,
      yaDeclararon(fecha),
      grupoId,
    )

    // Los grupos vacios no generan nomina. Salir antes de validar permite que
    // repetir una fecha ya emitida sea idempotente aunque exista otra posterior.
    if (nominas.size === 0) return []

    const motivo = validarFecha(fecha, ultimaFecha(), aFechaDeCalendario(core.reloj.ahora()))
    if (motivo !== null) throw new FechaInvalida(motivo)

    const ahora = core.reloj.ahora()
    const periodo = periodoDe(fecha)
    const nuevas: Declaracion[] = []
    const filas: (typeof afiliados.$inferInsert)[] = []

    for (const [suGrupo, miembros] of nominas) {
      const declaracion: Declaracion = {
        id: core.nuevoId('declaracion'),
        grupoId: suGrupo,
        fecha,
        periodo,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      nuevas.push(declaracion)
      for (const { persona } of miembros) {
        // La nomina es un documento contable: conserva nombre y documento como
        // se leian al declararla, aunque la persona se corrija despues.
        filas.push({
          declaracionId: declaracion.id,
          personaId: persona.id,
          tipoDeDocumento: persona.tipoDeDocumento,
          numeroDeDocumento: persona.numeroDeDocumento,
          nombres: persona.nombres,
          apellidos: persona.apellidos,
        })
      }
    }

    // Una declaracion sin nomina seria una deuda de cero indistinguible de un
    // error, por eso ambas escrituras forman una sola transaccion.
    core.bd.transaction((tx) => {
      tx.insert(declaraciones).values(nuevas).run()
      tx.insert(afiliados).values(filas).run()
    })

    return nuevas
  }

  async function declararPendientes(): Promise<readonly Declaracion[]> {
    const hoy = aFechaDeCalendario(core.reloj.ahora())
    const nuevas: Declaracion[] = []
    for (const fecha of fechasOrdinariasDelPeriodo(periodoDe(hoy))) {
      if (fecha > hoy) continue
      try {
        nuevas.push(...(await declarar(fecha)))
      } catch (error) {
        // Una fecha invalida con grupos todavia pendientes representa una
        // nomina perdida, pero no debe tumbar el arranque completo.
        if (error instanceof FechaInvalida) {
          core.logger.error('No se pudo declarar una afiliacion ordinaria vencida', {
            fecha,
            motivo: error.message,
          })
          continue
        }
        throw error
      }
    }
    return nuevas
  }

  return {
    declarar,
    declararPendientes,

    async declararExtraordinaria(grupoId: string): Promise<Declaracion> {
      // Una extraordinaria de hoy bloquearia para siempre una ordinaria
      // anterior; emitir primero las pendientes resuelve el caso en la fuente.
      await declararPendientes()

      const hoy = aFechaDeCalendario(core.reloj.ahora())
      const [declaracion] = await declarar(hoy, grupoId)
      if (declaracion) return declaracion
      if (yaDeclararon(hoy).has(grupoId)) throw new YaDeclaroHoy(grupoId)
      throw new NadaQueDeclarar(grupoId)
    },
  }
}
