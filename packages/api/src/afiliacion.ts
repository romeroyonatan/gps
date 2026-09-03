import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AfiliadosEnDocument,
  DeclaracionesDocument,
  DeclararAfiliacionDocument,
} from './generated/graphql'
import { useTransporte } from './proveedor'

/** Las declaraciones de un grupo, de la mas reciente a la mas vieja. */
export function useDeclaraciones(grupoId: string) {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['declaraciones', grupoId],
    queryFn: () => transporte.ejecutar(DeclaracionesDocument, { grupoId }),
  })
}

/** Quienes de esa lista ya estan afiliados en ese periodo. El periodo lo pone
 *  la pantalla, de su propio almanaque: es el mismo criterio que estaVigente. */
export function useAfiliadosEn(periodo: number, personaIds: readonly string[]) {
  const transporte = useTransporte()
  return useQuery({
    // Los ids van en la clave: dos grupos distintos preguntan por gente
    // distinta y no pueden compartir la entrada de cache.
    queryKey: ['afiliadosEn', periodo, personaIds],
    queryFn: () =>
      transporte.ejecutar(AfiliadosEnDocument, { periodo, personaIds: [...personaIds] }),
    // Sin ids no hay nada que preguntar y la query no tiene que salir.
    enabled: personaIds.length > 0,
  })
}

/** Al declarar invalida las dos cosas que cambian: la lista de declaraciones
 *  del grupo y la señal de afiliacion de su gente. */
export function useDeclararAfiliacion() {
  const transporte = useTransporte()
  const clienteDeQueries = useQueryClient()
  return useMutation({
    mutationFn: (variables: { grupoId: string }) =>
      transporte.ejecutar(DeclararAfiliacionDocument, variables),
    onSuccess: () => {
      clienteDeQueries.invalidateQueries({ queryKey: ['declaraciones'] })
      clienteDeQueries.invalidateQueries({ queryKey: ['afiliadosEn'] })
    },
  })
}
