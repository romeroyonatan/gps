import type { Core } from '@gps/core'
import { and, eq } from 'drizzle-orm'
import { nombreDelTipo, normalizarNumero, type TipoDeDocumento } from '../dominio/documentos'
import type { DatosDePersona, Persona } from '../dominio/modelos'
import { type Problema, validarPersona } from '../dominio/validaciones'
import { personas } from './tablas'

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

export interface ServicioDePersonas {
  crearPersona(datos: DatosDePersona): Promise<Persona>
  listarPersonas(): Promise<readonly Persona[]>
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
 *  tocar a ningun consumidor. */
export function crearServicioDePersonas(core: Core): ServicioDePersonas {
  return {
    async crearPersona(datos) {
      const problemas = validarPersona(datos, core.reloj.ahora())
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
      core.bd.insert(personas).values(persona).run()
      return persona
    },

    async listarPersonas() {
      return core.bd
        .select()
        .from(personas)
        .all()
        .sort(
          (una, otra) =>
            alfabeto.compare(una.apellidos, otra.apellidos) ||
            alfabeto.compare(una.nombres, otra.nombres),
        )
    },
  }
}
