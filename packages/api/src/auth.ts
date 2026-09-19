import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CerrarSesionDocument,
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
