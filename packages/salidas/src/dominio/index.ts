export { avisoDeAnticipacion } from './anticipacion'
export { DIAS_DE_ANTICIPACION } from './config'
export { type FirmanteRequerido, firmantesRequeridos, mensajeASellar } from './firmas'
export type {
  Adjunto,
  Aviso,
  Estado,
  Firma,
  Marca,
  ModoDeFirma,
  Participante,
  ParticipanteEmitido,
  Permiso,
} from './modelos'
export { ESTADOS } from './modelos'
export { repartirSalidas, type SalidaDelPanel } from './panel'
export { cuantos, resumenDeParticipantes } from './participantes'
export {
  candidatos,
  marcaSegunCategoria,
  type Problema,
  puedeTransicionar,
  sePuedeEditar,
  validarDatos,
  validarParticipantes,
} from './permisos'
export {
  accesoAlModulo,
  puedeAdministrarPermisosDelGrupo,
  puedeFirmarEnLaApp,
  puedeVerPermisoDelGrupo,
} from './politicas'
export { deserializar, estaVacio, serializar, type Trazos } from './trazos'
