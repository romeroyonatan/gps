import { AMBITOS, type AmbitoDeRol, alcanceDe, ROLES, type Rol } from '@gps/core'
import { type Builder, enumCompartido } from '@gps/core/graphql'
import { GraphQLError } from 'graphql'
import {
  PROVEEDORES,
  type ProveedorDeIdentidad,
  TIPOS_DE_INVITACION,
  type TipoDeInvitacion,
} from '../dominio/modelos'
import { AutoridadInsuficiente, InvitacionInvalida } from './servicio'

/** Lo que el cliente necesita saber de quien tiene la sesión abierta. Los
 *  cargos y equipos vigentes viajan acá porque las pantallas los usan para
 *  esconder acciones con las mismas políticas puras que aplica el servidor. */
interface PersonaAutenticada {
  readonly personaId: string
  readonly roles: readonly { rol: Rol; ambitoTipo: AmbitoDeRol; ambitoId: string | null }[]
  readonly esAdministradorDesignado: boolean
  readonly estaElevado: boolean
  readonly elevadaHasta: Date | null
  readonly alcance: {
    readonly gruposVisibles: readonly string[]
    readonly distritosVisibles: readonly string[]
    readonly esAdministrador: boolean
  }
}

export function registrarSchema(builder: Builder): void {
  const ProveedorRef = builder.enumType('ProveedorDeIdentidad', {
    description: 'Con qué proveedor externo se autentica una identidad.',
    values: PROVEEDORES as unknown as readonly ProveedorDeIdentidad[],
  })

  const TipoDeInvitacionRef = builder.enumType('TipoDeInvitacion', {
    description: 'Para qué es un enlace: activar el acceso, o recuperarlo.',
    values: TIPOS_DE_INVITACION as unknown as readonly TipoDeInvitacion[],
  })

  const RolRef = enumCompartido(
    builder,
    'Rol',
    ROLES,
    'La función que un cargo o un equipo vigente concede.',
  )
  const AmbitoRef = enumCompartido(
    builder,
    'AmbitoDeRol',
    AMBITOS,
    'Contra qué entidad apunta una función.',
  )

  const FuncionRef = builder
    .objectRef<PersonaAutenticada['roles'][number]>('FuncionVigente')
    .implement({
      description: 'Un cargo o equipo vigente, con el ámbito donde lo ejerce.',
      fields: (t) => ({
        rol: t.field({ type: RolRef, resolve: (funcion) => funcion.rol }),
        ambitoTipo: t.field({ type: AmbitoRef, resolve: (funcion) => funcion.ambitoTipo }),
        ambitoId: t.exposeID('ambitoId', { nullable: true }),
      }),
    })

  // El alcance ya expandido, tal como lo resolvió el contexto de este pedido.
  // Viaja para que las pantallas puedan preguntar `puedeVerPersonasDelGrupo` con la misma
  // función pura que aplica el servidor, en vez de reimplementar la expansión
  // de ámbitos —un comisionado alcanza los grupos de su distrito— del lado del
  // cliente. Es qué alcanza, no qué puede hacer: eso lo dicen los roles.
  const AlcanceRef = builder
    .objectRef<PersonaAutenticada['alcance']>('AlcanceDelPedido')
    .implement({
      description: 'Qué entidades alcanza quien pregunta, ya expandidas.',
      fields: (t) => ({
        gruposVisibles: t.idList({ resolve: (alcance) => [...alcance.gruposVisibles] }),
        distritosVisibles: t.idList({ resolve: (alcance) => [...alcance.distritosVisibles] }),
        esAdministrador: t.exposeBoolean('esAdministrador'),
      }),
    })

  const PersonaAutenticadaRef = builder
    .objectRef<PersonaAutenticada>('PersonaAutenticada')
    .implement({
      description: 'Quién está autenticado en este pedido.',
      fields: (t) => ({
        personaId: t.exposeID('personaId'),
        roles: t.field({ type: [FuncionRef], resolve: (quien) => [...quien.roles] }),
        esAdministradorDesignado: t.exposeBoolean('esAdministradorDesignado'),
        estaElevado: t.exposeBoolean('estaElevado'),
        elevadaHasta: t.string({
          nullable: true,
          description: 'Hasta cuándo vale la elevación, en ISO. Null si no está elevada.',
          resolve: (quien) => quien.elevadaHasta?.toISOString() ?? null,
        }),
        alcance: t.field({ type: AlcanceRef, resolve: (quien) => quien.alcance }),
      }),
    })

  const InvitacionRef = builder
    .objectRef<{ invitacionId: string; secreto: string; url: string }>('EnlaceDeInvitacion')
    .implement({
      description:
        'El enlace para compartir a mano. El secreto vuelve una única vez: ' +
        'el servidor sólo guarda su hash.',
      fields: (t) => ({
        invitacionId: t.exposeID('invitacionId'),
        url: t.exposeString('url'),
      }),
    })

  builder.queryField('personaActual', (t) =>
    t.field({
      type: PersonaAutenticadaRef,
      nullable: true,
      description: 'La persona de esta sesión, o null si el pedido es anónimo.',
      resolve: (_padre, _args, contexto) =>
        contexto.actor && {
          personaId: contexto.actor.personaId,
          roles: contexto.actor.roles.map((funcion) => ({
            rol: funcion.rol,
            ambitoTipo: funcion.ambito.tipo,
            ambitoId: funcion.ambito.id,
          })),
          esAdministradorDesignado: contexto.actor.esAdministradorDesignado,
          estaElevado: contexto.actor.estaElevado,
          elevadaHasta: contexto.elevadaHasta,
          alcance: contexto.alcance ?? {
            gruposVisibles: [],
            distritosVisibles: [],
            esAdministrador: false,
          },
        },
    }),
  )

  const EstadoRef = builder.enumType('EstadoDeInvitacion', {
    description: 'Si el enlace sirve, y si no, por qué.',
    values: ['valida', 'vencida', 'usada', 'revocada'] as const,
  })

  const VistaRef = builder
    .objectRef<{
      estado: 'valida' | 'vencida' | 'usada' | 'revocada'
      tipo: TipoDeInvitacion | null
      persona: string | null
      grupo: string | null
      proveedorAReemplazar: ProveedorDeIdentidad | null
    }>('Invitacion')
    .implement({
      description:
        'Lo que muestra un enlace de activación o recuperación antes de que ' +
        'alguien lo confirme. Un enlace que ya no sirve no dice de quién era.',
      fields: (t) => ({
        estado: t.field({ type: EstadoRef, resolve: (vista) => vista.estado }),
        tipo: t.field({
          type: TipoDeInvitacionRef,
          nullable: true,
          resolve: (vista) => vista.tipo,
        }),
        persona: t.exposeString('persona', { nullable: true }),
        grupo: t.exposeString('grupo', { nullable: true }),
        proveedorAReemplazar: t.field({
          type: ProveedorRef,
          nullable: true,
          resolve: (vista) => vista.proveedorAReemplazar,
        }),
      }),
    })

  builder.queryField('invitacion', (t) =>
    t.field({
      type: VistaRef,
      description:
        'Mira un enlace sin consumirlo. No pide sesión: el secreto es la ' +
        'autorización, y quien lo tiene ya podría consumirlo.',
      args: { secreto: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) => {
        const vista = await contexto.auth.mirarInvitacion(String(args.secreto))
        return {
          ...vista,
          persona: vista.persona ? `${vista.persona.nombres} ${vista.persona.apellidos}` : null,
        }
      },
    }),
  )

  builder.mutationField('cerrarSesion', (t) =>
    t.boolean({
      description: 'Revoca la sesión de este pedido. El cliente borra su secreto.',
      resolve: async (_padre, _args, contexto) => {
        if (!contexto.sesionId) return false
        await contexto.auth.revocarSesion(contexto.sesionId)
        return true
      },
    }),
  )

  builder.mutationField('invitar', (t) =>
    t.field({
      type: InvitacionRef,
      description:
        'Emite un enlace de activación o de recuperación para una persona del propio ámbito.',
      args: {
        personaId: t.arg.id({ required: true }),
        tipo: t.arg({ type: TipoDeInvitacionRef, required: true }),
        proveedorAReemplazar: t.arg({ type: ProveedorRef }),
      },
      resolve: async (_padre, args, contexto) => {
        const alcance = alcanceDe(contexto)
        try {
          const emitida = await contexto.auth.emitirInvitacion(alcance.actor, {
            tipo: args.tipo,
            personaId: String(args.personaId),
            proveedorAReemplazar: args.proveedorAReemplazar ?? undefined,
          })
          return {
            invitacionId: emitida.invitacionId,
            secreto: emitida.secreto,
            url: enlaceDe(contexto.config.auth?.origenPublico ?? '', args.tipo, emitida.secreto),
          }
        } catch (error) {
          return traducir(error)
        }
      },
    }),
  )

  builder.mutationField('revocarInvitacion', (t) =>
    t.boolean({
      description: 'Anula un enlace que todavía no se consumió.',
      args: { invitacionId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) => {
        try {
          await contexto.auth.revocarInvitacion(
            alcanceDe(contexto).actor,
            String(args.invitacionId),
          )
          return true
        } catch (error) {
          return traducir(error)
        }
      },
    }),
  )
}

/** El enlace que se comparte por WhatsApp. Es una ruta de la app y no de la
 *  API: la pantalla muestra persona y ámbito antes de confirmar, y recién ahí
 *  arranca el login del proveedor. */
function enlaceDe(origen: string, tipo: 'activacion' | 'recuperacion', secreto: string): string {
  return `${origen}/${tipo}/${secreto}`
}

const traducir = (error: unknown): never => {
  if (error instanceof AutoridadInsuficiente || error instanceof InvitacionInvalida) {
    throw new GraphQLError(error.message, { extensions: { code: error.name } })
  }
  throw error
}
