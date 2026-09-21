import { esFechaDeCalendario } from '@gps/core/fechas'
import type { Categoria } from '@gps/personas/dominio'
import type { Estado, Marca, Participante, ParticipanteEmitido, Permiso } from './modelos'

/** Un problema de validacion, atado a su campo. Por campo y no una lista de
 *  strings sueltos porque el formulario tiene que marcar el input que falla,
 *  igual que en personas. */
export interface Problema {
  readonly campo:
    | 'lugar'
    | 'direccion'
    | 'localidad'
    | 'provincia'
    | 'telefono'
    | 'desde'
    | 'hasta'
    | 'unidades'
    | 'participantes'
    | 'responsable'
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
  direccion: string
  localidad: string
  provincia: string
  telefono: string
  desde: string
  hasta: string
}): readonly Problema[] {
  const problemas: Problema[] = []

  if (datos.lugar.trim() === '') {
    problemas.push({ campo: 'lugar', mensaje: 'Decí a dónde van.' })
  }
  // Todos obligatorios y no uno solo con el resto opcional: una dirección sin
  // localidad ni provincia no lleva a nadie a ningún lado, y sin teléfono no
  // hay con qué ubicar al grupo. Es lo que el permiso imprime para eso.
  for (const [campo, etiqueta] of [
    ['direccion', 'la dirección'],
    ['localidad', 'la localidad'],
    ['provincia', 'la provincia'],
    // El telefono es obligatorio por la misma razon que la direccion: es con lo
    // que la diocesis ubica al grupo mientras esta afuera.
    ['telefono', 'el teléfono de contacto'],
  ] as const) {
    if (datos[campo].trim() === '') {
      problemas.push({ campo, mensaje: `Falta ${etiqueta}.` })
    }
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
  participantes: readonly Pick<Participante, 'marca' | 'personaId'>[],
  responsableId: string | null,
): readonly Problema[] {
  if (!participantes.some((uno) => uno.marca === 'dirigente')) {
    return [{ campo: 'participantes', mensaje: 'Tiene que ir al menos un dirigente.' }]
  }
  // El responsable se exige para emitir y no para guardar el borrador: cuando
  // el permiso nace todavia no hay nadie anotado entre quien elegirlo.
  if (!esResponsablePosible(participantes, responsableId)) {
    return [
      { campo: 'responsable', mensaje: 'Elegí el dirigente que queda a cargo de la actividad.' },
    ]
  }
  return []
}

/** Si esa persona puede quedar a cargo: tiene que ir a la salida y tiene que
 *  ser dirigente. Lo usan el servidor al elegirlo y la pantalla para ofrecer
 *  sólo a quien corresponde. */
export function esResponsablePosible(
  participantes: readonly Pick<Participante, 'marca' | 'personaId'>[],
  personaId: string | null,
): boolean {
  return participantes.some((uno) => uno.personaId === personaId && uno.marca === 'dirigente')
}

/** El numero con el que se nombra un permiso en voz alta y en un mostrador:
 *  "SAL-2026-0147". El id interno es un uuid y nadie lo dicta por telefono.
 *
 *  Es una serie corrida por anio y de la diocesis entera -no de cada grupo-:
 *  quien lleva el registro es ella, y dos permisos con el mismo numero en
 *  distintos grupos serian dos expedientes con el mismo nombre. Las partes se
 *  guardan y el formato vive aca, asi que cambiar el ancho del numero no toca
 *  la base.
 *
 *  Null mientras sea borrador: un borrador todavia no es un expediente. */
export function numeroDeExpediente(
  permiso: Pick<Permiso, 'anioDeExpediente' | 'numeroDeExpediente'>,
): string | null {
  if (permiso.anioDeExpediente === null || permiso.numeroDeExpediente === null) return null
  return `SAL-${permiso.anioDeExpediente}-${String(permiso.numeroDeExpediente).padStart(4, '0')}`
}

/** Lo que el papel dice, escrito en un texto canonico: los datos de la salida,
 *  que unidades van y la nomina congelada, siempre en el mismo orden.
 *
 *  Su hash se calcula al emitir y se imprime en el pie del PDF, que es lo que
 *  deja comprobar despues que el contenido no cambio. Va sobre los datos y no
 *  sobre los bytes del PDF por dos razones: un archivo no puede contener su
 *  propio hash, y rediagramar el papel no tiene que invalidar lo emitido -lo
 *  que se afirma es lo que dice, no como esta dibujado-.
 *
 *  No entran las firmas: se agregan despues de emitir, y la huella describe lo
 *  que se firma, no quien ya firmo.
 *
 *  Es puro y del dominio: el dia que una pantalla quiera verificar una huella
 *  contra lo que ve, la funcion ya esta de ese lado. El hash lo hace Core. */
export function contenidoDelPermiso(datos: {
  permiso: Pick<
    Permiso,
    | 'id'
    | 'anioDeExpediente'
    | 'numeroDeExpediente'
    | 'grupoId'
    | 'lugar'
    | 'direccion'
    | 'localidad'
    | 'provincia'
    | 'telefono'
    | 'desde'
    | 'hasta'
    | 'comoSeViaja'
    | 'responsableId'
  >
  unidades: readonly string[]
  participantes: readonly ParticipanteEmitido[]
}): string {
  const { permiso } = datos
  return [
    'permiso',
    permiso.id,
    numeroDeExpediente(permiso) ?? '',
    permiso.grupoId,
    permiso.lugar,
    permiso.direccion,
    permiso.localidad,
    permiso.provincia,
    permiso.telefono,
    permiso.desde,
    permiso.hasta,
    permiso.comoSeViaja ?? '',
    permiso.responsableId ?? '',
    // Ordenados y no en el orden en que los devolvio la base: dos consultas que
    // traen lo mismo en distinto orden tienen que dar la misma huella.
    [...datos.unidades].sort().join(','),
    ...[...datos.participantes]
      .sort((uno, otro) => uno.personaId.localeCompare(otro.personaId))
      .map((uno) =>
        [
          uno.personaId,
          uno.marca,
          uno.tipoDeDocumento,
          uno.numeroDeDocumento,
          uno.apellidos,
          uno.nombres,
          uno.unidad,
        ].join(','),
      ),
  ].join('\n')
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
