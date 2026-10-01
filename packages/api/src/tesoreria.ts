import { useQuery } from '@tanstack/react-query'
import {
  AnularPagoDocument,
  CuentaDeGrupoDocument,
  DefinirCuotaDeAfiliacionDocument,
  GenerarDeudasPendientesDocument,
  RegistrarPagoDocument,
  ReporteDeCobranzaDocument,
  TesoreriaDocument,
} from './generated/graphql'
import { useMutacion, useTransporte } from './proveedor'

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

export const useDefinirCuotaDeAfiliacion = () =>
  useMutacion(DefinirCuotaDeAfiliacionDocument, ['tesoreria'])
export const useRegistrarPago = () =>
  useMutacion(RegistrarPagoDocument, ['tesoreria'], ['cuentaDeGrupo'])
export const useAnularPago = (grupoId: string) =>
  useMutacion(AnularPagoDocument, ['tesoreria'], ['cuentaDeGrupo', grupoId])
export const useGenerarDeudasPendientes = () =>
  useMutacion(GenerarDeudasPendientesDocument, ['tesoreria'], ['cuentaDeGrupo'])
