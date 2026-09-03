import { FECHAS_ORDINARIAS, INICIO_DEL_PERIODO } from './config'

/** El periodo al que cae una fecha: el anio en que ese periodo arranco.
 *
 *  Con INICIO_DEL_PERIODO en '03-01', periodoDe('2027-01-15') es 2026: enero es
 *  la cola del ciclo anterior, no el arranque de uno nuevo.
 *
 *  Compara texto contra texto: mes-dia en formato mm-dd ordena igual
 *  lexicografica que cronologicamente, asi que no hay nada que parsear. */
export function periodoDe(fecha: string): number {
  const anio = Number(fecha.slice(0, 4))
  const mesDia = fecha.slice(5)
  return mesDia >= INICIO_DEL_PERIODO ? anio : anio - 1
}

/** Las fechas ordinarias de ese periodo, en orden cronologico.
 *
 *  Cada mes-dia se resuelve contra el anio del almanaque que le toca, que no
 *  siempre es el anio en que el periodo arranca: con el corte en marzo, un
 *  '01-15' en FECHAS_ORDINARIAS cae en el anio siguiente. Hoy no hay ninguno
 *  asi, y la funcion existe igual para que agregarlo no sea un bug silencioso. */
export function fechasOrdinariasDelPeriodo(periodo: number): readonly string[] {
  return FECHAS_ORDINARIAS.map(
    (mesDia) => `${mesDia >= INICIO_DEL_PERIODO ? periodo : periodo + 1}-${mesDia}`,
  ).sort()
}
