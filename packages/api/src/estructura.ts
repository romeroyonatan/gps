import { useQuery } from '@tanstack/react-query'
import { DistritosDocument } from './generated/graphql'
import { useTransporte } from './proveedor'

export function useDistritos() {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['distritos'],
    queryFn: () => transporte.ejecutar(DistritosDocument),
  })
}

/** Un grupo y su distrito, buscados en el árbol que ya está en cache: a un
 *  grupo se entra desde el directorio, así que estrenar `grupo(id)` sería
 *  pedir de nuevo lo que ya se tiene. Cuatro pantallas de mobile escribían
 *  este mismo `flatMap().find()`, y el distrito hace falta para el encabezado
 *  y para saber quién es el comisionado que firma.
 *
 *  `grupo` en `undefined` con la consulta ya resuelta quiere decir que no hay
 *  ninguno abierto con esa dirección -un enlace viejo, un grupo cerrado-, que
 *  es un estado que la pantalla tiene que dibujar. */
export function useGrupo(grupoId: string) {
  const { data, isPending, error } = useDistritos()
  const distrito = data?.distritos.find((uno) => uno.grupos.some((grupo) => grupo.id === grupoId))
  return {
    distrito,
    grupo: distrito?.grupos.find((uno) => uno.id === grupoId),
    isPending,
    error,
  }
}
