import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AnularPagoDocument,
  CuentaDeGrupoDocument,
  DefinirCuotaDeAfiliacionDocument,
  GenerarDeudasPendientesDocument,
  type MedioDePago,
  RegistrarPagoDocument,
  ReporteDeCobranzaDocument,
  TesoreriaDocument,
} from './generated/graphql'
import { useTransporte } from './proveedor'

export function useTesoreria() {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['tesoreria'],
    queryFn: () => transporte.ejecutar(TesoreriaDocument),
  })
}

/** El reporte de cobranza de un período. Null del servidor quiere decir "esto
 *  no es para vos": lo ve la Tesorería diocesana y las autoridades que le
 *  piden cuentas. */
export function useReporteDeCobranza(periodo: number) {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['reporteDeCobranza', periodo],
    queryFn: () => transporte.ejecutar(ReporteDeCobranzaDocument, { periodo }),
  })
}

export function useCuentaDeGrupo(grupoId: string) {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['cuentaDeGrupo', grupoId],
    queryFn: () => transporte.ejecutar(CuentaDeGrupoDocument, { grupoId }),
  })
}

const invalidarTesoreria = (cliente: ReturnType<typeof useQueryClient>, grupoId?: string) => {
  cliente.invalidateQueries({ queryKey: ['tesoreria'] })
  if (grupoId) cliente.invalidateQueries({ queryKey: ['cuentaDeGrupo', grupoId] })
}

export function useDefinirCuotaDeAfiliacion() {
  const transporte = useTransporte()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (variables: { periodo: number; importe: number }) =>
      transporte.ejecutar(DefinirCuotaDeAfiliacionDocument, variables),
    onSuccess: () => invalidarTesoreria(cliente),
  })
}

export function useRegistrarPago() {
  const transporte = useTransporte()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (variables: {
      grupoId: string
      fecha: string
      importe: number
      medioDePago: MedioDePago
      referencia?: string
      observacion?: string
    }) => transporte.ejecutar(RegistrarPagoDocument, variables),
    onSuccess: (_datos, variables) => invalidarTesoreria(cliente, variables.grupoId),
  })
}

export function useAnularPago(grupoId: string) {
  const transporte = useTransporte()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (variables: { pagoId: string }) =>
      transporte.ejecutar(AnularPagoDocument, variables),
    onSuccess: () => invalidarTesoreria(cliente, grupoId),
  })
}

export function useGenerarDeudasPendientes() {
  const transporte = useTransporte()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: () => transporte.ejecutar(GenerarDeudasPendientesDocument),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['tesoreria'] })
      cliente.invalidateQueries({ queryKey: ['cuentaDeGrupo'] })
    },
  })
}
