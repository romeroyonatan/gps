import type { Context, Reloj } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'

export function secretoDelPedido(pedido: Request): string | null {
  const autorizacion = pedido.headers.get('authorization')
  if (autorizacion) {
    const bearer = /^Bearer\s+(.+)$/i.exec(autorizacion)
    return bearer?.[1] ?? null
  }
  const cookie = pedido.headers.get('cookie')
  if (!cookie) return null
  for (const parte of cookie.split(';')) {
    const [nombre, ...valor] = parte.trim().split('=')
    if (nombre === 'gps_session') return valor.join('=') || null
  }
  return null
}

/** Resuelve identidad, funciones y alcance exactamente una vez por request. */
export function crearContexto(base: Context, reloj: Reloj) {
  return async ({ request }: { request: Request }): Promise<Context> => {
    const secreto = secretoDelPedido(request)
    if (!secreto) return base

    const sesion = await base.auth.resolverSesion(secreto)
    if (!sesion) return base

    const fecha = aFechaDeCalendario(reloj.ahora())
    const actor = {
      personaId: sesion.personaId,
      roles: await base.personas.funcionesVigentes(sesion.personaId, fecha),
      esAdministradorDesignado: await base.auth.esAdministradorDesignado(sesion.personaId),
      estaElevado: sesion.estaElevada,
    }
    return {
      ...base,
      actor,
      sesionId: sesion.sesionId,
      alcance: await base.estructura.expandirAlcance(actor),
    }
  }
}
