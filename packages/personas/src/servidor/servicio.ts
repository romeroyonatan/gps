import type { Actor, Alcance, Core, RolConAmbito } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Estructura } from '@gps/estructura/dominio'
import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm'
import { ambitoDelCargo, nombreDelCargo, type TipoDeCargo } from '../dominio/cargos'
import { nombreDelTipo, normalizarNumero, type TipoDeDocumento } from '../dominio/documentos'
import type { IntegranteDeEquipo, TipoDeEquipo } from '../dominio/equipos'
import type { DatosDePersona } from '../dominio/modelos'
import {
  puedeAdministrarEquiposDiocesanos,
  puedeAdministrarPlantelDeGrupo,
  puedeVerPersonasDelGrupo,
} from '../dominio/politicas'
import type { Personas } from '../dominio/publico'
import { type Problema, validarIngreso, validarPersona } from '../dominio/validaciones'
import type {
  Cargo,
  DatosDeIngreso,
  JefeDeGrupo,
  PersonaConVinculos,
  Pertenencia,
} from '../dominio/vinculos'
import {
  equipos,
  integrantesDeEquipo,
  personas,
  pertenencias,
  cargos as tablaDeCargos,
} from './tablas'

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

/** El cargo no se puede asignar: el ambito no coincide con la entidad que se
 *  paso, la entidad no existe o esta cerrada, o ya estaba asignado igual. */
export class CargoInvalido extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'CargoInvalido'
  }
}

export class CambioDeAutoridadDenegado extends Error {
  constructor() {
    super('No podés administrar autoridades de ese ámbito.')
    this.name = 'CambioDeAutoridadDenegado'
  }
}

/** Lo que este modulo hace, que es mas que lo que publica: ver Personas en
 *  /dominio/publico.ts. `extends` es lo que hace que la implementacion no pueda
 *  quedar corta sin que TypeScript se entere. */
export interface DatosDeAsignacionDeCargo {
  readonly personaId: string
  readonly cargo: TipoDeCargo
  readonly ambitoId: string | null
  readonly desde: string
  readonly hasta?: string | null
}

export interface ServicioDePersonas extends Personas {
  crearPersona(
    alcance: Alcance,
    datos: DatosDePersona,
    ingreso: DatosDeIngreso,
  ): Promise<PersonaConVinculos>
  /** Las personas con pertenencia vigente en ese grupo, ordenadas por apellido. */
  listarPersonas(alcance: Alcance, grupoId: string): Promise<readonly PersonaConVinculos[]>

  /** Quién conduce cada grupo hoy. Es el directorio de la asociación —el
   *  complemento del árbol de distritos— y por eso no se filtra por alcance:
   *  saber quién es el jefe del grupo 7 no dice nada de la gente del grupo 7.
   *  Sus datos, su cuenta y sus salidas siguen yendo por alcance.
   *
   *  Una consulta suelta y no un campo de `Grupo` porque la flecha va en esta
   *  dirección: `personas` conoce a `estructura`, no al revés. Mismo motivo
   *  que `afiliadosEn`. */
  jefesDeGrupos(
    alcance: Alcance,
    grupoIds: readonly string[],
    fecha: string,
  ): Promise<readonly JefeDeGrupo[]>

  /** Le da a una persona un cargo en la entidad que corresponde a su ambito:
   *  un grupo, un distrito, o ninguna si es de la diocesis. */
  asignarCargo(datos: DatosDeAsignacionDeCargo): Promise<Cargo>
  asignarCargoComo(actor: Actor, datos: DatosDeAsignacionDeCargo): Promise<Cargo>
  revocarCargo(actor: Actor, cargoId: string): Promise<void>

  integrarEquipo(
    actor: Actor,
    datos: {
      personaId: string
      tipo: TipoDeEquipo
      ambitoTipo: 'grupo' | 'diocesis'
      ambitoId: string | null
      desde: string
      hasta?: string | null
    },
  ): Promise<IntegranteDeEquipo>
  revocarIntegranteDeEquipo(actor: Actor, integranteId: string): Promise<void>
}

