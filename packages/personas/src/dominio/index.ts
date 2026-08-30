export type { TipoDeCargo } from './cargos'
export { nombreDelCargo, TIPOS_DE_CARGO } from './cargos'
export type { Categoria } from './categorias'
export { CATEGORIAS } from './categorias'
export type { TipoDeDocumento } from './documentos'
export { nombreDelTipo, normalizarNumero, TIPOS_DE_DOCUMENTO } from './documentos'
export type { DatosDePersona, Persona } from './modelos'
export { calcularEdad, nombreCompleto } from './modelos'
export type { Problema } from './validaciones'
export { validarIngreso, validarPersona } from './validaciones'
export type {
  Cargo,
  DatosDeCargo,
  DatosDeIngreso,
  PersonaConVinculos,
  Pertenencia,
} from './vinculos'
export { aFechaDeCalendario, estaVigente } from './vinculos'
