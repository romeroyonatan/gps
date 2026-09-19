/** La fecha de calendario de un instante, segun el almanaque de quien lo mira.
 *
 *  Componentes locales y no toISOString: en UTC-3 el 1 de mayo a las 22:00
 *  seria el 2 de mayo en UTC.
 *
 *  Vive en core y no en un modulo porque la necesitan varios -personas para
 *  validar el ingreso, estructura para saber si un grupo estaba abierto un dia,
 *  afiliacion para el periodo- y los modulos no se pueden importar entre si.
 *  Es la misma razon que Marcas.
 *
 *  Ojo con el archivo: va en su propio subpath y NO en src/index.ts. El indice
 *  es plomeria de servidor y arrastra drizzle-orm por aplicarMigraciones, que
 *  importa `sql` como valor; las apps importan esta funcion, asi que sacarla
 *  por el indice se los meteria en el bundle -y Metro no hace tree-shaking-.
 *  Los tipos (Marcas) no tienen el problema: se borran al compilar. */
export function aFechaDeCalendario(instante: Date): string {
  const mes = `${instante.getMonth() + 1}`.padStart(2, '0')
  const dia = `${instante.getDate()}`.padStart(2, '0')
  return `${instante.getFullYear()}-${mes}-${dia}`
}

/** Que la cadena sea una fecha real del almanaque, y no solo que tenga la
 *  forma. Sin el ida y vuelta por Date, "2010-02-30" pasaria la expresion
 *  regular.
 *
 *  `new Date(...)` con valores explicitos es determinista y no consulta el
 *  reloj, asi que no toca la regla de portabilidad.
 *
 *  Vive aca por la misma razon que aFechaDeCalendario: la necesitan varios
 *  modulos -personas para el ingreso, salidas para las fechas de la salida- y
 *  los modulos no se pueden importar entre si. */
export function esFechaDeCalendario(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false
  const [anio = 0, mes = 0, dia = 0] = texto.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  )
}
