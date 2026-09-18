import type { Marcas } from '@gps/core'
import type { TipoDeCargo, TipoDeDocumento } from '@gps/personas/dominio'

/** Por donde pasa un permiso de salida.
 *
 *      borrador --emitir--> emitido --3/3 firmas--> firmado
 *                              |                       |
 *                              +-------> anulado <-----+
 *
 *  Emitido y firmado no se editan: lo que se firmo tiene que seguir diciendo lo
 *  mismo. Cambiar algo es anular y re-emitir. */
export const ESTADOS = ['borrador', 'emitido', 'firmado', 'anulado'] as const

export type Estado = (typeof ESTADOS)[number]

/** Un permiso de salida: lo que un grupo presenta para que le habiliten una
 *  salida o un acampe. */
export interface Permiso extends Marcas {
  readonly id: string
  readonly grupoId: string
  readonly estado: Estado
  readonly lugar: string
  /** aaaa-mm-dd las dos. Texto y no Date por la misma razon que en el resto del
   *  sistema: una salida empieza un dia del almanaque, no en un instante con
   *  zona horaria. */
  readonly desde: string
  readonly hasta: string
  /** Como se viaja, si corresponde: "micro contratado", "en las camionetas de
   *  los padres". Libre porque es lo que se escribe en el papel. */
  readonly comoSeViaja: string | null
  /** El del PDF emitido, que es lo que las firmas sellan. Null mientras sea
   *  borrador. */
  readonly pdfId: string | null
  readonly hashDelPdf: string | null
  /** De que permiso anulado salio este, si se re-emitio. */
  readonly reemplazaA: string | null
}

/** Si alguien va como dirigente o como beneficiario. Sale de la categoria de su
 *  pertenencia -activo es dirigente- y no se elige a mano: es lo mismo que
 *  significa la categoria, y dos formas de decirlo se contradicen. */
export type Marca = 'dirigente' | 'beneficiario'

/** Quien va, mientras el permiso es borrador. Solo el id y la marca: la
 *  fotografia de sus datos se toma al emitir, para que el PDF diga lo que era
 *  cierto ese dia. */
export interface Participante {
  readonly permisoId: string
  readonly personaId: string
  readonly marca: Marca
}

/** Quien fue, tal como estaba el dia de la emision. Mismo patron que Afiliado:
 *  lo que se firma identifica gente por documento, y si en dos anios alguien
 *  corrige un apellido, el permiso tiene que seguir leyendose como se leia. */
export interface ParticipanteEmitido {
  readonly permisoId: string
  readonly personaId: string
  readonly marca: Marca
  readonly tipoDeDocumento: TipoDeDocumento
  readonly numeroDeDocumento: string
  readonly nombres: string
  readonly apellidos: string
  /** El nombre para mostrar de su unidad, congelado igual que el resto. */
  readonly unidad: string
}

/** Como se firmo: dibujando en la app, o en papel sobre el PDF impreso. */
export type ModoDeFirma = 'app' | 'papel'

/** Una firma ya puesta. La fila nace al firmar, no al emitir: los firmantes
 *  pendientes se calculan a partir de los cargos, asi un cambio de comisionado
 *  entre la emision y la firma no deja una firma a nombre de quien ya no es. */
export interface Firma extends Marcas {
  readonly id: string
  readonly permisoId: string
  readonly cargo: TipoDeCargo
  readonly modo: ModoDeFirma
  /** Quien firmo, fotografiado igual que los participantes. */
  readonly personaId: string
  readonly nombres: string
  readonly apellidos: string
  /** aaaa-mm-dd. El dia que firmo, que es el que decide quien ocupaba el cargo. */
  readonly fecha: string
  /** Los trazos del dibujo, serializados. Null si firmo en papel. */
  readonly trazos: string | null
  /** El sello sobre el hash del PDF, los trazos, el cargo, la persona y la
   *  fecha, y con que clave se hizo. Null si firmo en papel: no hay nada que
   *  sellar, el respaldo es el escaneo. */
  readonly sello: string | null
  readonly claveDeSello: string | null
  /** El escaneo del papel firmado. Null si firmo en la app. Varias firmas
   *  pueden compartir uno: un mismo papel lo firman dos. */
  readonly escaneoId: string | null
}

/** Una planificacion, un croquis: lo que se cuelga del permiso sin ser parte de
 *  lo que se firma. Por eso no entra en el PDF ni en el hash. */
export interface Adjunto extends Marcas {
  readonly id: string
  readonly permisoId: string
  readonly archivoId: string
}

/** Algo que el sistema quiere decir sin impedir la operacion. Hoy hay uno solo
 *  -la anticipacion- y ya son dos los lugares que lo muestran, asi que tiene
 *  tipo propio en vez de un string suelto. */
export interface Aviso {
  readonly codigo: 'anticipacionInsuficiente'
  readonly mensaje: string
}
