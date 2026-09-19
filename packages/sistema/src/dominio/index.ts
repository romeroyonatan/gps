export { accesoAlModulo } from './politicas'
/** Version del sistema. Es la respuesta de la consulta publica `version`. */
export interface Version {
  readonly numero: string
  readonly entorno: string
  /** Nombres de los modulos registrados en esta instancia. */
  readonly modulos: readonly string[]
}
