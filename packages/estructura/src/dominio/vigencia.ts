import { aFechaDeCalendario } from '@gps/core/fechas'

/** Un grupo existe durante todo el dia en que se lo cierra. */
export function grupoEstabaAbiertoEn(fecha: string, cerradoEn: Date | null): boolean {
  return cerradoEn === null || fecha <= aFechaDeCalendario(cerradoEn)
}
