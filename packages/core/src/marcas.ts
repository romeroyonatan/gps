/** Cuando se creo y cuando se toco por ultima vez. Las escribe el servicio de
 *  cada modulo con core.reloj.ahora(), nunca la base: ver la regla de
 *  portabilidad en AGENT.md.
 *
 *  Vive en core y no en un modulo porque la necesitan todos, y los modulos no
 *  se pueden importar entre si. Es la forma del dato, que cruza hasta las
 *  pantallas; como se guarda -las columnas de Drizzle- sigue siendo decision de
 *  cada modulo, en su propio tablas.ts. */
export interface Marcas {
  readonly creadoEn: Date
  readonly actualizadoEn: Date
}
