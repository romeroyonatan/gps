import { useQuery } from '@tanstack/react-query'
import { DistritosDocument, type DistritosQuery } from './generated/graphql'
import { useTransporte } from './proveedor'

export type Distrito = DistritosQuery['distritos'][number]
export type Grupo = Distrito['grupos'][number]

export function useDistritos() {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['distritos'],
    queryFn: () => transporte.ejecutar(DistritosDocument),
  })
}

/** Un grupo y su distrito, buscados en el árbol que ya está en caché. Seis
 *  pantallas hacían este mismo cruce a mano y en dos redacciones distintas
 *  —`find`+`some` para el distrito, `flatMap`+`find` para el grupo—, que es
 *  una sola pregunta escrita de dos formas.
 *
 *  Reusa la consulta del árbol en vez de estrenar `grupo(id)`: TanStack Query
 *  ya la tiene porque venís del directorio, y de paso trae el distrito, que es
 *  lo que hace falta para saber quién es el comisionado. Son quince grupos; el
 *  día que dejen de entrar en una consulta se agrega `grupo(id)` y se arregla
 *  acá y en ningún otro lado. */
export function useGrupo(grupoId: string): {
  grupo: Grupo | undefined
  distrito: Distrito | undefined
  isPending: boolean
  error: Error | null
} {
  const consulta = useDistritos()
  const distrito = consulta.data?.distritos.find((candidato) =>
    candidato.grupos.some((grupo) => grupo.id === grupoId),
  )
  return {
    grupo: distrito?.grupos.find((candidato) => candidato.id === grupoId),
    distrito,
    isPending: consulta.isPending,
    error: consulta.error,
  }
}
