import type { Context, Reloj } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'

export function secretoDelPedido(pedido: Request): string | null {
  const autorizacion = pedido.headers.get('authorization')
  if (autorizacion) {
    const bearer = /^Bearer\s+(.+)$/i.exec(autorizacion)
    return bearer?.[1] ?? null
  }
  return new Bun.CookieMap(pedido.headers.get('cookie') ?? '').get('gps_session') || null
}

/** Resuelve identidad, funciones y alcance exactamente una vez por request. */
export function crearContexto(base: Context, reloj: Reloj) {
  return async ({ request }: { request: Request }): Promise<Context> => {
    const intencionElevada = request.headers.get('x-gps-intencion-elevada') === '1'
    const secreto = secretoDelPedido(request)
    if (!secreto) return { ...base, intencionElevada }

    const sesion = await base.auth.resolverSesion(secreto)
    if (!sesion) return { ...base, intencionElevada }

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
      elevadaHasta: sesion.elevadaHasta,
      intencionElevada,
      alcance: await base.estructura.expandirAlcance(actor),
    }
  }
}
