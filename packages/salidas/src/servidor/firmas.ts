import type { Archivos } from '@gps/archivos/dominio'
import { sePuedeAnexar } from '@gps/archivos/dominio'
import type { Actor, Core } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Estructura } from '@gps/estructura/dominio'
import { nombreDelCargo, type Personas, type TipoDeCargo } from '@gps/personas/dominio'
import { eq } from 'drizzle-orm'
import { type FirmanteRequerido, firmantesRequeridos, mensajeASellar } from '../dominio/firmas'
import type { Firma, Permiso } from '../dominio/modelos'
import { estaVacio, type Trazos } from '../dominio/trazos'
import type { crearOperacionesDeBorrador } from './borradores'
import { PermisoNoEditable } from './borradores'
import { firmas, permisos } from './tablas'

/** No se puede registrar esa firma: el permiso no esta emitido, el cargo ya
 *  firmo, nadie lo ocupa, o el dibujo esta vacio. */
export class FirmaInvalida extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'FirmaInvalida'
  }
}

/** Una firma pendiente o puesta, tal como la muestra la pantalla. */
export interface EstadoDeFirma {
  readonly cargo: TipoDeCargo
  readonly nombreDelCargo: string
  /** Quien ocupa el cargo hoy, si esta puesta la persona que firmo. Null si
   *  nadie lo ocupa: esa firma no se puede registrar. */
  readonly quien: { id: string; nombres: string; apellidos: string } | null
  readonly firma: Firma | null
  /** Si el sello de la firma cierra. Null cuando no hay firma o cuando se
   *  firmo en papel, que no lleva sello. */
  readonly verificada: boolean | null
}

