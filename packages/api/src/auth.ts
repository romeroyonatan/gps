import type { Actor, Alcance } from '@gps/core'
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import {
  CerrarSesionDocument,
  InvitacionDocument,
  InvitarDocument,
  PersonaActualDocument,
  RevocarInvitacionDocument,
} from './generated/graphql'
import { useTransporte } from './proveedor'

/** Quién tiene la sesión abierta. `null` cuando el pedido es anónimo, que no
 *  es un error: es la respuesta que hace que la app muestre el login.
 *
 *  `staleTime: 0` a propósito: los cargos y equipos vigentes pueden cambiar
 *  mientras la sesión sigue abierta -una remoción quita acceso en el request
 *  siguiente- y esta consulta es la que decide qué acciones se dibujan. */
export function usePersonaActual() {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['personaActual'],
    queryFn: () => transporte.ejecutar(PersonaActualDocument),
    staleTime: 0,
    retry: false,
  })
}

/** El actor de esta sesión, con la forma que esperan las políticas puras del
 *  dominio. Null si el pedido es anónimo.
 *
 *  Existe para que las pantallas llamen `puedeAdministrarPlantelDeGrupo` y
 *  compañía con exactamente el mismo dato que usa el servidor, en vez de que
 *  cada una arme el objeto a mano y alguna se equivoque. */
export function useActor(): Actor | null {
  const { data } = usePersonaActual()
  const quien = data?.personaActual
  if (!quien) return null
  return {
    personaId: quien.personaId,
    roles: quien.roles.map((funcion) => ({
      rol: funcion.rol,
      ambito: { tipo: funcion.ambitoTipo, id: funcion.ambitoId ?? null },
    })),
    esAdministradorDesignado: quien.esAdministradorDesignado,
    estaElevado: quien.estaElevado,
  }
}

/** El alcance ya expandido de esta sesión: qué grupos y distritos alcanza.
 *  Lo resolvió el servidor —expandir el distrito de un comisionado a sus
 *  grupos es su trabajo— y viaja para que la pantalla pueda preguntar
 *  `puedeVerPersonasDelGrupo` sin reimplementar esa expansión. */
export function useAlcance(): Alcance | null {
  const { data } = usePersonaActual()
  const actor = useActor()
  const alcance = data?.personaActual?.alcance
  if (!actor || !alcance) return null
  return {
    actor,
    gruposVisibles: alcance.gruposVisibles,
    distritosVisibles: alcance.distritosVisibles,
    esAdministrador: alcance.esAdministrador,
  }
}

/** Mira un enlace de activación o recuperación sin consumirlo, para mostrar a
 *  quién le da acceso antes de que alguien confirme. */
export function useInvitacion(secreto: string) {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['invitacion', secreto],
    queryFn: () => transporte.ejecutar(InvitacionDocument, { secreto }),
    retry: false,
  })
}

/** Tira lo que quedó de la sesión que se cierra: eran datos que esa persona
 *  podía ver, y la siguiente puede no poder.
 *
 *  No es `clear()`. `clear()` vacía el cache **sin avisarle a los observadores
 *  montados**: la pantalla se queda con el último resultado en la mano y sigue
 *  dibujando a quien ya salió. En la web no se notaba porque después recargaba
 *  la página entera; el teléfono no tiene recarga, así que salir no llevaba al
 *  login.
 *
 *  `resetQueries` sobre `personaActual` sí avisa -la deja en pendiente y vuelve
 *  a preguntar-, y esa respuesta anónima es la que hace aparecer el login. El
 *  resto se saca y no se resetea: no hay por qué volver a pedir el padrón de un
 *  grupo justo cuando se está yendo. */
export async function limpiarCacheDeSesion(cliente: QueryClient): Promise<void> {
  await cliente.cancelQueries()
  cliente.removeQueries({ predicate: (query) => query.queryKey[0] !== 'personaActual' })
  await cliente.resetQueries({ queryKey: ['personaActual'] })
}

export function useCerrarSesion() {
  const transporte = useTransporte()
  const clienteDeQueries = useQueryClient()
  return useMutation({
    mutationFn: () => transporte.ejecutar(CerrarSesionDocument),
    onSuccess: () => limpiarCacheDeSesion(clienteDeQueries),
  })
}

/** Vuelve a preguntar todo. Lo usa mobile después de entrar, porque ahí el
 *  login es una vuelta por el navegador del sistema y no una mutation: el
 *  secreto nuevo ya está guardado, lo que falta es volver a preguntar quién
 *  es. */
export function useRefrescarSesion(): () => Promise<void> {
  const clienteDeQueries = useQueryClient()
  return useCallback(async () => {
    await clienteDeQueries.invalidateQueries()
  }, [clienteDeQueries])
}

export function useInvitar() {
  const transporte = useTransporte()
  return useMutation({
    mutationFn: (variables: {
      personaId: string
      tipo: 'activacion' | 'recuperacion'
      proveedorAReemplazar?: 'google' | 'apple' | 'demo'
    }) => transporte.ejecutar(InvitarDocument, variables),
  })
}

export function useRevocarInvitacion() {
  const transporte = useTransporte()
  return useMutation({
    mutationFn: (variables: { invitacionId: string }) =>
      transporte.ejecutar(RevocarInvitacionDocument, variables),
  })
}
