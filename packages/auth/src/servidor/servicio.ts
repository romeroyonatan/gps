import type { Actor, Core, EjecutorDeAuditoria } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Estructura } from '@gps/estructura/dominio'
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

/** Lo que la pantalla de un enlace muestra antes de confirmar. */
export interface VistaDeInvitacion {
  readonly estado: 'valida' | 'vencida' | 'usada' | 'revocada'
  readonly tipo: 'activacion' | 'recuperacion' | null
  readonly persona: { readonly nombres: string; readonly apellidos: string } | null
  /** El grupo de esa persona hoy, ya con nombre: es el ámbito que la pantalla
   *  muestra antes de que alguien confirme el enlace. */
  readonly grupo: string | null
  readonly proveedorAReemplazar: ProveedorDeIdentidad | null
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
  /** Cómo se llama quien tiene la sesión. Lo resuelve auth y no el resolver
   *  porque `personas` le llega como dependencia declarada -la interfaz
   *  pública, no el servicio-, y el contexto de un módulo es privado de ese
   *  módulo. */
  nombreDe(personaId: string): Promise<{ nombres: string; apellidos: string } | null>

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

  /** Mira una invitación sin consumirla, para que la pantalla pueda mostrar a
   *  quién le da acceso antes de que alguien confirme. No pide sesión: el
   *  secreto es la autorización, y quien lo tiene ya podría consumirlo.
   *
   *  Devuelve el estado en vez de lanzar, porque "venció" y "ya se usó" son
   *  cosas distintas para quien abrió el enlace y las dos hay que poder
   *  explicarlas. Un secreto que no existe se responde igual que uno vencido:
   *  contestar distinto dejaría probar secretos. */
  mirarInvitacion(secreto: string): Promise<VistaDeInvitacion>

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

