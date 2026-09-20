import type { Alcance, Core } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Estructura } from '@gps/estructura/dominio'
import { type Personas, puedeVerPersonasDelGrupo } from '@gps/personas/dominio'
import { armarLaNomina, COLUMNAS_DE_LA_NOMINA } from '../dominio/nomina'
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

/** La nómina del grupo en los dos formatos. Los dos salen de la misma función
 *  pura, así que la planilla y el papel dicen lo mismo, fila por fila.
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
      const { grupo, fecha, periodo, secciones } = await nomina(alcance, grupoId)
      // Una sola hoja con las tres secciones una debajo de la otra, cada una
      // con su título: partirla en tres pestañas obligaría a ordenar o filtrar
      // tres veces, que es justo lo que se hace en una planilla.
      const filas: Celda[][] = [[...COLUMNAS_DE_LA_NOMINA]]
      for (const seccion of secciones) {
        filas.push([`${seccion.titulo} (${seccion.filas.length})`])
        for (const fila of seccion.filas) filas.push([fila.numero, ...fila.celdas])
      }
      return {
        nombre: nombreDelArchivo(grupo, fecha, 'xlsx'),
        contenido: comoXlsx(`Nómina ${periodo}`, filas),
      }
    },
  }
}
