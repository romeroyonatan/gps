import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

/** Cierra la sesión en el servidor y tira todo el cache: lo que quedó adentro
 *  son datos que esta persona podía ver, y la siguiente puede no poder. */
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

export function useCerrarSesion() {
  const transporte = useTransporte()
  const clienteDeQueries = useQueryClient()
  return useMutation({
    mutationFn: () => transporte.ejecutar(CerrarSesionDocument),
    onSuccess: async () => {
      await clienteDeQueries.cancelQueries()
      clienteDeQueries.clear()
    },
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
