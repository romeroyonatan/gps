import { useQuery } from '@tanstack/react-query'
import {
  AsignarCargoDocument,
  CambiarDeUnidadDocument,
  CrearPersonaDocument,
  EditarPersonaDocument,
  IntegrarEquipoDocument,
  JefesDeGruposDocument,
  PersonasDocument,
  RegistrarPasesDocument,
  RevocarCargoDocument,
  RevocarIntegranteDeEquipoDocument,
} from './generated/graphql'
import { useMutacion, useTransporte } from './proveedor'

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
 *  acordarse de hacer. Corregir los datos y pasar de unidad invalidan lo mismo:
 *  la nomina del grupo es de donde salen las dos pantallas que los muestran. */
const PERSONAS = ['personas']
export const useCrearPersona = () => useMutacion(CrearPersonaDocument, PERSONAS)
export const useEditarPersona = () => useMutacion(EditarPersonaDocument, PERSONAS)
export const useCambiarDeUnidad = () => useMutacion(CambiarDeUnidadDocument, PERSONAS)

/** La ceremonia de pases mueve a varios de unidad, asi que invalida lo mismo
 *  que el cambio de uno: la nomina del grupo. */
export const useRegistrarPases = () => useMutacion(RegistrarPasesDocument, PERSONAS)

/** Las cuatro operaciones de plantel. Todas invalidan `personas` y
 *  `personaActual`: cambiar un cargo cambia lo que esa persona puede hacer, y
 *  si se lo cambió a sí misma tiene que verlo ya. */
const PLANTEL = [PERSONAS, ['personaActual']]
export const useAsignarCargo = () => useMutacion(AsignarCargoDocument, ...PLANTEL)
export const useRevocarCargo = () => useMutacion(RevocarCargoDocument, ...PLANTEL)
export const useIntegrarEquipo = () => useMutacion(IntegrarEquipoDocument, ...PLANTEL)
export const useRevocarIntegranteDeEquipo = () =>
  useMutacion(RevocarIntegranteDeEquipoDocument, ...PLANTEL)
