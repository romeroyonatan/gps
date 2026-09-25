import type { Alcance, Core } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Estructura } from '@gps/estructura/dominio'
import {
  CATEGORIAS,
  nombreDelCargo,
  type Personas,
  puedeVerPersonasDelGrupo,
} from '@gps/personas/dominio'
import { armarLaNomina } from '../dominio/nomina'
import { periodoDe } from '../dominio/periodos'
import { armarPdfDeLaNomina } from './pdf'
import { type Celda, comoXlsx } from './xlsx'

/** Se pidió la nómina de un grupo que quien pregunta no puede ver por dentro.
 *
 *  Alcanzar un grupo no es verlo por dentro: el comisionado tiene los grupos de
 *  su distrito en el alcance porque firma sus permisos de salida, y el padrón
 *  de esos grupos no lo ve. Por eso la política es la de `personas` y no
 *  `puedeVerAfiliacionDelGrupo`, que responde otra pregunta. */
export class NominaFueraDeAlcance extends Error {
  constructor(grupoId: string) {
    super(`No podés ver la nómina del grupo ${grupoId}.`)
    this.name = 'NominaFueraDeAlcance'
  }
}

export class GrupoInexistente extends Error {
  constructor(grupoId: string) {
    super(`No hay ningún grupo abierto con el id ${grupoId}.`)
    this.name = 'GrupoInexistente'
  }
}

/** El nombre del archivo, que es lo que queda en la carpeta de descargas de
 *  quien lo baja: sin esto se llama como el id del grupo. */
export function nombreDelArchivo(
  grupo: { numero: number },
  fecha: string,
  extension: string,
): string {
  return `nomina-grupo-${grupo.numero}-${fecha}.${extension}`
}

/** La nómina del grupo en los dos formatos. Los dos usan el mismo orden de
 *  personas; la planilla agrega datos para trabajar y el PDF se presenta en papel.
 *
 *  Se compone al pedirla y no se guarda: la nómina es el padrón de hoy, y un
 *  archivo guardado sería una segunda verdad que envejece. La foto que sí se
 *  guarda es la declaración, que es otra cosa. */
export function crearConsultasDeLaNomina(
  core: Core,
  personas: Personas,
  estructura: Estructura,
  afiliadosEn: (
    alcance: Alcance,
    periodo: number,
    personaIds: readonly string[],
  ) => Promise<ReadonlySet<string>>,
) {
  async function nomina(alcance: Alcance, grupoId: string) {
    if (!puedeVerPersonasDelGrupo(alcance, grupoId)) throw new NominaFueraDeAlcance(grupoId)

    const grupo = await estructura.obtenerGrupo(grupoId)
    if (!grupo) throw new GrupoInexistente(grupoId)

    const fecha = aFechaDeCalendario(core.reloj.ahora())
    const periodo = periodoDe(fecha)
    const miembros = await personas.miembrosDelGrupo(grupoId, fecha)
    const afiliados = await afiliadosEn(
      alcance,
      periodo,
      miembros.map((miembro) => miembro.persona.id),
    )
    const ramaDeUnidad = new Map(grupo.unidades.map((unidad) => [unidad.id, unidad.rama]))

    return {
      grupo,
      fecha,
      periodo,
      secciones: armarLaNomina(miembros, ramaDeUnidad, afiliados, periodo),
      miembros,
    }
  }

  return {
    async pdfDeLaNomina(alcance: Alcance, grupoId: string) {
      const datos = await nomina(alcance, grupoId)
      return {
        nombre: nombreDelArchivo(datos.grupo, datos.fecha, 'pdf'),
        contenido: await armarPdfDeLaNomina(datos),
      }
    },

    async xlsxDeLaNomina(alcance: Alcance, grupoId: string) {
      const { grupo, fecha, periodo, secciones, miembros } = await nomina(alcance, grupoId)
      const miembrosPorId = new Map(miembros.map((miembro) => [miembro.persona.id, miembro]))
      const cargosPorPersona = new Map<string, string[]>()
      for (const { personaId, cargo } of await personas.cargosDelGrupoEn(grupoId, fecha)) {
        const suyos = cargosPorPersona.get(personaId) ?? []
        suyos.push(nombreDelCargo(cargo))
        cargosPorPersona.set(personaId, suyos)
      }
      const filas: Celda[][] = [
        [
          '#',
          'Apellidos',
          'Nombres',
          'Documento',
          'Rama',
          'Categoría',
          'Cargos',
          'Teléfono',
          'Domicilio',
          'Fecha de nacimiento',
        ],
      ]
      for (const seccion of secciones) {
        for (const fila of seccion.filas) {
          const miembro = miembrosPorId.get(fila.personaId)
          if (!miembro) throw new Error(`Falta la persona ${fila.personaId} en la nómina`)
          const { persona } = miembro
          filas.push([
            fila.numero,
            persona.apellidos,
            persona.nombres,
            fila.celdas[1] ?? '',
            fila.celdas[2] ?? '',
            CATEGORIAS.find(({ id }) => id === miembro.categoria)?.nombre ?? miembro.categoria,
            cargosPorPersona.get(persona.id)?.join(' · ') ?? '',
            persona.telefonoDeContacto,
            persona.domicilio,
            persona.fechaDeNacimiento,
          ])
        }
      }
      return {
        nombre: nombreDelArchivo(grupo, fecha, 'xlsx'),
        contenido: comoXlsx(`Nómina ${periodo}`, filas),
      }
    },
  }
}
