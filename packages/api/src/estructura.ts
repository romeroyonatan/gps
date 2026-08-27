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
