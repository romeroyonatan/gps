import type { Core } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Estructura } from '@gps/estructura/dominio'
import type { MiembroActivo, Personas } from '@gps/personas/dominio'
import { and, desc, eq, inArray, lt, max } from 'drizzle-orm'
import type { Afiliado, Declaracion } from '../dominio/modelos'
import { fechasOrdinariasDelPeriodo, periodoDe } from '../dominio/periodos'
import { validarFecha } from '../dominio/validaciones'
import { afiliados, declaraciones } from './tablas'

/** La fecha de la declaracion no sirve: futura, mal formada, o anterior a la
 *  ultima ya emitida. Un solo tipo y no tres clases: las tres condiciones son
 *  sobre el mismo campo y el consumidor las trata igual. */
export class FechaInvalida extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'FechaInvalida'
  }
}

/** Se pidio una declaracion extraordinaria de un grupo que no tiene a nadie
 *  activo, o que esta cerrado. */
export class NadaQueDeclarar extends Error {
  constructor(grupoId: string) {
    super('El grupo no tiene miembros activos para declarar, o está cerrado.')
    this.name = 'NadaQueDeclarar'
    this.grupoId = grupoId
  }
  readonly grupoId: string
}

/** El grupo ya tiene una declaracion con la fecha de hoy: la ordinaria que
 *  acaba de emitir el barrido, o una extraordinaria que ya apreto alguien. Lo
 *  impide el UNIQUE(fecha, grupo_id). */
export class YaDeclaroHoy extends Error {
  constructor(grupoId: string) {
    super('Este grupo ya declaró su afiliación hoy.')
    this.name = 'YaDeclaroHoy'
    this.grupoId = grupoId
  }
  readonly grupoId: string
}

export interface ServicioDeAfiliacion {
  /** Fotografia a los miembros activos del dia `fecha`. Sin `grupoId` declara
   *  todos los grupos abiertos con al menos un activo; con `grupoId`, ese solo.
   *  Devuelve una declaracion por grupo, salteando los grupos que ya tienen
   *  una con esa fecha. */
  declarar(fecha: string, grupoId?: string): Promise<readonly Declaracion[]>

  /** La extraordinaria: fotografia ese grupo con la fecha de hoy. Existe aparte
   *  de `declarar` porque el resolver no puede armar la fecha: Context lleva
   *  `actor` y nada mas, asi que al reloj solo lo alcanza el servicio. */
  declararExtraordinaria(grupoId: string): Promise<Declaracion>

  /** La nomina de esa declaracion, ordenada por apellido. */
  listarAfiliados(declaracionId: string): Promise<readonly Afiliado[]>

  /** Las declaraciones de ese grupo, de la mas reciente a la mas vieja.
   *
   *  El grupo es obligatorio: la pantalla que existe es la del grupo. Se vuelve
   *  opcional el dia que haya una vista de asociacion, que es de Tesoreria. */
  listarDeclaraciones(grupoId: string): Promise<readonly Declaracion[]>

  /** Los de esa nomina que no aparecen en ninguna declaracion anterior del
   *  mismo periodo: lo que Tesoreria va a cobrar. */
  listarACobrar(declaracionId: string): Promise<readonly Afiliado[]>

  /** Los que ya tienen afiliacion en ese periodo, de entre los que se
   *  preguntan. Devuelve el subconjunto afiliado y no un mapa de booleanos: es
   *  la misma informacion y el consumidor la usa igual, sin construir una
   *  entrada por cada persona preguntada. */
  afiliadosEn(periodo: number, personaIds: readonly string[]): Promise<ReadonlySet<string>>

  /** Declara toda fecha ordinaria del periodo corriente que ya paso, en orden,
   *  para los grupos que todavia no la tienen. Idempotente, y por grupo: si un
   *  solo grupo ya declaro ese dia, los otros catorce declaran igual. */
  declararPendientes(): Promise<readonly Declaracion[]>
}

/** El orden alfabetico lo hace Intl y no un ORDER BY: SQLite compara bytes, asi
 *  que "Ávila" caeria despues de "Zaballa". Es el mismo criterio que
 *  listarPersonas, y por la misma razon. */
const alfabeto = new Intl.Collator('es')

/** `personas` y `estructura` entran por el constructor y no por el contexto:
 *  son dependencias declaradas del modulo, que la raiz de composicion pasa ya
 *  construidas. Asi el servicio las puede usar sin saber si hay un request
 *  encima, que es lo que le permite correr dentro del telefono. */
