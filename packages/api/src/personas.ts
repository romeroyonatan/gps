import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AsignarCargoDocument,
  type AsignarCargoMutationVariables,
  CrearPersonaDocument,
  type CrearPersonaMutationVariables,
  IntegrarEquipoDocument,
  type IntegrarEquipoMutationVariables,
  JefesDeGruposDocument,
  PersonasDocument,
  RevocarCargoDocument,
  RevocarIntegranteDeEquipoDocument,
} from './generated/graphql'
import { useTransporte } from './proveedor'
import type { Transporte } from './transporte'

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

/** Quiénes conducen esos grupos hoy. Se consulta aparte del árbol de distritos
 *  porque son dos módulos: `estructura` da el árbol y `personas` los jefes, y
 *  la pantalla cruza por id. */
export function useJefesDeGrupos(grupoIds: readonly string[], fecha: string) {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['jefesDeGrupos', fecha, [...grupoIds].sort().join(',')],
    queryFn: () => transporte.ejecutar(JefesDeGruposDocument, { grupoIds: [...grupoIds], fecha }),
    // Sin grupos no hay nada que preguntar, y el árbol todavía no llegó.
    enabled: grupoIds.length > 0,
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

/** Las cuatro operaciones de plantel. Todas invalidan `personas` y
 *  `personaActual`: cambiar un cargo cambia lo que esa persona puede hacer, y
 *  si se lo cambió a sí misma tiene que verlo ya. */
function useCambioDePlantel<V>(correr: (transporte: Transporte, variables: V) => Promise<unknown>) {
  const transporte = useTransporte()
  const clienteDeQueries = useQueryClient()
  return useMutation({
    mutationFn: (variables: V) => correr(transporte, variables),
    onSuccess: async () => {
      await clienteDeQueries.invalidateQueries({ queryKey: ['personas'] })
      await clienteDeQueries.invalidateQueries({ queryKey: ['personaActual'] })
    },
  })
}

export function useAsignarCargo() {
  return useCambioDePlantel<AsignarCargoMutationVariables>((transporte, variables) =>
    transporte.ejecutar(AsignarCargoDocument, variables),
  )
}

export function useRevocarCargo() {
  return useCambioDePlantel<{ cargoId: string }>((transporte, variables) =>
    transporte.ejecutar(RevocarCargoDocument, variables),
  )
}

export function useIntegrarEquipo() {
  return useCambioDePlantel<IntegrarEquipoMutationVariables>((transporte, variables) =>
    transporte.ejecutar(IntegrarEquipoDocument, variables),
  )
}

export function useRevocarIntegranteDeEquipo() {
  return useCambioDePlantel<{ integranteId: string }>((transporte, variables) =>
    transporte.ejecutar(RevocarIntegranteDeEquipoDocument, variables),
  )
}
