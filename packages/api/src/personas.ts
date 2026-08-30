import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CrearPersonaDocument,
  type CrearPersonaMutationVariables,
  PersonasDocument,
} from './generated/graphql'
import { useTransporte } from './proveedor'

/** Las personas de un grupo. No hay lista global: a una persona se llega por su
 *  grupo, que es como esta pensada la pantalla. */
export function usePersonasDelGrupo(grupoId: string) {
  const transporte = useTransporte()
  return useQuery({
    // El grupoId va en la clave: sin el, dos grupos compartirian la misma
    // entrada de cache y el segundo mostraria las personas del primero.
    queryKey: ['personas', grupoId],
    queryFn: () => transporte.ejecutar(PersonasDocument, { grupoId }),
  })
}

/** Al alta exitosa invalida ['personas'] entero -no solo el grupo- porque una
 *  persona nueva puede cambiar lo que se ve en mas de una pantalla el dia que
 *  exista el cambio de grupo. Es lo unico que la pantalla no tiene que
 *  acordarse de hacer. */
export function useCrearPersona() {
  const transporte = useTransporte()
  const clienteDeQueries = useQueryClient()
  return useMutation({
    mutationFn: (variables: CrearPersonaMutationVariables) =>
      transporte.ejecutar(CrearPersonaDocument, variables),
    onSuccess: () => clienteDeQueries.invalidateQueries({ queryKey: ['personas'] }),
  })
}
