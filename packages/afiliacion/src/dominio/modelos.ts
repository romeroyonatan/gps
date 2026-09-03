import type { Marcas } from '@gps/core'
import type { TipoDeDocumento } from '@gps/personas/dominio'

/** La nomina que un grupo presenta en una fecha. Una por grupo: lo que se
 *  presenta y lo que se cobra es la nomina de un grupo, no una lista global. */
export interface Declaracion extends Marcas {
  readonly id: string
  readonly grupoId: string
  /** aaaa-mm-dd. El dia de la foto. */
  readonly fecha: string
  /** El anio en que arranca el periodo al que cae esta declaracion. Con el
   *  corte el 1 de marzo, el 15 de enero de 2027 es del periodo 2026.
   *
   *  Se guarda y no se deriva. Ademas de ahorrar aritmetica de fechas en SQL:
   *  si algun dia se mueve INICIO_DEL_PERIODO, un periodo calculado al vuelo
   *  re-particionaria la historia y cambiaria quien fue cobrable en
   *  declaraciones ya emitidas. */
  readonly periodo: number
}

/** Una fila de la nomina: como estaba esa persona el dia de la declaracion.
 *
 *  Guarda nombre y documento y no solo el id por la misma razon por la que una
 *  factura guarda el nombre del cliente: lo que se le presenta a la asociacion
 *  identifica gente por documento, y si en 2027 alguien corrige un apellido, la
 *  nomina de mayo de 2026 tiene que seguir leyendose como se leia entonces.
 *
 *  No lleva id ni marcas: la declaracion ya tiene su creadoEn, y el par
 *  (declaracion, persona) es la clave. */
export interface Afiliado {
  readonly declaracionId: string
  readonly personaId: string
  readonly tipoDeDocumento: TipoDeDocumento
  readonly numeroDeDocumento: string
  readonly nombres: string
  readonly apellidos: string
}
