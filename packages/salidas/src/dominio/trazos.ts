/** Un dibujo de firma: los trazos que hizo el dedo o el mouse, en coordenadas
 *  normalizadas de 0 a 1 respecto del lienzo.
 *
 *  Normalizadas y no en pixeles para que la misma firma se vea igual hecha en
 *  un telefono de 375px y en una pantalla de 1400: lo que se guarda es la
 *  forma, y quien la dibuja despues la escala a donde vaya. Sin eso, el PDF
 *  tendria firmas de tamaños distintos segun con que se firmo. */
export interface Trazos {
  /** Un trazo es lo que se dibujo entre apoyar y levantar. Varios trazos son
   *  una firma con la pluma levantada en el medio, que es lo normal. */
  readonly trazos: readonly (readonly (readonly [number, number])[])[]
}

/** Cuantos decimales se guardan de cada coordenada. Cuatro sobre un lienzo de
 *  mil pixeles es una decima de pixel: mas que suficiente para una firma, y lo
 *  que hace que la serializacion sea estable. */
const DECIMALES = 4

/** Los trazos como una cadena, siempre la misma para la misma firma.
 *
 *  Es lo que se sella, asi que tiene que ser estable: si el numero 0.1 se
 *  guardara y releyera como 0.10000000000000001, el sello dejaria de cerrar y
 *  una firma legitima pasaria por adulterada. Redondear a cuatro decimales
 *  antes de serializar lo evita.
 *
 *  JSON.stringify de un array de numeros ya es determinista -no hay claves que
 *  ordenar-, asi que alcanza con fijar la precision. */
export function serializar(trazos: Trazos): string {
  return JSON.stringify(
    trazos.trazos.map((trazo) => trazo.map(([x, y]) => [redondear(x), redondear(y)])),
  )
}

function redondear(valor: number): number {
  // El +0 evita que un -0 se serialice como "-0" y rompa la comparacion.
  return Number(valor.toFixed(DECIMALES)) + 0
}

/** Si el dibujo tiene algo. Una firma vacia no es una firma: el caso es apretar
 *  "firmar" sin haber dibujado nada. */
export function estaVacio(trazos: Trazos): boolean {
  return trazos.trazos.every((trazo) => trazo.length === 0)
}

/** Lee lo que guarda la base. Devuelve null si no se puede leer, en vez de
 *  tirar: una firma con trazos corruptos tiene que poder mostrarse como "no
 *  verificada" y no tumbar la consulta del permiso entero. */
export function deserializar(texto: string): Trazos | null {
  try {
    const leido: unknown = JSON.parse(texto)
    if (!Array.isArray(leido)) return null
    return { trazos: leido as Trazos['trazos'] }
  } catch {
    return null
  }
}
