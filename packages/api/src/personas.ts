import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CrearPersonaDocument,
  type CrearPersonaMutationVariables,
  PersonasDocument,
} from './generated/graphql'
import { useTransporte } from './proveedor'

export function usePersonas() {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['personas'],
    queryFn: () => transporte.ejecutar(PersonasDocument),
  })
}

/** Al alta exitosa invalida ['personas'] para que la lista se vuelva a traer
 *  sola. Es lo unico que la pantalla no tiene que acordarse de hacer. */
export function useCrearPersona() {
  const transporte = useTransporte()
  const clienteDeQueries = useQueryClient()
  return useMutation({
    mutationFn: (variables: CrearPersonaMutationVariables) =>
      transporte.ejecutar(CrearPersonaDocument, variables),
    onSuccess: () => clienteDeQueries.invalidateQueries({ queryKey: ['personas'] }),
  })
}
