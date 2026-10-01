import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { QueryClient, type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Persister } from '@tanstack/react-query-persist-client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createContext, type ReactNode, useContext } from 'react'
import type { Transporte } from './transporte'

const ContextoDeTransporte = createContext<Transporte | null>(null)

export function useTransporte(): Transporte {
  const transporte = useContext(ContextoDeTransporte)
  if (!transporte) throw new Error('Falta envolver la app en ProveedorDeApi.')
  return transporte
}

/** Una mutation y lo que deja viejo. Las variables y el resultado salen del
 *  documento generado; una operacion sin variables se llama `mutate()`. */
export function useMutacion<Resultado, Variables>(
  documento: TypedDocumentNode<Resultado, Variables>,
  ...claves: QueryKey[]
) {
  const transporte = useTransporte()
  const cliente = useQueryClient()
  return useMutation({
    // biome-ignore lint/suspicious/noConfusingVoidType: void es lo que deja llamar `mutate()` sin argumento
    mutationFn: (variables: Variables extends Record<string, never> ? void : Variables) =>
      transporte.ejecutar(documento, variables as Variables),
    onSuccess: () => Promise.all(claves.map((queryKey) => cliente.invalidateQueries({ queryKey }))),
  })
}

/** Un mes de cache en disco: alcanza para que la app abra sin conexion. */
const UN_MES = 1000 * 60 * 60 * 24 * 30

export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: UN_MES, staleTime: 1000 * 60, retry: 1 },
    },
  })
}

export function ProveedorDeApi(props: {
  transporte: Transporte
  queryClient: QueryClient
  persister: Persister
  children: ReactNode
}) {
  return (
    <PersistQueryClientProvider
      client={props.queryClient}
      persistOptions={{ persister: props.persister, maxAge: UN_MES }}
    >
      <ContextoDeTransporte.Provider value={props.transporte}>
        {props.children}
      </ContextoDeTransporte.Provider>
    </PersistQueryClientProvider>
  )
}
