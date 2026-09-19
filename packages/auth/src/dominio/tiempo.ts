/** Construye un instante relativo sin consultar la hora del sistema. */
export function despuesDe(instante: Date, milisegundos: number): Date {
  return new Date(instante.getTime() + milisegundos)
}