export function crearOperacionesDeFirma(
  core: Core,
  personas: Personas,
  estructura: Estructura,
  archivos: Archivos,
  borradores: ReturnType<typeof crearOperacionesDeBorrador>,
) {
  /** Los tres cargos que firman este permiso, con la entidad donde buscarlos.
   *  El comisionado sale del distrito del grupo, no del grupo. */
  async function requeridos(permiso: Permiso): Promise<readonly FirmanteRequerido[]> {
    const grupo = await estructura.obtenerGrupo(permiso.grupoId)
    if (!grupo) throw new PermisoNoEditable('El grupo del permiso ya no esta abierto.')
    return firmantesRequeridos(grupo.id, grupo.distritoId)
  }

  /** Quien ocupa ese cargo ese dia. Si hay mas de uno -la tabla no lo impide,
   *  son mandatos que se solapan por un error de carga- toma el primero por
   *  `desde` y deja constancia.
   *
   *  ponytail: cuando exista auth, quien firma es la persona logueada y esta
   *  eleccion desaparece. */
  async function ocupante(cargo: TipoDeCargo, ambitoId: string, fecha: string) {
    const ocupantes = await personas.ocupantesDelCargo(cargo, ambitoId, fecha)
    if (ocupantes.length > 1) {
      core.logger.error('Hay mas de una persona en el cargo', { cargo, ambitoId, fecha })
    }
    return ocupantes[0] ?? null
  }

  function puestas(permisoId: string): readonly Firma[] {
    return core.bd.select().from(firmas).where(eq(firmas.permisoId, permisoId)).all()
  }

  /** Pasa a firmado cuando estan las tres. Se llama despues de cada firma: no
   *  hay otro momento en que pueda completarse. */
  function completarSiCorresponde(permisoId: string, cuantasHacenFalta: number): void {
    if (puestas(permisoId).length < cuantasHacenFalta) return
    core.bd
      .update(permisos)
      .set({ estado: 'firmado', actualizadoEn: core.reloj.ahora() })
      .where(eq(permisos.id, permisoId))
      .run()
  }

  function exigirEmitido(permisoId: string): Permiso {
    const permiso = borradores.permisoDe(permisoId)
    if (permiso.estado !== 'emitido') {
      throw new FirmaInvalida(
        permiso.estado === 'firmado'
          ? 'Este permiso ya tiene las tres firmas.'
          : `Un permiso ${permiso.estado} no se firma.`,
      )
    }
    return permiso
  }

  /** El dato comun de las dos formas de firmar: que se puede firmar, que ese
   *  cargo todavia no firmo, y quien lo ocupa hoy. */
  async function prepararFirma(permisoId: string, cargo: TipoDeCargo) {
    const permiso = exigirEmitido(permisoId)
    const cuales = await requeridos(permiso)
    const requerido = cuales.find((uno) => uno.cargo === cargo)
    if (!requerido) {
      throw new FirmaInvalida(`${nombreDelCargo(cargo)} no firma los permisos de salida.`)
    }
    if (puestas(permisoId).some((firma) => firma.cargo === cargo)) {
      throw new FirmaInvalida(`${nombreDelCargo(cargo)} ya firmó este permiso.`)
    }

    const fecha = aFechaDeCalendario(core.reloj.ahora())
    const quien = await ocupante(cargo, requerido.ambitoId, fecha)
    if (!quien) {
      throw new FirmaInvalida(`Nadie ocupa el cargo de ${nombreDelCargo(cargo)} hoy.`)
    }
    return { permiso, cuales, fecha, quien }
  }

  return {
    /** Como esta cada una de las tres firmas: quien la tiene que poner, si ya
     *  esta, y si su sello cierra. */
    async estadoDeLasFirmas(permisoId: string): Promise<readonly EstadoDeFirma[]> {
      const permiso = borradores.permisoDe(permisoId)
      const cuales = await requeridos(permiso)
      const puestasPorCargo = new Map(puestas(permisoId).map((firma) => [firma.cargo, firma]))
      const hoy = aFechaDeCalendario(core.reloj.ahora())

      return await Promise.all(
        cuales.map(async (requerido) => {
          const firma = puestasPorCargo.get(requerido.cargo) ?? null
          // Si ya firmo, quien firmo es un hecho guardado; si no, se muestra
          // quien lo ocupa hoy, que es quien va a poder firmar.
          const quien = firma
            ? { id: firma.personaId, nombres: firma.nombres, apellidos: firma.apellidos }
            : await ocupante(requerido.cargo, requerido.ambitoId, hoy)
          return {
            cargo: requerido.cargo,
            nombreDelCargo: nombreDelCargo(requerido.cargo),
            quien: quien && {
              id: quien.id,
              nombres: quien.nombres,
              apellidos: quien.apellidos,
            },
            firma,
            verificada: verificar(permiso, firma),
          }
        }),
      )
    },

    /** Firma dibujada en la app. El sello ata esta firma a este PDF, este cargo,
     *  esta persona y este dia: sin eso, los trazos se podrian copiar a otro
     *  permiso. */
    async firmarEnApp(
      actor: Actor,
      permisoId: string,
      cargo: TipoDeCargo,
      trazos: Trazos,
    ): Promise<Firma> {
      if (estaVacio(trazos)) throw new FirmaInvalida('No dibujaste nada.')
      const { permiso, cuales, fecha, quien } = await prepararFirma(permisoId, cargo)
      if (permiso.hashDelPdf === null) {
        throw new FirmaInvalida('El permiso no tiene PDF: no hay nada que firmar.')
      }

      const { sello, claveId } = core.sellador.sellar(
        mensajeASellar({
          hashDelPdf: permiso.hashDelPdf,
          cargo,
          personaId: quien.id,
          fecha,
          trazos,
        }),
      )

      const ahora = core.reloj.ahora()
      const firma: Firma = {
        id: core.nuevoId('firma'),
        permisoId,
        cargo,
        modo: 'app',
        personaId: quien.id,
        nombres: quien.nombres,
        apellidos: quien.apellidos,
        fecha,
        trazos: JSON.stringify(trazos.trazos),
        sello,
        claveDeSello: claveId,
        escaneoId: null,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      core.bd.transaction((tx) => {
        tx.insert(firmas).values(firma).run()
        core.auditoria.registrar(
          {
            actorPersonaId: actor.personaId,
            modulo: 'salidas',
            accion: 'firmarEnApp',
            elevado: actor.estaElevado,
            grupoId: permiso.grupoId,
            entidadTipo: 'firma',
            entidadId: firma.id,
            objetivoPersonaId: quien.id,
            resumen: { permisoId, cargo, modo: 'app' },
          },
          tx,
        )
      })
      completarSiCorresponde(permisoId, cuales.length)
      return firma
    },

    /** Firma en papel: se sube el escaneo del PDF impreso y se declara que
     *  cargos lo firmaron. Un mismo escaneo respalda varios, que es lo que pasa
     *  cuando dos firman la misma hoja.
     *
     *  No lleva sello: no hay trazos que sellar y quien sube declara quien
     *  firmo. El respaldo es el escaneo. Cuando exista auth, se registra ademas
     *  quien lo declaro. */
    async firmarEnPapel(
      actor: Actor,
      permisoId: string,
      cargos: readonly TipoDeCargo[],
      escaneoId: string,
    ): Promise<readonly Firma[]> {
      if (cargos.length === 0) throw new FirmaInvalida('Decí qué cargos firmaron ese papel.')
      if (!(await archivos.esDe(escaneoId, 'salidas', permisoId))) {
        throw new FirmaInvalida('Ese escaneo no esta confirmado o no es de este permiso.')
      }
      // El escaneo se anexa como pagina del PDF firmado, asi que tiene que ser
      // algo que se pueda dibujar ahi. Un .docx se puede adjuntar al permiso
      // -eso es otra cosa- pero no puede ser la prueba de una firma.
      const archivo = await archivos.obtener(escaneoId)
      if (archivo && !sePuedeAnexar(archivo.tipo)) {
        throw new FirmaInvalida(
          `Un archivo ${archivo.tipo} no se puede anexar al permiso. Subí una foto o un PDF.`,
        )
      }

      const puestas: Firma[] = []
      let cuantas = 0
      let grupoId: string | null = null
      for (const cargo of cargos) {
        const { permiso, cuales, fecha, quien } = await prepararFirma(permisoId, cargo)
        cuantas = cuales.length
        grupoId = permiso.grupoId
        const ahora = core.reloj.ahora()
        const firma: Firma = {
          id: core.nuevoId('firma'),
          permisoId,
          cargo,
          modo: 'papel',
          personaId: quien.id,
          nombres: quien.nombres,
          apellidos: quien.apellidos,
          fecha,
          trazos: null,
          sello: null,
          claveDeSello: null,
          escaneoId,
          creadoEn: ahora,
          actualizadoEn: ahora,
        }
        puestas.push(firma)
      }
      core.bd.transaction((tx) => {
        tx.insert(firmas).values(puestas).run()
        core.auditoria.registrar(
          {
            actorPersonaId: actor.personaId,
            modulo: 'salidas',
            accion: 'firmarEnPapel',
            elevado: actor.estaElevado,
            grupoId,
            entidadTipo: 'permiso',
            entidadId: permisoId,
            resumen: { permisoId, cargos: [...cargos], modo: 'papel', escaneoId },
          },
          tx,
        )
      })
      completarSiCorresponde(permisoId, cuantas)
      return puestas
    },
  }

  /** Si el sello de una firma en la app cierra. null para una firma en papel o
   *  inexistente: no es que no verifique, es que no hay sello. */
  function verificar(permiso: Permiso, firma: Firma | null): boolean | null {
    if (firma?.modo !== 'app') return null
    if (!firma.sello || !firma.claveDeSello || !firma.trazos) return false
    if (permiso.hashDelPdf === null) return false

    let trazos: Trazos
    try {
      trazos = { trazos: JSON.parse(firma.trazos) }
    } catch {
      return false
    }
    return core.sellador.verificar(
      mensajeASellar({
        hashDelPdf: permiso.hashDelPdf,
        cargo: firma.cargo,
        personaId: firma.personaId,
        fecha: firma.fecha,
        trazos,
      }),
      { sello: firma.sello, claveId: firma.claveDeSello },
    )
  }
}
