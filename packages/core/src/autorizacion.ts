import { defaultFieldResolver, GraphQLError, type GraphQLSchema } from 'graphql'
import type { Actor, Alcance, Rol } from './actor'
import type { Builder } from './builder'
import type { Context } from './context'
import type { Module } from './module'

/** Capa 1 de la autorización: quién alcanza el módulo, en general. Cada módulo
 *  la declara siempre -el campo es obligatorio en `Module`, así que un módulo
 *  nuevo no compila sin decidirlo- y la decisión por omisión es denegar.
 *  `publico` es para lo que tiene que funcionar sin sesión: la versión del
 *  sistema y el propio flujo de autenticación.
 *
 *  Las capas 2 y 3 -el `Alcance` de los repositorios y las políticas por
 *  operación y campo- van en el `/dominio` de cada módulo: esto sólo decide si
 *  el pedido llega a tocar el módulo. */
export interface AccesoAlModulo {
  readonly porDefecto: 'denegado' | 'publico'
  readonly permitidos: readonly Rol[]
}

export function permiteElModulo(acceso: AccesoAlModulo, actor: Actor | null): boolean {
  if (acceso.porDefecto === 'publico') return true
  if (!actor) return false
  if (actor.estaElevado) return true
  return actor.roles.some((funcion) => acceso.permitidos.includes(funcion.rol))
}

/** Un campo raíz que ningún módulo registró no tiene dueño y por lo tanto no
 *  tiene política: el esquema no se compone en vez de publicarlo abierto. */
export class CampoSinModulo extends Error {
  constructor(campo: string) {
    super(`El campo "${campo}" no lo registró ningún módulo: no tiene acceso declarado.`)
    this.name = 'CampoSinModulo'
  }
}

function rechazo(modulo: string, actor: Actor | null): GraphQLError {
  return actor
    ? new GraphQLError(`No tenés acceso a ${modulo}.`, { extensions: { code: 'SIN_PERMISO' } })
    : new GraphQLError('Necesitás iniciar sesión.', { extensions: { code: 'NO_AUTENTICADO' } })
}

/** El alcance de un pedido ya autorizado por la capa 1. Lo usan los resolvers
 *  de los modulos protegidos: si la capa 1 dejo pasar el pedido a un modulo que
 *  no es publico, hay actor y hay alcance. */
export function alcanceDe(contexto: Context): Alcance {
  if (!contexto.alcance) {
    throw new GraphQLError('Necesitás iniciar sesión.', {
      extensions: { code: 'NO_AUTENTICADO' },
    })
  }
  return contexto.alcance
}

/** Un alcance sin limites, para los caminos que no tienen un usuario detras:
 *  la siembra del demo y los tests que no estan probando autorizacion. No sale
 *  de aca a un resolver: `crearContexto` construye el alcance de un request
 *  unicamente con `estructura.expandirAlcance`, a partir del actor real. */
export function alcanceSinLimites(personaId = 'interno'): Alcance {
  return {
    actor: { personaId, roles: [], esAdministradorDesignado: false, estaElevado: true },
    gruposVisibles: [],
    distritosVisibles: [],
    esAdministrador: true,
  }
}

// biome-ignore lint/suspicious/noExplicitAny: el registro es agnostico del tipo de servicios
type Cualquiera = Module<any, any>

/** Anota qué módulo registra cada campo raíz. Sólo `queryField` y
 *  `mutationField` crean campos raíz: los demás helpers del builder crean
 *  tipos, que se alcanzan a través de un campo raíz ya autorizado. */
function espiar(builder: Builder, modulo: Cualquiera, duenos: Map<string, Cualquiera>): Builder {
  return new Proxy(builder, {
    get(objetivo, propiedad) {
      const valor = (objetivo as unknown as Record<string | symbol, unknown>)[propiedad]
      if (typeof valor !== 'function') return valor
      const raiz =
        propiedad === 'queryField' ? 'Query' : propiedad === 'mutationField' ? 'Mutation' : null
      if (!raiz) return valor.bind(objetivo)
      return (nombre: string, ...resto: unknown[]) => {
        duenos.set(`${raiz}.${nombre}`, modulo)
        return (valor as (...args: unknown[]) => unknown).call(objetivo, nombre, ...resto)
      }
    },
  }) as Builder
}

/** Registra el esquema de cada módulo y le cuelga a cada campo raíz el control
 *  de acceso al módulo que lo registró. Se resuelve una vez por campo, antes
 *  de tocar la base, y produce el error útil -"no tenés acceso a Tesorería"-
 *  en vez de una lista vacía. */
export function componerEsquema(builder: Builder, modulos: readonly Cualquiera[]): GraphQLSchema {
  const duenos = new Map<string, Cualquiera>()
  for (const modulo of modulos) modulo.registerSchema(espiar(builder, modulo, duenos))
  const esquema = builder.toSchema()

  for (const tipo of [esquema.getQueryType(), esquema.getMutationType()]) {
    if (!tipo) continue
    for (const [nombre, campo] of Object.entries(tipo.getFields())) {
      const dueno = duenos.get(`${tipo.name}.${nombre}`)
      if (!dueno) throw new CampoSinModulo(`${tipo.name}.${nombre}`)
      const anterior = campo.resolve ?? defaultFieldResolver
      campo.resolve = (padre, args, contexto: Context, info) => {
        if (!permiteElModulo(dueno.accesoAlModulo, contexto.actor)) {
          throw rechazo(dueno.name, contexto.actor)
        }
        return anterior(padre, args, contexto, info)
      }
    }
  }
  return esquema
}