/** El orden alfabetico lo hace Intl y no un ORDER BY: SQLite compara bytes, asi
 *  que "Ávila" caeria despues de "Zaballa". En un idioma con acentos eso no es
 *  estetica, es una lista en la que no se encuentra a la gente.
 *
 *  Ordenar en memoria es el mismo criterio que listarDistritos, que arma el
 *  arbol con tres consultas: con la cantidad de personas de una diocesis alcanza
 *  de sobra, y si algun dia deja de alcanzar se arregla en un solo lugar. */
const alfabeto = new Intl.Collator('es')

function rolDelCargo(cargo: TipoDeCargo, ambitoId: string | null): RolConAmbito | null {
  if (cargo === 'jefeDeGrupo' || cargo === 'director') {
    return {
      rol: cargo === 'director' ? 'directorDeGrupo' : cargo,
      ambito: { tipo: 'grupo', id: ambitoId },
    }
  }
  if (cargo === 'comisionadoDeDistrito') {
    return { rol: cargo, ambito: { tipo: 'distrito', id: ambitoId } }
  }
  if (cargo === 'jefeScoutDiocesano') {
    return { rol: cargo, ambito: { tipo: 'diocesis', id: null } }
  }
  return null
}

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
  async function validarAsignacionDeCargo(datos: DatosDeAsignacionDeCargo): Promise<void> {
    // Que la entidad exista y siga abierta lo verifica estructura, no una
    // foreign key: sus tablas son de otro modulo. Es la misma perdida
    // consciente que grupo_id en pertenencias.
    const ambito = ambitoDelCargo(datos.cargo)
    const nombre = nombreDelCargo(datos.cargo)
    if (ambito === 'diocesis') {
      if (datos.ambitoId !== null) {
        throw new CargoInvalido(`${nombre} es de la diocesis: no apunta a ninguna entidad.`)
      }
    } else if (datos.ambitoId === null) {
      throw new CargoInvalido(`${nombre} necesita el ${ambito} al que corresponde.`)
    } else if (ambito === 'grupo') {
      if (!(await estructura.obtenerGrupo(datos.ambitoId))) {
        throw new CargoInvalido(`${nombre}: el grupo no existe o esta cerrado.`)
      }
    } else if (!(await estructura.distritoEstaAbierto(datos.ambitoId))) {
      throw new CargoInvalido(`${nombre}: el distrito no existe o esta cerrado.`)
    }

    // El UNIQUE de la tabla ataja el duplicado exacto salvo cuando ambito_id
    // es NULL: SQLite trata dos NULL como distintos. Por eso el de la
    // diocesis se verifica aca, que es el unico caso que la base deja pasar.
    if (ambito === 'diocesis') {
      const yaEsta = core.bd
        .select({ id: tablaDeCargos.id })
        .from(tablaDeCargos)
        .where(
          and(
            eq(tablaDeCargos.personaId, datos.personaId),
            eq(tablaDeCargos.cargo, datos.cargo),
            isNull(tablaDeCargos.ambitoId),
            eq(tablaDeCargos.desde, datos.desde),
          ),
        )
        .get()
      if (yaEsta) throw new CargoInvalido(`${nombre} ya esta cargado con esa fecha.`)
    }
  }

  function construirCargo(datos: DatosDeAsignacionDeCargo): Cargo {
    const ahora = core.reloj.ahora()
    return {
      id: core.nuevoId('cargo'),
      personaId: datos.personaId,
      ambitoId: datos.ambitoId,
      cargo: datos.cargo,
      desde: datos.desde,
      hasta: datos.hasta ?? null,
      revocadoEn: null,
      creadoEn: ahora,
      actualizadoEn: ahora,
    }
  }

  const servicio: ServicioDePersonas = {
    async personaExiste(personaId) {
      return (
        core.bd
          .select({ id: personas.id })
          .from(personas)
          .where(eq(personas.id, personaId))
          .get() !== undefined
      )
    },

    async nombreDe(personaId) {
      return (
        core.bd
          .select({ nombres: personas.nombres, apellidos: personas.apellidos })
          .from(personas)
          .where(eq(personas.id, personaId))
          .get() ?? null
      )
    },

    async grupoVigenteDe(personaId, fecha) {
      return (
        core.bd
          .select({ grupoId: pertenencias.grupoId })
          .from(pertenencias)
          .where(
            and(
              eq(pertenencias.personaId, personaId),
              lte(pertenencias.desde, fecha),
              or(isNull(pertenencias.hasta), gte(pertenencias.hasta, fecha)),
            ),
          )
          .get()?.grupoId ?? null
      )
    },

    async funcionesVigentes(personaId, fecha) {
      const resultado: RolConAmbito[] = []
      const pertenencia = core.bd
        .select({ grupoId: pertenencias.grupoId, categoria: pertenencias.categoria })
        .from(pertenencias)
        .where(
          and(
            eq(pertenencias.personaId, personaId),
            lte(pertenencias.desde, fecha),
            or(isNull(pertenencias.hasta), gte(pertenencias.hasta, fecha)),
          ),
        )
        .get()
      if (pertenencia?.categoria === 'activo') {
        resultado.push({
          rol: 'dirigente',
          ambito: { tipo: 'grupo', id: pertenencia.grupoId },
        })
      }

      const filasDeCargos = core.bd
        .select({ cargo: tablaDeCargos.cargo, ambitoId: tablaDeCargos.ambitoId })
        .from(tablaDeCargos)
        .where(
          and(
            eq(tablaDeCargos.personaId, personaId),
            isNull(tablaDeCargos.revocadoEn),
            lte(tablaDeCargos.desde, fecha),
            or(isNull(tablaDeCargos.hasta), gte(tablaDeCargos.hasta, fecha)),
          ),
        )
        .all()
      for (const fila of filasDeCargos) {
        const funcion = rolDelCargo(fila.cargo, fila.ambitoId)
        if (funcion) resultado.push(funcion)
      }

      const filasDeEquipos = core.bd
        .select({ tipo: equipos.tipo, ambitoTipo: equipos.ambitoTipo, ambitoId: equipos.ambitoId })
        .from(integrantesDeEquipo)
        .innerJoin(equipos, eq(equipos.id, integrantesDeEquipo.equipoId))
        .where(
          and(
            eq(integrantesDeEquipo.personaId, personaId),
            isNull(integrantesDeEquipo.revocadoEn),
            lte(integrantesDeEquipo.desde, fecha),
            or(isNull(integrantesDeEquipo.hasta), gte(integrantesDeEquipo.hasta, fecha)),
          ),
        )
        .all()
      for (const fila of filasDeEquipos) {
        resultado.push({
          rol: fila.tipo === 'secretaria' ? 'secretariaDeGrupo' : fila.tipo,
          ambito: {
            tipo: fila.ambitoTipo,
            id: fila.ambitoId,
          },
        })
      }

      return resultado
    },

    async integrarEquipo(actor, datos) {
      const esSecretaria = datos.tipo === 'secretaria'
      const ambitoValido = esSecretaria
        ? datos.ambitoTipo === 'grupo' && datos.ambitoId !== null
        : datos.ambitoTipo === 'diocesis' && datos.ambitoId === null
      const autorizado = esSecretaria
        ? datos.ambitoId !== null && puedeAdministrarPlantelDeGrupo(actor, datos.ambitoId)
        : puedeAdministrarEquiposDiocesanos(actor)
      if (!ambitoValido || !autorizado) throw new CambioDeAutoridadDenegado()

      const persona = core.bd
        .select({ id: personas.id })
        .from(personas)
        .where(eq(personas.id, datos.personaId))
        .get()
      if (!persona) throw new CambioDeAutoridadDenegado()

      if (esSecretaria) {
        const hoy = aFechaDeCalendario(core.reloj.ahora())
        const pertenece = core.bd
          .select({ id: pertenencias.id })
          .from(pertenencias)
          .where(
            and(
              eq(pertenencias.personaId, datos.personaId),
              eq(pertenencias.grupoId, datos.ambitoId as string),
              lte(pertenencias.desde, hoy),
              or(isNull(pertenencias.hasta), gte(pertenencias.hasta, hoy)),
            ),
          )
          .get()
        if (!pertenece) throw new CambioDeAutoridadDenegado()
      }

      const ahora = core.reloj.ahora()
      const equipo = core.bd
        .select({ id: equipos.id })
        .from(equipos)
        .where(
          and(
            eq(equipos.tipo, datos.tipo),
            eq(equipos.ambitoTipo, datos.ambitoTipo),
            datos.ambitoId === null
              ? isNull(equipos.ambitoId)
              : eq(equipos.ambitoId, datos.ambitoId),
          ),
        )
        .get()
      const equipoId = equipo?.id ?? core.nuevoId('equipo')

      const integrante: IntegranteDeEquipo = {
        id: core.nuevoId('integrante_de_equipo'),
        equipoId,
        personaId: datos.personaId,
        desde: datos.desde,
        hasta: datos.hasta ?? null,
        revocadoEn: null,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }

      core.bd.transaction((tx) => {
        if (!equipo) {
          tx.insert(equipos)
            .values({
              id: equipoId,
              tipo: datos.tipo,
              ambitoTipo: datos.ambitoTipo,
              ambitoId: datos.ambitoId,
              creadoEn: ahora,
              actualizadoEn: ahora,
            })
            .run()
        }
        tx.insert(integrantesDeEquipo).values(integrante).run()
        core.auditoria.registrar(
          {
            actorPersonaId: actor.personaId,
            modulo: 'personas',
            accion: `equipo.${datos.tipo}.integrar`,
            elevado: actor.estaElevado,
            grupoId: datos.ambitoTipo === 'grupo' ? datos.ambitoId : null,
            entidadTipo: 'integranteDeEquipo',
            entidadId: integrante.id,
            objetivoPersonaId: datos.personaId,
            resumen: { tipo: datos.tipo, ambitoTipo: datos.ambitoTipo },
          },
          tx,
        )
      })
      return integrante
    },

    async revocarIntegranteDeEquipo(actor, integranteId) {
      const fila = core.bd
        .select({
          personaId: integrantesDeEquipo.personaId,
          tipo: equipos.tipo,
          ambitoTipo: equipos.ambitoTipo,
          ambitoId: equipos.ambitoId,
        })
        .from(integrantesDeEquipo)
        .innerJoin(equipos, eq(equipos.id, integrantesDeEquipo.equipoId))
        .where(eq(integrantesDeEquipo.id, integranteId))
        .get()
      if (!fila) return
      const autorizado =
        fila.ambitoTipo === 'grupo' && fila.ambitoId !== null
          ? puedeAdministrarPlantelDeGrupo(actor, fila.ambitoId)
          : puedeAdministrarEquiposDiocesanos(actor)
      if (!autorizado) throw new CambioDeAutoridadDenegado()

      const ahora = core.reloj.ahora()
      core.bd.transaction((tx) => {
        tx.update(integrantesDeEquipo)
          .set({ revocadoEn: ahora, actualizadoEn: ahora })
          .where(eq(integrantesDeEquipo.id, integranteId))
          .run()
        core.auditoria.registrar(
          {
            actorPersonaId: actor.personaId,
            modulo: 'personas',
            accion: `equipo.${fila.tipo}.revocar`,
            elevado: actor.estaElevado,
            grupoId: fila.ambitoTipo === 'grupo' ? fila.ambitoId : null,
            entidadTipo: 'integranteDeEquipo',
            entidadId: integranteId,
            objetivoPersonaId: fila.personaId,
            resumen: { tipo: fila.tipo, ambitoTipo: fila.ambitoTipo },
          },
          tx,
        )
      })
    },

    async crearPersona(alcance, datos, ingreso) {
      if (!puedeAdministrarPlantelDeGrupo(alcance.actor, ingreso.grupoId)) {
        throw new CambioDeAutoridadDenegado()
      }
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
        domicilio: datos.domicilio.trim(),
        telefonoDeContacto: datos.telefonoDeContacto.trim(),
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
        ambitoId: ingreso.grupoId,
        cargo: datosDelCargo.cargo,
        // El desde del cargo es el de la pertenencia: sin edicion todavia, y
        // pedir la misma fecha una vez por cargo no le sirve a nadie.
        desde: ingreso.desde,
        hasta: datosDelCargo.hasta,
        revocadoEn: null,
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
        core.auditoria.registrar(
          {
            actorPersonaId: alcance.actor.personaId,
            modulo: 'personas',
            accion: 'crearPersona',
            elevado: alcance.actor.estaElevado,
            grupoId: ingreso.grupoId,
            entidadTipo: 'persona',
            entidadId: persona.id,
            objetivoPersonaId: persona.id,
            resumen: { categoria: ingreso.categoria, cargos: ingreso.cargos.map((cargo) => cargo.cargo) },
          },
          tx,
        )
      })

      // Recién creada: todavía no integra ningún equipo.
      return { ...persona, pertenencia, cargos: cargosDeLaPersona, equipos: [] }
    },

    async miembrosDelGrupo(grupoId, fecha) {
      // Vigente ese dia, con las dos puntas inclusivas: la misma regla que
      // estaVigente. No sirve filtrar por `hasta IS NULL`, que es "hoy".
      return core.bd
        .select()
        .from(pertenencias)
        .innerJoin(personas, eq(personas.id, pertenencias.personaId))
        .where(
          and(
            eq(pertenencias.grupoId, grupoId),
            lte(pertenencias.desde, fecha),
            or(isNull(pertenencias.hasta), gte(pertenencias.hasta, fecha)),
          ),
        )
        .all()
        .map((fila) => ({
          persona: fila.personas,
          unidadId: fila.pertenencias.unidadId,
          categoria: fila.pertenencias.categoria,
        }))
    },

    async ocupantesDelCargo(cargo, ambitoId, fecha) {
      // Las dos puntas inclusivas, igual que estaVigente: un mandato que
      // termina el 30 de mayo todavia vale el 30 de mayo. El hasta puede estar
      // en el futuro -es un mandato-, por eso no alcanza con `hasta IS NULL`.
      return core.bd
        .select()
        .from(personas)
        .innerJoin(tablaDeCargos, eq(tablaDeCargos.personaId, personas.id))
        .where(
          and(
            eq(tablaDeCargos.cargo, cargo),
            ambitoId === null
              ? isNull(tablaDeCargos.ambitoId)
              : eq(tablaDeCargos.ambitoId, ambitoId),
            lte(tablaDeCargos.desde, fecha),
            or(isNull(tablaDeCargos.hasta), gte(tablaDeCargos.hasta, fecha)),
            isNull(tablaDeCargos.revocadoEn),
          ),
        )
        .orderBy(tablaDeCargos.desde)
        .all()
        .map((fila) => fila.personas)
    },

    async asignarCargo(datos) {
      await validarAsignacionDeCargo(datos)
      const cargo = construirCargo(datos)
      core.bd.insert(tablaDeCargos).values(cargo).run()
      return cargo
    },

    async asignarCargoComo(actor, datos) {
      const ambito = ambitoDelCargo(datos.cargo)
      const autorizado =
        ambito === 'grupo' && datos.ambitoId !== null
          ? puedeAdministrarPlantelDeGrupo(actor, datos.ambitoId)
          : puedeAdministrarEquiposDiocesanos(actor)
      if (!autorizado) throw new CambioDeAutoridadDenegado()

      // La validacion es async -consulta estructura-, asi que corre antes de
      // la transaccion: adentro de una transaccion de better-sqlite3 solo hay
      // lugar para trabajo sincrono.
      await validarAsignacionDeCargo(datos)
      const cargo = construirCargo(datos)
      core.bd.transaction((tx) => {
        tx.insert(tablaDeCargos).values(cargo).run()
        core.auditoria.registrar(
          {
            actorPersonaId: actor.personaId,
            modulo: 'personas',
            accion: `cargo.${datos.cargo}.asignar`,
            elevado: actor.estaElevado,
            grupoId: ambito === 'grupo' ? datos.ambitoId : null,
            entidadTipo: 'cargo',
            entidadId: cargo.id,
            objetivoPersonaId: datos.personaId,
            resumen: { cargo: datos.cargo, ambito },
          },
          tx,
        )
      })
      return cargo
    },

    async revocarCargo(actor, cargoId) {
      const fila = core.bd
        .select({
          personaId: tablaDeCargos.personaId,
          ambitoId: tablaDeCargos.ambitoId,
          cargo: tablaDeCargos.cargo,
        })
        .from(tablaDeCargos)
        .where(eq(tablaDeCargos.id, cargoId))
        .get()
      if (!fila) return
      const ambito = ambitoDelCargo(fila.cargo)
      const autorizado =
        ambito === 'grupo' && fila.ambitoId !== null
          ? puedeAdministrarPlantelDeGrupo(actor, fila.ambitoId)
          : puedeAdministrarEquiposDiocesanos(actor)
      if (!autorizado) throw new CambioDeAutoridadDenegado()

      const ahora = core.reloj.ahora()
      core.bd.transaction((tx) => {
        tx.update(tablaDeCargos)
          .set({ revocadoEn: ahora, actualizadoEn: ahora })
          .where(eq(tablaDeCargos.id, cargoId))
          .run()
        core.auditoria.registrar(
          {
            actorPersonaId: actor.personaId,
            modulo: 'personas',
            accion: `cargo.${fila.cargo}.revocar`,
            elevado: actor.estaElevado,
            grupoId: ambito === 'grupo' ? fila.ambitoId : null,
            entidadTipo: 'cargo',
            entidadId: cargoId,
            objetivoPersonaId: fila.personaId,
            resumen: { cargo: fila.cargo, ambito },
          },
          tx,
        )
      })
    },

    async jefesDeGrupos(_alcance, grupoIds, fecha) {
      if (grupoIds.length === 0) return []
      return core.bd
        .select({
          grupoId: tablaDeCargos.ambitoId,
          personaId: personas.id,
          nombres: personas.nombres,
          apellidos: personas.apellidos,
        })
        .from(tablaDeCargos)
        .innerJoin(personas, eq(personas.id, tablaDeCargos.personaId))
        .where(
          and(
            eq(tablaDeCargos.cargo, 'jefeDeGrupo'),
            inArray(tablaDeCargos.ambitoId, [...grupoIds]),
            isNull(tablaDeCargos.revocadoEn),
            lte(tablaDeCargos.desde, fecha),
            or(isNull(tablaDeCargos.hasta), gte(tablaDeCargos.hasta, fecha)),
          ),
        )
        .all()
        .flatMap((fila) => (fila.grupoId === null ? [] : [{ ...fila, grupoId: fila.grupoId }]))
    },

    async listarPersonas(alcance, grupoId) {
      if (!puedeVerPersonasDelGrupo(alcance, grupoId)) return []
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
        .where(eq(tablaDeCargos.ambitoId, grupoId))
        .all()

      // Los equipos de ese grupo -hoy sólo Secretaría- más los diocesanos de
      // su gente: los dos son plantel para quien mira la pantalla. El filtro de
      // ámbito va en el WHERE: sin él entraban las Secretarías de los otros
      // catorce grupos, y la pantalla las dibujaba como si fueran de éste.
      const filasDeEquipos = core.bd
        .select({ integrante: integrantesDeEquipo, tipo: equipos.tipo })
        .from(integrantesDeEquipo)
        .innerJoin(equipos, eq(equipos.id, integrantesDeEquipo.equipoId))
        .where(
          and(
            isNull(integrantesDeEquipo.revocadoEn),
            or(
              eq(equipos.ambitoTipo, 'diocesis'),
              and(eq(equipos.ambitoTipo, 'grupo'), eq(equipos.ambitoId, grupoId)),
            ),
          ),
        )
        .all()

      const cargosPorPersona = new Map<string, Cargo[]>()
      for (const cargo of filasDeCargos) {
        const suyos = cargosPorPersona.get(cargo.personaId) ?? []
        suyos.push(cargo)
        cargosPorPersona.set(cargo.personaId, suyos)
      }

      const equiposPorPersona = new Map<string, (IntegranteDeEquipo & { tipo: TipoDeEquipo })[]>()
      for (const { integrante, tipo } of filasDeEquipos) {
        const suyos = equiposPorPersona.get(integrante.personaId) ?? []
        suyos.push({ ...integrante, tipo })
        equiposPorPersona.set(integrante.personaId, suyos)
      }

      return filas
        .map((fila) => ({
          ...fila.personas,
          pertenencia: fila.pertenencias,
          cargos: cargosPorPersona.get(fila.personas.id) ?? [],
          equipos: equiposPorPersona.get(fila.personas.id) ?? [],
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
  return servicio
}
