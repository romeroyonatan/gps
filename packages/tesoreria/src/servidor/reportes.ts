import type { Afiliacion } from '@gps/afiliacion/dominio'
import type { Alcance, Core } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { ReporteDeCobranza } from '../dominio'
import { armarReporteDeCobranza, puedeVerTesoreriaDeLaDiocesis } from '../dominio'
import { OperacionDenegada } from './errores'
import { movimientosDeTesoreria } from './tablas'

/** El reporte de cobranza: junta lo que hace falta de los tres módulos y deja
 *  toda la aritmética en `/dominio`, que se prueba con literales.
 *
 *  Trae los movimientos enteros y agrupa en memoria en vez de hacerlo en SQL,
 *  por lo mismo que `listarCuentas` y `listarDistritos` de estructura: son
 *  decenas de grupos y unos pocos movimientos por grupo al año. Si algún día
 *  deja de alcanzar, se arregla acá y en ningún otro lado. */
export function crearReportesDeTesoreria(
  core: Core,
  afiliacion: Afiliacion,
  estructura: Estructura,
) {
  async function reporteDeCobranza(alcance: Alcance, periodo: number): Promise<ReporteDeCobranza> {
    // El reporte es de la diócesis entera: no hay recorte por grupo que tenga
    // sentido acá, así que se deniega en vez de devolver una tabla en cero.
    if (!puedeVerTesoreriaDeLaDiocesis(alcance.actor)) {
      throw new OperacionDenegada('El reporte de cobranza lo ve la Tesorería diocesana.')
    }

    const [distritos, grupos, declaraciones] = await Promise.all([
      estructura.listarDistritosSinGrupos(),
      estructura.listarGrupos(),
      afiliacion.listarDeclaraciones(),
    ])

    return armarReporteDeCobranza(periodo, {
      distritos,
      grupos,
      declaraciones,
      movimientos: core.bd
        .select({
          grupoId: movimientosDeTesoreria.grupoId,
          tipo: movimientosDeTesoreria.tipo,
          importe: movimientosDeTesoreria.importe,
          periodo: movimientosDeTesoreria.periodo,
          cantidad: movimientosDeTesoreria.cantidad,
          fecha: movimientosDeTesoreria.fecha,
        })
        .from(movimientosDeTesoreria)
        .all(),
    })
  }

  return { reporteDeCobranza }
}
