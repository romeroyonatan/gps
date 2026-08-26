import { useQuery } from '@tanstack/react-query'
import { VersionDocument } from './generated/graphql'
import { useTransporte } from './proveedor'

export function useVersion() {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['version'],
    queryFn: () => transporte.ejecutar(VersionDocument),
  })
}
