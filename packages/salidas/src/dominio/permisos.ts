import { esFechaDeCalendario } from '@gps/core/fechas'
import type { Categoria } from '@gps/personas/dominio'
import type { Estado, Marca, Participante } from './modelos'

/** Un problema de validacion, atado a su campo. Por campo y no una lista de
 *  strings sueltos porque el formulario tiene que marcar el input que falla,
 *  igual que en personas. */
export interface Problema {
  readonly campo: 'lugar' | 'desde' | 'hasta' | 'unidades' | 'participantes'
  readonly mensaje: string
}

/** Quien va como dirigente y quien como beneficiario. Sale de la categoria y no
 *  se elige a mano: activo es el dirigente, que es justo lo que la categoria ya
 *  significa. */
export function marcaSegunCategoria(categoria: Categoria): Marca {
  return categoria === 'activo' ? 'dirigente' : 'beneficiario'
}

/** Los datos del permiso, sin los participantes. */
export function validarDatos(datos: {
  lugar: string
  desde: string
  hasta: string
}): readonly Problema[] {
  const problemas: Problema[] = []

  if (datos.lugar.trim() === '') {
    problemas.push({ campo: 'lugar', mensaje: 'Decí a dónde van.' })
  }
  if (!esFechaDeCalendario(datos.desde)) {
    problemas.push({ campo: 'desde', mensaje: 'La fecha de salida tiene que ser una fecha real.' })
  }
  if (!esFechaDeCalendario(datos.hasta)) {
    problemas.push({ campo: 'hasta', mensaje: 'La fecha de vuelta tiene que ser una fecha real.' })
  } else if (esFechaDeCalendario(datos.desde) && datos.hasta < datos.desde) {
    // Compara texto: aaaa-mm-dd ordena igual lexicografica que
    // cronologicamente, asi que no hay nada que parsear.
    problemas.push({ campo: 'hasta', mensaje: 'Vuelven antes de salir.' })
  }

  return problemas
}

/** Quienes pueden ir: los de las unidades elegidas, mas los dirigentes y
 *  adherentes del grupo.
 *
 *  Los adultos sin unidad entran aunque no esten en ninguna: el cocinero es
 *  adherente y no pertenece a ninguna unidad, y va igual. Dejarlos afuera seria
 *  una regla que no existe en el mundo. */
export function candidatos<
  P extends { pertenencia: { unidadId: string | null; categoria: Categoria } },
>(personasDelGrupo: readonly P[], unidadesElegidas: readonly string[]): readonly P[] {
  const elegidas = new Set(unidadesElegidas)
  return personasDelGrupo.filter(
    (persona) =>
      persona.pertenencia.unidadId === null || elegidas.has(persona.pertenencia.unidadId),
  )
}

/** Emitir exige al menos un dirigente: nadie sale sin un adulto a cargo.
 *
 *  El reglamento pide una proporcion segun cuantos chicos van; eso llega cuando
 *  la asociacion confirme los numeros. Uno es el piso que no depende de ningun
 *  numero por confirmar. */
export function validarParticipantes(
  participantes: readonly Pick<Participante, 'marca'>[],
): readonly Problema[] {
  if (!participantes.some((uno) => uno.marca === 'dirigente')) {
    return [{ campo: 'participantes', mensaje: 'Tiene que ir al menos un dirigente.' }]
  }
  return []
}

/** Que transiciones existen. Tenerlas en una tabla y no repartidas en ifs es lo
 *  que hace que se puedan leer de una: lo que no esta aca, no pasa. */
const TRANSICIONES: Readonly<Record<Estado, readonly Estado[]>> = {
  borrador: ['emitido'],
  // A firmado llega solo, cuando entra la tercera firma.
  emitido: ['firmado', 'anulado'],
  firmado: ['anulado'],
  // De anulado no se sale: re-emitir crea un permiso nuevo, no revive este.
  anulado: [],
}

export function puedeTransicionar(desde: Estado, hasta: Estado): boolean {
  return TRANSICIONES[desde].includes(hasta)
}

/** Si en ese estado se pueden tocar los datos, las unidades o los
 *  participantes. Es la regla que hace que lo firmado siga diciendo lo mismo. */
export function sePuedeEditar(estado: Estado): boolean {
  return estado === 'borrador'
}
