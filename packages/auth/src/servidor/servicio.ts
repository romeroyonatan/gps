import type { Actor, Core } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import {
  type Personas,
  puedeAdministrarEquiposDiocesanos,
  puedeAdministrarPlantelDeGrupo,
} from '@gps/personas/dominio'
import { and, eq, gt, isNull, ne } from 'drizzle-orm'
import type { ProveedorDeIdentidad } from '../dominio/modelos'
import type { Auth } from '../dominio/publico'
import { despuesDe } from '../dominio/tiempo'
import type { Plataforma, ProveedorOidc } from './oidc'
import {
  administradorDelSistema,
  eventosDeSeguridad,
  identidadesExternas,
  invitaciones,
  sesiones,
} from './tablas'

const DURACION_DE_SESION = 30 * 24 * 60 * 60 * 1000
/** Cuánto vive el sello de la transacción de login entre iniciar y
 *  completar: el tiempo de ida y vuelta a Google o Apple, no una sesión. */
const DURACION_DE_TRANSACCION = 10 * 60 * 1000
const DURACION_DE_INVITACION = 7 * 24 * 60 * 60 * 1000
const DURACION_DE_ELEVACION = 10 * 60 * 1000

export class IdentidadInvalida extends Error {
  constructor() {
    super('La identidad no existe o está desactivada.')
    this.name = 'IdentidadInvalida'
  }
}

/** El proveedor validó al usuario, pero nadie vinculó todavía ese `subject` a
 *  una persona: hace falta una invitación de activación (ver tareas 4.x), no
 *  un login espontáneo. */
export class IdentidadNoVinculada extends Error {
  constructor() {
    super('Esta cuenta todavía no está activada. Pedí una invitación.')
    this.name = 'IdentidadNoVinculada'
  }
}

export class TransaccionDeLoginInvalida extends Error {
  constructor(motivo: string) {
    super(`No se pudo completar el inicio de sesión: ${motivo}.`)
    this.name = 'TransaccionDeLoginInvalida'
  }
}

/** El `subject` ya pertenece, activo, a otra persona: no se reasigna nunca,
 *  ni siquiera cuando quien vincula tiene sesión válida. */
export class ProveedorYaVinculado extends Error {
  constructor() {
    super('Esa cuenta ya está vinculada a otra persona.')
    this.name = 'ProveedorYaVinculado'
  }
}

export class AutoridadInsuficiente extends Error {
  constructor() {
    super('No podés invitar ni recuperar a esa persona.')
    this.name = 'AutoridadInsuficiente'
  }
}

export class InvitacionInvalida extends Error {
  constructor(motivo: string) {
    super(`La invitación no es válida: ${motivo}.`)
    this.name = 'InvitacionInvalida'
  }
}

export class ElevacionDenegada extends Error {
  constructor() {
    super('Sólo la persona administradora designada puede elevarse.')
    this.name = 'ElevacionDenegada'
  }
}

interface TransaccionDeLogin {
  readonly proveedor: ProveedorDeIdentidad
  readonly plataforma: Plataforma
  readonly redirectUri: string
  readonly state: string
  readonly nonce: string
  readonly codeVerifier: string
  readonly creadoEn: number
}

export interface ServicioDeAuth extends Auth {
  crearSesionParaIdentidad(identidadId: string): Promise<{ secreto: string; sesionId: string }>
  revocarSesion(sesionId: string): Promise<void>

  /** Arranca un login con Google o Apple. La transacción sellada viaja y
   *  vuelve por el cliente -cookie o parámetro de estado-: el servidor no
   *  guarda nada entre esta llamada y `completarLogin`. */
  iniciarLogin(
    proveedor: ProveedorDeIdentidad,
    plataforma: Plataforma,
    redirectUri: string,
  ): { url: string; transaccion: string }