export function crearServicioDeAfiliacion(
  core: Core,
  personas: Personas,
  estructura: Estructura,
): ServicioDeAfiliacion {
  /** La fecha de la declaracion mas reciente de toda la asociacion, o null si
   *  no hay ninguna. Global y no por grupo a proposito: ver validarFecha. */
  function ultimaFecha(): string | null {
    return (
      core.bd
        .select({ fecha: max(declaraciones.fecha) })
        .from(declaraciones)
        .get()?.fecha ?? null
    )
  }

  async function listarAfiliados(declaracionId: string): Promise<readonly Afiliado[]> {
    return core.bd
      .select()
      .from(afiliados)
      .where(eq(afiliados.declaracionId, declaracionId))
      .all()
      .sort(
        (uno, otro) =>
          alfabeto.compare(uno.apellidos, otro.apellidos) ||
          alfabeto.compare(uno.nombres, otro.nombres),
      )
  }

  /** Los grupos que ya tienen una declaracion con esa fecha. */
  function yaDeclararon(fecha: string): ReadonlySet<string> {
    return new Set(
      core.bd
        .select({ grupoId: declaraciones.grupoId })
        .from(declaraciones)
        .where(eq(declaraciones.fecha, fecha))
        .all()
        .map((fila) => fila.grupoId),
    )
  }

  async function declarar(fecha: string, grupoId?: string): Promise<readonly Declaracion[]> {
    const abiertos = await estructura.gruposAbiertosEn(fecha)
    const activos = await personas.miembrosActivos(fecha)

    const porGrupo = new Map<string, MiembroActivo[]>()
    for (const activo of activos) {
      // Un grupo cerrado no declara. Un grupo que cerro despues de `fecha` si:
      // existia ese dia, y la nomina de ese dia es legitima.
      if (!abiertos.has(activo.grupoId)) continue
      if (grupoId !== undefined && activo.grupoId !== grupoId) continue
      const suyos = porGrupo.get(activo.grupoId) ?? []
      suyos.push(activo)
      porGrupo.set(activo.grupoId, suyos)
    }
    // La idempotencia es por grupo y no por fecha: una ordinaria son quince
    // declaraciones de la misma fecha, y que un grupo ya la tenga no dice nada
    // de los otros catorce. Se saltean aca y no se deja que avise el UNIQUE
    // porque los quince entran en una sola transaccion: el UNIQUE tumbaria el
    // lote entero. Asi vuelve a ser la red que la spec dice que es, en vez de
    // el que corta.
    for (const declarado of yaDeclararon(fecha)) porGrupo.delete(declarado)
    // Los grupos vacios no generan nomina. Ademas de ser lo obvio, es lo que
    // deja a afiliacion sin tener que pedirle la lista de grupos a estructura:
    // sale de miembrosActivos.
    if (porGrupo.size === 0) return []

    // La fecha se valida recien aca, cuando ya se sabe que hay algo que
    // escribir. Es lo que le deja al barrido distinguir la perdida real del
    // caso normal: una ordinaria ya emitida por todos sus grupos se saltea
    // arriba y nunca llega a chocar contra la regla de §4.5, aunque despues
    // haya una extraordinaria con fecha posterior. Si en cambio queda un grupo
    // sin declarar, la fecha se valida, el rechazo llega y el barrido lo
    // loguea, que es exactamente cuando hay una nomina que se pierde.
    const motivo = validarFecha(fecha, ultimaFecha(), aFechaDeCalendario(core.reloj.ahora()))
    if (motivo !== null) throw new FechaInvalida(motivo)

    const ahora = core.reloj.ahora()
    const periodo = periodoDe(fecha)
    const nuevas: Declaracion[] = []
    const filas: (typeof afiliados.$inferInsert)[] = []

    for (const [suGrupo, miembros] of porGrupo) {
      const declaracion: Declaracion = {
        id: core.nuevoId('declaracion'),
        grupoId: suGrupo,
        fecha,
        periodo,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      nuevas.push(declaracion)
      for (const { persona } of miembros) {
        // Nombre y documento se copian, no se referencian: la nomina es un
        // documento contable y tiene que seguir leyendose como se leia ese dia.
        filas.push({
          declaracionId: declaracion.id,
          personaId: persona.id,
          tipoDeDocumento: persona.tipoDeDocumento,
          numeroDeDocumento: persona.numeroDeDocumento,
          nombres: persona.nombres,
          apellidos: persona.apellidos,
        })
      }
    }

    // Las dos escrituras en una transaccion: una declaracion sin nomina seria
    // una deuda de cero que nadie podria distinguir de un error.
    core.bd.transaction((tx) => {
      tx.insert(declaraciones).values(nuevas).run()
      tx.insert(afiliados).values(filas).run()
    })

    return nuevas
  }

  async function declararPendientes(): Promise<readonly Declaracion[]> {
    const hoy = aFechaDeCalendario(core.reloj.ahora())
    const nuevas: Declaracion[] = []
    // Sin pre-chequeo por fecha: el salteo por grupo de `declarar` ya hace que
    // una fecha ya declarada por todos devuelva [] sin escribir nada ni validar
    // nada. Un pre-chequeo por fecha sola daria por hecha la ordinaria de los
    // quince grupos con que la tuviera uno.
    for (const fecha of fechasOrdinariasDelPeriodo(periodoDe(hoy))) {
      if (fecha > hoy) continue
      try {
        nuevas.push(...(await declarar(fecha)))
      } catch (error) {
        // Llegar aca significa que quedaban grupos sin declarar y no se pudo:
        // una ordinaria vencida que quedo antes de una extraordinaria ya
        // emitida. Es una nomina que se pierde, asi que se loguea. En la
        // practica no deberia pasar -declararExtraordinaria vacia las
        // pendientes antes de declarar- pero si pasara, se loguea en vez de
        // tumbar el arranque del servidor entero.
        if (error instanceof FechaInvalida) {
          core.logger.error('No se pudo declarar una afiliacion ordinaria vencida', {
            fecha,
            motivo: error.message,
          })
          continue
        }
        throw error
      }
    }
    return nuevas
  }

  return {
    declarar,
    listarAfiliados,
    declararPendientes,

    async declararExtraordinaria(grupoId) {
      // Primero las ordinarias vencidas. Una extraordinaria de hoy dejaria a
      // una ordinaria sin emitir bloqueada para siempre por la regla de §4.5,
      // y el bloqueo no se puede deshacer: emitirla antes cierra el caso en la
      // fuente en vez de dejarlo en un log que nadie mira.
      await declararPendientes()

      const hoy = aFechaDeCalendario(core.reloj.ahora())
      const [declaracion] = await declarar(hoy, grupoId)
      if (declaracion) return declaracion
      // Sin declaracion hay dos motivos distintos, y el dirigente los
      // distingue: o el grupo ya declaro hoy -quiza recien, en el barrido de
      // arriba- o no tiene a nadie que declarar.
      if (yaDeclararon(hoy).has(grupoId)) throw new YaDeclaroHoy(grupoId)
      throw new NadaQueDeclarar(grupoId)
    },

    async listarDeclaraciones(grupoId) {
      return core.bd
        .select()
        .from(declaraciones)
        .where(eq(declaraciones.grupoId, grupoId))
        .orderBy(desc(declaraciones.fecha))
        .all()
    },

    async listarACobrar(declaracionId) {
      const declaracion = core.bd
        .select({ fecha: declaraciones.fecha, periodo: declaraciones.periodo })
        .from(declaraciones)
        .where(eq(declaraciones.id, declaracionId))
        .get()
      if (!declaracion) return []

      // El anti-join NO filtra por grupo, y eso no es un olvido: la afiliacion
      // es de la persona con la asociacion, no del vinculo con un grupo. Quien
      // se mudo en julio esta en la nomina de noviembre de su grupo nuevo y no
      // se le cobra, porque el viejo ya pago por ella en mayo. Agregar aca un
      // eq(declaraciones.grupoId, ...) convertiria el modelo en el que la spec
      // descarto en §2.
      const previas = core.bd
        .select({ personaId: afiliados.personaId })
        .from(afiliados)
        .innerJoin(declaraciones, eq(declaraciones.id, afiliados.declaracionId))
        .where(
          and(
            eq(declaraciones.periodo, declaracion.periodo),
            lt(declaraciones.fecha, declaracion.fecha),
          ),
        )
        .all()

      const cubiertos = new Set(previas.map((fila) => fila.personaId))
      return (await listarAfiliados(declaracionId)).filter(
        (afiliado) => !cubiertos.has(afiliado.personaId),
      )
    },

    async afiliadosEn(periodo, personaIds) {
      // Sin ids no hay nada que preguntar, y un inArray vacio en SQL es un
      // WHERE que no compila en algunos dialectos.
      if (personaIds.length === 0) return new Set<string>()

      const filas = core.bd
        .select({ personaId: afiliados.personaId })
        .from(afiliados)
        .innerJoin(declaraciones, eq(declaraciones.id, afiliados.declaracionId))
        .where(
          and(eq(declaraciones.periodo, periodo), inArray(afiliados.personaId, [...personaIds])),
        )
        .all()

      return new Set(filas.map((fila) => fila.personaId))
    },
  }
}
