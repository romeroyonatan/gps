import { periodoDe } from '@gps/afiliacion/dominio'
import type { TipoDeMovimiento } from './modelos'

/** Una fila de "Cobranza por distrito". `deuda` es `facturado - cobrado` del
 *  período, que no es el saldo de la cuenta: el saldo arrastra los períodos
 *  anteriores y esto responde "cómo venimos con la temporada". */
export interface CobranzaDelDistrito {
  readonly distritoId: string
  readonly numero: number
  readonly zona: string
  readonly grupos: number
  readonly declararon: number
  readonly facturado: number
  readonly cobrado: number
  readonly deuda: number
}

/** El pie de la tabla, y también lo que se compara entre dos períodos. */
export interface TotalesDelPeriodo {
  readonly periodo: number
  readonly distritos: number
  readonly grupos: number
  readonly declararon: number
  readonly personasCobradas: number
  readonly facturado: number
  readonly cobrado: number
  readonly deuda: number
}

export interface ReporteDeCobranza {
  readonly periodo: number
  readonly porDistrito: readonly CobranzaDelDistrito[]
  readonly totales: TotalesDelPeriodo
  /** El mismo cierre del período anterior, para la tabla de evolución. */
  readonly anterior: TotalesDelPeriodo
}

/** Lo que el reporte necesita de cada módulo, y nada más: así la función se
 *  prueba con literales y no con una base. */
export interface DatosDelReporte {
  readonly distritos: readonly {
    readonly id: string
    readonly numero: number
    readonly zona: string
  }[]
  readonly grupos: readonly { readonly id: string; readonly distritoId: string }[]
  readonly declaraciones: readonly { readonly grupoId: string; readonly periodo: number }[]
  readonly movimientos: readonly {
    readonly grupoId: string
    readonly tipo: TipoDeMovimiento
    readonly importe: number
    readonly periodo: number | null
    readonly cantidad: number | null
    readonly fecha: string
  }[]
}

/** Lo facturado del período sale del cargo, que sí lleva `periodo`. Lo cobrado
 *  no puede salir de ahí: un pago se asienta contra la cuenta del grupo y no
 *  contra un período —la tabla lo obliga, `periodo IS NULL` para los pagos—,
 *  así que cuenta en el período en que cae su fecha. Es lo que el tesorero
 *  entiende por "cuánto entró esta temporada" y lo que cierra contra el
 *  extracto; la contra es que un grupo que paga tarde la deuda del año pasado
 *  suma acá. Por eso `deuda` del período no es el saldo de la cuenta, y la
 *  pantalla de Deuda sigue siendo la que manda para ir a cobrar. */
function esCobranzaDelPeriodo(
  movimiento: DatosDelReporte['movimientos'][number],
  periodo: number,
): boolean {
  return (
    (movimiento.tipo === 'pago' || movimiento.tipo === 'anulacion_pago') &&
    periodoDe(movimiento.fecha) === periodo
  )
}

/** Un acumulador por distrito mientras se recorre; se congela al final. */
interface Acumulado {
  grupos: number
  declararon: number
  personasCobradas: number
  facturado: number
  cobrado: number
}

