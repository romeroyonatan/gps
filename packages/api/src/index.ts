export { useAfiliadosEn, useDeclaraciones, useDeclararAfiliacion } from './afiliacion'
export { useDistritos } from './estructura'
export type {
  CrearPersonaMutationVariables,
  DeclaracionesQuery,
  DistritosQuery,
  MedioDePago,
  PermisosQuery,
  PersonasQuery,
  TipoDeCargo,
  VersionQuery,
} from './generated/graphql'
export { useCrearPersona, usePersonasDelGrupo } from './personas'
export { crearQueryClient, ProveedorDeApi, useTransporte } from './proveedor'
export {
  useAgregarParticipante,
  useAnularPermiso,
  useCrearPermiso,
  useElegirUnidades,
  useEmitirPermiso,
  useFirmarEnApp,
  useFirmarEnPapel,
  usePermisos,
  useQuitarAdjunto,
  useQuitarParticipante,
  useReEmitirPermiso,
  useSubirArchivo,
} from './salidas'
export {
  useAnularPago,
  useCuentaDeGrupo,
  useDefinirCuotaDeAfiliacion,
  useGenerarDeudasPendientes,
  useRegistrarPago,
  useTesoreria,
} from './tesoreria'
export type { Transporte } from './transporte'
export { ErrorDeApi, transporteHttp } from './transporte'
export { useVersion } from './version'
