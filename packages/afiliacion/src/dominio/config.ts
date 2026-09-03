/** El dia en que arranca el periodo de afiliacion, como mes-dia.
 *
 *  Va despues de la temporada de campamentos -enero, a veces febrero- y no el
 *  1 de enero. Si la cobertura se cortara el 31 de diciembre, quien se afilio
 *  en noviembre llegaria sin afiliacion al campamento que cierra el ciclo por
 *  el que ya pago. Con el corte el 1 de marzo, el periodo 2026 va del 1 de
 *  marzo de 2026 al 28 de febrero de 2027. */
export const INICIO_DEL_PERIODO = '03-01'

/** Los dias en que la asociacion afila, como mes-dia. El anio lo resuelve
 *  fechasOrdinariasDelPeriodo.
 *
 *  Es un catalogo y no una tabla por lo mismo que los cargos: es un hecho del
 *  negocio, chico, que cambia poquisimo. Se llama config y no calendario
 *  porque es el archivo que se toca cuando la asociacion mueve una fecha.
 *
 *  No va en Config de core: Config tiene version, entorno y puerto, que son
 *  infraestructura, y meterle un campo de negocio hace que core conozca a un
 *  modulo. Con ocho modulos termina siendo el cajon de todos. */
export const FECHAS_ORDINARIAS = ['05-01', '11-01'] as const