export function armarReporteDeCobranza(periodo: number, datos: DatosDelReporte): ReporteDeCobranza {
  const distritoDelGrupo = new Map(datos.grupos.map((grupo) => [grupo.id, grupo.distritoId]))

  const vacio = (): Acumulado => ({
    grupos: 0,
    declararon: 0,
    personasCobradas: 0,
    facturado: 0,
    cobrado: 0,
  })
  const porDistrito = new Map(datos.distritos.map((distrito) => [distrito.id, vacio()]))
  const anterior = vacio()
  const declararonAntes = new Set<string>()

  const acumulado = (grupoId: string): Acumulado | undefined => {
    const distritoId = distritoDelGrupo.get(grupoId)
    return distritoId === undefined ? undefined : porDistrito.get(distritoId)
  }

  for (const grupo of datos.grupos) {
    const donde = porDistrito.get(grupo.distritoId)
    if (donde) donde.grupos++
  }

  // Un grupo declara una vez por período, pero si alguna vez declarara dos, el
  // distrito no tiene que contarlo dos veces: se cuentan grupos, no papeles.
  const declararon = new Set<string>()
  for (const declaracion of datos.declaraciones) {
    if (declaracion.periodo === periodo) declararon.add(declaracion.grupoId)
    if (declaracion.periodo === periodo - 1) declararonAntes.add(declaracion.grupoId)
  }
  for (const grupoId of declararon) {
    const donde = acumulado(grupoId)
    if (donde) donde.declararon++
  }

  for (const movimiento of datos.movimientos) {
    const donde = acumulado(movimiento.grupoId)
    const esCargo = movimiento.tipo === 'cargo_afiliacion'

    if (esCargo && movimiento.periodo === periodo) {
      if (donde) {
        donde.facturado += movimiento.importe
        donde.personasCobradas += movimiento.cantidad ?? 0
      }
    } else if (esCargo && movimiento.periodo === periodo - 1) {
      anterior.facturado += movimiento.importe
      anterior.personasCobradas += movimiento.cantidad ?? 0
    }

    // El pago se guarda en negativo y la anulación en positivo: invertir el
    // signo deja "lo que entró" en positivo, con las anulaciones restando.
    if (esCobranzaDelPeriodo(movimiento, periodo)) {
      if (donde) donde.cobrado -= movimiento.importe
    } else if (esCobranzaDelPeriodo(movimiento, periodo - 1)) {
      anterior.cobrado -= movimiento.importe
    }
  }

  const filas = datos.distritos
    .map((distrito) => {
      const suma = porDistrito.get(distrito.id) ?? vacio()
      return {
        distritoId: distrito.id,
        numero: distrito.numero,
        zona: distrito.zona,
        grupos: suma.grupos,
        declararon: suma.declararon,
        facturado: suma.facturado,
        cobrado: suma.cobrado,
        deuda: suma.facturado - suma.cobrado,
      }
    })
    .sort((una, otra) => una.numero - otra.numero)

  const sumar = (saca: (fila: CobranzaDelDistrito) => number) =>
    filas.reduce((total, fila) => total + saca(fila), 0)
  const facturado = sumar((fila) => fila.facturado)
  const cobrado = sumar((fila) => fila.cobrado)

  return {
    periodo,
    porDistrito: filas,
    totales: {
      periodo,
      distritos: filas.length,
      grupos: sumar((fila) => fila.grupos),
      declararon: sumar((fila) => fila.declararon),
      personasCobradas: [...porDistrito.values()].reduce(
        (total, suma) => total + suma.personasCobradas,
        0,
      ),
      facturado,
      cobrado,
      deuda: facturado - cobrado,
    },
    anterior: {
      periodo: periodo - 1,
      // Los distritos y los grupos son los de hoy: el reporte no reconstruye
      // cómo estaba dibujada la diócesis el año pasado.
      distritos: filas.length,
      grupos: sumar((fila) => fila.grupos),
      declararon: declararonAntes.size,
      personasCobradas: anterior.personasCobradas,
      facturado: anterior.facturado,
      cobrado: anterior.cobrado,
      deuda: anterior.facturado - anterior.cobrado,
    },
  }
}

/** Los períodos que se pueden mirar en el reporte: el corriente y todos los
 *  que tienen cuota definida, del más nuevo al más viejo.
 *
 *  No es un rango fijo desde el almanaque: la asociación lleva treinta años y
 *  ofrecer los treinta -o inventar cuántos atrás mostrar- es igual de malo.
 *  Un período sin cuota no tiene cargos, así que su reporte sería todo ceros;
 *  el corriente se suma aunque todavía no tenga cuota porque es el que se está
 *  mirando cuando alguien entra. */
export function periodosDelReporte(hoy: string, conCuota: readonly number[]): readonly number[] {
  return [...new Set([periodoDe(hoy), ...conCuota])].sort((uno, otro) => otro - uno)
}

/** La variación entre dos períodos, escrita con signo. `porcentaje` es null
 *  cuando antes era cero: no se puede porcentuar desde cero, y escribir
 *  "+∞ %" o "+100 %" sería inventar. La pantalla decide cuál de los dos
 *  muestra —las cantidades van en absoluto, la plata en porcentaje—. */
export function variacion(
  antes: number,
  ahora: number,
): { readonly absoluta: number; readonly porcentaje: number | null } {
  return {
    absoluta: ahora - antes,
    porcentaje: antes === 0 ? null : ((ahora - antes) / Math.abs(antes)) * 100,
  }
}
