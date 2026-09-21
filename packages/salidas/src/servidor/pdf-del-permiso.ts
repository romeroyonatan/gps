import type { Archivos } from '@gps/archivos/dominio'
import type { Core } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import { nombreDeLaUnidad } from '@gps/estructura/dominio'
import { contenidoDelPermiso } from '../dominio/permisos'
import type { crearOperacionesDeBorrador } from './borradores'
import { PermisoNoEditable } from './borradores'
import type { crearConsultasDeSalidas } from './consultas'
import type { crearOperacionesDeFirma } from './firmas'
import { armarPdf } from './pdf'

/** El PDF del permiso tal como esta ahora. Junta los datos y llama a armarPdf,
 *  que es el que no toca la base.
 *
 *  Vive aparte de pdf.ts para que ese siga siendo puro -datos adentro, bytes
 *  afuera- y se pueda probar sin montar nada. */
export async function armarPdfDelPermiso(
  core: Core,
  estructura: Estructura,
  archivos: Archivos,
  borradores: ReturnType<typeof crearOperacionesDeBorrador>,
  firmas: ReturnType<typeof crearOperacionesDeFirma>,
  consultas: ReturnType<typeof crearConsultasDeSalidas>,
  permisoId: string,
): Promise<Uint8Array> {
  const permiso = borradores.permisoDe(permisoId)
  if (permiso.estado === 'borrador') {
    throw new PermisoNoEditable('Un borrador todavia no tiene PDF: emitilo primero.')
  }

  const grupo = await estructura.obtenerGrupo(permiso.grupoId)
  if (!grupo) throw new PermisoNoEditable('El grupo del permiso ya no esta abierto.')

  const unidadesPorId = new Map(grupo.unidades.map((unidad) => [unidad.id, unidad]))
  const estados = await firmas.estadoDeLasFirmas(permisoId)

  // Un escaneo puede respaldar varias firmas; se baja una sola vez y se anexa
  // una sola vez, con los cargos que lo firmaron.
  const porEscaneo = new Map<string, string[]>()
  for (const estado of estados) {
    const escaneoId = estado.firma?.escaneoId
    if (!escaneoId) continue
    porEscaneo.set(escaneoId, [...(porEscaneo.get(escaneoId) ?? []), estado.nombreDelCargo])
  }

  const escaneos = await Promise.all(
    [...porEscaneo].map(async ([escaneoId, cargos]) => {
      const { contenido, tipo } = await archivos.descargar(escaneoId, null)
      return { cargo: cargos.join(', '), contenido, tipo }
    }),
  )

  const emitidos = await consultas.listarParticipantesEmitidos(permisoId)
  const unidades = borradores.unidadesElegidas(permisoId)

  // La huella se recalcula sobre lo que hay hoy y no se lee de la fila: si
  // alguien toco la base, el papel sale diciendo otra huella -y avisando-, que
  // es justamente para lo que sirve.
  const huella = core.hash(contenidoDelPermiso({ permiso, unidades, participantes: emitidos }))

  return await armarPdf({
    permiso,
    grupo,
    huella,
    alterado: permiso.hashDelContenido !== null && permiso.hashDelContenido !== huella,
    unidades: unidades.map((id) => {
      const unidad = unidadesPorId.get(id)
      return unidad ? nombreDeLaUnidad(unidad) : id
    }),
    participantes: emitidos,
    responsable: emitidos.find((uno) => uno.personaId === permiso.responsableId) ?? null,
    firmas: estados.map((estado) => ({
      cargo: estado.nombreDelCargo,
      nombre: estado.quien ? `${estado.quien.apellidos}, ${estado.quien.nombres}` : 'Sin ocupante',
      firma: estado.firma,
    })),
    escaneos,
  })
}