  /** Registra la carrera en que el cliente inició una acción con sudo visible
   *  pero el servidor ya lo encontró vencido y denegó la mutation. */
  auditarIntentoElevadoRechazado(personaId: string, operacion: string): void

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
  estructura: Estructura,
  proveedores: Partial<Record<ProveedorDeIdentidad, ProveedorOidc>>,
): ServicioDeAuth {
  /** El ámbito que muestra un enlace antes de confirmarlo: "Grupo Scout Nº42 -
   *  Ceferino Namuncurá" dice mucho más que un id. */
  async function nombreDelGrupoDe(personaId: string, fecha: string): Promise<string | null> {
    const grupoId = await personas.grupoVigenteDe(personaId, fecha)
    const grupo = grupoId ? await estructura.obtenerGrupo(grupoId) : null
    return grupo ? `Grupo Scout Nº${grupo.numero} - ${grupo.nombre}` : null
  }

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
    detalles: Record<string, string | number | boolean | null>,
    resultado: 'exitoso' | 'rechazado' = 'exitoso',
    ejecutor?: EjecutorDeAuditoria,
  ): void {
    core.auditoria.registrar({
      actorPersonaId,
      modulo: 'auth',
      accion: tipo,
      resultado,
      elevado: tipo === 'sesion.elevar' || tipo === 'sudo.escritura',
      objetivoPersonaId,
      resumen: detalles,
    }, ejecutor)
  }

  return {
    async nombreDe(personaId) {
      return personas.nombreDe(personaId)
    },
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

    async mirarInvitacion(secreto) {
      const ahora = core.reloj.ahora()
      const invitacion = core.bd
        .select({
          tipo: invitaciones.tipo,
          personaId: invitaciones.personaId,
          proveedorAReemplazar: invitaciones.proveedorAReemplazar,
          expiraEn: invitaciones.expiraEn,
          consumidaEn: invitaciones.consumidaEn,
          revocadaEn: invitaciones.revocadaEn,
        })
        .from(invitaciones)
        .where(eq(invitaciones.hashDelSecreto, core.hash(secreto)))
        .get()

      // Un secreto inexistente se contesta igual que uno vencido: distinguirlos
      // dejaría probar secretos contra esta consulta, que no pide sesión.
      const nada = {
        estado: 'vencida',
        tipo: null,
        persona: null,
        grupo: null,
        proveedorAReemplazar: null,
      } as const
      if (!invitacion) return nada

      const estado = invitacion.revocadaEn
        ? ('revocada' as const)
        : invitacion.consumidaEn
          ? ('usada' as const)
          : invitacion.expiraEn <= ahora
            ? ('vencida' as const)
            : ('valida' as const)
      // Un enlace que ya no sirve no dice de quién era: no hace falta para
      // explicar que no sirve, y evita usarlo para averiguar.
      if (estado !== 'valida') return { ...nada, estado }

      return {
        estado,
        tipo: invitacion.tipo,
        persona: await personas.nombreDe(invitacion.personaId),
        grupo: await nombreDelGrupoDe(invitacion.personaId, aFechaDeCalendario(ahora)),
        proveedorAReemplazar: invitacion.proveedorAReemplazar,
      }
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
      // El doble consumo concurrente se resuelve adentro de la transaccion:
      // el callback es sincrono, asi que dos llamadas que se intercalaron en
      // el `await` del proveedor no pueden intercalarse aca. Quien llega
      // segundo ve `consumida_en` ya escrito y se va con las manos vacias.
      //
      // No alcanza con comparar el valor escrito contra `ahora`: dos consumos
      // en el mismo milisegundo leen el mismo instante, y los dos creerian
      // haber ganado. Un timestamp no es una identidad.
      const consumida = core.bd.transaction((tx) => {
        const actual = tx
          .select({ consumidaEn: invitaciones.consumidaEn })
          .from(invitaciones)
          .where(eq(invitaciones.id, invitacion.id))
          .get()
        if (!actual || actual.consumidaEn !== null) return false
        tx.update(invitaciones)
          .set({ consumidaEn: ahora, actualizadoEn: ahora })
          .where(eq(invitaciones.id, invitacion.id))
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
        registrarEvento('invitacion.recuperacion.consumir', null, null, {}, 'rechazado')
        throw new InvitacionInvalida('venció, ya se usó o no existe')
      }

      let identidad: { proveedor: ProveedorDeIdentidad; subject: string }
      try {
        identidad = await resolverSubject(datos)
      } catch (error) {
        registrarEvento(
          'invitacion.recuperacion.consumir',
          invitacion.personaId,
          invitacion.personaId,
          { invitacionId: invitacion.id },
          'rechazado',
        )
        throw error
      }
      const { proveedor, subject } = identidad
      if (proveedor !== invitacion.proveedorAReemplazar) {
        registrarEvento(
          'invitacion.recuperacion.consumir',
          invitacion.personaId,
          invitacion.personaId,
          { invitacionId: invitacion.id },
          'rechazado',
        )
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
      if (enUso) {
        registrarEvento(
          'invitacion.recuperacion.consumir',
          invitacion.personaId,
          invitacion.personaId,
          { invitacionId: invitacion.id },
          'rechazado',
        )
        throw new ProveedorYaVinculado()
      }

      const identidadId = core.nuevoId('identidad')
      // Mismo cierre del doble consumo que en la activacion: se relee adentro
      // de la transaccion, que es sincrona.
      const consumida = core.bd.transaction((tx) => {
        const actual = tx
          .select({ consumidaEn: invitaciones.consumidaEn })
          .from(invitaciones)
          .where(eq(invitaciones.id, invitacion.id))
          .get()
        if (!actual || actual.consumidaEn !== null) return false
        tx.update(invitaciones)
          .set({ consumidaEn: ahora, actualizadoEn: ahora })
          .where(eq(invitaciones.id, invitacion.id))
          .run()

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
        registrarEvento(
          'invitacion.recuperacion.consumir',
          invitacion.personaId,
          invitacion.personaId,
          { invitacionId: invitacion.id, proveedor },
          'exitoso',
          tx,
        )
        return true
      })
      if (!consumida) {
        registrarEvento(
          'invitacion.recuperacion.consumir',
          invitacion.personaId,
          invitacion.personaId,
          { invitacionId: invitacion.id },
          'rechazado',
        )
        throw new InvitacionInvalida('venció, ya se usó o no existe')
      }

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
      if (!sesion) {
        registrarEvento('sesion.elevar', null, null, { sesionId }, 'rechazado')
        throw new ElevacionDenegada()
      }
      if (!esAdministrador(sesion.personaId)) {
        registrarEvento(
          'sesion.elevar',
          sesion.personaId,
          sesion.personaId,
          { sesionId },
          'rechazado',
        )
        throw new ElevacionDenegada()
      }

      let identidad: { proveedor: ProveedorDeIdentidad; subject: string }
      try {
        identidad = await resolverSubject(datos)
      } catch (error) {
        registrarEvento(
          'sesion.elevar',
          sesion.personaId,
          sesion.personaId,
          { sesionId },
          'rechazado',
        )
        throw error
      }
      const { proveedor, subject } = identidad
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
      if (!identidadDeLaPersona) {
        registrarEvento(
          'sesion.elevar',
          sesion.personaId,
          sesion.personaId,
          { sesionId },
          'rechazado',
        )
        throw new ElevacionDenegada()
      }

      const ahora = core.reloj.ahora()
      core.bd.transaction((tx) => {
        tx.update(sesiones)
          .set({ elevadaHasta: despuesDe(ahora, DURACION_DE_ELEVACION), actualizadoEn: ahora })
          .where(eq(sesiones.id, sesionId))
          .run()
        registrarEvento(
          'sesion.elevar',
          sesion.personaId,
          sesion.personaId,
          { sesionId },
          'exitoso',
          tx,
        )
      })
    },

    auditarIntentoElevadoRechazado(personaId, operacion) {
      registrarEvento('sudo.escritura', personaId, null, { operacion }, 'rechazado')
    },

    async asignarAdministrador(personaId) {
      if (!(await personas.personaExiste(personaId))) {
        registrarEvento('administrador.reasignar', null, personaId, {}, 'rechazado')
        throw new Error(`La persona ${personaId} no existe.`)
      }
      const anterior = core.bd
        .select({ personaId: administradorDelSistema.personaId })
        .from(administradorDelSistema)
        .get()
      const ahora = core.reloj.ahora()
      core.bd.transaction((tx) => {
        if (anterior) {
          tx.update(administradorDelSistema)
            .set({ personaId, actualizadoEn: ahora })
            .where(eq(administradorDelSistema.singleton, 1))
            .run()
        } else {
          tx.insert(administradorDelSistema)
            .values({ singleton: 1, personaId, creadoEn: ahora, actualizadoEn: ahora })
            .run()
        }
        registrarEvento(
          'administrador.reasignar',
          anterior?.personaId ?? null,
          personaId,
          {},
          'exitoso',
          tx,
        )
      })
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
        elevadaHasta:
          sesion.elevadaHasta !== null && sesion.elevadaHasta > ahora ? sesion.elevadaHasta : null,
      }
    },

    async revocarSesion(sesionId) {
      const sesion = core.bd
        .select({ personaId: sesiones.personaId })
        .from(sesiones)
        .where(eq(sesiones.id, sesionId))
        .get()
      if (!sesion) return
      const ahora = core.reloj.ahora()
      core.bd.transaction((tx) => {
        tx.update(sesiones)
          .set({ revocadaEn: ahora, actualizadoEn: ahora })
          .where(eq(sesiones.id, sesionId))
          .run()
        registrarEvento(
          'sesion.revocar',
          sesion.personaId,
          sesion.personaId,
          { sesionId },
          'exitoso',
          tx,
        )
      })
    },
  }
}
