export { useAfiliadosEn, useDeclaraciones, useDeclararAfiliacion } from './afiliacion'
export { useDistritos } from './estructura'
export type {
  CrearPersonaMutationVariables,
  DeclaracionesQuery,
  DistritosQuery,
  PersonasQuery,
  VersionQuery,
} from './generated/graphql'
export { useCrearPersona, usePersonasDelGrupo } from './personas'
export { crearQueryClient, ProveedorDeApi, useTransporte } from './proveedor'
export type { Transporte } from './transporte'
export { ErrorDeApi, transporteHttp } from './transporte'
export { useVersion } from './version'
