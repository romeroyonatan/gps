import type { Core } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import { and, eq, gte, isNull, lte, or } from 'drizzle-orm'
import { nombreDelTipo, normalizarNumero, type TipoDeDocumento } from '../dominio/documentos'
import type { DatosDePersona } from '../dominio/modelos'
import type { Personas } from '../dominio/publico'
import { type Problema, validarIngreso, validarPersona } from '../dominio/validaciones'
import type { Cargo, DatosDeIngreso, PersonaConVinculos, Pertenencia } from '../dominio/vinculos'
import { personas, pertenencias, cargos as tablaDeCargos } from './tablas'

/** Los datos del alta no pasan las reglas de /dominio. Lleva los problemas
 *  adentro para que el resolver los pueda publicar campo por campo. */
export class DatosInvalidos extends Error {
  readonly problemas: readonly Problema[]

  constructor(problemas: readonly Problema[]) {
    super(problemas.map((problema) => problema.mensaje).join(' '))
    this.name = 'DatosInvalidos'
    this.problemas = problemas
  }
}

/** Ya hay una persona con ese documento. */
export class DocumentoDuplicado extends Error {
  constructor(tipo: TipoDeDocumento, numero: string) {
    super(`Ya hay una persona cargada con ${nombreDelTipo(tipo)} ${numero}.`)
    this.name = 'DocumentoDuplicado'
  }
}

/** El grupo del ingreso no existe, o esta cerrado. */
export class GrupoInexistente extends Error {
  constructor(grupoId: string) {
    super('El grupo al que se quiere inscribir no existe o está cerrado.')
    this.name = 'GrupoInexistente'
    this.grupoId = grupoId
  }
  readonly grupoId: string
}

/** Lo que este modulo hace, que es mas que lo que publica: ver Personas en
 *  /dominio/publico.ts. `extends` es lo que hace que la implementacion no pueda
 *  quedar corta sin que TypeScript se entere. */
export interface ServicioDePersonas extends Personas {
  crearPersona(datos: DatosDePersona, ingreso: DatosDeIngreso): Promise<PersonaConVinculos>
  /** Las personas con pertenencia vigente en ese grupo, ordenadas por apellido. */
  listarPersonas(grupoId: string): Promise<readonly PersonaConVinculos[]>
}

/** El orden alfabetico lo hace Intl y no un ORDER BY: SQLite compara bytes, asi
 *  que "Ávila" caeria despues de "Zaballa". En un idioma con acentos eso no es
 *  estetica, es una lista en la que no se encuentra a la gente.
 *
 *  Ordenar en memoria es el mismo criterio que listarDistritos, que arma el
 *  arbol con tres consultas: con la cantidad de personas de una diocesis alcanza
 *  de sobra, y si algun dia deja de alcanzar se arregla en un solo lugar. */
const alfabeto = new Intl.Collator('es')

/** Los metodos devuelven Promise aunque el driver de SQLite sea sincrono: es la
 *  costura que deja pasar a Postgres o a un driver asincrono en el telefono sin
 *  tocar a ningun consumidor.
 *
 *  `estructura` entra por el constructor y no por el contexto: es una
 *  dependencia declarada del modulo, que la raiz de composicion le pasa ya
 *  construida (ver Module<S, D> en core). Asi el servicio la puede usar sin
 *  saber si hay un request encima, que es lo que le permite correr dentro del
 *  telefono. */
