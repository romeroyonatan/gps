const FORMATO = /^\d{4}-\d{2}-\d{2}$/

/** El motivo por el que no se puede declarar con esa fecha, o null si se puede.
 *
 *  Devuelve el mensaje pelado y no un Problema con campo, como hace personas:
 *  aca hay un solo campo y ningun formulario que marcar.
 *
 *  Chequea la forma y no que la fecha exista en el almanaque -"2026-02-30"
 *  pasa- a proposito: ninguna fecha llega tipeada por nadie. Salen de
 *  FECHAS_ORDINARIAS y de aFechaDeCalendario(reloj), que no pueden inventar un
 *  30 de febrero. El regex esta como red, no como validacion de un formulario.
 *
 *  `hoy` y `ultima` entran por parametro: la funcion es pura y el reloj es del
 *  servicio. */
export function validarFecha(fecha: string, ultima: string | null, hoy: string): string | null {
  if (!FORMATO.test(fecha)) {
    return `"${fecha}" no es una fecha con formato aaaa-mm-dd.`
  }
  if (fecha > hoy) {
    return 'No se puede declarar una afiliación con fecha futura.'
  }
  if (ultima !== null && fecha < ultima) {
    return `Ya hay una declaración del ${ultima}: no se puede declarar con una fecha anterior.`
  }
  return null
}