  /** Cierra el login: valida la transacción, intercambia el código y, si el
   *  `subject` ya está vinculado a una persona, abre una sesión normal.
   *  Lanza `IdentidadNoVinculada` si nadie activó esa cuenta todavía. */
  completarLogin(datos: {
    transaccion: string
    stateRecibido: string
    code: string
  }): Promise<{ secreto: string; sesionId: string }>

  /** Agrega un segundo proveedor a una persona ya autenticada. Exige sesión
   *  reciente -la llama quien orquesta el request, con la sesión ya resuelta-
   *  y rechaza un `subject` que ya esté vinculado, activo, a otra persona. */
  vincularProveedor(
    personaId: string,
    datos: { transaccion: string; stateRecibido: string; code: string },
  ): Promise<void>

  /** Reemplaza autónomamente un proveedor ya vinculado por otro, usando la
   *  sesión con la que se autenticó el segundo: no hace falta invitación y no
   *  toca cargos, equipos ni historial -viven en `personas`, no acá-. */
  reemplazarProveedorPropio(
    personaId: string,
    proveedorAReemplazar: ProveedorDeIdentidad,
    datos: { transaccion: string; stateRecibido: string; code: string },
  ): Promise<void>

  /** Emite una invitación de activación o de recuperación. Sólo puede hacerlo
   *  quien administra el grupo, la diócesis, o el administrador elevado. El
   *  secreto vuelve en claro una única vez: sólo su hash se persiste. */
  emitirInvitacion(
    actor: Actor,
    datos: {
      tipo: 'activacion' | 'recuperacion'
      personaId: string
      proveedorAReemplazar?: ProveedorDeIdentidad
    },
  ): Promise<{ secreto: string; invitacionId: string }>

  revocarInvitacion(actor: Actor, invitacionId: string): Promise<void>

  /** Consume una invitación de activación: vincula el proveedor nuevo a la
   *  persona de la invitación y abre sesión. */
  consumirActivacion(
    secreto: string,
    datos: { transaccion: string; stateRecibido: string; code: string },
  ): Promise<{ secreto: string; sesionId: string }>

  /** Consume una invitación de recuperación: en una única transacción,
   *  desactiva la identidad anterior de ese proveedor, vincula la nueva y
   *  revoca todas las sesiones existentes de la persona. */
  consumirRecuperacion(
    secreto: string,
    datos: { transaccion: string; stateRecibido: string; code: string },
  ): Promise<{ secreto: string; sesionId: string }>

  /** Eleva una sesión ordinaria a `sudo` por diez minutos, exigiendo repetir
   *  la autenticación de un proveedor ya vinculado a la misma persona. Sólo
   *  la persona administradora designada puede elevarse: ser administrador no
   *  alcanza sin volver a probar identidad, y nadie más puede hacerlo aunque
   *  conozca la sesión. */
  elevarSesion(
    sesionId: string,
    datos: { transaccion: string; stateRecibido: string; code: string },
  ): Promise<void>

  /** Audita una escritura ejecutada con alcance global. La llama el
   *  interceptor de GraphQL, no un resolver: separar la escritura de dominio
   *  de su auditoría evita que un modulo tenga que acordarse de auditarse. */
  auditarEscrituraElevada(personaId: string, operacion: string): void

  /** Reemplaza a la persona administradora del sistema. No hay mutation
   *  pública equivalente a propósito: es la válvula de emergencia -documentada
   *  en el diseño §8- para cuando la única administradora perdió todas sus
   *  identidades, y la ejecuta quien tiene acceso al servidor, no un actor de
   *  GraphQL. */
  asignarAdministrador(personaId: string): Promise<void>
}