export function crearServicioDePersonas(core: Core, estructura: Estructura): ServicioDePersonas {
  return {
    async crearPersona(datos, ingreso) {
      // Primero el grupo: sin el no se pueden validar ni la unidad ni la
      // existencia del destino, y no tiene sentido validar lo demas.
      const grupo = await estructura.obtenerGrupo(ingreso.grupoId)
      if (!grupo) throw new GrupoInexistente(ingreso.grupoId)

      const hoy = core.reloj.ahora()
      const problemas: readonly Problema[] = [
        ...validarPersona(datos, hoy),
        ...validarIngreso(ingreso, grupo.unidades, hoy),
      ]
      if (problemas.length > 0) throw new DatosInvalidos(problemas)

      const numeroDeDocumento = normalizarNumero(datos.numeroDeDocumento)

      // Este SELECT no es la garantia -dos altas simultaneas lo pasan las dos- y
      // no hace falta que lo sea: el UNIQUE de la tabla es el que garantiza.
      // Existe solo para el mensaje: sin el, lo que llega al formulario es
      // "UNIQUE constraint failed: personas.tipo_de_documento, ...", que no se
      // le puede mostrar a nadie.
      const yaEsta = core.bd
        .select({ id: personas.id })
        .from(personas)
        .where(
          and(
            eq(personas.tipoDeDocumento, datos.tipoDeDocumento),
            eq(personas.numeroDeDocumento, numeroDeDocumento),
          ),
        )
        .get()
      if (yaEsta) throw new DocumentoDuplicado(datos.tipoDeDocumento, numeroDeDocumento)

      const ahora = core.reloj.ahora()
      const persona = {
        ...datos,
        id: core.nuevoId('persona'),
        numeroDeDocumento,
        nombres: datos.nombres.trim(),
        apellidos: datos.apellidos.trim(),
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      const pertenencia: Pertenencia = {
        id: core.nuevoId('pertenencia'),
        personaId: persona.id,
        grupoId: ingreso.grupoId,
        categoria: ingreso.categoria,
        unidadId: ingreso.unidadId,
        desde: ingreso.desde,
        hasta: null,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      const cargosDeLaPersona: Cargo[] = ingreso.cargos.map((datosDelCargo) => ({
        id: core.nuevoId('cargo'),
        personaId: persona.id,
        grupoId: ingreso.grupoId,
        cargo: datosDelCargo.cargo,
        // El desde del cargo es el de la pertenencia: sin edicion todavia, y
        // pedir la misma fecha una vez por cargo no le sirve a nadie.
        desde: ingreso.desde,
        hasta: datosDelCargo.hasta,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }))

      // Las tres escrituras en una transaccion: una persona sin pertenencia no
      // aparece en ninguna pantalla, porque la unica query filtra por grupo.
      core.bd.transaction((tx) => {
        tx.insert(personas).values(persona).run()
        tx.insert(pertenencias).values(pertenencia).run()
        if (cargosDeLaPersona.length > 0) {
          tx.insert(tablaDeCargos).values(cargosDeLaPersona).run()
        }
      })

      return { ...persona, pertenencia, cargos: cargosDeLaPersona }
    },

    async listarPersonas(grupoId) {
      // Dos consultas y el armado en memoria, el mismo criterio que
      // listarDistritos: con la cantidad de personas de un grupo alcanza de
      // sobra, y si algun dia deja de alcanzar se arregla en un solo lugar.
      const filas = core.bd
        .select()
        .from(pertenencias)
        .innerJoin(personas, eq(personas.id, pertenencias.personaId))
        .where(and(eq(pertenencias.grupoId, grupoId), isNull(pertenencias.hasta)))
        .all()

      const filasDeCargos = core.bd
        .select()
        .from(tablaDeCargos)
        .where(eq(tablaDeCargos.grupoId, grupoId))
        .all()

      const cargosPorPersona = new Map<string, Cargo[]>()
      for (const cargo of filasDeCargos) {
        const suyos = cargosPorPersona.get(cargo.personaId) ?? []
        suyos.push(cargo)
        cargosPorPersona.set(cargo.personaId, suyos)
      }

      return filas
        .map((fila) => ({
          ...fila.personas,
          pertenencia: fila.pertenencias,
          cargos: cargosPorPersona.get(fila.personas.id) ?? [],
        }))
        .sort(
          (una, otra) =>
            alfabeto.compare(una.apellidos, otra.apellidos) ||
            alfabeto.compare(una.nombres, otra.nombres),
        )
    },

    async miembrosActivos(fecha) {
      // Las dos puntas inclusivas: la misma regla que estaVigente, pero contra
      // una fecha cualquiera en vez de contra hoy. Va en el WHERE y no en
      // memoria porque son fechas de texto contra fechas de texto -aaaa-mm-dd
      // ordena igual lexicografica que cronologicamente- y esto barre toda la
      // asociacion, no un grupo.
      const filas = core.bd
        .select()
        .from(pertenencias)
        .innerJoin(personas, eq(personas.id, pertenencias.personaId))
        .where(
          and(
            lte(pertenencias.desde, fecha),
            or(isNull(pertenencias.hasta), gte(pertenencias.hasta, fecha)),
          ),
        )
        .all()

      return filas.map((fila) => ({
        persona: fila.personas,
        grupoId: fila.pertenencias.grupoId,
      }))
    },
  }
}