export function crearServicioDeAuth(
  core: Core,
  personas: Personas,
  proveedores: Partial<Record<ProveedorDeIdentidad, ProveedorOidc>>,
): ServicioDeAuth {
  function proveedorDe(nombre: ProveedorDeIdentidad): ProveedorOidc {
    const proveedor = proveedores[nombre]
    if (!proveedor) throw new TransaccionDeLoginInvalida(`${nombre} no está configurado`)
    return proveedor
  }

  function abrirTransaccion(transaccion: string): TransaccionDeLogin {
    const sello = JSON.parse(transaccion) as { datos: string; sello: string; claveId: string }
    if (!core.sellador.verificar(sello.datos, { sello: sello.sello, claveId: sello.claveId })) {
      throw new TransaccionDeLoginInvalida('el enlace no es válido')
    }
    const datos = JSON.parse(sello.datos) as TransaccionDeLogin
    if (core.reloj.ahora().getTime() - datos.creadoEn > DURACION_DE_TRANSACCION) {
      throw new TransaccionDeLoginInvalida('el enlace venció')
    }
    return datos
  }

  async function resolverSubject(datos: {
    transaccion: string
    stateRecibido: string
    code: string
  }): Promise<{ proveedor: ProveedorDeIdentidad; subject: string }> {
    const abierta = abrirTransaccion(datos.transaccion)
    if (abierta.state !== datos.stateRecibido) {
      throw new TransaccionDeLoginInvalida('el estado no coincide')
    }
    const { subject } = await proveedorDe(abierta.proveedor).intercambiarCodigo({
      code: datos.code,
      codeVerifier: abierta.codeVerifier,
      nonceEsperado: abierta.nonce,
      redirectUri: abierta.redirectUri,
      plataforma: abierta.plataforma,
    })
    return { proveedor: abierta.proveedor, subject }
  }

  function crearSesion(
    identidadId: string,
    personaId: string,
  ): { secreto: string; sesionId: string } {
    const ahora = core.reloj.ahora()
    const secreto = core.nuevoSecreto()
    const sesionId = core.nuevoId('sesion')
    core.bd
      .insert(sesiones)
      .values({
        id: sesionId,
        personaId,
        identidadId,
        hashDelSecreto: core.hash(secreto),
        expiraEn: despuesDe(ahora, DURACION_DE_SESION),
        revocadaEn: null,
        elevadaHasta: null,
        creadoEn: ahora,
        actualizadoEn: ahora,
      })
      .run()
    return { secreto, sesionId }
  }

  async function puedeAdministrarA(actor: Actor, personaObjetivoId: string): Promise<boolean> {
    if (actor.estaElevado) return true
    const hoy = aFechaDeCalendario(core.reloj.ahora())
    const grupoId = await personas.grupoVigenteDe(personaObjetivoId, hoy)
    if (grupoId && puedeAdministrarPlantelDeGrupo(actor, grupoId)) return true
    return puedeAdministrarEquiposDiocesanos(actor)
  }

  function esAdministrador(personaId: string): boolean {
    return (
      core.bd
        .select({ personaId: administradorDelSistema.personaId })
        .from(administradorDelSistema)
        .where(eq(administradorDelSistema.personaId, personaId))
        .get() !== undefined
    )
  }

  function registrarEvento(
    tipo: string,
    actorPersonaId: string | null,
    objetivoPersonaId: string | null,
    detalles: Record<string, unknown>,
  ): void {
    core.bd
      .insert(eventosDeSeguridad)
      .values({
        id: core.nuevoId('evento_de_seguridad'),
        tipo,
        actorPersonaId,
        objetivoPersonaId,
        detalles: JSON.stringify(detalles),
        creadoEn: core.reloj.ahora(),
      })
      .run()
  }

  return {
    async esAdministradorDesignado(personaId) {
      return esAdministrador(personaId)
    },

    iniciarLogin(proveedor, plataforma, redirectUri) {
      const inicio = proveedorDe(proveedor).iniciar(redirectUri, plataforma)
      const datos: TransaccionDeLogin = {
        proveedor,
        plataforma,
        redirectUri,
        state: inicio.state,
        nonce: inicio.nonce,
        codeVerifier: inicio.codeVerifier,
        creadoEn: core.reloj.ahora().getTime(),
      }
      const serializados = JSON.stringify(datos)
      const sello = core.sellador.sellar(serializados)
      return {
        url: inicio.url,
        transaccion: JSON.stringify({ datos: serializados, ...sello }),
      }
    },

    async completarLogin(datos) {
      const { proveedor, subject } = await resolverSubject(datos)
      const identidad = core.bd
        .select({ id: identidadesExternas.id, personaId: identidadesExternas.personaId })
        .from(identidadesExternas)
        .where(
          and(
            eq(identidadesExternas.proveedor, proveedor),
            eq(identidadesExternas.subject, subject),
            isNull(identidadesExternas.desactivadaEn),
          ),
        )
        .get()
      if (!identidad || !(await personas.personaExiste(identidad.personaId))) {
        throw new IdentidadNoVinculada()
      }
      return crearSesion(identidad.id, identidad.personaId)
    },

    async vincularProveedor(personaId, datos) {
      const { proveedor, subject } = await resolverSubject(datos)
      const enUso = core.bd
        .select({ id: identidadesExternas.id })
        .from(identidadesExternas)
        .where(
          and(
            eq(identidadesExternas.proveedor, proveedor),
            eq(identidadesExternas.subject, subject),
            isNull(identidadesExternas.desactivadaEn),
            ne(identidadesExternas.personaId, personaId),
          ),
        )
        .get()
      if (enUso) throw new ProveedorYaVinculado()

      const ahora = core.reloj.ahora()
      core.bd
        .insert(identidadesExternas)
        .values({
          id: core.nuevoId('identidad'),
          personaId,
          proveedor,
          subject,
          desactivadaEn: null,
          creadoEn: ahora,
          actualizadoEn: ahora,
        })
        .run()
      registrarEvento('identidad.vincular', personaId, personaId, { proveedor })
    },

    async reemplazarProveedorPropio(personaId, proveedorAReemplazar, datos) {
      const { proveedor, subject } = await resolverSubject(datos)
      if (proveedor !== proveedorAReemplazar) {
        throw new TransaccionDeLoginInvalida('el proveedor no coincide con el que se reemplaza')
      }
      const enUso = core.bd
        .select({ id: identidadesExternas.id })
        .from(identidadesExternas)
        .where(
          and(
            eq(identidadesExternas.proveedor, proveedor),
            eq(identidadesExternas.subject, subject),
            isNull(identidadesExternas.desactivadaEn),
            ne(identidadesExternas.personaId, personaId),
          ),
        )
        .get()
      if (enUso) throw new ProveedorYaVinculado()

      const ahora = core.reloj.ahora()
      core.bd.transaction((tx) => {
        tx.update(identidadesExternas)
          .set({ desactivadaEn: ahora, actualizadoEn: ahora })
          .where(
            and(
              eq(identidadesExternas.personaId, personaId),
              eq(identidadesExternas.proveedor, proveedorAReemplazar),
              isNull(identidadesExternas.desactivadaEn),
            ),
          )
          .run()
        tx.insert(identidadesExternas)
          .values({
            id: core.nuevoId('identidad'),
            personaId,
            proveedor,
            subject,
            desactivadaEn: null,
            creadoEn: ahora,
            actualizadoEn: ahora,
          })
          .run()
      })
      registrarEvento('identidad.reemplazar', personaId, personaId, { proveedor })
    },

    async emitirInvitacion(actor, datos) {
      if (!(await puedeAdministrarA(actor, datos.personaId))) throw new AutoridadInsuficiente()
      if (datos.tipo === 'recuperacion' && !datos.proveedorAReemplazar) {
        throw new InvitacionInvalida('una recuperación necesita el proveedor a reemplazar')
      }

      const ahora = core.reloj.ahora()
      const secreto = core.nuevoSecreto()
      const invitacionId = core.nuevoId('invitacion')
      core.bd
        .insert(invitaciones)
        .values({
          id: invitacionId,
          tipo: datos.tipo,
          personaId: datos.personaId,
          proveedorAReemplazar:
            datos.tipo === 'recuperacion' ? (datos.proveedorAReemplazar ?? null) : null,
          hashDelSecreto: core.hash(secreto),
          emitidaPor: actor.personaId,
          expiraEn: despuesDe(ahora, DURACION_DE_INVITACION),
          consumidaEn: null,
          revocadaEn: null,
          creadoEn: ahora,
          actualizadoEn: ahora,
        })
        .run()
      registrarEvento(`invitacion.${datos.tipo}.emitir`, actor.personaId, datos.personaId, {
        invitacionId,
      })
      return { secreto, invitacionId }
    },

    async revocarInvitacion(actor, invitacionId) {
      const fila = core.bd
        .select({ personaId: invitaciones.personaId })
        .from(invitaciones)
        .where(eq(invitaciones.id, invitacionId))
        .get()
      if (!fila) return
      if (!(await puedeAdministrarA(actor, fila.personaId))) throw new AutoridadInsuficiente()

      const ahora = core.reloj.ahora()
      core.bd
        .update(invitaciones)
        .set({ revocadaEn: ahora, actualizadoEn: ahora })
        .where(eq(invitaciones.id, invitacionId))
        .run()
      registrarEvento('invitacion.revocar', actor.personaId, fila.personaId, { invitacionId })
    },

    async consumirActivacion(secreto, datos) {
      const ahora = core.reloj.ahora()
      const invitacion = core.bd
        .select({
          id: invitaciones.id,
          personaId: invitaciones.personaId,
          expiraEn: invitaciones.expiraEn,
          consumidaEn: invitaciones.consumidaEn,
          revocadaEn: invitaciones.revocadaEn,
        })
        .from(invitaciones)
        .where(
          and(
            eq(invitaciones.hashDelSecreto, core.hash(secreto)),
            eq(invitaciones.tipo, 'activacion'),
          ),
        )
        .get()
      if (
        !invitacion ||
        invitacion.consumidaEn !== null ||
        invitacion.revocadaEn !== null ||
        invitacion.expiraEn <= ahora
      ) {
        throw new InvitacionInvalida('venció, ya se usó o no existe')
      }

      const { proveedor, subject } = await resolverSubject(datos)
      const enUso = core.bd
        .select({ id: identidadesExternas.id })
        .from(identidadesExternas)
        .where(
          and(
            eq(identidadesExternas.proveedor, proveedor),
            eq(identidadesExternas.subject, subject),
            isNull(identidadesExternas.desactivadaEn),
          ),
        )
        .get()
      if (enUso) throw new ProveedorYaVinculado()

      const identidadId = core.nuevoId('identidad')
      // Un doble consumo concurrente pierde la carrera del UPDATE ... WHERE
      // consumida_en IS NULL: `Bd.run()` no expone `changes` -es unknown a
      // proposito, para no atarse al driver-, asi que quien perdio se entera
      // releyendo: si el valor que quedo no es el suyo, no gano la carrera.
      const consumida = core.bd.transaction((tx) => {
        tx.update(invitaciones)
          .set({ consumidaEn: ahora, actualizadoEn: ahora })
          .where(and(eq(invitaciones.id, invitacion.id), isNull(invitaciones.consumidaEn)))
          .run()
        const verificacion = tx
          .select({ consumidaEn: invitaciones.consumidaEn })
          .from(invitaciones)
          .where(eq(invitaciones.id, invitacion.id))
          .get()
        if (verificacion?.consumidaEn?.getTime() !== ahora.getTime()) return false
        tx.insert(identidadesExternas)
          .values({
            id: identidadId,
            personaId: invitacion.personaId,
            proveedor,
            subject,
            desactivadaEn: null,
            creadoEn: ahora,
            actualizadoEn: ahora,
          })
          .run()
        return true
      })
      if (!consumida) throw new InvitacionInvalida('venció, ya se usó o no existe')

      registrarEvento(
        'invitacion.activacion.consumir',
        invitacion.personaId,
        invitacion.personaId,
        {
          invitacionId: invitacion.id,
          proveedor,
        },
      )
      return crearSesion(identidadId, invitacion.personaId)
    },

    async consumirRecuperacion(secreto, datos) {
      const ahora = core.reloj.ahora()
      const invitacion = core.bd
        .select({
          id: invitaciones.id,
          personaId: invitaciones.personaId,
          proveedorAReemplazar: invitaciones.proveedorAReemplazar,
          expiraEn: invitaciones.expiraEn,
          consumidaEn: invitaciones.consumidaEn,
          revocadaEn: invitaciones.revocadaEn,
        })
        .from(invitaciones)
        .where(
          and(
            eq(invitaciones.hashDelSecreto, core.hash(secreto)),
            eq(invitaciones.tipo, 'recuperacion'),
          ),
        )
        .get()
      if (
        !invitacion ||
        invitacion.consumidaEn !== null ||
        invitacion.revocadaEn !== null ||
        invitacion.expiraEn <= ahora
      ) {
        throw new InvitacionInvalida('venció, ya se usó o no existe')
      }

      const { proveedor, subject } = await resolverSubject(datos)
      if (proveedor !== invitacion.proveedorAReemplazar) {
        throw new InvitacionInvalida('el proveedor no coincide con el de la invitación')
      }
      const enUso = core.bd
        .select({ id: identidadesExternas.id })
        .from(identidadesExternas)
        .where(
          and(
            eq(identidadesExternas.proveedor, proveedor),
            eq(identidadesExternas.subject, subject),
            isNull(identidadesExternas.desactivadaEn),
            ne(identidadesExternas.personaId, invitacion.personaId),
          ),
        )
        .get()
      if (enUso) throw new ProveedorYaVinculado()

      const identidadId = core.nuevoId('identidad')
      const consumida = core.bd.transaction((tx) => {
        tx.update(invitaciones)
          .set({ consumidaEn: ahora, actualizadoEn: ahora })
          .where(and(eq(invitaciones.id, invitacion.id), isNull(invitaciones.consumidaEn)))
          .run()
        const verificacion = tx
          .select({ consumidaEn: invitaciones.consumidaEn })
          .from(invitaciones)
          .where(eq(invitaciones.id, invitacion.id))
          .get()
        if (verificacion?.consumidaEn?.getTime() !== ahora.getTime()) return false

        // Desactivar el vinculo anterior, vincular el nuevo y revocar todas
        // las sesiones: las tres, o ninguna. Los demas proveedores de la
        // persona no se tocan.
        tx.update(identidadesExternas)
          .set({ desactivadaEn: ahora, actualizadoEn: ahora })
          .where(
            and(
              eq(identidadesExternas.personaId, invitacion.personaId),
              eq(identidadesExternas.proveedor, proveedor),
              isNull(identidadesExternas.desactivadaEn),
            ),
          )
          .run()
        tx.insert(identidadesExternas)
          .values({
            id: identidadId,
            personaId: invitacion.personaId,
            proveedor,
            subject,
            desactivadaEn: null,
            creadoEn: ahora,
            actualizadoEn: ahora,
          })
          .run()
        tx.update(sesiones)
          .set({ revocadaEn: ahora, actualizadoEn: ahora })
          .where(and(eq(sesiones.personaId, invitacion.personaId), isNull(sesiones.revocadaEn)))
          .run()
        return true
      })
      if (!consumida) throw new InvitacionInvalida('venció, ya se usó o no existe')

      registrarEvento(
        'invitacion.recuperacion.consumir',
        invitacion.personaId,
        invitacion.personaId,
        {
          invitacionId: invitacion.id,
          proveedor,
        },
      )
      return crearSesion(identidadId, invitacion.personaId)
    },

    async elevarSesion(sesionId, datos) {
      const sesion = core.bd
        .select({ personaId: sesiones.personaId })
        .from(sesiones)
        .where(
          and(
            eq(sesiones.id, sesionId),
            isNull(sesiones.revocadaEn),
            gt(sesiones.expiraEn, core.reloj.ahora()),
          ),
        )
        .get()
      if (!sesion) throw new ElevacionDenegada()
      if (!esAdministrador(sesion.personaId)) throw new ElevacionDenegada()

      const { proveedor, subject } = await resolverSubject(datos)
      const identidadDeLaPersona = core.bd
        .select({ id: identidadesExternas.id })
        .from(identidadesExternas)
        .where(
          and(
            eq(identidadesExternas.personaId, sesion.personaId),
            eq(identidadesExternas.proveedor, proveedor),
            eq(identidadesExternas.subject, subject),
            isNull(identidadesExternas.desactivadaEn),
          ),
        )
        .get()
      // La reautenticacion tiene que ser de una identidad ya vinculada a esta
      // misma persona: repetir el login de otra persona -aunque sea valido
      // para ella- no eleva esta sesion.
      if (!identidadDeLaPersona) throw new ElevacionDenegada()

      const ahora = core.reloj.ahora()
      core.bd
        .update(sesiones)
        .set({ elevadaHasta: despuesDe(ahora, DURACION_DE_ELEVACION), actualizadoEn: ahora })
        .where(eq(sesiones.id, sesionId))
        .run()
      registrarEvento('sesion.elevar', sesion.personaId, sesion.personaId, { sesionId })
    },

    auditarEscrituraElevada(personaId, operacion) {
      registrarEvento('sudo.escritura', personaId, null, { operacion })
    },

    async asignarAdministrador(personaId) {
      if (!(await personas.personaExiste(personaId))) throw new IdentidadInvalida()
      const anterior = core.bd
        .select({ personaId: administradorDelSistema.personaId })
        .from(administradorDelSistema)
        .get()
      const ahora = core.reloj.ahora()
      if (anterior) {
        core.bd
          .update(administradorDelSistema)
          .set({ personaId, actualizadoEn: ahora })
          .where(eq(administradorDelSistema.singleton, 1))
          .run()
      } else {
        core.bd
          .insert(administradorDelSistema)
          .values({ singleton: 1, personaId, creadoEn: ahora, actualizadoEn: ahora })
          .run()
      }
      registrarEvento('administrador.reasignar', anterior?.personaId ?? null, personaId, {})
    },

    async crearSesionParaIdentidad(identidadId) {
      const identidad = core.bd
        .select({ personaId: identidadesExternas.personaId })
        .from(identidadesExternas)
        .where(
          and(eq(identidadesExternas.id, identidadId), isNull(identidadesExternas.desactivadaEn)),
        )
        .get()
      if (!identidad || !(await personas.personaExiste(identidad.personaId))) {
        throw new IdentidadInvalida()
      }
      return crearSesion(identidadId, identidad.personaId)
    },

    async resolverSesion(secreto) {
      const ahora = core.reloj.ahora()
      const sesion = core.bd
        .select({
          sesionId: sesiones.id,
          personaId: sesiones.personaId,
          identidadId: sesiones.identidadId,
          elevadaHasta: sesiones.elevadaHasta,
        })
        .from(sesiones)
        .innerJoin(
          identidadesExternas,
          and(
            eq(identidadesExternas.id, sesiones.identidadId),
            isNull(identidadesExternas.desactivadaEn),
          ),
        )
        .where(
          and(
            eq(sesiones.hashDelSecreto, core.hash(secreto)),
            isNull(sesiones.revocadaEn),
            gt(sesiones.expiraEn, ahora),
          ),
        )
        .get()
      if (!sesion) return null
      return {
        sesionId: sesion.sesionId,
        personaId: sesion.personaId,
        identidadId: sesion.identidadId,
        estaElevada: sesion.elevadaHasta !== null && sesion.elevadaHasta > ahora,
      }
    },

    async revocarSesion(sesionId) {
      const ahora = core.reloj.ahora()
      core.bd
        .update(sesiones)
        .set({ revocadaEn: ahora, actualizadoEn: ahora })
        .where(eq(sesiones.id, sesionId))
        .run()
    },
  }
}
